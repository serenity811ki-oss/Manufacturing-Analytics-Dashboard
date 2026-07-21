from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import uuid
import os
import smtplib
from email.message import EmailMessage
import random

app = FastAPI(title="Mock Dashboard API")

# In-memory alerts store (persists while server runs)
ALERT_STORE = []


def _seed_alerts():
    """Populate ALERT_STORE with some initial synthetic alerts."""
    now = datetime.utcnow()
    severities = ["info", "warning", "critical"]
    messages = [
        "Unplanned stop detected",
        "Temperature above threshold",
        "Vibration spike",
        "Minor quality deviation",
        "Scheduled maintenance due",
    ]
    for mid in range(1, 5):
        for i in range(random.randint(1, 4)):
            minutes_ago = random.randint(1, 60 * 24)
            ALERT_STORE.append({
                "machine_id": mid,
                "id": str(uuid.uuid4()),
                "timestamp": (now - timedelta(minutes=minutes_ago)).isoformat() + "Z",
                "severity": random.choices(severities, weights=[60,30,10])[0],
                "message": random.choice(messages),
                "ack": random.choice([True, False, False]),
            })


# seed once
_seed_alerts()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/dashboard/kpi-summary")
def kpi_summary():
    """Return a small set of KPI values for the dashboard."""
    return {
        "oee": round(80 + random.random() * 8, 1),
        "unitsToday": 18430 + random.randint(0, 400),
        "machinesActive": "11 / 12",
        "openAlerts": random.randint(0, 6),
        "downtimeMin": random.randint(200, 420),
    }


@app.get("/api/dashboard/production-trend")
def production_trend(points: int = 12):
    """Return a small time-series for throughput/production trend."""
    now = datetime.utcnow()
    labels = [
        (now - timedelta(minutes=(points - i) * 10)).strftime("%H:%M") for i in range(points)
    ]
    values = [random.randint(40, 100) for _ in labels]
    return {"labels": labels, "values": values}


@app.get("/api/dashboard/oee-history")
def oee_history(days: int = 7):
    """Return per-day OEE history."""
    labels = [
        (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days - 1, -1, -1)
    ]
    values = [round(72 + random.random() * 14, 1) for _ in labels]
    return {"labels": labels, "values": values}


@app.get("/api/machines")
def machines_list():
    """Return a list of machines with light status and KPIs."""
    machines = []
    for i in range(1, 5):
        machines.append(
            {
                "id": i,
                "name": f"Machine-{i}",
                "status": random.choice(["running", "idle", "maintenance"]),
                "oee": round(65 + random.random() * 30, 1),
                "unitsHour": random.randint(30, 120),
                "lastSeen": (datetime.utcnow() - timedelta(minutes=random.randint(0, 15))).isoformat() + "Z",
                "openAlerts": random.randint(0, 3),
            }
        )

    return {"count": len(machines), "machines": machines}


@app.get("/api/machines/{machine_id}")
def machine_detail(machine_id: int):
    """Return detailed data for a single machine, including recent production and sensor readings."""
    if not (1 <= machine_id <= 4):
        raise HTTPException(status_code=404, detail="Machine not found")

    now = datetime.utcnow()
    # hourly production for last 24 hours
    hourly = [random.randint(20, 140) for _ in range(24)]
    hours = [ (now - timedelta(hours=(23 - i))).strftime("%Y-%m-%dT%H:00") for i in range(24) ]

    sensors = {
        "temperatureC": round(60 + random.random() * 20, 1),
        "vibrationMm": round(random.random() * 3.0, 2),
        "powerKw": round(1 + random.random() * 5, 2),
    }

    detail = {
        "id": machine_id,
        "name": f"Machine-{machine_id}",
        "status": random.choice(["running", "idle", "maintenance"]),
        "oee": round(65 + random.random() * 30, 1),
        "lastMaintenance": (now - timedelta(days=random.randint(1, 90))).strftime("%Y-%m-%d"),
        "sensors": sensors,
        "production": {"labels": hours, "values": hourly},
        "openAlerts": random.randint(0, 4),
    }

    return detail


@app.get("/api/machines/{machine_id}/alerts")
def machine_alerts(machine_id: int, limit: int = 10):
    """Return recent alerts for a machine."""
    if not (1 <= machine_id <= 4):
        raise HTTPException(status_code=404, detail="Machine not found")
    # pull from in-memory store
    items = [a for a in ALERT_STORE if a.get("machine_id") == machine_id]
    items = sorted(items, key=lambda a: a["timestamp"], reverse=True)
    sliced = items[:limit]
    return {"machine_id": machine_id, "count": len(items), "alerts": sliced}


