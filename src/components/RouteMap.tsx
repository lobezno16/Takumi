/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { useDeliveryStore, useMapStore, useAgentStore } from "../store";
import { getPHomeColor } from "../utils";
import { Delivery, Vehicle } from "../types";
import { 
  Eye, 
  EyeOff, 
  Info, 
  MapPin, 
  Navigation, 
  Calendar, 
  Shuffle, 
  CheckCircle2, 
  Clock, 
  HelpCircle,
  TrendingDown,
  Layers,
  X,
  Bot,
  Send
} from "lucide-react";

// For MapLibre importing safely in TS environment
import maplibregl from "maplibre-gl";

export default function RouteMap() {
  const { 
    deliveries, 
    vehicles, 
    toggleVehicleVisibility, 
    setCurrentPage, 
    setSelectedDeliveryId, 
    activeVehicleId, 
    setActiveVehicleId,
    updateDeliveryStatus 
  } = useDeliveryStore();
  const { viewState, setViewState, showBaseline, setShowBaseline, hoveredStop, setHoveredStop } = useMapStore();
  const { chatThreads, addChatMessage, addEvent } = useAgentStore();
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sidebarChatEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedPin, setSelectedPin] = useState<Delivery | null>(null);
  const [sidebarChatInput, setSidebarChatInput] = useState("");
  const [useMaplibre, setUseMaplibre] = useState(false); // Default to visual high-fidelity tactical grid SVG fallback for guaranteed sandbox loading, users can switch!

  // Filter deliveries by visible vehicles
  const visibleVehicleIds = useMemo(() => {
    return vehicles.filter(v => v.visible).map(v => v.id);
  }, [vehicles]);

  const filteredDeliveries = useMemo(() => {
    let result = deliveries.filter(d => visibleVehicleIds.includes(d.vehicleId));
    if (activeVehicleId) {
      result = result.filter(d => d.vehicleId === activeVehicleId);
    }
    return result;
  }, [deliveries, visibleVehicleIds, activeVehicleId]);

  // Coordinate normalizer for the tactical high-fidelity SVG/Canvas map fallback
  // Map our Tokyo coordinates to screen coordinates
  const bounds = useMemo(() => {
    let minLng = 139.77;
    let maxLng = 139.84;
    let minLat = 35.61;
    let maxLat = 35.70;
    
    return { minLng, maxLng, minLat, maxLat };
  }, []);

  const projectCoord = (lng: number, lat: number, width: number, height: number) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
    const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
    return { x, y };
  };

  // Build MapLibre instance if useMaplibre toggle is true
  useEffect(() => {
    if (!useMaplibre || !mapContainerRef.current) return;

    // CartoDB Dark Matter raster tiles style definition (Zero keys, fast, compliant with ink mode)
    const cartoDarkStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "carto-dark": {
          type: "raster",
          tiles: [
            "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors, © CartoDB"
        }
      },
      layers: [
        {
          id: "carto-dark-layer",
          type: "raster",
          source: "carto-dark",
          minzoom: 0,
          maxzoom: 20
        }
      ]
    };

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: cartoDarkStyle,
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom ?? 12,
        pitch: viewState.pitch ?? 0,
        bearing: viewState.bearing ?? 0
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

      map.on("move", () => {
        const center = map.getCenter();
        setViewState({
          longitude: center.lng,
          latitude: center.lat,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing()
        });
      });

      mapRef.current = map;

      // Render simple markers
      filteredDeliveries.slice(0, 75).forEach((del) => {
        const color = getPHomeColor(del.pHome);
        const el = document.createElement("div");
        el.className = "custom-map-marker";
        el.style.width = `${Math.max(6, del.pHome * 15)}px`;
        el.style.height = `${Math.max(6, del.pHome * 15)}px`;
        el.style.backgroundColor = color;
        el.style.borderRadius = "50%";
        el.style.border = "1.5px solid #F5F5F0";
        el.style.cursor = "pointer";
        el.style.boxShadow = "0 0 6px rgba(0,0,0,0.5)";

        el.addEventListener("click", () => {
          setSelectedPin(del);
        });

        // MapLibre popup on hover
        new maplibregl.Marker({ element: el })
          .setLngLat(del.coordinates)
          .addTo(map);
      });

      // Render high-fidelity route and baseline polylines for active/visible vehicles
      const drawRouteLines = () => {
        vehicles.forEach((v) => {
          const activeFilter = activeVehicleId === null || activeVehicleId === v.id;
          if (!v.visible || !activeFilter) return;

          const coordinates = v.routeCoordinates;
          if (!coordinates || coordinates.length < 2) return;

          // 1. Optional: baseline unoptimized route projection (slightly offset/red dashed)
          if (showBaseline) {
            const baselineSourceId = `baseline-source-${v.id}`;
            const baselineLayerId = `baseline-layer-${v.id}`;

            // Slightly perturb baseline coordinates for beautiful visual contrast if desired,
            // or use standard coordinates with distinct visual styling (dashed & red)
            if (!map.getSource(baselineSourceId)) {
              map.addSource(baselineSourceId, {
                type: "geojson",
                data: {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: coordinates
                  }
                }
              });
              map.addLayer({
                id: baselineLayerId,
                type: "line",
                source: baselineSourceId,
                layout: {
                  "line-join": "round",
                  "line-cap": "round"
                },
                paint: {
                  "line-color": "#E8442A",
                  "line-width": 2,
                  "line-opacity": 0.5,
                  "line-dasharray": [2, 3]
                }
              });
            }
          }

          // 2. High-fidelity active optimized route layer
          const routeSourceId = `route-source-${v.id}`;
          const routeLayerId = `route-layer-${v.id}`;

          if (!map.getSource(routeSourceId)) {
            map.addSource(routeSourceId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: coordinates
                }
              }
            });
            map.addLayer({
              id: routeLayerId,
              type: "line",
              source: routeSourceId,
              layout: {
                "line-join": "round",
                "line-cap": "round"
              },
              paint: {
                "line-color": v.color,
                "line-width": 4,
                "line-opacity": 0.85
              }
            });
          }
        });
      };

      // Ensure style layers are drawn safely when loaded
      if (map.loaded()) {
        drawRouteLines();
      } else {
        map.on("load", drawRouteLines);
      }

    } catch (e) {
      console.warn("MapLibre load error, falling back to tactical SVG projection :", e);
      setUseMaplibre(false);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [useMaplibre, filteredDeliveries, vehicles, showBaseline, activeVehicleId]);

  const handleStopDetailRedirect = (id: string) => {
    setSelectedDeliveryId(id);
    setCurrentPage("deliveries");
  };

  // Find currently selected element inside deliveries array for reactivity
  const currentSelectedDelivery = useMemo(() => {
    if (!selectedPin) return null;
    return deliveries.find(d => d.id === selectedPin.id) || selectedPin;
  }, [deliveries, selectedPin]);

  // Track chat logs for the selected stop in the sidebar
  const sidebarChatThread = useMemo(() => {
    if (!currentSelectedDelivery) return [];
    return chatThreads[currentSelectedDelivery.id] || [];
  }, [chatThreads, currentSelectedDelivery]);

  // Auto-scroll chat on thread updates
  useEffect(() => {
    if (sidebarChatEndRef.current) {
      sidebarChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sidebarChatThread]);

  // Send message from sidebar and simulate customer reply
  const handleSidebarSendMessage = () => {
    if (!sidebarChatInput.trim() || !currentSelectedDelivery) return;
    
    const deliveryId = currentSelectedDelivery.id;
    const recipientName = currentSelectedDelivery.recipientName;
    const msgText = sidebarChatInput;
    setSidebarChatInput("");

    // Add operator message
    addChatMessage(deliveryId, "agent", msgText);

    // Simulate smart customer response
    setTimeout(() => {
      let reply = "I understand the ETA. I am currently out but I will try to be back soon. Thank you!";
      let targetStatus: "confirmed" | "pending" | "flagged" = "pending";
      let nextPHome = 0.58;

      if (msgText.toLowerCase().includes("evening") || msgText.toLowerCase().includes("slot") || msgText.toLowerCase().includes("reschedule") || msgText.includes("時間") || msgText.includes("夜")) {
        reply = "Yes, 7:30 PM is perfect! I will definitely be home then. Thank you for rescheduling!";
        targetStatus = "confirmed";
        nextPHome = 0.95;
      } else if (msgText.toLowerCase().includes("box") || msgText.toLowerCase().includes("locker") || msgText.toLowerCase().includes("leave") || msgText.includes("ボックス") || msgText.includes("置き配")) {
        reply = "Okay! Please leave it in the delivery locker on the 1st floor. The entry code is 4821.";
        targetStatus = "confirmed";
        nextPHome = 0.99;
      }

      addChatMessage(deliveryId, "recipient", reply);
      
      // Update store status and scores
      updateDeliveryStatus(deliveryId, targetStatus, nextPHome);

      // Trigger telemetry event
      addEvent({
        type: targetStatus === "confirmed" ? "slot_confirmed" : "incoming_msg",
        delivery_id: deliveryId,
        recipient_name: recipientName,
        message: `Dynamic outreach processed via Map. Presence probability raised to ${(nextPHome * 100).toFixed(0)}%. Routing updated.`,
        timestamp: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
        slot_confirmed: targetStatus === "confirmed" ? true : undefined
      });
    }, 1200);
  };

  return (
    <div id="route-map-page" className="flex h-[calc(100vh-64px)] overflow-hidden select-none bg-ink text-paper">
      
      {/* SIDEBAR: VEHICLE FLEET PANEL */}
      <div id="map-sidebar" className="w-80 bg-ink border-r border-[#22272E] flex flex-col justify-between h-full z-10">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[#22272E]">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-sm font-display font-medium text-paper">
                  Active Vehicle Fleet
                </h3>
                <span className="text-[10px] text-muted">
                  車両別ルートトグル・運行状況 (8台)
                </span>
              </div>
              <Layers className="w-4 h-4 text-accent" />
            </div>

            {/* Quick Filter Active vehicle details */}
            {activeVehicleId && (
              <div className="mt-3 py-1.5 px-2.5 bg-accent/10 border border-accent/20 rounded flex items-center justify-between">
                <span className="text-[10px] font-mono text-paper font-semibold">
                  FILTERED: Vehicle {activeVehicleId}
                </span>
                <button 
                  id="clear-vehicle-filter"
                  onClick={() => setActiveVehicleId(null)}
                  className="text-[9px] text-accent hover:text-paper leading-none font-bold underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {vehicles.map((v) => {
              const activeFilter = activeVehicleId === null || activeVehicleId === v.id;
              return (
                <div
                  id={`fleet-v-${v.id}`}
                  key={v.id}
                  className={`p-3 rounded-md border transition-all ${
                    v.visible && activeFilter
                      ? "bg-[#161B22] border-[#2E353F]" 
                      : "bg-[#0D1117]/40 border-transparent opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: v.color }} 
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono leading-none text-paper font-semibold">
                          VEHICLE {v.id}
                        </span>
                        <span className="text-xs font-medium text-muted mt-0.5">
                          {v.driverName.split(" ")[0]}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Select filter trigger */}
                      <button
                        id={`filter-vehicle-${v.id}`}
                        onClick={() => setActiveVehicleId(activeVehicleId === v.id ? null : v.id)}
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-muted/20 ${
                          activeVehicleId === v.id 
                            ? "bg-accent/20 text-accent border-accent/40" 
                            : "text-muted hover:text-paper"
                        }`}
                      >
                        Focus
                      </button>

                      {/* Route show checkbox button */}
                      <button
                        id={`toggle-route-visibility-${v.id}`}
                        onClick={() => toggleVehicleVisibility(v.id)}
                        className="text-muted hover:text-paper"
                      >
                        {v.visible ? <Eye className="w-4 h-4 text-signal" /> : <EyeOff className="w-4 h-4 text-muted" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 text-[10px] text-muted">
                    <span>Stops: <strong>{v.stopsCount}</strong></span>
                    <span>Confidence: <strong className="font-mono text-paper">{(v.averagePHome * 100).toFixed(0)}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tactical Legend info */}
        <div className="p-4 border-t border-[#22272E] bg-[#0D1117]">
          <span className="text-[9px] text-muted font-semibold tracking-wider block uppercase mb-1.5">
            Stopped Node Dialect
          </span>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <div className="h-1 w-full bg-accent rounded" />
              <span className="text-[8px] text-muted font-mono leading-none">p_home &lt; 0.45</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-1 w-full bg-warn rounded" />
              <span className="text-[8px] text-muted font-mono leading-none">0.45 - 0.72</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-1 w-full bg-signal rounded" />
              <span className="text-[8px] text-muted font-mono leading-none">p_home &gt; 0.72</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAP STAGE CANVAS VIEWPORT */}
      <div className="flex-1 relative flex flex-col">
        {/* TOP INTERACTIVE CONTROLS BAR */}
        <div id="map-controls-banner" className="h-12 bg-ink/90 border-b border-[#22272E] absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            {/* Engine Type Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted uppercase font-mono font-bold">
                Map Engine:
              </span>
              <div className="inline-flex bg-[#161B22] rounded-md p-0.5 border border-[#22272E]">
                <button
                  id="engine-tactical-btn"
                  onClick={() => setUseMaplibre(false)}
                  className={`px-2 py-0.5 text-[9px] font-mono rounded font-semibold ${
                    !useMaplibre ? "bg-accent text-paper" : "text-muted hover:text-paper"
                  }`}
                >
                  Tactical Grid
                </button>
                <button
                  id="engine-maplibre-btn"
                  onClick={() => setUseMaplibre(true)}
                  className={`px-2 py-0.5 text-[9px] font-mono rounded font-semibold ${
                    useMaplibre ? "bg-accent text-paper" : "text-muted hover:text-paper"
                  }`}
                >
                  MapLibre GL
                </button>
              </div>
            </div>

            {/* Baseline comparison toggle (Red dashed lines) */}
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-muted uppercase font-mono font-bold">
                Show Baseline Map:
              </span>
              <button
                id="toggle-baseline-map-btn"
                onClick={() => setShowBaseline(!showBaseline)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
                  showBaseline ? "bg-accent" : "bg-[#22272E]"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-paper shadow ring-0 transition duration-200 ${
                  showBaseline ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </div>
          </div>

          <div className="text-[10px] font-mono text-muted flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-accent" />
            <span>Koto-ku Active Area Map: <strong>{filteredDeliveries.length} nodes</strong> loaded</span>
          </div>
        </div>

        {/* MAP PORT AREA */}
        <div className="flex-1 h-full w-full pt-12">
          {useMaplibre ? (
            <div 
              id="maplibre-container-stage"
              ref={mapContainerRef} 
              className="w-full h-full bg-[#0D1117]" 
            />
          ) : (
            /* STUNNING HIGH-FIDELITY VECTOR SVG FALLBACK MAP */
            <div id="tactical-vector-stage" className="w-full h-full bg-[#090C10] relative flex items-center justify-center p-6 select-none overflow-hidden">
              {/* Radar Grid Circles backdrop to look intensely high tech */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                <div className="w-[80%] h-[80%] rounded-full border border-paper animate-pulse" style={{ animationDuration: "8s" }} />
                <div className="absolute w-[60%] h-[60%] rounded-full border border-paper" />
                <div className="absolute w-[40%] h-[40%] rounded-full border border-paper" />
                <div className="absolute w-[20%] h-[20%] rounded-full border border-paper" />
                <div className="absolute h-full w-px bg-paper" />
                <div className="absolute w-full h-px bg-paper" />
              </div>

              {/* Map grid lines layout */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#22272e_1px,transparent_1px),linear-gradient(to_bottom,#22272e_1px,transparent_1px)] bg-[size:32px_32px] opacity-15 pointer-events-none" />

              {/* Live SVG stage projection */}
              <svg 
                id="tactical-map-svg"
                className="w-full h-full max-w-4xl max-h-[85%] relative z-10 overflow-visible"
                viewBox="0 0 800 600"
              >
                {/* 1. LAYER: ROUTE COGNITIVE PATHS */}
                {vehicles.map((v) => {
                  const activeFilter = activeVehicleId === null || activeVehicleId === v.id;
                  if (!v.visible || !activeFilter) return null;

                  // Project all coordinates of this vehicle onto screen width 800 x height 600
                  const projectedPoints = v.routeCoordinates.map(([clng, clat]) => {
                    const p = projectCoord(clng, clat, 800, 600);
                    return `${p.x},${p.y}`;
                  }).join(" ");

                  return (
                    <g key={`path-${v.id}`}>
                      {/* Optional: baseline route projection if baseline toggle show */}
                      {showBaseline && (
                        <polyline
                          id={`baseline-polyline-${v.id}`}
                          points={projectedPoints}
                          fill="none"
                          stroke="#E8442A"
                          strokeWidth={1.5}
                          strokeDasharray="4 6"
                          opacity={0.4}
                        />
                      )}
                      
                      {/* Optimized routing line */}
                      <polyline
                        id={`optimized-polyline-${v.id}`}
                        points={projectedPoints}
                        fill="none"
                        stroke={v.color}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all duration-300"
                        opacity={0.95}
                      />
                    </g>
                  );
                })}

                {/* 2. LAYER: STOPS / CUSTOMER NODES */}
                {filteredDeliveries.map((del) => {
                  const p = projectCoord(del.coordinates[0], del.coordinates[1], 800, 600);
                  const radius = Math.max(5, del.pHome * 12);
                  const color = getPHomeColor(del.pHome);
                  const isHovered = hoveredStop?.delivery?.id === del.id;
                  const isSelected = selectedPin?.id === del.id;

                  return (
                    <g 
                      key={`stop-${del.id}`}
                      className="cursor-pointer"
                      onClick={() => setSelectedPin(del)}
                      onMouseEnter={(e) => setHoveredStop({ x: p.x, y: p.y, delivery: del })}
                      onMouseLeave={() => setHoveredStop(null)}
                    >
                      {/* Subtle bloom glow effect */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={radius + 4}
                        fill={color}
                        opacity={isHovered || isSelected ? 0.35 : 0}
                        className="transition-all"
                      />
                      
                      {/* Base colored circle stop */}
                      <circle
                        id={`stop-circle-${del.id}`}
                        cx={p.x}
                        cy={p.y}
                        r={radius}
                        fill={color}
                        stroke={isHovered || isSelected ? "#F5F5F0" : "#0D1117"}
                        strokeWidth={isHovered || isSelected ? 2 : 1}
                        className="transition-all duration-150"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip is kept for rapid inspect */}
              {hoveredStop && hoveredStop.delivery && (
                <div
                  id="hover-tooltip-floater"
                  className="absolute bg-paper text-ink p-3 rounded shadow-xl border border-neutral-200 z-30 flex flex-col gap-1 scale-95 origin-bottom transition-all pointer-events-none"
                  style={{
                    left: `${Math.min(window.innerWidth - 650, Math.max(20, (hoveredStop.x / 800) * (window.innerWidth - 320)))}px`,
                    top: `${Math.min(window.innerHeight - 300, Math.max(50, (hoveredStop.y / 600) * (window.innerHeight - 200)))}px`
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono text-muted leading-none capitalize">
                      {hoveredStop.delivery.id}
                    </span>
                    <span 
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: getPHomeColor(hoveredStop.delivery.pHome) }} 
                    />
                  </div>
                  <span className="text-xs font-bold leading-tight">
                    {hoveredStop.delivery.recipientName}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-muted">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>Slot: {hoveredStop.delivery.scheduledSlot}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] pt-1.5 mt-1 border-t border-muted/20">
                    <span>p_home: <strong className="font-mono text-amber-600 font-bold">{(hoveredStop.delivery.pHome * 100).toFixed(0)}%</strong></span>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-mono leading-none ${
                        hoveredStop.delivery.status === "confirmed" ? "bg-signal/15 text-signal font-bold" : hoveredStop.delivery.status === "pending" ? "bg-warn/10 text-warn" : "bg-accent/15 text-accent"
                    }`}>
                      {hoveredStop.delivery.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Fallback floating guide */}
              <div className="absolute bottom-4 left-4 bg-ink/90 border border-[#22272E] px-3 py-1.5 rounded text-[10px] font-mono text-muted pointer-events-none capitalize">
                Koto-ku coordinates projected dynamically on 800x600 canvas coordinate lines.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR STOP DETAIL INSPECTOR */}
      {currentSelectedDelivery && (
        <div 
          id="stop-detail-sidebar" 
          className="w-96 bg-ink border-l border-[#22272E] flex flex-col h-full z-20 animate-slide-in relative select-none divide-y divide-[#22272E]"
        >
          {/* Section 1: Header */}
          <div className="p-4 flex items-start justify-between bg-[#161B22]/60">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono leading-none bg-[#22272E] text-accent px-1.5 py-0.5 rounded font-bold border border-accent/20">
                  {currentSelectedDelivery.id}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono leading-none capitalize border ${
                  currentSelectedDelivery.status === "confirmed" 
                  ? "bg-signal/15 text-signal border-signal/30 font-bold" 
                  : currentSelectedDelivery.status === "pending" 
                  ? "bg-warn/15 text-warn border-warn/30" 
                  : "bg-accent/15 text-accent border-accent/30"
                }`}>
                  {currentSelectedDelivery.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-paper font-display tracking-tight mt-1">
                {currentSelectedDelivery.recipientName}
              </h3>
            </div>
            
            <button
              id="close-sidebar-btn"
              onClick={() => setSelectedPin(null)}
              className="p-1.5 rounded-md text-muted hover:text-paper hover:bg-[#22272E] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 2: Core Details Profile */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-muted font-mono tracking-wider uppercase block">
                Deliverable Profile
              </span>
              
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#161B22] p-2.5 rounded border border-[#22272E] flex flex-col gap-1">
                  <span className="text-[8px] text-muted font-mono uppercase tracking-wider block">District Address</span>
                  <span className="font-bold text-paper truncate">{currentSelectedDelivery.district}</span>
                  <span className="text-[9px] text-muted truncate">{currentSelectedDelivery.address}</span>
                </div>

                <div className="bg-[#161B22] p-2.5 rounded border border-[#22272E] flex flex-col gap-1">
                  <span className="text-[8px] text-muted font-mono uppercase tracking-wider block">Building Profile</span>
                  <span className="font-bold text-paper truncate">{currentSelectedDelivery.floorType}</span>
                  <span className="text-[9px] text-muted truncate">Koto-ku Elev: 5m</span>
                </div>
              </div>
            </div>

            {/* Presence confidence block */}
            <div className="bg-[#161B22] border border-[#22272E] p-3 rounded-md space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[9px] text-muted font-bold font-mono uppercase tracking-wider block">
                  Presence Probability (p_home)
                </span>
                <span 
                  className="font-mono font-bold" 
                  style={{ color: getPHomeColor(currentSelectedDelivery.pHome) }}
                >
                  {(currentSelectedDelivery.pHome * 100).toFixed(0)}%
                </span>
              </div>
              
              {/* Dynamic Progress Bar */}
              <div className="h-1.5 w-full bg-[#1F242C] rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500" 
                  style={{ 
                    width: `${currentSelectedDelivery.pHome * 100}%`, 
                    backgroundColor: getPHomeColor(currentSelectedDelivery.pHome) 
                  }} 
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-muted">
                <span>Target Slot: <strong className="text-paper font-mono">{currentSelectedDelivery.scheduledSlot}</strong></span>
                <span>Vehicle: <strong className="text-paper font-mono">#{currentSelectedDelivery.vehicleId}</strong></span>
              </div>
            </div>

            {/* AI Agent Interaction & Outreach Chat Console */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-muted font-mono tracking-wider uppercase block">
                  Dynamic Outreach Thread
                </span>
                <span className="text-[8.5px] text-[#00E5FF] font-mono uppercase flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
                  Live Sync
                </span>
              </div>

              {/* Chat Log Component */}
              <div className="h-44 bg-[#0D1117] border border-[#22272E] rounded-md p-2.5 overflow-y-auto flex flex-col gap-2">
                {sidebarChatThread.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-3 text-muted gap-1">
                    <Bot className="w-6 h-6 text-accent opacity-55 animate-pulse" />
                    <span className="text-[10px]">No active outreach logs configured yet.</span>
                    <span className="text-[8px] opacity-70">Type below to negotiate on-the-fly</span>
                  </div>
                ) : (
                  sidebarChatThread.map((msg, idx) => {
                    if (msg.sender === "system") {
                      return (
                        <div key={idx} className="text-center my-1 shrink-0">
                          <span className="inline-block bg-[#161B22] text-muted font-mono text-[8px] px-2 py-0.5 rounded border border-[#22272E] leading-none text-center">
                            ⚙️ {msg.message}
                          </span>
                        </div>
                      );
                    }

                    const isAgent = msg.sender === "agent";
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col max-w-[85%] shrink-0 ${
                          isAgent ? "self-start text-left" : "self-end text-right ml-auto"
                        }`}
                      >
                        <div
                          className={`p-2 rounded text-left ${
                            isAgent 
                              ? "bg-[#161B22] text-paper border border-[#22272E]" 
                              : "bg-paper text-ink shadow-sm border border-neutral-300 animate-fade-in"
                          }`}
                        >
                          <p className="text-[10px] leading-relaxed break-words">{msg.message}</p>
                        </div>
                        <span className="text-[7.5px] text-muted italic mt-0.5 inline-block font-mono">
                          {isAgent ? "Takumi Route AI" : "Customer"} • {msg.timestamp}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={sidebarChatEndRef} />
              </div>

              {/* Chat Console Input */}
              <div className="flex gap-1.5 pt-1">
                <input
                  id="sidebar-chat-input"
                  type="text"
                  placeholder="Chat options: Evening? Box locker?"
                  value={sidebarChatInput}
                  onChange={(e) => setSidebarChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSidebarSendMessage()}
                  className="flex-1 bg-[#161B22] border border-[#22272E] rounded px-2.5 py-1.5 text-[11px] text-paper outline-none focus:border-accent"
                />
                <button
                  id="sidebar-chat-send-btn"
                  onClick={handleSidebarSendMessage}
                  className="bg-accent text-paper p-1.5 rounded hover:bg-accent-muted active:scale-95 transition-all text-center cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Bottom action controls */}
          <div className="p-4 space-y-2 bg-[#0D1117] shrink-0">
            <button
              id="sidebar-verify-detail-btn"
              onClick={() => handleStopDetailRedirect(currentSelectedDelivery.id)}
              className="w-full bg-[#161B22] hover:bg-[#202731] border border-[#2E353F] text-paper text-center text-xs font-semibold py-2 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5 text-accent animate-pulse" />
              Verify Stop AI Agent Workspace
            </button>
            <button
              id="sidebar-dismiss-btn"
              onClick={() => setSelectedPin(null)}
              className="w-full bg-transparent hover:bg-[#161B22]/40 text-muted hover:text-paper text-center text-xs py-1.5 rounded transition-all cursor-pointer font-mono text-[9px]"
            >
              CLOSE INSPECTOR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
