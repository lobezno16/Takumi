import { useMemo } from 'react';
import { useHealth } from '@/api/health';
import { useMe, useRunDetailedSimulation } from '@/api/client';
import type { RouteDetail } from '@/api/client';
import { useAppStore } from '@/store/app';
import { deriveOps, driverLabel, INDUSTRY_BASELINE_PCT } from '@/lib/ops';
import { KpiCard, Panel, StatusBadge, PrimaryButton } from '@/components/ui';

function clock(minFromMidnight: number): string {
  const h = Math.floor(minFromMidnight / 60) % 24;
  const m = minFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const SHIFT_START_MIN = 8 * 60; // 08:00

function RouteRow({ route, index }: { route: RouteDetail; index: number }) {
  const missed = route.stops.filter((s) => s.outcome === 'miss').length;
  const eta = clock(SHIFT_START_MIN + route.duration_min);
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-lighter/30">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
        {String.fromCharCode(65 + (index % 26))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{driverLabel(route.vehicle_id, index)}</p>
        <p className="text-xs text-text-secondary">{route.stops.length} stops · {route.load} parcels onboard</p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-text-primary">{Math.floor(route.duration_min / 60)}h {route.duration_min % 60}m</p>
        <p className="text-xs text-text-secondary">est. finish {eta}</p>
      </div>
      <div className="w-32 text-right">
        {missed === 0 ? (
          <StatusBadge label="On track" tone="success" />
        ) : (
          <StatusBadge label={`${missed} at risk`} tone="warning" />
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const health = useHealth();
  const me = useMe();
  const { lastDetailed, setLastDetailed } = useAppStore();
  const simMutation = useRunDetailedSimulation();

  const ops = useMemo(
    () => (lastDetailed ? deriveOps(lastDetailed.baseline, lastDetailed.takumi, lastDetailed.n_vehicles) : null),
    [lastDetailed],
  );

  const generate = () =>
    simMutation.mutate(
      { n_stops: 52, n_vehicles: 6, slot_code: 'am', day_of_week: 2 },
      { onSuccess: (d) => setLastDetailed(d) },
    );

  const routes = lastDetailed?.takumi_routes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">
            Operations Overview{me.data ? `, ${me.data.email.split('@')[0]}` : ''}
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">Kōtō-ku dispatch · today's delivery plan</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className={`h-2 w-2 rounded-full ${health.data?.status === 'ok' ? 'bg-success' : 'bg-danger'}`} />
            {health.data?.status === 'ok' ? 'All systems operational' : 'Systems degraded'}
          </span>
          {lastDetailed && (
            <PrimaryButton onClick={generate} loading={simMutation.isPending}>Refresh Plan</PrimaryButton>
          )}
        </div>
      </div>

      {!lastDetailed ? (
        <Panel className="p-10">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="mb-4 text-5xl">🚚</div>
            <h3 className="text-lg font-semibold text-text-primary">Build today's operations board</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Generate an optimized delivery plan to see fleet utilization, redelivery performance,
              and the resources you'll save versus standard dispatch.
            </p>
            <PrimaryButton onClick={generate} loading={simMutation.isPending} className="mt-5">
              {simMutation.isPending ? 'Optimizing plan…' : 'Generate Operations Snapshot'}
            </PrimaryButton>
          </div>
        </Panel>
      ) : (
        ops && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Fleet Utilization"
                value={`${ops.fleetUsed}/${ops.fleetTotal}`}
                icon="🚛"
                tone="info"
                sub={`${Math.round((ops.fleetUsed / Math.max(1, ops.fleetTotal)) * 100)}% of fleet on the road · ${ops.stopsPlanned} stops`}
              />
              <KpiCard
                label="Redelivery Rate"
                value={ops.optimizedRedeliveryPct.toFixed(1)}
                unit="%"
                tone="success"
                sub={
                  <span>
                    ▼ from {INDUSTRY_BASELINE_PCT}% industry avg ·{' '}
                    <span className="text-text-secondary">today's plan {ops.baselineRedeliveryPct.toFixed(0)}% → {ops.optimizedRedeliveryPct.toFixed(0)}%</span>
                  </span>
                }
              />
              <KpiCard
                label="Driver Hours Saved"
                value={ops.driverHoursSaved.toFixed(1)}
                unit="hrs"
                tone="success"
                icon="⏱️"
                sub={`${ops.redeliveriesPrevented} redeliveries prevented today`}
              />
              <KpiCard
                label="CO₂ Reduction"
                value={ops.co2SavedKg.toFixed(1)}
                unit="kg"
                tone="success"
                icon="🌿"
                sub="Fewer return trips → lower emissions"
              />
            </div>

            <Panel
              title={`Active Delivery Routes (${routes.length})`}
              action={<span className="text-xs text-text-secondary">Shift start 08:00</span>}
            >
              <div className="divide-y divide-surface-lighter">
                {routes.map((r, i) => (
                  <RouteRow key={r.vehicle_id} route={r} index={i} />
                ))}
              </div>
            </Panel>
          </>
        )
      )}

      {simMutation.error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {simMutation.error.message}
        </div>
      )}
    </div>
  );
}
