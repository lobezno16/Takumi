/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useDeliveryStore, useAgentStore, useAuthStore } from "../store";
import { Play, Calendar, RefreshCw, Download, LogOut } from "lucide-react";

export default function TopBar() {
  const { currentPage, selectedDate, setSelectedDate, reoptimizeDay, isLoadingDay } =
    useDeliveryStore();
  const { connectionStatus, addEvent } = useAgentStore();
  const { user, signOut } = useAuthStore();
  const isOptimizing = isLoadingDay;

  const getBreadcrumb = () => {
    switch (currentPage) {
      case "dashboard":
        return { en: "Logistics Dashboard", jp: "運行総合ダッシュボード" };
      case "map":
        return { en: "Dynamic Route Map", jp: "運行経路リアルタイムマップ" };
      case "deliveries":
        return { en: "Delivery Stop Analytics", jp: "顧客不在予測・交渉情報" };
      case "simulation":
        return { en: "VRP Dispatch Simulator", jp: "配車計画シミュレータ" };
      case "ml":
        return { en: "ML Model Reliability Metrics", jp: "予測精度・特徴量動向分析" };
      default:
        return { en: "Logistics Dashboard", jp: "運行総合ダッシュボード" };
    }
  };

  const bc = getBreadcrumb();

  const handleRunOptimization = () => {
    if (isOptimizing) return;

    // Log system event
    addEvent({
      type: "reoptimize",
      delivery_id: "GLOBAL-OPT",
      recipient_name: "Fleetwide",
      message: "VRP solver recalculation requested. Re-solving today's prize-collecting VRPTW on the backend...",
      timestamp: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
    });

    void reoptimizeDay().then(() => {
      const meta = useDeliveryStore.getState().runMeta;
      addEvent({
        type: "status_update",
        delivery_id: "GLOBAL-CONF",
        recipient_name: "Fleetwide",
        message: meta
          ? `OR-Tools VRP recalculation finished in ${meta.solverTimeMs}ms. Projected redelivery ${(meta.takumiRedeliveryRate * 100).toFixed(1)}% vs baseline ${(meta.baselineRedeliveryRate * 100).toFixed(1)}%.`
          : "OR-Tools VRP recalculation finished.",
        timestamp: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
      });
    });
  };

  const handleDownloadManifest = () => {
    const serialCode = `MNF-${Math.floor(Math.random() * 900000) + 100000}`;
    const timestampLocal = new Date().toLocaleString("ja-JP", { hour12: false });
    
    // Create manifest file object link
    const deliveries = useDeliveryStore.getState().deliveries;
    const manifestJson = JSON.stringify(deliveries, null, 2);
    const blob = new Blob([manifestJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest_${serialCode}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Save Export Audit log row into the Agent Console active event feed
    addEvent({
      type: "status_update",
      delivery_id: "EXPORT",
      recipient_name: "Audit System",
      message: `Export Audit: Manifest downloaded. Serial: [${serialCode}]. Timestamp: ${timestampLocal}`,
      timestamp: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
    });
  };

  return (
    <header className="h-16 border-b border-[#22272E] bg-ink/95 sticky top-0 z-30 flex items-center justify-between px-6 select-none">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted text-[11px] font-mono tracking-wider font-semibold uppercase">
          TAKUMIROUTE
        </span>
        <span className="text-muted/50 text-[11px]">/</span>
        <div className="flex flex-col">
          <span className="text-paper text-xs font-semibold tracking-wide">
            {bc.en}
          </span>
          <span id="breadcrumb-jp" className="text-[9px] text-muted leading-none">
            {bc.jp}
          </span>
        </div>
      </div>

      {/* Actions and Dates */}
      <div className="flex items-center gap-4">
        {/* Connection Status indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-[#161B22] rounded-md border border-[#22272E]">
          <span className="relative flex h-2 w-2">
            {connectionStatus === "connected" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              connectionStatus === "connected" ? "bg-signal" : connectionStatus === "connecting" ? "bg-warn" : "bg-accent"
            }`}></span>
          </span>
          <span className="text-[10px] font-mono text-paper capitalize">
            {connectionStatus === "connected" ? "Live Feed Active" : connectionStatus === "connecting" ? "Reconnecting" : "Offline Feed"}
          </span>
        </div>

        {/* Date picking input */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#161B22] border border-[#22272E] rounded-md">
          <Calendar className="w-3.5 h-3.5 text-muted" />
          <input
            id="date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-paper text-xs font-mono outline-none border-none cursor-pointer focus:ring-0"
          />
        </div>

        {/* Download Manifest Button */}
        <button
          id="export-manifest-btn"
          onClick={handleDownloadManifest}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide bg-[#161B22] text-[#FAF3EC] hover:bg-[#202731] border border-[#22272E] active:scale-95 transition-all cursor-pointer shadow-lg hover:border-[#B5483A]/30"
        >
          <Download className="w-3.5 h-3.5 text-[#B5483A]" />
          <span>Export Manifest</span>
        </button>

        {/* Primary CTA */}
        <button
          id="run-optimization-btn"
          disabled={isOptimizing}
          onClick={handleRunOptimization}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
            isOptimizing 
              ? "bg-[#22272E] text-muted cursor-wait" 
              : "bg-accent text-paper hover:bg-accent-muted active:scale-95 cursor-pointer shadow-lg shadow-accent/15"
          }`}
        >
          {isOptimizing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          {isOptimizing ? "Optimizing..." : "Run Optimization"}
        </button>

        {/* Operator session */}
        <div className="flex items-center gap-2 pl-3 border-l border-[#22272E]">
          <div
            className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent"
            title={user?.email ?? ""}
          >
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <button
            id="sign-out-btn"
            onClick={signOut}
            title="Sign out"
            className="text-muted hover:text-accent transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
