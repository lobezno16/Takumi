# TakumiRoute 匠ルート

> **First-attempt delivery optimization for Japan's last-mile logistics**

## The Problem: Japan's 2024 Logistics Crisis

From April 2024, Japanese truck-driver overtime is capped at 960 hours/year. With over 90% of domestic freight on roads and an aging driver workforce, the government projects a **~14% transport-capacity shortfall in 2024** rising to **~34% by 2030** ([Ministry of Land, Infrastructure, Transport and Tourism](https://www.mlit.go.jp/)).

Inside this, **~8–9% of parcels still require redelivery (再配達)** because no one is home on the first attempt — each failure burns scarce driver-hours, adds CO₂, and compounds the capacity gap.

The industry is fragmented: most carriers are sub-10-person SMEs with no routing software. **TakumiRoute targets that gap: get the delivery right the first time.**

## What It Does (Three Pillars + Proof Harness)

1. **Availability Prediction (ML):** Calibrated LightGBM model predicts the probability a recipient is home in each candidate time slot.

2. **Prize-Collecting VRPTW Optimizer (OR — the moat):** Jointly chooses each stop's delivery slot *and* vehicle routes to maximize expected first-attempt successes minus driver-time cost, under shift-hour and capacity constraints.

3. **Agentic Coordination:** A constrained tool-use agent that confirms/adjusts windows with recipients and triggers live re-optimization when reality shifts.

4. **Simulation Harness (demo centerpiece):** Runs a synthetic delivery day for Kōtō-ku (江東区), Tokyo — **baseline carrier vs TakumiRoute** — and reports redelivery rate, driver-hours saved, and CO₂ proxy.

**Primary metric:** Redelivery rate dropping from ~8–9% baseline toward low single digits, with driver-seconds-per-route falling, on the same dataset.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Vite + TS)                             │
│  deck.gl live map · baseline-vs-engine split · run dashboard │
└───────────────┬───────────────────────────────┬──────────────┘
                │ REST (TanStack Query)         │ WebSocket
┌───────────────▼───────────────────────────────▼──────────────┐
│  Backend API (FastAPI, async)                                │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────┐ │
│  │  ML svc  │ │ Optimizer svc│ │ Sim engine │ │ Agent svc │ │
│  │ LightGBM │ │  OR-Tools /  │ │ baseline + │ │ tool-use  │ │
│  │ (home p) │ │  PyVRP bench │ │ takumi     │ │ loop      │ │
│  └────┬─────┘ └──────┬───────┘ └─────┬──────┘ └─────┬─────┘ │
└───────┼──────────────┼───────────────┼───────────────┼───────┘
        │              │               │               │
        │        ┌─────▼──────┐        │        ┌──────▼─────┐
        │        │   OSRM     │        │        │   Redis    │
        │        │ (OSM road) │        │        │ queue/state│
        │        └────────────┘        │        └────────────┘
        └────────────────┬─────────────┘
                ┌────────▼───────────┐
                │ PostgreSQL+PostGIS │
                └────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript (strict), Tailwind CSS v4, shadcn/ui, TanStack Query, Zustand, deck.gl + MapLibre GL |
| Backend | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.x (async), Alembic, Pydantic v2 |
| Optimizer | Google OR-Tools (prize-collecting VRPTW), PyVRP (benchmark) |
| ML | LightGBM with probability calibration, scikit-learn, pandas |
| Geospatial | PostgreSQL 16 + PostGIS 3.4, OSRM (self-hosted) |
| Agent | Anthropic SDK (constrained tool-use loop), Redis |
| Infra | Docker Compose, Sentry, structlog |

## Quick Start

```bash
# 1. Clone and configure
git clone <repo-url>
cd takumiroute
cp .env.example .env
# Edit .env with your credentials

# 2. Boot all services
docker compose up --build -d

# 3. Run migrations and seed data
make migrate
make seed

# 4. Open the frontend
open http://localhost:5173
```

> **Note:** OSRM requires a built routing graph. After Phase 2 setup:
> ```bash
> docker compose --profile routing up -d
> ```

## Development

```bash
make help          # Show all available commands
make test          # Run all tests
make lint          # Run all linters
make security      # Run security scans
make logs          # Tail service logs
```

## Security

See the dedicated security section in [SECURITY.md](./SECURITY.md) (added in Phase 11).

**Definition of "all security issues removed":** The codebase produces zero findings from pip-audit, npm audit, bandit, semgrep, eslint-security, and gitleaks, AND every item in the security checklist is verified, AND the security test suite passes. This eliminates common, known vulnerability classes for this stack; it is a rigorous, verifiable bar, not a metaphysical guarantee.

## Production Scale Path

> *The following are described future work, clearly labeled as not-yet-built:*

- **Kubernetes** orchestration with horizontal pod autoscaling
- **Multi-region** deployment with CockroachDB or Neon managed PostgreSQL
- **Multi-tenancy** with RBAC, tenant isolation, org/billing models, and audit at scale
- **cuOpt GPU path** for large-scale route optimization
- **TMS/carrier API integrations** (Delhivery, Sagawa, Yamato)
- **Modal shift to rail** for long-haul segments

## License

Proprietary — Hackathon submission for Logistics & Transit track.
