from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import connect, initialize_database

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

app = FastAPI(title="EES Global Supply Nexus API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup() -> None:
    initialize_database()

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "online", "service": "global-supply-nexus"}

@app.get("/api/dashboard")
def dashboard() -> dict:
    with connect() as db:
        suppliers = [dict(row) for row in db.execute("SELECT * FROM suppliers ORDER BY id")]
        shipments = [dict(row) for row in db.execute("SELECT * FROM shipments ORDER BY id")]
        inventory = [dict(row) for row in db.execute("SELECT * FROM inventory ORDER BY id")]
        events = [dict(row) for row in db.execute("SELECT * FROM events ORDER BY id DESC")]
    at_risk = sum(1 for s in shipments if s["status"] in {"At Risk", "Delayed", "Quality Hold", "Capacity Constraint"})
    avg_quality = round(sum(s["quality_score"] for s in suppliers) / len(suppliers), 1)
    avg_delivery = round(sum(s["delivery_score"] for s in suppliers) / len(suppliers), 1)
    return {
        "suppliers": suppliers,
        "shipments": shipments,
        "inventory": inventory,
        "events": events,
        "kpis": {
            "activeSuppliers": len(suppliers),
            "openPurchaseOrders": len(shipments),
            "atRiskShipments": at_risk,
            "supplierQuality": avg_quality,
            "onTimeDelivery": avg_delivery,
            "inventoryCoverage": round(sum(i["days_cover"] for i in inventory) / len(inventory), 1),
        },
    }

@app.get("/api/suppliers/{supplier_id}")
def supplier_detail(supplier_id: int) -> dict:
    with connect() as db:
        supplier = db.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        shipments = [dict(row) for row in db.execute("SELECT * FROM shipments WHERE supplier_id = ?", (supplier_id,))]
    return {"supplier": dict(supplier), "shipments": shipments}


@app.get("/api/workflow")
def workflow() -> dict:
    with connect() as db:
        requisitions = [dict(r) for r in db.execute("SELECT * FROM requisitions ORDER BY id")]
        receipts = [dict(r) for r in db.execute("SELECT * FROM receipts ORDER BY id DESC")]
        inspections = [dict(r) for r in db.execute("SELECT * FROM inspections ORDER BY id DESC")]
        releases = [dict(r) for r in db.execute("SELECT * FROM material_releases ORDER BY id DESC")]
        handoffs = [dict(r) for r in db.execute('SELECT id, handoff_number, batch_number, product, scheduled_start, material_readiness_pct, released_lots, required_lots, status, constraint_text AS "constraint" FROM handoffs ORDER BY scheduled_start')]
    return {"requisitions": requisitions, "receipts": receipts, "inspections": inspections, "releases": releases, "handoffs": handoffs}

@app.post("/api/requisitions/{requisition_id}/approve")
def approve_requisition(requisition_id: int) -> dict:
    with connect() as db:
        row = db.execute("SELECT * FROM requisitions WHERE id = ?", (requisition_id,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="Requisition not found")
        db.execute("UPDATE requisitions SET status = 'Approved' WHERE id = ?", (requisition_id,))
        db.commit()
    return {"status":"Approved", "id":requisition_id}

@app.post("/api/inspections/{inspection_id}/complete")
def complete_inspection(inspection_id: int) -> dict:
    with connect() as db:
        row=db.execute("SELECT * FROM inspections WHERE id=?",(inspection_id,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="Inspection not found")
        if row["disposition"] == "Hold": raise HTTPException(status_code=409, detail="Inspection is blocked by an active quality hold")
        db.execute("UPDATE inspections SET sample_status='Complete', identity_test='Pass', disposition='Approved', completed_at=datetime('now') WHERE id=?",(inspection_id,))
        db.execute("UPDATE receipts SET status='Inspection Complete' WHERE id=?",(row["receipt_id"],))
        db.commit()
    return {"status":"Approved", "id":inspection_id}

@app.post("/api/releases/{release_id}/release")
def release_material(release_id: int) -> dict:
    with connect() as db:
        rel=db.execute("SELECT * FROM material_releases WHERE id=?",(release_id,)).fetchone()
        if not rel: raise HTTPException(status_code=404, detail="Release record not found")
        inspection=db.execute("SELECT * FROM inspections WHERE receipt_id=?",(rel["receipt_id"],)).fetchone()
        receipt=db.execute("SELECT * FROM receipts WHERE id=?",(rel["receipt_id"],)).fetchone()
        if not inspection or inspection["disposition"] != "Approved": raise HTTPException(status_code=409, detail="Material cannot be released until inspection disposition is Approved")
        db.execute("UPDATE material_releases SET released_quantity=?, released_by='Demo Quality Manager', released_at=datetime('now'), status='Released' WHERE id=?",(receipt["quantity_received"],release_id))
        db.execute("UPDATE receipts SET status='Released' WHERE id=?",(rel["receipt_id"],))
        db.commit()
    return {"status":"Released", "id":release_id}

@app.post("/api/simulations/{scenario}")
def simulate(scenario: str) -> dict:
    scenarios = {
        "port-delay": {"headline": "Port congestion detected", "impact": "+4.2 days lead time", "recommendation": "Expedite packaging components through alternate East Coast port."},
        "quality-hold": {"headline": "Incoming lot placed on quality hold", "impact": "Production start at risk", "recommendation": "Allocate approved safety stock and launch supplier deviation review."},
        "demand-surge": {"headline": "Demand forecast increased 22%", "impact": "API coverage falls to 12 days and bottle demand exceeds confirmed supply", "recommendation": "Release secondary-source API order, advance bottle PO-260745, and rebalance the batch schedule."},
        "supplier-capacity": {"headline": "Packaging supplier reaches capacity ceiling", "impact": "Two packaging orders compete for constrained production slots", "recommendation": "Split carton volume with Andes Fiber Packaging and expedite artwork approval."},
        "alternate-source": {"headline": "Primary API source interruption modeled", "impact": "Single-source exposure threatens two scheduled batches", "recommendation": "Accelerate NovaChem qualification lot and reserve approved safety stock for priority batches."},
    }
    if scenario not in scenarios:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"scenario": scenario, **scenarios[scenario]}

app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")
