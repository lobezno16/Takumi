import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { LineLayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRunDetailedSimulation } from '@/api/client';
import type { DetailedSimulationResult, RouteStopDetail } from '@/api/client';
import { useAppStore } from '@/store/app';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  addressFor,
  availabilityStatus,
  confidence,
  deriveOps,
  driverLabel,
  recipientFor,
  slotWindow,
  type Tone,
} from '@/lib/ops';
import { StatusBadge, PrimaryButton } from '@/components/ui';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const ROUTE_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444',
];

const routeColor = (i: number): string => ROUTE_COLORS.at(i % ROUTE_COLORS.length) ?? '#6366f1';

function toneHex(tone: Tone): string {
  switch (tone) {
    case 'success': return '#10b981';
    case 'danger': return '#ef4444';
    case 'info': return '#6366f1';
    case 'warning': return '#f59e0b';
    default: return '#94a3b8';
  }
}

type Policy = 'baseline' | 'takumi';

interface SelectedStop {
  stop: RouteStopDetail;
  driver: string;
  color: string;
}

const lineLayer: LineLayerSpecification = {
  id: 'routes',
  type: 'line',
  source: 'routes',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 3,
    'line-opacity': 0.7,
  },
};

// Public OSRM routing service — token-free; snaps a sequence of waypoints to
// the real road network. Falls back to straight segments if unavailable.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

type RouteFeature = {
  type: 'Feature';
  properties: { color: string };
  geometry: { type: 'LineString'; coordinates: number[][] };
};
type RouteFC = { type: 'FeatureCollection'; features: RouteFeature[] };

function lineFeature(coordinates: number[][], color: string): RouteFeature {
  return { type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates } };
}

