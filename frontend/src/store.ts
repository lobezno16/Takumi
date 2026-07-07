/**
 * Zustand stores wiring the cockpit to the TakumiRoute backend.
 *
 * Data flow:
 * - `loadDay()` runs a detailed prize-collecting VRPTW simulation on the
 *   backend and projects the returned routes/stops into `Vehicle`/`Delivery`.
 * - An agent coordination session enrolls the lowest-p_home stops for
 *   recipient outreach; chat messages go through the constrained agent loop.
 * - `/ws/live` streams re-optimization events into the toast feed.
 */

import { create } from 'zustand';
import { Delivery, Vehicle, AgentEvent, SimulationResult, RunMeta } from './types';
import * as api from './api/client';
import {
  DRIVER_NAMES,
  KOTO_CENTER_LAT,
  KOTO_CENTER_LNG,
  VEHICLE_COLORS,
  districtFor,
  floorTypeFor,
  predictionsFor,
  recipientNameFor,
  slotLabel,
  sparklineFor,
} from './seedData';

// ── Helpers ──────────────────────────────────────────────────────────

/** ISO date string → backend day_of_week (0=Mon … 6=Sun). */
function dateToDayOfWeek(isoDate: string): number {
  const jsDay = new Date(`${isoDate}T12:00:00`).getDay(); // 0=Sun … 6=Sat
  return (jsDay + 6) % 7;
}

function statusFor(pHome: number): Delivery['status'] {
  if (pHome >= 0.72) return 'confirmed';
  if (pHome < 0.45) return 'flagged';
  return 'pending';
}

function nowTimestamp(): string {
  return new Date().toLocaleTimeString('ja-JP', { hour12: false });
}

interface MappedDay {
  deliveries: Delivery[];
  vehicles: Vehicle[];
  runMeta: RunMeta;
}

/** Project the backend's detailed simulation into cockpit view models. */
function mapDetailedResult(detail: api.DetailedSimulationResult): MappedDay {
  const depot: [number, number] = [detail.depot_lon, detail.depot_lat];

  const vehicles: Vehicle[] = [];
  const deliveries: Delivery[] = [];
  let stopCounter = 0;

  detail.takumi_routes.forEach((route, idx) => {
    const vehicleId = `V${String(idx + 1).padStart(2, '0')}`;
    const coords: [number, number][] = [
      depot,
      ...route.stops.map((s): [number, number] => [s.longitude, s.latitude]),
      depot,
    ];
    // Baseline and Takumi are independent solves, so the solver's vehicle
    // indexes don't correspond (e.g. Takumi may use v5–v7 while baseline
    // uses v0–v2). Pair positionally: nth displayed vehicle gets the nth
    // baseline route for its comparison overlay.
    const baseline = detail.baseline_routes[idx];
    const baselineCoords: [number, number][] = baseline
      ? [depot, ...baseline.stops.map((s): [number, number] => [s.longitude, s.latitude]), depot]
      : coords;

    const routeDeliveries = route.stops.map((stop) => {
      stopCounter += 1;
      const delivery: Delivery = {
        id: `DEL-${1000 + stopCounter}`,
        stopId: stop.stop_id,
        orderId: null,
        recipientName: recipientNameFor(stop.stop_id),
        district: districtFor(stop.longitude, stop.latitude),
        address: stop.address || districtFor(stop.longitude, stop.latitude),
        floorType: floorTypeFor(stop.address_type, stop.floor),
        pHome: stop.predicted_prob,
        coordinates: [stop.longitude, stop.latitude],
        scheduledSlot: slotLabel(stop.assigned_slot),
        scheduledSlotCode: stop.assigned_slot,
        status: statusFor(stop.predicted_prob),
        outcome: stop.outcome,
        historicalHitRate: sparklineFor(stop.stop_id, stop.predicted_prob),
        predictions: predictionsFor(stop),
        vehicleId,
      };
      return delivery;
    });
    deliveries.push(...routeDeliveries);

    const avgPHome =
      routeDeliveries.length > 0
        ? routeDeliveries.reduce((sum, d) => sum + d.pHome, 0) / routeDeliveries.length
        : 0;

    vehicles.push({
      id: vehicleId,
      driverName: DRIVER_NAMES[idx % DRIVER_NAMES.length],
      stopsCount: routeDeliveries.length,
      averagePHome: parseFloat(avgPHome.toFixed(3)),
      routeCoordinates: coords,
      baselineCoordinates: baselineCoords,
      color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length],
      visible: true,
    });
  });

  return {
    deliveries,
    vehicles,
    runMeta: {
      runId: detail.run_id,
      seed: detail.seed,
      dayOfWeek: detail.day_of_week,
      nStops: detail.n_stops,
      nVehicles: detail.n_vehicles,
      improvementPct: detail.improvement_pct,
      baselineRedeliveryRate: detail.baseline.redelivery_rate,
      takumiRedeliveryRate: detail.takumi.redelivery_rate,
      baselineRouteSeconds: detail.baseline.total_route_time_seconds,
      takumiRouteSeconds: detail.takumi.total_route_time_seconds,
      solverTimeMs: detail.solver_time_ms,
    },
  };
}

