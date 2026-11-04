import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerStatus
from app.models.technician import Technician
from app.models.area_package import ServiceArea, InternetPackage
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import CustomerRegistrationRequest, UserResponse

router = APIRouter()


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email or phone number and issue JWT token."""
    user = db.query(User).filter(
        or_(
            User.email == login_data.username.strip().lower(),
            User.phone_number == login_data.username.strip()
        )
    ).first()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username (email/phone) or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact ISP Administration."
        )

    access_token = create_access_token(
        subject=str(user.id),
        role=user.role
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role
    )


@router.post("/register-customer", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_customer(payload: CustomerRegistrationRequest, db: Session = Depends(get_db)):
    """Self-service registration for ISP customers."""
    # Check if email or phone already registered
    existing_user = db.query(User).filter(
        or_(
            User.email == payload.email.strip().lower(),
            User.phone_number == payload.phone_number.strip()
        )
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or phone number already exists."
        )

    # Verify Area and Package exist
    area = db.query(ServiceArea).filter(ServiceArea.id == payload.service_area_id, ServiceArea.is_active == True).first()
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected service area is invalid or inactive."
        )

    package = db.query(InternetPackage).filter(InternetPackage.id == payload.package_id, InternetPackage.is_active == True).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected internet package is invalid or inactive."
        )

    # Generate next Customer Code: NC-CUST-100X
    total_customers = db.query(Customer).count()
    customer_code = f"NC-CUST-{1001 + total_customers}"

    # Atomic user & customer creation
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
        package_id=package.id,
        installation_address=payload.installation_address.strip(),
        ip_address=payload.ip_address.strip() if payload.ip_address else None,
        onu_mac_address=payload.onu_mac_address.strip() if payload.onu_mac_address else None,
        status=CustomerStatus.ACTIVE.value
    )
    db.add(new_customer)
    db.commit()

    # Issue token immediately upon successful registration
    access_token = create_access_token(subject=str(new_user.id), role=new_user.role)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=str(new_user.id),
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role
    )


@router.get("/me")
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve the authenticated user's profile and role-specific details."""
    response = {
        "id": str(current_user.id),
        "email": current_user.email,
        "phone_number": current_user.phone_number,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat()
    }

    if current_user.role == UserRole.CUSTOMER.value:
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if cust:
            response["customer_profile"] = {
                "id": str(cust.id),
                "customer_code": cust.customer_code,
                "service_area_id": cust.service_area_id,
                "service_area_name": cust.service_area.name if cust.service_area else None,
                "package_id": cust.package_id,
                "package_name": cust.package.name if cust.package else None,
                "speed_mbps": cust.package.speed_mbps if cust.package else None,
                "installation_address": cust.installation_address,
                "status": cust.status,
                "ip_address": cust.ip_address,
                "onu_mac_address": cust.onu_mac_address,
            }

    elif current_user.role == UserRole.TECHNICIAN.value:
        tech = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if tech:
            response["technician_profile"] = {
                "id": str(tech.id),
                "employee_code": tech.employee_code,
                "primary_area_id": tech.primary_area_id,
                "primary_area_name": tech.primary_area.name if tech.primary_area else None,
                "specialization": tech.specialization,
                "current_status": tech.current_status,
                "rating_cache": tech.rating_cache
            }

    return response
