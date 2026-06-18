/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PredictionSlot {
  slot: string; // e.g., "08:00 - 10:00"
  period: "Morning" | "Afternoon" | "Evening";
  pHome: number;
  recommended: boolean;
}

export interface Delivery {
  id: string;
  recipientName: string;
  district: string;
  address: string;
  floorType: string; // e.g. "Elevator Apt (High)", "Low-rise Apt", "Detached House (Stairs)"
  pHome: number;
  coordinates: [number, number]; // [lng, lat]
  scheduledSlot: string;
  status: "confirmed" | "pending" | "flagged";
  historicalHitRate: number[]; // 30 values for sparkline
  predictions: PredictionSlot[];
  vehicleId: string;
}

export interface Vehicle {
  id: string;
  driverName: string;
  stopsCount: number;
  averagePHome: number;
  routeCoordinates: [number, number][]; // Path line coordinates
  color: string;
  visible: boolean;
}

export interface AgentMessage {
  id: string;
  sender: "agent" | "recipient" | "system";
  message: string;
  timestamp: string;
}

export interface AgentEvent {
  id: string;
  type: "status_update" | "slot_confirmed" | "reoptimize" | "incoming_msg";
  delivery_id: string;
  recipient_name: string;
  message: string;
  timestamp: string;
  slot_confirmed?: boolean;
  reoptimize_triggered?: boolean;
}

export interface SimulationResult {
  active: boolean;
  metrics: {
    baseline: {
      redeliveryRate: number;
      driverHours: number;
      co2: number;
      parcels: number;
    };
    takumi: {
      redeliveryRate: number;
      driverHours: number;
      co2: number;
      parcels: number;
    };
  };
  benchmark: {
    ortools: { timeMs: number; gap: number };
    pyvrp: { timeMs: number; gap: number };
  };
}

export interface MLHealthData {
  driftError: number;
  driftThreshold: number;
  calibrationCurve: { name: string; perfect: number; model: number }[];
  featureImportance: { name: string; importance: number }[];
  modelVersions: {
    version: string;
    trainedAt: string;
    logLoss: number;
    status: "deployed" | "staged" | "archived";
  }[];
}
