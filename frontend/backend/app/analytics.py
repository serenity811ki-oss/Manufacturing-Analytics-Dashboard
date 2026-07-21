"""
Manufacturing analytics engine.

Implements the standard formulas used across the industry (aligned with
SEMI E10 / ISO 22400 definitions):

  Availability = Run Time / Planned Production Time
  Performance  = (Ideal Cycle Time * Units Produced) / Run Time
  Quality      = Good Units / Total Units Produced
  OEE          = Availability * Performance * Quality

  MTBF (Mean Time Between Failures) = Total Uptime / Number of Failures
  MTTR (Mean Time To Repair)        = Total Repair Time / Number of Repairs

All functions take a SQLAlchemy Session and return plain dicts/lists so
they can be reused by both the REST routers and the export/report layer.
"""
from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models


def _date_filtered(query, model_date_col, start: Optional[datetime], end: Optional[datetime]):
    if start:
        query = query.filter(model_date_col >= start)
    if end:
        query = query.filter(model_date_col <= end)
    return query


def compute_oee_for_machine(db: Session, machine: models.Machine,
                             start: Optional[datetime] = None,
                             end: Optional[datetime] = None) -> Dict:
    prod_q = db.query(models.ProductionRecord).filter(models.ProductionRecord.machine_id == machine.id)
    prod_q = _date_filtered(prod_q, models.ProductionRecord.production_date, start, end)
    records = prod_q.all()

    planned_time = sum(r.planned_production_time_minutes for r in records)
    units_produced = sum(r.units_produced for r in records)
    units_rejected = sum(r.units_rejected for r in records)

    down_q = db.query(models.DowntimeEvent).filter(models.DowntimeEvent.machine_id == machine.id)
    down_q = _date_filtered(down_q, models.DowntimeEvent.start_time, start, end)
    downtime_minutes = sum((d.duration_minutes or 0) for d in down_q.all())

    run_time = max(planned_time - downtime_minutes, 0.0)

    availability = (run_time / planned_time) if planned_time > 0 else 0.0
    ideal_cycle_min = machine.ideal_cycle_time_seconds / 60.0
    performance = (ideal_cycle_min * units_produced / run_time) if run_time > 0 else 0.0
    performance = min(performance, 1.0)  # cap at 100% - guards against bad data
    good_units = max(units_produced - units_rejected, 0)
    quality = (good_units / units_produced) if units_produced > 0 else 0.0

    availability = min(max(availability, 0.0), 1.0)
    quality = min(max(quality, 0.0), 1.0)

    oee = availability * performance * quality

    return {
        "machine_id": machine.id,
        "machine_name": machine.name,
        "availability": round(availability * 100, 2),
        "performance": round(performance * 100, 2),
        "quality": round(quality * 100, 2),
        "oee": round(oee * 100, 2),
        "units_produced": units_produced,
        "units_rejected": units_rejected,
        "downtime_minutes": round(downtime_minutes, 1),
        "planned_time_minutes": round(planned_time, 1),
    }


def compute_oee_all_machines(db: Session, start: Optional[datetime] = None,
                              end: Optional[datetime] = None) -> List[Dict]:
    machines = db.query(models.Machine).filter(models.Machine.is_active == True).all()  # noqa: E712
    return [compute_oee_for_machine(db, m, start, end) for m in machines]


def compute_mtbf_mttr(db: Session, machine_id: Optional[int] = None,
                       start: Optional[datetime] = None, end: Optional[datetime] = None) -> Dict:
    """
    MTBF = total operating (uptime) hours / number of failure events
    MTTR = total repair hours / number of completed corrective/emergency maintenance events
    """
    maint_q = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.maintenance_type.in_(
            [models.MaintenanceType.CORRECTIVE, models.MaintenanceType.EMERGENCY]
        ),
        models.MaintenanceRecord.status == models.MaintenanceStatus.COMPLETED,
    )
    if machine_id:
        maint_q = maint_q.filter(models.MaintenanceRecord.machine_id == machine_id)
    maint_q = _date_filtered(maint_q, models.MaintenanceRecord.scheduled_date, start, end)
    failures = maint_q.all()

    n_failures = len(failures)
    total_repair_hours = 0.0
    for f in failures:
        if f.start_time and f.end_time:
            total_repair_hours += (f.end_time - f.start_time).total_seconds() / 3600.0

    mttr_hours = (total_repair_hours / n_failures) if n_failures > 0 else 0.0

    # Approximate uptime window from planned production time in production records
    prod_q = db.query(models.ProductionRecord)
    if machine_id:
        prod_q = prod_q.filter(models.ProductionRecord.machine_id == machine_id)
    prod_q = _date_filtered(prod_q, models.ProductionRecord.production_date, start, end)
    total_planned_hours = sum(r.planned_production_time_minutes for r in prod_q.all()) / 60.0
    total_uptime_hours = max(total_planned_hours - total_repair_hours, 0.0)

    mtbf_hours = (total_uptime_hours / n_failures) if n_failures > 0 else total_uptime_hours

    return {
        "machine_id": machine_id,
        "failure_count": n_failures,
        "mtbf_hours": round(mtbf_hours, 2),
        "mttr_hours": round(mttr_hours, 2),
        "total_repair_hours": round(total_repair_hours, 2),
    }


