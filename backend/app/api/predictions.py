"""API router for ML predictions — home probabilities and candidate slots."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SlotCode
from app.models.user import User
from app.security.deps import get_current_user
from app.services.ml.predict import (
    predict_candidate_slots,
    predict_for_stop,
    train_on_synthetic_data,
)

router = APIRouter(prefix="/api/ml", tags=["ml"])


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    address_type: str = Field(pattern="^(apartment|house)$")
    floor: int | None = Field(default=None, ge=0, le=100)
    slot_code: SlotCode
    day_of_week: int = Field(ge=0, le=6)


class PredictionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    probability: float
    penalty: int
    slot_code: str
    day_of_week: int


class CandidateSlotItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_code: str
    predicted_prob: float
    penalty: int


class CandidateSlotsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    address_type: str = Field(pattern="^(apartment|house)$")
    floor: int | None = Field(default=None, ge=0, le=100)
    day_of_week: int = Field(ge=0, le=6)


class CandidateSlotsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidates: list[CandidateSlotItem]
    best_slot: str
    best_probability: float


class TrainResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metrics: dict[str, Any]


@router.post("/predict", response_model=PredictionResponse)
async def predict(
    body: PredictionRequest,
    _user: User = Depends(get_current_user),
) -> PredictionResponse:
    """Predict home probability for a stop + slot + day."""
    stop = {
        "id": "prediction-stop",
        "address_type": body.address_type,
        "floor": body.floor,
    }
    result = await predict_for_stop(
        stop=stop,
        slot_code=body.slot_code.value,
        day_of_week=body.day_of_week,
        history=[],  # No history for ad-hoc predictions
    )
    return PredictionResponse(**result)


@router.post("/candidates", response_model=CandidateSlotsResponse)
async def candidate_slots(
    body: CandidateSlotsRequest,
    _user: User = Depends(get_current_user),
) -> CandidateSlotsResponse:
    """Rank all delivery time slots by predicted home probability."""
    stop = {
        "id": "prediction-stop",
        "address_type": body.address_type,
        "floor": body.floor,
    }
    candidates = await predict_candidate_slots(
        stop=stop,
        day_of_week=body.day_of_week,
        history=[],
    )
    return CandidateSlotsResponse(
        candidates=candidates,
        best_slot=candidates[0]["slot_code"],
        best_probability=candidates[0]["predicted_prob"],
    )


@router.post("/train", response_model=TrainResponse)
async def train_model_endpoint(
    _user: User = Depends(get_current_user),
) -> TrainResponse:
    """Train (or retrain) the ML model on synthetic data."""
    try:
        _, metrics = await train_on_synthetic_data()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return TrainResponse(metrics=metrics)
