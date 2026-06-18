/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Delivery, Vehicle, AgentEvent, MLHealthData } from "./types";

// Tokyo Kōtō-ku center point coordinate reference
export const KOTO_CENTER_LNG = 139.805;
export const KOTO_CENTER_LAT = 35.655;

export const DISTRICTS = [
  "Toyosu (豊洲)",
  "Ariake (有明)",
  "Shinonome (東雲)",
  "Tatsumi (辰巳)",
  "Kiba (木場)",
  "Monzen-nakacho (門前仲町)",
  "Kiyosumi (清澄)",
  "Kameido (亀戸)",
  "Ojima (大島)",
  "Sunamachi (砂町)"
];

const FLATS = ["Detached House", "Elevator Apt (High-rise)", "Stairs Apt (Low-rise)", "Office/Commercial"];

const JAPANESE_NAMES = [
  "佐藤 健一 (Sato Kenichi)",
  "鈴木 美咲 (Suzuki Misaki)",
  "高橋 洋介 (Takahashi Yosuke)",
  "田中 麻衣 (Tanaka Mai)",
  "伊藤 誠 (Ito Makoto)",
  "渡辺 恵子 (Watanabe Keiko)",
  "山本 翼 (Yamamoto Tsubasa)",
  "中村 奈々 (Nakamura Nana)",
  "小林 拓也 (Kobayashi Takuya)",
  "加藤 裕美 (Kato Yumi)",
  "吉田 剛 (Yoshida Tsuyoshi)",
  "山田 優 (Yamada Yu)",
  "佐々木 遥 (Sasaki Haruka)",
  "山口 健 (Yamaguchi Ken)",
  "松本 沙織 (Matsumoto Saori)",
  "井上 修 (Inoue Osamu)",
  "木村 綾 (Kimura Aya)",
  "林 浩二 (Hayashi Koji)",
  "斎藤 萌 (Saito Moe)",
  "清水 翔太 (Shimizu Shota)"
];

const TIME_SLOTS = [
  { slot: "08:00 - 10:00", period: "Morning" as const },
  { slot: "10:00 - 12:00", period: "Morning" as const },
  { slot: "12:00 - 14:00", period: "Afternoon" as const },
  { slot: "14:00 - 16:00", period: "Afternoon" as const },
  { slot: "16:00 - 18:00", period: "Afternoon" as const },
  { slot: "18:00 - 20:00", period: "Evening" as const },
  { slot: "20:00 - 21:00", period: "Evening" as const }
];

// Helper to generate seedable randoms
function seedRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate the 8 Vehicles
export const MOCK_VEHICLES: Vehicle[] = [
  { id: "V01", driverName: "K. Saito (斎藤 健)", stopsCount: 26, averagePHome: 0.78, routeCoordinates: [], color: "#E8442A", visible: true },
  { id: "V02", driverName: "M. Tanaka (田中 雅人)", stopsCount: 24, averagePHome: 0.72, routeCoordinates: [], color: "#4A9EFF", visible: true },
  { id: "V03", driverName: "T. Abe (阿部 智)", stopsCount: 28, averagePHome: 0.81, routeCoordinates: [], color: "#00C896", visible: true },
  { id: "V04", driverName: "Y. Goto (後藤 康弘)", stopsCount: 23, averagePHome: 0.69, routeCoordinates: [], color: "#F5A623", visible: true },
  { id: "V05", driverName: "S. Mori (森 慎太郎)", stopsCount: 25, averagePHome: 0.74, routeCoordinates: [], color: "#AC73E6", visible: true },
  { id: "V06", driverName: "H. Suzuki (鈴木 博)", stopsCount: 27, averagePHome: 0.80, routeCoordinates: [], color: "#FF5E7E", visible: true },
  { id: "V07", driverName: "N. Maeda (前田 直人)", stopsCount: 22, averagePHome: 0.65, routeCoordinates: [], color: "#00E5FF", visible: true },
  { id: "V08", driverName: "R. Nakano (中野 竜)", stopsCount: 25, averagePHome: 0.71, routeCoordinates: [], color: "#FFD54F", visible: true }
];