// ── AUTH STORE ───────────────────────────────────────────────────────

interface AuthStore {
  user: api.UserResponse | null;
  authChecked: boolean;
  authError: string | null;
  isSubmitting: boolean;
  checkAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  authChecked: false,
  authError: null,
  isSubmitting: false,

  checkAuth: async () => {
    // If the session can't be recovered (refresh failed), fall back to the
    // sign-in gate instead of letting every call fail silently.
    api.setUnauthorizedHandler(() => {
      set({ user: null, authChecked: true });
    });
    if (!api.getToken()) {
      set({ authChecked: true, user: null });
      return;
    }
    try {
      const user = await api.fetchMe();
      set({ user, authChecked: true });
    } catch {
      set({ user: null, authChecked: true });
    }
  },

  signIn: async (email, password) => {
    set({ isSubmitting: true, authError: null });
    try {
      await api.login(email, password);
      const user = await api.fetchMe();
      set({ user, isSubmitting: false });
    } catch (e) {
      set({
        isSubmitting: false,
        authError: e instanceof Error ? e.message : 'Sign-in failed',
      });
    }
  },

  signUp: async (email, password) => {
    set({ isSubmitting: true, authError: null });
    try {
      await api.register(email, password);
      await api.login(email, password);
      const user = await api.fetchMe();
      set({ user, isSubmitting: false });
    } catch (e) {
      set({
        isSubmitting: false,
        authError: e instanceof Error ? e.message : 'Registration failed',
      });
    }
  },

  signOut: () => {
    api.logout();
  },
}));

// ── DELIVERY STORE ───────────────────────────────────────────────────

type PageId = 'landing' | 'dashboard' | 'map' | 'deliveries' | 'simulation' | 'ml';

interface DeliveryStore {
  selectedDate: string;
  activeVehicleId: string | null;
  selectedDeliveryId: string | null;
  currentPage: PageId;
  deliveries: Delivery[];
  vehicles: Vehicle[];
  runMeta: RunMeta | null;
  isLoadingDay: boolean;
  dayError: string | null;

  setSelectedDate: (date: string) => void;
  setActiveVehicleId: (id: string | null) => void;
  setSelectedDeliveryId: (id: string | null) => void;
  setCurrentPage: (page: PageId) => void;
  toggleVehicleVisibility: (vehicleId: string) => void;
  updateDeliveryStatus: (
    id: string,
    status: 'confirmed' | 'pending' | 'flagged',
    pHome?: number,
    slotCode?: string,
  ) => void;
  triggerReoptimization: () => void;
  loadDay: (opts?: { seed?: number }) => Promise<void>;
  reoptimizeDay: () => Promise<void>;
}

