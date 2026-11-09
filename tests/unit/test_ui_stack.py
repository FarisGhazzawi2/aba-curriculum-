"""CDK assertion tests for the UI hosting stack (FR7.1-FR7.7, NFR1, NFR2)."""

from pathlib import Path

import aws_cdk as cdk
import pytest
from aws_cdk import aws_apigateway as apigw
from aws_cdk import aws_cognito as cognito
from aws_cdk.assertions import Match, Template

from hr_leave_portal.ui_stack import UiStack

AGENT_RUNTIME_ARN = "arn:aws:bedrock-agentcore:us-east-1:111111111111:runtime/hrAgent-TEST"


@pytest.fixture
def ui_dist(tmp_path: Path) -> Path:
    """A stand-in Vite build output."""
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>HR Leave Portal</title>", encoding="utf-8")
    (dist / "assets" / "index.js").write_text("console.log('ui')", encoding="utf-8")
    return dist


def _dependencies(app: cdk.App) -> tuple[apigw.RestApi, cognito.UserPool, cognito.UserPoolClient]:
    """In-test stand-ins for the backend stack's API and Cognito resources."""
    deps = cdk.Stack(app, "TestDeps")
    api = apigw.RestApi(deps, "TestApi")
    api.root.add_method("GET", apigw.MockIntegration())
    user_pool = cognito.UserPool(deps, "TestPool")
    client = user_pool.add_client("TestClient")
    return api, user_pool, client


def _synth(ui_dist_path: Path) -> Template:
    app = cdk.App()
    api, user_pool, client = _dependencies(app)
    stack = UiStack(
        app,
        "TestUi",
        api=api,
        user_pool=user_pool,
        user_pool_client=client,
        agent_runtime_arn=AGENT_RUNTIME_ARN,
        ui_dist_path=ui_dist_path,
    )
    return Template.from_stack(stack)


@pytest.fixture
def template(ui_dist: Path) -> Template:
    return _synth(ui_dist)


def test_bucket_blocks_all_public_access_and_requires_tls(template: Template) -> None:
    template.has_resource_properties(
        "AWS::S3::Bucket",
        {
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "BlockPublicPolicy": True,
                "IgnorePublicAcls": True,
                "RestrictPublicBuckets": True,
            },
            "BucketEncryption": Match.object_like(
                {
                    "ServerSideEncryptionConfiguration": [
                        {"ServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}
                    ]
                }
            ),
        },
    )
    template.has_resource_properties(
        "AWS::S3::BucketPolicy",
        {
            "PolicyDocument": Match.object_like(
                {
                    "Statement": Match.array_with(
                        [
                            Match.object_like(
                                {
                                    "Effect": "Deny",
                                    "Condition": {"Bool": {"aws:SecureTransport": "false"}},
                                }
                            )
                        ]
                    )
                }
            )
        },
    )


def test_cloudfront_reads_the_bucket_through_oac_only(template: Template) -> None:
    template.has_resource_properties(
        "AWS::CloudFront::OriginAccessControl",
        {
            "OriginAccessControlConfig": Match.object_like(
                {"OriginAccessControlOriginType": "s3", "SigningBehavior": "always"}
            )
        },
    )
    template.has_resource_properties(
        "AWS::CloudFront::Distribution",
        {
            "DistributionConfig": Match.object_like(
                {
                    "Origins": [
                        Match.object_like(
                            {
                                "OriginAccessControlId": Match.any_value(),
                                "S3OriginConfig": {"OriginAccessIdentity": ""},
                            }
                        )
                    ]
                }
            )
        },
    )
    template.has_resource_properties(
        "AWS::S3::BucketPolicy",
        {
            "PolicyDocument": Match.object_like(
                {
                    "Statement": Match.array_with(
                        [
                            Match.object_like(
                                {
                                    "Effect": "Allow",
                                    "Action": "s3:GetObject",
                                    "Principal": {"Service": "cloudfront.amazonaws.com"},
                                    "Condition": Match.object_like(
                                        {"StringEquals": {"AWS:SourceArn": Match.any_value()}}
                                    ),
                                }
                            )
                        ]
                    )
                }
            )
        },
    )


def test_cloudfront_redirects_http_to_https(template: Template) -> None:
    template.has_resource_properties(
        "AWS::CloudFront::Distribution",
        {
            "DistributionConfig": Match.object_like(
                {
                    "DefaultRootObject": "index.html",
                    "DefaultCacheBehavior": Match.object_like({"ViewerProtocolPolicy": "redirect-to-https"}),
                }
            )
        },
    )


def test_403_and_404_fall_back_to_index_html(template: Template) -> None:
    fallbacks = [
        {"ErrorCode": code, "ResponseCode": 200, "ResponsePagePath": "/index.html", "ErrorCachingMinTTL": 0}
        for code in (403, 404)
    ]
    template.has_resource_properties(
        "AWS::CloudFront::Distribution",
        {"DistributionConfig": Match.object_like({"CustomErrorResponses": fallbacks})},
    )


def test_deployment_ships_build_and_config_and_invalidates(template: Template) -> None:
    template.resource_count_is("Custom::CDKBucketDeployment", 1)
    template.has_resource_properties(
        "Custom::CDKBucketDeployment",
        {
            "DistributionId": Match.any_value(),
            "DistributionPaths": ["/index.html", "/config.json"],
            # One source for ui/dist, one for the generated config.json.
            "SourceObjectKeys": Match.any_value(),
        },
    )
    deployment = next(iter(template.find_resources("Custom::CDKBucketDeployment").values()))
    assert len(deployment["Properties"]["SourceObjectKeys"]) == 2


def test_config_json_holds_only_public_identifiers(template: Template) -> None:
    deployment = next(iter(template.find_resources("Custom::CDKBucketDeployment").values()))
    markers = deployment["Properties"]["SourceMarkers"][1]
    rendered = str(markers)
    # api url, region, pool id, client id and the literal runtime ARN are all deploy-time values.
    assert len(markers) == 4
    assert "TestApi" in rendered
    assert "TestPool" in rendered
    assert "TestClient" in rendered
    assert "secret" not in rendered.lower()


def test_outputs_the_ui_url(template: Template) -> None:
    template.has_output(
        "UiUrl",
        {
            "Value": {
                "Fn::Join": ["", ["https://", {"Fn::GetAtt": [Match.string_like_regexp("UiDistribution"), "DomainName"]}]]
            }
        },
    )


def test_synth_fails_with_instructions_when_ui_is_not_built(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="npm run build"):
        _synth(tmp_path / "missing-dist")
