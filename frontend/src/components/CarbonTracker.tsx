/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { useDeliveryStore } from "../store";
import { Leaf, Navigation, Flame, Sparkles } from "lucide-react";
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

export default function CarbonTracker() {
  const { deliveries, vehicles } = useDeliveryStore();

  // 1. Calculate live baseline savings
  // Standard redelivery rate is 18.5%. By getting customers confirmed at home slots, 
  // we cut out redelivery mileage. Each prevented redelivery saves approx 3.2km of travel,
  // which averages 0.51 kg CO2 saved per light-duty delivery van.
  const confirmedCount = deliveries.filter((d) => d.status === "confirmed").length;
  
  const baseCo2Saved = confirmedCount * 0.51; // base kg saved today
  
  // 2. Real-time incremental ticking simulation
  // To simulate live fleet dispatch optimizations, we run a real-time incrementer.
  // The 8 active trucks are driving, and our routing engine constantly prunes paths.
  // This yields ~2.4 grams of additional CO2 savings per second across the active fleet.
  const [liveIncrement, setLiveIncrement] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveIncrement((prev) => prev + 0.0012); // add 1.2 grams of CO2 saved
    }, 500);

    return () => clearInterval(timer);
  }, []);

  const totalCo2Saved = baseCo2Saved + liveIncrement;

  // 3. Translate kg of CO2 into environmental equivalencies
  // - Diesel fuel saved: 1 kg CO2 saved corresponds to ~0.38 liters of diesel fuel.
  const dieselSaved = totalCo2Saved * 0.38;
  
  // - Avoided transit mileage: 1 prevented redelivery saves ~3.2 km of driving
  const transitDistanceSaved = confirmedCount * 3.2;

  // - Mature pine tree daily absorption: A healthy mature tree absorbs ~21.8 kg/year,
  //   which equals 0.0597 kg / day.
  const treeAbsorptionDays = totalCo2Saved / 0.0597;

  // 4. Calculate live CO2 savings by Vehicle route for the interactive graph
  const chartData = vehicles.map((v) => {
    const routeDeliveries = deliveries.filter((d) => d.vehicleId === v.id);
    const confirmedRouteCount = routeDeliveries.filter((d) => d.status === "confirmed").length;
    // Each confirmed delivery on a route prevents a redelivery loop
    const routeCo2Saved = parseFloat((confirmedRouteCount * 0.51).toFixed(2));
    
    return {
      name: v.driverName.split(" ")[0], // e.g., "K. Saito"
      co2: routeCo2Saved,
      color: v.color,
      id: v.id
    };
  }).sort((a, b) => b.co2 - a.co2);

  return (
    <div 
      id="live-carbon-tracker-panel" 
      className="bg-paper text-ink rounded-lg p-5 shadow-md flex flex-col justify-between space-y-5 select-none"
    >
      {/* Header section with green eco branding */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <h3 className="font-display font-medium text-sm text-ink tracking-tight flex items-center gap-2">
            <Leaf className="w-4 h-4 text-signal animate-pulse" /> Live Green Logistics & Carbon Reduction Tracker
          </h3>
          <span className="text-[10px] text-muted leading-tight mt-0.5">
            リアルタイム脱炭素グリーン配送・CO₂排出量削減トラッカー
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-signal px-2 py-0.5 bg-[#00C896]/10 rounded border border-[#00C896]/20">
          <Sparkles className="w-3 h-3 text-signal" />
          <span>Active Telemetry Offset</span>
        </div>
      </div>

      {/* Hero Odometer Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        
        {/* Real-time Ticker Value */}
        <div className="md:col-span-1 bg-[#0D1117]/5 border border-dashed border-neutral-300 rounded-lg p-4 flex flex-col justify-center text-center relative overflow-hidden">
          <div className="absolute top-1.5 left-2 mt-0.5">
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-muted">
              Live Accumulated Savings
            </span>
          </div>
          <div className="space-y-1 mt-2">
            {/* Odometer Counter */}
            <span className="font-display font-extrabold text-3xl tracking-tight text-signal font-mono">
              {totalCo2Saved.toFixed(3)}
            </span>
            <span className="text-xs font-bold text-ink pl-1">kg CO₂</span>
          </div>
          <span className="text-[9px] text-muted block mt-1">
            本日のCO2総削減目安重量（リアルタイム加算中）
          </span>
        </div>

        {/* 3 Secondary Equivalency metrics */}
        <div className="md:col-span-2 grid grid-cols-3 gap-2">
          
          {/* Prevented Liters of Diesel */}
          <div className="bg-[#0D1117]/5 p-3 rounded-lg flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[9px] text-muted leading-none">Diesel Conserved</span>
              <Flame className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="mt-3">
              <span className="font-display font-bold text-lg text-ink font-mono">
                {dieselSaved.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted font-bold pl-0.5">L</span>
            </div>
            <span className="text-[8px] text-muted block mt-1 leading-none">軽油消費抑制量</span>
          </div>

          {/* Drive distance avoided */}
          <div className="bg-[#0D1117]/5 p-3 rounded-lg flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[9px] text-muted leading-none font-medium">Avoided Drive</span>
              <Navigation className="w-3.5 h-3.5 text-data" />
            </div>
            <div className="mt-3">
              <span className="font-display font-bold text-lg text-ink font-mono">
                {transitDistanceSaved.toFixed(1)}
              </span>
              <span className="text-[10px] text-muted font-bold pl-0.5">km</span>
            </div>
            <span className="text-[8px] text-muted block mt-1 leading-none">不要走行距離の削減</span>
          </div>

          {/* Tree-absorption days equivalent */}
          <div className="bg-[#0D1117]/5 p-3 rounded-lg flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[9px] text-muted leading-none">Tree Offset Equivalent</span>
              <Leaf className="w-3.5 h-3.5 text-signal" />
            </div>
            <div className="mt-3">
              <span className="font-display font-bold text-lg text-ink font-mono">
                {Math.round(treeAbsorptionDays)}
              </span>
              <span className="text-[10px] text-muted font-bold pl-0.5">days</span>
            </div>
            <span className="text-[8px] text-muted block mt-1 leading-none">杉の木CO2吸収日数換算</span>
          </div>

        </div>

      </div>

      {/* CO2 Savings by Vehicle Chart */}
      <div className="pt-2">
        <div className="flex flex-col mb-3">
          <span className="text-[10px] text-muted font-bold tracking-wide uppercase font-mono">
            CO₂ Savings Contribution by Route (kg)
          </span>
          <span className="text-[9px] text-muted">
            運行ルート別・在宅調整協調による炭素排出削減内訳
          </span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" horizontal={false} />
              <XAxis type="number" fontSize={9} stroke="#888888" tickLine={false} />
              <YAxis 
                dataKey="name" 
                type="category" 
                fontSize={9} 
                stroke="#888888" 
                tickLine={false} 
                width={55}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#F5F5F0", fontSize: "11px", color: "#0D1117" }}
                itemStyle={{ color: "#0D1117" }}
                cursor={{ fill: "rgba(13, 17, 23, 0.04)" }}
              />
              <Bar dataKey="co2" name="CO₂ Saved (kg)" radius={[0, 4, 4, 0]} barSize={10}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Explanatory footer tag */}
      <div className="text-[9.5px] text-muted italic leading-relaxed pt-2.5 border-t border-neutral-200 mt-1">
        ⭐ <strong>Green Logistics Fact:</strong> By utilizing calibrated neural forecasts to align target delivery slots with user attendance, TakumiRoute prevents unnecessary secondary return trips. Each confirmed and matched window directly translates to high first-attempt outcomes, saving valuable fuel and reducing carbon footprint.
      </div>
    </div>
  );
}
