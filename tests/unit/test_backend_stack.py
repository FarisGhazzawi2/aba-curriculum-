"""CDK assertion tests for hr_leave_portal/backend_stack.py.

These synthesize the stack in-process and assert on the CloudFormation template,
so they catch a refactor that drops the index, turns off tracing, or detaches the
Cognito authorizer, even though the app would still import and the service tests
would still pass.
"""

from pathlib import Path

import aws_cdk as cdk
import pytest
from aws_cdk.assertions import Match, Template

from hr_leave_portal.backend_stack import LAYER_ARN_PARAM, BackendStack

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def template() -> Template:
    # The function code is Code.from_asset("api"), which resolves against the working
    # directory, so synthesize from the repo root wherever pytest was started.
    with pytest.MonkeyPatch.context() as patch:
        patch.chdir(REPO_ROOT)
        app = cdk.App()
        stack = BackendStack(app, "TestBackendStack")
        return Template.from_stack(stack)


@pytest.fixture(scope="module")
def api_function(template: Template) -> dict:
    functions = template.find_resources(
        "AWS::Lambda::Function", {"Properties": {"Handler": "handler.lambda_handler"}}
    )
    assert len(functions) == 1, "expected exactly one API function"
    return next(iter(functions.values()))


def test_dynamodb_table_has_pk_sk_key_schema_and_hire_date_index(template: Template):
    template.resource_count_is("AWS::DynamoDB::Table", 1)
    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {
            # Arrays match exactly, so this also pins PK as HASH and SK as RANGE.
            "KeySchema": [
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            "BillingMode": "PAY_PER_REQUEST",
            # list_by_hire_date queries GSI1; without it that route fails at runtime.
            "GlobalSecondaryIndexes": [
                Match.object_like(
                    {
                        "IndexName": "GSI1",
                        "KeySchema": [
                            {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                            {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                        ],
                    }
                )
            ],
        },
    )


def test_api_lambda_has_active_tracing(template: Template):
    template.has_resource_properties(
        "AWS::Lambda::Function",
        {"Handler": "handler.lambda_handler", "TracingConfig": {"Mode": "Active"}},
    )


def test_api_lambda_role_can_send_traces_to_xray(template: Template):
    # Tracing.ACTIVE is what grants these; without them traces are silently dropped.
    template.has_resource_properties(
        "AWS::IAM::Policy",
        {
            "PolicyDocument": {
                "Statement": Match.array_with(
                    [
                        Match.object_like(
                            {
                                # IAM doesn't care about order; CDK's may change.
                                "Action": Match.array_with(
                                    ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
                                ),
                                "Effect": "Allow",
                            }
                        )
                    ]
                )
            }
        },
    )


def test_api_lambda_role_has_only_the_four_dynamodb_actions_the_code_uses(template: Template):
    # Least privilege: no Scan, UpdateItem or batch actions, so a Scan added to the
    # code later fails with AccessDenied instead of quietly reading the whole table.
    policies = template.find_resources("AWS::IAM::Policy")
    dynamodb_actions = set()
    for policy in policies.values():
        for statement in policy["Properties"]["PolicyDocument"]["Statement"]:
            actions = statement["Action"]
            actions = [actions] if isinstance(actions, str) else actions
            dynamodb_actions.update(a for a in actions if a.startswith("dynamodb:"))

    assert dynamodb_actions == {
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:DeleteItem",
    }


def test_api_lambda_dynamodb_access_covers_the_table_and_its_indexes(template: Template):
    # Querying GSI1 needs the /index/* ARN as well as the table ARN.
    template.has_resource_properties(
        "AWS::IAM::Policy",
        {
            "PolicyDocument": {
                "Statement": Match.array_with(
                    [
                        Match.object_like(
                            {
                                "Action": Match.array_with(["dynamodb:Query"]),
                                "Resource": [
                                    {"Fn::GetAtt": [Match.any_value(), "Arn"]},
                                    {
                                        "Fn::Join": [
                                            "",
                                            [{"Fn::GetAtt": [Match.any_value(), "Arn"]}, "/index/*"],
                                        ]
                                    },
                                ],
                            }
                        )
                    ]
                )
            }
        },
    )


def test_api_lambda_has_exactly_one_layer_attached(api_function: dict):
    assert len(api_function["Properties"]["Layers"]) == 1


def test_api_lambda_layer_resolves_from_the_fastapi_powertools_ssm_parameter(
    template: Template, api_function: dict
):
    # The template can't show what is inside the layer: its ARN is an SSM lookup
    # resolved at deploy time. What it can prove is where the ARN comes from.
    parameter_name = api_function["Properties"]["Layers"][0]["Ref"]
    parameter = template.to_json()["Parameters"][parameter_name]

    assert parameter["Type"] == "AWS::SSM::Parameter::Value<String>"
    assert parameter["Default"] == LAYER_ARN_PARAM


def test_api_lambda_has_powertools_and_table_environment_variables(template: Template):
    template.has_resource_properties(
        "AWS::Lambda::Function",
        {
            "Handler": "handler.lambda_handler",
            "Environment": {
                "Variables": Match.object_like(
                    {
                        # The table name is a generated Ref, so assert its shape only.
                        "TABLE_NAME": {"Ref": Match.any_value()},
                        "POWERTOOLS_SERVICE_NAME": "hr-api",
                        "POWERTOOLS_LOG_LEVEL": "INFO",
                    }
                )
            },
        },
    )


def test_rest_api_exists_with_a_cognito_user_pools_authorizer(template: Template):
    template.resource_count_is("AWS::ApiGateway::RestApi", 1)
    template.has_resource_properties(
        "AWS::ApiGateway::Authorizer",
        {
            "Type": "COGNITO_USER_POOLS",
            "ProviderARNs": [{"Fn::GetAtt": [Match.any_value(), "Arn"]}],
        },
    )


def test_proxy_methods_inherit_the_cognito_authorizer_by_default(template: Template):
    # default_method_options never appears on the RestApi itself; CDK pushes it down
    # onto each generated method, so count the methods that carry it.
    cognito_methods = template.find_resources(
        "AWS::ApiGateway::Method",
        {
            "Properties": {
                "HttpMethod": "ANY",
                "AuthorizationType": "COGNITO_USER_POOLS",
                "AuthorizerId": {"Ref": Match.any_value()},
            }
        },
    )
    assert len(cognito_methods) == 2  # ANY on / and ANY on /{proxy+}


def test_cors_preflight_options_methods_are_intentionally_unauthenticated(template: Template):
    # Browsers send OPTIONS preflights without the token, so protecting them breaks CORS.
    template.resource_count_is("AWS::ApiGateway::Method", 4)
    open_options = template.find_resources(
        "AWS::ApiGateway::Method",
        {"Properties": {"HttpMethod": "OPTIONS", "AuthorizationType": "NONE"}},
    )
    assert len(open_options) == 2


def test_api_gateway_stage_has_xray_tracing_enabled(template: Template):
    # Puts API Gateway in front of the Lambda on the X-Ray trace map.
    template.has_resource_properties(
        "AWS::ApiGateway::Stage", {"StageName": "prod", "TracingEnabled": True}
    )
