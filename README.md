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
| Agent | Constrained tool-use loop (deterministic intent parser; Anthropic SDK swap-in), Redis |
| Infra | Docker Compose, Sentry, structlog |

## The OR Core — Prize-Collecting VRPTW

The optimizer is the moat. It jointly chooses, for each stop, **which time
slot to deliver in** and **which vehicle route to use**, to maximize expected
first-attempt successes minus driver-time cost — under capacity, time-window,
and shift-hour limits.

**Objective (maximize expected value):**

```
max  Σ_i Σ_s ( R · p_{i,s} · z_{is} )   −   λ · Σ_k Σ_{ij} t_ij · x_{ijk}
```

- `p_{i,s}` — calibrated ML probability recipient *i* is home in slot *s*
- `z_{is}` — stop *i* assigned slot *s*; `x_{ijk}` — vehicle *k* travels *i→j*
- `R` — reward per first-attempt success; `λ` — driver-second cost weight

**OR-Tools mapping:** each candidate (stop, slot) is an optional node inside a
single `AddDisjunction`, so at most one slot is served per stop and skipping
forfeits its reward. The drop penalty is `round(R · p_{i,s} · SCALE)` — **this
is exactly where the ML probability enters the solver**: higher home-probability
⇒ higher skip penalty ⇒ the solver prefers high-probability slots. A `Time`
dimension enforces slot windows and the shift cap; a `Capacity` dimension
enforces vehicle load. Search uses `GUIDED_LOCAL_SEARCH` with a wall-clock limit.

## How ML Feeds the Optimizer

A LightGBM classifier predicts `was_home` from `(slot, day-of-week,
address-type, floor, historical hit-rate, …)`, then **probability calibration**
(`CalibratedClassifierCV`) makes the scores trustworthy as expected values —
critical, because the optimizer treats `p_{i,s}` as money. The simulation
pre-picks each stop's argmax-predicted slot (the §6.2 fallback) and maps the
probability to the integer disjunction penalty above. Deeper observed history
sharpens the per-slot signal, which is the ML value proposition in one line:
*more data ⇒ better windows ⇒ fewer redeliveries.*

## Solver Benchmark

`POST /api/optimize/benchmark` (and the **Solver Benchmark** tab) solve the
*same* base VRPTW instance with **OR-Tools** and **PyVRP** (a specialised VRP
solver), reporting total route time, fleet size, feasibility, and wall-clock.
On seeded instances both are feasible and OR-Tools matches PyVRP's optimum —
evidence that our routing quality is sound while it also carries the richer
prize-collecting objective.

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

> **Note:** OSRM is optional. With no routing graph the optimizer falls back to
> Haversine travel times, so the full demo runs without it. To use real Tokyo
> road-network times, build the graph and start the routing profile:
> ```bash
> docker compose --profile routing up -d
> ```

## Demo Flow

One-command demo, exactly as the judges run it:

```bash
docker compose up --build -d     # boot postgres, redis, backend, frontend
make migrate && make seed        # apply schema, seed the 5 courier slots
open http://localhost:5173       # register an operator, then sign in
```

1. **Dashboard** — service health + platform capabilities.
2. **Simulation** — run a single day or Monte-Carlo; watch redelivery rate
   drop from a naive baseline toward low single digits, with driver-seconds
   falling. Switch to **Solver Benchmark** for the OR-Tools vs PyVRP table.
3. **Route Map** — generate routes, toggle Baseline ⇄ Takumi, stops colored by
   first-attempt outcome, live redelivery delta.
4. **Agent Console** — message a recipient ("I'm only home after 6pm") and the
   constrained agent confirms the evening slot; try the 🛡️ injection probe and
   watch it take no action; hit **Re-optimize** to push a new route over the
   WebSocket into the live replan feed.

## Screens

> *Add screenshots/GIF of the split-screen map and Agent Console here for the
> submission.* The four views above are served from a single React app
> (sidebar nav): `Dashboard`, `Simulation`, `Route Map`, `Agent Console`.

## Development

```bash
make help          # Show all available commands
make test          # Run all tests
make lint          # Run all linters
make security      # Run security scans
make logs          # Tail service logs
```

## Multi-Tenancy

The platform is **multi-tenant**: each registration provisions its own
`Organization`, and every tenant-owned row (depots, vehicles, stops, orders,
and agent interactions) carries an `organization_id`. All queries are scoped
to the caller's organization, so one carrier can never read or act on
another's data — a cross-tenant read is indistinguishable from a missing
record. Tenant isolation is enforced at the persistence layer and proven by
`tests/security/test_tenant_isolation.py`.

## Security

See the dedicated security section in [SECURITY.md](./SECURITY.md) (added in Phase 11).

**Definition of "all security issues removed":** The codebase produces zero findings from pip-audit, npm audit, bandit, semgrep, eslint-security, and gitleaks, AND every item in the security checklist is verified, AND the security test suite passes. This eliminates common, known vulnerability classes for this stack; it is a rigorous, verifiable bar, not a metaphysical guarantee.

## Production Scale Path

> *The following are described future work, clearly labeled as not-yet-built:*

- **Kubernetes** orchestration with horizontal pod autoscaling
- **Multi-region** deployment with CockroachDB or Neon managed PostgreSQL
- **Tenant features at scale** on top of the built-in multi-tenancy: org billing, SSO/SCIM, cross-org analytics, and per-tenant audit retention
- **cuOpt GPU path** for large-scale route optimization
- **TMS/carrier API integrations** (Delhivery, Sagawa, Yamato)
- **Modal shift to rail** for long-haul segments

## License

Proprietary — Hackathon submission for Logistics & Transit track.
