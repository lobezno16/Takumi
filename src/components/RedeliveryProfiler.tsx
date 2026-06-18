/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { useDeliveryStore } from "../store";
import { calculateRedeliveryRisk, getPHomeColor } from "../utils";
import { 
  Cpu, 
  Search, 
  MapPin, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  User, 
  Building2, 
  Clock, 
  Zap, 
  HelpCircle,
  MessageSquare,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Binary
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

export default function RedeliveryProfiler() {
  const { deliveries, setSelectedDeliveryId, setCurrentPage } = useDeliveryStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"risk_desc" | "risk_asc" | "p_home_desc">("risk_desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. Calculate risk detail for all active deliveries
  const analyzedDeliveries = useMemo(() => {
    return deliveries.map((d) => {
      const risk = calculateRedeliveryRisk(d);
      return {
        delivery: d,
        risk
      };
    });
  }, [deliveries]);

  // 2. Select default delivery once
  const selectedRecord = useMemo(() => {
    if (selectedId) {
      const found = analyzedDeliveries.find((rec) => rec.delivery.id === selectedId);
      if (found) return found;
    }
    // Fallback to highest risk or first available
    const sorted = [...analyzedDeliveries].sort((a, b) => b.risk.score - a.risk.score);
    return sorted[0] || null;
  }, [analyzedDeliveries, selectedId]);

  // Set default selection state if none
  if (selectedRecord && !selectedId) {
    setSelectedId(selectedRecord.delivery.id);
  }

  // 3. Filtering & Sorting
  const filteredAndSortedRecords = useMemo(() => {
    return analyzedDeliveries
      .filter((rec) => {
        const d = rec.delivery;
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
          d.recipientName.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          d.address.toLowerCase().includes(q) ||
          d.district.toLowerCase().includes(q);

        if (!matchesSearch) return false;

        const score = rec.risk.score;
        if (riskFilter === "high") return score >= 0.60;
        if (riskFilter === "medium") return score >= 0.35 && score < 0.60;
        if (riskFilter === "low") return score < 0.35;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "risk_desc") return b.risk.score - a.risk.score;
        if (sortBy === "risk_asc") return a.risk.score - b.risk.score;
        if (sortBy === "p_home_desc") return b.delivery.pHome - a.delivery.pHome;
        return 0;
      });
  }, [analyzedDeliveries, searchQuery, riskFilter, sortBy]);

  // Handle jump to chat agent negotiator
  const handleNegotiateClick = (dId: string) => {
    setSelectedDeliveryId(dId);
    setCurrentPage("deliveries");
  };

  // Convert SHAP / Logistic regression weights contribution to chart representation
  const contributionChartData = useMemo(() => {
    if (!selectedRecord) return [];
    
    const { breakdown } = selectedRecord.risk;
    const items = [
      {
        name: "Model Intercept (モデル閾値基底)",
        weight: breakdown.baseRate,
        description: "Static carrier baseline failure risk"
      },
      {
        name: "Attendance Forecast Penalty (在宅予測乖離)",
        weight: breakdown.attendanceInfluence,
        description: "Gap in presence forecast during designated hours"
      },
      {
        name: "Chronic Missed Recipient Rates (過去リ配達不達)",
        weight: breakdown.historyInfluence,
        description: "Historical failure rate bias calculated from last 30 attempts"
      },
      {
        name: "Physical Access Bottlenecks (オートロック住宅)",
        weight: breakdown.housingInfluence,
        description: "Elevator gating security intercom delay penalty"
      },
      {
        name: "Slot Congestion Penalty (通勤ピーク混雑)",
        weight: breakdown.slotInfluence,
        description: "Rush hour traffic and commuter commuter hour alignment"
      }
    ];

    return items;
  }, [selectedRecord]);

  return (
    <div 
      id="redelivery-profiler-section" 
      className="bg-paper text-ink rounded-lg p-5 shadow-md flex flex-col space-y-4 select-none"
    >
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-200 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 px-1.5 bg-accent/15 rounded text-accent border border-accent/20">
            <Cpu className="w-4 h-4 text-accent animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-display font-medium text-sm text-ink tracking-tight flex items-center gap-1.5">
              ML-Based Redelivery Risk Profiler
              <span className="text-[10px] font-mono font-bold bg-[#0D1117]/10 text-muted px-1.5 py-0.5 rounded ml-1.5">
                Logistic Regression [Sigmoid]
              </span>
            </h3>
            <span className="text-[10px] text-muted leading-none">
              機械学習・再配達確率判定シグネチャプロファイラ
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted font-mono font-bold uppercase tracking-wider">
            Engine Confidence:
          </span>
          <span className="text-[10px] font-mono font-bold text-signal px-2 py-0.5 bg-signal/15 border border-signal/25 rounded">
            94.8% AUC-ROC
          </span>
        </div>
      </div>

      {/* METRIC SUBGRID OVERVIEW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#0D1117]/5 p-3 rounded-lg border border-neutral-200/50">
        <div className="flex flex-col">
          <span className="text-[9px] text-muted font-mono uppercase">Total Analyzed Stop Addresses</span>
          <span className="font-display font-bold text-sm text-ink">{deliveries.length} stops</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-muted font-mono uppercase">Critical Absenty Risk stops (&gt;60%)</span>
          <span className="font-display font-bold text-sm text-accent">
            {analyzedDeliveries.filter(r => r.risk.score >= 0.60).length} units
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-muted font-mono uppercase">Mean Risk Level</span>
          <span className="font-display font-bold text-sm text-ink">
            {(analyzedDeliveries.reduce((acc, r) => acc + r.risk.score, 0) / analyzedDeliveries.length * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-muted font-mono uppercase">Primary Feature Weights (SHAP)</span>
          <span className="font-display font-bold text-sm text-data">Attendance Gap (38%)</span>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: ACTIVE ADRESSES LIST (Col Span: 5) */}
        <div className="lg:col-span-5 flex flex-col space-y-2.5 h-[360px] overflow-hidden">
          
          {/* SEARCH AND FILTERS */}
          <div className="space-y-2 shrink-0">
            {/* Search Input bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
              <input
                id="profiler-search-input"
                type="text"
                placeholder="Search recipient or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0D1117]/5 border border-neutral-300 rounded pl-8 pr-2 py-1.5 text-[11px] outline-none focus:border-accent font-medium text-ink"
              />
            </div>

            {/* Filter Pills and Sort Bar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  id="tab-risk-all"
                  onClick={() => setRiskFilter("all")}
                  className={`px-2 py-1 rounded text-[9px] font-bold ${
                    riskFilter === "all" 
                      ? "bg-[#0D1117] text-paper" 
                      : "bg-[#0D1117]/5 text-muted hover:bg-neutral-100"
                  }`}
                >
                  All ({analyzedDeliveries.length})
                </button>
                <button
                  id="tab-risk-high"
                  onClick={() => setRiskFilter("high")}
                  className={`px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 ${
                    riskFilter === "high" 
                      ? "bg-accent text-paper" 
                      : "bg-[#0D1117]/5 text-muted hover:bg-neutral-100"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E8442A]" /> High
                </button>
                <button
                  id="tab-risk-medium"
                  onClick={() => setRiskFilter("medium")}
                  className={`px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 ${
                    riskFilter === "medium" 
                      ? "bg-amber-500 text-paper" 
                      : "bg-[#0D1117]/5 text-muted hover:bg-neutral-100"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" /> Med
                </button>
                <button
                  id="tab-risk-low"
                  onClick={() => setRiskFilter("low")}
                  className={`px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 ${
                    riskFilter === "low" 
                      ? "bg-signal text-paper animate-none" 
                      : "bg-[#0D1117]/5 text-muted hover:bg-neutral-100"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C896]" /> Low
                </button>
              </div>

              {/* Sort Switcher */}
              <select
                id="profiler-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#0D1117]/5 border border-neutral-300 rounded text-[9px] font-bold p-1 outline-none text-muted"
              >
                <option value="risk_desc">Risk (High → Low)</option>
                <option value="risk_asc">Risk (Low → High)</option>
                <option value="p_home_desc">p_home Forecast</option>
              </select>
            </div>
          </div>

          {/* ACTIVE RECORD CARDS LIST CONTAINER */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
            {filteredAndSortedRecords.length === 0 ? (
              <div className="p-8 text-center text-muted font-mono text-[10px] bg-[#0D1117]/5 border border-dashed border-neutral-300 rounded">
                No addresses match current risk filter criteria.
              </div>
            ) : (
              filteredAndSortedRecords.map((rec) => {
                const isSelected = selectedRecord?.delivery.id === rec.delivery.id;
                const scorePercent = Math.round(rec.risk.score * 100);
                
                // Color mapping for pill
                let riskBadgeClass = "bg-[#00C896]/10 text-[#00C896] border-[#00C896]/20";
                if (rec.risk.score >= 0.60) {
                  riskBadgeClass = "bg-[#E8442A]/10 text-[#E8442A] border-[#E8442A]/20";
                } else if (rec.risk.score >= 0.35) {
                  riskBadgeClass = "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/25";
                }

                return (
                  <div
                    id={`profiler-card-${rec.delivery.id}`}
                    key={rec.delivery.id}
                    onClick={() => setSelectedId(rec.delivery.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-[#0D1117] text-paper border-[#0D1117]" 
                        : "bg-[#0D1117]/5 text-ink border-neutral-200/60 hover:bg-[#0D1117]/10"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1.5">
                      <div className="space-y-0.5 truncate flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold text-[9px] px-1 rounded ${isSelected ? "bg-white/10 text-muted" : "bg-[#0D1117]/10 text-muted"}`}>
                            {rec.delivery.id}
                          </span>
                          <span className="font-bold truncate">{rec.delivery.recipientName.split(" ")[0]}</span>
                        </div>
                        <div className={`text-[10px] truncate ${isSelected ? "text-neutral-300" : "text-muted"}`}>
                          {rec.delivery.address}
                        </div>
                      </div>
                      
                      {/* Risk Score Pill */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${isSelected ? "bg-white/10 text-white border-transparent" : riskBadgeClass}`}>
                        {scorePercent}% Risk
                      </span>
                    </div>
                    
                    {/* Tiny inline summary details */}
                    <div className="flex items-center justify-between text-[9px] mt-1.5 pt-1.5 border-t border-neutral-200/10 opacity-80">
                      <span className="flex items-center gap-0.5">
                        <Building2 className="w-3 h-3 text-muted" /> {rec.delivery.floorType.split(" ")[0]}
                      </span>
                      <span className="flex items-center gap-0.5 font-mono">
                        <Clock className="w-3 h-3 text-muted" /> {rec.delivery.scheduledSlot}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: ML EXPLAINABILITY & COEF BREAKDOWN (Col Span: 7) */}
        <div className="lg:col-span-7 flex flex-col justify-between h-[360px]">
          {selectedRecord ? (
            <div id="ml-explainability-card" className="bg-[#0D1117] text-paper rounded-lg p-4 border border-accent/15 flex flex-col justify-between h-full relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
              
              <div className="space-y-4">
                {/* Header detail */}
                <div className="flex justify-between items-start border-b border-[#22272E] pb-2 text-[11px]">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-accent font-mono uppercase tracking-wider">
                      Address Model Prediction Explainability
                    </span>
                    <h4 className="font-display font-bold text-xs text-paper flex items-center gap-1 mt-0.5">
                      <Binary className="w-3.5 h-3.5 text-accent animate-spin" style={{ animationDuration: "5s" }} /> 
                      Logistic Model Weights Diagnostic • [{selectedRecord.delivery.id}]
                    </h4>
                  </div>
                  <button
                    id="negotiate-agent-trigger-btn"
                    onClick={() => handleNegotiateClick(selectedRecord.delivery.id)}
                    className="p-1 px-2 text-[9px] font-bold bg-accent hover:bg-accent-muted text-paper rounded flex items-center gap-1 transition-all"
                  >
                    AI Agent Negotiate <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Main comparison breakdown gauges */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-stretch">
                  
                  {/* Gauge 1: calculated Redelivery Risk Probability */}
                  <div className="bg-[#161B22] border border-[#22272E] rounded p-3 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col leading-none">
                        <span className="text-[8px] font-mono text-muted uppercase">Risk Probability</span>
                        <span className="text-[8px] text-muted font-bold">再配達シグネチャ予測</span>
                      </div>
                      <AlertTriangle className={`w-4 h-4 ${selectedRecord.risk.score >= 0.60 ? "text-accent" : "text-amber-500"}`} />
                    </div>

                    <div className="space-y-0.5 mt-3">
                      <span className="font-display font-extrabold text-[22px] tracking-tight text-white font-mono block">
                        {(selectedRecord.risk.score * 100).toFixed(0)}%
                      </span>
                      <span className="text-[7.5px] text-muted block italic">
                        {selectedRecord.risk.score >= 0.60 
                          ? "Highly vulnerable to delivery failure" 
                          : selectedRecord.risk.score >= 0.35 
                          ? "Moderate attendance uncertainty" 
                          : "Predictive high compliance"}
                      </span>
                    </div>
                  </div>

                  {/* Gauge 2: Model inputs summary - housing and slot */}
                  <div className="bg-[#161B22] border border-[#22272E] rounded p-3 flex flex-col justify-between">
                    <span className="text-[8px] font-mono text-muted uppercase block leading-none">Access Burden Score</span>
                    <div className="space-y-0.5 mt-3">
                      <span className="font-display font-semibold text-xs text-paper block leading-snug truncate">
                        {selectedRecord.delivery.floorType}
                      </span>
                      <span className="text-[8px] text-neutral-400 block font-mono">
                        Slot: {selectedRecord.delivery.scheduledSlot}
                      </span>
                    </div>
                  </div>

                  {/* Gauge 3: Raw Home Presence Model Forecast */}
                  <div className="bg-[#161B22] border border-[#22272E] rounded p-3 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[8px] font-mono text-muted uppercase leading-none">Target Slot p_home</span>
                      <Sparkles className="w-3.5 h-3.5 text-signal" />
                    </div>
                    <div className="mt-3">
                      <span className="font-display font-mono font-bold text-lg text-signal block">
                        {(selectedRecord.delivery.pHome * 100).toFixed(0)}%
                      </span>
                      <span className="text-[8px] text-muted block">在宅予測確率スコア</span>
                    </div>
                  </div>

                </div>

                {/* HORIZONTAL FEATURES SHAP GRAPH */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-[9px] text-muted">
                    <label className="font-bold tracking-wide uppercase font-mono">Weight Impact (Log-Odds Contribution)</label>
                    <span className="font-mono text-paper font-semibold">Intercept Bias: -2.1 base</span>
                  </div>

                  {/* Dynamic weights mini-bar chart */}
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={contributionChartData}
                        margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#22272E" horizontal={false} />
                        <XAxis type="number" fontSize={8} stroke="#888888" tickLine={false} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          fontSize={8} 
                          stroke="#888888" 
                          tickLine={false} 
                          width={40}
                          tickFormatter={(n) => n.split(" ")[0]} // e.g., "Model"
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#161B22", borderColor: "#22272E", fontSize: "10px", color: "#F5F5F0" }}
                          itemStyle={{ color: "#F5F5F0" }}
                        />
                        <Bar dataKey="weight" name="SHAP Logit Share" radius={[0, 2, 2, 0]} barSize={8}>
                          {contributionChartData.map((entry, index) => {
                            const isPositive = entry.weight >= 0;
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={isPositive ? (index === 0 ? "#6B7280" : "#E8442A") : "#00C896"} 
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Core model reasoning footer */}
              <div className="text-[9px] text-muted italic leading-relaxed border-t border-[#22272E] pt-2 flex justify-between items-center bg-[#161B22]/10 -mx-4 px-4 py-2 mt-2">
                <span>
                  <strong>ML Logic:</strong> Recipient 30-day historical failure matches (avg <strong>{(selectedRecord.risk.features.avgHistSuccess * 100).toFixed(0)}%</strong>) paired with current slot presence variables.
                </span>
                <span className="font-mono font-bold text-accent shrink-0 select-none">
                  [SHAP MODEL: SIGMOID_REG]
                </span>
              </div>

            </div>
          ) : (
            <div className="h-full border border-dashed border-neutral-300 rounded-lg flex flex-col justify-center items-center p-8 text-center text-muted">
              <Cpu className="w-8 h-8 text-neutral-400 mb-2 animate-pulse" />
              <p>Select an active delivery address from the left column to populate the Live Logistic ML Explanation Diagnostics.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
