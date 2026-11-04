import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    email: EmailStr
    phone_number: str
    full_name: str
    role: str
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerRegistrationRequest(BaseModel):
    email: EmailStr
    phone_number: str
    password: str
    full_name: str
    service_area_id: int
    package_id: int
    installation_address: str
    ip_address: Optional[str] = None
    onu_mac_address: Optional[str] = None
