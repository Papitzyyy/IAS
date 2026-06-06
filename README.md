# CRCY Scan and Help — EVSU Student Medical Tag System

## Project Structure

```
EVSU/
├── backend/        FastAPI (Python) — REST API, auth, database
├── frontend/       HTML/JS/Tailwind — Admin Web Portal
│   └── assets/js/shared/ — shared frontend utility scripts
├── mobile/         React Native — Responder Android APK
│   ├── app/         — active Expo app screens and routes
│   ├── src/         — active app logic, theme, and API client
│   └── archive/     — archived mobile code kept for reference
└── PRD.md          Product Requirements Document
```

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
venv\Scripts\python scripts\init_db.py      # first-time: create tables
venv\Scripts\python migrate_v2.py   # upgrade existing DB (archive, names, email unique) DON'T MIND THIS 
venv\Scripts\python scripts\seed.py         # set SEED_ADMIN_PASSWORD / SEED_RESPONDER_PASSWORD in .env first
uvicorn app.main:app --reload
```S
OR 
```bash
venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
OR
venv\Scripts\activate then uvicorn app.main:app --host 0.0.0.0 --port 8000
```

*You can now open the web dashboard in your browser by visiting `http://127.0.0.1:8000`.*

API docs available at: http://localhost:8000/docs









### Run integration tests

```bash
cd backend
venv\Scripts\python tests\test_integration.py
```

Covers: MFA login, students (validation, auto-tag), QR scan, GET deactivation link, archive, responders kill switch, audit logs.

### Frontend (Admin Portal)

Open `frontend/pages/login.html` with a local server (e.g. VS Code Live Server on port 5500).

### Mobile (Responder APK)

```bash
cd mobile
npm install
```

**Set your API URL** — edit `src/api/client.ts`:
- Emulator: `http://10.0.2.2:8000/api/v1` (default)
- Physical device: `http://<your-LAN-IP>:8000/api/v1`

**Run on emulator:**
```bash
npm run android
```
Requires Android Studio with a running emulator.

**Build APK for device / submission:**
```bash
npm install -g eas-cli
eas login          # Expo account required (free)
npm run build:apk  # builds in the cloud, ~5–10 min
```
Download the `.apk` from the EAS dashboard link printed after the build.

## Database Setup

1. Create a PostgreSQL database: `evsu_clinic` (or use SQLite for local dev)
2. `venv/Scripts\python scripts\init_db.py` and `migrate_v2.py` if upgrading
3. Apply immutable audit trigger (PostgreSQL):

```bash
psql $DATABASE_URL -f db/sql/audit_trigger.sql
```

4. Optional encryption extension: `db/sql/pgcrypto_setup.sql`

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for diagrams and production `.env` settings.

## Hybrid Presentation Setup (Local Backend + Neon DB)

This is the recommended setup for school presentations. It bypasses free-tier cloud restrictions (like email blocking) while still proving that the system handles data in the cloud.

**How it works:**
- **Database:** Online (Neon PostgreSQL). All data is saved to the cloud.
- **Backend/Frontend:** Hosted locally on your laptop.
- **Mobile App:** Connects to your laptop over the same Wi-Fi network. The server IP is configurable inside the app (no rebuild needed).

### Step 1: Set up the Database Connection
In `backend/.env`, set your database to your Neon connection string:
```
DATABASE_URL=postgresql+psycopg2://your_neon_string...
```

### Step 2: Start the Local Server
Open a terminal in the `backend` folder and start the server:
```bash
venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
*You can now open the web dashboard in your browser by visiting `http://127.0.0.1:8000`.*

### Step 3: Find Your Laptop's IP Address
Open Command Prompt on your laptop and type:
```bash
ipconfig
```
Look for **IPv4 Address** under your Wi-Fi adapter (e.g. `192.168.1.5`).

### Step 4: Connect the Mobile App
1. Make sure your phone and laptop are on the **same Wi-Fi network**.
2. Open the CRCY app on your phone.
3. On the Login screen, tap the **⚙️ Server** button at the bottom.
4. Enter your laptop's IP and port (e.g. `192.168.1.5:8000`).
5. Tap **Save** — the app remembers this even after you close it.

> **Tip:** If you change Wi-Fi networks, just tap the ⚙️ button again and enter the new IP. No need to rebuild the APK!



MIGHT HELP FOR TESTING

FIREWALL - OPEN CMD AS ADMIN:
netsh advfirewall firewall add rule name="Python Uvicorn (Port 8000)" dir=in action=allow protocol=TCP localport=8000


kill all task:
taskkill /F /IM python.exe

taskkill /F /IM python.exe




## APK FILE LINK HERE (USE EVSU ACCOUNT TO ACCESS G-DRIVE)
https://drive.google.com/drive/folders/1vugo-ksZGBacmqmP67hNgMf7QM_44Gan