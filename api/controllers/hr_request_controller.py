from fastapi import APIRouter, Depends

from auth import get_caller
from models import HrRequestIn, TimeOffRequestIn
from services import hr_request_service

router = APIRouter(tags=["hr-requests"])

# Who the request is from comes from the token, never from the body.


@router.post("/hr-requests/time-off", status_code=202)
def start_time_off_request(
    payload: TimeOffRequestIn, caller: dict = Depends(get_caller)
):
    body = payload.model_dump(mode="json")
    body["user_id"] = caller["sub"]
    return hr_request_service.start_time_off_request(body)


@router.post("/hr-requests", status_code=202)
def start_hr_request(payload: HrRequestIn, caller: dict = Depends(get_caller)):
    body = payload.model_dump(mode="json")
    body["user_id"] = caller["sub"]
    return hr_request_service.start_hr_request(body)
