"""ML prediction service — provides calibrated home probabilities.

This module manages the lifecycle of the trained model and exposes
a clean interface for the optimizer and API to request predictions.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from app.services.ml.model import (
    CalibratedClassifierCV,
    load_model,
    predict_home_probability,
    probability_to_penalty,
    save_model,
    train_model,
)
from app.synthetic.generator import (
    FEATURE_COLUMNS,
    generate_availability_history,
    generate_feature_row,
    generate_stops,
)

logger = logging.getLogger(__name__)

# Module-level model cache
_model: CalibratedClassifierCV | None = None


async def get_model() -> CalibratedClassifierCV:
    """Get the current model, loading from disk or training if needed."""
    global _model  # noqa: PLW0603
    if _model is not None:
        return _model

    model_path = Path("/app/data/models/home_prob_model.pkl")
    if model_path.exists():
        _model = load_model(model_path)
        return _model

    # No saved model — train on synthetic data
    logger.info("No saved model found, training on synthetic data...")
    _model, metrics = await train_on_synthetic_data()
    logger.info("Model trained with metrics: %s", metrics)
    return _model


async def train_on_synthetic_data(
    n_stops: int = 200,
    n_weeks: int = 12,
    seed: int = 42,
) -> tuple[CalibratedClassifierCV, dict[str, Any]]:
    """Train a model on synthetic data and save it.

    Returns:
        (model, metrics_dict)
    """
    # Generate synthetic data
    stops = generate_stops(n_stops=n_stops, seed=seed)
    history = generate_availability_history(stops, n_weeks=n_weeks, seed=seed)

    # Build feature matrix
    rows = []
    labels = []
    for record in history:
        stop = next(s for s in stops if s["id"] == record["stop_id"])
        features = generate_feature_row(
            stop, record["slot_code"], record["day_of_week"], history
        )
        rows.append(features)
        labels.append(1 if record["was_home"] else 0)

    X = pd.DataFrame(rows)[FEATURE_COLUMNS]
    y = pd.Series(labels)

    # Train and calibrate
    model, metrics = train_model(X, y, seed=seed)

    # Save
    save_model(model)

    # Cache
    global _model  # noqa: PLW0603
    _model = model

    return model, metrics


async def predict_for_stop(
    stop: dict[str, Any],
    slot_code: str,
    day_of_week: int,
    history: list[dict[str, Any]],
) -> dict[str, Any]:
    """Predict home probability and OR-Tools penalty for a single stop+slot.

    Args:
        stop: Stop dict with id, address_type, floor.
        slot_code: Delivery time slot code.
        day_of_week: 0=Mon...6=Sun.
        history: Availability history records for feature engineering.

    Returns:
        Dict with probability and penalty.
    """
    model = await get_model()
    features = generate_feature_row(stop, slot_code, day_of_week, history)
    prob = predict_home_probability(model, features)
    penalty = probability_to_penalty(prob)

    return {
        "probability": round(prob, 4),
        "penalty": penalty,
        "slot_code": slot_code,
        "day_of_week": day_of_week,
    }


async def predict_candidate_slots(
    stop: dict[str, Any],
    day_of_week: int,
    history: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Predict home probabilities across all slots for a stop.

    Returns slots sorted by descending probability — the best candidate
    windows for the agent to propose to the recipient.
    """
    from app.models.enums import SlotCode

    model = await get_model()
    results = []

    for slot in SlotCode:
        features = generate_feature_row(stop, slot.value, day_of_week, history)
        prob = predict_home_probability(model, features)
        results.append({
            "slot_code": slot.value,
            "predicted_prob": round(float(prob), 4),
            "penalty": probability_to_penalty(float(prob)),
        })

    # Sort by probability descending — best slots first
    results.sort(key=lambda x: x["predicted_prob"], reverse=True)
    return results
