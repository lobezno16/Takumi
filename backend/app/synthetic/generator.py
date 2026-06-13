"""Synthetic data generator for TakumiRoute.

Generates realistic delivery data for Koto-ku, Tokyo:
- Stops (apartments + houses with location jitter)
- Orders (with parcel sizes)
- Availability history (with realistic home-presence patterns)

Pattern rationale: Japanese households have strong temporal patterns.
- Apartments: lower AM presence (commuters), higher evening presence
- Houses: moderate AM (elderly/WFH), high afternoon/evening
- Weekend vs weekday shifts patterns significantly
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

from app.models.enums import AddressType, ParcelSize, SlotCode

# Koto-ku bounding box
_KOTO_LAT_MIN, _KOTO_LAT_MAX = 35.634, 35.694
_KOTO_LON_MIN, _KOTO_LON_MAX = 139.792, 139.832

# Base home probabilities by (address_type, slot_code, is_weekday)
# These encode realistic Japanese household availability patterns.
_BASE_PROBS: dict[tuple[str, str, bool], float] = {
    # Apartments — commuter-heavy, low daytime
    ("apartment", "am", True): 0.30,
    ("apartment", "t1214", True): 0.25,
    ("apartment", "t1416", True): 0.28,
    ("apartment", "t1618", True): 0.45,
    ("apartment", "t1821", True): 0.72,
    ("apartment", "am", False): 0.65,
    ("apartment", "t1214", False): 0.55,
    ("apartment", "t1416", False): 0.60,
    ("apartment", "t1618", False): 0.70,
    ("apartment", "t1821", False): 0.80,
    # Houses — more retirees/WFH, higher daytime
    ("house", "am", True): 0.50,
    ("house", "t1214", True): 0.45,
    ("house", "t1416", True): 0.55,
    ("house", "t1618", True): 0.65,
    ("house", "t1821", True): 0.78,
    ("house", "am", False): 0.75,
    ("house", "t1214", False): 0.65,
    ("house", "t1416", False): 0.70,
    ("house", "t1618", False): 0.80,
    ("house", "t1821", False): 0.85,
}

_SLOT_CODES = [s.value for s in SlotCode]
_PARCEL_SIZES = [s.value for s in ParcelSize]


def _jitter(base: float, spread: float = 0.001) -> float:
    """Add Gaussian jitter to a coordinate."""
    return base + random.gauss(0, spread)


def generate_stops(
    n_stops: int = 200,
    apartment_ratio: float = 0.65,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Generate synthetic delivery stops in Koto-ku.

    Args:
        n_stops: Number of stops to generate.
        apartment_ratio: Fraction that are apartments (rest are houses).
        seed: Random seed for reproducibility.

    Returns:
        List of stop dicts ready for DB insertion.
    """
    rng = random.Random(seed)
    stops = []
    for i in range(n_stops):
        is_apt = rng.random() < apartment_ratio
        addr_type = AddressType.APARTMENT if is_apt else AddressType.HOUSE

        lat = rng.uniform(_KOTO_LAT_MIN, _KOTO_LAT_MAX)
        lon = rng.uniform(_KOTO_LON_MIN, _KOTO_LON_MAX)

        floor_val = rng.randint(1, 15) if is_apt else None
        chome = rng.randint(1, 6)
        banchi = rng.randint(1, 30)
        go = rng.randint(1, 20)

        stops.append({
            "id": str(uuid.uuid4()),
            "address": f"東京都江東区{chome}丁目{banchi}-{go}",
            "latitude": lat,
            "longitude": lon,
            "address_type": addr_type.value,
            "floor": floor_val,
        })
    return stops


