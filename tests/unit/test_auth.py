"""Authorization tests: the whole FastAPI app against a moto-mocked table, called the
way API Gateway calls it, with the caller's Cognito claims in the request scope.

Covers the BOLA fix (DELETE gated on ownership) and the exercise (every route under
/employees/{id}, the directory listing, and the HR-request user_id).
"""

import importlib
import sys
from pathlib import Path
from unittest.mock import patch

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

API_DIR = Path(__file__).resolve().parents[2] / "api"
TABLE_NAME = "test-hr-table"
REGION = "us-east-1"

ME = "11111111-aaaa-bbbb-cccc-000000000001"
SOMEONE_ELSE = "22222222-aaaa-bbbb-cccc-000000000002"

# Lambda puts api/ on the path, so the app imports these as top-level modules.
APP_MODULES = ("handler", "auth", "models", "controllers", "services")


def purge_app_modules() -> None:
    for name in list(sys.modules):
        if name.split(".")[0] in APP_MODULES:
            del sys.modules[name]


@pytest.fixture
def app_modules(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", REGION)
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)
    monkeypatch.setenv(
        "HR_STATE_MACHINE_ARN", "arn:aws:states:us-east-1:123456789012:stateMachine:hr"
    )
    monkeypatch.syspath_prepend(str(API_DIR))

    with mock_aws():
        boto3.resource("dynamodb", region_name=REGION).create_table(
            TableName=TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "GSI1PK", "AttributeType": "S"},
                {"AttributeName": "GSI1SK", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        )

        # Import after the table exists, so the services bind to this test's mock.
        purge_app_modules()
        handler = importlib.import_module("handler")
        yield {
            "app": handler.app,
            "employee_service": importlib.import_module("services.employee_service"),
            "hr_request_service": importlib.import_module("services.hr_request_service"),
        }
        purge_app_modules()


def client_as(app, sub: str, groups: str = "") -> TestClient:
    """A client whose requests carry the claims API Gateway's Cognito authorizer adds."""
    claims = {"sub": sub}
    if groups:
        claims["cognito:groups"] = groups

    async def with_claims(scope, receive, send):
        scope = dict(scope)
        scope["aws.event"] = {"requestContext": {"authorizer": {"claims": claims}}}
        await app(scope, receive, send)

    return TestClient(with_claims)


@pytest.fixture
def records(app_modules):
    """Mine is linked to ME; theirs to someone else; unlinked has no login at all."""
    service = app_modules["employee_service"]
    data = {"department": "Engineering", "startDate": "2024-03-01"}
    service.save("mine0001", {**data, "name": "Me"}, cognito_sub=ME)
    service.save("their001", {**data, "name": "Them"}, cognito_sub=SOMEONE_ELSE)
    service.save("unlinked", {**data, "name": "Nobody", "startDate": "2025-01-15"})
    return app_modules


# --- DELETE: the route the page fixes ---------------------------------------------


def test_employee_cannot_delete_someone_elses_record(records):
    response = client_as(records["app"], ME).delete("/employees/their001")

    assert response.status_code == 404
    assert records["employee_service"].get("their001") is not None  # still there


def test_employee_can_delete_their_own_record(records):
    response = client_as(records["app"], ME).delete("/employees/mine0001")

    assert response.status_code == 200
    assert records["employee_service"].get("mine0001") is None


def test_admin_can_delete_anyones_record(records):
    response = client_as(records["app"], ME, groups="[admins]").delete("/employees/their001")

    assert response.status_code == 200
    assert records["employee_service"].get("their001") is None


def test_groups_claim_string_with_several_groups_still_grants_admin(records):
    # API Gateway sends cognito:groups as "[hr,admins]", not a list.
    response = client_as(records["app"], ME, groups="[hr,admins]").delete("/employees/unlinked")

    assert response.status_code == 200


def test_deleting_a_missing_record_is_404(records):
    response = client_as(records["app"], ME, groups="[admins]").delete("/employees/nope0000")

    assert response.status_code == 404


# --- The exercise: the other routes ------------------------------------------------


def test_employee_cannot_read_someone_elses_record(records):
    assert client_as(records["app"], ME).get("/employees/their001").status_code == 404
    assert client_as(records["app"], ME).get("/employees/mine0001").status_code == 200


def test_employee_cannot_overwrite_someone_elses_record(records):
    body = {"name": "Hacked", "department": "X", "startDate": "2024-01-01"}

    response = client_as(records["app"], ME).put("/employees/their001", json=body)

    assert response.status_code == 404
    assert records["employee_service"].get("their001")["name"] == "Them"


def test_employee_cannot_create_records_via_put(records):
    body = {"name": "New", "department": "X", "startDate": "2024-01-01"}

    response = client_as(records["app"], ME).put("/employees/brandnew", json=body)

    assert response.status_code == 404
    assert records["employee_service"].get("brandnew") is None


def test_editing_your_own_record_keeps_the_login_link(records):
    body = {"name": "Me, renamed", "department": "Sales", "startDate": "2024-03-01"}

    response = client_as(records["app"], ME).put("/employees/mine0001", json=body)

    assert response.status_code == 200
    stored = records["employee_service"].get("mine0001")
    assert stored["name"] == "Me, renamed"
    assert stored["cognitoSub"] == ME


def test_directory_shows_an_employee_only_their_own_record(records):
    response = client_as(records["app"], ME).get("/employees")

    assert [e["employeeId"] for e in response.json()["employees"]] == ["mine0001"]


def test_hire_date_filter_cannot_bypass_the_directory_check(records):
    # The filter takes a different query path; it must be authorized all the same.
    response = client_as(records["app"], ME).get(
        "/employees", params={"hiredFrom": "2020-01-01", "hiredTo": "2030-01-01"}
    )

    assert [e["employeeId"] for e in response.json()["employees"]] == ["mine0001"]


def test_admin_directory_shows_everyone(records):
    response = client_as(records["app"], ME, groups="[admins]").get("/employees")

    ids = sorted(e["employeeId"] for e in response.json()["employees"])
    assert ids == ["mine0001", "their001", "unlinked"]


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("get", "/employees/their001/leave", None),
        ("post", "/employees/their001/leave", {"startDate": "2026-07-06", "endDate": "2026-07-10"}),
        ("put", "/employees/their001/leave/2026-07-06", {"endDate": "2026-07-12"}),
    ],
)
def test_employee_cannot_touch_someone_elses_leave(records, method, path, body):
    client = client_as(records["app"], ME)

    response = client.request(method, path, json=body)

    assert response.status_code == 404


def test_employee_can_file_and_read_their_own_leave(records):
    client = client_as(records["app"], ME)

    created = client.post(
        "/employees/mine0001/leave", json={"startDate": "2026-07-06", "endDate": "2026-07-10"}
    )
    listed = client.get("/employees/mine0001/leave")

    assert created.status_code == 201
    assert [item["startDate"] for item in listed.json()["leave"]] == ["2026-07-06"]


def test_hr_request_is_filed_as_the_caller_not_the_body_user_id(records):
    client = client_as(records["app"], ME)
    with patch.object(
        records["hr_request_service"].stepfunctions,
        "start_execution",
        return_value={"executionArn": "arn:aws:states:us-east-1:123456789012:execution:hr:1"},
    ) as start:
        response = client.post(
            "/hr-requests/time-off",
            json={"user_id": SOMEONE_ELSE, "start_date": "2026-07-06", "end_date": "2026-07-10"},
        )

    assert response.status_code == 202
    sent = start.call_args.kwargs["input"]
    assert ME in sent
    assert SOMEONE_ELSE not in sent
