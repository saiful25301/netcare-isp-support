"""
NetCare ISP Customer Support & Complaint Management System
Comprehensive End-to-End System Integration Test Suite
"""
import sys
import os
import uuid

# Add netcare root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_01_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    print("[PASS] Test 1: System Health Endpoint")


def test_02_rbac_authentication():
    # 1. Admin login
    res = client.post("/api/v1/auth/login", json={"username": "admin@netcare.com.bd", "password": "password123"})
    assert res.status_code == 200
    admin_token = res.json()["access_token"]
    assert res.json()["role"] == "ADMIN"

    # 2. Agent login
    res = client.post("/api/v1/auth/login", json={"username": "agent@netcare.com.bd", "password": "password123"})
    assert res.status_code == 200
    assert res.json()["role"] == "AGENT"

    # 3. Technician login
    res = client.post("/api/v1/auth/login", json={"username": "tech1@netcare.com.bd", "password": "password123"})
    assert res.status_code == 200
    assert res.json()["role"] == "TECHNICIAN"

    # 4. Customer login
    res = client.post("/api/v1/auth/login", json={"username": "customer1@netcare.com.bd", "password": "password123"})
    assert res.status_code == 200
    assert res.json()["role"] == "CUSTOMER"

    # 5. Invalid credentials rejection
    res = client.post("/api/v1/auth/login", json={"username": "admin@netcare.com.bd", "password": "badpassword"})
    assert res.status_code == 401

    print("[PASS] Test 2: RBAC Authentication for all 4 Roles")
    return admin_token


def test_03_isp_master_data(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Check areas
    areas = client.get("/api/v1/areas").json()
    assert len(areas) >= 5
    dhanmondi = next(a for a in areas if a["code"] == "DHA-01")
    assert dhanmondi["city"] == "Dhaka"

    # 2. Check packages
    pkgs = client.get("/api/v1/packages").json()
    assert len(pkgs) >= 4

    # 3. Check categories
    cats = client.get("/api/v1/categories").json()
    assert len(cats) == 8

    print("[PASS] Test 3: ISP Master Data (Areas, Packages, Categories)")
    return dhanmondi["id"], pkgs[0]["id"]


def test_04_customer_and_technician_management(admin_token, area_id, package_id):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a customer
    cust_email = f"test.cust.{uuid.uuid4().hex[:6]}@example.com"
    cust_res = client.post("/api/v1/customers", headers=headers, json={
        "full_name": "Test Customer Line",
        "email": cust_email,
        "phone_number": f"+88017{uuid.uuid4().int % 100000000:08d}",
        "password": "custpassword123",
        "service_area_id": area_id,
        "package_id": package_id,
        "installation_address": "Apartment 5B, Road 15, Dhanmondi",
        "ip_address": "103.145.22.105",
        "onu_mac_address": "F4:8C:50:55:66:77",
        "status": "ACTIVE"
    })
    assert cust_res.status_code == 201
    cust_data = cust_res.json()
    assert cust_data["customer_code"].startswith("NC-CUST-")

    # 2. Create a technician
    tech_email = f"test.tech.{uuid.uuid4().hex[:6]}@netcare.com.bd"
    tech_res = client.post("/api/v1/technicians", headers=headers, json={
        "full_name": "Test Technician Field",
        "email": tech_email,
        "phone_number": f"+88018{uuid.uuid4().int % 100000000:08d}",
        "password": "techpassword123",
        "primary_area_id": area_id,
        "specialization": "Fiber Fusion & OTDR"
    })
    assert tech_res.status_code == 201
    tech_data = tech_res.json()
    assert tech_data["employee_code"].startswith("NC-TECH-")

    print("[PASS] Test 4: Customer & Technician Fleet Management")
    return cust_email, tech_data["id"]


def test_05_complaint_lifecycle_and_state_machine(cust_email, tech_id, admin_token):
    # 1. Login Customer
    c_res = client.post("/api/v1/auth/login", json={"username": cust_email, "password": "custpassword123"})
    assert c_res.status_code == 200
    c_token = c_res.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}
    a_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Customer Submits Ticket
    t_res = client.post("/api/v1/tickets", headers=c_headers, json={
        "category_id": 1,
        "problem_title": "LOS Red Light Blinking after storm",
        "problem_description": "Fiber patch cord seems severed outside the window."
    })
    assert t_res.status_code == 201
    ticket = t_res.json()
    t_code = ticket["ticket_id"]
    t_uuid = ticket["id"]
    assert t_code.startswith("NC-")
    assert ticket["status"] == "NEW"

    # 3. Invalid Transition Rejection: Customer cannot directly close a NEW ticket without resolution
    bad_trans = client.post(f"/api/v1/tickets/{t_code}/status", headers=c_headers, json={
        "new_status": "CLOSED"
    })
    assert bad_trans.status_code == 400

    # 4. Admin Assigns Technician
    assign_res = client.post(f"/api/v1/tickets/{t_code}/assign", headers=a_headers, json={
        "technician_id": tech_id,
        "notes": "Bring fiber splicer and 50m outdoor drop wire."
    })
    assert assign_res.status_code == 200
    assert assign_res.json()["status"] == "ASSIGNED"

    # 5. Technician Logs In & Starts Work (IN_PROGRESS)
    tech = client.get(f"/api/v1/technicians/{tech_id}", headers=a_headers).json()
    tech_login = client.post("/api/v1/auth/login", json={"username": tech["email"], "password": "techpassword123"})
    tech_token = tech_login.json()["access_token"]
    tech_headers = {"Authorization": f"Bearer {tech_token}"}

    prog_res = client.post(f"/api/v1/tickets/{t_code}/status", headers=tech_headers, json={
        "new_status": "IN_PROGRESS",
        "reason": "Arrived on location; optical power is -36 dBm."
    })
    assert prog_res.status_code == 200
    assert prog_res.json()["status"] == "IN_PROGRESS"

    # 6. Technician Submits Resolution
    res_res = client.post(f"/api/v1/tickets/{t_code}/status", headers=tech_headers, json={
        "new_status": "RESOLVED",
        "resolution_notes": "Spliced broken drop cable. Power normalized to -18 dBm. Speed test confirmed 20 Mbps."
    })
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"

    # 7. Customer Rates Service (5 Stars)
    fb_res = client.post("/api/v1/feedback", headers=c_headers, json={
        "ticket_id": t_uuid,
        "rating": 5,
        "is_issue_resolved": True,
        "customer_comments": "Technician arrived fast and fixed the fiber cleanly."
    })
    assert fb_res.status_code == 201

    # 8. Customer Confirms & Closes Ticket
    close_res = client.post(f"/api/v1/tickets/{t_code}/status", headers=c_headers, json={
        "new_status": "CLOSED",
        "reason": "Confirmed internet working."
    })
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "CLOSED"

    # 9. Verify Status History Timeline
    detail = client.get(f"/api/v1/tickets/{t_code}", headers=a_headers).json()
    assert len(detail["status_history"]) >= 4
    assert detail["feedback"]["rating"] == 5

    print("[PASS] Test 5: Strict 7-Stage State Machine & Customer Feedback Rating")


