import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDeliveryStore } from "../store";
import {
  Brain,
  Route,
  Bot,
  Sparkles,
  Shield,
  Clock,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Users,
  CheckCircle,
  TrendingDown,
  ArrowUpRight,
  Database,
  Grid,
  Lock,
  ChevronDown,
  Terminal,
  Activity,
  Map,
  X,
  FileCheck2,
  Calendar,
  Layers,
  Server,
  Zap,
  Phone,
  BarChart2
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid
} from "recharts";

// --- Types & Schema Constants ---
interface MapStop {
  id: string;
  name: string;
  x: number;
  y: number;
  pHome: number; // probability
  baselineStatus: "failed" | "unvisited" | "success";
  optimizedStatus: "success" | "negotiated";
  timeWindow: string;
  negotiatedTime: string;
}

const KOTO_STOPS: MapStop[] = [
  { id: "S1", name: "鈴木様 (鈴木ビル)", x: 45, y: 35, pHome: 0.15, baselineStatus: "failed", optimizedStatus: "negotiated", timeWindow: "14:00 - 16:00", negotiatedTime: "18:30 - 19:30" },
  { id: "S2", name: "高橋様 (レジデンス門前仲町)", x: 120, y: 75, pHome: 0.95, baselineStatus: "success", optimizedStatus: "success", timeWindow: "10:00 - 12:00", negotiatedTime: "10:00 - 12:00" },
  { id: "S3", name: "佐藤様 (木場4丁目コーポ)", x: 210, y: 40, pHome: 0.32, baselineStatus: "failed", optimizedStatus: "negotiated", timeWindow: "13:00 - 15:00", negotiatedTime: "19:00 - 20:00" },
  { id: "S4", name: "田中様 (清澄白河アパート)", x: 280, y: 85, pHome: 0.88, baselineStatus: "success", optimizedStatus: "success", timeWindow: "16:00 - 18:00", negotiatedTime: "16:00 - 18:00" },
  { id: "S5", name: "渡辺様 (豊洲フロントハイツ)", x: 150, y: 145, pHome: 0.40, baselineStatus: "failed", optimizedStatus: "negotiated", timeWindow: "12:00 - 14:00", negotiatedTime: "18:00 - 19:00" },
  { id: "S6", name: "伊藤様 (東陽町レジデンス)", x: 340, y: 130, pHome: 0.92, baselineStatus: "success", optimizedStatus: "success", timeWindow: "11:00 - 13:00", negotiatedTime: "11:00 - 13:00" }
];

