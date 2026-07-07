/**
 * Shared domain types for the TakumiRoute cockpit.
 *
 * `Delivery` and `Vehicle` are the client-side projections of the backend's
 * detailed simulation response (`/api/simulation/run-detailed`).
 */

export interface PredictionSlot {
  slot: string; // e.g., "18:00 - 21:00"
  slotCode: string; // backend SlotCode, e.g. "t1821"
  period: 'Morning' | 'Afternoon' | 'Evening';
  pHome: number;
  recommended: boolean;
}

export interface Delivery {
  id: string; // display id, e.g. "DEL-1042"
  stopId: string; // backend stop UUID
  orderId: string | null; // backend order UUID when enrolled in agent outreach
  recipientName: string;
  district: string;
  address: string;
  floorType: string; // e.g. "Elevator Apt (High-rise)"
  pHome: number;
  coordinates: [number, number]; // [lng, lat]
  scheduledSlot: string; // display label of the assigned window
  scheduledSlotCode: string; // backend SlotCode of the assigned window
  status: 'confirmed' | 'pending' | 'flagged';
  outcome: 'success' | 'miss';
  historicalHitRate: number[]; // 30 values for the sparkline
  predictions: PredictionSlot[];
  vehicleId: string;
}

export interface Vehicle {
  id: string;
  driverName: string;
  stopsCount: number;
  averagePHome: number;
  routeCoordinates: [number, number][]; // optimized (Takumi) path
  baselineCoordinates: [number, number][]; // baseline path for comparison
  color: string;
  visible: boolean;
}

export interface AgentMessage {
  id: string;
  sender: 'agent' | 'recipient' | 'system';
  message: string;
  timestamp: string;
}

export interface AgentEvent {
  id: string;
  type: 'status_update' | 'slot_confirmed' | 'reoptimize' | 'incoming_msg';
  delivery_id: string;
  recipient_name: string;
  message: string;
  timestamp: string;
  slot_confirmed?: boolean;
  reoptimize_triggered?: boolean;
}

export interface SimulationResult {
  active: boolean;
  runId: string;
  improvementPct: number;
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
  } | null;
}

export interface RunMeta {
  runId: string;
  seed: number;
  dayOfWeek: number;
  nStops: number;
  nVehicles: number;
  improvementPct: number;
  baselineRedeliveryRate: number;
  takumiRedeliveryRate: number;
  baselineRouteSeconds: number;
  takumiRouteSeconds: number;
  solverTimeMs: number;
}
