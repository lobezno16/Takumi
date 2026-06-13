import { useMe, getToken, logout } from '@/api/client';
import { useAppStore } from '@/store/app';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SimulationPage } from '@/pages/SimulationPage';

type NavItem = {
  id: 'dashboard' | 'simulation';
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'simulation', label: 'Simulation', icon: '🧪' },
];

function Sidebar() {
  const { currentPage, setPage } = useAppStore();
  const me = useMe();

  return (
    <aside className="w-64 bg-surface-light border-r border-surface-lighter flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-surface-lighter">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-lg shadow-primary/25">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-5 w-5">
              <path d="M8 24L16 8L24 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="18" r="3" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary leading-tight">TakumiRoute</h1>
            <p className="text-[10px] text-text-secondary">Delivery Optimization</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentPage === item.id
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-surface-lighter">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            {me.data?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {me.data?.email?.split('@')[0] ?? '…'}
            </p>
            <p className="text-[10px] text-text-secondary">{me.data?.role ?? '…'}</p>
          </div>
          <button
            onClick={logout}
            className="text-text-secondary hover:text-danger transition-colors text-sm"
            title="Sign out"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}

function MainContent() {
  const { currentPage } = useAppStore();

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-8">
        {currentPage === 'dashboard' && <DashboardPage />}
        {currentPage === 'simulation' && <SimulationPage />}
      </div>
    </main>
  );
}

function App() {
  const token = getToken();
  const me = useMe();

  // Not authenticated
  if (!token || me.isError) {
    return <LoginPage />;
  }

  // Loading user
  if (me.isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-text-secondary">
          <span className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex font-sans">
      <Sidebar />
      <MainContent />
    </div>
  );
}

export default App;