// Generate 200 mock deliveries in Kōtō-ku
export const MOCK_DELIVERIES: Delivery[] = [];

// Generate deterministic coordinates scatter around center
for (let i = 0; i < 200; i++) {
  const r = seedRandom(i + 12.34);
  const rAngle = seedRandom(i + 56.78) * 2 * Math.PI;
  // Radius between 0.002 to 0.03 degrees for Kōtō-ku spreading
  const radius = 0.005 + r * 0.024;
  const lng = KOTO_CENTER_LNG + Math.cos(rAngle) * radius * 1.35; // Aspect stretch
  const lat = KOTO_CENTER_LAT + Math.sin(rAngle) * radius;

  // Dynamic probabilities
  const pHomeBase = 0.25 + seedRandom(i + 101) * 0.65;
  const districtIdx = Math.floor(seedRandom(i + 202) * DISTRICTS.length);
  const flatIdx = Math.floor(seedRandom(i + 303) * FLATS.length);
  const nameIdx = Math.floor(seedRandom(i + 404) * JAPANESE_NAMES.length);
  const vehicleIdx = Math.floor(seedRandom(i + 505) * MOCK_VEHICLES.length);
  const vehicleId = MOCK_VEHICLES[vehicleIdx].id;

  // Add a bit of historical noise
  const SparkValues: number[] = [];
  for (let h = 0; h < 30; h++) {
    SparkValues.push(Math.round((0.3 + seedRandom(i + h + 800) * 0.6) * 100));
  }

  // Generate predicting slots distribution
  const predictions = TIME_SLOTS.map((ts, idx) => {
    // Generate calculated slot score
    // Afternoon has lower pHome on weekdays usually, evening has higher pHome
    let multiplier = 0.85;
    if (ts.period === "Evening") {
      multiplier = 1.3;
    } else if (ts.period === "Morning") {
      multiplier = 0.95;
    }
    let slotProb = pHomeBase * multiplier * (0.8 + seedRandom(i + idx * 88) * 0.4);
    slotProb = Math.max(0.12, Math.min(0.98, slotProb));
    return {
      slot: ts.slot,
      period: ts.period,
      pHome: parseFloat(slotProb.toFixed(3)),
      recommended: false
    };
  });

  // Highlight max as recommended
  let maxIdx = 0;
  for (let k = 1; k < predictions.length; k++) {
    if (predictions[k].pHome > predictions[maxIdx].pHome) {
      maxIdx = k;
    }
  }
  predictions[maxIdx].recommended = true;

  // Selected schedule slot
  const actualSlotIdx = Math.floor(seedRandom(i + 707) * TIME_SLOTS.length);
  const scheduledSlot = TIME_SLOTS[actualSlotIdx].slot;
  const pHome = predictions[actualSlotIdx].pHome;

  // status based on score
  let status: "confirmed" | "pending" | "flagged" = "pending";
  if (pHome >= 0.72) {
    status = "confirmed";
  } else if (pHome < 0.45) {
    status = "flagged";
  }

  MOCK_DELIVERIES.push({
    id: `DEL-${(1000 + i).toString()}`,
    recipientName: JAPANESE_NAMES[nameIdx],
    district: DISTRICTS[districtIdx],
    address: `Tokyo-to, Koto-ku, ${DISTRICTS[districtIdx].split(" ")[0]} 3-${Math.floor(seedRandom(i + 909) * 20) + 1}-${Math.floor(seedRandom(i + 999) * 12) + 1}`,
    floorType: FLATS[flatIdx],
    pHome,
    coordinates: [lng, lat],
    scheduledSlot,
    status,
    historicalHitRate: SparkValues,
    predictions,
    vehicleId
  });
}