def generate_orders(
    stops: list[dict[str, Any]],
    orders_per_stop: tuple[int, int] = (1, 3),
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Generate synthetic orders for the given stops.

    Args:
        stops: List of stop dicts (must have 'id').
        orders_per_stop: (min, max) orders per stop.
        seed: Random seed.

    Returns:
        List of order dicts.
    """
    rng = random.Random(seed)
    orders = []
    for stop in stops:
        n_orders = rng.randint(*orders_per_stop)
        for _ in range(n_orders):
            orders.append({
                "id": str(uuid.uuid4()),
                "stop_id": stop["id"],
                "parcel_size": rng.choice(_PARCEL_SIZES),
                "demand": 1,
            })
    return orders


def generate_availability_history(
    stops: list[dict[str, Any]],
    n_weeks: int = 12,
    attempts_per_week: int = 3,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Generate synthetic availability history for ML training.

    Creates realistic home-presence data based on address type, time slot,
    and day of week. Each stop gets multiple delivery attempts across
    several weeks, with per-stop personality noise.

    Args:
        stops: List of stop dicts (must have 'id', 'address_type').
        n_weeks: Number of weeks of historical data to generate.
        attempts_per_week: Average delivery attempts per stop per week.
        seed: Random seed.

    Returns:
        List of availability history dicts.
    """
    rng = random.Random(seed)
    np_rng = np.random.RandomState(seed)
    history = []

    base_date = datetime(2025, 1, 6, tzinfo=timezone.utc)  # A Monday

    for stop in stops:
        # Per-stop personality: some people are consistently more/less home
        personality_bias = np_rng.normal(0, 0.08)

        for week in range(n_weeks):
            n_attempts = max(1, rng.randint(
                attempts_per_week - 1, attempts_per_week + 1
            ))
            for _ in range(n_attempts):
                day_offset = rng.randint(0, 6)
                day_of_week = day_offset  # 0=Mon...6=Sun
                is_weekday = day_of_week < 5
                slot_code = rng.choice(_SLOT_CODES)

                # Look up base probability
                base_p = _BASE_PROBS.get(
                    (stop["address_type"], slot_code, is_weekday),
                    0.5,
                )

                # Apply per-stop personality noise
                p = np.clip(base_p + personality_bias, 0.05, 0.95)

                # Floor effect: higher floors slightly reduce presence
                # (more likely to be out, elevator delays mean missed knocks)
                floor_val = stop.get("floor")
                if floor_val is not None and floor_val > 5:
                    p *= 0.95

                was_home = bool(rng.random() < p)

                attempt_ts = base_date + timedelta(
                    weeks=week,
                    days=day_offset,
                    hours=rng.randint(8, 20),
                    minutes=rng.randint(0, 59),
                )

                history.append({
                    "id": str(uuid.uuid4()),
                    "stop_id": stop["id"],
                    "slot_code": slot_code,
                    "day_of_week": day_of_week,
                    "attempt_ts": attempt_ts.isoformat(),
                    "was_home": was_home,
                })

    return history


def generate_feature_row(
    stop: dict[str, Any],
    slot_code: str,
    day_of_week: int,
    history: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a feature vector for a single prediction.

    Features:
    - address_type_encoded: 0=apartment, 1=house
    - floor: building floor (0 for houses)
    - slot_code_encoded: ordinal encoding of slot
    - day_of_week: 0-6
    - is_weekday: 0 or 1
    - historical_hit_rate: past was_home rate for this stop+slot
    - historical_count: number of past attempts for this stop+slot
    - overall_hit_rate: past was_home rate for this stop (all slots)
    """
    slot_order = {s: i for i, s in enumerate(_SLOT_CODES)}

    # Filter history for this stop
    stop_history = [h for h in history if h["stop_id"] == stop["id"]]
    stop_slot_history = [h for h in stop_history if h["slot_code"] == slot_code]

    hist_count = len(stop_slot_history)
    hist_hit_rate = (
        sum(1 for h in stop_slot_history if h["was_home"]) / hist_count
        if hist_count > 0
        else 0.5
    )
    overall_count = len(stop_history)
    overall_hit_rate = (
        sum(1 for h in stop_history if h["was_home"]) / overall_count
        if overall_count > 0
        else 0.5
    )

    return {
        "address_type_encoded": 0 if stop["address_type"] == "apartment" else 1,
        "floor": stop.get("floor") or 0,
        "slot_code_encoded": slot_order.get(slot_code, 0),
        "day_of_week": day_of_week,
        "is_weekday": 1 if day_of_week < 5 else 0,
        "historical_hit_rate": hist_hit_rate,
        "historical_count": hist_count,
        "overall_hit_rate": overall_hit_rate,
    }


# Feature column names — used for model training and prediction
FEATURE_COLUMNS = [
    "address_type_encoded",
    "floor",
    "slot_code_encoded",
    "day_of_week",
    "is_weekday",
    "historical_hit_rate",
    "historical_count",
    "overall_hit_rate",
]
