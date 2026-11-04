import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.dependencies import require_roles, get_current_user
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.models.area_package import ServiceArea, InternetPackage
from app.models.ticket import SupportTicket
from app.schemas.customer import CustomerCreateByAdmin, CustomerResponse, CustomerUpdate

router = APIRouter()


def _format_customer_response(cust: Customer) -> CustomerResponse:
    return CustomerResponse(
        id=cust.id,
        user_id=cust.user_id,
        customer_code=cust.customer_code,
        email=cust.user.email,
        phone_number=cust.user.phone_number,
        full_name=cust.user.full_name,
        service_area_id=cust.service_area_id,
        service_area_name=cust.service_area.name if cust.service_area else None,
        service_area_code=cust.service_area.code if cust.service_area else None,
        package_id=cust.package_id,
        package_name=cust.package.name if cust.package else None,
        speed_mbps=cust.package.speed_mbps if cust.package else None,
        monthly_fee=cust.package.monthly_fee if cust.package else None,
        installation_address=cust.installation_address,
        ip_address=cust.ip_address,
        onu_mac_address=cust.onu_mac_address,
        status=cust.status,
        connection_date=cust.connection_date
    )


@router.get("", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = None,
    service_area_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _staff=Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """List ISP customers with optional search and area filters (Admin/Agent)."""
    query = db.query(Customer).join(User, Customer.user_id == User.id)

    if search:
        search_token = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.customer_code.ilike(search_token),
                User.full_name.ilike(search_token),
                User.email.ilike(search_token),
                User.phone_number.ilike(search_token),
                Customer.installation_address.ilike(search_token)
            )
        )

    if service_area_id:
        query = query.filter(Customer.service_area_id == service_area_id)

    if status_filter:
        query = query.filter(Customer.status == status_filter.upper())

    customers = query.order_by(Customer.connection_date.desc()).offset(skip).limit(limit).all()
    return [_format_customer_response(c) for c in customers]


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreateByAdmin,
    db: Session = Depends(get_db),
    _staff=Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """Create a new customer profile and account (Admin/Agent)."""
    existing_user = db.query(User).filter(
        or_(
            User.email == payload.email.strip().lower(),
            User.phone_number == payload.phone_number.strip()
        )
    ).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or phone already in use.")

    area = db.query(ServiceArea).filter(ServiceArea.id == payload.service_area_id).first()
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service area not found.")

    pkg = db.query(InternetPackage).filter(InternetPackage.id == payload.package_id).first()
    if not pkg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Internet package not found.")

    count = db.query(Customer).count()
    customer_code = f"NC-CUST-{1001 + count}"

    new_user = User(
        email=payload.email.strip().lower(),
        phone_number=payload.phone_number.strip(),
        full_name=payload.full_name.strip(),
        role=UserRole.CUSTOMER.value,
        hashed_password=get_password_hash(payload.password),
        is_active=True
    )
    db.add(new_user)
    db.flush()

    new_customer = Customer(
        user_id=new_user.id,
        customer_code=customer_code,
        service_area_id=area.id,
        package_id=pkg.id,
        installation_address=payload.installation_address.strip(),
        ip_address=payload.ip_address.strip() if payload.ip_address else None,
        onu_mac_address=payload.onu_mac_address.strip() if payload.onu_mac_address else None,
        status=payload.status.upper()
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)

    return _format_customer_response(new_customer)


@router.get("/{customer_id}")
def get_customer_detail(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full customer profile and complaint history."""
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    # Guard: customer can only view own profile
    if current_user.role == UserRole.CUSTOMER.value and cust.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    tickets = db.query(SupportTicket).filter(SupportTicket.customer_id == cust.id).order_by(SupportTicket.created_at.desc()).all()

    formatted_tickets = [
        {
            "id": str(t.id),
            "ticket_id": t.ticket_id,
            "category": t.category.name if t.category else None,
            "priority": t.priority,
            "status": t.status,
            "problem_title": t.problem_title,
            "created_at": t.created_at.isoformat(),
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None
        }
        for t in tickets
    ]

    response = _format_customer_response(cust).model_dump()
    response["complaint_history"] = formatted_tickets
    return response


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    _staff=Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """Update customer subscription, address, or network binding details."""
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    if payload.full_name is not None:
        cust.user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        cust.user.phone_number = payload.phone_number.strip()
    if payload.service_area_id is not None:
        cust.service_area_id = payload.service_area_id
    if payload.package_id is not None:
        cust.package_id = payload.package_id
    if payload.installation_address is not None:
        cust.installation_address = payload.installation_address.strip()
    if payload.ip_address is not None:
        cust.ip_address = payload.ip_address.strip()
    if payload.onu_mac_address is not None:
        cust.onu_mac_address = payload.onu_mac_address.strip()
    if payload.status is not None:
        cust.status = payload.status.upper()

    db.commit()
    db.refresh(cust)
    return _format_customer_response(cust)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_customer(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN.value))
):
    """Deactivate customer account and terminate service (Admin only)."""
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    cust.status = CustomerStatus.TERMINATED.value
    cust.user.is_active = False
    db.commit()
    return None