// Group routes sequentially by coordinates for mock TSP
MOCK_VEHICLES.forEach((v) => {
  const assigned = MOCK_DELIVERIES.filter((d) => d.vehicleId === v.id);
  // Sort by longitude to build a clean snake pathway route
  const sorted = [...assigned].sort((a, b) => a.coordinates[0] - b.coordinates[0]);
  v.stopsCount = sorted.length;
  v.averagePHome = parseFloat((sorted.reduce((sum, d) => sum + d.pHome, 0) / sorted.length).toFixed(3));
  
  // Outer hub starter coordinates near Toyosu Station
  const startHub: [number, number] = [139.796, 35.654];
  v.routeCoordinates = [startHub, ...sorted.map((d) => d.coordinates), startHub];
});

// 30 days historic trend
export const MOCK_TREND_DATA = Array.from({ length: 30 }, (_, h) => {
  const dayNum = h + 1;
  const noise1 = Math.sin(dayNum / 2) * 2 + (seedRandom(dayNum * 15.6) - 0.5) * 4;
  const noise2 = Math.cos(dayNum / 3) * 1.5 + (seedRandom(dayNum * 44.2) - 0.5) * 3;
  return {
    day: `Day ${dayNum}`,
    baseline: parseFloat((38.5 + noise1).toFixed(1)),
    takumi: parseFloat((14.2 + noise2).toFixed(1))
  };
});

// WebSocket initial events log seed
export const MOCK_WS_EVENTS: AgentEvent[] = [
  {
    id: "E-101",
    type: "status_update",
    delivery_id: "DEL-1042",
    recipient_name: "鈴木 美咲 (Suzuki Misaki)",
    message: "Analyzing recipient attendance signature. Expected home window shifts to late evening.",
    timestamp: "10:42:01",
    slot_confirmed: false
  },
  {
    id: "E-102",
    type: "incoming_msg",
    delivery_id: "DEL-1111",
    recipient_name: "加藤 裕美 (Kato Yumi)",
    message: "Recipient replied: 'I will be home after 7 PM today. Please adjust.'",
    timestamp: "10:44:15"
  },
  {
    id: "E-103",
    type: "slot_confirmed",
    delivery_id: "DEL-1111",
    recipient_name: "加藤 裕美 (Kato Yumi)",
    message: "AI Agent successfully scheduled delivery window for 18:00-20:00 (p_home: 0.95).",
    timestamp: "10:44:48",
    slot_confirmed: true
  },
  {
    id: "E-104",
    type: "reoptimize",
    delivery_id: "DEL-1111",
    recipient_name: "加藤 裕美 (Kato Yumi)",
    message: "Re-optimization triggered for route V02. Driver hours decreased by 42 mins.",
    timestamp: "10:45:00",
    reoptimize_triggered: true
  },
  {
    id: "E-105",
    type: "status_update",
    delivery_id: "DEL-1019",
    recipient_name: "渡辺 恵子 (Watanabe Keiko)",
    message: "Historical logs indicate high weekend home rate. Adjusting probability score.",
    timestamp: "10:52:12"
  },
  {
    id: "E-106",
    type: "incoming_msg",
    delivery_id: "DEL-1088",
    recipient_name: "山田 優 (Yamada Yu)",
    message: "Recipient replied: 'Leave in the delivery box if I am absent.' Registered flag.",
    timestamp: "10:55:04"
  },
  {
    id: "E-107",
    type: "status_update",
    delivery_id: "DEL-1088",
    recipient_name: "山田 優 (Yamada Yu)",
    message: "Delivery box drop-off confirmed by recipient (p_home: 1.00).",
    timestamp: "10:55:20"
  },
  {
    id: "E-108",
    type: "reoptimize",
    delivery_id: "DEL-1088",
    recipient_name: "山田 優 (Yamada Yu)",
    message: "Dynamic rerouting applied. Stop DEL-1088 prioritized during route V05.",
    timestamp: "10:55:30",
    reoptimize_triggered: true
  }
];

