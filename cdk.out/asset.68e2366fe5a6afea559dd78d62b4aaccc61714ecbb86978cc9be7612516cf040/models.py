from datetime import date

from pydantic import BaseModel, model_validator


class EmployeeIn(BaseModel):
    name: str
    department: str
    startDate: date
    role: str = "employee"


class LeaveIn(BaseModel):
    startDate: date
    endDate: date
    note: str = ""

    @model_validator(mode="after")
    def check_dates(self):
        if self.endDate < self.startDate:
            raise ValueError("endDate must not be before startDate")
        return self


class LeaveUpdate(BaseModel):
    endDate: date
    note: str = ""