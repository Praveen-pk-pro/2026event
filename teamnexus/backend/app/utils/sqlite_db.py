import os
import sqlite3
from datetime import datetime

DATABASE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "aitargetstrike.db")
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "secure_uploads")

def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    # Enforce foreign keys and WAL mode for high concurrency & reliability
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. System Config
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        event_name TEXT NOT NULL DEFAULT 'AI TARGET STRIKE 2026',
        game_mode TEXT NOT NULL DEFAULT 'MODE_TARGETS' CHECK (game_mode IN ('MODE_TARGETS', 'MODE_TIME')),
        target_count INTEGER NOT NULL DEFAULT 20,
        game_duration INTEGER NOT NULL DEFAULT 420,
        base_target_speed REAL NOT NULL DEFAULT 3.2,
        max_target_speed REAL NOT NULL DEFAULT 7.5,
        min_target_size INTEGER NOT NULL DEFAULT 38,
        max_target_size INTEGER NOT NULL DEFAULT 64,
        score_per_hit INTEGER NOT NULL DEFAULT 100,
        combo_enabled INTEGER NOT NULL DEFAULT 1,
        queue_timeout_seconds INTEGER NOT NULL DEFAULT 30,
        competition_mode TEXT NOT NULL DEFAULT 'COMPETITION' CHECK (competition_mode IN ('PRACTICE', 'COMPETITION', 'TEST')),
        difficulty TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
        difficulty_mode TEXT NOT NULL DEFAULT 'EVENT_LOCKED' CHECK (difficulty_mode IN ('EVENT_LOCKED', 'TEAM_SELECTS', 'ADMIN_ASSIGNS')),
        operating_mode TEXT NOT NULL DEFAULT 'OPERATOR_CONTROLLED' CHECK (operating_mode IN ('OPERATOR_CONTROLLED', 'SELF_SERVICE')),
        story_enabled INTEGER NOT NULL DEFAULT 1,
        registration_open INTEGER NOT NULL DEFAULT 1,
        event_active INTEGER NOT NULL DEFAULT 1,
        event_password_hash TEXT NULL,
        event_password_enabled INTEGER NOT NULL DEFAULT 0,
        tie_breaker_rule TEXT NOT NULL DEFAULT 'ACCURACY_THEN_TIME',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("SELECT COUNT(*) FROM system_config WHERE id = 1;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO system_config (id, event_name, game_duration) VALUES (1, 'AI TARGET STRIKE 2026', 420);
        """)

    # 2. Teams Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_code TEXT UNIQUE NOT NULL,
        team_name TEXT NOT NULL,
        college_name TEXT NULL,
        queue_number INTEGER UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'WAITING' 
            CHECK (status IN ('WAITING', 'CALLED', 'PRESENT', 'PLAYING', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
        called_at TIMESTAMP NULL,
        call_deadline TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Participants Table (Exactly 2 players per team)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        player_role TEXT NOT NULL CHECK (player_role IN ('PLAYER_1_AIM', 'PLAYER_2_SHOOT')),
        name TEXT NOT NULL,
        college TEXT NOT NULL,
        phone TEXT NOT NULL,
        roll_number TEXT NOT NULL,
        id_card_filename TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Access Credentials Table (Hashed access codes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS access_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        credential_hash TEXT NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        revoked_at TIMESTAMP NULL,
        used_at TIMESTAMP NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_access_credentials_team ON access_credentials(team_id);")

    # 5. Private Documents Table (Secure ID Storage Metadata)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS private_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        private_storage_key TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        retention_until TIMESTAMP NULL
    );
    """)

    # 6. Game Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'INITIATED' 
            CHECK (status IN ('INITIATED', 'COUNTDOWN', 'PLAYING', 'COMPLETED', 'ABORTED', 'INVALIDATED')),
        session_token TEXT NOT NULL UNIQUE,
        mode TEXT NOT NULL,
        difficulty TEXT NOT NULL DEFAULT 'MEDIUM',
        config_snapshot TEXT NOT NULL,
        started_at TIMESTAMP NULL,
        scheduled_end_at TIMESTAMP NULL,
        ended_at TIMESTAMP NULL,
        duration_ms INTEGER NULL,
        total_shots INTEGER DEFAULT 0,
        total_hits INTEGER DEFAULT 0,
        total_misses INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Game Results Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS game_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_session_id TEXT UNIQUE NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        difficulty TEXT NOT NULL DEFAULT 'MEDIUM',
        score INTEGER NOT NULL CHECK (score >= 0),
        hits INTEGER NOT NULL CHECK (hits >= 0),
        misses INTEGER NOT NULL CHECK (misses >= 0),
        accuracy REAL NOT NULL CHECK (accuracy >= 0.0 AND accuracy <= 100.0),
        best_combo INTEGER NOT NULL DEFAULT 0,
        targets_destroyed INTEGER NOT NULL DEFAULT 0,
        completion_time_ms INTEGER NOT NULL,
        is_official INTEGER NOT NULL DEFAULT 1,
        verified_by_server INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8. Queue Event Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS queue_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        details TEXT NULL,
        triggered_by TEXT DEFAULT 'SYSTEM',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. Admin Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 10. Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL DEFAULT 'SYSTEM',
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NULL,
        metadata TEXT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Pre-seed default Admin if not exists (username: admin, password: adminPassword2026!)
    cursor.execute("SELECT COUNT(*) FROM admin_users WHERE username = 'admin';")
    if cursor.fetchone()[0] == 0:
        from werkzeug.security import generate_password_hash
        pwd_hash = generate_password_hash("adminPassword2026!", method="scrypt")
        cursor.execute("INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?);",
                       ('admin', pwd_hash, 'ADMIN'))

    conn.commit()
    conn.close()
    print("Database schema successfully verified with WAL mode and initial seed.")

if __name__ == '__main__':
    init_db()