// Agent chat logs by delivery ID
export const MOCK_AGENT_CHAT_THREADS: Record<string, { sender: "agent" | "recipient" | "system", message: string, timestamp: string }[]> = {
  "DEL-1111": [
    { sender: "system", message: "TakumiRoute automated outreach initialized. Estimated absenty risk high (p_home: 0.32).", timestamp: "10:42:15" },
    { sender: "agent", message: "Hello! This is TakumiRoute Logistics. We have a parcel scheduled for you today. Will you be available today afternoon?", timestamp: "10:43:00" },
    { sender: "recipient", message: "No, I'm out at work. I will be home after 7 PM today. Please adjust.", timestamp: "10:44:15" },
    { sender: "agent", message: "Excellent. I will reschedule your slot to 18:00 - 20:00. This is highly recommended to guarantee on-time arrival. Sound good?", timestamp: "10:44:30" },
    { sender: "recipient", message: "Yes, that works! Thank you.", timestamp: "10:44:45" },
    { sender: "system", message: "RESCHEDULED: reslot to 18:00 - 20:00 (p_home: 0.95). Triggering baseline solver...", timestamp: "10:44:48" },
    { sender: "system", message: "RE-OPTIMIZATION TRIGGERED: Route V02 rearranged stop sequences.", timestamp: "10:45:00" }
  ]
};

// Seed for other deliveries
MOCK_DELIVERIES.forEach((d) => {
  if (!MOCK_AGENT_CHAT_THREADS[d.id]) {
    MOCK_AGENT_CHAT_THREADS[d.id] = [
      { sender: "system", message: `System verification initialized for ${d.recipientName}.`, timestamp: "08:15:00" },
      { sender: "agent", message: `Hi there! Responding to your delivery scheduled during slot: ${d.scheduledSlot}. Do you confirm attendance during this time?`, timestamp: "08:15:30" },
      { sender: "recipient", message: d.status === "confirmed" ? "Yes, I will be home!" : "Unsure, might go shopping.", timestamp: "08:18:22" },
      { sender: "system", message: `Current verification outcome set status to ${d.status.toUpperCase()} (p_home: ${d.pHome})`, timestamp: "08:19:00" }
    ];
  }
});

// ML Health metrics
export const MOCK_ML_HEALTH: MLHealthData = {
  driftError: 0.024,
  driftThreshold: 0.05,
  calibrationCurve: [
    { name: "0-10%", perfect: 5, model: 6.2 },
    { name: "10-20%", perfect: 15, model: 14.8 },
    { name: "20-30%", perfect: 25, model: 24.1 },
    { name: "30-40%", perfect: 35, model: 32.7 },
    { name: "40-50%", perfect: 45, model: 44.9 },
    { name: "50-60%", perfect: 55, model: 56.1 },
    { name: "60-70%", perfect: 65, model: 63.8 },
    { name: "70-80%", perfect: 75, model: 76.5 },
    { name: "80-90%", perfect: 85, model: 88.2 },
    { name: "90-100%", perfect: 95, model: 94.6 }
  ],
  featureImportance: [
    { name: "Recipient Historical Attendance Index", importance: 0.38 },
    { name: "Floor and Building Elevation Type", importance: 0.18 },
    { name: "Local Weather Status (precipitation)", importance: 0.12 },
    { name: "Auto-Chat Response Tone (LLM embeddings)", importance: 0.09 },
    { name: "Weekday vs. National Holiday Signature", importance: 0.08 },
    { name: "Dynamic Area Lockbox Slot Availability", importance: 0.06 },
    { name: "Current Route Stop Density Scale", importance: 0.04 },
    { name: "Average Delivery Driver Pace Velocity", importance: 0.03 },
    { name: "District Demographics & Age Profile", importance: 0.01 },
    { name: "Vehicle Payload Load Capacity", importance: 0.01 }
  ],
  modelVersions: [
    { version: "v4.2.1-prod", trainedAt: "2026-06-01 02:40", logLoss: 0.314, status: "deployed" },
    { version: "v4.3.0-rc1", trainedAt: "2026-06-12 14:10", logLoss: 0.298, status: "staged" },
    { version: "v4.1.9", trainedAt: "2026-05-15 05:22", logLoss: 0.342, status: "archived" },
    { version: "v4.0.2", trainedAt: "2026-04-10 11:00", logLoss: 0.365, status: "archived" }
  ]
};
