# ============================================================
# TakumiRoute — Makefile
# ============================================================
.DEFAULT_GOAL := help

# --- Docker ---
.PHONY: up down restart logs

up: ## Boot all services (except OSRM)
	docker compose up --build -d

up-routing: ## Boot all services including OSRM
	docker compose --profile routing up --build -d

down: ## Stop all services
	docker compose --profile routing down

restart: ## Restart all services
	docker compose restart

logs: ## Tail logs from all services
	docker compose logs -f

# --- Development ---
.PHONY: shell-backend shell-frontend

shell-backend: ## Open a shell in the backend container
	docker compose exec backend bash

shell-frontend: ## Open a shell in the frontend container
	docker compose exec frontend sh

# --- Database ---
.PHONY: migrate seed

migrate: ## Run Alembic migrations
	docker compose exec backend alembic upgrade head

seed: ## Generate synthetic data and seed the database
	docker compose exec backend python -m app.synthetic.generate $(if $(SEED),--seed $(SEED),)

# --- Testing ---
.PHONY: test test-backend test-frontend

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	docker compose exec backend python -m pytest -v

test-frontend: ## Run frontend tests
	docker compose exec frontend npm test

# --- Linting ---
.PHONY: lint lint-backend lint-frontend format

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint backend code
	docker compose exec backend python -m ruff check app/ tests/
	docker compose exec backend python -m mypy app/

lint-frontend: ## Lint frontend code
	docker compose exec frontend npm run lint

format: ## Auto-format all code
	docker compose exec backend python -m ruff format app/ tests/
	docker compose exec backend python -m black app/ tests/
	docker compose exec frontend npm run format

# --- Security ---
.PHONY: security

security: ## Run all security scans
	docker compose exec backend pip-audit
	docker compose exec backend python -m bandit -r app/ -c pyproject.toml
	docker compose exec frontend npm audit --omit=dev
	@echo "Run 'pre-commit run gitleaks --all-files' separately for secret scanning"

# --- Help ---
.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
