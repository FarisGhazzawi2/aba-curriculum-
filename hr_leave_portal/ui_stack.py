from pathlib import Path

from aws_cdk import (
    CfnOutput,
    Duration,
    Fn,
    RemovalPolicy,
    Stack,
    aws_apigateway as apigw,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_cognito as cognito,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
)
from constructs import Construct

# The Vite build output, relative to the repository root.
DEFAULT_UI_DIST = Path(__file__).resolve().parent.parent / "ui" / "dist"

# Paths CloudFront must refetch after every deploy (FR7.7).
INVALIDATION_PATHS = ["/index.html", "/config.json"]


def _require_ui_build(ui_dist: Path) -> Path:
    """Fail synth with a clear instruction when the UI has not been built."""
    if not (ui_dist / "index.html").is_file():
        raise FileNotFoundError(
            f"UI build not found at {ui_dist}. Run `npm ci && npm run build` in ui/ "
            "before synthesizing or deploying the CDK app."
        )
    return ui_dist


class UiStack(Stack):
    """Hosts the React UI in a private S3 bucket behind CloudFront (FR7, NFR1, NFR2).

    The stack depends on the backend and agent runtime stacks only through the values
    passed in; nothing in those stacks refers back to this one (FR7.6).
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        api: apigw.RestApi,
        user_pool: cognito.IUserPool,
        user_pool_client: cognito.IUserPoolClient,
        agent_runtime_arn: str,
        ui_dist_path: Path | None = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        ui_dist = _require_ui_build(Path(ui_dist_path) if ui_dist_path else DEFAULT_UI_DIST)

        bucket = s3.Bucket(
            self,
            "UiBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # S3 answers 403 for a missing key when listing is not allowed, so both 403 and
        # 404 fall back to index.html and client-side routes work on reload (FR7.2).
        spa_fallback = [
            cloudfront.ErrorResponse(
                http_status=status,
                response_http_status=200,
                response_page_path="/index.html",
                ttl=Duration.seconds(0),
            )
            for status in (403, 404)
        ]

        distribution = cloudfront.Distribution(
            self,
            "UiDistribution",
            comment="HR Leave Portal UI",
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            error_responses=spa_fallback,
        )

        # Public identifiers only (NFR2). The region is taken from the user pool id
        # ("<region>_<id>"), which is the region the pool and the agent runtime live in.
        runtime_config = {
            "apiUrl": api.url,
            "region": Fn.select(0, Fn.split("_", user_pool.user_pool_id)),
            "userPoolId": user_pool.user_pool_id,
            "userPoolClientId": user_pool_client.user_pool_client_id,
            "agentRuntimeArn": agent_runtime_arn,
        }

        s3deploy.BucketDeployment(
            self,
            "UiDeployment",
            sources=[
                # A local public/config.json copied in by `vite build` must never ship.
                s3deploy.Source.asset(str(ui_dist), exclude=["config.json"]),
                s3deploy.Source.json_data("config.json", runtime_config),
            ],
            destination_bucket=bucket,
            distribution=distribution,
            distribution_paths=INVALIDATION_PATHS,
        )

        self.distribution = distribution

        CfnOutput(
            self,
            "UiUrl",
            value=f"https://{distribution.distribution_domain_name}",
            description="CloudFront URL of the HR Leave Portal UI",
        )
