"""LightGBM home-probability model with Platt scaling calibration.

This module provides:
- Training a LightGBM binary classifier on availability history
- Calibrating probabilities with CalibratedClassifierCV (sigmoid/Platt)
- Saving/loading the model
- Predicting calibrated home probabilities for delivery optimization

The calibrated probabilities p_{i,s} are critical for the OR-Tools
prize-collecting VRPTW: they map to integer disjunction penalties that
control whether the optimizer visits a stop in a given time window.
"""

from __future__ import annotations

import logging

# pickle only (de)serialises our own internally-trained model file.
import pickle  # nosec B403
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split

from app.synthetic.generator import FEATURE_COLUMNS

logger = logging.getLogger(__name__)

# Default model storage path (inside container)
_MODEL_DIR = Path("/app/data/models")
_MODEL_PATH = _MODEL_DIR / "home_prob_model.pkl"


def train_model(
    X: pd.DataFrame,
    y: pd.Series,
    test_size: float = 0.2,
    seed: int = 42,
    calibration_method: str = "sigmoid",
) -> tuple[CalibratedClassifierCV, dict[str, Any]]:
    """Train a calibrated LightGBM model for home-probability prediction.

    Args:
        X: Feature matrix with columns matching FEATURE_COLUMNS.
        y: Binary target (1=home, 0=not home).
        test_size: Fraction held out for calibration + evaluation.
        seed: Random seed.
        calibration_method: 'sigmoid' (Platt) or 'isotonic'.

    Returns:
        (calibrated_model, metrics_dict)
    """
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=seed, stratify=y
    )

    # Base LightGBM classifier
    base_model = LGBMClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        num_leaves=31,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=seed,
        verbose=-1,
    )

    # Calibrate with CalibratedClassifierCV
    # This wraps the base model and applies Platt scaling (sigmoid)
    # to produce well-calibrated probability estimates.
    calibrated_model = CalibratedClassifierCV(
        estimator=base_model,
        method=calibration_method,
        cv=5,
    )
    calibrated_model.fit(X_train, y_train)

    # Evaluate
    y_pred_proba = calibrated_model.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)

    accuracy = float(np.mean(y_pred == y_test))
    # Brier score: lower is better for calibrated probabilities
    brier_score = float(np.mean((y_pred_proba - y_test) ** 2))
    # Log loss
    eps = 1e-15
    y_clipped = np.clip(y_pred_proba, eps, 1 - eps)
    log_loss_val = float(
        -np.mean(y_test * np.log(y_clipped) + (1 - y_test) * np.log(1 - y_clipped))
    )

    metrics = {
        "accuracy": accuracy,
        "brier_score": brier_score,
        "log_loss": log_loss_val,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "calibration_method": calibration_method,
    }

    logger.info(
        "Model trained: accuracy=%.3f brier=%.4f logloss=%.4f (train=%d test=%d)",
        accuracy,
        brier_score,
        log_loss_val,
        len(X_train),
        len(X_test),
    )

    return calibrated_model, metrics


def save_model(model: CalibratedClassifierCV, path: Path | None = None) -> Path:
    """Serialize the calibrated model to disk."""
    save_path = path or _MODEL_PATH
    save_path.parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, "wb") as f:
        pickle.dump(model, f)
    logger.info("Model saved to %s", save_path)
    return save_path


def load_model(path: Path | None = None) -> CalibratedClassifierCV:
    """Load a calibrated model from disk."""
    load_path = path or _MODEL_PATH
    with open(load_path, "rb") as f:
        # Model file is produced by our own training step at a fixed path,
        # never untrusted external input.
        model = pickle.load(f)  # noqa: S301  # nosec B301
    logger.info("Model loaded from %s", load_path)
    return model


def predict_home_probability(
    model: CalibratedClassifierCV,
    features: dict[str, Any] | pd.DataFrame,
) -> float | np.ndarray:
    """Predict calibrated home probability for one or more feature vectors.

    Args:
        model: A trained CalibratedClassifierCV model.
        features: A single feature dict or a DataFrame of features.

    Returns:
        A single float probability or an array of probabilities.
    """
    if isinstance(features, dict):
        df = pd.DataFrame([features])[FEATURE_COLUMNS]
        return float(model.predict_proba(df)[0, 1])
    df = features[FEATURE_COLUMNS]
    return model.predict_proba(df)[:, 1]


def probability_to_penalty(
    prob: float,
    max_penalty: int = 10000,
    min_penalty: int = 100,
) -> int:
    """Convert a calibrated probability to an integer disjunction penalty.

    Higher probability of being home → higher penalty for skipping the stop
    → optimizer is more incentivized to visit.

    This mapping is used by OR-Tools AddDisjunction: the penalty is the
    cost of NOT visiting a node. So high p → high penalty → must visit.

    Args:
        prob: Calibrated home probability [0, 1].
        max_penalty: Penalty when p=1 (always home → must visit).
        min_penalty: Penalty when p=0 (never home → cheap to skip).

    Returns:
        Integer penalty for OR-Tools disjunction.
    """
    # Linear mapping: penalty = min + (max - min) * p
    penalty = int(min_penalty + (max_penalty - min_penalty) * prob)
    return max(min_penalty, min(max_penalty, penalty))