export const useDeliveryStore = create<DeliveryStore>((set, get) => ({
  selectedDate: new Date().toISOString().slice(0, 10),
  activeVehicleId: null,
  selectedDeliveryId: null,
  currentPage: 'landing',
  deliveries: [],
  vehicles: [],
  runMeta: null,
  isLoadingDay: false,
  dayError: null,

  setSelectedDate: (selectedDate) => {
    set({ selectedDate });
    // A new operating day means a fresh dispatch plan.
    void get().loadDay();
  },
  setActiveVehicleId: (activeVehicleId) => set({ activeVehicleId }),
  setSelectedDeliveryId: (selectedDeliveryId) => set({ selectedDeliveryId }),
  setCurrentPage: (currentPage) => set({ currentPage }),

  toggleVehicleVisibility: (vehicleId) =>
    set((state) => ({
      vehicles: state.vehicles.map((v) =>
        v.id === vehicleId ? { ...v, visible: !v.visible } : v,
      ),
    })),

  updateDeliveryStatus: (id, status, pHome, slotCode) =>
    set((state) => {
      const updatedDeliveries = state.deliveries.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          status,
          pHome: pHome !== undefined ? pHome : d.pHome,
          ...(slotCode
            ? { scheduledSlotCode: slotCode, scheduledSlot: slotLabel(slotCode) }
            : {}),
        };
      });

      const delivery = state.deliveries.find((d) => d.id === id);
      let updatedVehicles = state.vehicles;
      if (delivery) {
        const vDeliveries = updatedDeliveries.filter((d) => d.vehicleId === delivery.vehicleId);
        const avg =
          vDeliveries.reduce((sum, d) => sum + d.pHome, 0) / Math.max(1, vDeliveries.length);
        updatedVehicles = state.vehicles.map((v) =>
          v.id === delivery.vehicleId ? { ...v, averagePHome: parseFloat(avg.toFixed(3)) } : v,
        );
      }

      return { deliveries: updatedDeliveries, vehicles: updatedVehicles };
    }),

  // Visual path-shift cue when the server reports a completed replan (the
  // replan response carries aggregates, not new geometry).
  triggerReoptimization: () =>
    set((state) => ({
      vehicles: state.vehicles.map((v) => {
        if (state.activeVehicleId && v.id !== state.activeVehicleId) return v;
        const coords = [...v.routeCoordinates];
        if (coords.length > 4) {
          const i1 = 2;
          const i2 = coords.length - 3;
          [coords[i1], coords[i2]] = [coords[i2], coords[i1]];
        }
        return { ...v, routeCoordinates: coords };
      }),
    })),

  loadDay: async (opts) => {
    const state = get();
    if (state.isLoadingDay) return;
    const dayOfWeek = dateToDayOfWeek(state.selectedDate);
    set({ isLoadingDay: true, dayError: null });

    try {
      const detail = await api.runDetailedSimulation({
        n_stops: 60,
        n_vehicles: 8,
        slot_code: 'am',
        day_of_week: dayOfWeek,
        seed: opts?.seed,
        solver_time_limit_seconds: 3,
      });
      const { deliveries, vehicles, runMeta } = mapDetailedResult(detail);

      // Enroll the most at-risk stops in agent outreach (real orders in the
      // backend, coordinated by the constrained agent loop).
      try {
        const session = await api.createAgentSession({
          n_orders: 12,
          day_of_week: dayOfWeek,
        });
        const atRisk = [...deliveries]
          .sort((a, b) => a.pHome - b.pHome)
          .slice(0, session.orders.length);
        atRisk.forEach((d, i) => {
          d.orderId = session.orders[i].order_id;
        });
        useAgentStore.getState().setSession(session.session_id, dayOfWeek);
      } catch {
        useAgentStore.getState().setSession(null, dayOfWeek);
      }

      set({ deliveries, vehicles, runMeta, isLoadingDay: false, selectedDeliveryId: null });
      useAgentStore.getState().seedThreads(deliveries);
      useAgentStore.getState().addEvent({
        type: 'status_update',
        delivery_id: 'DISPATCH',
        recipient_name: 'Fleetwide',
        message: `Dispatch plan solved: ${deliveries.length} stops across ${vehicles.length} vehicles. Redelivery projection ${(runMeta.takumiRedeliveryRate * 100).toFixed(1)}% (baseline ${(runMeta.baselineRedeliveryRate * 100).toFixed(1)}%).`,
        timestamp: nowTimestamp(),
      });
    } catch (e) {
      set({
        isLoadingDay: false,
        dayError: e instanceof Error ? e.message : 'Failed to load dispatch plan',
      });
    }
  },

  reoptimizeDay: async () => {
    // A fresh seed re-solves the full prize-collecting VRPTW server-side.
    await get().loadDay({ seed: Math.floor(Math.random() * 2 ** 31) });
  },
}));

