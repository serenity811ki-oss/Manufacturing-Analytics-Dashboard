# Manufacturing Analytics Platform
log in code 
Username and Password
Ask 

An enterprise-grade manufacturing analytics system with a FastAPI + PostgreSQL
backend and a responsive Chart.js dashboard — production monitoring, OEE,
predictive maintenance, downtime root-cause analysis, quality/scrap tracking,
and exportable reports.

![stack](https://img.shields.io/badge/backend-FastAPI-0E7C86) ![stack](https://img.shields.io/badge/db-PostgreSQL-16283B) ![stack](https://img.shields.io/badge/orm-SQLAlchemy-2C3E50) ![stack](https://img.shields.io/badge/frontend-Chart.js-D98E1F)

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick start (Docker)](#quick-start-docker)
- [Manual setup](#manual-setup)
- [Demo credentials](#demo-credentials)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Analytics formulas](#analytics-formulas)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)

---

## Features

**Access control**
- JWT authentication, bcrypt password hashing
- Role-based access: **Admin** (full control), **Manager** (create/edit operational data), **Technician** (log production/downtime/maintenance)

**Manufacturing modules**
- Production Dashboard — live KPIs, trends, machine status, alerts
- Machine Performance Monitoring — top/bottom performers, utilization
- Overall Equipment Effectiveness (OEE) — availability × performance × quality, per machine and plant-wide
- Downtime Analysis — root-cause Pareto by category
- Predictive Maintenance Dashboard — failure-code flags from sensor/vibration-triggered work orders
- Maintenance History — full CRUD on preventive/corrective/predictive/emergency work orders
- Equipment Failure Analysis — MTBF / MTTR by machine
- Production Efficiency Reports — actual vs. target trend, throughput heatmap
- Shift Performance — day/evening/night comparison
- Scrap & Quality Analysis — defect Pareto, severity mix, root cause

**Data & reporting**
- Full CRUD on every entity (machines, lines, production, downtime, maintenance, quality, users)
- Filters: date range, machine, production line, shift, status, full-text search
- Export to CSV, Excel (.xlsx), and a printable PDF OEE summary report

**Engineering**
- Normalized relational schema with FKs and indexes on every join path
- Parameterized queries throughout (SQLAlchemy ORM — no raw string interpolation)
- Responsive UI (desktop / tablet / mobile), blue-gray industrial theme
- Dockerized, single `docker-compose up` to a working Postgres-backed instance

---

## Architecture

```
┌─────────────────────┐        JWT Bearer         ┌──────────────────────────┐
│  Frontend (static)  │ ─────────────────────────► │  FastAPI backend         │
│  HTML/CSS/JS +       │ ◄───────────────────────── │  SQLAlchemy ORM          │
│  Chart.js            │        JSON / CSV / XLSX /  │  PostgreSQL              │
└─────────────────────┘        PDF                  └──────────────────────────┘
```

The frontend is a static, build-free single-page app (no bundler required) —
deployable to GitHub Pages, Netlify, or any static host. The backend is a
standard FastAPI service deployable to Render, Railway, Fly.io, or any
container platform. `app/main.py` also optionally serves the frontend
directory directly for single-container deployments.

---

## Quick start (Docker)

```bash
git clone <this-repo>
cd manufacturing-analytics-platform
docker compose up --build
```

This starts PostgreSQL, seeds it with 90 days of sample manufacturing data,
and launches the API on **http://localhost:8000**. Open
`frontend/index.html` in a browser (or serve it with any static server) —
it talks to the API at the same origin by default.

Interactive API docs: **http://localhost:8000/docs**

---

## Manual setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # edit DATABASE_URL / SECRET_KEY as needed
# Defaults to a local SQLite file if DATABASE_URL is unset — zero setup.

python -m app.seed_data           # creates tables + loads sample data
uvicorn app.main:app --reload --port 8000
```

### Frontend

The frontend is plain HTML/CSS/JS — no build step. Either:
- open `frontend/index.html` directly, or
- serve it: `python -m http.server 5500 --directory frontend`

If your frontend and backend run on different origins, set the API base
before the other scripts load:
```html
<script>window.MAP_API_BASE = "https://your-api-host.com";</script>
```
Add this line just above the `<script src="js/api.js">` tag in `index.html`.

---

## Demo credentials

| Role       | Username     | Password      |
|------------|--------------|---------------|
| Admin      | `admin`      | `Admin123!`   |
| Manager    | `manager`    | `Manager123!` |
| Technician | `technician` | `Tech123!`    |

Admin can manage users and delete any record. Manager can create/edit
operational data. Technician can log production, downtime, and maintenance
events. Change these before any non-local deployment.

---

## Project structure

```
manufacturing-analytics-platform/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, router wiring, CORS
│   │   ├── database.py          # SQLAlchemy engine/session
│   │   ├── models.py            # ORM models (normalized schema)
│   │   ├── schemas.py           # Pydantic request/response contracts
│   │   ├── auth.py              # JWT, password hashing, role guards
│   │   ├── analytics.py         # OEE / MTBF / MTTR / Pareto / trends
│   │   ├── seed_data.py         # sample data generator
│   │   └── routers/             # one router per resource + dashboard + reports
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js               # fetch wrapper + auth/session
│       ├── charts.js            # Chart.js theme + factory helpers
│       ├── crud.js              # generic CRUD table/modal component
│       ├── views.js             # per-view HTML templates
│       ├── renderers.js         # per-view data loading/binding
│       └── app.js               # routing, filters, bootstrap
├── docker-compose.yml
└── README.md
```

---

## API overview

All endpoints are under `/api` and require `Authorization: Bearer <token>`
except `/api/auth/login` and `/api/health`. Full interactive schema at `/docs`.

| Area          | Endpoint                                | Notes                          |
|---------------|------------------------------------------|---------------------------------|
| Auth          | `POST /api/auth/login`                  | OAuth2 form body → JWT          |
| Auth          | `GET /api/auth/me`                      | current user                    |
| Users         | `/api/users`                            | Admin only                      |
| Lines         | `/api/production-lines`                 | CRUD                             |
| Machines      | `/api/machines`                         | CRUD, filter by line/status/search |
| Production    | `/api/production-records`               | CRUD, filter by machine/shift/date |
| Downtime      | `/api/downtime-events`                  | CRUD, auto-computes duration    |
| Maintenance   | `/api/maintenance-records`              | CRUD, all 4 maintenance types    |
| Quality       | `/api/quality-records`                  | CRUD                             |
| Dashboard     | `/api/dashboard/kpi-summary`            | plant-wide KPI roll-up          |
| Dashboard     | `/api/dashboard/oee`                    | per-machine or plant-wide        |
| Dashboard     | `/api/dashboard/mtbf-mttr`              | reliability metrics              |
| Dashboard     | `/api/dashboard/downtime-pareto`        | root-cause ranking               |
| Dashboard     | `/api/dashboard/production-trend`       | day/week/month/year granularity  |
| Reports       | `/api/reports/export/csv/{dataset}`     | production/downtime/maintenance/quality |
| Reports       | `/api/reports/export/excel/{dataset}`   | same datasets, styled .xlsx      |
| Reports       | `/api/reports/export/pdf/oee-summary`   | printable plant OEE report       |

---

## Analytics formulas

Aligned with SEMI E10 / ISO 22400 conventions:

```
Availability = Run Time / Planned Production Time
Performance  = (Ideal Cycle Time × Units Produced) / Run Time
Quality      = Good Units / Total Units Produced
OEE          = Availability × Performance × Quality

MTBF = Total Uptime / Number of Failures
MTTR = Total Repair Time / Number of Repairs
```

World-class OEE benchmark is commonly cited as ~85%; the dashboard surfaces
this as a reference point on the OEE view.

---

## Deployment

**Frontend → GitHub Pages**
Push the `frontend/` directory to a `gh-pages` branch (or use the Pages
"deploy from folder" setting), and set `window.MAP_API_BASE` to your
deployed backend URL.

**Backend → Render / Railway / Fly.io**
1. Push this repo to GitHub.
2. Create a PostgreSQL instance on your platform of choice and copy its
   connection string into `DATABASE_URL`.
3. Deploy `backend/` as a Docker service (uses the included `Dockerfile`)
   or as a native Python service with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. Set `SECRET_KEY` to a long random value and `CORS_ORIGINS` to your
   frontend's origin.
5. Run `python -m app.seed_data` once (or via a one-off shell/job) to load
   sample data, or start entering real plant data via the UI.

---

## Environment variables

See `backend/.env.example`:

| Variable                     | Default (dev)                                            | Notes                          |
|-------------------------------|-----------------------------------------------------------|----------------------------------|
| `DATABASE_URL`                | `sqlite:///./manufacturing.db`                            | set to a `postgresql+psycopg2://…` URL in production |
| `SECRET_KEY`                  | placeholder                                                | **must** be changed in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480`                                                      | JWT lifetime                    |
| `CORS_ORIGINS`                | `*`                                                         | comma-separated allowed origins |

---

## License

MIT — see `LICENSE`.
