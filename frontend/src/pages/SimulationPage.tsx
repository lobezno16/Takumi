import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRunSimulation, useRunMonteCarlo } from '@/api/client';
import type { SimulationResult, MonteCarloResult } from '@/api/client';
import { useAppStore } from '@/store/app';
import { deriveOps, INDUSTRY_BASELINE_PCT, slotShort } from '@/lib/ops';
import { KpiCard, Panel, PrimaryButton } from '@/components/ui';

const WINDOW_OPTIONS = [
  { value: 'am', label: 'Morning (08:00–12:00)' },
  { value: 't1214', label: 'Midday (12:00–14:00)' },
  { value: 't1416', label: 'Afternoon (14:00–16:00)' },
  { value: 't1618', label: 'Late afternoon (16:00–18:00)' },
  { value: 't1821', label: 'Evening (18:00–21:00)' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function SingleResult({ result }: { result: SimulationResult }) {
  const ops = deriveOps(result.baseline, result.takumi, result.n_vehicles);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-full border border-success/20 bg-success/10 px-3.5 py-1 text-sm font-medium text-success">
          ↓ {Math.abs(result.improvement_pct).toFixed(0)}% fewer redeliveries vs current operations
        </div>
        <span className="text-xs text-text-secondary">
          {result.n_stops} stops · {result.n_vehicles} drivers · standard window {slotShort(result.slot_code)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Redelivery Rate"
          value={ops.optimizedRedeliveryPct.toFixed(1)}
          unit="%"
          tone="success"
          sub={`from ${ops.baselineRedeliveryPct.toFixed(0)}% current · ${INDUSTRY_BASELINE_PCT}% industry avg`}
        />
        <KpiCard
          label="First-Attempt Success"
          value={ops.firstAttemptPct.toFixed(0)}
          unit="%"
          tone="success"
          sub="Delivered without a return trip"
        />
        <KpiCard
          label="Driver Hours Saved"
          value={ops.driverHoursSaved.toFixed(1)}
          unit="hrs"
          icon="⏱️"
          sub={`${ops.redeliveriesPrevented} redeliveries prevented`}
        />
        <KpiCard
          label="CO₂ Reduction"
          value={ops.co2SavedKg.toFixed(1)}
          unit="kg"
          icon="🌿"
          sub="From avoided return trips"
        />
      </div>
    </div>
  );
}

function ForecastResult({ result }: { result: MonteCarloResult }) {
  const baselinePct = result.avg_baseline_redelivery_rate * 100;
  const optimizedPct = result.avg_takumi_redelivery_rate * 100;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-sm font-medium text-primary">
          {result.n_runs}-day forecast
        </div>
        <div className="rounded-full border border-success/20 bg-success/10 px-3.5 py-1 text-sm font-medium text-success">
          ↓ {Math.abs(result.avg_improvement_pct).toFixed(0)}% avg redelivery reduction
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Avg Redelivery Rate" value={optimizedPct.toFixed(1)} unit="%" tone="success" sub={`from ${baselinePct.toFixed(0)}% current operations`} />
        <KpiCard label="Operating Cost Reduction" value={result.cost_savings_pct.toFixed(0)} unit="%" tone="success" icon="💴" sub="Per delivery day, averaged" />
        <KpiCard label="Consistency" value={`${result.runs.length}`} unit="days" tone="info" sub="Days modelled across the week" />
      </div>

      <Panel title="Daily Breakdown">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-lighter text-left text-xs text-text-secondary">
              <th className="px-5 py-3 font-medium">Day</th>
              <th className="px-5 py-3 text-right font-medium">Current redelivery</th>
              <th className="px-5 py-3 text-right font-medium">Optimized redelivery</th>
              <th className="px-5 py-3 text-right font-medium">Reduction</th>
            </tr>
          </thead>
          <tbody>
            {result.runs.map((run, i) => (
              <tr key={run.run_id} className="border-b border-surface-lighter/50 last:border-0 hover:bg-surface-lighter/20">
                <td className="px-5 py-2.5 text-text-primary">{DAY_LABELS.at(run.day_of_week) ?? `Day ${i + 1}`}</td>
                <td className="px-5 py-2.5 text-right text-text-secondary">{(run.baseline_redelivery_rate * 100).toFixed(1)}%</td>
                <td className="px-5 py-2.5 text-right text-success">{(run.takumi_redelivery_rate * 100).toFixed(1)}%</td>
                <td className="px-5 py-2.5 text-right font-medium text-success">↓ {Math.abs(run.improvement_pct).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export function SimulationPage() {
  const [mode, setMode] = useState<'single' | 'forecast'>('single');
  const [nStops, setNStops] = useState(40);
  const [nVehicles, setNVehicles] = useState(5);
  const [slotCode, setSlotCode] = useState('am');
  const [dayOfWeek, setDayOfWeek] = useState(2);
  const [nRuns, setNRuns] = useState(5);

  const simMutation = useRunSimulation();
  const mcMutation = useRunMonteCarlo();
  const { setLastSimulation, setLastMonteCarlo, lastSimulation, lastMonteCarlo } = useAppStore();

  const handleRun = () => {
    if (mode === 'single') {
      simMutation.mutate(
        { n_stops: nStops, n_vehicles: nVehicles, slot_code: slotCode, day_of_week: dayOfWeek },
        { onSuccess: (data) => setLastSimulation(data) },
      );
    } else {
      mcMutation.mutate(
        { n_runs: nRuns, n_stops: nStops, n_vehicles: nVehicles, slot_code: slotCode, base_seed: 42 },
        { onSuccess: (data) => setLastMonteCarlo(data) },
      );
    }
  };

  const isLoading = simMutation.isPending || mcMutation.isPending;
  const error = simMutation.error || mcMutation.error;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Plan Optimization</h2>
        <p className="mt-0.5 text-sm text-text-secondary">Model a delivery day and measure the operational yield versus standard dispatch</p>
      </div>

      <Panel className="p-6">
        <div className="mb-6 flex gap-2">
          {(['single', 'forecast'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${mode === m ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
            >
              {m === 'single' ? 'Single Day' : 'Multi-Day Forecast'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Control label="Delivery stops">
            <input type="number" min={5} max={200} value={nStops} onChange={(e) => setNStops(Number(e.target.value))} className={inputCls} />
          </Control>
          <Control label="Drivers / vehicles">
            <input type="number" min={1} max={20} value={nVehicles} onChange={(e) => setNVehicles(Number(e.target.value))} className={inputCls} />
          </Control>
          <Control label="Standard delivery window" hint="The blanket window current operations use; the optimizer picks the best window per recipient.">
            <select value={slotCode} onChange={(e) => setSlotCode(e.target.value)} className={inputCls}>
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Control>
          {mode === 'single' ? (
            <Control label="Day of week">
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className={inputCls}>
                {DAY_LABELS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </Control>
          ) : (
            <Control label="Days to model">
              <input type="number" min={1} max={20} value={nRuns} onChange={(e) => setNRuns(Number(e.target.value))} className={inputCls} />
            </Control>
          )}
        </div>

        <PrimaryButton onClick={handleRun} loading={isLoading} className="mt-6">
          {isLoading ? 'Optimizing…' : mode === 'single' ? 'Run Optimization' : `Model ${nRuns} Days`}
        </PrimaryButton>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error.message}</div>
        )}
      </Panel>

      {mode === 'single' && lastSimulation && <SingleResult result={lastSimulation} />}
      {mode === 'forecast' && lastMonteCarlo && <ForecastResult result={lastMonteCarlo} />}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-surface-lighter bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50';

function Control({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary" title={hint}>
        {label}
      </label>
      {children}
    </div>
  );
}
