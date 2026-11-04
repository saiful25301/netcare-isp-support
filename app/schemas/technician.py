import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class TechnicianCreate(BaseModel):
    email: EmailStr
    phone_number: str
    password: str
    full_name: str
    primary_area_id: int
    specialization: Optional[str] = "Fiber Line & Network Configuration"


class TechnicianUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    primary_area_id: Optional[int] = None
    specialization: Optional[str] = None
    current_status: Optional[str] = None
    is_active: Optional[bool] = None


class TechnicianResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    employee_code: str
    email: str
    phone_number: str
    full_name: str
    primary_area_id: int
    primary_area_name: Optional[str] = None
    primary_area_code: Optional[str] = None
    specialization: str
    current_status: str
    rating_cache: float
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