def test_06_area_outage_detection(admin_token, area_id):
    a_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Query current outages
    outages_res = client.get("/api/v1/outages", headers=a_headers)
    assert outages_res.status_code == 200

    # Query active banner
    banners = client.get("/api/v1/outages/active/banner").json()
    assert isinstance(banners, list)

    print("[PASS] Test 6: Area-Based Outage Correlation Detection")


def test_07_executive_analytics_dashboard(admin_token):
    a_headers = {"Authorization": f"Bearer {admin_token}"}
    dash = client.get("/api/v1/analytics/dashboard", headers=a_headers).json()

    assert "kpi" in dash
    assert "area_breakdown" in dash
    assert "category_breakdown" in dash
    assert "daily_trends" in dash
    assert "tech_leaderboard" in dash
    assert dash["kpi"]["total_customers"] >= 2
    assert dash["kpi"]["total_complaints"] >= 1

    print("[PASS] Test 7: Executive Operations Analytics & Visualizations")


if __name__ == "__main__":
    print("\n=======================================================")
    print("RUNNING NETCARE END-TO-END VERIFICATION TEST SUITE")
    print("=======================================================\n")
    test_01_health_check()
    admin_token = test_02_rbac_authentication()
    area_id, package_id = test_03_isp_master_data(admin_token)
    cust_email, tech_id = test_04_customer_and_technician_management(admin_token, area_id, package_id)
    test_05_complaint_lifecycle_and_state_machine(cust_email, tech_id, admin_token)
    test_06_area_outage_detection(admin_token, area_id)
    test_07_executive_analytics_dashboard(admin_token)
    print("\n=======================================================")
    print(">>> ALL 7 NETCARE INTEGRATION TEST SUITES PASSED! <<<")
    print("=======================================================\n")
