# AI TARGET STRIKE — Production Deployment & Operator Manual

**AI TARGET STRIKE** is a 2-player competitive event system with camera college ID capture, cryptographic game access codes, authoritative 7-minute match timing, story-based multi-target combat, live leaderboard, projector queue display, and a protected admin command console.

---

## 1. System Architecture Overview

```
                          ┌───────────────────────────────┐
                          │   Public Event Password Gate  │
                          │   (Configurable by Organizer) │
                          └──────────────┬────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
       ┌─────────▼─────────┐                           ┌─────────▼─────────┐
       │ Team Registration │                           │   Game Station    │
       │  • Camera ID Card │                           │ • Team ID & Secret│
       │  • Form Validation│                           │   Game Access Code│
       │  • Cryptographic  │                           │ • 7-Min Countdown │
       │    ATS-XXXX Code  │                           │ • P1 WASD / P2 SPC│
       └─────────┬─────────┘                           └─────────┬─────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │ REST API & Server-Sent Events
                                         │
                          ┌──────────────▼──────────────┐
                          │      Python Core Engine     │
                          │  • SHA-256 Access Hashing   │
                          │  • Anti-Cheat Telemetry     │
                          │  • Authoritative Timer Sync │
                          │  • SQLite WAL Mode Concurrency│
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
       ┌─────────▼─────────┐                           ┌─────────▼─────────┐
       │  Live Scoreboard  │                           │  Admin Console    │
       │  • Sanitized Rank │                           │  • Separate Auth  │
       │  • Score / Acc %  │                           │  • ID Card Review │
       │  • Real-Time Sync │                           │  • Queue Control  │
       └───────────────────┘                           └───────────────────┘
```

---

## 2. Quick Start for Event Operators (Local Host)

### Option A: One-Click Event Launcher
Double-click `run_all.bat` in the root project folder. It launches:
- **Flask Core Server**: `http://localhost:5000`
- **React Frontend**: `http://localhost:5173`

### Option B: Terminal Launch
1. **Start Backend**:
   ```powershell
   $env:PYTHONPATH="teamnexus/backend"
   python teamnexus/backend/run.py
   ```
2. **Start Frontend**:
   ```bash
   npm --prefix teamnexus/frontend run dev
   ```

---

## 3. URLs and Port Map

| Component | Default URL | Purpose | Access Control |
|---|---|---|---|
| **Game Station** | `http://localhost:5173/game` | 2-player match arena (7 mins) | Team ID & Access Code |
| **Registration** | `http://localhost:5173/register` | Team sign-up with camera ID capture | Event Password (if enabled) |
| **Live Queue** | `http://localhost:5173/queue` | Projector & TV spectator display | Public |
| **Scoreboard** | `http://localhost:5173/leaderboard` | Live verified rankings | Public (Sanitized) |
| **Admin Console** | `http://localhost:5173/admin` | Full event operation & configuration | Admin Username & Password |

---

## 4. Initial Admin and Event Credentials

Set `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` before the first
database initialization. The initial admin account is created only if that
username does not already exist. Set `REGISTRATION_GATE_PASSWORD` only when a
registration gate is required.

---

## 5. Production Server Deployment

### System Requirements
- OS: Ubuntu 22.04 LTS, Debian 12, or Windows Server 2022
- Python: 3.11+
- Node.js: 18+ LTS
- Reverse Proxy: Nginx or Caddy
- SSL/TLS Certificate (Required for camera `getUserMedia` outside localhost)

### Step 1: Environment Configuration
Create `teamnexus/backend/.env`:
```ini
FLASK_ENV=production
PORT=5000
SECRET_KEY=<unique-random-secret>
JWT_SECRET_KEY=<unique-random-secret>
JWT_EVENT_SECRET=<unique-random-secret>
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=<unique-admin-password>
REGISTRATION_GATE_PASSWORD=<optional-event-gate-password>
DATABASE_FILE=/var/lib/aitargetstrike/aitargetstrike.db
UPLOAD_FOLDER=/var/lib/aitargetstrike/secure_uploads
MAX_UPLOAD_SIZE_BYTES=5242880
```

Generate each signing key with a cryptographically secure random generator.
Never commit `.env` or use the same secrets across deployments. Without
explicitly configured signing keys, a random process-local key is generated;
tokens will be invalidated whenever that process restarts.

Create `teamnexus/frontend/.env.production`:
```ini
VITE_API_BASE_URL=https://event.yourdomain.com/api
```

For ESP32 firmware, define `ESP32_AP_PASSWORD` as a build flag before
compilation. The firmware intentionally fails to compile without it.

### Step 2: Database Initialization & Migrations
```bash
cd teamnexus/backend
python -c "from app.utils.sqlite_db import init_db; init_db()"
```

### Step 3: Frontend Production Build
```bash
cd teamnexus/frontend
npm install
npm run build
```
The optimized production bundle is generated in `teamnexus/frontend/dist/`.

### Step 4: Gunicorn Production WSGI Service
Create `/etc/systemd/system/aitargetstrike.service`:
```ini
[Unit]
Description=AI TARGET STRIKE Backend Engine
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/aitargetstrike/teamnexus/backend
Environment="PYTHONPATH=/opt/aitargetstrike/teamnexus/backend"
ExecStart=/opt/aitargetstrike/teamnexus/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 "run:app"
Restart=always

[Install]
WantedBy=multi-user.target
```

### Step 5: Nginx Reverse Proxy with HTTPS & Camera Support
*Browser security rules strictly require HTTPS for camera (`getUserMedia`) access on non-localhost domains.*

Create `/etc/nginx/sites-available/aitargetstrike`:
```nginx
server {
    listen 80;
    server_name event.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name event.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/event.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/event.yourdomain.com/privkey.pem;

    # Frontend Single Page App
    root /opt/aitargetstrike/teamnexus/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API & SSE streaming
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for real-time Server-Sent Events
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    # Camera permissions policy header
    add_header Permissions-Policy "camera=(self)";
}
```

---

## 6. Security & Privacy Guarantees

1. **Mandatory ID Card Isolation**:
   ID card images and photos are stored in a private vault (`UPLOAD_FOLDER`) outside the web root. They are NEVER served without a valid JWT admin token.
2. **Access Code Hashing**:
   Raw game access codes (`ATS-XXXX-XXXX`) are shown to teams once upon registration. The server stores only SHA-256 hashes in `access_credentials`.
3. **Timer Authority**:
   Official 7-minute duration is enforced server-side. Browser refreshes cannot reset or manipulate the timer.
4. **Leaderboard Sanitization**:
   The public standings endpoint excludes roll numbers, phone numbers, ID cards, access credentials, and audit logs.
5. **Post-Event Compliance Purge**:
   Administrators can click "Wipe All ID Cards" in Emergency Controls to permanently delete all ID card scans while keeping competition rankings intact.

---

## 7. Automated Test Suite Execution

Run all verification tests:
```powershell
$env:PYTHONPATH="teamnexus/backend"
teamnexus\backend\venv\Scripts\python.exe -m pytest teamnexus/backend/tests/test_full_system.py teamnexus/backend/tests/test_anti_cheat_and_queue.py
```
Expected output:
```
12 passed in < 1.0s
```
