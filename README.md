# EES Global Supply Nexus

**Part 1 of the Enterprise Execution Suite**

EES Global Supply Nexus is an interactive supply-chain digital twin for pharmaceutical procurement, supplier intelligence, inventory coverage, logistics risk, quality release, and manufacturing-readiness handoff. The application combines a Three.js command center with a static GitHub Pages frontend, a Railway-hosted FastAPI API, and a reproducible SQLite demo database created from public seed data.

## Highlights

- Interactive 3D supplier network with animated global sourcing routes
- Procurement KPI briefing and purchase-order pipeline
- Supplier quality, delivery, capacity, audit, and commercial scorecards
- Inventory days-of-cover and safety-stock monitoring
- Shipment and sourcing risk simulations
- Purchase requisition approval workflow
- Receiving, quarantine, incoming inspection, and material release
- Batch allocation and manufacturing-readiness handoff
- Defined integration contract for **EES Pharma Process Twin — Part 2**

## Architecture

```text
GitHub Pages / Three.js Command Center
              │
              ▼
     Railway FastAPI REST API
              │
              ▼
   Ephemeral SQLite demo database
              │
              ▼
   backend/data/seed.json
```

The runtime database is intentionally excluded from Git. It is recreated from `data/seed.json` whenever the FastAPI service starts, giving every user a deterministic demonstration environment.

## Run the complete application

Requirements: Python 3.10 or newer.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000
```

Local API health:

```text
http://127.0.0.1:8000/api/health
```

Public API:

```text
https://global-supply-api-production.up.railway.app
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

## Static demonstration

The frontend includes a public JSON fallback for a backend-free preview:

```bash
cd docs
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`. Transactional API actions require the FastAPI service.

## Project structure

```text
architecture/   Integration contracts and workflow documentation
backend/        Railway FastAPI service and self-contained demo seed
frontend/       Editable Three.js frontend source
docs/           GitHub Pages deployment copy
data/           Public deterministic source seed data
```

## Supply-to-production workflow

```text
Supplier Intelligence
→ Requisition Approval
→ Purchase Order / Shipment
→ Receiving & Quarantine
→ Incoming Inspection
→ Material Release
→ Batch Allocation
→ Manufacturing Handoff
→ EES Pharma Process Twin
```

## Simulation scenarios

The command center includes deterministic scenarios for:

- Port congestion
- Incoming quality hold
- Demand surge
- Supplier capacity constraint
- Alternate-source activation

These scenarios are for portfolio demonstration and training; they are not connected to live commercial systems.

## Connected project

**Part 2:** [EES Pharma Process Twin](https://github.com/jd-dev-king/EES-Pharma-Process-Twin)

Part 2 consumes the manufacturing-readiness concept and demonstrates plant execution, warehouse operations, bulk receiving, weighing, mixing, QA, packaging, shipping, PLC/SCADA monitoring, EBR compliance, and the immersive pharmaceutical digital twin.

## Public repository safety

This repository intentionally excludes:

- Runtime SQLite databases
- Virtual environments
- Secrets and local environment files
- Build output and dependency directories
- IDE metadata, caches, logs, and recordings

Review `.gitignore` before adding new files. Never commit production credentials or private supplier data.

## Author

EES Portfolio Universe Exclusive by Jeremiah Lupton (JDL)


## License

Released under the [MIT License](LICENSE).


## Public deployment

- Frontend: https://jd-dev-king.github.io/EES-Global-Supply-Nexus/
- API: https://global-supply-api-production.up.railway.app
- API health: https://global-supply-api-production.up.railway.app/api/health
- Deployment instructions: `architecture/DEPLOYMENT.md`
