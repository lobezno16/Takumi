/**
 * TakumiRoute API client — thin typed fetch layer over the FastAPI backend.
 *
 * All requests go through the same-origin `/api` prefix (Vite dev proxy or
 * nginx in production), carrying the JWT access token when present.
 */

const API_BASE = '/api';

// ── Token storage ────────────────────────────────────────────────────

let authToken: string | null = localStorage.getItem('takumi_token');
let refreshToken: string | null = localStorage.getItem('takumi_refresh');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('takumi_token', token);
  } else {
    localStorage.removeItem('takumi_token');
  }
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  if (token) {
    localStorage.setItem('takumi_refresh', token);
  } else {
    localStorage.removeItem('takumi_refresh');
  }
}

export function getToken(): string | null {
  return authToken;
}

// Invoked when the session cannot be recovered (refresh failed) so the UI
// can drop back to the sign-in gate. Registered by the auth store to avoid
// a circular import.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function rawFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new ApiError(res.status, body.detail || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access_token: string };
      setToken(data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    return await rawFetch<T>(path, options);
  } catch (e) {
    // Expired access token: refresh once and retry the original request.
    if (e instanceof ApiError && e.status === 401 && !path.startsWith('/auth/')) {
      if (await tryRefresh()) {
        return rawFetch<T>(path, options);
      }
      setToken(null);
      setRefreshToken(null);
      onUnauthorized?.();
    }
    throw e;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  email: string;
  role: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
}

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  setRefreshToken(data.refresh_token ?? null);
}

export async function register(email: string, password: string): Promise<UserResponse> {
  return apiFetch<UserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMe(): Promise<UserResponse> {
  return apiFetch<UserResponse>('/auth/me');
}

export function logout() {
  setToken(null);
  setRefreshToken(null);
  window.location.reload();
}

// ── Health ───────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  return apiFetch('/health');
}

// ── Simulation ───────────────────────────────────────────────────────

export interface KPIs {
  total_stops: number;
  stops_attempted: number;
  stops_skipped: number;
  deliveries_successful: number;
  deliveries_failed: number;
  first_attempt_success_rate: number;
  redelivery_rate: number;
  total_route_time_seconds: number;
  avg_route_time_seconds: number;
  total_vehicles_used: number;
  cost_estimate: number;
}

export interface SimulationRequest {
  n_stops: number;
  n_vehicles: number;
  slot_code: string;
  day_of_week: number;
  seed?: number;
  solver_time_limit_seconds?: number;
}

export interface SimulationRunResult {
  run_id: string;
  ward: string;
  seed: number;
  n_stops: number;
  n_vehicles: number;
  slot_code: string;
  day_of_week: number;
  baseline: KPIs;
  takumi: KPIs;
  improvement_pct: number;
  solver_time_ms: number;
}

export interface RouteStopDetail {
  stop_id: string;
  latitude: number;
  longitude: number;
  sequence: number;
  arrival_min: number;
  assigned_slot: string;
  predicted_prob: number;
  outcome: 'success' | 'miss';
  address: string;
  address_type: string;
  floor: number | null;
  slot_probs: Record<string, number>;
}

export interface RouteDetail {
  vehicle_id: string;
  vehicle_index: number;
  stops: RouteStopDetail[];
  duration_min: number;
  load: number;
}

export interface DetailedSimulationResult extends SimulationRunResult {
  depot_lat: number;
  depot_lon: number;
  baseline_routes: RouteDetail[];
  takumi_routes: RouteDetail[];
}

export async function runSimulation(body: SimulationRequest): Promise<SimulationRunResult> {
  return apiFetch('/simulation/run', { method: 'POST', body: JSON.stringify(body) });
}

export async function runDetailedSimulation(
  body: SimulationRequest,
): Promise<DetailedSimulationResult> {
  return apiFetch('/simulation/run-detailed', { method: 'POST', body: JSON.stringify(body) });
}

// ── Solver benchmark ─────────────────────────────────────────────────

export interface SolverBenchmark {
  solver: string;
  feasible: boolean;
  total_route_seconds: number;
  num_routes: number;
  stops_visited: number;
  wall_time_ms: number;
}

export interface BenchmarkResult {
  n_stops: number;
  n_vehicles: number;
  ortools: SolverBenchmark;
  pyvrp: SolverBenchmark;
  gap_pct: number;
}

export async function runBenchmark(body: {
  n_stops: number;
  n_vehicles: number;
  time_limit_seconds: number;
  seed?: number;
}): Promise<BenchmarkResult> {
  return apiFetch('/optimize/benchmark', { method: 'POST', body: JSON.stringify(body) });
}

// ── Agent coordination ───────────────────────────────────────────────

export interface AgentOrder {
  order_id: string;
  address: string;
  address_type: string;
  floor: number | null;
  assigned_slot: string | null;
  best_slot: string;
  best_prob: number;
}

export interface AgentSession {
  session_id: string;
  day_of_week: number;
  orders: AgentOrder[];
}

export interface AgentMessageResult {
  order_id: string;
  action: string;
  reply: string;
  confirmed_slot: string | null;
}

export interface ReplanResult {
  session_id: string;
  reason: string;
  status: string;
  vehicles_used: number;
  stops_visited: number;
  total_seconds: number;
}

export async function createAgentSession(body: {
  n_orders: number;
  day_of_week: number;
  seed?: number;
}): Promise<AgentSession> {
  return apiFetch('/agent/session', { method: 'POST', body: JSON.stringify(body) });
}

export async function sendAgentMessage(body: {
  order_id: string;
  message: string;
  day_of_week: number;
}): Promise<AgentMessageResult> {
  return apiFetch('/agent/message', { method: 'POST', body: JSON.stringify(body) });
}

export async function requestReplan(body: {
  session_id: string;
  reason_code: 'recipient_unavailable' | 'window_changed' | 'traffic' | 'manual';
}): Promise<ReplanResult> {
  return apiFetch('/agent/replan', { method: 'POST', body: JSON.stringify(body) });
}

// ── ML ───────────────────────────────────────────────────────────────

export interface CalibrationBin {
  bin_start: number;
  bin_end: number;
  mean_predicted: number;
  observed_rate: number;
  count: number;
}

export interface TrainMetrics {
  accuracy: number;
  brier_score: number;
  log_loss: number;
  train_size: number;
  test_size: number;
  calibration_method: string;
  calibration_curve: CalibrationBin[];
  feature_importance: { name: string; importance: number }[];
}

export async function trainModel(): Promise<TrainMetrics> {
  const res = await apiFetch<{ metrics: TrainMetrics }>('/ml/train', { method: 'POST' });
  return res.metrics;
}
