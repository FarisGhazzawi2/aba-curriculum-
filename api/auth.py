from fastapi import HTTPException, Request

from services import employee_service

# The Cognito group that may touch everybody's records.
ADMIN_GROUP = "admins"


def get_caller(request: Request) -> dict:
    """Return the signed-in user's identity, as verified by API Gateway."""
    event = request.scope.get("aws.event")

    # Running locally under uvicorn there is no API Gateway and no authorizer,
    # so there are no claims to read. Treat local requests as an admin so the
    # local loop keeps working.
    if event is None:
        return {"sub": "local-dev", "groups": [ADMIN_GROUP]}

    claims = event["requestContext"]["authorizer"]["claims"]

    # API Gateway flattens cognito:groups into a string like "[admins,hr]".
    raw_groups = claims.get("cognito:groups", "")
    groups = [g.strip() for g in raw_groups.strip("[]").split(",") if g.strip()]

    return {"sub": claims["sub"], "groups": groups}


def is_admin(caller: dict) -> bool:
    return ADMIN_GROUP in caller["groups"]


def require_owner_or_admin(caller: dict, employee: dict) -> None:
    """Allow admins, or the one employee whose record this is."""
    if is_admin(caller):
        return
    if employee.get("cognitoSub") == caller["sub"]:
        return

    # 404 rather than 403: a 403 would confirm the record exists.
    raise HTTPException(status_code=404, detail="Employee not found")


def authorized_employee(caller: dict, employee_id: str) -> dict:
    """Fetch, then check: the employee record, if the caller may act on it.

    Every route under /employees/{employee_id} (the record itself and its leave)
    makes the same decision, so they all go through here.
    """
    employee = employee_service.get(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    require_owner_or_admin(caller, employee)
    return employee
