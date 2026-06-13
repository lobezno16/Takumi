import { useState, useMemo, useCallback } from 'react';
import { useRunDetailedSimulation } from '@/api/client';
import type { DetailedSimulationResult, RouteDetail } from '@/api/client';
import { useAppStore } from '@/store/app';
import { useWebSocket } from '@/hooks/useWebSocket';

// Koto-ku bounding box (matches backend synthetic generator).
const KOTO_BBOX = { latMin: 35.634, latMax: 35.694, lonMin: 139.792, lonMax: 139.832 };

const VIEW_W = 800;
const VIEW_H = 600;
const PAD = 40;

// Per-vehicle route colors.
const ROUTE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
];

type Policy = 'baseline' | 'takumi';

/** Project a (lat, lng) onto SVG pixel space using the ward bounding box. */
function project(lat: number, lon: number): { x: number; y: number } {
  const { latMin, latMax, lonMin, lonMax } = KOTO_BBOX;
  const x = PAD + ((lon - lonMin) / (lonMax - lonMin)) * (VIEW_W - 2 * PAD);
  // Latitude grows north → invert for screen-y.
  const y = PAD + ((latMax - lat) / (latMax - latMin)) * (VIEW_H - 2 * PAD);
  return { x, y };
}

function MapLegend({ routes }: { routes: RouteDetail[] }) {
  return (
    <div className="absolute top-4 right-4 bg-surface-light/95 backdrop-blur-sm rounded-xl border border-surface-lighter p-4 shadow-xl max-w-xs">
      <h4 className="text-xs font-semibold text-text-primary mb-3">Vehicles</h4>
      <div className="space-y-2">
        {routes.map((route, i) => (
          <div key={route.vehicle_id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }}
            />
            <span className="text-xs text-text-primary font-medium">{route.vehicle_id}</span>
            <span className="text-[10px] text-text-secondary ml-auto">
              {route.stops.length} stops · {route.duration_min}min
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-surface-lighter flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span className="w-2.5 h-2.5 rounded-full bg-success" /> Delivered
        </span>
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span className="w-2.5 h-2.5 rounded-full bg-danger" /> Missed
        </span>
      </div>
    </div>
  );
}

function RouteLayer({
  routes,
  depot,
}: {
  routes: RouteDetail[];
  depot: { x: number; y: number };
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      {routes.map((route, ri) => {
        const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
        const placed = route.stops.map((stop) => ({ stop, ...project(stop.latitude, stop.longitude) }));
        // depot → stops → depot as one polyline (avoids per-leg index access).
        const path = [depot, ...placed, depot].map((p) => `${p.x},${p.y}`).join(' ');
        return (
          <g key={route.vehicle_id}>
            <polyline points={path} fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.55" />
            {placed.map(({ stop, x, y }) => {
              const isHovered = hovered === stop.stop_id;
              const fill = stop.outcome === 'success' ? '#10b981' : '#ef4444';
              return (
                <g
                  key={stop.stop_id}
                  transform={`translate(${x}, ${y})`}
                  onMouseEnter={() => setHovered(stop.stop_id)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <circle
                    r={isHovered ? 8 : 5} fill={fill}
                    stroke="white" strokeWidth="1.5"
                    className="transition-all duration-150"
                  />
                  {isHovered && (
                    <g transform="translate(10, -10)">
                      <rect x="-2" y="-22" width="146" height="42" rx="4" fill="#1e293b" stroke="#334155" />
                      <text y="-9" className="fill-text-primary" style={{ fontSize: '9px' }}>
                        Stop {stop.sequence + 1} · {stop.assigned_slot} · {stop.arrival_min}min
                      </text>
                      <text y="3" className="fill-text-secondary" style={{ fontSize: '8px' }}>
                        P(home) = {(stop.predicted_prob * 100).toFixed(0)}%
                      </text>
                      <text
                        y="14"
                        style={{ fontSize: '8px', fontWeight: 600 }}
                        className={stop.outcome === 'success' ? 'fill-success' : 'fill-danger'}
                      >
                        {stop.outcome === 'success' ? '✓ Delivered first attempt' : '✗ Redelivery needed'}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

function MapCanvas({ result, policy }: { result: DetailedSimulationResult; policy: Policy }) {
  const routes = policy === 'takumi' ? result.takumi_routes : result.baseline_routes;
  const depot = project(result.depot_lat, result.depot_lon);
  const kpis = policy === 'takumi' ? result.takumi : result.baseline;

  return (
    <div className="relative bg-surface-light rounded-2xl border border-surface-lighter overflow-hidden" style={{ height: '600px' }}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="#0f172a" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" />
        <text x={VIEW_W / 2} y={24} textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '11px' }}>
          Kōtō-ku, Tokyo — {result.n_stops} stops · {routes.length} vehicles ·{' '}
          {policy === 'takumi' ? 'per-recipient slots' : `baseline window: ${result.slot_code}`}
        </text>

        <RouteLayer routes={routes} depot={depot} />

        {/* depot marker on top */}
        <g transform={`translate(${depot.x}, ${depot.y})`}>
          <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#6366f1" stroke="white" strokeWidth="2" />
          <text y="24" textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '10px' }}>Depot</text>
        </g>
      </svg>

      <MapLegend routes={routes} />

      <div className="absolute bottom-4 left-4 bg-surface-light/95 backdrop-blur-sm rounded-xl border border-surface-lighter p-4 shadow-xl">
        <div className="grid grid-cols-3 gap-5 text-center">
          <div>
            <div className="text-lg font-bold text-success">
              {(kpis.first_attempt_success_rate * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-text-secondary">First-Attempt</div>
          </div>
          <div>
            <div className="text-lg font-bold text-danger">{kpis.deliveries_failed}</div>
            <div className="text-[10px] text-text-secondary">Redeliveries</div>
          </div>
          <div>
            <div className="text-lg font-bold text-warning">¥{kpis.cost_estimate.toFixed(0)}</div>
            <div className="text-[10px] text-text-secondary">Est. Cost</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MapPage() {
  const { lastDetailed, setLastDetailed } = useAppStore();
  const simMutation = useRunDetailedSimulation();
  const [policy, setPolicy] = useState<Policy>('takumi');
  const { isConnected } = useWebSocket('/api/ws/live');

  const handleRun = useCallback(() => {
    simMutation.mutate(
      { n_stops: 40, n_vehicles: 4, slot_code: 'am', day_of_week: 2 },
      { onSuccess: (data) => setLastDetailed(data) },
    );
  }, [simMutation, setLastDetailed]);

  const redeliverySaved = useMemo(() => {
    if (!lastDetailed) return 0;
    return lastDetailed.baseline.deliveries_failed - lastDetailed.takumi.deliveries_failed;
  }, [lastDetailed]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-text-primary">Route Map</h2>
          <p className="mt-1 text-text-secondary">Optimized delivery routes in Kōtō-ku, colored by first-attempt outcome</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-text-secondary/40'}`} />
            {isConnected ? 'Live' : 'Offline'}
          </span>
          <button
            onClick={handleRun}
            disabled={simMutation.isPending}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-medium shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50"
          >
            {simMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Optimizing…
              </span>
            ) : 'Generate Routes'}
          </button>
        </div>
      </div>

      {lastDetailed && (
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-lg bg-surface-light border border-surface-lighter">
            {(['baseline', 'takumi'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPolicy(p)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  policy === p ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {p === 'baseline' ? 'Baseline (FIFO)' : 'Takumi (ML-optimized)'}
              </button>
            ))}
          </div>
          {redeliverySaved > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20 text-sm font-medium">
              {redeliverySaved} fewer redeliveries vs baseline
            </div>
          )}
        </div>
      )}

      {!lastDetailed ? (
        <div
          className="relative bg-surface-light rounded-2xl border border-surface-lighter flex flex-col items-center justify-center text-text-secondary"
          style={{ height: '600px' }}
        >
          <div className="text-5xl mb-4">🗺️</div>
          <p className="text-lg font-medium">No routes to display</p>
          <p className="text-sm mt-1">Generate routes to visualize the optimized delivery day</p>
        </div>
      ) : (
        <MapCanvas result={lastDetailed} policy={policy} />
      )}

      {simMutation.error && (
        <div className="px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
          {simMutation.error.message}
        </div>
      )}
    </div>
  );
}
