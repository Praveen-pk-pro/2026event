# AI TARGET STRIKE — Event Management & 2-Player Game System

A complete, production-hardened college technical event web application combining a **Two-Player 2D Shooting Game**, **Team Registration Portal with Camera ID Capture**, **Cryptographic Game Access Codes**, **Automatic Queue Calling Projector**, and **Live Real-Time Leaderboard**.

---

## 1. System Overview

### The Core Two-Player Game Mechanic
Each team consists of **exactly 2 participants** stationed at a single computer:
- **Player 1 — AIM CONTROL**: Uses `W A S D` to move the crosshair smoothly (4 directions + normalized diagonals) across the arena.
- **Player 2 — SHOOT CONTROL**: Uses `SPACEBAR` to fire the laser weapon. The system checks hitscan collision against moving AI-themed target hitboxes.

Zero mouse input is required; the game is entirely playable using the keyboard.

### 7-Minute Story-Based Progression
Each match runs on an authoritative **7-minute (420 seconds)** timer across three story chapters:
1. **Chapter 1: AI System Breach** — Neutralize corrupted virtual simulation drones.
2. **Chapter 2: Model Training Zone** — Adapt to accelerated movement patterns and armored cores.
3. **Chapter 3: Final Defense Overdrive** — High-speed glitch targets and quantum bonus datacubes.

### 3 Difficulty Levels
- **EASY**: Slower targets, larger hitboxes (48–72px), 4.5s lifetime.
- **MEDIUM**: Standard competition baseline (36–56px), 3.4s lifetime.
- **HARD**: Fast targets (5–9 speed), compact hitboxes (26–42px), 2.4s lifetime.

---

## 2. Key Modules & Screen URLs

| Screen | URL | Purpose / Audience | Access Control |
| :--- | :--- | :--- | :--- |
| **Game Station** | [http://localhost:5173/game](http://localhost:5173/game) | Game Station operator / player interface. Verifies Team ID & Game Access Code, runs 7-minute match, and submits score. | Team ID + Access Code |
| **Team Registration** | [http://localhost:5173/register](http://localhost:5173/register) | Public participant portal. Captures college ID cards via camera or upload, validates phone/roll numbers, and issues `ATS-XXXX` Team ID and secret Game Access Code. | Event Password (if enabled) |
| **Projector Queue Display** | [http://localhost:5173/queue](http://localhost:5173/queue) | Dedicated fullscreen TV / Projector display (readable from 30+ feet). Shows `NOW PLAYING`, `NEXT TEAM (CALLED)` with audio chime and 30s reporting countdown timer, and upcoming queue list. | Public |
| **Live Leaderboard** | [http://localhost:5173/leaderboard](http://localhost:5173/leaderboard) | Public live scoreboard. Updates via Server-Sent Events (SSE). Ranked deterministically by **Score $\to$ Accuracy % $\to$ Hits $\to$ Time**. Strictly protects privacy (zero phone numbers or ID cards displayed). | Public (Sanitized) |
| **Admin Command Console** | [http://localhost:5173/admin](http://localhost:5173/admin) | Protected organizer dashboard. View live event statistics, call/skip/restore teams, view authenticated ID card scans, reset access codes, modify match rules live, and run emergency actions (replay match, pause event, CSV export, ID card wipe). | Admin Credentials |

---

## 3. Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, HTML5 2D Canvas (60 FPS hardware-accelerated game loop).
- **Audio Engine**: Web Audio API procedural synthesizer (zero external MP3 files or CDN dependencies; works 100% offline).
- **Backend**: Python 3, Flask 3.1, Werkzeug, Flask-CORS, PyJWT.
- **Database**: SQLite 3 with **WAL Mode (Write-Ahead Logging)** enabled (`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`). Single-file portability (`aitargetstrike.db`), crash-proof against sudden power loss.
- **Real-Time Channel**: Server-Sent Events (SSE) `/api/events/stream` with a 3.5s background polling fallback.

---

## 4. Quick Start (Windows)

### Option A: 1-Click Launch
Double-click `run_all.bat` in the project root:
```cmd
run_all.bat
```

### Option B: Manual Launch

#### 1. Start Backend:
```powershell
$env:PYTHONPATH="teamnexus/backend"
python teamnexus/backend/run.py
```
*Backend runs on `http://localhost:5000`.*

#### 2. Start Frontend:
```bash
npm --prefix teamnexus/frontend run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 5. Automated Tests

Run the complete test suite:
```powershell
$env:PYTHONPATH="teamnexus/backend"
teamnexus\backend\venv\Scripts\python.exe -m pytest teamnexus/backend/tests/test_full_system.py teamnexus/backend/tests/test_anti_cheat_and_queue.py
```
All 12 automated unit and integration tests will execute and verify system integrity.

---

## 6. Default Admin Credentials

- **Username**: `admin`
- **Password**: `adminPassword2026!`

See [DEPLOYMENT.md](file:///d:/Game%20Event%20Registation/DEPLOYMENT.md) for production Nginx, systemd, HTTPS, and data retention guidelines.
