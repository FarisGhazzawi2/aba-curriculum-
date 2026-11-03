from datetime import datetime
from datetime import date

from fastapi import APIRouter, HTTPException

from models import LeaveIn, LeaveUpdate
from services import leave_service

router = APIRouter(tags=["leave"])


@router.post("/employees/{employee_id}/leave", status_code=201)
def create_leave(employee_id: str, payload: LeaveIn):
    body = payload.model_dump(mode="json")
    return leave_service.save(employee_id, body["startDate"], body)


@router.get("/employees/{employee_id}/leave")
def list_leave(employee_id: str, month: str | None = None):
    if month and not _is_valid_month(month):
        raise HTTPException(
            status_code=422,
            detail="Invalid month. Use the format YYYY-MM, for example 2026-10.",
        )

    return {"leave": leave_service.list_for_employee(employee_id, month)}


def _is_valid_month(month: str) -> bool:
    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        return False
    return len(month) == 7


@router.put("/employees/{employee_id}/leave/{start_date}")
def save_leave(employee_id: str, start_date: date, payload: LeaveUpdate):
    return leave_service.save(
        employee_id, start_date.isoformat(), payload.model_dump(mode="json")
    )
