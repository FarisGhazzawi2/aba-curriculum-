from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from models import EmployeeIn
from services import employee_service
from auth import authorized_employee, get_caller, is_admin

router = APIRouter(tags=["employees"])


@router.post("/employees", status_code=201)
def create_employee(payload: EmployeeIn):
    return employee_service.create(payload.model_dump(mode="json"))


@router.get("/employees")
def list_employees(
    hiredFrom: date | None = None,
    hiredTo: date | None = None,
    caller: dict = Depends(get_caller),
):
    if hiredFrom and hiredTo:
        employees = employee_service.list_by_hire_date(
            hiredFrom.isoformat(), hiredTo.isoformat()
        )
    else:
        employees = employee_service.list_all()

    # Authorize after either branch, so the hire-date filter can't walk past it:
    # admins see everyone, anyone else sees only their own record.
    if not is_admin(caller):
        employees = [e for e in employees if e.get("cognitoSub") == caller["sub"]]

    return {"employees": employees}


@router.get("/employees/{employee_id}")
def get_employee(employee_id: str, caller: dict = Depends(get_caller)):
    return authorized_employee(caller, employee_id)


@router.put("/employees/{employee_id}")
def save_employee(
    employee_id: str, payload: EmployeeIn, caller: dict = Depends(get_caller)
):
    existing = employee_service.get(employee_id)

    # PUT on a new id creates a record, which only an admin may do.
    if existing is None:
        if not is_admin(caller):
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee_service.save(employee_id, payload.model_dump(mode="json"))

    authorized_employee(caller, employee_id)

    # Keep the login link; the request body can never set or change it.
    return employee_service.save(
        employee_id,
        payload.model_dump(mode="json"),
        cognito_sub=existing.get("cognitoSub"),
    )


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: str, caller: dict = Depends(get_caller)):
    # You can't authorize against a record you haven't read, so fetch first.
    authorized_employee(caller, employee_id)

    employee_service.delete(employee_id)
    return {"deleted": employee_id}
