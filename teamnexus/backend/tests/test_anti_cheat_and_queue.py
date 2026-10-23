import pytest
from app.services.anti_cheat import AntiCheatEngine
from app.services.queue_manager import QueueManager
from app.utils.sqlite_db import get_db_connection, init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_anti_cheat_rejects_negative_scores():
    telemetry = {
        "score": -100,
        "hits": 5,
        "misses": 0,
        "total_shots": 5,
        "duration_ms": 15000
    }
    is_valid, data, err = AntiCheatEngine.validate_session_result({}, telemetry, {"game_mode": "MODE_TARGETS", "target_count": 20})
    assert not is_valid
    assert "Invalid negative" in err

def test_anti_cheat_rejects_hits_greater_than_shots():
    telemetry = {
        "score": 500,
        "hits": 10,
        "misses": 0,
        "total_shots": 5,
        "duration_ms": 15000
    }
    is_valid, data, err = AntiCheatEngine.validate_session_result({}, telemetry, {"game_mode": "MODE_TARGETS", "target_count": 20})
    assert not is_valid
    assert "cannot exceed total shots" in err

def test_anti_cheat_rejects_hits_exceeding_max_targets():
    telemetry = {
        "score": 3000,
        "hits": 25,
        "misses": 5,
        "total_shots": 30,
        "duration_ms": 35000
    }
    is_valid, data, err = AntiCheatEngine.validate_session_result({}, telemetry, {"game_mode": "MODE_TARGETS", "target_count": 20})
    assert not is_valid
    assert "exceed total targets" in err

def test_anti_cheat_detects_bot_rapid_fire():
    # Shots with 20ms delta (<70ms minimum threshold)
    shots_telemetry = [{"t": i * 20, "hit": True} for i in range(15)]
    telemetry = {
        "score": 1500,
        "hits": 15,
        "misses": 0,
        "total_shots": 15,
        "duration_ms": 10000,
        "shots_telemetry": shots_telemetry
    }
    is_valid, data, err = AntiCheatEngine.validate_session_result({}, telemetry, {"game_mode": "MODE_TARGETS", "target_count": 20})
    assert not is_valid
    assert "rapid-fire" in err or "bot" in err

def test_anti_cheat_accepts_valid_human_game():
    shots_telemetry = [{"t": i * 800, "hit": i % 2 == 0} for i in range(20)]
    telemetry = {
        "score": 1400,
        "hits": 10,
        "misses": 10,
        "total_shots": 20,
        "best_combo": 3,
        "targets_destroyed": 10,
        "duration_ms": 25000,
        "shots_telemetry": shots_telemetry
    }
    is_valid, data, err = AntiCheatEngine.validate_session_result({}, telemetry, {"game_mode": "MODE_TARGETS", "target_count": 20})
    assert is_valid
    assert data["accuracy"] == 50.0
    assert data["score"] == 1400

def test_queue_manager_progression():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clean test teams
    cursor.execute("DELETE FROM queue_events WHERE team_id IN (SELECT id FROM teams WHERE team_code LIKE 'TEST-%')")
    cursor.execute("DELETE FROM teams WHERE team_code LIKE 'TEST-%'")
    conn.commit()

    # Insert 2 test teams
    cursor.execute("INSERT INTO teams (team_code, team_name, queue_number, status) VALUES ('TEST-001', 'Alpha', 990, 'WAITING')")
    t1_id = cursor.lastrowid
    cursor.execute("INSERT INTO teams (team_code, team_name, queue_number, status) VALUES ('TEST-002', 'Beta', 991, 'WAITING')")
    t2_id = cursor.lastrowid
    conn.commit()

    # Call team 1
    QueueManager.call_team(conn, t1_id, timeout_seconds=30)
    cursor.execute("SELECT status FROM teams WHERE id = ?", (t1_id,))
    assert cursor.fetchone()['status'] == 'CALLED'

    # Skip team 1
    QueueManager.skip_team(conn, t1_id, "Test skip")
    cursor.execute("SELECT status FROM teams WHERE id = ?", (t1_id,))
    assert cursor.fetchone()['status'] == 'SKIPPED'

    # Restore team 1
    QueueManager.restore_team(conn, t1_id)
    cursor.execute("SELECT status FROM teams WHERE id = ?", (t1_id,))
    assert cursor.fetchone()['status'] == 'WAITING'

    # Cleanup
    cursor.execute("DELETE FROM queue_events WHERE team_id IN (?, ?)", (t1_id, t2_id))
    cursor.execute("DELETE FROM teams WHERE team_code LIKE 'TEST-%'")
    conn.commit()
    conn.close()
