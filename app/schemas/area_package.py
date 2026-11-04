from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ServiceAreaBase(BaseModel):
    name: str
    code: str
    city: str = "Dhaka"
    coverage_details: Optional[str] = None
    is_active: bool = True


class ServiceAreaCreate(ServiceAreaBase):
    pass


class ServiceAreaUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    city: Optional[str] = None
    coverage_details: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceAreaResponse(ServiceAreaBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InternetPackageBase(BaseModel):
    name: str
    speed_mbps: int
    monthly_fee: float
    connection_type: str = "Fiber"
    is_active: bool = True


class InternetPackageCreate(InternetPackageBase):
    pass


class InternetPackageUpdate(BaseModel):
    name: Optional[str] = None
    speed_mbps: Optional[int] = None
    monthly_fee: Optional[float] = None
    connection_type: Optional[str] = None
    is_active: Optional[bool] = None


class InternetPackageResponse(InternetPackageBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
