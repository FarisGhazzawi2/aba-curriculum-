from datetime import date

from pydantic import BaseModel


class EmployeeIn(BaseModel):
    name: str
    department: str
    startDate: date
    role: str = "employee"


class LeaveIn(BaseModel):
    startDate: date
    endDate: date
    note: str = ""


class LeaveUpdate(BaseModel):
    endDate: date
    note: str = ""


# No user_id on the HR request models: who the request is from comes from the
# caller's token. A user_id a client still sends is ignored.
class TimeOffRequestIn(BaseModel):
    start_date: date
    end_date: date


class HrRequestIn(BaseModel):
    prompt: str
