from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.agent import router as agent_router
from app.api.auth import router as auth_router
from app.api.depots import router as depots_router
from app.api.matrix import router as matrix_router
from app.api.optimize import router as optimize_router
from app.api.orders import router as orders_router
from app.api.predictions import router as predictions_router
from app.api.simulation import router as simulation_router
from app.api.stops import router as stops_router
from app.api.vehicles import router as vehicles_router
from app.api.ws import router as ws_router
from app.config import settings
from app.observability import configure_logging, get_logger, init_sentry
from app.security.ratelimit import limiter
from app.services.cache import close_redis

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialize and tear down shared resources."""
    configure_logging()
    init_sentry()
    logger.info("startup", environment=settings.ENVIRONMENT)
    yield
    await close_redis()


app = FastAPI(
    title="TakumiRoute Backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Rate limiting (slowapi) — limiter lives on app.state; per-route limits are
# applied via @limiter.limit on auth and expensive endpoints (§13.8).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

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
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if "server" in response.headers:
        del response.headers["server"]
    return response


@app.middleware("http")
async def body_size_limit_middleware(
    request: Request,
    call_next: Any,
) -> Response:
    """Reject oversized request bodies before they are read (§13.4)."""
    content_length = request.headers.get("content-length")
    if (
        content_length is not None
        and content_length.isdigit()
        and int(content_length) > settings.MAX_REQUEST_BODY_BYTES
    ):
        return JSONResponse(
            status_code=413,  # Content Too Large
            content={"detail": "Request body too large"},
        )
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Return a generic error to clients; log full detail server-side (§13.15)."""
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error_type=type(exc).__name__,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Liveness probe endpoint."""
    return {"status": "ok", "service": "takumiroute-backend"}


app.include_router(agent_router)
app.include_router(auth_router)
app.include_router(depots_router)
app.include_router(matrix_router)
app.include_router(orders_router)
app.include_router(optimize_router)
app.include_router(predictions_router)
app.include_router(simulation_router)
app.include_router(stops_router)
app.include_router(vehicles_router)
app.include_router(ws_router)
