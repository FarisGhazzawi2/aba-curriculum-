from datetime import date

from fastapi import APIRouter, Depends, Query

from auth import authorized_employee, get_caller
from models import LeaveIn, LeaveUpdate
from services import leave_service

router = APIRouter(tags=["leave"])

# Leave lives under an employee, so every route here makes the same decision as
# the employee routes: may this caller act on this employee?


@router.post("/employees/{employee_id}/leave", status_code=201)
def create_leave(
    employee_id: str, payload: LeaveIn, caller: dict = Depends(get_caller)
):
    authorized_employee(caller, employee_id)
    body = payload.model_dump(mode="json")
    return leave_service.save(employee_id, body["startDate"], body)


@router.get("/employees/{employee_id}/leave")
def list_leave(
    employee_id: str,
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    caller: dict = Depends(get_caller),
):
    authorized_employee(caller, employee_id)
    return {"leave": leave_service.list_for_employee(employee_id, month)}


@router.put("/employees/{employee_id}/leave/{start_date}")
def save_leave(
    employee_id: str,
    start_date: date,
    payload: LeaveUpdate,
    caller: dict = Depends(get_caller),
):
    authorized_employee(caller, employee_id)
    return leave_service.save(
        employee_id, start_date.isoformat(), payload.model_dump(mode="json")
    )