// ── MAP STORE ────────────────────────────────────────────────────────

interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MapStore {
  viewState: MapViewState;
  setViewState: (viewState: Partial<MapViewState>) => void;
  showBaseline: boolean;
  setShowBaseline: (show: boolean) => void;
  hoveredStop: {
    x: number;
    y: number;
    delivery: Delivery | null;
  } | null;
  setHoveredStop: (hover: { x: number; y: number; delivery: Delivery | null } | null) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  viewState: {
    longitude: KOTO_CENTER_LNG,
    latitude: KOTO_CENTER_LAT,
    zoom: 12.5,
    pitch: 30,
    bearing: 0,
  },
  setViewState: (viewState) =>
    set((state) => ({ viewState: { ...state.viewState, ...viewState } })),
  showBaseline: false,
  setShowBaseline: (showBaseline) => set({ showBaseline }),
  hoveredStop: null,
  setHoveredStop: (hoveredStop) => set({ hoveredStop }),
}));

// ── AGENT STORE ──────────────────────────────────────────────────────

interface ChatMessage {
  sender: 'agent' | 'recipient' | 'system';
  message: string;
  timestamp: string;
}

interface AgentStore {
  events: AgentEvent[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  chatThreads: Record<string, ChatMessage[]>;
  sessionId: string | null;
  dayOfWeek: number;
  isReplanning: boolean;

  setSession: (sessionId: string | null, dayOfWeek: number) => void;
  seedThreads: (deliveries: Delivery[]) => void;
  addEvent: (event: Omit<AgentEvent, 'id'>) => void;
  addChatMessage: (
    deliveryId: string,
    sender: 'agent' | 'recipient' | 'system',
    message: string,
  ) => void;
  sendRecipientMessage: (deliveryId: string, message: string) => Promise<void>;
  runReplan: (
    reason: 'recipient_unavailable' | 'window_changed' | 'traffic' | 'manual',
  ) => Promise<api.ReplanResult | null>;
  connectWebSocket: () => () => void;
}

// Global hook registry for event toast display
let toastCallback: ((event: AgentEvent) => void) | null = null;
export const registerToastCallback = (callback: (event: AgentEvent) => void) => {
  toastCallback = callback;
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  events: [],
  connectionStatus: 'disconnected',
  chatThreads: {},
  sessionId: null,
  dayOfWeek: 2,
  isReplanning: false,

  setSession: (sessionId, dayOfWeek) => set({ sessionId, dayOfWeek }),

  seedThreads: (deliveries) => {
    const threads: Record<string, ChatMessage[]> = {};
    for (const d of deliveries) {
      if (d.orderId) {
        threads[d.id] = [
          {
            sender: 'system',
            message: `Outreach enrolled: absence risk ${(100 - d.pHome * 100).toFixed(0)}% in assigned window (p_home ${d.pHome.toFixed(2)}).`,
            timestamp: nowTimestamp(),
          },
          {
            sender: 'agent',
            message: `Hello! This is TakumiRoute Logistics. We have a parcel scheduled for you in the ${d.scheduledSlot} window today. Will you be available then?`,
            timestamp: nowTimestamp(),
          },
        ];
      }
    }
    set({ chatThreads: threads });
  },

  addEvent: (evt) => {
    const newEvent: AgentEvent = { ...evt, id: `E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    set((state) => ({ events: [newEvent, ...state.events].slice(0, 50) }));
    if (toastCallback) toastCallback(newEvent);
  },

  addChatMessage: (deliveryId, sender, message) =>
    set((state) => ({
      chatThreads: {
        ...state.chatThreads,
        [deliveryId]: [
          ...(state.chatThreads[deliveryId] || []),
          { sender, message, timestamp: nowTimestamp() },
        ],
      },
    })),

  /**
   * Deliver a recipient message to the constrained agent loop.
   *
   * The typed text plays the recipient's side (like a LINE reply). The
   * backend parses it into `SlotCode | None` — prompt-injection text simply
   * produces NO_ACTION and a clarifying reply.
   */
  sendRecipientMessage: async (deliveryId, message) => {
    const { addChatMessage, addEvent, dayOfWeek, sessionId } = get();
    const delivery = useDeliveryStore.getState().deliveries.find((d) => d.id === deliveryId);
    if (!delivery) return;

    addChatMessage(deliveryId, 'recipient', message);

    if (!delivery.orderId) {
      addChatMessage(
        deliveryId,
        'system',
        'This stop is not enrolled in active outreach (absence risk below threshold). Run a new dispatch plan to refresh enrollment.',
      );
      return;
    }

    try {
      const result = await api.sendAgentMessage({
        order_id: delivery.orderId,
        message,
        day_of_week: dayOfWeek,
      });
      addChatMessage(deliveryId, 'agent', result.reply);

      if (result.confirmed_slot) {
        const slotPrediction = delivery.predictions.find(
          (p) => p.slotCode === result.confirmed_slot,
        );
        const nextPHome = Math.max(delivery.pHome, slotPrediction?.pHome ?? 0.9);
        useDeliveryStore
          .getState()
          .updateDeliveryStatus(deliveryId, 'confirmed', nextPHome, result.confirmed_slot);
        addEvent({
          type: 'slot_confirmed',
          delivery_id: deliveryId,
          recipient_name: delivery.recipientName,
          message: `Agent locked the ${slotLabel(result.confirmed_slot)} window (action: ${result.action}). p_home now ${(nextPHome * 100).toFixed(0)}%.`,
          timestamp: nowTimestamp(),
          slot_confirmed: true,
        });
        if (sessionId) {
          void get().runReplan('window_changed');
        }
      } else {
        addEvent({
          type: 'incoming_msg',
          delivery_id: deliveryId,
          recipient_name: delivery.recipientName,
          message: `Agent action: ${result.action}. No time signal parsed from recipient text — no state changed.`,
          timestamp: nowTimestamp(),
        });
      }
    } catch (e) {
      addChatMessage(
        deliveryId,
        'system',
        `Agent loop rejected the message: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
  },

  /** Trigger a real server-side re-optimization for the outreach session. */
  runReplan: async (reason) => {
    const { sessionId, addEvent, isReplanning } = get();
    if (!sessionId || isReplanning) return null;
    set({ isReplanning: true });
    try {
      const result = await api.requestReplan({ session_id: sessionId, reason_code: reason });
      addEvent({
        type: 'reoptimize',
        delivery_id: 'REPLAN',
        recipient_name: 'Fleetwide',
        message: `Replan (${reason}) ${result.status}: ${result.stops_visited} stops across ${result.vehicles_used} vehicle(s), ${Math.round(result.total_seconds / 60)} min of drive time.`,
        timestamp: nowTimestamp(),
        reoptimize_triggered: true,
      });
      useDeliveryStore.getState().triggerReoptimization();
      return result;
    } catch (e) {
      addEvent({
        type: 'status_update',
        delivery_id: 'REPLAN',
        recipient_name: 'Fleetwide',
        message: `Replan failed: ${e instanceof Error ? e.message : 'unknown error'}`,
        timestamp: nowTimestamp(),
      });
      return null;
    } finally {
      set({ isReplanning: false });
    }
  },

  /** Live event feed from the backend (`/ws/live`, same-origin proxy). */
  connectWebSocket: () => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      set({ connectionStatus: 'connecting' });
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      try {
        ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      } catch {
        set({ connectionStatus: 'disconnected' });
        return;
      }

      ws.onopen = () => set({ connectionStatus: 'connected' });

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type?: string;
            data?: Record<string, unknown>;
          };
          if (payload.type === 'route_update' && payload.data) {
            get().addEvent({
              type: 'reoptimize',
              delivery_id: 'LIVE',
              recipient_name: 'Fleetwide',
              message: `Live route update: ${String(payload.data.stops_visited ?? '?')} stops re-sequenced (${String(payload.data.reason ?? 'server event')}).`,
              timestamp: nowTimestamp(),
              reoptimize_triggered: true,
            });
          }
        } catch {
          // Non-JSON frames (acks) are ignored.
        }
      };

      ws.onclose = () => {
        set({ connectionStatus: 'disconnected' });
        if (!closed) retryTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  },
}));

