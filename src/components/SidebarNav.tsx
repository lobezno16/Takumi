/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { useDeliveryStore } from "../store";
import { 
  LayoutDashboard, 
  Map, 
  Truck, 
  SlidersHorizontal, 
  Activity,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";

export default function SidebarNav() {
  const { currentPage, setCurrentPage, selectedDeliveryId } = useDeliveryStore();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      id: "landing" as const,
      label: "Landing Portal",
      jpLabel: "紹介ポータル",
      icon: Sparkles,
    },
    {
      id: "dashboard" as const,
      label: "Dashboard",
      jpLabel: "ダッシュボード",
      icon: LayoutDashboard,
    },
    {
      id: "map" as const,
      label: "Route Map",
      jpLabel: "運行マップ",
      icon: Map,
    },
    {
      id: "deliveries" as const,
      label: "Delivery Detail",
      jpLabel: "配送ステータス",
      icon: Truck,
      disabled: false,
    },
    {
      id: "simulation" as const,
      label: "Simulation",
      jpLabel: "検証シミュレータ",
      icon: SlidersHorizontal,
    },
    {
      id: "ml" as const,
      label: "ML Health",
      jpLabel: "モデル信頼性",
      icon: Activity,
    },
  ];

  return (
    <aside 
      id="sidebar-nav"
      className={`h-screen bg-ink flex flex-col justify-between border-r border-[#22272E] transition-all duration-300 relative select-none ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div>
        {/* Logo Container */}
        <div className="h-16 flex items-center px-4 border-b border-[#22272E] overflow-hidden whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div className="min-w-[32px] h-8 bg-accent rounded flex items-center justify-center font-display font-bold text-paper text-sm">
              匠
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-display font-bold tracking-wider text-paper text-sm leading-none">
                  TakumiRoute
                </span>
                <span className="text-[9px] text-muted leading-tight mt-0.5">
                  匠ルート • 配送最適化
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                id={`nav-${item.id}`}
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center rounded-md p-2.5 transition-all text-left ${
                  isActive 
                    ? "bg-[#1F242C] text-accent border-l-2 border-accent" 
                    : "text-muted hover:text-paper hover:bg-[#161B22]"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
                {!collapsed && (
                  <div className="ml-3 flex flex-col leading-tight">
                    <span className="text-xs font-semibold tracking-wide">{item.label}</span>
                    <span className="text-[9px] text-muted mt-0.5">{item.jpLabel}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collapse Action and Versioning */}
      <div className="p-3 border-t border-[#22272E]">
        {!collapsed && (
          <div className="mb-3 px-2 py-1.5 bg-[#161B22] rounded flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-signal animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] text-paper font-mono">v4.2.1-PROD</span>
              <span className="text-[8px] text-muted">KOTO DISTRICT ACTIVE</span>
            </div>
          </div>
        )}
        
        <button
          id="toggle-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full h-8 flex items-center justify-center rounded bg-[#161B22] text-muted hover:text-paper hover:bg-[#1F242C] transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
