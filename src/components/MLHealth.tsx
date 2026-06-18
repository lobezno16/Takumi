/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { MOCK_ML_HEALTH } from "../mockData";
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  Activity, 
  ShieldAlert, 
  ShieldCheck, 
  FileText, 
  ArrowUpRight, 
  HelpCircle,
  Database,
  Sliders,
  Sparkles,
  Zap
} from "lucide-react";
import BorderGlow from "./BorderGlow";
import Ferrofluid from "./Ferrofluid";

export default function MLHealth() {
  const [driftError, setDriftError] = useState(MOCK_ML_HEALTH.driftError);
  const driftThreshold = MOCK_ML_HEALTH.driftThreshold;
  
  // Is current drift above user adjustable/simulated threshold?
  const isDriftActive = driftError > driftThreshold;

  // Render chart data overlaying the curves
  const calibrationData = MOCK_ML_HEALTH.calibrationCurve;
  const featureData = MOCK_ML_HEALTH.featureImportance;
  const models = MOCK_ML_HEALTH.modelVersions;

  return (
    <div id="ml-health-page" className="p-6 space-y-6 bg-ink h-auto min-h-[calc(100vh-64px)] text-xs select-none">
      
      {/* 1. DYNAMIC RETRAINING DRIFT BANNER & INTERACTIVE DECORATIVE BACKGROUND */}
      <BorderGlow
        glowColor={isDriftActive ? "12 85 50" : "150 80 50"}
        backgroundColor="#161B22"
        borderRadius={12}
        glowRadius={40}
        glowIntensity={1.2}
        colors={isDriftActive ? ["#E8442A", "#C4850A", "#E8442A"] : ["#3D6B8A", "#C4850A", "#3D6B8A"]}
        className="w-full relative overflow-hidden"
      >
        <div className="relative w-full p-6 overflow-hidden min-h-[220px] flex flex-col justify-between">
          {/* Animated Liquid Background Layer */}
          <div className="absolute inset-0 z-0">
            <Ferrofluid
              colors={isDriftActive ? ["#E8442A", "#C4850A", "#FFA500"] : ["#3D6B8A", "#C4850A", "#4A9EFF"]}
              backgroundColor="#0D1117"
              speed={0.2 + driftError * 12.0} // Speeds up as drift rate rises
              scale={1.2}
              turbulence={0.6 + driftError * 18.0} // Gets chaotic as model drifts
              fluidity={0.08}
              rimWidth={0.22}
              sharpness={3.2}
              shimmer={1.0 + driftError * 5.0} // Shimmers more during higher error
              glow={1.8 + driftError * 6.0} // Glow increases based on calibration urgency
              flowDirection="down"
              opacity={0.35} // Subtly blended so content overlay remains readable and high-contrast
              mouseInteraction={true}
              mouseStrength={1.5}
              mouseRadius={0.32}
            />
          </div>

          {/* Glowing Absolute Label */}
          <div className="absolute top-4 right-4 bg-ink/80 backdrop-blur-md px-2.5 py-1 rounded border border-[#22272E] pointer-events-none select-none z-10">
            <span className="text-[9px] font-mono font-bold tracking-widest text-[#F5F5F0] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isDriftActive ? "bg-accent animate-ping" : "bg-signal animate-pulse"}`} />
              NEURAL ATTENDANCE FLOW VECTOR: {(driftError * 100).toFixed(1)}%
            </span>
          </div>

          {/* Interactive Information & Tuning Layout */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
            
            {/* Status Narrative Column */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-accent/20 text-accent font-mono text-[9px] font-bold tracking-wider uppercase">
                  Latent Signal Tracker
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono text-[9px] font-bold tracking-wider uppercase">
                  p_home calibration
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-base md:text-lg font-display font-bold text-paper tracking-tight">
                  Real-Time AI Processing & Calibration Patterns
                </h2>
                <p className="text-[10px] text-muted-foreground text-gray-300 max-w-xl leading-relaxed">
                  The underlying fluid ripples and peaks represent the model's dynamic weight sensitivity matrices for Tokyo Kōtō-ku attendance predictions. Hovering triggers localized magnetic spikes mapping spatial presence signatures.
                </p>
              </div>

              {/* Dynamic Alert Banner wrapped inside the card */}
              {isDriftActive ? (
                <div id="drift-alert-banner" className="bg-accent/15 border border-accent/30 rounded-lg p-3 flex items-start gap-3 relative overflow-hidden backdrop-blur-xs">
                  <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <span className="text-[11px] font-bold text-paper block">
                      Feature Calibration Drift Alert : Retraining Required
                    </span>
                    <span className="text-[9px] text-[#E8442A] block leading-normal italic">
                      Current error ({(driftError * 100).toFixed(1)}%) surpasses target error budget ({(driftThreshold * 100).toFixed(0)}%). Attendee profiles show strong shift signatures. Retrain on GPU node 4.
                    </span>
                  </div>
                </div>
              ) : (
                <div id="drift-healthy-banner" className="bg-[#4A9EFF]/10 border border-[#4A9EFF]/25 rounded-lg p-3 flex items-start gap-3 relative overflow-hidden backdrop-blur-xs">
                  <ShieldCheck className="w-4 h-4 text-[#4A9EFF] shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-0.5">
                    <span className="text-[11px] font-bold text-paper block">
                      Latency Mapping Stabilized
                    </span>
                    <span className="text-[9px] text-gray-400 block leading-normal">
                      Drift signature ({(driftError * 100).toFixed(1)}%) is within nominal operational boundaries. Kōtō-ku spatial patterns align perfectly with model weights.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Operator Control Box Slider */}
            <div className="lg:col-span-2 bg-[#161B22]/85 backdrop-blur-md border border-[#22272E] p-4 rounded-lg flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <h4 className="font-display font-medium text-xs text-paper flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-accent" /> MLOps Attrib Drift Slider
                </h4>
                <p className="text-[9px] text-muted">
                  Manually adjust simulated covariate drift rate values to inspect real-time neural churn behaviors.
                </p>
              </div>

              <div className="space-y-2 pt-1 border-t border-[#22272E]/60">
                <div className="flex justify-between items-center text-[9px] font-mono text-gray-400">
                  <span>DRIFT SCALE: {(driftError * 100).toFixed(1)}%</span>
                  <span className={isDriftActive ? "text-accent font-bold animate-pulse" : "text-[#4A9EFF] font-bold"}>
                    {isDriftActive ? "RETRAIN STAGE" : "STABLE"}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    id="slider-drift-scale"
                    type="range"
                    min={0.01}
                    max={0.10}
                    step={0.005}
                    value={driftError}
                    onChange={(e) => setDriftError(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[#0D1117] accent-accent"
                  />
                  <span className="font-mono text-accent font-bold text-xs shrink-0 w-8 text-right">
                    {(driftError * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </BorderGlow>

      {/* CORE ML VISUALIZERS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* MODEL CALIBRATION DIAGONAL CURVE */}
        <div id="ml-calibration-curve-card" className="bg-paper text-ink rounded-lg p-5 shadow-md flex flex-col justify-between">
          <div className="flex flex-col mb-4">
            <div className="flex justify-between items-start">
              <h3 className="font-display font-bold text-sm text-ink leading-tight">
                Model Attendance Calibration Reliability Curve
              </h3>
              <span className="text-[10px] font-semibold text-data uppercase font-mono bg-data/10 px-2 py-0.5 rounded">
                Brier: 0.082
              </span>
            </div>
            <span className="text-[10px] text-muted leading-tight mt-0.5">
              予測確率と実際の出席率の校正曲線（完璧な信頼対角線との乖離、信頼区間表示）
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={calibrationData}
                margin={{ top: 10, right: 15, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" fontSize={9} stroke="#888888" />
                <YAxis fontSize={9} stroke="#888888" tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#F5F5F0", fontSize: "11px", color: "#0D1117" }}
                  itemStyle={{ color: "#0D1117" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                
                {/* Perfect calibration reference */}
                <Line
                  name="Perfect Calibration (対角参照線)"
                  type="monotone"
                  dataKey="perfect"
                  stroke="#6B7280"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  dot={false}
                />
                
                {/* Model reality curve shaded */}
                <Area
                  name="Model predicted confidence (モデル校正値)"
                  type="monotone"
                  dataKey="model"
                  stroke="#4A9EFF"
                  fill="#4A9EFF"
                  fillOpacity={0.12}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="text-[9.5px] text-muted italic leading-relaxed pt-2.5 border-t border-neutral-200 mt-2 font-sans">
            Our neural model fits very tightly to the diagonal reference, implying that a predicted 80% p_home corresponds to exactly 80% customer attendance in real-world Kōtō-ku validation runs.
          </div>
        </div>

        {/* FEATURE IMPORTANCE LIST GRAPH */}
        <div id="ml-feature-importance-card" className="bg-paper text-ink rounded-lg p-5 shadow-md flex flex-col justify-between">
          <div className="flex flex-col mb-4">
            <h3 className="font-display font-bold text-sm text-ink leading-tight">
              Feature Importance Weights Map
            </h3>
            <span className="text-[10px] text-muted leading-tight mt-0.5">
              予測決定に寄与する上位10項目特徴量ウェイト
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={featureData}
                margin={{ top: 10, right: 15, left: 35, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" fontSize={9} stroke="#888888" domain={[0, 0.5]} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  fontSize={8} 
                  stroke="#888888" 
                  width={90} 
                  tickFormatter={(name) => name.split(" ")[0]} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#F5F5F0", fontSize: "11px", color: "#0D1117" }}
                  itemStyle={{ color: "#0D1117" }}
                />
                <Bar dataKey="importance" name="Weight (SHAP value)" fill="#4A9EFF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[9.5px] text-muted italic leading-relaxed pt-2.5 border-t border-neutral-200 mt-2 font-sans">
            <strong>Historical Recipient Attendance</strong> represents the gold-standard features column (38% weight), followed by structural housing characteristics (apartment elevation layout, 18%).
          </div>
        </div>

      </div>

      {/* 2. REVISIONS STATUS INDEX MODEL TABLE */}
      <div id="ml-version-table-container" className="space-y-3">
        <div className="flex flex-col">
          <h3 className="font-display font-bold text-sm text-paper flex items-center gap-1.5">
            <Database className="w-4 h-4 text-accent" /> Active Model Version Registry
          </h3>
          <span className="text-[10px] text-muted">
            登録モデル・トレーニングバージョン履歴テーブル
          </span>
        </div>

        <div className="bg-[#161B22] border border-[#22272E] rounded-lg overflow-hidden flex flex-col">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#0D1117] border-b border-[#22272E] text-muted font-mono uppercase text-[9px] font-bold">
                <th className="p-3">Model Tag Version</th>
                <th className="p-3">Trained Timestamp</th>
                <th className="p-3">Average Log Loss</th>
                <th className="p-3 text-right">Registry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22272E]">
              {models.map((mod) => (
                <tr key={mod.version} className="hover:bg-[#0D1117]/40">
                  <td className="p-3 font-mono font-bold text-paper flex items-center gap-2">
                    <Activity className={`w-3.5 h-3.5 ${mod.status === "deployed" ? "text-signal animate-pulse" : "text-muted"}`} />
                    {mod.version}
                  </td>
                  <td className="p-3 text-muted font-mono">{mod.trainedAt}</td>
                  <td className="p-3 text-muted font-mono">{mod.logLoss.toFixed(4)}</td>
                  <td className="p-3 text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider capitalize ${
                      mod.status === "deployed" 
                        ? "bg-signal/15 text-signal border border-signal/25" 
                        : mod.status === "staged" 
                        ? "bg-data/15 text-data border border-data/25" 
                        : "bg-neutral-800 text-muted"
                    }`}>
                      {mod.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