@app.post("/api/machines/{machine_id}/alerts/{alert_id}/ack")
def ack_alert(machine_id: int, alert_id: str):
    """Acknowledge an alert for a machine (mock).

    This endpoint simulates acknowledging an alert; it does not persist state in the mock server.
    Returns a success response and echoes the alert id.
    """
    if not (1 <= machine_id <= 4):
        raise HTTPException(status_code=404, detail="Machine not found")

    # find alert in store and mark ack
    for a in ALERT_STORE:
        if a.get("id") == alert_id and a.get("machine_id") == machine_id:
            a["ack"] = True
            return {"ok": True, "machine_id": machine_id, "alert_id": alert_id, "ack": True}

    raise HTTPException(status_code=404, detail="Alert not found")


@app.get("/api/alerts")
def all_alerts(limit: int = 50, offset: int = 0, severity: str = None, machine_id: int = None):
    """Return recent alerts across all machines (aggregated).

    Supports simple filtering and pagination via query params: `limit`, `offset`, `severity`, `machine_id`.
    This is a mock generator; alerts are synthetic and non-persistent.
    """
    # Use in-memory ALERT_STORE
    items = list(ALERT_STORE)
    # allow filtering
    if severity:
        items = [a for a in items if a.get("severity") == severity]
    if machine_id:
        items = [a for a in items if a.get("machine_id") == machine_id]

    # sort newest first
    items = sorted(items, key=lambda a: a["timestamp"], reverse=True)
    total = len(items)
    sliced = items[offset: offset + limit]
    return {"count": total, "offset": offset, "limit": limit, "alerts": sliced}


@app.post("/api/alerts")
def create_alert(payload: dict):
    """Create a new alert (stored in-memory).

    Expects JSON body with `machine_id` (int), `severity` (info|warning|critical), and `message` (str).
    """
    machine_id = int(payload.get("machine_id", 0))
    severity = payload.get("severity", "info")
    message = payload.get("message", "")

    if not (1 <= machine_id <= 4):
        raise HTTPException(status_code=400, detail="Invalid machine_id")
    if severity not in ("info", "warning", "critical"):
        raise HTTPException(status_code=400, detail="Invalid severity")
    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    now = datetime.utcnow()
    alert = {
        "machine_id": machine_id,
        "id": str(uuid.uuid4()),
        "timestamp": now.isoformat() + "Z",
        "severity": severity,
        "message": message,
        "ack": False,
    }
    ALERT_STORE.append(alert)

    # send email notification (try SMTP if configured, otherwise append to outbox.log)
    alert_recipient = os.environ.get('ALERT_EMAIL', 'stephen.kiss.business@gmail.com')
    subject = f"[Alert] {alert['severity'].upper()} on Machine {alert['machine_id']}"
    body = f"Time: {alert['timestamp']}\nMachine: {alert['machine_id']}\nSeverity: {alert['severity']}\nMessage: {alert['message']}\nAlert ID: {alert['id']}"

    email_result = {"sent": False, "method": None, "info": None}
    smtp_host = os.environ.get('SMTP_HOST')
    if smtp_host:
        try:
            smtp_port = int(os.environ.get('SMTP_PORT', 587))
            smtp_user = os.environ.get('SMTP_USER')
            smtp_pass = os.environ.get('SMTP_PASS')
            use_tls = os.environ.get('SMTP_TLS', '1') != '0'

            msg = EmailMessage()
            msg['Subject'] = subject
            msg['From'] = os.environ.get('SMTP_FROM', smtp_user or f'no-reply@{smtp_host}')
            msg['To'] = alert_recipient
            msg.set_content(body)

            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            if use_tls:
                server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()

            email_result['sent'] = True
            email_result['method'] = 'smtp'
            email_result['info'] = f'sent via {smtp_host}:{smtp_port}'
        except Exception as e:
            email_result['sent'] = False
            email_result['method'] = 'smtp'
            email_result['info'] = str(e)
            # fallback to outbox file
    if not email_result['sent']:
        try:
            outpath = os.path.join(os.path.dirname(__file__), 'outbox.log')
            with open(outpath, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.utcnow().isoformat()} | TO:{alert_recipient} | {subject}\n{body}\n---\n")
            email_result['method'] = email_result['method'] or 'outbox'
            email_result['info'] = email_result['info'] or f'written to {outpath}'
        except Exception as e:
            email_result['info'] = str(e)

    return {"ok": True, "alert": alert, "email": email_result}
