/** Shared presentational primitives for the dispatch dashboard. */
import type { ReactNode } from 'react';
import type { Tone } from '@/lib/ops';

function toneClasses(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'bg-success/10 text-success border-success/20';
    case 'warning':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'danger':
      return 'bg-danger/10 text-danger border-danger/20';
    case 'info':
      return 'bg-primary/10 text-primary border-primary/20';
    default:
      return 'bg-surface-lighter/40 text-text-secondary border-surface-lighter';
  }
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${toneClasses(tone)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  tone?: Tone;
  icon?: string;
}) {
  const accent =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-text-primary';
  return (
    <div className="rounded-2xl border border-surface-lighter bg-surface-light p-5 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
        {icon && <span className="text-base opacity-70">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${accent}`}>{value}</span>
        {unit && <span className="text-sm font-medium text-text-secondary">{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-surface-lighter bg-surface-light ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-surface-lighter px-5 py-3.5">
          {typeof title === 'string' ? (
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all hover:shadow-xl disabled:opacity-50 ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
}
