from __future__ import annotations
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "supply_nexus.db"
SEED_PATH = ROOT / "data" / "seed.json"


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    with connect() as db:
        db.executescript(
            """
            DROP TABLE IF EXISTS shipments;
            DROP TABLE IF EXISTS suppliers;
            DROP TABLE IF EXISTS inventory;
            DROP TABLE IF EXISTS events;
            DROP TABLE IF EXISTS material_releases;
            DROP TABLE IF EXISTS inspections;
            DROP TABLE IF EXISTS receipts;
            DROP TABLE IF EXISTS requisitions;
            DROP TABLE IF EXISTS handoffs;

            CREATE TABLE suppliers (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              city TEXT NOT NULL,
              country TEXT NOT NULL,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              material TEXT NOT NULL,
              quality_score REAL NOT NULL,
              delivery_score REAL NOT NULL,
              risk TEXT NOT NULL,
              status TEXT NOT NULL,
              annual_spend REAL NOT NULL,
              lead_time_days REAL NOT NULL,
              capacity_utilization REAL NOT NULL,
              audit_status TEXT NOT NULL,
              currency TEXT NOT NULL,
              single_source INTEGER NOT NULL
            );
            CREATE TABLE shipments (
              id INTEGER PRIMARY KEY,
              supplier_id INTEGER NOT NULL,
              po_number TEXT NOT NULL,
              material TEXT NOT NULL,
              quantity REAL NOT NULL,
              unit TEXT NOT NULL,
              progress REAL NOT NULL,
              status TEXT NOT NULL,
              eta TEXT NOT NULL,
              route TEXT NOT NULL,
              unit_cost REAL NOT NULL,
              price_variance_pct REAL NOT NULL,
              incoterm TEXT NOT NULL,
              priority TEXT NOT NULL,
              FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            );
            CREATE TABLE inventory (
              id INTEGER PRIMARY KEY,
              material TEXT NOT NULL,
              on_hand REAL NOT NULL,
              safety_stock REAL NOT NULL,
              unit TEXT NOT NULL,
              days_cover REAL NOT NULL,
              status TEXT NOT NULL
            );

            CREATE TABLE requisitions (
              id INTEGER PRIMARY KEY, pr_number TEXT NOT NULL, department TEXT NOT NULL,
              requester TEXT NOT NULL, material TEXT NOT NULL, quantity REAL NOT NULL,
              unit TEXT NOT NULL, needed_by TEXT NOT NULL, priority TEXT NOT NULL,
              status TEXT NOT NULL, budget_code TEXT NOT NULL
            );
            CREATE TABLE receipts (
              id INTEGER PRIMARY KEY, receipt_number TEXT NOT NULL, po_number TEXT NOT NULL,
              supplier_id INTEGER NOT NULL, material TEXT NOT NULL, lot_number TEXT NOT NULL,
              quantity_received REAL NOT NULL, unit TEXT NOT NULL, received_at TEXT NOT NULL,
              warehouse_location TEXT NOT NULL, status TEXT NOT NULL
            );
            CREATE TABLE inspections (
              id INTEGER PRIMARY KEY, receipt_id INTEGER NOT NULL, inspection_number TEXT NOT NULL,
              sample_status TEXT NOT NULL, coa_verified INTEGER NOT NULL, identity_test TEXT NOT NULL,
              visual_result TEXT NOT NULL, disposition TEXT NOT NULL, inspector TEXT NOT NULL,
              completed_at TEXT, notes TEXT NOT NULL
            );
            CREATE TABLE material_releases (
              id INTEGER PRIMARY KEY, receipt_id INTEGER NOT NULL, release_number TEXT NOT NULL,
              released_quantity REAL NOT NULL, unit TEXT NOT NULL, released_by TEXT NOT NULL,
              released_at TEXT, status TEXT NOT NULL, batch_allocation TEXT NOT NULL
            );
            CREATE TABLE handoffs (
              id INTEGER PRIMARY KEY, handoff_number TEXT NOT NULL, batch_number TEXT NOT NULL,
              product TEXT NOT NULL, scheduled_start TEXT NOT NULL, material_readiness_pct REAL NOT NULL,
              released_lots INTEGER NOT NULL, required_lots INTEGER NOT NULL, status TEXT NOT NULL,
              constraint_text TEXT NOT NULL
            );
            CREATE TABLE events (
              id INTEGER PRIMARY KEY,
              severity TEXT NOT NULL,
              title TEXT NOT NULL,
              detail TEXT NOT NULL,
              occurred_at TEXT NOT NULL
            );
            """
        )
        db.executemany(
            "INSERT INTO suppliers VALUES (:id,:name,:city,:country,:latitude,:longitude,:material,:quality_score,:delivery_score,:risk,:status,:annual_spend,:lead_time_days,:capacity_utilization,:audit_status,:currency,:single_source)",
            seed["suppliers"],
        )
        db.executemany(
            "INSERT INTO shipments VALUES (:id,:supplier_id,:po_number,:material,:quantity,:unit,:progress,:status,:eta,:route,:unit_cost,:price_variance_pct,:incoterm,:priority)",
            seed["shipments"],
        )
        db.executemany(
            "INSERT INTO inventory VALUES (:id,:material,:on_hand,:safety_stock,:unit,:days_cover,:status)",
            seed["inventory"],
        )
        db.executemany("INSERT INTO requisitions VALUES (:id,:pr_number,:department,:requester,:material,:quantity,:unit,:needed_by,:priority,:status,:budget_code)", seed["requisitions"])
        db.executemany("INSERT INTO receipts VALUES (:id,:receipt_number,:po_number,:supplier_id,:material,:lot_number,:quantity_received,:unit,:received_at,:warehouse_location,:status)", seed["receipts"])
        db.executemany("INSERT INTO inspections VALUES (:id,:receipt_id,:inspection_number,:sample_status,:coa_verified,:identity_test,:visual_result,:disposition,:inspector,:completed_at,:notes)", seed["inspections"])
        db.executemany("INSERT INTO material_releases VALUES (:id,:receipt_id,:release_number,:released_quantity,:unit,:released_by,:released_at,:status,:batch_allocation)", seed["material_releases"])
        db.executemany("INSERT INTO handoffs VALUES (:id,:handoff_number,:batch_number,:product,:scheduled_start,:material_readiness_pct,:released_lots,:required_lots,:status,:constraint)", seed["handoffs"])
        db.executemany(
            "INSERT INTO events VALUES (:id,:severity,:title,:detail,:occurred_at)", seed["events"]
        )
