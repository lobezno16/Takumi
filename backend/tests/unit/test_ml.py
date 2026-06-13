"""Tests for Phase 4 — ML model, synthetic data, and prediction API."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.synthetic.generator import (
    FEATURE_COLUMNS,
    generate_availability_history,
    generate_feature_row,
    generate_stops,
    generate_orders,
)


# ── Synthetic data tests ──────────────────────────────────────────────

async def test_generate_stops() -> None:
    """Should generate stops with valid coordinates in Koto-ku."""
    stops = generate_stops(n_stops=50, seed=123)
    assert len(stops) == 50

    for stop in stops:
        assert 35.634 <= stop["latitude"] <= 35.694
        assert 139.792 <= stop["longitude"] <= 139.832
        assert stop["address_type"] in ("apartment", "house")
        assert "address" in stop
        if stop["address_type"] == "apartment":
            assert stop["floor"] is not None
        else:
            assert stop["floor"] is None


async def test_generate_orders() -> None:
    """Should generate 1-3 orders per stop."""
    stops = generate_stops(n_stops=10, seed=42)
    orders = generate_orders(stops, seed=42)
    assert len(orders) >= 10  # At least 1 per stop
    assert len(orders) <= 30  # At most 3 per stop
    for order in orders:
        assert order["stop_id"] in [s["id"] for s in stops]
        assert order["parcel_size"] in ("60", "80", "100", "120")


async def test_generate_availability_history() -> None:
    """Should generate realistic availability history."""
    stops = generate_stops(n_stops=5, seed=42)
    history = generate_availability_history(stops, n_weeks=4, seed=42)

    assert len(history) > 0
    for record in history:
        assert record["slot_code"] in ("am", "t1214", "t1416", "t1618", "t1821")
        assert 0 <= record["day_of_week"] <= 6
        assert isinstance(record["was_home"], bool)


async def test_feature_row_structure() -> None:
    """Feature rows should have all expected columns."""
    stops = generate_stops(n_stops=3, seed=42)
    history = generate_availability_history(stops, n_weeks=4, seed=42)

    features = generate_feature_row(stops[0], "am", 1, history)
    for col in FEATURE_COLUMNS:
        assert col in features, f"Missing feature: {col}"


async def test_feature_columns_count() -> None:
    """Should have exactly 8 features."""
    assert len(FEATURE_COLUMNS) == 8


# ── ML model tests ───────────────────────────────────────────────────

async def test_train_model() -> None:
    """Training on synthetic data should produce a calibrated model."""
    from app.services.ml.model import train_model

    stops = generate_stops(n_stops=30, seed=42)
    history = generate_availability_history(stops, n_weeks=6, seed=42)

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

    model, metrics = train_model(X, y, seed=42)

    assert metrics["accuracy"] > 0.5  # Better than random
    assert metrics["brier_score"] < 0.3  # Reasonable calibration
    assert metrics["log_loss"] < 1.0
    assert metrics["train_size"] > 0
    assert metrics["test_size"] > 0


async def test_predict_home_probability() -> None:
    """Predictions should return probabilities in [0, 1]."""
    from app.services.ml.model import predict_home_probability, train_model

    stops = generate_stops(n_stops=20, seed=42)
    history = generate_availability_history(stops, n_weeks=4, seed=42)

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
    model, _ = train_model(X, y, seed=42)

    # Single prediction
    test_features = {
        "address_type_encoded": 0,
        "floor": 5,
        "slot_code_encoded": 4,  # t1821
        "day_of_week": 2,  # Wednesday
        "is_weekday": 1,
        "historical_hit_rate": 0.7,
        "historical_count": 10,
        "overall_hit_rate": 0.6,
    }
    prob = predict_home_probability(model, test_features)
    assert 0.0 <= prob <= 1.0

    # Batch prediction
    batch_df = pd.DataFrame([test_features] * 5)
    probs = predict_home_probability(model, batch_df)
    assert len(probs) == 5
    assert all(0.0 <= p <= 1.0 for p in probs)


async def test_probability_to_penalty() -> None:
    """Penalty should scale linearly with probability."""
    from app.services.ml.model import probability_to_penalty

    # p=0 → min penalty
    assert probability_to_penalty(0.0) == 100
    # p=1 → max penalty
    assert probability_to_penalty(1.0) == 10000
    # p=0.5 → midpoint
    mid = probability_to_penalty(0.5)
    assert 4000 < mid < 6000

    # Monotonically increasing
    penalties = [probability_to_penalty(p / 10) for p in range(11)]
    assert all(a <= b for a, b in zip(penalties, penalties[1:]))


async def test_evening_higher_than_morning() -> None:
    """Evening slots should generally have higher home probability than morning."""
    from app.services.ml.model import predict_home_probability, train_model

    stops = generate_stops(n_stops=50, seed=42)
    history = generate_availability_history(stops, n_weeks=8, seed=42)

    rows, labels = [], []
    for record in history:
        stop = next(s for s in stops if s["id"] == record["stop_id"])
        features = generate_feature_row(
            stop, record["slot_code"], record["day_of_week"], history
        )
        rows.append(features)
        labels.append(1 if record["was_home"] else 0)

    X = pd.DataFrame(rows)[FEATURE_COLUMNS]
    y = pd.Series(labels)
    model, _ = train_model(X, y, seed=42)

    # Compare AM vs t1821 for an apartment on a weekday
    am_features = {
        "address_type_encoded": 0, "floor": 5, "slot_code_encoded": 0,
        "day_of_week": 2, "is_weekday": 1,
        "historical_hit_rate": 0.3, "historical_count": 10, "overall_hit_rate": 0.4,
    }
    evening_features = {
        "address_type_encoded": 0, "floor": 5, "slot_code_encoded": 4,
        "day_of_week": 2, "is_weekday": 1,
        "historical_hit_rate": 0.7, "historical_count": 10, "overall_hit_rate": 0.6,
    }

    am_prob = predict_home_probability(model, am_features)
    evening_prob = predict_home_probability(model, evening_features)

    # Evening should be higher (apartment dwellers come home from work)
    assert evening_prob > am_prob, (
        f"Expected evening ({evening_prob:.3f}) > AM ({am_prob:.3f})"
    )
