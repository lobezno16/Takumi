/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { registerToastCallback, useDeliveryStore } from "../store";
import { AgentEvent } from "../types";
import { Bell, ArrowRight, X, Bot, Landmark, MessageSquare, ShieldAlert } from "lucide-react";

export default function AgentEventToast() {
  const [toast, setToast] = useState<AgentEvent | null>(null);
  const { setCurrentPage, setSelectedDeliveryId } = useDeliveryStore();

  useEffect(() => {
    // Register toast listener
    registerToastCallback((event) => {
      // Exclude quiet notifications like optimization if they spawn too frequently
      setToast(event);
      
      // Auto dismiss after 6 seconds
      const timer = setTimeout(() => {
        setToast((current) => current?.id === event.id ? null : current);
      }, 6000);
      
      return () => clearTimeout(timer);
    });
  }, []);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case "slot_confirmed": return <Bot className="w-4 h-4 text-signal" />;
      case "incoming_msg": return <MessageSquare className="w-4 h-4 text-data" />;
      case "reoptimize": return <Landmark className="w-4 h-4 text-[#AC73E6]" />;
      default: return <ShieldAlert className="w-4 h-4 text-warn" />;
    }
  };

  const getTypeBadgeColor = () => {
    switch (toast.type) {
      case "slot_confirmed": return "bg-signal/15 text-signal border-signal/30";
      case "incoming_msg": return "bg-data/15 text-data border-data/30";
      case "reoptimize": return "bg-[#AC73E6]/15 text-[#AC73E6] border-[#AC73E6]/30";
      default: return "bg-warn/15 text-warn border-warn/30";
    }
  };

  const handleReview = () => {
    if (toast.delivery_id && toast.delivery_id !== "GLOBAL-OPT" && toast.delivery_id !== "GLOBAL-CONF") {
      setSelectedDeliveryId(toast.delivery_id);
      setCurrentPage("deliveries");
    }
    setToast(null);
  };

  return (
    <div id="event-toast-container" className="fixed bottom-6 right-6 z-50 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        <motion.div
          id={`toast-${toast.id}`}
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="bg-[#161B22] border border-[#22272E] text-paper rounded-lg p-4 shadow-2xl pointer-events-auto flex flex-col gap-3 relative overflow-hidden"
        >
          {/* Subtle Accent Stripe */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />

          {/* Toast Header */}
          <div className="flex items-start justify-between gap-3 mt-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#0D1117] rounded">
                {getIcon()}
              </div>
              <span className={`text-[10px] font-mono tracking-wider font-semibold border rounded px-1.5 uppercase ${getTypeBadgeColor()}`}>
                {toast.type.replace("_", " ")}
              </span>
            </div>
            
            <button
              id={`close-toast-${toast.id}`}
              onClick={() => setToast(null)}
              className="text-muted hover:text-paper"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toast Body */}
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight flex items-center gap-1">
              {toast.delivery_id} : <span className="text-muted text-[10px] font-normal">{toast.recipient_name}</span>
            </span>
            <p className="text-[11px] text-muted leading-relaxed mt-1">
              {toast.message}
            </p>
          </div>

          {/* Action button if delivery-specific */}
          {toast.delivery_id && toast.delivery_id !== "GLOBAL-OPT" && toast.delivery_id !== "GLOBAL-CONF" && (
            <button
              id={`review-toast-btn-${toast.id}`}
              onClick={handleReview}
              className="mt-1 self-end flex items-center gap-1.5 text-[10px] font-semibold text-accent hover:text-paper transition-all"
            >
              Review Conversation <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
