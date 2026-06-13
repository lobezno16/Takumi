import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = '/api';

// ── Auth Types ───────────────────────────────────────────────────────

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface UserResponse {
  id: string;
  email: string;
  role: string;
}

// ── Token Storage ────────────────────────────────────────────────────

let authToken: string | null = localStorage.getItem('takumi_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('takumi_token', token);
  } else {
    localStorage.removeItem('takumi_token');
  }
}

export function getToken(): string | null {
  return authToken;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Fetch Helpers ────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth API ─────────────────────────────────────────────────────────

export function useLogin() {
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      apiFetch<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => setToken(data.access_token),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) =>
      apiFetch<UserResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserResponse>('/auth/me'),
    enabled: !!getToken(),
    retry: false,
  });
}

export function logout() {
  setToken(null);
  window.location.reload();
}

// ── Simulation Types ─────────────────────────────────────────────────

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

export interface SimulationResult {
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

interface SimulationRequest {
  n_stops: number;
  n_vehicles: number;
  slot_code: string;
  day_of_week: number;
  seed?: number;
}

export interface MonteCarloResult {
  n_runs: number;
  avg_baseline_redelivery_rate: number;
  avg_takumi_redelivery_rate: number;
  avg_improvement_pct: number;
  avg_baseline_cost: number;
  avg_takumi_cost: number;
  cost_savings_pct: number;
  runs: Array<{
    run_id: string;
    seed: number;
    day_of_week: number;
    baseline_redelivery_rate: number;
    takumi_redelivery_rate: number;
    improvement_pct: number;
  }>;
}

interface MonteCarloRequest {
  n_runs: number;
  n_stops: number;
  n_vehicles: number;
  slot_code: string;
  base_seed: number;
}

// ── Detailed Simulation (route geometry for the map) ─────────────────

export interface RouteStopDetail {
  stop_id: string;
  latitude: number;
  longitude: number;
  sequence: number;
  arrival_min: number;
  assigned_slot: string;
  predicted_prob: number;
  outcome: 'success' | 'miss';
}

export interface RouteDetail {
  vehicle_id: string;
  vehicle_index: number;
  stops: RouteStopDetail[];
  duration_min: number;
  load: number;
}

export interface DetailedSimulationResult {
  run_id: string;
  ward: string;
  seed: number;
  n_stops: number;
  n_vehicles: number;
  slot_code: string;
  day_of_week: number;
  depot_lat: number;
  depot_lon: number;
  baseline: KPIs;
  takumi: KPIs;
  improvement_pct: number;
  solver_time_ms: number;
  baseline_routes: RouteDetail[];
  takumi_routes: RouteDetail[];
}

// ── Simulation API ───────────────────────────────────────────────────

export function useRunSimulation() {
  return useMutation({
    mutationFn: (data: SimulationRequest) =>
      apiFetch<SimulationResult>('/simulation/run', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useRunMonteCarlo() {
  return useMutation({
    mutationFn: (data: MonteCarloRequest) =>
      apiFetch<MonteCarloResult>('/simulation/monte-carlo', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useRunDetailedSimulation() {
  return useMutation({
    mutationFn: (data: SimulationRequest) =>
      apiFetch<DetailedSimulationResult>('/simulation/run-detailed', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

// ── Solver Benchmark (OR-Tools vs PyVRP) ─────────────────────────────

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

export function useRunBenchmark() {
  return useMutation({
    mutationFn: (data: { n_stops: number; n_vehicles: number; time_limit_seconds: number }) =>
      apiFetch<BenchmarkResult>('/optimize/benchmark', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

// ── Agent (coordination layer) ───────────────────────────────────────

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

export function useCreateAgentSession() {
  return useMutation({
    mutationFn: (data: { n_orders: number; day_of_week: number }) =>
      apiFetch<AgentSession>('/agent/session', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useSendAgentMessage() {
  return useMutation({
    mutationFn: (data: { order_id: string; message: string; day_of_week: number }) =>
      apiFetch<AgentMessageResult>('/agent/message', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useReplan() {
  return useMutation({
    mutationFn: (data: { session_id: string; reason_code: string }) =>
      apiFetch<ReplanResult>('/agent/replan', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

// ── Health (re-export) ───────────────────────────────────────────────

export { useHealth } from './health';