def downtime_pareto(db: Session, start: Optional[datetime] = None, end: Optional[datetime] = None,
                     machine_id: Optional[int] = None) -> List[Dict]:
    """Root-cause analysis: total downtime minutes grouped by category, descending."""
    q = db.query(
        models.DowntimeEvent.category,
        func.sum(models.DowntimeEvent.duration_minutes).label("total_minutes"),
        func.count(models.DowntimeEvent.id).label("event_count"),
    )
    q = _date_filtered(q, models.DowntimeEvent.start_time, start, end)
    if machine_id:
        q = q.filter(models.DowntimeEvent.machine_id == machine_id)
    q = q.group_by(models.DowntimeEvent.category).order_by(func.sum(models.DowntimeEvent.duration_minutes).desc())

    return [
        {"category": row.category.value, "total_minutes": round(row.total_minutes or 0, 1), "event_count": row.event_count}
        for row in q.all()
    ]


def shift_performance(db: Session, start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[Dict]:
    q = db.query(
        models.Shift.name,
        func.sum(models.ProductionRecord.units_produced).label("units_produced"),
        func.sum(models.ProductionRecord.units_rejected).label("units_rejected"),
        func.avg(models.ProductionRecord.units_produced).label("avg_units"),
    ).join(models.ProductionRecord, models.ProductionRecord.shift_id == models.Shift.id)
    q = _date_filtered(q, models.ProductionRecord.production_date, start, end)
    q = q.group_by(models.Shift.name)

    return [
        {
            "shift": row.name.value,
            "units_produced": int(row.units_produced or 0),
            "units_rejected": int(row.units_rejected or 0),
            "avg_units_per_record": round(row.avg_units or 0, 1),
        }
        for row in q.all()
    ]


def scrap_quality_summary(db: Session, start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[Dict]:
    q = db.query(
        models.QualityRecord.defect_type,
        models.QualityRecord.severity,
        func.sum(models.QualityRecord.quantity_scrapped).label("scrapped"),
        func.sum(models.QualityRecord.quantity_reworked).label("reworked"),
        func.count(models.QualityRecord.id).label("event_count"),
    )
    q = _date_filtered(q, models.QualityRecord.inspection_date, start, end)
    q = q.group_by(models.QualityRecord.defect_type, models.QualityRecord.severity)
    q = q.order_by(func.sum(models.QualityRecord.quantity_scrapped).desc())

    return [
        {
            "defect_type": row.defect_type,
            "severity": row.severity.value,
            "quantity_scrapped": int(row.scrapped or 0),
            "quantity_reworked": int(row.reworked or 0),
            "event_count": row.event_count,
        }
        for row in q.all()
    ]


def production_trend(db: Session, granularity: str = "day",
                      start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[Dict]:
    """Daily/weekly/monthly production trend using DB-agnostic date bucketing (Python-side)."""
    q = db.query(models.ProductionRecord)
    q = _date_filtered(q, models.ProductionRecord.production_date, start, end)
    records = q.order_by(models.ProductionRecord.production_date).all()

    buckets: Dict[str, Dict] = {}
    for r in records:
        d = r.production_date
        if granularity == "day":
            key = d.strftime("%Y-%m-%d")
        elif granularity == "week":
            key = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
        elif granularity == "month":
            key = d.strftime("%Y-%m")
        else:  # year
            key = d.strftime("%Y")
        b = buckets.setdefault(key, {"period": key, "units_produced": 0, "units_rejected": 0, "target_units": 0})
        b["units_produced"] += r.units_produced
        b["units_rejected"] += r.units_rejected
        b["target_units"] += r.target_units

    return list(buckets.values())


def equipment_utilization(db: Session, start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[Dict]:
    machines = db.query(models.Machine).filter(models.Machine.is_active == True).all()  # noqa: E712
    results = []
    for m in machines:
        oee_data = compute_oee_for_machine(db, m, start, end)
        results.append({
            "machine_id": m.id,
            "machine_name": m.name,
            "status": m.status.value,
            "utilization_pct": oee_data["availability"],
            "throughput": oee_data["units_produced"],
        })
    return sorted(results, key=lambda x: x["utilization_pct"], reverse=True)
