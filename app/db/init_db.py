import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models import (
    User,
    UserRole,
    ServiceArea,
    InternetPackage,
    Customer,
    CustomerStatus,
    Technician,
    TechnicianStatus,
    TicketCategory,
    TicketPriority
)


def seed_database(db: Session) -> None:
    print("Starting NetCare database seeding...")

    # 1. Seed Service Areas
    areas_data = [
        {"name": "Dhanmondi", "code": "DHA-01", "city": "Dhaka", "coverage_details": "Road 1-27, Satmasjid Road, Kalabagan, Shankar"},
        {"name": "Mirpur-10", "code": "MIR-10", "city": "Dhaka", "coverage_details": "Mirpur Sections 1, 2, 6, 10, 11, Kazipara, Shewrapara"},
        {"name": "Gulshan & Banani", "code": "GLS-01", "city": "Dhaka", "coverage_details": "Gulshan 1 & 2, Banani Road 11, Kemal Ataturk Ave"},
        {"name": "Uttara", "code": "UTR-03", "city": "Dhaka", "coverage_details": "Sectors 1 to 14, Airport Road, Jasimuddin Ave"},
        {"name": "Agrabad", "code": "AGR-01", "city": "Chattogram", "coverage_details": "Commercial Area, CDA R/A, Badamtoli, Halishahar"},
    ]

    area_map = {}
    for a in areas_data:
        existing = db.query(ServiceArea).filter(ServiceArea.code == a["code"]).first()
        if not existing:
            area = ServiceArea(**a)
            db.add(area)
            db.flush()
            area_map[a["name"]] = area
            print(f"  + Added Service Area: {a['name']} ({a['code']})")
        else:
            area_map[a["name"]] = existing

    # 2. Seed Internet Packages
    packages_data = [
        {"name": "Home Starter 20 Mbps", "speed_mbps": 20, "monthly_fee": 800.0, "connection_type": "Fiber"},
        {"name": "Home Premium 50 Mbps", "speed_mbps": 50, "monthly_fee": 1500.0, "connection_type": "Fiber"},
        {"name": "Gaming Pro 80 Mbps", "speed_mbps": 80, "monthly_fee": 2200.0, "connection_type": "Fiber"},
        {"name": "Corporate 150 Mbps", "speed_mbps": 150, "monthly_fee": 4500.0, "connection_type": "Fiber"},
    ]

    package_map = {}
    for p in packages_data:
        existing = db.query(InternetPackage).filter(InternetPackage.name == p["name"]).first()
        if not existing:
            pkg = InternetPackage(**p)
            db.add(pkg)
            db.flush()
            package_map[p["name"]] = pkg
            print(f"  + Added Package: {p['name']} ({p['speed_mbps']} Mbps)")
        else:
            package_map[p["name"]] = existing

    # 3. Seed Ticket Categories
    categories_data = [
        {"name": "Internet Not Working", "description": "Total loss of connectivity, optical signal drop (LOS red)", "default_priority": TicketPriority.CRITICAL.value, "sla_target_hours": 4},
        {"name": "Slow Internet Speed", "description": "High latency, buffer bloat, or download/upload significantly below subscribed bandwidth", "default_priority": TicketPriority.MEDIUM.value, "sla_target_hours": 8},
        {"name": "Frequent Disconnection", "description": "Intermittent drops, link flaps, fiber optical power fluctuation", "default_priority": TicketPriority.HIGH.value, "sla_target_hours": 6},
        {"name": "Router Problem", "description": "Router hardware crash, reboot loop, DHCP or DNS configuration issue", "default_priority": TicketPriority.MEDIUM.value, "sla_target_hours": 12},
        {"name": "Wi-Fi Connectivity Issue", "description": "Weak wireless coverage, channel interference, password issues", "default_priority": TicketPriority.LOW.value, "sla_target_hours": 24},
        {"name": "Network Outage", "description": "Area distribution fiber severed or upstream core switch failure", "default_priority": TicketPriority.CRITICAL.value, "sla_target_hours": 2},
        {"name": "Billing Issue", "description": "Payment confirmation delay, account recharge or package upgrade query", "default_priority": TicketPriority.LOW.value, "sla_target_hours": 24},
        {"name": "Other Technical Issues", "description": "Public IP assignment, port forwarding, or custom technical requests", "default_priority": TicketPriority.MEDIUM.value, "sla_target_hours": 12},
    ]

    for c in categories_data:
        existing = db.query(TicketCategory).filter(TicketCategory.name == c["name"]).first()
        if not existing:
            cat = TicketCategory(**c)
            db.add(cat)
            print(f"  + Added Category: {c['name']}")

    db.flush()

    default_password_hash = get_password_hash("password123")

    # 4. Seed Demo Users & Profiles
    users_to_create = [
        {
            "email": "admin@netcare.com.bd",
            "phone_number": "+8801711000001",
            "full_name": "System Administrator",
            "role": UserRole.ADMIN.value,
        },
        {
            "email": "agent@netcare.com.bd",
            "phone_number": "+8801711000002",
            "full_name": "Tanvir Ahmed (Support Lead)",
            "role": UserRole.AGENT.value,
        },
        {
            "email": "tech1@netcare.com.bd",
            "phone_number": "+8801711000003",
            "full_name": "Rafiqul Islam (Senior Field Tech)",
            "role": UserRole.TECHNICIAN.value,
            "tech_data": {
                "employee_code": "NC-TECH-01",
                "area_name": "Dhanmondi",
                "specialization": "Fiber Splicing & Optical Line Test (OTDR)"
            }
        },
        {
            "email": "tech2@netcare.com.bd",
            "phone_number": "+8801711000004",
            "full_name": "Sohel Rana (Network Config Tech)",
            "role": UserRole.TECHNICIAN.value,
            "tech_data": {
                "employee_code": "NC-TECH-02",
                "area_name": "Mirpur-10",
                "specialization": "ONU Configuration & MikroTik/VLAN Setup"
            }
        },
        {
            "email": "customer1@netcare.com.bd",
            "phone_number": "+8801711000005",
            "full_name": "Mahmudul Hasan",
            "role": UserRole.CUSTOMER.value,
            "cust_data": {
                "customer_code": "NC-CUST-1001",
                "area_name": "Dhanmondi",
                "package_name": "Home Premium 50 Mbps",
                "address": "House 42, Road 7A, Dhanmondi, Dhaka-1205",
                "ip_address": "103.145.22.45",
                "onu_mac": "F4:8C:50:AB:12:34"
            }
        },
        {
            "email": "customer2@netcare.com.bd",
            "phone_number": "+8801711000006",
            "full_name": "Farzana Rahman",
            "role": UserRole.CUSTOMER.value,
            "cust_data": {
                "customer_code": "NC-CUST-1002",
                "area_name": "Mirpur-10",
                "package_name": "Home Starter 20 Mbps",
                "address": "Apartment 4B, Plot 18, Block D, Mirpur-10, Dhaka-1216",
                "ip_address": "103.145.28.89",
                "onu_mac": "F4:8C:50:CD:56:78"
            }
        }
    ]

    for u_spec in users_to_create:
        existing = db.query(User).filter(User.email == u_spec["email"]).first()
        if not existing:
            user = User(
                email=u_spec["email"],
                phone_number=u_spec["phone_number"],
                full_name=u_spec["full_name"],
                role=u_spec["role"],
                hashed_password=default_password_hash,
                is_active=True
            )
            db.add(user)
            db.flush()
            print(f"  + Added User: {user.email} [{user.role}]")

            # Technician profile
            if u_spec["role"] == UserRole.TECHNICIAN.value:
                tech_data = u_spec["tech_data"]
                area = area_map[tech_data["area_name"]]
                tech = Technician(
                    user_id=user.id,
                    employee_code=tech_data["employee_code"],
                    primary_area_id=area.id,
                    specialization=tech_data["specialization"],
                    current_status=TechnicianStatus.AVAILABLE.value,
                    rating_cache=5.0
                )
                db.add(tech)
                print(f"    * Configured Technician Profile: {tech.employee_code}")

            # Customer profile
            if u_spec["role"] == UserRole.CUSTOMER.value:
                cust_data = u_spec["cust_data"]
                area = area_map[cust_data["area_name"]]
                pkg = package_map[cust_data["package_name"]]
                cust = Customer(
                    user_id=user.id,
                    customer_code=cust_data["customer_code"],
                    service_area_id=area.id,
                    package_id=pkg.id,
                    installation_address=cust_data["address"],
                    ip_address=cust_data["ip_address"],
                    onu_mac_address=cust_data["onu_mac"],
                    status=CustomerStatus.ACTIVE.value
                )
                db.add(cust)
                print(f"    * Configured Customer Profile: {cust.customer_code}")

    db.commit()
    print("NetCare database seeded successfully!")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
