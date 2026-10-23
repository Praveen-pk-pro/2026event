import os
import json
import base64
import uuid
import random
import pytest
from app import create_app
from app.utils.sqlite_db import get_db_connection, init_db
from app.routes.api_routes import generate_access_code, hash_access_code, verify_image_bytes

TINY_PNG_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        with app.app_context():
            init_db()
        yield client

def test_image_magic_bytes_validator():
    # Valid PNG
    png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'
    valid, ext = verify_image_bytes(png_bytes)
    assert valid and ext == 'png'

    # Valid JPEG
    jpg_bytes = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01'
    valid, ext = verify_image_bytes(jpg_bytes)
    assert valid and ext == 'jpg'

    # Invalid arbitrary executable/script
    fake_exe = b'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00'
    valid, err = verify_image_bytes(fake_exe)
    assert not valid
    assert "not supported" in err

def test_access_code_generator_and_hasher():
    code = generate_access_code()
    assert code.startswith("ATS-")
    assert len(code) == 13  # ATS-XXXX-XXXX
    h1 = hash_access_code(code)
    h2 = hash_access_code(code.lower())
    assert h1 == h2  # Case-insensitive normalization
    assert len(h1) == 64  # SHA-256 hex string

def test_registration_rejects_missing_mandatory_id(client):
    uid = uuid.uuid4().hex[:6]
    rand_phone1 = f"98765{random.randint(10000, 99999)}"
    rand_phone2 = f"98766{random.randint(10000, 99999)}"

    res = client.post('/api/register', json={
        "team_name": f"Incomplete Team {uid}",
        "college_name": "Tech College",
        "p1_name": "Player One",
        "p1_roll": f"R1_{uid}",
        "p1_phone": rand_phone1,
        "p2_name": "Player Two",
        "p2_roll": f"R2_{uid}",
        "p2_phone": rand_phone2
        # No ID cards provided
    })
    assert res.status_code == 400
    assert "mandatory" in res.get_json()["error"].lower()

def test_successful_registration_and_code_generation(client):
    uid = uuid.uuid4().hex[:6]
    rand_phone1 = f"91234{random.randint(10000, 99999)}"
    rand_phone2 = f"91235{random.randint(10000, 99999)}"

    res = client.post('/api/register', json={
        "team_name": f"CYBER APEX {uid}",
        "college_name": "Apex Engineering Institute",
        "p1_name": "Alex Mercer",
        "p1_roll": f"APEX-P1-{uid}",
        "p1_phone": rand_phone1,
        "p1_id_card_data": TINY_PNG_B64,
        "p2_name": "Sarah Connor",
        "p2_roll": f"APEX-P2-{uid}",
        "p2_phone": rand_phone2,
        "p2_id_card_data": TINY_PNG_B64
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"]
    assert "team_code" in data
    assert "access_code" in data
    assert data["team_code"].startswith("ATS-")
    assert data["access_code"].startswith("ATS-")

    team_code = data["team_code"]
    access_code = data["access_code"]

    # Verify game access with correct code
    auth_res = client.post('/api/game-access/verify', json={
        "team_code": team_code,
        "access_code": access_code,
        "difficulty": "HARD"
    })
    assert auth_res.status_code == 200
    auth_data = auth_res.get_json()
    assert auth_data["success"]
    assert auth_data["duration_seconds"] == 420
    assert "session_token" in auth_data

    # Verify that wrong code is rejected
    wrong_res = client.post('/api/game-access/verify', json={
        "team_code": team_code,
        "access_code": "ATS-WRONG-CODE"
    })
    assert wrong_res.status_code == 401
    assert "invalid" in wrong_res.get_json()["error"].lower()

def test_public_leaderboard_sanitization(client):
    res = client.get('/api/leaderboard')
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"]
    for row in data["leaderboard"]:
        # Verify no sensitive data is leaked
        assert "phone" not in row
        assert "roll_number" not in row
        assert "id_card_filename" not in row
        assert "access_code" not in row

def test_admin_auth_and_security(client):
    # Unauthenticated access rejected
    unauth_res = client.get('/api/admin/stats')
    assert unauth_res.status_code == 401

    # Valid admin login
    login_res = client.post('/api/admin/login', json={
        "username": "admin",
        "password": "adminPassword2026!"
    })
    assert login_res.status_code == 200
    token = login_res.get_json()["token"]

    # Authenticated access succeeds
    auth_res = client.get('/api/admin/stats', headers={"Authorization": f"Bearer {token}"})
    assert auth_res.status_code == 200
    assert auth_res.get_json()["success"]
