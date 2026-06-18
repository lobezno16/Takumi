/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Delivery } from "./types";

/**
 * Returns the hex code for a given p_home probability score.
 * Interpolates discrete thresholds: Vermilion (<0.45), Amber (0.45 - 0.72), and Mint (>=0.72).
 * This establishes the core color-encoded visualization dialect on the map and stop cards.
 */
export function getPHomeColor(p: number): string {
  if (p < 0.45) {
    return "#E8442A"; // vermilion
  } else if (p < 0.72) {
    return "#F5A623"; // amber
  } else {
    return "#00C896"; // mint green
  }
}

/**
 * Clean helper function to safely format dynamic percentages
 */
export function formatPercent(val: number): string {
  return `${Math.round(val * 100)}%`;
}

export interface RedeliveryRiskDetail {
  score: number; // 0.0 to 1.0 (probability of failure/redelivery)
  logit: number;
  breakdown: {
    baseRate: number;
    attendanceInfluence: number;
    historyInfluence: number;
    housingInfluence: number;
    slotInfluence: number;
  };
  features: {
    housingType: string;
    avgHistSuccess: number;
    currentPHome: number;
    timeSlot: string;
  };
}

/**
 * Emulates an online-calibrated Logistic Regression classifier trained on historic 
 * Tokyo post-attempt outcomes. Maps address, time, structure and history features
 * to calculate real-time Redelivery Probabilities, detailing feature importances.
 */
export function calculateRedeliveryRisk(d: Delivery): RedeliveryRiskDetail {
  // 1. Feature Extraction
  const pHome = d.pHome;
  const attendanceGap = 1.0 - pHome;

  const avgHistSuccess = d.historicalHitRate.length > 0 
    ? d.historicalHitRate.reduce((acc, v) => acc + v, 0) / d.historicalHitRate.length / 100
    : 0.65;
  const historicalFailure = 1.0 - avgHistSuccess;

  // Floor type access difficulty weights (representing building delivery time penalties)
  let housingImpact = 0.0;
  if (d.floorType.includes("High-rise") || d.floorType.includes("High")) {
    housingImpact = 0.25; // Elevator gate double-lock delay
  } else if (d.floorType.includes("Low-rise") || d.floorType.includes("Stairs")) {
    housingImpact = 0.10; // Stairs walk-up fatigue
  } else if (d.floorType.includes("Office") || d.floorType.includes("Commercial")) {
    housingImpact = 0.30; // Mailroom gate check or closed early
  } else {
    housingImpact = -0.05; // Detached house, rapid direct package leave
  }

  // Scheduled slot bias coefficients
  let slotImpact = 0.0;
  if (d.scheduledSlot.includes("12:00") || d.scheduledSlot.includes("14:00") || d.scheduledSlot.includes("16:00")) {
    slotImpact = 0.35; // Commuter commute peak gap (afternoon)
  } else if (d.scheduledSlot.includes("08:00") || d.scheduledSlot.includes("10:00")) {
    slotImpact = -0.10; // Morning departure buffer
  } else if (d.scheduledSlot.includes("18:00") || d.scheduledSlot.includes("20:00")) {
    slotImpact = -0.25; // Evening residential presence peak
  }

  // 2. Linear Combination: logit = W * X + b
  const w_attendance = 3.6;
  const w_history = 2.8;
  const w_housing = 1.8;
  const w_slot = 1.4;
  const bias = -2.1; // Baseline intercept

  const contr_attendance = w_attendance * attendanceGap;
  const contr_history = w_history * historicalFailure;
  const contr_housing = w_housing * housingImpact;
  const contr_slot = w_slot * slotImpact;

  const logit = bias + contr_attendance + contr_history + contr_housing + contr_slot;

  // 3. Sigmoid Activation: prob = 1 / (1 + e^-logit)
  const score = 1.0 / (1.0 + Math.exp(-logit));

  // Determine relative scale contributions for explanations (SHAP approximation)
  return {
    score: parseFloat(score.toFixed(3)),
    logit,
    breakdown: {
      baseRate: bias,
      attendanceInfluence: contr_attendance,
      historyInfluence: contr_history,
      housingInfluence: contr_housing,
      slotInfluence: contr_slot,
    },
    features: {
      housingType: d.floorType,
      avgHistSuccess: parseFloat(avgHistSuccess.toFixed(3)),
      currentPHome: pHome,
      timeSlot: d.scheduledSlot,
    }
  };
}