export default function LandingPage() {
  const { setCurrentPage } = useDeliveryStore();
  
  // --- States ---
  const [scrolled, setScrolled] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(1);
  const [selectedFleetSize, setSelectedFleetSize] = useState<5 | 25 | 100>(5);
  const [timelineYear, setTimelineYear] = useState<2018 | 2024 | 2030>(2024);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [mapOptimized, setMapOptimized] = useState(false);
  const [mapTicker, setMapTicker] = useState(0);
  const [demoFormSubmitted, setDemoFormSubmitted] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFleetSize, setFormFleetSize] = useState("5-10");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Map Simulation Truck Animation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setMapTicker((prev) => (prev + 1) % 100);
    }, 280);
    return () => clearInterval(interval);
  }, []);

  // Real-time calculated counters inside Hero Map
  const successRate = mapOptimized ? 97.4 : 83.1;
  const redeliveriesSaved = mapOptimized ? 38 + Math.floor(mapTicker / 12) : 2;
  const driverTimeWasted = mapOptimized ? "12 min / Fleet" : "96 min / Fleet";

  // Recharts metric calculations based on fleet selection
  const chartData = [
    { hour: "08:00", baseline: 10, optimized: 10 },
    { hour: "10:00", baseline: 12, optimized: 5 },
    { hour: "12:00", baseline: 16.7 * (selectedFleetSize / 5), optimized: 4.2 * (selectedFleetSize / 5) },
    { hour: "14:00", baseline: 18.2 * (selectedFleetSize / 5), optimized: 3.1 * (selectedFleetSize / 5) },
    { hour: "16:00", baseline: 15.4 * (selectedFleetSize / 5), optimized: 3.4 * (selectedFleetSize / 5) },
    { hour: "18:00", baseline: 22.1 * (selectedFleetSize / 5), optimized: 2.8 * (selectedFleetSize / 5) },
    { hour: "20:00", baseline: 19.8 * (selectedFleetSize / 5), optimized: 2.2 * (selectedFleetSize / 5) },
    { hour: "21:00", baseline: 16 * (selectedFleetSize / 5), optimized: 1.5 * (selectedFleetSize / 5) },
  ];

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoFormSubmitted(true);
    setTimeout(() => {
      setIsDemoModalOpen(false);
      setDemoFormSubmitted(false);
      setFormName("");
      setFormCompany("");
      setFormEmail("");
      setFormPhone("");
    }, 3800);
  };

  return (
    <div className="bg-ink text-paper min-h-screen selection:bg-amber-tint selection:text-amber font-sans relative antialiased overflow-x-hidden">
      
      {/* Structural Thin Grid Line Motif matches line rule color */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--rule)_1px,transparent_1px),linear-gradient(to_bottom,var(--rule)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] rounded-full bg-rule/10 blur-[120px] pointer-events-none" />

      {/* --- 1. JAPANESE INDUSTRIAL NAVIGATION BAR --- */}
      <nav className="fixed top-0 left-0 right-0 z-[100] h-16 flex items-center justify-between px-6 md:px-12 border-b border-[#22272E] bg-ink/95 sticky top-0 backdrop-blur-xs">
        <div className="flex items-center gap-3 select-none cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="min-w-[32px] h-8 bg-accent rounded flex items-center justify-center font-display font-bold text-paper text-sm">
            匠
          </div>
          <div className="flex flex-col text-left">
            <span className="font-display font-bold tracking-wider text-paper text-sm leading-none">
              TakumiRoute
            </span>
            <span className="text-[9px] text-muted leading-tight mt-0.5">
              匠ルート • 配送最適化
            </span>
          </div>
        </div>

        {/* Tactical Menu Links - matching sidebar nav style exactly */}
        <div className="hidden lg:flex items-center gap-8 text-[11px] font-semibold uppercase tracking-wider font-mono text-muted">
          <a href="#problem" className="hover:text-paper transition-all">Logistics Crisis</a>
          <a href="#solutions" className="hover:text-paper transition-all">Core Orchestra</a>
          <a href="#story" className="hover:text-paper transition-all">Field Study</a>
          <a href="#simulate" className="hover:text-paper transition-all">Live Simulation</a>
          <a href="#pricing" className="hover:text-paper transition-all">SME Plans</a>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage("dashboard")}
            className="hidden md:inline-flex text-[11px] uppercase tracking-wider font-bold font-sans text-paper border border-rule rounded hover:bg-surface-2 px-3.5 py-2 transition-all cursor-pointer"
          >
            Launch Core App &rarr;
          </button>
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="text-[11px] uppercase tracking-wider font-bold font-sans bg-accent hover:bg-amber-bright text-paper rounded px-4 py-2 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            Book Demo
          </button>
        </div>
      </nav>

      {/* Spacing for Header */}
      <div className="h-16" />

      {/* --- 2. HERO SECTION --- */}
      <section className="relative pt-12 md:pt-20 pb-16 md:pb-24 border-b border-rule max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Copy Column */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 rounded border border-amber/30 bg-amber-tint px-3 py-1 text-[11px] text-amber font-mono font-bold tracking-wider uppercase">
            <span className="h-2 w-2 rounded-full bg-amber animate-pulse" />
            <span>Structured for the 2024 Overtime Cap Limit</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-5xl font-display font-medium text-paper leading-[1.14] tracking-tight">
            Deliver When People <br className="hidden md:inline" />
            Are <span className="text-amber underline decoration-2 decoration-amber/30 underline-offset-8">Actually Home.</span>
          </h1>

          <p className="text-sm md:text-base text-paper-2 leading-relaxed max-w-xl font-normal font-sans">
            Precision engineering for first-attempt delivery success. We help Japan's regional logistics carrier networks minimize wasted mileage and reclaim lost driver hours through algorithmic coordination and availability heatmaps.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="bg-accent text-paper hover:bg-amber-bright font-bold text-xs uppercase tracking-wider rounded px-6 py-3.5 transition-all flex items-center gap-2 shadow-sm cursor-pointer font-sans"
            >
              Book Operations Demo
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#simulate"
              className="bg-surface-2 border border-rule text-paper hover:bg-surface-1 font-bold text-xs uppercase tracking-wider rounded px-6 py-3.5 transition-all flex items-center gap-2 cursor-pointer font-sans"
            >
              Inspect Grid Simulation
            </a>
          </div>

          {/* Quick trust metrics */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-rule">
            <div>
              <p className="text-2xl font-bold text-paper font-mono">96.2%</p>
              <p className="text-[10px] text-paper-3 uppercase tracking-widest font-mono">1st delivery rate</p>
            </div>
            <div className="border-l border-rule pl-4">
              <p className="text-2xl font-bold text-amber font-mono">75.0%</p>
              <p className="text-[10px] text-paper-3 uppercase tracking-widest font-mono font-sans mt-0.5">redelivery drop</p>
            </div>
            <div className="border-l border-rule pl-4">
              <p className="text-2xl font-bold text-slate font-mono">-83%</p>
              <p className="text-[10px] text-paper-3 uppercase tracking-widest font-mono font-sans mt-0.5">driver waste cut</p>
            </div>
          </div>
        </div>

        {/* Right Hero Visualizer: Interactive Koto-Ku Map Simulation in Warm Light Grid */}
        <div className="lg:col-span-6 standard-card relative overflow-hidden flex flex-col justify-between" style={{ minHeight: '440px' }}>
          <div className="absolute top-3 right-3 p-3 flex gap-2">
            <span className="h-2 w-2 rounded-full bg-slate animate-ping" />
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate font-bold">GRID LINK UP</span>
          </div>

          {/* Interactive Toggle Header */}
          <div className="flex justify-between items-center pb-4 border-b border-rule">
            <div className="text-left">
              <p className="text-[9px] uppercase font-mono tracking-wider text-paper-3 leading-none">Tokyo Kōtō-ku Route Grid</p>
              <p className="text-sm font-bold text-paper font-display mt-1.5 leading-none">Yamamoto-san (Truck 2) Sequence</p>
            </div>
            <button
              id="hero-vrp-toggle"
              onClick={() => setMapOptimized(!mapOptimized)}
              className={`text-[10px] font-bold uppercase font-mono rounded-md px-3.5 py-1.5 transition-all flex items-center gap-1.5 border ${
                mapOptimized
                  ? "bg-slate text-paper border-slate"
                  : "bg-surface-2 text-paper-3 border-rule"
              }`}
            >
              <Zap className="h-3 w-3" />
              {mapOptimized ? "TakumiRoute Active" : "Baseline Dispatch"}
            </button>
          </div>

          {/* Real-time Map Canvas simulated by pure responsive SVG */}
          <div className="h-64 md:h-72 w-full bg-[#0E0D0A] rounded-xs relative my-4 border border-rule flex flex-col justify-between overflow-hidden">
            <svg viewBox="0 0 400 200" className="absolute inset-0 w-full h-full p-4" referrerPolicy="no-referrer">
              {/* Grid Roads */}
              <g stroke="var(--rule)" strokeWidth="0.5" strokeOpacity="1" strokeDasharray="3 4">
                <line x1="40" y1="0" x2="40" y2="200" />
                <line x1="120" y1="0" x2="120" y2="200" />
                <line x1="200" y1="0" x2="200" y2="200" />
                <line x1="280" y1="0" x2="280" y2="200" />
                <line x1="360" y1="0" x2="360" y2="200" />
                
                <line x1="0" y1="30" x2="400" y2="30" />
                <line x1="0" y1="80" x2="400" y2="80" />
                <line x1="0" y1="130" x2="400" y2="130" />
                <line x1="0" y1="180" x2="400" y2="180" />
              </g>

              {/* Bay coastline outline (Stylized) */}
              <path d="M 0 160 C 100 155, 170 190, 260 165 C 320 150, 360 185, 400 170" fill="none" stroke="var(--paper-4)" strokeWidth="1" strokeOpacity="0.4" />

              {/* Routing Line representation */}
              {mapOptimized ? (
                // OPTIMIZED PATH: Smooth looping order
                <motion.path
                  d="M 120 75 L 340 130 L 280 85 L 210 40 L 45 35 L 150 145"
                  fill="none"
                  stroke="var(--slate)"
                  strokeWidth="2"
                  strokeDasharray="200"
                  animate={{ strokeDashoffset: [200, 0] }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                />
              ) : (
                // BASELINE PATH: Jagged unoptimized route
                <motion.path
                  d="M 45 35 L 120 75 L 210 40 L 280 85 L 150 145 L 340 130"
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth="1.5"
                  strokeDasharray="200"
                  animate={{ strokeDashoffset: [200, 0] }}
                  transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                />
              )}

              {/* Stop Nodes */}
              {KOTO_STOPS.map((stop) => {
                const isFailed = !mapOptimized && stop.baselineStatus === "failed";
                const isNegotiated = mapOptimized && stop.optimizedStatus === "negotiated";
                const isSuccess = stop.baselineStatus === "success" || (mapOptimized && stop.optimizedStatus === "success") || isNegotiated;

                let nodeColor = "var(--amber)"; // red/amber
                if (isSuccess && isNegotiated) nodeColor = "var(--slate)"; // signal slate
                else if (isSuccess) nodeColor = "var(--slate)"; // tatami green to slate

                return (
                  <g key={stop.id}>
                    {/* Status pulse rings */}
                    <circle
                      cx={stop.x}
                      cy={stop.y}
                      r={isFailed || isNegotiated ? 9 : 6}
                      fill={nodeColor}
                      fillOpacity="0.15"
                      stroke={nodeColor}
                      strokeWidth="0.5"
                    />
                    <circle
                      cx={stop.x}
                      cy={stop.y}
                      r="3.5"
                      fill={nodeColor}
                    />
                    {/* Tiny stats text */}
                    <text x={stop.x} y={stop.y - 8} fill="var(--paper-2)" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      {isNegotiated ? "Moved 18:30" : `p=${stop.pHome.toFixed(2)}`}
                    </text>
                  </g>
                );
              })}

              {/* Truck Marker moving over route */}
              <circle
                cx={mapOptimized ? 210 + Math.sin(mapTicker / 10) * 50 : 150 + Math.cos(mapTicker / 10) * 50}
                cy={mapOptimized ? 90 + Math.sin(mapTicker / 10) * 30 : 80 + Math.cos(mapTicker / 10) * 35}
                r="5"
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth="2"
                className="animate-pulse"
              />
            </svg>

            {/* Simulated Live Console Log Strip in Map */}
            <div className="bg-[#12110C] p-2.5 px-3 font-mono text-[9.5px] text-paper border-t border-rule flex justify-between items-center z-10">
              <span className="flex items-center gap-1.5 text-amber font-bold">
                <Terminal className="h-3 w-3 text-amber" />
                <span>[LOG] {mapOptimized ? "Calibrated OR-Tools solver running" : "Static sequencing active"}</span>
              </span>
              <span className="text-paper-3 font-mono">
                {mapOptimized ? "Success: 96.8%+" : "Redeliveries detected: S1,S3,S5 fail"}
              </span>
            </div>
          </div>

          {/* Real-time stats panel below map */}
          <div className="grid grid-cols-3 gap-2 bg-surface-2 p-3 rounded border border-rule">
            <div className="text-center">
              <p className="text-[8.5px] text-paper-3 uppercase tracking-widest font-mono font-bold leading-none">Attempt success</p>
              <p className={`text-lg font-bold font-mono transition-colors duration-300 mt-1 pb-0.5 ${mapOptimized ? "text-slate" : "text-amber"}`}>
                {successRate}%
              </p>
            </div>
            <div className="text-center border-l border-rule">
              <p className="text-[8.5px] text-paper-3 uppercase tracking-widest font-mono font-bold leading-none">Parcels Saved</p>
              <p className="text-lg font-bold text-paper font-mono mt-1 pb-0.5">
                {redeliveriesSaved} / day
              </p>
            </div>
            <div className="text-center border-l border-rule">
              <p className="text-[8.5px] text-paper-3 uppercase tracking-widest font-mono font-bold leading-none font-sans">Overtime Waste</p>
              <p className="text-[11px] font-bold text-paper mt-1.5 uppercase font-[#111] font-mono leading-none">
                {driverTimeWasted}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- 2.5 TRUST METRICS GRID BANNER (Plex Mono Metrics) --- */}
      <section className="bg-surface-2 border-y border-rule py-10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center font-sans">
          <div className="space-y-1">
            <p className="text-[10px] text-amber uppercase tracking-[0.2em] font-mono font-bold">Industry Standard</p>
            <p className="text-4xl font-bold font-mono text-paper">96.2%</p>
            <p className="text-xs text-paper-2 font-sans">First-Attempt Success Rate</p>
          </div>
          <div className="space-y-1 border-l border-rule">
            <p className="text-[10px] text-amber uppercase tracking-[0.2em] font-mono font-bold">Operational Leak</p>
            <p className="text-4xl font-bold font-mono text-paper">75.0%</p>
            <p className="text-xs text-paper-2 font-sans">Reduction in Redeliveries</p>
          </div>
          <div className="space-y-1 border-l border-rule">
            <p className="text-[10px] text-amber uppercase tracking-[0.2em] font-mono font-bold">Labor Recovery</p>
            <p className="text-4xl font-bold font-mono text-paper">83.0%</p>
            <p className="text-xs text-paper-2 font-sans">Less Driver Time Waste</p>
          </div>
          <div className="space-y-1 border-l border-rule">
            <p className="text-[10px] text-amber uppercase tracking-[0.2em] font-mono font-bold">EBITDA Impact</p>
            <p className="text-4xl font-bold font-mono text-paper">¥2.9M</p>
            <p className="text-xs text-paper-2 font-semibold font-sans">Annual Savings per Fleet</p>
          </div>
        </div>
      </section>

      {/* --- 3. PROBLEM SECTION ("Japan's Logistics Cliff Is Already Here") --- */}
      <section id="problem" className="py-20 md:py-28 border-b border-rule max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left problematic copy content */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex gap-2 items-center text-amber font-mono text-[10.5px] uppercase tracking-wider bg-amber-tint px-2.5 py-1 rounded border border-amber/20 font-bold">
              <AlertTriangle className="h-4.5 w-4.5" />
              <span>Japan Logistics Crisis (日本物流危機)</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-display font-medium text-paper leading-tight">
              Japan's Logistics Cliff <br />Is Already Here.
            </h2>
            
            <p className="text-sm text-paper-2 leading-relaxed font-sans">
              Under strict labor statutes enforced on April 1, 2024, commercial driver overtime is legally capped at <strong className="text-paper font-mono">960 hours per year</strong>. Combined with an aging driver population, Japan faces a severe structural collapse.
            </p>

            <ul className="space-y-3.5 text-xs text-paper-2 font-sans">
              <li className="flex gap-2.5 items-start">
                <span className="h-2 w-2 mt-1.5 bg-amber rounded-full shrink-0" />
                <span><strong>No more overtime margins:</strong> Carrier networks can no longer solve coordination gaps using extra hours on the road.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="h-2 w-2 mt-1.5 bg-amber rounded-full shrink-0" />
                <span><strong>34% capacity collapse:</strong> By 2030, a third of Japan's residential parcels will go undelivered without computational route overhauls.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="h-2 w-2 mt-1.5 bg-amber rounded-full shrink-0" />
                <span><strong>8-9% Baseline Waste:</strong> Traditional scheduling leaks up to 9% of day shifts on redundant repeat attempts at empty homes.</span>
              </li>
            </ul>
          </div>

          {/* Right Chronological Infographic Timeline in Industrial Board Styling */}
          <div className="lg:col-span-7 standard-card relative">
            <h3 className="text-xs font-mono uppercase text-paper-3 tracking-wider mb-4 border-b border-rule pb-2 flex justify-between items-center font-bold">
              <span>Interactive Strategic Threat Roadmap</span>
              <span className="text-amber font-mono">{timelineYear} Strategic Status</span>
            </h3>

            {/* Slider Widget */}
            <div className="flex gap-4 mb-8">
              {([2018, 2024, 2030] as const).map((year) => (
                <button
                  key={year}
                  onClick={() => setTimelineYear(year)}
                  className={`flex-1 py-3 px-4 rounded text-xs font-mono font-bold transition-all border ${
                    timelineYear === year
                      ? "bg-amber text-paper border-amber shadow-sm"
                      : "bg-surface-2 border-rule text-paper-3 hover:bg-surface-1 cursor-pointer"
                  }`}
                >
                  {year === 2018 && "2018 · Prior Era"}
                  {year === 2024 && "2024 · Regulation Cap"}
                  {year === 2030 && "2030 · Threat Wave"}
                </button>
              ))}
            </div>

            {/* Animated card revealing parameters */}
            <AnimatePresence mode="wait">
              <motion.div
                key={timelineYear}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {timelineYear === 2018 && (
                  <div className="space-y-4 text-left">
                    <div className="flex justify-between items-center bg-surface-2 p-4 rounded border border-rule">
                      <div>
                        <p className="text-[10px] text-paper-3 font-mono font-bold uppercase leading-none">E-Commerce Delivery Ratio</p>
                        <p className="text-base font-bold text-paper font-display mt-2 leading-none">Legacy Operations</p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-rule text-xs font-mono font-bold text-paper-2">REDELIVERY: ~15%</span>
                    </div>
                    <p className="text-sm text-paper-2 leading-relaxed font-sans">
                      Unrestrained driver labor hours was standard practice. Redeliveries and slot failures represented flat losses, previously compensated by stretching shift limits and using cheap fuel.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-surface-2 rounded border border-rule">
                        <p className="text-xs text-paper-3 font-mono leading-none">Overtime Penalty</p>
                        <p className="text-lg font-bold font-mono text-paper mt-1.5 leading-none">None (Zero cap)</p>
                      </div>
                      <div className="p-3 bg-surface-2 rounded border border-rule">
                        <p className="text-xs text-paper-3 font-mono leading-none">SME Profit Margin</p>
                        <p className="text-lg font-bold font-mono text-slate mt-1.5 leading-none">Healthy</p>
                      </div>
                    </div>
                  </div>
                )}

                {timelineYear === 2024 && (
                  <div className="space-y-4 text-left">
                    <div className="flex justify-between items-center bg-surface-2 p-4 rounded border border-rule">
                      <div>
                        <p className="text-[10px] text-paper-3 font-mono font-bold uppercase font-sans leading-none">Statutory Enforcement Cap</p>
                        <p className="text-base font-bold text-paper mt-2 leading-none">The 960h Cap Threshold</p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-amber-tint text-xs font-mono font-bold text-amber border border-amber/20">14% CAPACITY LOSS</span>
                    </div>
                    <p className="text-sm text-paper-2 leading-relaxed font-sans">
                      Small-and-medium carriers must bind shift sequences within legal limits or incur harsh administrative operating penalties. Traditional intuition-driven manual route planning breaks instantly.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-surface-2 rounded border border-rule">
                        <p className="text-xs text-paper-3 font-mono leading-none">Overtime Breach Risk</p>
                        <p className="text-lg font-bold font-mono text-amber mt-1.5 leading-none">88% of SMEs affected</p>
                      </div>
                      <div className="p-3 bg-surface-2 rounded border border-rule">
                        <p className="text-xs text-paper-3 font-mono leading-none">Redelivery Cost Peak</p>
                        <p className="text-lg font-bold font-mono text-amber mt-1.5 leading-none">Historical High</p>
                      </div>
                    </div>
                  </div>
                )}

                {timelineYear === 2030 && (
                  <div className="space-y-4 text-left">
                    <div className="flex justify-between items-center bg-amber-tint p-4 rounded border border-amber/20">
                      <div>
                        <p className="text-[10px] text-amber font-mono font-bold uppercase leading-none">Structural Cargo Collapse</p>
                        <p className="text-base font-bold text-paper font-sans mt-2 leading-none">34% Unserviced Cargo Gap</p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-amber-tint text-xs font-mono font-bold text-amber border border-amber/25">CRITICAL OUTLOOK</span>
                    </div>
                    <p className="text-sm text-paper-2 leading-relaxed font-sans">
                      Without structural digital route synchronization, 1 in 3 national packages will not find an available truck. Small operations must deploy automation to survive margins and confirm delivery slots.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-surface-2 rounded border border-rule">
                        <p className="text-xs text-paper-3 font-mono leading-none font-sans">Workforce Deficit</p>
                        <p className="text-lg font-bold font-mono text-amber mt-1.5 leading-none">~140k Drivers Missing</p>
                      </div>
                      <div className="p-3 bg-surface-2 rounded border border-rule">
                        <p className="text-xs text-paper-3 font-mono leading-none font-sans">Undeliverable Ratio</p>
                        <p className="text-lg font-bold font-mono text-amber mt-1.5 leading-none">34.2% Estimated</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </section>

      {/* --- 4. CUSTOMER STORY & BEFORE VS AFTER ("Meet Tanaka-san") --- */}
      <section id="story" className="py-20 md:py-28 border-b border-rule">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <div className="text-center space-y-2 mb-16 max-w-2xl mx-auto">
            <span className="text-[10px] text-[#B5483A] uppercase tracking-[0.25em] font-mono font-bold block">Logistics Driver Case Study</span>
            <h2 className="text-3xl md:text-3xl font-display font-medium text-[#1B2430]">Meet Tanaka-san</h2>
            <p className="text-sm text-[#2E3440]">
              The operational reality of 62,000 regional carriers across Japan. Traditional driver intuition vs. mathematical route design.
            </p>
          </div>

          {/* Split Screen Owner Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            
            {/* Left Photo Illustration side */}
            <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#E8E2D6] rounded-xl p-6 relative flex flex-col justify-between h-full">
              <div className="space-y-4">
                <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-[#E8E2D6] bg-white">
                  <img
                    src="/src/assets/images/tanaka_haruto_1781424893128.jpg"
                    alt="Tanaka Haruto"
                    className="w-full h-full object-cover grayscale opacity-95 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Persona floating badging */}
                  <div className="absolute bottom-3 left-3 bg-[#1B2430]/95 border border-[#E8E2D6] rounded px-3 py-1.5 shadow-sm text-white">
                    <p className="text-[9px] text-[#F7F4EE]/60 font-mono leading-none font-bold uppercase">Carrier Proprietor</p>
                    <p className="text-xs font-bold font-display text-white mt-1">田中 陽人 (Tanaka Haruto)</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-paper-2 font-sans">
                  <div className="flex justify-between border-b border-rule pb-1.5"><span className="text-paper-3">Carrier:</span> <span className="font-mono font-bold">田中急送 · Tanaka Express</span></div>
                  <div className="flex justify-between border-b border-rule pb-1.5"><span className="text-paper-3">Fleet Profile:</span> <span className="font-mono font-bold">5 Light Trucks (Kōtō-ku Grid)</span></div>
                  <div className="flex justify-between border-b border-rule pb-1.5"><span className="text-paper-3">Daily Cargo:</span> <span className="font-mono font-bold">180 – 220 items</span></div>
                  <div className="flex justify-between"><span className="text-paper-3">Routing Method:</span> <span className="font-mono text-amber font-bold">Paper Maps & Local Driver Intuition</span></div>
                </div>
              </div>

              <div className="mt-6 border-t border-rule pt-4 cursor-default group text-left">
                <p className="text-xs italic text-paper-2 font-sans leading-relaxed">
                  "I've managed maps and dispatched drivers for 30 years. But we were bleeding profitability on empty trips and losing over an hour per shift per truck. There were no new drivers to hire under the new 2024 regulations."
                </p>
                <p className="text-[10px] font-bold text-amber uppercase tracking-wider font-mono mt-2 transition-transform">
                  &mdash; Tanaka Haruto, Owner, Tanaka Express
                </p>
              </div>
            </div>

            {/* Right side Detail: Side-By-Side Before vs After Visual Column */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6 text-left">
              <h3 className="text-lg font-display font-medium text-paper border-b border-rule pb-3">Operational Performance Analysis</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* BEFORE: Legacy operations */}
                <div className="bg-amber-tint/30 border border-amber/20 rounded-xs p-5 space-y-4">
                  <div className="flex items-center gap-2 text-amber">
                    <span className="h-2 w-2 rounded-full bg-amber animate-pulse" />
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Traditional Routing</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-paper-3">First-attempt hit rate</p>
                      <p className="text-2xl font-bold font-mono text-paper-3/40 line-through">~83.0%</p>
                    </div>
                    <div>
                      <p className="text-xs text-paper-3">Daily redelivery ratio</p>
                      <p className="text-lg font-mono font-bold text-amber">16.7% average</p>
                    </div>
                    <div>
                      <p className="text-xs text-paper-3">Wasted Driver Shift Time</p>
                      <p className="text-xs font-mono text-amber bg-surface-2 border border-amber/20 px-2 py-1 rounded-sm">48 min wasted / day / driver</p>
                    </div>
                    <p className="text-xs text-paper-2 leading-relaxed font-sans">
                      Frequent duplicate trips, high fuel bills, threat of regulatory fines due to driver overtime limit breaches, and constant friction with homeowners.
                    </p>
                  </div>
                </div>

                {/* AFTER: TakumiRoute active */}
                <div className="bg-slate-tint/30 border border-slate/20 rounded-xs p-5 space-y-4">
                  <div className="flex items-center gap-2 text-slate-bright">
                    <span className="h-2 w-2 rounded-full bg-slate" />
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold">TakumiRoute Enabled</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-paper-3">First-attempt hit rate</p>
                      <p className="text-2xl font-bold font-mono text-slate">96.4% Success</p>
                    </div>
                    <div>
                      <p className="text-xs text-paper-3">Daily redelivery ratio</p>
                      <p className="text-lg font-mono font-bold text-slate">~2.8% average</p>
                    </div>
                    <div>
                      <p className="text-xs text-paper-3">Wasted Driver Shift Time</p>
                      <p className="text-xs font-mono text-slate bg-surface-2 border border-slate/20 px-2 py-1 rounded-sm">~6 min wasted / day / driver</p>
                    </div>
                    <p className="text-xs text-paper-2 leading-relaxed font-sans">
                      Drivers finish routes early. Overtime boundaries held securely. Predictive analytics automates homeowner slots, protecting carrier operating profit.
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- 5. CORE SOLUTION SECTION ("Three Systems. One Outcome.") --- */}
      <section id="solutions" className="py-20 md:py-28 bg-surface-1 border-y border-rule">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <div className="text-center space-y-2 mb-16 max-w-2xl mx-auto">
            <span className="text-[10px] text-amber uppercase tracking-[0.25em] font-mono font-bold block">Platform Architecture</span>
            <h2 className="text-3xl md:text-3xl font-display font-medium text-paper">Three Systems. One Outcome.</h2>
            <p className="text-sm text-paper-2 font-sans mt-2">
              The mathematical coordination of machine learning, operations research, and real-time messaging.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Box 1: ML */}
            <div className="bg-surface-2 border border-rule rounded-xs p-6 md:p-8 space-y-4 shadow-sm hover:border-amber/30 transition-all group text-left">
              <div className="h-10 w-10 rounded-sm bg-amber-tint border border-amber/20 flex items-center justify-center text-amber group-hover:bg-amber group-hover:text-paper transition-colors">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] text-amber font-mono font-bold uppercase tracking-wider">AI System 01</p>
                <h3 className="text-base font-bold text-paper mt-0.5 font-display">AI Availability Prediction</h3>
                <p className="text-[8.5px] text-paper-3 font-mono">在宅時間自動予測モデル</p>
              </div>
              <p className="text-xs text-paper-2 leading-relaxed font-sans">
                LightGBM classifiers establish localized neighborhood occupancy models. Utilizing day of the week, historical attempts, and coordinates index, the platform predicts exact individual resident presence probability.
              </p>
            </div>

            {/* Box 2: OR solver */}
            <div className="bg-surface-2 border border-rule rounded-xs p-6 md:p-8 space-y-4 shadow-sm hover:border-amber/30 transition-all group text-left">
              <div className="h-10 w-10 rounded-sm bg-amber-tint border border-amber/20 flex items-center justify-center text-amber group-hover:bg-amber group-hover:text-paper transition-colors">
                <Route className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] text-[#B5483A] font-mono font-bold uppercase tracking-wider">AI System 02</p>
                <h3 className="text-base font-bold text-[#1B2430] mt-0.5 font-display">Route Optimizer core</h3>
                <p className="text-[8.5px] text-[#2E3440] font-mono">配車ルート最適アルゴリズム</p>
              </div>
              <p className="text-xs text-[#2E3440] leading-relaxed">
                Transforms traditional models via Prize-Collecting VRPTW solver clusters. Fleet capacity, road networks, and predicted availability curves are computed dynamically, eliminating empty runs before departure.
              </p>
            </div>

            {/* Box 3: Agentic coordination */}
            <div className="bg-white border border-[#E8E2D6] rounded-xl p-6 md:p-8 space-y-4 shadow-sm hover:border-[#B5483A]/30 transition-all group">
              <div className="h-10 w-10 rounded bg-[#B5483A]/10 border border-[#B5483A]/20 flex items-center justify-center text-[#B5483A] group-hover:bg-[#B5483A] group-hover:text-white transition-colors">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] text-[#B5483A] font-mono font-bold uppercase tracking-wider">AI System 03</p>
                <h3 className="text-base font-bold text-[#1B2430] mt-0.5 font-display">Agentic Coordination</h3>
                <p className="text-[8.5px] text-[#2E3440] font-mono">リアルタイム在宅交渉エージェント</p>
              </div>
              <p className="text-xs text-[#2E3440] leading-relaxed">
                Autonomous agent handles recipient updates via lightweight messaging during delivery phases. If customers reschedule, the system immediately reroutes segments, streaming directions directly to the driver's console.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* --- 6. FEATURE WORKFLOW SECTION (Interactive Horizontal Progress Ribbon) --- */}
      <section className="py-20 md:py-28 max-w-7xl mx-auto px-6 md:px-12 border-b border-[#E8E2D6]">
        
        <div className="mb-14 text-left">
          <span className="text-[10px] text-[#B5483A] uppercase tracking-[0.25em] font-mono font-bold block">Production Pipeline</span>
          <h2 className="text-3xl md:text-3xl font-display font-medium text-[#1B2430]">How It Works</h2>
          <p className="text-sm text-[#2E3440] mt-1">
            Examine the logistics workflow phases to witness the algorithmic routing pipeline in real-time.
          </p>
        </div>

        {/* Step Tabs header select */}
        <div className="flex overflow-x-auto pb-4 border-b border-rule gap-4 scrollbar-hidden">
          {[
            { id: 1, label: "01. Consignments Ingest", sub: "CSV / ERP Import" },
            { id: 2, label: "02. AI Estimation", sub: "Available Probability" },
            { id: 3, label: "03. Route Solver", sub: "Prize VRPTW Math" },
            { id: 4, label: "04. Live Negotiation", sub: "Dynamic SMS Agent" },
            { id: 5, label: "05. Over-the-Air Feed", sub: "WebSocket Sync" },
            { id: 6, label: "06. Package Delivered", sub: "1st Attempt Success" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveWorkflowStep(item.id)}
              className={`text-left pb-4 shrink-0 px-2.5 transition-all outline-none border-b-2 -mb-[18px] relative cursor-pointer ${
                activeWorkflowStep === item.id
                  ? "border-amber text-paper"
                  : "border-transparent text-paper-3 hover:text-paper"
              }`}
            >
              <p className="text-xs font-mono font-bold leading-none">{item.label}</p>
              <p className="text-[10px] font-mono text-paper-3/80 mt-1">{item.sub}</p>
            </button>
          ))}
        </div>

        {/* Workflow Active Reveal Area */}
        <div className="standard-card mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[300px]">
          
          <div className="lg:col-span-6 space-y-4 text-left">
            <span className="h-6 w-6 rounded bg-amber-tint border border-amber/30 font-mono text-xs font-bold text-amber flex items-center justify-center">
              {activeWorkflowStep}
            </span>

            {activeWorkflowStep === 1 && (
              <div className="space-y-4">
                <h4 className="text-lg font-display font-medium text-paper">Daily Carrier Consignment Ingress</h4>
                <p className="text-sm text-paper-2 leading-relaxed font-sans">
                  The dispatcher uploads the morning's schedule direct from the central parcel ERP or as a simple sheet export. Data packages are normalized, validated, geo-indexed, and matched automatically.
                </p>
                <div className="p-3 bg-surface-2 rounded border border-rule font-mono text-[10px] text-paper">
                  <span className="text-slate font-semibold">POST</span> /api/v1/deliveries/upload <br />
                  <span className="text-paper-3">parsed_stops: 184 addresses | coordinate_matches: 100%</span>
                </div>
              </div>
            )}

            {activeWorkflowStep === 2 && (
              <div className="space-y-4">
                <h4 className="text-lg font-display font-medium text-paper">Predictive Occupancy Heatmaps</h4>
                <p className="text-sm text-paper-2 leading-relaxed font-sans">
                  Each destination address is run against historic localized patterns. LightGBM predicts present coefficients for target hours, preventing dispatch to locations with high absenteeism rates.
                </p>
                <div className="p-3 bg-surface-2 rounded border border-rule font-mono text-[10px] text-paper">
                  <span className="text-slate font-bold">Predictive coefficients registered:</span> <br />
                  Suzuki Residence, wood structure: p(14:00) = 0.15 | p(18:30) = 0.95
                </div>
              </div>
            )}

            {activeWorkflowStep === 3 && (
              <div className="space-y-4">
                <h4 className="text-lg font-display font-medium text-paper">Prize-Collecting Path Solver</h4>
                <p className="text-sm text-paper-2 leading-relaxed font-sans">
                  The probability ratios convert to prize coefficients. Google OR-Tools builds highly prioritized vehicle routing models. Drivers depart with streets sequenced to maximize hit potential.
                </p>
                <div className="p-3 bg-surface-2 rounded border border-rule font-mono text-[10px] text-paper">
                  <span className="text-slate font-bold">Solver Sequence maximization output:</span> <br />
                  Overtime risk bounds verified. Path sequences updated to prioritize Koto region S2 and S4.
                </div>
              </div>
            )}

            {activeWorkflowStep === 4 && (
              <div className="space-y-4">
                <h4 className="text-lg font-display font-medium text-paper">Live Digital Recipient Outreach</h4>
                <p className="text-sm text-paper-2 leading-relaxed font-sans">
                  During delivery runs, the agent sends SMS options to recipients. Customers verify their availability status on-the-go, transforming passive delivery sequences into active handovers.
                </p>
                <div className="p-3 bg-surface-2 rounded border border-rule font-mono text-[10px] text-paper">
                  <span className="text-slate font-semibold">Incoming SMS reply:</span> "I will return by evening; please arrive after 18:00 instead." <br />
                  <span className="text-amber font-bold">System action:</span> Recalculating slot for S1 from 14:00 time-window to 18:30.
                </div>
              </div>
            )}

            {activeWorkflowStep === 5 && (
              <div className="space-y-4">
                <h4 className="text-lg font-display font-medium text-paper">Real-time Over-the-Air Sequence Sync</h4>
                <p className="text-sm text-paper-2 leading-relaxed font-sans">
                  Upon recipient response, servers compute the localized adjustment in under 500ms, streaming directions over WebSockets directly to the driver's on-dash navigation console. No calls needed.
                </p>
                <div className="p-3 bg-surface-2 rounded border border-rule font-mono text-[10px] text-paper">
                  <span className="text-amber font-bold">[WS PUSH]</span> Fleet directive: Yamamoto-02 route updated. Stop S1 repositioned to step 5.
                </div>
              </div>
            )}

            {activeWorkflowStep === 6 && (
              <div className="space-y-4">
                <h4 className="text-lg font-display font-medium text-paper">Target Clearance, Reclaimed Overtime</h4>
                <p className="text-sm text-paper-2 leading-relaxed font-sans">
                  Drivers stop exactly when recipients are home, clearing cargo loads successfully. Drivers return to terminal grids 45 minutes earlier, fuel expenses decline, and overtime stays well below caps.
                </p>
                <div className="p-3 bg-surface-2 rounded border border-rule font-mono text-[10px] text-paper">
                  <span className="text-slate font-semibold">Sequence Finished:</span> 100% active cargo target clearing. Zero redeliveries initiated.
                </div>
              </div>
            )}

          </div>

          {/* Right side graphical representation of active step */}
          <div className="lg:col-span-6 bg-surface-2 border border-rule rounded-sm p-6 min-h-[225px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-amber" />
            
            {activeWorkflowStep === 1 && (
              <div className="text-center space-y-4 py-4 w-full">
                <Database className="h-10 w-10 text-paper mx-auto animate-bounce" />
                <p className="text-xs uppercase font-mono tracking-wider text-paper font-bold">Consignment Ingest Data Matrix</p>
                <div className="grid grid-cols-3 gap-2 px-6">
                  <div className="bg-surface-1 border border-rule p-2 rounded text-[10px] font-mono font-bold text-paper">184 stops listed</div>
                  <div className="bg-surface-1 border border-rule p-2 rounded text-[10px] font-mono font-bold text-paper">5 trucks allocated</div>
                  <div className="bg-surface-1 border border-rule p-2 rounded text-[10px] font-mono font-bold text-slate">100% geo match</div>
                </div>
              </div>
            )}

            {activeWorkflowStep === 2 && (
              <div className="text-center space-y-4 py-4 w-full">
                <Brain className="h-10 w-10 text-amber mx-auto animate-pulse" />
                <p className="text-xs uppercase font-mono tracking-wider text-paper font-bold">ML Occupancy Probability Estimation</p>
                <div className="space-y-1.5 max-w-xs mx-auto text-left">
                  <div className="flex justify-between text-[11px] font-mono"><span className="text-paper-2">Suzuki Residence, 14:00:</span> <span className="text-amber font-bold">p = 0.15 (Absent)</span></div>
                  <div className="w-full bg-rule rounded-full h-1.5"><div className="bg-amber h-1.5 rounded-full w-[15%]" /></div>
                  <div className="flex justify-between text-[11px] font-mono mt-1"><span className="text-paper-2">Suzuki Residence, 18:30:</span> <span className="text-slate font-bold">p = 0.95 (Present)</span></div>
                  <div className="w-full bg-rule rounded-full h-1.5"><div className="bg-slate h-1.5 rounded-full w-[95%]" /></div>
                </div>
              </div>
            )}

            {activeWorkflowStep === 3 && (
              <div className="text-center space-y-4 py-4 w-full">
                <Route className="h-10 w-10 text-paper mx-auto" />
                <p className="text-xs uppercase font-mono tracking-wider text-paper font-bold">Mathematical Routing Solver</p>
                <div className="h-16 flex items-center justify-center gap-6">
                  <span className="text-xs font-mono text-amber line-through font-bold">42.8 km (Manual Sequence)</span>
                  <span className="text-lg font-bold font-mono text-slate">26.4 km (Optimal Sequence)</span>
                </div>
              </div>
            )}

            {activeWorkflowStep === 4 && (
              <div className="text-left space-y-3 max-w-sm mx-auto w-full px-4">
                <div className="bg-surface-1 p-2.5 rounded border border-rule text-xs text-paper">
                  <p className="font-bold text-amber text-[9px] uppercase font-mono tracking-wider">Takumi Coordinate Engine</p>
                  "Confirm: Will you be present to accept parcel delivery at 14:00?"
                </div>
                <div className="bg-amber-tint/30 p-2.5 rounded border border-amber/20 text-xs text-paper self-end ml-12 text-right">
                  <p className="font-bold text-amber text-[9px] uppercase font-mono tracking-wider">Resident Reply (SMS)</p>
                  "No, meeting runs late. Deliver after 18:00 instead."
                </div>
              </div>
            )}

            {activeWorkflowStep === 5 && (
              <div className="text-center space-y-4 py-4 w-full">
                <Activity className="h-10 w-10 text-slate mx-auto animate-pulse" />
                <p className="text-xs uppercase font-mono tracking-wider text-paper font-bold">WebSocket Over-the-Air Payload</p>
                <div className="font-mono text-[11px] text-paper bg-surface-1 border border-rule px-4 py-3 rounded text-left max-w-xs mx-auto">
                  <span className="text-amber font-bold">WebSocket pushing update:</span> <br />
                  &gt; target_truck: "Yamamoto_02" <br />
                  &gt; new_sequence: [S2, S4, S6, S5, S1, S3]
                </div>
              </div>
            )}

            {activeWorkflowStep === 6 && (
              <div className="text-center space-y-4 py-4 w-full font-sans">
                <CheckCircle className="h-12 w-12 text-slate mx-auto" />
                <p className="text-xs uppercase font-mono tracking-wider text-paper font-bold">Logistics Sequence Finished</p>
                <p className="text-xl font-display font-medium text-paper">First-Attempt Cleared Successfully</p>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* --- 7. INTERACTIVE SIMULATION SHOWCASE (Recharts light-mode setup) --- */}
      <section id="simulate" className="py-20 md:py-28 bg-surface-1 border-b border-rule font-sans">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <div className="text-center space-y-2 mb-16 max-w-2xl mx-auto">
            <span className="text-[10px] text-amber uppercase tracking-[0.25em] font-mono font-bold block">Interactive Dispatch Simulator</span>
            <h2 className="text-3xl md:text-3xl font-display font-medium text-paper">Compare Operational Output</h2>
            <p className="text-sm text-paper-2 font-sans mt-2">
              Toggle system coordinates and size parameters to insulate fleet planning outputs on the Tokyo transport grid.
            </p>
          </div>

          {/* Configuration toolbar bar */}
          <div className="bg-surface-2 border border-rule p-4 rounded-xs mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-paper-2 uppercase font-mono font-bold">Select Fleet Scale:</span>
              <div className="flex gap-2">
                {([5, 25, 100] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedFleetSize(size)}
                    className={`px-3 py-1 rounded-sm text-xs font-mono font-bold transition-all border cursor-pointer ${
                      selectedFleetSize === size
                        ? "bg-amber text-paper border-amber shadow-sm"
                        : "bg-surface-1 border-rule text-paper-2 hover:bg-surface-2 hover:text-paper"
                    }`}
                  >
                    {size} Utility Vehicles
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 text-xs font-mono text-paper-3 border-t md:border-t-0 pt-3 md:pt-0 border-rule w-full md:w-auto justify-center font-bold">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber inline-block" /> Baseline Carrier (Redelivery)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate inline-block" /> TakumiRoute Carrier</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Column: Recharts Chart */}
            <div className="lg:col-span-8 standard-card flex flex-col justify-between min-h-[380px]">
              <div className="text-left">
                <h4 className="text-sm font-bold text-paper mb-1 font-display">Simulated Redelivery Rate Performance Curve</h4>
                <p className="text-xs text-paper-2 mb-6 font-mono leading-relaxed">Efficiency margins maximize heavily during evening coordination windows (18:00 - 21:00).</p>
              </div>

              {/* Chart Stage */}
              <div className="h-65 w-full font-mono text-left">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C4850A" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#C4850A" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOptimized" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3D6B8A" stopOpacity={0.28}/>
                        <stop offset="95%" stopColor="#3D6B8A" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" opacity={0.4} />
                    <XAxis dataKey="hour" stroke="var(--paper-3)" fontSize={10} fontFamily="monospace" fontWeight="bold" />
                    <YAxis stroke="var(--paper-3)" fontSize={10} fontFamily="monospace" fontWeight="bold" />
                    <RechartsTooltip contentStyle={{ backgroundColor: "var(--surface-2)", borderColor: "var(--rule)", borderRadius: "2px", fontSize: "11px", fontFamily: "monospace", color: "var(--paper)" }} labelClassName="text-paper font-bold" />
                    <Area type="monotone" dataKey="baseline" stroke="#C4850A" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBaseline)" name="Traditional Dispatch" />
                    <Area type="monotone" dataKey="optimized" stroke="#3D6B8A" strokeWidth={2} fillOpacity={1} fill="url(#colorOptimized)" name="TakumiRoute Optimized" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="border-t border-rule pt-3 mt-4 text-[10px] font-mono text-paper-3 font-bold text-left">
                <span>* Simulated statistics based on {selectedFleetSize} utility delivery routes structured across municipal Tokyo coordinates.</span>
              </div>
            </div>

            {/* Right Column: Comparative Dashboard Stats and Metrics cards */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-4 text-left">
              
              <div className="bg-surface-2 border border-rule p-5 rounded-xs flex-1 space-y-3 flex flex-col justify-center">
                <p className="text-[10px] font-mono uppercase tracking-widest text-amber font-bold leading-none">Traditional Methods</p>
                <h4 className="text-base font-display font-medium text-paper leading-none mt-2">Baseline Performance</h4>
                <div className="space-y-4 pt-3">
                  <div className="flex justify-between items-end border-b border-rule pb-2 text-xs">
                    <span className="text-paper-3 font-sans">Missed Handovers:</span>
                    <span className="font-mono font-bold text-amber">
                      {selectedFleetSize * 18} parcels/wk
                    </span>
                  </div>
                  <div className="flex justify-between items-end border-b border-rule pb-2 text-xs">
                    <span className="text-paper-3 font-sans font-sans">Wasted distance:</span>
                    <span className="font-mono font-bold text-amber">
                      {selectedFleetSize * 124} km/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-xs">
                    <span className="text-paper-3 font-sans">Extra Fuel Expense:</span>
                    <span className="font-mono font-bold text-amber">
                      ¥{(selectedFleetSize * 38200).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-2 border border-slate/30 p-5 rounded-xs flex-1 space-y-3 flex flex-col justify-center">
                <div className="flex justify-between items-center leading-none">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-bright font-bold">TakumiRoute parameters</p>
                  <span className="px-1.5 py-0.5 rounded-xs bg-slate-tint text-[9px] text-slate-bright font-bold font-mono border border-slate/20">ACTIVE</span>
                </div>
                <h4 className="text-base font-display font-medium text-paper leading-none mt-2">Target Performance Scale</h4>
                <div className="space-y-4 pt-3">
                  <div className="flex justify-between items-end border-b border-rule pb-2 text-xs">
                    <span className="text-paper-3 font-sans">Missed Handovers:</span>
                    <span className="font-mono font-bold text-slate-bright">
                      {Math.floor(selectedFleetSize * 2.8)} parcels/wk
                    </span>
                  </div>
                  <div className="flex justify-between items-end border-b border-rule pb-2 text-xs">
                    <span className="text-paper-3 font-sans">Wasted distance:</span>
                    <span className="font-mono font-bold text-slate-bright">
                      {selectedFleetSize * 8} km/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-xs">
                    <span className="text-paper-3 font-sans">Reclaimed Margin:</span>
                    <span className="font-mono font-bold text-slate-bright">
                      +¥{(selectedFleetSize * 342000).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* --- 8. ARCHITECTURE SECTION (Data Flow Diagram Operator -> ML -> Solver)  --- */}
      <section id="architecture" className="py-20 md:py-28 max-w-7xl mx-auto px-6 md:px-12 border-b border-rule">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-4 space-y-6 text-left">
            <span className="text-[10px] text-amber uppercase tracking-[0.25em] font-mono font-bold block">System Infrastructure</span>
            <h2 className="text-3xl md:text-3xl font-display font-medium text-paper">Full-Stack Blueprint</h2>
            <p className="text-sm text-paper-2 leading-relaxed font-sans">
              Designed for regional logistics compliance. Ultra-low latency pipelines transform LightGBM availability estimations into Google OR-Tools solution datasets.
            </p>
            <div className="space-y-3 text-xs text-paper-2 font-sans">
              <div className="flex gap-2 items-center">
                <CheckCircle className="h-4 w-4 text-slate-bright" />
                <span>Deterministic ML predictions to prize equations</span>
              </div>
              <div className="flex gap-2 items-center">
                <CheckCircle className="h-4 w-4 text-slate-bright" />
                <span>Encrypted delivery ledger isolation standard</span>
              </div>
              <div className="flex gap-2 items-center">
                <CheckCircle className="h-4 w-4 text-slate-bright" />
                <span>Fast websocket dispatch status broadcast feeds</span>
              </div>
            </div>
          </div>

          {/* Right Diagram Block with raw layout instead of neon glow */}
          <div className="lg:col-span-8 bg-surface-1 border border-rule rounded-sm p-6 md:p-8 overflow-hidden relative">
            
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 relative">
              
              {/* Box 1 Operator */}
              <div className="bg-surface-2 border border-rule p-3 rounded-sm text-center relative z-10">
                <Users className="h-5 w-5 text-paper mx-auto mb-1.5" />
                <p className="text-[11px] font-bold font-display text-paper">Core Console</p>
                <p className="text-[9px] text-paper-3 font-mono mt-0.5">Fleet Operator</p>
              </div>

              {/* Box 2 ML Engine */}
              <div className="bg-surface-2 border border-rule p-3 rounded-sm text-center relative z-10">
                <Brain className="h-5 w-5 text-amber mx-auto mb-1.5" />
                <p className="text-[11px] font-bold font-display text-paper">LightGBM Engine</p>
                <p className="text-[9px] text-paper-3 font-mono mt-0.5">Presence Curve</p>
              </div>

              {/* Box 3 OPT Solver */}
              <div className="bg-surface-2 border border-rule p-3 rounded-sm text-center relative z-10">
                <Route className="h-5 w-5 text-slate-bright mx-auto mb-1.5" />
                <p className="text-[11px] font-bold font-display text-paper">Path Solver</p>
                <p className="text-[9px] text-paper-3 font-mono mt-0.5">OR-Tools Core</p>
              </div>

              {/* Box 4 Agent negotiation */}
              <div className="bg-surface-2 border border-rule p-3 rounded-sm text-center relative z-10">
                <Bot className="h-5 w-5 text-slate mx-auto mb-1.5" />
                <p className="text-[11px] font-bold font-display text-paper">Agent Hub</p>
                <p className="text-[9px] text-paper-3 font-mono mt-0.5">Interactive SMS</p>
              </div>

              {/* Box 5 Driver App */}
              <div className="bg-surface-2 border border-rule p-3 rounded-sm text-center relative z-10">
                <Terminal className="h-5 w-5 text-slate-bright mx-auto mb-1.5" />
                <p className="text-[11px] font-bold font-display text-paper">Driver Display</p>
                <p className="text-[9px] text-paper-3 font-mono mt-0.5">WebSocket Feed</p>
              </div>

              {/* Box 6 Recipient */}
              <div className="bg-surface-2 border border-rule p-3 rounded-sm text-center relative z-10">
                <Phone className="h-5 w-5 text-paper-3 mx-auto mb-1.5" />
                <p className="text-[11px] font-bold font-display text-paper">Homeowner</p>
                <p className="text-[9px] text-paper-3 font-mono mt-0.5">SMS Response</p>
              </div>

            </div>

            {/* Connecting line */}
            <div className="mt-8 bg-surface-2 p-4 rounded-sm border border-rule text-xs text-paper-2 leading-relaxed font-mono text-left">
              <span className="text-amber font-bold">&gt;_ Event stream telemetry:</span> <br />
              Ingress load &rarr; Predictor matrix computed &rarr; Optimization sequence generated &rarr; Active agent SMS issued &rarr; Recalculated websocket instructions delivered back to dynamic driver map.
            </div>

          </div>

        </div>
      </section>

      {/* --- 9. TECHNOLOGY STACK MATRIX SECTION --- */}
      <section className="py-20 bg-surface-1 border-b border-rule">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <div className="text-center space-y-2 mb-16 max-w-2xl mx-auto">
            <span className="text-[10px] text-amber uppercase tracking-[0.25em] font-mono font-bold block">Production Tech-Stack</span>
            <h2 className="text-3xl md:text-3xl font-display font-medium text-paper">Operational Integration Specs</h2>
            <p className="text-sm text-paper-2 font-sans mt-2">
              Engineered using enterprise-grade libraries to ensure mission-critical stability and high-throughput security.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            
            {/* Box 1 Frontend */}
            <div className="bg-surface-2 border border-rule rounded-sm p-5 space-y-2 text-center hover:border-amber/30 transition-colors">
              <Sparkles className="h-6 w-6 text-paper mx-auto" />
              <h4 className="text-[11px] font-bold font-mono uppercase tracking-wider text-paper">Frontend Grid</h4>
              <p className="text-[11.5px] text-paper-3 leading-normal font-sans">React 18+, TypeScript, Tailwind CSS, motion, Recharts</p>
            </div>

            {/* Box 2 Backend */}
            <div className="bg-surface-2 border border-rule rounded-sm p-5 space-y-2 text-center hover:border-amber/30 transition-colors">
              <Server className="h-6 w-6 text-slate mx-auto" />
              <h4 className="text-[11px] font-bold font-mono uppercase tracking-wider text-paper">Backend Core</h4>
              <p className="text-[11.5px] text-paper-3 leading-normal font-sans">Node.js API layers, PostgreSQL, secure session isolations</p>
            </div>

            {/* Box 3 Optimization */}
            <div className="bg-surface-2 border border-rule rounded-sm p-5 space-y-2 text-center hover:border-amber/30 transition-colors">
              <Route className="h-6 w-6 text-amber mx-auto" />
              <h4 className="text-[11px] font-bold font-mono uppercase tracking-wider text-paper">OR Optimization</h4>
              <p className="text-[11.5px] text-paper-3 leading-normal font-sans">Google OR-Tools VRP clusters, optimized prize heuristic solvers</p>
            </div>

            {/* Box 4 ML */}
            <div className="bg-surface-2 border border-rule rounded-sm p-5 space-y-2 text-center hover:border-amber/30 transition-colors">
              <Brain className="h-6 w-6 text-slate-bright mx-auto" />
              <h4 className="text-[11px] font-bold font-mono uppercase tracking-wider text-paper">Machine learning</h4>
              <p className="text-[11.5px] text-paper-3 leading-normal font-sans">LightGBM occupancy scoring models, localized coordinate maps</p>
            </div>

            {/* Box 5 Maps */}
            <div className="bg-surface-2 border border-rule rounded-sm p-5 space-y-2 text-center hover:border-amber/30 transition-colors col-span-2 md:col-span-1">
              <Map className="h-6 w-6 text-amber mx-auto" />
              <h4 className="text-[11px] font-bold font-mono uppercase tracking-wider text-paper">Map Engines</h4>
              <p className="text-[11.5px] text-paper-3 leading-normal font-sans">MapLibre GL layers, Deck.gl custom geometries, OSRM routing</p>
            </div>

          </div>
        </div>
      </section>

      {/* --- 10. SECURITY SECTION ("Enterprise Security by Design") --- */}
      <section className="py-20 md:py-28 bg-surface-1 border-b border-rule">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left security content copy */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 text-paper bg-surface-2 border border-rule px-3 py-1 rounded-sm text-xs font-mono font-bold tracking-wider uppercase">
                <Shield className="h-4 w-4 text-amber" />
                <span>Deterministic Compliance</span>
              </div>
              <h2 className="text-3xl md:text-3xl font-display font-medium text-paper">Enterprise Security Measures</h2>
              <p className="text-sm text-paper-2 leading-relaxed font-sans">
                TakumiRoute maintains rigorous multi-tenant data isolation standards to protect carrier routing ledgers. Our deterministic intent parsers screen incoming recipient messages, immediately guarding system prompts against injection risks.
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-xs text-paper-2 font-bold font-mono">
                <div className="flex gap-2 items-start bg-surface-2 p-3 rounded-sm border border-rule">
                  <CheckCircle className="h-4 w-4 text-slate shrink-0 mt-0.5" />
                  <span>Intent Parsing Verification</span>
                </div>
                <div className="flex gap-2 items-start bg-surface-2 p-3 rounded-sm border border-rule">
                  <CheckCircle className="h-4 w-4 text-slate shrink-0 mt-0.5" />
                  <span>Tenant Data Ledger Guards</span>
                </div>
              </div>
            </div>

            {/* Right Security Badging Matrix Layout */}
            <div className="lg:col-span-6 bg-surface-1 border border-rule rounded-sm p-6 md:p-8 grid grid-cols-2 gap-4">
              
              <div className="bg-surface-2 p-4 rounded-sm border border-rule flex flex-col justify-between text-left">
                <Lock className="h-5 w-5 text-amber" />
                <div className="mt-3">
                  <p className="text-xs font-bold text-paper font-sans">JWT Token Systems</p>
                  <p className="text-[10px] text-paper-3 font-mono mt-0.5 font-bold">Secure access tokens</p>
                </div>
              </div>

              <div className="bg-surface-2 p-4 rounded-sm border border-rule flex flex-col justify-between text-left">
                <Shield className="h-5 w-5 text-amber" />
                <div className="mt-3">
                  <p className="text-xs font-bold text-paper font-sans">Argon2 Safeguards</p>
                  <p className="text-[10px] text-paper-3 font-mono mt-0.5 font-bold">Encrypted passcodes</p>
                </div>
              </div>

              <div className="bg-surface-2 p-4 rounded-sm border border-rule flex flex-col justify-between text-left">
                <Activity className="h-5 w-5 text-amber" />
                <div className="mt-3">
                  <p className="text-xs font-bold text-paper font-sans">Rate Limiting Guards</p>
                  <p className="text-[10px] text-paper-3 font-mono mt-0.5 font-bold">API brute prevention</p>
                </div>
              </div>

              <div className="bg-surface-2 p-4 rounded-sm border border-rule flex flex-col justify-between text-left">
                <Bot className="h-5 w-5 text-amber" />
                <div className="mt-3">
                  <p className="text-xs font-bold text-paper font-sans">Injection Filtering</p>
                  <p className="text-[10px] text-paper-3 font-mono mt-0.5 font-bold">Deterministic SMS filter</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* --- 11. FEATURE QUOTE TESTIMONIALS SECTION --- */}
      <section className="py-24 bg-surface-1 border-b border-rule">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <div className="inline-flex h-8 w-8 rounded-full bg-amber-tint border border-amber/20 items-center justify-center text-amber">
             <span className="font-display font-bold text-lg">“</span>
          </div>
          
          <h3 className="text-xl md:text-2xl font-display font-medium leading-relaxed italic text-paper max-w-2xl mx-auto">
            &ldquo;I thought I knew my local delivery routes better than any scheduling computer could. Then TakumiRoute launched, and it immediately mapped success curves and presence dynamics I had never noticed in 30 years.&rdquo;
          </h3>

          <div className="space-y-1">
            <p className="text-sm font-bold text-paper font-display">田中 陽人 (Tanaka Haruto)</p>
            <p className="text-xs text-amber font-mono uppercase tracking-wider font-bold">Owner, Tanaka Express &middot; 東京都江東区</p>
          </div>
        </div>
      </section>

      {/* --- 12. PRICING SECTION ("Built for SMEs") --- */}
      <section id="pricing" className="py-20 md:py-28 max-w-7xl mx-auto px-6 md:px-12 border-b border-rule">
        
        <div className="text-center space-y-2 mb-16 max-w-2xl mx-auto">
          <span className="text-[10px] text-amber uppercase tracking-[0.25em] font-mono font-bold block">Predictable Pricing Standard</span>
          <h2 className="text-3xl md:text-3xl font-display font-medium text-paper">Built for Enterprise & SMEs</h2>
          <p className="text-sm text-paper-2 font-sans mt-2">
            No massive setup fees or expensive hardware arrays. Simple monthly plans scaled to your fleet capacity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Card 1: Starter */}
          <div className="bg-surface-2 border border-rule rounded-sm p-6 md:p-8 flex flex-col justify-between shadow-sm text-left">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-paper-3 font-mono font-bold uppercase">Starter Tier</p>
                <h3 className="text-xl font-bold font-display text-paper mt-0.5">SME Express</h3>
                <p className="text-xs text-paper-2 mt-1">For regional operations with under 10 utility vehicles</p>
              </div>

              <div className="py-4 border-y border-rule">
                <span className="text-3xl font-bold font-mono text-paper">¥12,000</span>
                <span className="text-xs text-paper-3 font-mono ml-1">/ month raw</span>
              </div>

              <ul className="space-y-2 text-xs text-paper-2 font-sans">
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Up to 10 vehicles integration</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Calibrated LightGBM models</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Standard OR-Tools solving core</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>SMS notification communication</span></li>
              </ul>
            </div>

            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full mt-8 bg-surface-1 border border-rule hover:bg-surface-2 text-paper font-bold text-xs uppercase tracking-wider py-3.5 rounded-sm transition-all cursor-pointer"
            >
              Request Starter Tier
            </button>
          </div>

          {/* Card 2: Growth (Popular) */}
          <div className="bg-surface-2 border-2 border-amber rounded-sm p-6 md:p-8 flex flex-col justify-between shadow-md relative text-left">
            <div className="absolute top-0 right-4 transform -translate-y-1/2 bg-amber text-paper font-mono text-[9px] font-bold px-2.5 py-1 rounded-xs uppercase tracking-wider">
              Most Selected Plan
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-amber-bright font-mono font-bold uppercase">Growth Tier</p>
                <h3 className="text-xl font-bold font-display text-paper mt-0.5">Regional Carrier</h3>
                <p className="text-xs text-paper-2 mt-1">For medium regional carriers up to 35 vehicles</p>
              </div>

              <div className="py-4 border-y border-rule">
                <span className="text-3xl font-bold font-mono text-amber-bright">¥29,000</span>
                <span className="text-xs text-paper-3 font-mono ml-1">/ month raw</span>
              </div>

              <ul className="space-y-2 text-xs text-paper-2 font-sans">
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Up to 35 synchronized vehicles</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Custom-calibrated occupancy models</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Prize-Collecting path sequence optimization</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Real-time SMS agent negotiations</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>WebSocket driver navigation streams</span></li>
              </ul>
            </div>

            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full mt-8 bg-amber hover:bg-amber-bright text-paper font-bold text-xs uppercase tracking-wider py-3.5 rounded-sm transition-all shadow-sm cursor-pointer"
            >
              Request Growth Option
            </button>
          </div>

          {/* Card 3: Enterprise */}
          <div className="bg-surface-2 border border-rule rounded-sm p-6 md:p-8 flex flex-col justify-between shadow-sm text-left">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-paper-3 font-mono font-bold uppercase">Enterprise Tier</p>
                <h3 className="text-xl font-bold font-display text-paper mt-0.5">Enterprise Logistics</h3>
                <p className="text-xs text-paper-2 mt-1">For large regional networks & freight depots</p>
              </div>

              <div className="py-4 border-y border-rule">
                <span className="text-3xl font-bold font-mono text-paper">Custom</span>
                <span className="text-xs text-paper-3 font-mono ml-1">Volume scale</span>
              </div>

              <ul className="space-y-2 text-xs text-paper-2 font-sans">
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Uncapped fleet size & regional depots</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>High throughput OR solver clusters</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Dedicated prediction models calibration</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>Custom API integration with legacy ERP systems</span></li>
                <li className="flex gap-2 items-center"><CheckCircle className="h-4 w-4 text-slate-bright shrink-0" /> <span>SLA support & regional account operations</span></li>
              </ul>
            </div>

            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full mt-8 bg-surface-1 border border-rule hover:bg-surface-2 text-paper font-bold text-xs uppercase tracking-wider py-3.5 rounded-sm transition-all cursor-pointer"
            >
              Contact Sales
            </button>
          </div>

        </div>
      </section>

      {/* --- 13. FINAL CTA SECTION (Deep Charcoal/Ink Navy background for ultimate technical aesthetic contrast) --- */}
      <section className="py-24 bg-surface-2 text-paper max-w-7xl mx-auto px-6 md:px-12 relative overflow-hidden text-center border-b border-rule rounded-t-sm">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--rule)_1px,transparent_1px),linear-gradient(to_bottom,var(--rule)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.25] pointer-events-none" />
        
        <div className="max-w-2xl mx-auto space-y-6 relative z-10">
          <h2 className="text-3xl md:text-4xl font-display font-medium text-paper leading-tight">
            Stop Wasting Deliveries <br />You Already Paid For.
          </h2>
          <p className="text-sm md:text-base text-paper-2 max-w-xl mx-auto font-sans leading-relaxed">
            Streamline operational resources, reduce redeliveries, and insulate company profits today. Install the TakumiRoute algorithm.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="bg-amber hover:bg-amber-bright text-paper font-bold text-xs uppercase tracking-wider rounded-sm px-8 py-3.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Book Strategic Calibration Demo
            </button>
            <a
              href="#architecture"
              className="bg-surface-1 border border-rule text-paper hover:bg-surface-2 hover:border-paper-3 font-bold text-xs uppercase tracking-wider rounded-sm px-8 py-3.5 transition-all block text-center"
            >
              Explore Tech Specs
            </a>
          </div>
        </div>
      </section>

      {/* --- 14. FOOTER WITH JAPANESE BRANDING --- */}
      <footer className="bg-ink py-12 md:py-16 text-xs text-paper-3 border-t border-rule font-sans">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-5 gap-8 border-b border-rule pb-10">
          
          <div className="col-span-2 space-y-4 text-left">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-sm bg-amber flex items-center justify-center">
                <span className="text-paper font-display font-bold text-sm">匠</span>
              </div>
              <span className="font-display font-bold text-sm text-paper">TakumiRoute 匠ルート</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-paper-3 max-w-xs font-sans">
              Algorithmic first-attempt delivery optimization helping Japan's regional logistics carriers reduce administrative waste, reclaim driver shift targets, and survive regulatory compliance limits.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <p className="font-mono text-[9.5px] text-paper uppercase tracking-wider font-bold">Solutions</p>
            <ul className="space-y-2 text-paper-2">
              <li><a href="#solutions" className="hover:text-amber transition-all">ML Predictor Classifiers</a></li>
              <li><a href="#solutions" className="hover:text-amber transition-all">OR Path Solvers</a></li>
              <li><a href="#solutions" className="hover:text-amber transition-all">Agent Dialog SMS Hub</a></li>
              <li><a href="#simulate" className="hover:text-amber transition-all">Performance Simulator</a></li>
            </ul>
          </div>

          <div className="space-y-3 text-left">
            <p className="font-mono text-[9.5px] text-paper uppercase tracking-wider font-bold">Security & Trust</p>
            <ul className="space-y-2 text-paper-2">
              <li><a href="#architecture" className="hover:text-amber transition-all">Structural Blueprints</a></li>
              <li><a href="#solutions" className="hover:text-amber transition-all">Deterministic Parsing</a></li>
              <li><a href="#problem" className="hover:text-amber transition-all">Regulation Status</a></li>
              <li><a href="#story" className="hover:text-amber transition-all">Carrier Safety Levels</a></li>
            </ul>
          </div>

          <div className="space-y-3 text-left">
            <p className="font-mono text-[9.5px] text-paper uppercase tracking-wider font-bold">Inquiries</p>
            <ul className="space-y-2 text-paper-2 font-sans font-medium">
              <li><button onClick={() => setIsDemoModalOpen(true)} className="hover:text-amber text-left transition-all bg-transparent border-0 p-0 cursor-pointer text-xs">Request system demo</button></li>
              <li><button onClick={() => setCurrentPage("dashboard")} className="hover:text-amber text-left transition-all bg-transparent border-0 p-0 cursor-pointer text-xs">Access direct console</button></li>
              <li><span className="text-amber font-bold">Tokyo Operations Base</span></li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-paper-4 font-bold">
          <p>© 2026 TakumiRoute (匠ルート). Engineered for Japanese Carrier Networks. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#terms" className="hover:text-paper-2">Terms of Service</a>
            <a href="#privacy" className="hover:text-paper-2">Privacy Policy</a>
          </div>
        </div>
      </footer>

      {/* --- 15. BOOK DEMO MODAL POPUP (Industrial Light Frame) --- */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 font-sans">
            {/* Backdrop Layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDemoModalOpen(false)}
              className="absolute inset-0 bg-[#000000]/80 backdrop-blur-xs"
            />

            {/* Modal Body Card Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface-1 border border-rule rounded-sm w-full max-w-md p-6 md:p-8 relative z-10 shadow-lg overflow-hidden"
            >
              
              {/* Close Button top-right */}
              <button
                onClick={() => setIsDemoModalOpen(false)}
                className="absolute top-4 right-4 text-paper-3 hover:text-amber p-1.5 hover:bg-surface-2 rounded-sm transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-2 mb-6 text-left">
                <span className="text-[10px] text-amber uppercase tracking-widest font-mono font-bold block">Consignment Reform Setup</span>
                <h3 className="text-xl font-display font-medium text-paper">Request Calibration Demo</h3>
                <p className="text-xs text-paper-2 leading-normal font-sans">
                  Connect with logistics deployment experts and plan parameter sweeps for your operational density.
                </p>
              </div>

              {demoFormSubmitted ? (
                // Success confirmation state inside modal
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 text-center space-y-4"
                >
                  <div className="h-14 w-14 rounded-sm bg-slate-tint border border-slate/30 flex items-center justify-center text-slate-bright mx-auto animate-pulse">
                    <FileCheck2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-display font-bold text-paper">Demo Ticket Initialized!</h4>
                    <p className="text-xs text-amber-bright mt-2 font-mono font-bold">TICKET NO: #TK-{Math.floor(Math.random() * 9000) + 1000}</p>
                    <p className="text-xs text-paper-2 leading-normal mt-4 max-w-xs mx-auto font-sans">
                      Our carrier deployment team will reach out to analyze your vehicle constraints within 3 operations hours.
                    </p>
                  </div>
                </motion.div>
              ) : (
                // Modal Form Inputs
                <form onSubmit={handleDemoSubmit} className="space-y-4 text-left">
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-paper-2 uppercase tracking-wider font-bold">Full Name / お名前 *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Tanaka Haruto"
                      className="w-full bg-surface-2 border border-rule focus:border-amber rounded-sm px-3.5 py-2.5 text-xs text-paper outline-none placeholder:text-paper-4 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-paper-2 uppercase tracking-wider font-bold">Company Name / 会社名 *</label>
                    <input
                      type="text"
                      required
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      placeholder="e.g. Tanaka Express"
                      className="w-full bg-surface-2 border border-rule focus:border-amber rounded-sm px-3.5 py-2.5 text-xs text-paper outline-none placeholder:text-paper-4 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-paper-2 uppercase tracking-wider font-bold">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="e.g. owner@tanaka.jp"
                        className="w-full bg-surface-2 border border-rule focus:border-amber rounded-sm px-3.5 py-2.5 text-xs text-paper outline-none placeholder:text-paper-4 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-paper-2 uppercase tracking-wider font-bold">Phone Connection *</label>
                      <input
                        type="tel"
                        required
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="e.g. 03-1234-5678"
                        className="w-full bg-surface-2 border border-rule focus:border-amber rounded-sm px-3.5 py-2.5 text-xs text-paper outline-none placeholder:text-paper-4 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-paper-2 uppercase tracking-wider font-bold">Active Fleet Size / 車良数</label>
                    <select
                      value={formFleetSize}
                      onChange={(e) => setFormFleetSize(e.target.value)}
                      className="w-full bg-surface-2 border border-rule focus:border-amber rounded-sm px-3.5 py-2.5 text-xs text-paper outline-none transition-colors cursor-pointer"
                    >
                      <option value="1-4">Under 5 Vehicles (1-4台)</option>
                      <option value="5-10">5 - 10 Vehicles (SME standard)</option>
                      <option value="11-30">11 - 30 Vehicles (Regional carrier)</option>
                      <option value="31+">Over 31 Vehicles (Enterprise scale)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber hover:bg-amber-bright text-paper font-bold text-xs uppercase tracking-wider py-3.5 rounded-sm transition-all mt-4 cursor-pointer shadow-sm"
                  >
                    Submit Booking Request &rarr;
                  </button>

                  <p className="text-[9.5px] text-paper-3 text-center mt-2 font-sans font-semibold">
                    * Information submitted is isolated under rigorous SME data compliance parameters.
                  </p>

                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
