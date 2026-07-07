/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { useDeliveryStore, useAgentStore } from "../store";
import { projectedTrend } from "../seedData";
import { getPHomeColor } from "../utils";
import CarbonTracker from "./CarbonTracker";
import RedeliveryProfiler from "./RedeliveryProfiler";
import BorderGlow from "./BorderGlow";
import Ferrofluid from "./Ferrofluid";
import { 
  TrendingDown, 
  Clock, 
  Activity, 
  Package,
  Leaf
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

export default function Dashboard() {
  const { deliveries, vehicles, setCurrentPage, setSelectedDeliveryId, setActiveVehicleId, runMeta } =
    useDeliveryStore();
  const { events } = useAgentStore();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1300);
    return () => clearTimeout(timer);
  }, []);

  // Live aggregates from the backend's baseline-vs-Takumi run (runMeta) and
  // the current in-session delivery state.
  const totalDeliveriesCount = deliveries.length;

  const liveRedeliveryRate = runMeta
    ? parseFloat((runMeta.takumiRedeliveryRate * 100).toFixed(1))
    : 0;
  const baselineRedeliveryRate = runMeta
    ? parseFloat((runMeta.baselineRedeliveryRate * 100).toFixed(1))
    : 0;
  const improvementPct = runMeta ? runMeta.improvementPct : 0;

  // Hours saved = route-time delta plus avoided redelivery handling (~4 min each).
  const avoidedRedeliveries = runMeta
    ? Math.max(
        0,
        Math.round(
          (runMeta.baselineRedeliveryRate - runMeta.takumiRedeliveryRate) * totalDeliveriesCount,
        ),
      )
    : 0;
  const routeHoursDelta = runMeta
    ? Math.max(0, runMeta.baselineRouteSeconds - runMeta.takumiRouteSeconds) / 3600
    : 0;
  const liveHoursSaved = parseFloat((routeHoursDelta + (avoidedRedeliveries * 4) / 60).toFixed(1));
  const liveCo2Saved = parseFloat((liveHoursSaved * 2.3).toFixed(1)); // kei-truck kg/h proxy

  const kpis = [
    {
      id: "redelivery",
      title: "Redelivery Rate",
      jpTitle: "再配達率",
      value: `${liveRedeliveryRate}%`,
      delta: `↓ ${improvementPct.toFixed(1)}%`,
      deltaJp: `ベースライン ${baselineRedeliveryRate}%`,
      positive: true,
      color: "text-signal",
      icon: TrendingDown,
    },
    {
      id: "hours",
      title: "Driver Hours Saved",
      jpTitle: "ドライバー削減時間",
      value: `${liveHoursSaved}h`,
      delta: `↓ ${avoidedRedeliveries} 再配達`,
      deltaJp: "対ベースライン",
      positive: true,
      color: "text-accent",
      icon: Clock,
    },
    {
      id: "co2",
      title: "CO₂ Reduced",
      jpTitle: "CO2排出削減量",
      value: `${liveCo2Saved} kg`,
      delta: "2.3 kg/h",
      deltaJp: "軽トラ換算",
      positive: true,
      color: "text-signal",
      icon: Leaf,
    },
    {
      id: "parcels",
      title: "Parcels Optimized",
      jpTitle: "最適化済荷物数",
      value: `${totalDeliveriesCount} units`,
      delta: `${vehicles.length} routes`,
      deltaJp: "稼働車両数",
      positive: true,
      color: "text-data",
      icon: Package,
    }
  ];

  const handleVehicleClick = (vId: string) => {
    setActiveVehicleId(vId);
    setCurrentPage("map");
  };

  const handleEventClick = (dId: string) => {
    if (dId && dId.startsWith("DEL-")) {
      setSelectedDeliveryId(dId);
      setCurrentPage("deliveries");
    }
  };

  return (
    <div id="dashboard-page" className="p-6 space-y-6 select-none bg-ink h-auto min-h-[calc(100vh-64px)]">
      {/* FLUID TELEMETRY HEADER BANNER */}
      <BorderGlow
        glowColor="15 80 55"
        backgroundColor="#161B22"
        borderRadius={12}
        glowRadius={35}
        glowIntensity={1.0}
        colors={["#E8442A", "#00C896", "#4A9EFF"]}
        className="w-full"
      >
        <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-5 gap-6 items-center min-h-[160px] relative overflow-hidden">
          {/* Information & Brand text */}
          <div className="md:col-span-3 flex flex-col justify-center space-y-2 z-10">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-accent/20 text-accent font-mono text-[9px] font-bold tracking-wider uppercase">
                Neural Routing Engine
              </span>
              <span className="px-2 py-0.5 rounded bg-signal/20 text-signal font-mono text-[9px] font-bold tracking-wider uppercase">
                Active Simulation
              </span>
            </div>
            
            <h2 className="text-xl md:text-2xl font-display font-semibold tracking-tight text-paper mt-1">
              TakumiRoute Fluid Dispatch Telemetry
            </h2>
            <p className="text-xs text-muted max-w-xl leading-relaxed">
              Real-time modeling of vehicle routing variables (VRP) & residential presence distributions across Koto District. 
              The physics-based fluid simulation represents real-time delivery density forces. Hover and drag near the contour lines to interact with local spike magnetic force feedback field.
            </p>
          </div>

          {/* Interactive Ferrofluid display */}
          <div className="md:col-span-2 h-40 md:h-44 rounded-lg bg-[#0D1117] relative border border-[#22272E] overflow-hidden">
            <Ferrofluid
              colors={["#E8442A", "#00C896", "#4A9EFF"]}
              backgroundColor="#0D1117"
              speed={0.8}
              scale={1.4}
              turbulence={1.2}
              fluidity={0.12}
              rimWidth={0.25}
              sharpness={3.0}
              shimmer={1.2}
              glow={2.2}
              flowDirection="down"
              opacity={1}
              mouseInteraction={true}
              mouseStrength={1.5}
              mouseRadius={0.4}
            />
            {/* Absolute positioning label */}
            <div className="absolute top-2.5 right-2.5 bg-ink/70 backdrop-blur-xs px-2 py-0.5 rounded border border-[#22272E] pointer-events-none select-none">
              <span className="text-[8px] font-mono font-bold tracking-wider text-muted flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                VRP CONST FLOW
              </span>
            </div>
          </div>
        </div>
      </BorderGlow>

      {/* KPI Section Header with Live Status & Manual Sync Trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-medium text-paper text-sm tracking-tight flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            Live Network Parameters
          </h3>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-rule">
            Refreshed 2026
          </span>
        </div>
        <button
          onClick={() => {
            setIsLoading(true);
            setTimeout(() => {
              setIsLoading(false);
            }, 1200);
          }}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-surface-2 hover:bg-surface-1 text-paper border border-rule px-2.5 py-1.5 rounded-sm transition-all shadow-sm cursor-pointer disabled:opacity-50"
        >
          <Activity className={`h-3 w-3 ${isLoading ? "animate-spin text-accent" : "text-slate-bright"}`} />
          {isLoading ? "Syncing Feed..." : "Flush & Fetch Sync"}
        </button>
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const isRedeliveryOrCo2 = kpi.id === "redelivery" || kpi.id === "co2";
          return (
            <BorderGlow
              key={kpi.id}
              className="h-32 flex"
              glowColor={isLoading ? "20 20 20" : (isRedeliveryOrCo2 ? "150 80 50" : "12 85 50")}
              backgroundColor={isLoading ? "#1A1813" : "#F5F5F0"}
              borderRadius={8}
              glowRadius={24}
              glowIntensity={isLoading ? 0.4 : 1.2}
              colors={
                isLoading
                  ? ["#2E2B24", "#1A1813", "#2E2B24"]
                  : (isRedeliveryOrCo2
                      ? ["#00C896", "#4A9EFF", "#E8442A"]
                      : ["#E8442A", "#4A9EFF", "#00C896"])
              }
            >
              {isLoading ? (
                // --- SUBTLE SHIMMER SKELETON LOADER CARD ---
                <div
                  id={`kpi-card-skeleton-${kpi.id}`}
                  className="p-5 flex flex-col justify-between h-full w-full bg-surface-1 bg-opacity-40 animate-pulse text-paper/40"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex flex-col space-y-2 w-2/3">
                      <div className="h-3.5 w-11/12 bg-rule rounded-sm opacity-70" />
                      <div className="h-2 w-1/2 bg-rule rounded-xs opacity-50" />
                    </div>
                    <div className="w-7 h-7 bg-rule rounded-sm opacity-60 flex items-center justify-center">
                      <div className="w-3.5 h-3.5 rounded-full bg-surface-2" />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mt-4 w-full">
                    <div className="h-7 w-2/5 bg-rule rounded-sm opacity-80" />
                    <div className="flex flex-col items-end space-y-1 w-1/4">
                      <div className="h-3 w-10/12 bg-rule rounded-sm opacity-80" />
                      <div className="h-2 w-2/3 bg-rule rounded-xs opacity-50" />
                    </div>
                  </div>
                </div>
              ) : (
                // --- ACTUAL DATA KPI CARD ---
                <div
                  id={`kpi-card-${kpi.id}`}
                  className="text-ink p-5 flex flex-col justify-between h-full w-full bg-transparent"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                        {kpi.title}
                      </span>
                      <span className="text-[9px] text-muted/65 -mt-0.5">
                        {kpi.jpTitle}
                      </span>
                    </div>
                    <div className="p-1.5 bg-[#0D1117]/10 rounded">
                      <Icon className="w-4 h-4 text-ink" />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mt-2">
                    <span className="font-display font-bold text-2xl tracking-tight">
                      {kpi.value}
                    </span>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-mono font-bold ${
                        kpi.id === "redelivery" || kpi.id === "co2" ? "text-signal" : "text-accent"
                      }`}>
                        {kpi.delta}
                      </span>
                      <span className="text-[8px] text-muted leading-none">
                        {kpi.deltaJp}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </BorderGlow>
          );
        })}
      </div>

      {/* MID SECTION: CHART & VEHICLE LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend line-chart card */}
        <div 
          id="dashboard-trend-card"
          className="lg:col-span-2 bg-paper text-ink rounded-lg p-5 shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col">
                <h3 className="font-display font-medium text-sm text-ink tracking-tight">
                  Redelivery Rate Trend (Projected 30 Days)
                </h3>
                <span className="text-[10px] text-muted leading-tight mt-0.5">
                  再配達率変遷（前月比・匠ルート導入効果）
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono font-bold text-signal px-2 py-0.5 bg-[#00C896]/10 rounded">
                  Target: &lt;10%
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={projectedTrend()}
                  margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#888888" 
                    fontSize={9}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={9}
                    domain={[0, 50]}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#F5F5F0", borderColor: "#e0e0e0", fontSize: "11px", color: "#0D1117" }}
                    itemStyle={{ color: "#0D1117" }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={32} 
                    iconSize={10}
                    wrapperStyle={{ fontSize: "11px", fontFamily: "sans-serif" }}
                  />
                  <Line
                    type="monotone"
                    name="Historic Baseline (業界平均)"
                    dataKey="baseline"
                    stroke="#E8442A"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    name="TakumiRoute Optimized (匠ルート)"
                    dataKey="takumi"
                    stroke="#00C896"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* FEED: 10 auto-updating websocket logistics log */}
        <div 
          id="dashboard-activity-feed"
          className="bg-paper text-ink rounded-lg p-5 shadow-md flex flex-col justify-between"
        >
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3">
              <div className="flex flex-col">
                <h3 className="font-display font-medium text-sm text-ink tracking-tight flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-accent" /> Agent Activity Feed
                </h3>
                <span className="text-[10px] text-muted leading-tight mt-0.5">
                  動的交渉・再配分調整ログ
                </span>
              </div>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-signal"></span>
              </span>
            </div>

            {/* Event rows */}
            <div className="flex-1 overflow-y-auto max-h-64 pr-1 space-y-2">
              {events.slice(0, 10).map((evt) => {
                const isNavigable = evt.delivery_id && evt.delivery_id !== "GLOBAL-OPT" && evt.delivery_id !== "GLOBAL-CONF";
                return (
                  <div
                    id={`feed-item-${evt.id}`}
                    key={evt.id}
                    onClick={() => isNavigable && handleEventClick(evt.delivery_id)}
                    className={`p-2.5 rounded text-left transition-colors border border-[#e0e0e0]/40 ${
                      isNavigable ? "cursor-pointer hover:bg-neutral-200" : ""
                    } bg-[#0D1117]/5`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-mono px-1 py-0.5 rounded uppercase font-bold bg-[#0D1117]/10 text-muted">
                          {evt.delivery_id}
                        </span>
                        <span className="text-[9px] font-bold text-muted truncate max-w-[80px]">
                          {evt.recipient_name.split(" ")[0]}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-muted">
                        {evt.timestamp}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink leading-relaxed mt-1 font-medium italic">
                      {evt.message}
                    </p>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-3 text-center border-t border-[#e0e0e0] pt-2.5">
              <span className="text-[10px] text-muted">
                Showing last 10 live dispatch interactions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* REAT-TIME CARBON REDUCTION TELEMETRY TRACKER */}
      <CarbonTracker />

      {/* ML-BASED REDELIVERY PROBABILITY RISK PROFILER */}
      <RedeliveryProfiler />

      {/* TODAY'S ROUTES SUMMARY */}
      <div id="route-summary-section" className="space-y-3">
        <div className="flex flex-col">
          <h3 className="font-display font-semibold text-sm text-paper">
            Today's Route Delivery Summary
          </h3>
          <span className="text-[10px] text-muted">
            担当車両別運行進捗・在宅予測平均（p_home分布）
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {vehicles.map((v) => {
            const barColor = getPHomeColor(v.averagePHome);
            return (
              <div
                id={`vehicle-route-${v.id}`}
                key={v.id}
                onClick={() => handleVehicleClick(v.id)}
                className="bg-paper text-ink rounded-lg p-4 shadow-md transition-all duration-200 cursor-pointer hover:translate-y-[-2px] hover:shadow-lg flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-muted block leading-none">
                      VEHICLE {v.id}
                    </span>
                    <span className="text-xs font-bold leading-tight block mt-1">
                      {v.driverName}
                    </span>
                  </div>
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: v.color }} 
                  />
                </div>

                <div className="space-y-2 mt-4">
                  {/* Stops count and progress display */}
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted">Stops: <strong>{v.stopsCount} stops</strong></span>
                    <span className="font-semibold text-ink">Avg p_home: <strong>{(v.averagePHome * 100).toFixed(0)}%</strong></span>
                  </div>

                  {/* Prediction level progress bar */}
                  <div className="w-full h-1.5 bg-[#0D1117]/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500"
                      style={{ 
                        width: `${v.averagePHome * 100}%`,
                        backgroundColor: barColor 
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
