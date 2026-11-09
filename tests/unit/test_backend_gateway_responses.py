"""CDK assertion tests for the API Gateway CORS Gateway Responses (FR6.1)."""

from pathlib import Path

import aws_cdk as cdk
import pytest
from aws_cdk.assertions import Template

from hr_leave_portal.backend_stack import BackendStack

PROJECT_ROOT = Path(__file__).resolve().parents[2]

CORS_PARAMETERS = {
    "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
    "gatewayresponse.header.Access-Control-Allow-Headers": "'Content-Type,Authorization'",
}


@pytest.fixture(scope="module")
def template() -> Template:
    # The Lambda asset path "api" is relative to the project root. The SSM layer ARN
    # becomes a CloudFormation parameter at synth time, so no AWS call is made.
    with pytest.MonkeyPatch.context() as patch:
        patch.chdir(PROJECT_ROOT)
        app = cdk.App()
        stack = BackendStack(app, "TestBackend")
        return Template.from_stack(stack)


@pytest.mark.parametrize("response_type", ["DEFAULT_4XX", "DEFAULT_5XX"])
def test_gateway_response_carries_cors_headers(template: Template, response_type: str) -> None:
    template.has_resource_properties(
        "AWS::ApiGateway::GatewayResponse",
        {"ResponseType": response_type, "ResponseParameters": CORS_PARAMETERS},
    )


def test_only_the_two_default_gateway_responses_are_added(template: Template) -> None:
    template.resource_count_is("AWS::ApiGateway::GatewayResponse", 2)


def test_api_methods_still_use_the_cognito_authorizer(template: Template) -> None:
    methods = template.find_resources("AWS::ApiGateway::Method", {"Properties": {"HttpMethod": "ANY"}})
    assert methods, "expected the proxy ANY methods"
    assert all(m["Properties"]["AuthorizationType"] == "COGNITO_USER_POOLS" for m in methods.values())
