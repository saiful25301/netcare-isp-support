from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.db.session import get_db
from app.models.area_package import ServiceArea, InternetPackage
from app.models.ticket import TicketCategory
from app.models.user import UserRole
from app.schemas.area_package import (
    ServiceAreaCreate,
    ServiceAreaResponse,
    ServiceAreaUpdate,
    InternetPackageCreate,
    InternetPackageResponse,
    InternetPackageUpdate
)

router = APIRouter()


# ----------------- Service Areas -----------------

@router.get("/areas", response_model=List[ServiceAreaResponse])
def list_service_areas(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Retrieve service coverage areas."""
    query = db.query(ServiceArea)
    if is_active is not None:
        query = query.filter(ServiceArea.is_active == is_active)
    return query.order_by(ServiceArea.name.asc()).all()


@router.post("/areas", response_model=ServiceAreaResponse, status_code=status.HTTP_201_CREATED)
def create_service_area(
    payload: ServiceAreaCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN.value))
):
    """Add a new ISP service coverage area (Admin only)."""
    existing = db.query(ServiceArea).filter(
        (ServiceArea.code == payload.code.strip().upper()) |
        (ServiceArea.name == payload.name.strip())
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A service area with this name or code already exists."
        )

    area = ServiceArea(
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        city=payload.city.strip(),
        coverage_details=payload.coverage_details,
        is_active=payload.is_active
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.put("/areas/{area_id}", response_model=ServiceAreaResponse)
def update_service_area(
    area_id: int,
    payload: ServiceAreaUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN.value))
):
    """Update service coverage area details (Admin only)."""
    area = db.query(ServiceArea).filter(ServiceArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service area not found.")

    if payload.name is not None:
        area.name = payload.name.strip()
    if payload.code is not None:
        area.code = payload.code.strip().upper()
    if payload.city is not None:
        area.city = payload.city.strip()
    if payload.coverage_details is not None:
        area.coverage_details = payload.coverage_details
    if payload.is_active is not None:
        area.is_active = payload.is_active

    db.commit()
    db.refresh(area)
    return area


# ----------------- Internet Packages -----------------

@router.get("/packages", response_model=List[InternetPackageResponse])
def list_internet_packages(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Retrieve ISP bandwidth packages."""
    query = db.query(InternetPackage)
    if is_active is not None:
        query = query.filter(InternetPackage.is_active == is_active)
    return query.order_by(InternetPackage.speed_mbps.asc()).all()


@router.post("/packages", response_model=InternetPackageResponse, status_code=status.HTTP_201_CREATED)
def create_internet_package(
    payload: InternetPackageCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN.value))
):
    """Create a new internet bandwidth package (Admin only)."""
    existing = db.query(InternetPackage).filter(InternetPackage.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A package with this name already exists."
        )

    pkg = InternetPackage(
        name=payload.name.strip(),
        speed_mbps=payload.speed_mbps,
        monthly_fee=payload.monthly_fee,
        connection_type=payload.connection_type.strip(),
        is_active=payload.is_active
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return pkg


@router.put("/packages/{pkg_id}", response_model=InternetPackageResponse)
def update_internet_package(
    pkg_id: int,
    payload: InternetPackageUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN.value))
):
    """Update internet package details (Admin only)."""
    pkg = db.query(InternetPackage).filter(InternetPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Internet package not found.")

    if payload.name is not None:
        pkg.name = payload.name.strip()
    if payload.speed_mbps is not None:
        pkg.speed_mbps = payload.speed_mbps
    if payload.monthly_fee is not None:
        pkg.monthly_fee = payload.monthly_fee
    if payload.connection_type is not None:
        pkg.connection_type = payload.connection_type.strip()
    if payload.is_active is not None:
        pkg.is_active = payload.is_active

    db.commit()
    db.refresh(pkg)
    return pkg


# ----------------- Complaint Categories -----------------

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Retrieve complaint categories and default priority SLAs."""
    categories = db.query(TicketCategory).filter(TicketCategory.is_active == True).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "default_priority": c.default_priority,
            "sla_target_hours": c.sla_target_hours
        }
        for c in categories
    ]
