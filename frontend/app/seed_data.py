"""
Seeds the database with realistic sample manufacturing data:
  - 3 users (admin / manager / technician)
  - 3 shifts
  - 4 production lines, 12 machines (CNC, robotic welding cells, presses, conveyors)
  - 90 days of production records
  - downtime events across categories
  - maintenance history (preventive/corrective/predictive)
  - quality/scrap records

Run with:  python -m app.seed_data
"""
import random
from datetime import datetime, timedelta

from app.database import SessionLocal, engine, Base
from app import models, auth

random.seed(42)

Base.metadata.create_all(bind=engine)
db = SessionLocal()

MACHINE_TYPES = [
    ("CNC Mill", "Haas", "VF-4SS"),
    ("CNC Lathe", "Mazak", "QT-250"),
    ("Robotic Welding Cell", "Yaskawa Motoman", "GP25-12"),
    ("Robotic Welding Cell", "Yaskawa Motoman", "AR1730"),
    ("Stamping Press", "Schuler", "MSP 400"),
    ("Injection Molding", "Engel", "e-motion 310"),
    ("Conveyor System", "Dorner", "2200 Series"),
    ("Vision Inspection", "Cognex", "In-Sight 9902"),
]


def seed():
    if db.query(models.User).first():
        print("Database already seeded. Skipping.")
        return

    # --- Users -------------------------------------------------------
    users = [
        models.User(username="admin", email="admin@plant.local", full_name="Alex Rivera",
                    role=models.UserRole.ADMIN, hashed_password=auth.hash_password("Admin123!")),
        models.User(username="manager", email="manager@plant.local", full_name="Jordan Lee",
                    role=models.UserRole.MANAGER, hashed_password=auth.hash_password("Manager123!")),
        models.User(username="technician", email="tech@plant.local", full_name="Sam Okafor",
                    role=models.UserRole.TECHNICIAN, hashed_password=auth.hash_password("Tech123!")),
    ]
    db.add_all(users)
    db.commit()

    # --- Shifts --------------------------------------------------------
    shifts = [
        models.Shift(name=models.ShiftName.DAY, start_time="06:00", end_time="14:00"),
        models.Shift(name=models.ShiftName.EVENING, start_time="14:00", end_time="22:00"),
        models.Shift(name=models.ShiftName.NIGHT, start_time="22:00", end_time="06:00"),
    ]
    db.add_all(shifts)
    db.commit()

    # --- Production Lines & Machines -----------------------------------
    lines = [
        models.ProductionLine(name="Line A — Machining", description="CNC machining cell", location="Bay 1"),
        models.ProductionLine(name="Line B — Welding & Assembly", description="Robotic welding & assembly", location="Bay 2"),
        models.ProductionLine(name="Line C — Forming", description="Stamping & injection molding", location="Bay 3"),
        models.ProductionLine(name="Line D — Packaging", description="Conveyor & inspection", location="Bay 4"),
    ]
    db.add_all(lines)
    db.commit()

    machines = []
    for i in range(12):
        mtype, mfr, model = MACHINE_TYPES[i % len(MACHINE_TYPES)]
        line = lines[i % len(lines)]
        m = models.Machine(
            asset_tag=f"MC-{1000 + i}",
            name=f"{mtype} {i + 1}",
            machine_type=mtype,
            manufacturer=mfr,
            model_number=model,
            production_line_id=line.id,
            status=random.choice(list(models.MachineStatus)),
            ideal_cycle_time_seconds=random.uniform(15, 60),
            installation_date=datetime.utcnow() - timedelta(days=random.randint(200, 1800)),
        )
        machines.append(m)
    db.add_all(machines)
    db.commit()

    # --- Production Records (90 days x 3 shifts x machines) ------------
    prod_records = []
    downtime_events = []
    quality_records = []

    today = datetime.utcnow()
    for day_offset in range(90):
        day = today - timedelta(days=day_offset)
        for machine in machines:
            for shift in shifts:
                target = random.randint(400, 900)
                produced = int(target * random.uniform(0.75, 1.05))
                rejected = int(produced * random.uniform(0.01, 0.08))
                pr = models.ProductionRecord(
                    machine_id=machine.id,
                    shift_id=shift.id,
                    production_date=day,
                    planned_production_time_minutes=480,
                    units_produced=produced,
                    units_rejected=rejected,
                    target_units=target,
                    operator_name=random.choice(["M. Torres", "R. Kim", "J. Novak", "P. Singh", "L. Dubois"]),
                )
                prod_records.append(pr)

                # Occasional downtime event
                if random.random() < 0.18:
                    start = day.replace(hour=random.randint(0, 20), minute=random.choice([0, 15, 30, 45]))
                    dur = random.uniform(10, 180)
                    end = start + timedelta(minutes=dur)
                    downtime_events.append(models.DowntimeEvent(
                        machine_id=machine.id,
                        shift_id=shift.id,
                        category=random.choice(list(models.DowntimeCategory)),
                        reason=random.choice([
                            "Unexpected spindle fault", "Waiting on raw material",
                            "Tooling changeover", "Sensor misalignment",
                            "Scheduled PM window", "Operator break", "Quality hold - dimensional",
                        ]),
                        start_time=start,
                        end_time=end,
                        duration_minutes=round(dur, 1),
                        reported_by=random.choice(["M. Torres", "R. Kim", "Sam Okafor"]),
                        resolved=True,
                    ))

                # Occasional quality/scrap record
                if random.random() < 0.12 and rejected > 0:
                    quality_records.append(models.QualityRecord(
                        machine_id=machine.id,
                        inspection_date=day,
                        defect_type=random.choice([
                            "Dimensional out-of-tolerance", "Surface finish defect",
                            "Weld porosity", "Warping", "Incomplete fill", "Contamination",
                        ]),
                        severity=random.choice(list(models.DefectSeverity)),
                        quantity_scrapped=max(rejected - random.randint(0, 3), 0),
                        quantity_reworked=random.randint(0, 3),
                        root_cause=random.choice([
                            "Tool wear", "Material variation", "Process drift",
                            "Fixture misalignment", "Operator error",
                        ]),
                        inspector_name=random.choice(["QC - D. Alvarez", "QC - T. Nguyen"]),
                    ))

    db.add_all(prod_records)
    db.add_all(downtime_events)
    db.add_all(quality_records)
    db.commit()

    # --- Maintenance History --------------------------------------------
    technician = db.query(models.User).filter(models.User.username == "technician").first()
    maint_records = []
    for machine in machines:
        for _ in range(random.randint(3, 8)):
            days_ago = random.randint(1, 180)
            sched = today - timedelta(days=days_ago)
            m_type = random.choice(list(models.MaintenanceType))
            status_choice = random.choice(list(models.MaintenanceStatus))
            start = sched if status_choice != models.MaintenanceStatus.SCHEDULED else None
            end = None
            if status_choice == models.MaintenanceStatus.COMPLETED and start:
                end = start + timedelta(hours=random.uniform(0.5, 6))
            maint_records.append(models.MaintenanceRecord(
                machine_id=machine.id,
                technician_id=technician.id if technician else None,
                maintenance_type=m_type,
                status=status_choice,
                description=random.choice([
                    "Routine lubrication and belt inspection",
                    "Replace worn bearing assembly",
                    "Calibrate servo motor",
                    "Predictive alert: vibration anomaly detected",
                    "Coolant system flush",
                    "Emergency repair: spindle motor failure",
                    "Firmware / controller update",
                ]),
                scheduled_date=sched,
                start_time=start,
                end_time=end,
                cost=round(random.uniform(120, 4500), 2),
                parts_replaced=random.choice([None, "Bearing", "Belt", "Sensor", "Servo motor", "Coolant filter"]),
                failure_code=random.choice([None, "F-101", "F-204", "F-330", "F-450"]),
            ))
    db.add_all(maint_records)
    db.commit()

    print(f"Seeded: {len(users)} users, {len(lines)} lines, {len(machines)} machines, "
          f"{len(prod_records)} production records, {len(downtime_events)} downtime events, "
          f"{len(maint_records)} maintenance records, {len(quality_records)} quality records.")
    print("\nDemo login credentials:")
    print("  admin       / Admin123!")
    print("  manager     / Manager123!")
    print("  technician  / Tech123!")


if __name__ == "__main__":
    seed()
    db.close()
