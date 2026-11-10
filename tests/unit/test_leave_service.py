"""Unit tests for api/services/leave_service.py against a moto-mocked DynamoDB table.

Same setup as test_employee_service.py: the service reads TABLE_NAME and builds
its Table at import time, so the table is created before the module is imported.
"""

import importlib
import sys

import boto3
import pytest
from boto3.dynamodb.conditions import Key
from moto import mock_aws

TABLE_NAME = "test-hr-table"
REGION = "us-east-1"
MODULE = "api.services.leave_service"
EMPLOYEE_ID = "abc12345"


@pytest.fixture
def leave_service(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", REGION)
    monkeypatch.setenv("TABLE_NAME", TABLE_NAME)

    with mock_aws():
        # Leave items only use the table's PK/SK, the same key schema as backend_stack.py.
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
            ],
        )

        sys.modules.pop(MODULE, None)
        module = importlib.import_module(MODULE)
        yield module
        sys.modules.pop(MODULE, None)


@pytest.fixture
def table(leave_service):
    # Depends on leave_service only to run inside its live mock_aws context.
    return boto3.resource("dynamodb", region_name=REGION).Table(TABLE_NAME)


def items_for(table, employee_id: str) -> list[dict]:
    """All of an employee's leave lives under one PK, so one Query returns it all."""
    return table.query(KeyConditionExpression=Key("PK").eq(employee_id))["Items"]


def test_save_writes_leave_item_keyed_by_employee_and_start_date(leave_service, table):
    # Arrange
    data = {"endDate": "2026-07-10", "note": "Summer trip"}

    # Act
    leave_service.save(EMPLOYEE_ID, "2026-07-06", data)

    # Assert
    stored = table.get_item(Key={"PK": EMPLOYEE_ID, "SK": "2026-07-06"})["Item"]
    assert stored == {
        "PK": EMPLOYEE_ID,
        "SK": "2026-07-06",
        "employeeId": EMPLOYEE_ID,
        "startDate": "2026-07-06",
        "endDate": "2026-07-10",
        "note": "Summer trip",
    }


def test_save_defaults_note_to_empty_string_when_note_omitted(leave_service, table):
    # Act
    result = leave_service.save(EMPLOYEE_ID, "2026-07-06", {"endDate": "2026-07-10"})

    # Assert
    assert result["note"] == ""
    stored = table.get_item(Key={"PK": EMPLOYEE_ID, "SK": "2026-07-06"})["Item"]
    assert stored["note"] == ""


def test_save_twice_with_same_keys_overwrites_instead_of_duplicating(leave_service, table):
    # Arrange
    start_date = "2026-09-15"

    # Act
    leave_service.save(EMPLOYEE_ID, start_date, {"endDate": "2026-09-18", "note": "v1"})
    leave_service.save(EMPLOYEE_ID, start_date, {"endDate": "2026-09-25", "note": "v2"})

    # Assert
    stored = items_for(table, EMPLOYEE_ID)
    assert len(stored) == 1
    assert stored[0]["note"] == "v2"
    assert stored[0]["endDate"] == "2026-09-25"


def test_list_for_employee_without_month_returns_all_leave_sorted_by_start_date(leave_service):
    # Arrange: written out of order, so the order can only come from the sort key.
    leave_service.save(EMPLOYEE_ID, "2026-09-01", {"endDate": "2026-09-05"})
    leave_service.save(EMPLOYEE_ID, "2026-07-06", {"endDate": "2026-07-10"})
    leave_service.save(EMPLOYEE_ID, "2026-08-03", {"endDate": "2026-08-07"})
    leave_service.save("otheremp", "2026-07-01", {"endDate": "2026-07-02"})

    # Act
    result = leave_service.list_for_employee(EMPLOYEE_ID, None)

    # Assert
    assert [item["startDate"] for item in result] == [
        "2026-07-06",
        "2026-08-03",
        "2026-09-01",
    ]


def test_list_for_employee_with_month_returns_only_that_months_leave(leave_service):
    # Arrange: two July items and one August item, so the filter has something to exclude.
    leave_service.save(EMPLOYEE_ID, "2026-07-20", {"endDate": "2026-07-22"})
    leave_service.save(EMPLOYEE_ID, "2026-08-03", {"endDate": "2026-08-07"})
    leave_service.save(EMPLOYEE_ID, "2026-07-06", {"endDate": "2026-07-10"})

    # Act
    result = leave_service.list_for_employee(EMPLOYEE_ID, "2026-07")

    # Assert
    assert [item["startDate"] for item in result] == ["2026-07-06", "2026-07-20"]


def test_list_for_employee_returns_empty_list_when_employee_has_no_leave(leave_service):
    # Arrange: leave exists, but for someone else.
    leave_service.save("otheremp", "2026-07-06", {"endDate": "2026-07-10"})

    # Act
    result = leave_service.list_for_employee(EMPLOYEE_ID, None)

    # Assert
    assert result == []
