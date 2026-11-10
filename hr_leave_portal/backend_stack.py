from aws_cdk import (
    Acknowledgment,
    CfnOutput,
    Duration,
    RemovalPolicy,
    Stack,
    Validations,
    aws_apigateway as apigw,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_ssm as ssm,
)
from constructs import Construct

# The build script publishes the layer's Version ARN to this SSM parameter.
LAYER_ARN_PARAM = "/hr-leave-portal/fastapi-layer-arn"


class BackendStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        table = dynamodb.Table(
            self,
            "HrTable",
            partition_key=dynamodb.Attribute(
                name="PK", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        table.add_global_secondary_index(
            index_name="GSI1",
            partition_key=dynamodb.Attribute(
                name="GSI1PK", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="GSI1SK", type=dynamodb.AttributeType.STRING
            ),
        )

        # Read the ARN the build script stored, resolved at synth time.
        fastapi_layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, LAYER_ARN_PARAM
        )

        fastapi_layer = lambda_.LayerVersion.from_layer_version_arn(
            self, "FastApiLayer", layer_version_arn=fastapi_layer_arn
        )

        api_function = lambda_.Function(
            self,
            "ApiFunction",
            runtime=lambda_.Runtime.PYTHON_3_14,
            handler="handler.lambda_handler",
            code=lambda_.Code.from_asset("api", exclude=["__pycache__", "*.pyc"]),
            layers=[fastapi_layer],
            timeout=Duration.seconds(10),
            memory_size=512,
            environment={
                "TABLE_NAME": table.table_name,
                "POWERTOOLS_SERVICE_NAME": "hr-api",
                "POWERTOOLS_LOG_LEVEL": "INFO",
            },
            tracing=lambda_.Tracing.ACTIVE,
        )

        # Only the four actions api/services actually call. Deliberately no Scan:
        # every access pattern in this app is a GetItem or a Query, so if a Scan
        # ever appears in the code, we want it to fail loudly here. The index ARN
        # is what lets list_by_hire_date query GSI1.
        api_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "dynamodb:PutItem",
                    "dynamodb:GetItem",
                    "dynamodb:Query",
                    "dynamodb:DeleteItem",
                ],
                resources=[table.table_arn, f"{table.table_arn}/index/*"])
        )

        self.api_function = api_function
        self.table = table


        self.user_pool = cognito.UserPool(
            self,
            "HrUserPool",
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(email=True),
            removal_policy=RemovalPolicy.DESTROY,
        )

        self.user_pool_client = self.user_pool.add_client(
            "HrUserPoolClient",
            auth_flows=cognito.AuthFlow(user_password=True, user_srp=True),
        )

        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self, "HrAuthorizer", cognito_user_pools=[self.user_pool]
        )

        self.api = apigw.LambdaRestApi(
            self,
            "HrApi",
            handler=api_function,
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
            ),
            default_method_options=apigw.MethodOptions(
                authorization_type=apigw.AuthorizationType.COGNITO,
                authorizer=authorizer,
            ),
            # Adds the API Gateway node in front of the Lambda on the X-Ray trace map.
            deploy_options=apigw.StageOptions(tracing_enabled=True),
        )

        # Authorizer rejections (401/403) and gateway errors (5XX) never reach FastAPI's
        # CORS middleware, so add the CORS headers here; otherwise the browser reports
        # them as CORS failures and the UI cannot read the status. Origins stay '*'.
        gateway_cors_headers = {
            "Access-Control-Allow-Origin": "'*'",
            "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
        }
        self.api.add_gateway_response(
            "Default4xxCors",
            type=apigw.ResponseType.DEFAULT_4_XX,
            response_headers=gateway_cors_headers,
        )
        self.api.add_gateway_response(
            "Default5xxCors",
            type=apigw.ResponseType.DEFAULT_5_XX,
            response_headers=gateway_cors_headers,
        )

        CfnOutput(self, "ApiUrl", value=self.api.url)
        CfnOutput(self, "TableName", value=table.table_name)
        CfnOutput(self, "UserPoolId", value=self.user_pool.user_pool_id)
        CfnOutput(
            self, "UserPoolClientId", value=self.user_pool_client.user_pool_client_id
        )

        # cdk-nag findings we've read and decided to accept. Keep them last so they're
        # easy to find, and never add one without a reason.
        Validations.of(self).acknowledge(
            Acknowledgment(
                id="AwsSolutions::AwsSolutions-COG2",
                reason="WORKSHOP ONLY. MFA is not enabled to keep sign-in to one step. A real "
                       "HR system must enable it (Cognito mfa=REQUIRED with TOTP), and would "
                       "be expected to before holding real employee data.",
            ),
            Acknowledgment(
                id="AwsSolutions::AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:"
                   "policy/service-role/AWSLambdaBasicExecutionRole]",
                reason="The API function's only managed policy. It grants just "
                       "logs:CreateLogGroup, logs:CreateLogStream and logs:PutLogEvents, which "
                       "every Lambda needs to write its logs; all data access is in the "
                       "scoped inline policy above. Revisit if a broader managed policy is "
                       "ever attached.",
            ),
        )
