import { useEffect } from 'react';
import { useDeliveryStore, useAgentStore, useAuthStore } from './store';

// Layout components
import SidebarNav from './components/SidebarNav';
import TopBar from './components/TopBar';
import AgentEventToast from './components/AgentEventToast';
import ErrorBoundary from './components/ErrorBoundary';
import LoginGate from './components/LoginGate';

// Page modules
import Dashboard from './components/Dashboard';
import RouteMap from './components/RouteMap';
import DeliveryDetail from './components/DeliveryDetail';
import Simulation from './components/Simulation';
import MLHealth from './components/MLHealth';
import LandingPage from './components/LandingPage';

function Cockpit() {
  const { currentPage, deliveries, isLoadingDay, dayError, loadDay } = useDeliveryStore();
  const { connectWebSocket } = useAgentStore();

  // Live agent WebSocket dispatch feed for the whole cockpit session.
  useEffect(() => {
    const disconnect = connectWebSocket();
    return disconnect;
  }, [connectWebSocket]);

  // First entry: solve today's dispatch plan on the backend.
  useEffect(() => {
    if (deliveries.length === 0 && !isLoadingDay && !dayError) {
      void loadDay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'map':
        return <RouteMap />;
      case 'deliveries':
        return <DeliveryDetail />;
      case 'simulation':
        return <Simulation />;
      case 'ml':
        return <MLHealth />;
      default:
        return <Dashboard />;
    }
  };

  const showBootScreen = isLoadingDay && deliveries.length === 0;

  return (
    <div
      id="takumi-route-root"
      className="flex h-screen w-screen bg-ink overflow-hidden text-paper font-sans"
    >
      {/* Left collapsable fleet control sidebar */}
      <SidebarNav />

      {/* Right dashboard workflow stage */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto relative">
          {showBootScreen ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
              <span className="h-8 w-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-xs font-mono tracking-wider text-paper animate-pulse">
                Solving today&apos;s prize-collecting VRPTW…
              </span>
              <span className="text-[10px] text-muted">
                配車計画計算中（OR-Tools + LightGBM 実行中）
              </span>
            </div>
          ) : dayError && deliveries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 select-none text-center px-8">
              <span className="text-sm font-bold text-accent">Dispatch plan failed to load</span>
              <span className="text-[11px] text-muted max-w-md leading-relaxed">{dayError}</span>
              <button
                onClick={() => void loadDay()}
                className="mt-2 px-4 py-2 bg-accent text-paper text-xs font-semibold rounded hover:bg-accent-muted transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            renderPage()
          )}
        </main>
      </div>

      {/* Persistent bottom right popup notification deck */}
      <AgentEventToast />
    </div>
  );
}

export default function App() {
  const { currentPage } = useDeliveryStore();
  const { user, authChecked, checkAuth } = useAuthStore();

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Landing portal is public.
  if (currentPage === 'landing') {
    return (
      <ErrorBoundary>
        <LandingPage />
      </ErrorBoundary>
    );
  }

  if (!authChecked) {
    return (
      <div className="h-screen w-screen bg-ink flex items-center justify-center">
        <span className="h-6 w-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // The cockpit talks to authenticated APIs — gate it behind sign-in.
  if (!user) {
    return (
      <ErrorBoundary>
        <LoginGate />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Cockpit />
    </ErrorBoundary>
  );
}
