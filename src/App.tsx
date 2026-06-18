/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { useDeliveryStore, useAgentStore } from "./store";

// Layout components
import SidebarNav from "./components/SidebarNav";
import TopBar from "./components/TopBar";
import AgentEventToast from "./components/AgentEventToast";
import ErrorBoundary from "./components/ErrorBoundary";

// Page modules
import Dashboard from "./components/Dashboard";
import RouteMap from "./components/RouteMap";
import DeliveryDetail from "./components/DeliveryDetail";
import Simulation from "./components/Simulation";
import MLHealth from "./components/MLHealth";
import LandingPage from "./components/LandingPage";

export default function App() {
  const { currentPage, selectedDeliveryId } = useDeliveryStore();
  const { connectWebSocket } = useAgentStore();

  // Establish live agent WebSocket dispatch feed on application initialization
  useEffect(() => {
    const disconnect = connectWebSocket(selectedDeliveryId);
    return () => {
      disconnect();
    };
  }, [connectWebSocket, selectedDeliveryId]);

  // Page dispatcher mapping
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "map":
        return <RouteMap />;
      case "deliveries":
        return <DeliveryDetail />;
      case "simulation":
        return <Simulation />;
      case "ml":
        return <MLHealth />;
      default:
        return <Dashboard />;
    }
  };

  if (currentPage === "landing") {
    return (
      <ErrorBoundary>
        <LandingPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div id="takumi-route-root" className="flex h-screen w-screen bg-ink overflow-hidden text-paper font-sans">
        {/* Left collapsable fleet control sidebar */}
        <SidebarNav />

        {/* Right dashboard workflow stage */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <TopBar />
          
          <main className="flex-1 overflow-y-auto relative">
            {renderPage()}
          </main>
        </div>

        {/* Persistent bottom right popup notification deck */}
        <AgentEventToast />
      </div>
    </ErrorBoundary>
  );
}
