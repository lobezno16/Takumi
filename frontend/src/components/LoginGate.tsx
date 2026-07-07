import { useState } from 'react';
import { useAuthStore, useDeliveryStore } from '../store';
import { Lock, Mail, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react';

/**
 * Operator sign-in gate for the cockpit. Every cockpit API is JWT-protected
 * and tenant-scoped; registering provisions a fresh organization.
 */
export default function LoginGate() {
  const { signIn, signUp, authError, isSubmitting } = useAuthStore();
  const { setCurrentPage } = useDeliveryStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === 'login') {
      void signIn(email, password);
    } else {
      void signUp(email, password);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-ink flex items-center justify-center font-sans select-none relative overflow-hidden">
      {/* Grid backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#22272e_1px,transparent_1px),linear-gradient(to_bottom,#22272e_1px,transparent_1px)] bg-[size:32px_32px] opacity-15 pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 px-6">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="min-w-[40px] h-10 bg-accent rounded flex items-center justify-center font-display font-bold text-paper text-lg">
            匠
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold tracking-wider text-paper text-lg leading-none">
              TakumiRoute
            </span>
            <span className="text-[10px] text-muted leading-tight mt-1">
              匠ルート • Operator Cockpit Access
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-1 border border-rule rounded-lg p-6 space-y-4 shadow-2xl"
        >
          <div className="flex flex-col gap-1 pb-2 border-b border-rule">
            <h1 className="text-sm font-bold text-paper">
              {mode === 'login' ? 'Operator Sign-in' : 'Provision New Organization'}
            </h1>
            <span className="text-[10px] text-muted">
              {mode === 'login'
                ? 'オペレーターサインイン — JWT + Argon2 secured'
                : '新規事業者登録 — registering creates an isolated tenant'}
            </span>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
              Email
            </span>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@tanaka-express.jp"
                className="w-full bg-ink border border-rule rounded-md pl-9 pr-3 py-2 text-xs text-paper outline-none focus:border-accent"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
              Password
            </span>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted" />
              <input
                id="login-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-ink border border-rule rounded-md pl-9 pr-3 py-2 text-xs text-paper outline-none focus:border-accent"
              />
            </div>
          </label>

          {authError && (
            <div className="bg-accent/10 border border-accent/30 rounded p-2.5">
              <span className="text-[10px] text-accent leading-relaxed">{authError}</span>
            </div>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all ${
              isSubmitting
                ? 'bg-rule text-muted cursor-wait'
                : 'bg-accent text-paper hover:bg-amber-bright cursor-pointer active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
            {isSubmitting
              ? 'Authenticating…'
              : mode === 'login'
                ? 'Enter Cockpit'
                : 'Register & Enter'}
          </button>

          <div className="flex items-center justify-between pt-1 text-[10px]">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-muted hover:text-accent transition-colors underline underline-offset-2"
            >
              {mode === 'login' ? 'New carrier? Register' : 'Have an account? Sign in'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage('landing')}
              className="text-muted hover:text-paper transition-colors flex items-center gap-0.5"
            >
              <ChevronLeft className="w-3 h-3" /> Landing portal
            </button>
          </div>
        </form>

        <p className="text-center text-[9px] text-muted mt-4 font-mono">
          Tenant-isolated · rate-limited · deny-by-default
        </p>
      </div>
    </div>
  );
}
