import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class CustomerCreateByAdmin(BaseModel):
    email: EmailStr
    phone_number: str
    password: str
    full_name: str
    service_area_id: int
    package_id: int
    installation_address: str
    ip_address: Optional[str] = None
    onu_mac_address: Optional[str] = None
    status: str = "ACTIVE"


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    service_area_id: Optional[int] = None
    package_id: Optional[int] = None
    installation_address: Optional[str] = None
    ip_address: Optional[str] = None
    onu_mac_address: Optional[str] = None
    status: Optional[str] = None


class CustomerResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    customer_code: str
    email: str
    phone_number: str
    full_name: str
    service_area_id: int
    service_area_name: Optional[str] = None
    service_area_code: Optional[str] = None
    package_id: int
    package_name: Optional[str] = None
    speed_mbps: Optional[int] = None
    monthly_fee: Optional[float] = None
    installation_address: str
    ip_address: Optional[str] = None
    onu_mac_address: Optional[str] = None
    status: str
    connection_date: datetime

    model_config = ConfigDict(from_attributes=True)