async function snapToRoads(waypoints: number[][]): Promise<number[][]> {
  const path = waypoints.map((c) => `${c[0]},${c[1]}`).join(';');
  const res = await fetch(`${OSRM_BASE}/${path}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error('routing unavailable');
  const data = (await res.json()) as {
    routes?: { geometry?: { coordinates: number[][] } }[];
  };
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords || coords.length === 0) throw new Error('no geometry');
  return coords;
}

function DetailSidebar({ selection, onClose }: { selection: SelectedStop; onClose: () => void }) {
  const { stop, driver, color } = selection;
  const status = availabilityStatus(stop.predicted_prob);
  const conf = confidence(stop.predicted_prob);
  return (
    <div className="absolute right-3 top-3 bottom-3 z-10 w-80 overflow-y-auto rounded-2xl border border-surface-lighter bg-surface-light/95 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between border-b border-surface-lighter p-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-secondary">Delivery stop</p>
          <h4 className="mt-0.5 text-base font-semibold text-text-primary">
            {recipientFor(stop.stop_id, stop.sequence)}
          </h4>
        </div>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary" aria-label="Close">✕</button>
      </div>
      <div className="space-y-4 p-4">
        <Field label="Address">{addressFor(stop.latitude, stop.longitude)}</Field>
        <Field label="Delivery window">{slotWindow(stop.assigned_slot)}</Field>
        <Field label="Planned arrival">~{Math.floor(stop.arrival_min / 60) + 8}:{String(stop.arrival_min % 60).padStart(2, '0')} (stop {stop.sequence + 1})</Field>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-text-secondary">Availability status</p>
          <StatusBadge label={status.label} tone={status.tone} />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-text-secondary">Delivery confidence</p>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-lighter">
              <div className="h-full rounded-full" style={{ width: `${conf.pct}%`, backgroundColor: toneHex(conf.tone) }} />
            </div>
            <span className="text-sm font-semibold text-text-primary">{conf.label} ({conf.pct}%)</span>
          </div>
        </div>
        <Field label="Assigned to">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {driver}
          </span>
        </Field>
        <div className="rounded-lg border border-surface-lighter bg-surface p-3 text-xs text-text-secondary">
          {stop.outcome === 'success'
            ? 'Projected: delivered on first attempt — no redelivery expected.'
            : 'Projected: recipient likely out — flagged for a window adjustment via the Communication Hub.'}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[11px] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="text-sm text-text-primary">{children}</p>
    </div>
  );
}

function PlanMap({ result, policy, onSelect }: { result: DetailedSimulationResult; policy: Policy; onSelect: (s: SelectedStop | null) => void }) {
  const routes = policy === 'takumi' ? result.takumi_routes : result.baseline_routes;
  const { depot_lon, depot_lat } = result;

  // Straight segments render instantly; road-snapped geometry replaces them
  // once OSRM responds (with a graceful fallback to the straight lines).
  const straightFC = useMemo<RouteFC>(
    () => ({
      type: 'FeatureCollection',
      features: routes.map((r, i) =>
        lineFeature(
          [
            [depot_lon, depot_lat],
            ...r.stops.map((s) => [s.longitude, s.latitude]),
            [depot_lon, depot_lat],
          ],
          routeColor(i),
        ),
      ),
    }),
    [routes, depot_lon, depot_lat],
  );

  const [roadFC, setRoadFC] = useState<RouteFC | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRoadFC(null);
    void (async () => {
      const features = await Promise.all(
        routes.map(async (r, i) => {
          const waypoints = [
            [depot_lon, depot_lat],
            ...r.stops.map((s) => [s.longitude, s.latitude]),
            [depot_lon, depot_lat],
          ];
          try {
            return lineFeature(await snapToRoads(waypoints), routeColor(i));
          } catch {
            return lineFeature(waypoints, routeColor(i));
          }
        }),
      );
      if (!cancelled) setRoadFC({ type: 'FeatureCollection', features });
    })();
    return () => {
      cancelled = true;
    };
  }, [routes, depot_lon, depot_lat]);

  const routeGeoJSON = roadFC ?? straightFC;

  return (
    <Map
      initialViewState={{ longitude: depot_lon, latitude: depot_lat, zoom: 12.4 }}
      mapStyle={MAP_STYLE}
      style={{ width: '100%', height: '100%' }}
      onClick={() => onSelect(null)}
    >
      <NavigationControl position="bottom-right" showCompass={false} />
      <Source id="routes" type="geojson" data={routeGeoJSON}>
        <Layer {...lineLayer} />
      </Source>

      {/* Depot */}
      <Marker longitude={result.depot_lon} latitude={result.depot_lat} anchor="center">
        <div className="flex flex-col items-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-lg ring-2 ring-white">🏬</div>
        </div>
      </Marker>

      {routes.map((route, ri) =>
        route.stops.map((stop) => {
          const tone = availabilityStatus(stop.predicted_prob).tone;
          return (
            <Marker
              key={stop.stop_id}
              longitude={stop.longitude}
              latitude={stop.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect({ stop, driver: driverLabel(route.vehicle_id, ri), color: routeColor(ri) });
              }}
            >
              <div
                className="h-3.5 w-3.5 cursor-pointer rounded-full ring-2 ring-white transition-transform hover:scale-150"
                style={{ backgroundColor: toneHex(tone) }}
                title={`Stop ${stop.sequence + 1}`}
              />
            </Marker>
          );
        }),
      )}
    </Map>
  );
}

export function MapPage() {
  const { lastDetailed, setLastDetailed } = useAppStore();
  const simMutation = useRunDetailedSimulation();
  const [policy, setPolicy] = useState<Policy>('takumi');
  const [selected, setSelected] = useState<SelectedStop | null>(null);
  const { isConnected } = useWebSocket('/ws/live');

  const handleRun = useCallback(() => {
    setSelected(null);
    simMutation.mutate(
      { n_stops: 44, n_vehicles: 5, slot_code: 'am', day_of_week: 2 },
      { onSuccess: (data) => setLastDetailed(data) },
    );
  }, [simMutation, setLastDetailed]);

  const ops = useMemo(
    () => (lastDetailed ? deriveOps(lastDetailed.baseline, lastDetailed.takumi, lastDetailed.n_vehicles) : null),
    [lastDetailed],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Live Route Map</h2>
          <p className="mt-0.5 text-sm text-text-secondary">Kōtō-ku, Tokyo — delivery stops by availability status</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-text-secondary/40'}`} />
            {isConnected ? 'Live sync' : 'Offline'}
          </span>
          <PrimaryButton onClick={handleRun} loading={simMutation.isPending}>
            {simMutation.isPending ? 'Optimizing…' : lastDetailed ? 'Re-plan Routes' : 'Generate Plan'}
          </PrimaryButton>
        </div>
      </div>

      {lastDetailed && ops && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-surface-lighter bg-surface-light p-1">
            {(['baseline', 'takumi'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPolicy(p); setSelected(null); }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${policy === p ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {p === 'baseline' ? 'Current Plan' : 'Optimized Plan'}
              </button>
            ))}
          </div>
          <Pill label="Stops" value={`${ops.stopsPlanned}`} />
          <Pill label="Drivers" value={`${ops.fleetUsed}/${ops.fleetTotal}`} />
          <Pill label="First-attempt success" value={`${ops.firstAttemptPct.toFixed(0)}%`} tone="success" />
          {ops.redeliveriesPrevented > 0 && (
            <Pill label="Redeliveries prevented" value={`${ops.redeliveriesPrevented}`} tone="success" />
          )}
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-surface-lighter bg-surface-light" style={{ height: 620 }}>
        {!lastDetailed ? (
          <div className="flex h-full flex-col items-center justify-center text-text-secondary">
            <div className="mb-4 text-5xl">🗺️</div>
            <p className="text-lg font-medium text-text-primary">No active route plan</p>
            <p className="mt-1 text-sm">Generate a plan to see today's delivery map and stop-level status.</p>
          </div>
        ) : (
          <>
            <PlanMap result={lastDetailed} policy={policy} onSelect={setSelected} />
            {selected && <DetailSidebar selection={selected} onClose={() => setSelected(null)} />}
            <MapLegend />
          </>
        )}
      </div>
    </div>
  );
}

function Pill({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  const accent = tone === 'success' ? 'text-success' : 'text-text-primary';
  return (
    <div className="rounded-lg border border-surface-lighter bg-surface-light px-3 py-1.5">
      <span className="text-[11px] text-text-secondary">{label}</span>{' '}
      <span className={`text-sm font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

function MapLegend() {
  const items: { label: string; tone: Tone }[] = [
    { label: 'Confirmed / likely available', tone: 'success' },
    { label: 'Scheduled', tone: 'info' },
    { label: 'High absence risk', tone: 'danger' },
  ];
  return (
    <div className="absolute left-3 bottom-3 z-10 rounded-xl border border-surface-lighter bg-surface-light/95 p-3 shadow-xl backdrop-blur">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Stop status</p>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-xs text-text-primary">
            <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ backgroundColor: toneHex(it.tone) }} />
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}