// ── SIMULATION STORE ─────────────────────────────────────────────────

interface SimulationStore {
  nDeliveries: number;
  nVehicles: number;
  simSelectedDate: string;
  isSimulating: boolean;
  results: SimulationResult | null;
  simError: string | null;

  setNDeliveries: (n: number) => void;
  setNVehicles: (n: number) => void;
  setSimSelectedDate: (date: string) => void;
  triggerSimulation: () => Promise<void>;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  nDeliveries: 100,
  nVehicles: 6,
  simSelectedDate: new Date().toISOString().slice(0, 10),
  isSimulating: false,
  results: null,
  simError: null,

  setNDeliveries: (nDeliveries) => set({ nDeliveries }),
  setNVehicles: (nVehicles) => set({ nVehicles }),
  setSimSelectedDate: (simSelectedDate) => set({ simSelectedDate }),

  triggerSimulation: async () => {
    const { nDeliveries, nVehicles, simSelectedDate, isSimulating } = get();
    if (isSimulating) return;
    set({ isSimulating: true, simError: null });

    const dayOfWeek = dateToDayOfWeek(simSelectedDate);
    const nStops = Math.min(200, Math.max(5, nDeliveries));
    const nVeh = Math.min(20, Math.max(1, nVehicles));

    try {
      const [run, benchmark] = await Promise.all([
        api.runSimulation({
          n_stops: nStops,
          n_vehicles: nVeh,
          slot_code: 'am',
          day_of_week: dayOfWeek,
          solver_time_limit_seconds: 5,
        }),
        api
          .runBenchmark({
            n_stops: Math.min(60, nStops),
            n_vehicles: Math.min(10, nVeh),
            time_limit_seconds: 5,
          })
          .catch(() => null),
      ]);

      const co2PerHourKg = 2.3; // kei-truck urban proxy factor
      const baselineHours = run.baseline.total_route_time_seconds / 3600;
      const takumiHours = run.takumi.total_route_time_seconds / 3600;

      set({
        isSimulating: false,
        results: {
          active: true,
          runId: run.run_id,
          improvementPct: run.improvement_pct,
          metrics: {
            baseline: {
              redeliveryRate: parseFloat((run.baseline.redelivery_rate * 100).toFixed(1)),
              driverHours: parseFloat(baselineHours.toFixed(1)),
              co2: parseFloat((baselineHours * co2PerHourKg).toFixed(1)),
              parcels: run.n_stops,
            },
            takumi: {
              redeliveryRate: parseFloat((run.takumi.redelivery_rate * 100).toFixed(1)),
              driverHours: parseFloat(takumiHours.toFixed(1)),
              co2: parseFloat((takumiHours * co2PerHourKg).toFixed(1)),
              parcels: run.n_stops,
            },
          },
          benchmark: benchmark
            ? {
                ortools: { timeMs: benchmark.ortools.wall_time_ms, gap: 0 },
                pyvrp: { timeMs: benchmark.pyvrp.wall_time_ms, gap: benchmark.gap_pct },
              }
            : null,
        },
      });
    } catch (e) {
      set({
        isSimulating: false,
        simError: e instanceof Error ? e.message : 'Simulation failed',
      });
    }
  },
}));

// ── ML STORE ─────────────────────────────────────────────────────────

interface MlStore {
  metrics: api.TrainMetrics | null;
  isTraining: boolean;
  mlError: string | null;
  train: () => Promise<void>;
}

export const useMlStore = create<MlStore>((set, get) => ({
  metrics: null,
  isTraining: false,
  mlError: null,

  train: async () => {
    if (get().isTraining) return;
    set({ isTraining: true, mlError: null });
    try {
      const metrics = await api.trainModel();
      set({ metrics, isTraining: false });
    } catch (e) {
      set({
        isTraining: false,
        mlError: e instanceof Error ? e.message : 'Training failed',
      });
    }
  },
}));
