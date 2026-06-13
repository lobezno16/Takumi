import { useState } from 'react';
import { useRunSimulation, useRunMonteCarlo } from '@/api/client';
import type { SimulationResult, MonteCarloResult } from '@/api/client';
import { useAppStore } from '@/store/app';

const SLOT_OPTIONS = [
  { value: 'am', label: 'AM (08:00–12:00)' },
  { value: 't1214', label: '12:00–14:00' },
  { value: 't1416', label: '14:00–16:00' },
  { value: 't1618', label: '16:00–18:00' },
  { value: 't1821', label: '18:00–21:00' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function KPICard({ label, baseline, takumi, unit, better }: {
  label: string;
  baseline: number;
  takumi: number;
  unit: string;
  better: 'lower' | 'higher';
}) {
  const improved = better === 'lower' ? takumi < baseline : takumi > baseline;
  const diff = ((takumi - baseline) / (baseline || 1) * 100);

  return (
    <div className="bg-surface-light rounded-xl border border-surface-lighter p-4">
      <p className="text-xs text-text-secondary mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-text-secondary/70">Baseline</p>
          <p className="text-lg font-bold text-text-primary">{baseline.toFixed(unit === '%' ? 1 : 0)}{unit}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary/70">Takumi</p>
          <p className={`text-lg font-bold ${improved ? 'text-success' : 'text-warning'}`}>
            {takumi.toFixed(unit === '%' ? 1 : 0)}{unit}
          </p>
        </div>
      </div>
      <div className={`mt-2 text-xs font-medium ${improved ? 'text-success' : 'text-warning'}`}>
        {improved ? '▼' : '▲'} {Math.abs(diff).toFixed(1)}% {improved ? 'improvement' : 'worse'}
      </div>
    </div>
  );
}

function SimResultView({ result }: { result: SimulationResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          result.improvement_pct > 0
            ? 'bg-success/10 text-success border border-success/20'
            : 'bg-warning/10 text-warning border border-warning/20'
        }`}>
          {result.improvement_pct > 0 ? '↑' : '↓'} {Math.abs(result.improvement_pct).toFixed(1)}% redelivery reduction
        </div>
        <span className="text-xs text-text-secondary">
          Solver: {result.solver_time_ms}ms · Seed: {result.seed}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Redelivery Rate"
          baseline={result.baseline.redelivery_rate * 100}
          takumi={result.takumi.redelivery_rate * 100}
          unit="%" better="lower"
        />
        <KPICard
          label="First-Attempt Success"
          baseline={result.baseline.first_attempt_success_rate * 100}
          takumi={result.takumi.first_attempt_success_rate * 100}
          unit="%" better="higher"
        />
        <KPICard
          label="Estimated Cost"
          baseline={result.baseline.cost_estimate}
          takumi={result.takumi.cost_estimate}
          unit="¥" better="lower"
        />
        <KPICard
          label="Stops Visited"
          baseline={result.baseline.stops_attempted}
          takumi={result.takumi.stops_attempted}
          unit="" better="higher"
        />
      </div>
    </div>
  );
}

function MCResultView({ result }: { result: MonteCarloResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
          {result.n_runs} simulations averaged
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          result.avg_improvement_pct > 0
            ? 'bg-success/10 text-success border border-success/20'
            : 'bg-warning/10 text-warning border border-warning/20'
        }`}>
          {result.avg_improvement_pct > 0 ? '↑' : '↓'} {Math.abs(result.avg_improvement_pct).toFixed(1)}% avg improvement
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Avg Redelivery Rate"
          baseline={result.avg_baseline_redelivery_rate * 100}
          takumi={result.avg_takumi_redelivery_rate * 100}
          unit="%" better="lower"
        />
        <KPICard
          label="Avg Cost"
          baseline={result.avg_baseline_cost}
          takumi={result.avg_takumi_cost}
          unit="¥" better="lower"
        />
        <div className="bg-surface-light rounded-xl border border-surface-lighter p-4">
          <p className="text-xs text-text-secondary mb-2">Cost Savings</p>
          <p className="text-3xl font-bold text-success">{result.cost_savings_pct.toFixed(1)}%</p>
          <p className="text-xs text-text-secondary mt-1">per delivery run</p>
        </div>
      </div>

      {/* Per-run table */}
      <div className="bg-surface-light rounded-xl border border-surface-lighter overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-lighter">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Run</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Day</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">Baseline Redeliv.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">Takumi Redeliv.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary">Improvement</th>
            </tr>
          </thead>
          <tbody>
            {result.runs.map((run, i) => (
              <tr key={run.run_id} className="border-b border-surface-lighter/50 hover:bg-surface-lighter/30 transition-colors">
                <td className="px-4 py-2.5 text-text-secondary">#{i + 1}</td>
                <td className="px-4 py-2.5 text-text-primary">{DAY_LABELS[run.day_of_week]}</td>
                <td className="px-4 py-2.5 text-right text-text-primary">{(run.baseline_redelivery_rate * 100).toFixed(1)}%</td>
                <td className="px-4 py-2.5 text-right text-success">{(run.takumi_redelivery_rate * 100).toFixed(1)}%</td>
                <td className={`px-4 py-2.5 text-right font-medium ${run.improvement_pct > 0 ? 'text-success' : 'text-warning'}`}>
                  {run.improvement_pct > 0 ? '+' : ''}{run.improvement_pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SimulationPage() {
  const [mode, setMode] = useState<'single' | 'monte-carlo'>('single');
  const [nStops, setNStops] = useState(30);
  const [nVehicles, setNVehicles] = useState(3);
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
        <h2 className="text-3xl font-bold text-text-primary">Simulation</h2>
        <p className="mt-1 text-text-secondary">Compare baseline FIFO routing vs ML-optimized Takumi routing</p>
      </div>

      {/* Controls */}
      <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          {(['single', 'monte-carlo'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-lighter'
              }`}
            >
              {m === 'single' ? 'Single Run' : 'Monte Carlo'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Stops</label>
            <input
              type="number" min={5} max={200} value={nStops}
              onChange={(e) => setNStops(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-lighter text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Vehicles</label>
            <input
              type="number" min={1} max={20} value={nVehicles}
              onChange={(e) => setNVehicles(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-lighter text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1" title="Window the baseline carrier delivers in for every stop. Takumi auto-selects each recipient's best-predicted slot.">
              Baseline window
            </label>
            <select
              value={slotCode}
              onChange={(e) => setSlotCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-lighter text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {SLOT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {mode === 'single' ? (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-lighter text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {DAY_LABELS.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Runs</label>
              <input
                type="number" min={1} max={50} value={nRuns}
                onChange={(e) => setNRuns(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-lighter text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleRun}
          disabled={isLoading}
          className="mt-6 px-8 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running simulation…
            </span>
          ) : (
            mode === 'single' ? 'Run Simulation' : `Run ${nRuns} Simulations`
          )}
        </button>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {error.message}
          </div>
        )}
      </div>

      {/* Results */}
      {mode === 'single' && lastSimulation && <SimResultView result={lastSimulation} />}
      {mode === 'monte-carlo' && lastMonteCarlo && <MCResultView result={lastMonteCarlo} />}
    </div>
  );
}
