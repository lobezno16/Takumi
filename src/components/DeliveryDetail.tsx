/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useDeliveryStore, useAgentStore } from "../store";
import { getPHomeColor } from "../utils";
import { 
  Search, 
  User, 
  MapPin, 
  Home, 
  Building2, 
  TrendingUp, 
  Send, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Sparkles,
  Bot
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function DeliveryDetail() {
  const { deliveries, selectedDeliveryId, setSelectedDeliveryId, updateDeliveryStatus, vehicles } = useDeliveryStore();
  const { chatThreads, addChatMessage, addEvent } = useAgentStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "pending" | "flagged">("all");
  const [chatInputValue, setChatInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Retrieve selected delivery or default to DEL-1111 or first available
  const delivery = useMemo(() => {
    let del = deliveries.find((d) => d.id === selectedDeliveryId);
    if (!del && deliveries.length > 0) {
      del = deliveries.find((d) => d.id === "DEL-1111") || deliveries[0];
    }
    return del;
  }, [deliveries, selectedDeliveryId]);

  // Autoscroll chat
  const thread = useMemo(() => {
    if (!delivery) return [];
    return chatThreads[delivery.id] || [];
  }, [chatThreads, delivery]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  // Filter deliveries list for sidebar picker
  const filteredPickList = useMemo(() => {
    return deliveries.filter((d) => {
      const matchQuery = d.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         d.district.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [deliveries, searchQuery, statusFilter]);

  // Sparkline data preparation
  const sparkData = useMemo(() => {
    if (!delivery) return [];
    return delivery.historicalHitRate.map((val, idx) => ({ day: idx, rate: val }));
  }, [delivery]);

  // Checks if no slot has p_home >= 0.55
  const hasAbsentyRisk = useMemo(() => {
    if (!delivery) return false;
    return !delivery.predictions.some((p) => p.pHome >= 0.55);
  }, [delivery]);

  // Send human message override
  const handleSendMessage = () => {
    if (!chatInputValue.trim() || !delivery) return;
    
    // Add operator message
    addChatMessage(delivery.id, "agent", chatInputValue);
    const typedText = chatInputValue;
    setChatInputValue("");

    // Simulate smart customer reply after 1.5s
    setTimeout(() => {
      let reply = "I understand. I am out but I will try to be there. Thank you.";
      let targetStatus: "confirmed" | "pending" | "flagged" = "pending";
      let nextPHome = 0.65;

      if (typedText.toLowerCase().includes("evening") || typedText.toLowerCase().includes("slot") || typedText.toLowerCase().includes("reschedule")) {
        reply = "Okay, 7 PM sounds much better. I'll make sure to be home at my apartment then!";
        targetStatus = "confirmed";
        nextPHome = 0.94;
      } else if (typedText.toLowerCase().includes("box") || typedText.toLowerCase().includes("delivery box") || typedText.toLowerCase().includes("leave")) {
        reply = "Yes! Please drop it in the building's shared delivery locker on the 1st floor.";
        targetStatus = "confirmed";
        nextPHome = 0.99;
      }

      addChatMessage(delivery.id, "recipient", reply);
      
      // Update store status and scores
      updateDeliveryStatus(delivery.id, targetStatus, nextPHome);

      // Trigger telemetry event
      addEvent({
        type: targetStatus === "confirmed" ? "slot_confirmed" : "incoming_msg",
        delivery_id: delivery.id,
        recipient_name: delivery.recipientName,
        message: `Dynamic response processed. New success index is ${(nextPHome * 100).toFixed(0)}%. Resigned stops routing sequence on vehicle.`,
        timestamp: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
        slot_confirmed: targetStatus === "confirmed" ? true : undefined
      });
    }, 1500);
  };

  if (!delivery) {
    return (
      <div className="p-6 text-center text-muted">
        Loading delivery record context...
      </div>
    );
  }

  // Group calculations for the prediction grid
  const morningSlots = delivery.predictions.filter(p => p.period === "Morning");
  const afternoonSlots = delivery.predictions.filter(p => p.period === "Afternoon");
  const eveningSlots = delivery.predictions.filter(p => p.period === "Evening");

  return (
    <div id="delivery-detail-page" className="flex h-[calc(100vh-64px)] overflow-hidden select-none bg-ink text-paper text-xs">
      
      {/* SIDEBAR STOP PICKER */}
      <div id="delivery-sidebar" className="w-80 border-r border-[#22272E] flex flex-col bg-ink h-full">
        {/* Search Header */}
        <div className="p-4 border-b border-[#22272E] space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted" />
            <input
              id="recipient-search"
              type="text"
              placeholder="Search recipient or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161B22] border border-[#22272E] rounded-md pl-9 pr-3 py-2 text-xs text-paper outline-none focus:border-accent"
            />
          </div>

          {/* Status filtering badges */}
          <div className="flex gap-1.5 justify-between">
            {(["all", "confirmed", "pending", "flagged"] as const).map((st) => (
              <button
                id={`status-filter-btn-${st}`}
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`py-1 px-2.5 rounded text-[9px] capitalize text-center font-mono border ${
                  statusFilter === st 
                    ? "bg-[#22272E] text-accent border-accent/40 font-bold" 
                    : "bg-[#0D1117] text-muted border-transparent hover:text-paper"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable picker list */}
        <div id="delivery-stop-list" className="flex-1 overflow-y-auto p-2 space-y-1 bg-ink">
          {filteredPickList.map((d) => {
            const isSelected = d.id === delivery.id;
            return (
              <button
                id={`delivery-row-${d.id}`}
                key={d.id}
                onClick={() => setSelectedDeliveryId(d.id)}
                className={`w-full p-3 rounded text-left transition-all border flex justify-between items-start ${
                  isSelected 
                    ? "bg-[#161B22] border-[#2E353F]" 
                    : "bg-transparent border-transparent hover:bg-[#161B22]/40"
                }`}
              >
                <div className="space-y-1 max-w-[70%]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold text-muted bg-[#22272E] px-1 rounded">
                      {d.id}
                    </span>
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getPHomeColor(d.pHome) }}
                    />
                  </div>
                  <span className="font-bold block truncate text-paper mt-0.5">
                    {d.recipientName.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-muted truncate block">
                    {d.district.split(" ")[0]}
                  </span>
                </div>

                <div className="text-right space-y-1 font-mono shrink-0">
                  <span className="text-[10px] font-bold block" style={{ color: getPHomeColor(d.pHome) }}>
                    {(d.pHome * 100).toFixed(0)}%
                  </span>
                  <span className="text-[8px] text-muted block leading-none saturate-50">
                    {d.scheduledSlot.split(" ")[0]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CORE DETAIL WORKSPACE */}
      <div id="delivery-detail-workspace" className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* RISK BANNER DISPLAY */}
        {hasAbsentyRisk && (
          <div id="risk-alert-banner" className="bg-accent/15 border border-accent/30 rounded-lg p-3.5 flex items-start gap-3.5 animate-fade-in relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
            <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col">
              <span className="text-xs font-bold text-paper flex items-center gap-1.5">
                Redelivery Risk Alert: Absence Confidence Warning
              </span>
              <span className="text-[9px] text-muted -mt-0.5">
                不在配達リスク警告：全期間の在宅予測確率が 55% を下回っています。
              </span>
              <p className="text-[10.5px] text-muted/90 leading-relaxed mt-2 italic">
                Our machine learning algorithms indicate that the recipient’s building characteristics combined with historical profiles show high absence likelihood today. <strong>We suggest initiating automated chatbot outreach immediately</strong> to coordinate a confirmed drop-off lockbox or secure a delivery box drop code.
              </p>
            </div>
          </div>
        )}

        {/* TWO COLUMN GRID DETAILS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* COLUMN 1: RECIPIENT PROFILE CARD */}
          <div id="recipient-profile-card" className="bg-paper text-ink rounded-lg p-5 shadow-md space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-muted uppercase">
                  Recipient Stop Profile ({delivery.id})
                </span>
                <h3 className="text-base font-bold text-ink leading-tight mt-0.5">
                  {delivery.recipientName}
                </h3>
              </div>
              <div className="px-2 py-1 bg-[#0D1117]/10 rounded border border-[#22272E]/10">
                <span className={`text-[10px] font-mono font-bold capitalize ${
                  delivery.status === "confirmed" ? "text-signal" : delivery.status === "pending" ? "text-warn" : "text-accent"
                }`}>
                  {delivery.status}
                </span>
              </div>
            </div>

            {/* Profile fields */}
            <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
              <div className="p-2.5 bg-[#0D1117]/5 rounded">
                <div className="flex items-center gap-1.5 text-[9px] text-muted uppercase font-mono tracking-wider mb-1">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  <span>District Address</span>
                </div>
                <span className="font-bold text-ink truncate block">
                  {delivery.district}
                </span>
                <span className="text-[10px] text-muted truncate block">
                  {delivery.address}
                </span>
              </div>

              <div className="p-2.5 bg-[#0D1117]/5 rounded">
                <div className="flex items-center gap-1.5 text-[9px] text-muted uppercase font-mono tracking-wider mb-1">
                  <Home className="w-3.5 h-3.5 text-data" />
                  <span>Building Profile</span>
                </div>
                <span className="font-bold text-ink block">
                  {delivery.floorType}
                </span>
                <span className="text-[10px] text-muted block">
                  Japan Standard Elevation
                </span>
              </div>
            </div>

            {/* HISTORICAL SPARKLINE CHART */}
            <div className="pt-2 bg-[#0D1117]/5 p-3 rounded">
              <div className="flex justify-between items-center mb-2">
                <div className="flex flex-col">
                  <span className="text-[9px] text-muted font-bold tracking-wider uppercase font-mono">
                    30-Day Historical Hit Rate
                  </span>
                  <span className="text-[8px] text-muted">
                    過去30日間の軒先在宅完了完了率推移
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-ink font-mono">
                    Avg Attendance: {(delivery.pHome * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Sparks trend container */}
              <div className="h-14 w-full pt-1.5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#4A9EFF"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* COLUMN 2: REAL-TIME AI OUTREACH CHAT FOR INTERACTIVE CHATBOT */}
          <div id="agent-thread-panel" className="bg-paper text-ink rounded-lg p-5 shadow-md flex flex-col h-[284px]">
            <div className="flex justify-between items-center pb-2.5 border-b border-neutral-200 shrink-0">
              <div className="flex flex-col">
                <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-accent" /> Active Outreach Thread
                </h4>
                <span className="text-[9px] text-muted leading-none -mt-0.5">
                  AI自動エージェントと顧客の交渉チャット
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted font-mono bg-neutral-200 py-0.5 px-2 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                <span>Agent Standby</span>
              </div>
            </div>

            {/* Chat text items lists */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 text-[11px] leading-normal my-2 bg-[#0D1117]/5 rounded">
              {thread.map((msg, idx) => {
                if (msg.sender === "system") {
                  return (
                    <div key={idx} className="text-center my-2">
                      <span className="inline-block bg-[#0D1117]/10 text-muted font-mono text-[8.5px] px-2 py-0.5 rounded-full uppercase border border-[#0D1117]/5 leading-none">
                        ⚙️ {msg.message}
                      </span>
                    </div>
                  );
                }

                const isAgent = msg.sender === "agent";
                return (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      isAgent ? "self-start text-left ml-1" : "self-end mr-1 text-right ml-auto"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-lg text-left ${
                        isAgent 
                          ? "bg-[#0D1117] text-paper rounded-tl-none border border-[#22272E]" 
                          : "bg-paper text-ink rounded-tr-none shadow-sm border border-neutral-200"
                      }`}
                    >
                      <p>{msg.message}</p>
                    </div>
                    <span className="text-[8px] text-muted italic mt-0.5 inline-block font-mono">
                      {isAgent ? "Takumi Route AI" : "Recipient Customer"} • {msg.timestamp}
                    </span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* TextInput Action */}
            <div className="flex gap-2 pt-2 border-t border-neutral-200 shrink-0">
              <input
                id="chat-send-input"
                type="text"
                placeholder="Ask user to reschedule slot or suggest locker dropbox..."
                value={chatInputValue}
                onChange={(e) => setChatInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 bg-[#0D1117]/5 border border-neutral-300 rounded px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
              <button
                id="chat-send-btn"
                onClick={handleSendMessage}
                className="bg-accent text-paper p-2 rounded hover:bg-accent-muted active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: SLOT PREDICTION MATRIX (3 Columns x Time slots) */}
        <div id="slot-prediction-matrix" className="space-y-3">
          <div className="flex flex-col">
            <h3 className="font-display font-semibold text-sm text-paper flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-accent" /> Hourly Stop Attendance Matrix (p_home)
            </h3>
            <span className="text-[10px] text-muted">
              時間帯別在宅可能確率マトリクス（ML予測・最適推奨時間帯の提示）
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* COLUMN MORNING */}
            <div className="bg-[#161B22] border border-[#22272E]/80 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-[#22272E]">
                <span className="font-bold text-accent font-display text-xs">Morning Slots</span>
                <span className="text-[9px] font-mono text-muted uppercase">08:00 - 12:00</span>
              </div>
              
              <div className="space-y-2.5">
                {morningSlots.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-[#0D1117] rounded flex flex-col gap-1.5 border border-[#1C212B]">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-semibold text-paper text-[10.5px]">{item.slot}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold" style={{ color: getPHomeColor(item.pHome) }}>
                          {(item.pHome * 100).toFixed(0)}%
                        </span>
                        {item.recommended && (
                          <span className="bg-signal/20 text-signal border border-signal/30 font-bold font-mono px-1 rounded text-[7.5px] uppercase">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Fill bar indicator */}
                    <div className="h-1 w-full bg-[#1F242C] rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all" 
                        style={{ width: `${item.pHome * 100}%`, backgroundColor: getPHomeColor(item.pHome) }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUMN AFTERNOON */}
            <div className="bg-[#161B22] border border-[#22272E]/80 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-[#22272E]">
                <span className="font-bold text-data font-display text-xs">Afternoon Slots</span>
                <span className="text-[9px] font-mono text-muted uppercase">12:00 - 18:00</span>
              </div>
              
              <div className="space-y-2.5">
                {afternoonSlots.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-[#0D1117] rounded flex flex-col gap-1.5 border border-[#1C212B]">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-semibold text-paper text-[10.5px]">{item.slot}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold" style={{ color: getPHomeColor(item.pHome) }}>
                          {(item.pHome * 100).toFixed(0)}%
                        </span>
                        {item.recommended && (
                          <span className="bg-signal/20 text-signal border border-signal/30 font-bold font-mono px-1 rounded text-[7.5px] uppercase">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Fill bar indicator */}
                    <div className="h-1 w-full bg-[#1F242C] rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all" 
                        style={{ width: `${item.pHome * 100}%`, backgroundColor: getPHomeColor(item.pHome) }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUMN EVENING */}
            <div className="bg-[#161B22] border border-[#22272E]/80 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-[#22272E]">
                <span className="font-bold text-signal font-display text-xs font-semibold">Evening Slots</span>
                <span className="text-[9px] font-mono text-muted uppercase">18:00 - 21:00</span>
              </div>
              
              <div className="space-y-2.5">
                {eveningSlots.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-[#0D1117] rounded flex flex-col gap-1.5 border border-[#1C212B]">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-semibold text-paper text-[10.5px]">{item.slot}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold" style={{ color: getPHomeColor(item.pHome) }}>
                          {(item.pHome * 100).toFixed(0)}%
                        </span>
                        {item.recommended && (
                          <span className="bg-signal/20 text-signal border border-signal/30 font-bold font-mono px-1 rounded text-[7.5px] uppercase">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Fill bar indicator */}
                    <div className="h-1 w-full bg-[#1F242C] rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all" 
                        style={{ width: `${item.pHome * 100}%`, backgroundColor: getPHomeColor(item.pHome) }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
