/**
 * Operational translation layer.
 *
 * The backend speaks in ML probabilities and solver KPIs. The dispatch
 * dashboard speaks in fleet operations. This module is the single place that
 * converts model/solver output into operator-facing metrics and status tags,
 * so no "developer debug" terminology leaks into the UI.
 */
import type { KPIs } from '@/api/client';

// Dispatch-domain proxy constants for resource-optimization estimates.
const MIN_PER_REDELIVERY = 18; // avg return-trip minutes for one missed stop
const KM_PER_REDELIVERY = 3.2; // avg extra distance per redelivery trip (km)
const CO2_KG_PER_KM = 0.21; // light commercial vehicle emission factor

/** Japan's ~9% first-attempt failure rate — the industry baseline to beat. */
export const INDUSTRY_BASELINE_PCT = 9;

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface OpsMetrics {
  baselineRedeliveryPct: number;
  optimizedRedeliveryPct: number;
  redeliveriesPrevented: number;
  driverHoursSaved: number;
  co2SavedKg: number;
  fleetUsed: number;
  fleetTotal: number;
  firstAttemptPct: number;
  stopsPlanned: number;
}

/** Translate raw baseline/optimized KPIs into operator-facing metrics. */
export function deriveOps(
  baseline: KPIs,
  optimized: KPIs,
  fleetTotal: number,
): OpsMetrics {
  const prevented = Math.max(
    0,
    baseline.deliveries_failed - optimized.deliveries_failed,
  );
  return {
    baselineRedeliveryPct: baseline.redelivery_rate * 100,
    optimizedRedeliveryPct: optimized.redelivery_rate * 100,
    redeliveriesPrevented: prevented,
    driverHoursSaved: (prevented * MIN_PER_REDELIVERY) / 60,
    co2SavedKg: prevented * KM_PER_REDELIVERY * CO2_KG_PER_KM,
    fleetUsed: optimized.total_vehicles_used,
    fleetTotal,
    firstAttemptPct: optimized.first_attempt_success_rate * 100,
    stopsPlanned: optimized.stops_attempted,
  };
}

const SLOT_WINDOWS = new Map<string, string>([
  ['am', 'Morning · until 12:00'],
  ['t1214', '12:00 – 14:00'],
  ['t1416', '14:00 – 16:00'],
  ['t1618', '16:00 – 18:00'],
  ['t1821', 'Evening · 18:00 – 21:00'],
]);

const SLOT_SHORT = new Map<string, string>([
  ['am', 'Morning'],
  ['t1214', '12–14'],
  ['t1416', '14–16'],
  ['t1618', '16–18'],
  ['t1821', 'Evening'],
]);

export function slotWindow(code: string): string {
  return SLOT_WINDOWS.get(code) ?? code;
}

export function slotShort(code: string): string {
  return SLOT_SHORT.get(code) ?? code;
}

export interface StatusTag {
  label: string;
  tone: Tone;
}

/**
 * Map a model home-probability to an operator-facing availability status.
 * Confirmed availability (very high confidence) implies an agent-synced slot.
 */
export function availabilityStatus(prob: number, confirmed = false): StatusTag {
  if (confirmed || prob >= 0.78) {
    return { label: 'Confirmed Available', tone: 'success' };
  }
  if (prob >= 0.6) return { label: 'Likely Available', tone: 'success' };
  if (prob >= 0.45) return { label: 'Scheduled', tone: 'info' };
  return { label: 'High Absence Risk', tone: 'danger' };
}

/** Confidence as an operator label + percentage, never a raw score. */
export function confidence(prob: number): { label: string; pct: number; tone: Tone } {
  const pct = Math.round(prob * 100);
  if (prob >= 0.7) return { label: 'High', pct, tone: 'success' };
  if (prob >= 0.45) return { label: 'Medium', pct, tone: 'warning' };
  return { label: 'Low', pct, tone: 'danger' };
}

/** Deterministic friendly driver label from a vehicle id. */
export function driverLabel(vehicleId: string, index: number): string {
  return `Driver ${String.fromCharCode(65 + (index % 26))} · Unit ${vehicleId.replace(/[^0-9]/g, '') || index + 1}`;
}

/** Deterministic synthetic recipient + address for a stop (demo display only). */
const FAMILY = ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato'];

export function recipientFor(stopId: string, sequence: number): string {
  const h = hash(stopId);
  return `${FAMILY.at(h % FAMILY.length) ?? 'Sato'} Residence · #${sequence + 1}`;
}

export function addressFor(lat: number, lon: number): string {
  // Stable pseudo-address within Kōtō-ku from the coordinates.
  const chome = (Math.abs(Math.round(lat * 1000)) % 8) + 1;
  const banchi = (Math.abs(Math.round(lon * 1000)) % 30) + 1;
  const go = (Math.abs(Math.round((lat + lon) * 500)) % 20) + 1;
  return `Kōtō-ku ${chome}-chōme ${banchi}-${go}, Tokyo`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
