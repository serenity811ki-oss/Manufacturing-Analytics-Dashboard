Mock API for dashboard preview

This tiny FastAPI app provides sample JSON endpoints the frontend can fetch.

Run locally:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 9000
```

Endpoints:
- `GET /api/dashboard/kpi-summary` — current KPIs
- `GET /api/dashboard/production-trend?points=12` — recent throughput labels + values
- `GET /api/dashboard/oee-history?days=7` — daily OEE history

New machine endpoints:
- `GET /api/machines` — list machines with light KPIs and status
- `GET /api/machines/{machine_id}` — detailed machine data, sensors and 24h production

- `GET /api/machines/{machine_id}/alerts` — recent alerts for the machine (id, timestamp, severity, message, ack)

Example curl:

```bash
curl http://localhost:9000/api/dashboard/kpi-summary
curl http://localhost:9000/api/dashboard/production-trend
```

To wire the frontend to this mock, change the fetch URL in `index.html` JS (or set `window.MAP_API_BASE`).

Examples for machines:

```bash
curl http://localhost:9000/api/machines
curl http://localhost:9000/api/machines/1
curl http://localhost:9000/api/machines/1/alerts
curl http://localhost:9000/api/alerts

Acknowledging alerts (mock):

```bash
curl -X POST http://localhost:9000/api/machines/1/alerts/1-0-123/ack
```

`/api/alerts` supports filtering and pagination via query params: `limit`, `offset`, `severity` (info|warning|critical), `machine_id`.
Example: `http://localhost:9000/api/alerts?limit=20&offset=10&severity=critical`

Creating alerts (persisted in-memory while server runs):

```bash
curl -X POST http://localhost:9000/api/alerts -H "Content-Type: application/json" -d '{"machine_id":1,"severity":"warning","message":"Manual test alert"}'
```

The created alert will appear in `/api/alerts` and `/api/machines/{id}/alerts` until the server restarts.

Email notifications
-------------------

When an alert is created via `POST /api/alerts` the mock server will attempt to notify a recipient email.

- By default alerts are written to `mock-api/outbox.log` and the recipient defaults to `stephen.kiss.business@gmail.com`.
- To enable real SMTP sending, set the following environment variables before starting the server:

```powershell
set SMTP_HOST=smtp.example.com
set SMTP_PORT=587
set SMTP_USER=you@example.com
set SMTP_PASS=yourpassword
set SMTP_FROM="SQL Manufacturing <no-reply@example.com>"
set SMTP_TLS=1
set ALERT_EMAIL=stephen.kiss.business@gmail.com
```

If SMTP is configured the server will try to send the message; on failure it falls back to appending to `mock-api/outbox.log`.
```
