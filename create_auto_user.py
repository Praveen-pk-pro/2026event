import sqlite3
import hashlib
import os

DATABASE_FILE = os.path.join(os.path.dirname(__file__), "teamnexus", "backend", "app", "aitargetstrike.db")

def hash_access_code(code):
    return hashlib.sha256(code.strip().upper().encode('utf-8')).hexdigest()

def create_auto_team():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get next queue number
    cursor.execute("SELECT COALESCE(MAX(queue_number), 0) + 1 FROM teams;")
    next_q = cursor.fetchone()[0]

    team_code = f"ATS-{next_q:04d}"
    access_code = "ATS-2026-PLAY"
    access_hash = hash_access_code(access_code)
    team_name = f"AUTO USER {next_q:04d}"
    college = "Nexus Institute of Technology"

    # Insert team
    cursor.execute("""
        INSERT INTO teams (team_code, team_name, college_name, queue_number, status)
        VALUES (?, ?, ?, ?, 'WAITING')
    """, (team_code, team_name, college, next_q))
    team_id = cursor.lastrowid

    # Insert Player 1
    cursor.execute("""
        INSERT INTO participants (team_id, player_role, name, college, phone, roll_number, id_card_filename)
        VALUES (?, 'PLAYER_1_AIM', 'Alex (Aim)', ?, '9876543210', 'ROLL-001', 'auto_id1.png')
    """, (team_id, college))
    p1_id = cursor.lastrowid

    # Insert Player 2
    cursor.execute("""
        INSERT INTO participants (team_id, player_role, name, college, phone, roll_number, id_card_filename)
        VALUES (?, 'PLAYER_2_SHOOT', 'Sam (Shoot)', ?, '9876543211', 'ROLL-002', 'auto_id2.png')
    """, (team_id, college))
    p2_id = cursor.lastrowid

    # Insert Access Credential
    cursor.execute("""
        INSERT INTO access_credentials (team_id, credential_hash)
        VALUES (?, ?)
    """, (team_id, access_hash))

    # Log queue event
    cursor.execute("""
        INSERT INTO queue_events (team_id, event_type, details, triggered_by)
        VALUES (?, 'REGISTERED', 'Auto-created demo team user for immediate gameplay', 'AUTO_SYSTEM')
    """, (team_id,))

    conn.commit()
    conn.close()

    print("==================================================")
    print("      NEW AUTO USER ID & ACCESS CODE CREATED      ")
    print("==================================================")
    print(f"Official Team / User ID : {team_code}")
    print(f"Secret Game Access Code : {access_code}")
    print(f"Team Name               : {team_name}")
    print(f"Status                  : WAITING (Ready to play)")
    print(f"Queue Number            : #{next_q}")
    print("==================================================")

    return team_code, access_code

if __name__ == "__main__":
    create_auto_team()
