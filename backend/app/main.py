from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.depots import router as depots_router
from app.api.matrix import router as matrix_router
from app.api.optimize import router as optimize_router
from app.api.orders import router as orders_router
from app.api.predictions import router as predictions_router
from app.api.stops import router as stops_router
from app.api.vehicles import router as vehicles_router
from app.config import settings
from app.services.cache import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialize and tear down shared resources."""
    yield
    await close_redis()


app = FastAPI(
    title="TakumiRoute Backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Security rationale: CORS locked to known frontend origin with explicit
# methods and headers — never use wildcards in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def security_headers_middleware(
    request: Request,
    call_next: Any,
) -> Response:
    """Inject security headers into every response."""
    response: Response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "geolocation=(), camera=(), microphone=()"
    )
    if "server" in response.headers:
        del response.headers["server"]
    return response


@app.get("/health")
@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Liveness probe endpoint."""
    return {"status": "ok", "service": "takumiroute-backend"}


app.include_router(auth_router)
app.include_router(depots_router)
app.include_router(matrix_router)
app.include_router(orders_router)
app.include_router(optimize_router)
app.include_router(predictions_router)
app.include_router(stops_router)
app.include_router(vehicles_router)
