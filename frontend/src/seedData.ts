/**
 * Presentation constants + deterministic derivation helpers.
 *
 * The backend supplies real geometry, probabilities, slots, addresses and
 * outcomes. What it deliberately does not hold is recipient PII — so display
 * names (and the 30-day sparkline, which the API does not expose per stop)
 * are derived deterministically from the stop UUID. The same stop always
 * renders the same persona.
 */

import { RouteStopDetail } from './api/client';

// Tokyo Kōtō-ku center point coordinate reference
export const KOTO_CENTER_LNG = 139.812;
export const KOTO_CENTER_LAT = 35.664;

export const VEHICLE_COLORS = [
  '#E8442A',
  '#4A9EFF',
  '#00C896',
  '#F5A623',
  '#AC73E6',
  '#FF5E7E',
  '#00E5FF',
  '#FFD54F',
];

export const DRIVER_NAMES = [
  'K. Saito (斎藤 健)',
  'M. Tanaka (田中 雅人)',
  'T. Abe (阿部 智)',
  'Y. Goto (後藤 康弘)',
  'S. Mori (森 慎太郎)',
  'H. Suzuki (鈴木 博)',
  'N. Maeda (前田 直人)',
  'R. Nakano (中野 竜)',
  'A. Fujii (藤井 彩)',
  'J. Hara (原 潤)',
  'D. Kubo (久保 大輔)',
  'E. Shibata (柴田 恵)',
  'O. Miura (三浦 修)',
  'W. Ogawa (小川 渉)',
  'F. Kondo (近藤 文)',
  'G. Ishii (石井 豪)',
  'B. Takeda (武田 勉)',
  'C. Nomura (野村 千)',
  'I. Sakai (酒井 育)',
  'L. Hirata (平田 玲)',
];

export const JAPANESE_NAMES = [
  '佐藤 健一 (Sato Kenichi)',
  '鈴木 美咲 (Suzuki Misaki)',
  '高橋 洋介 (Takahashi Yosuke)',
  '田中 麻衣 (Tanaka Mai)',
  '伊藤 誠 (Ito Makoto)',
  '渡辺 恵子 (Watanabe Keiko)',
  '山本 翼 (Yamamoto Tsubasa)',
  '中村 奈々 (Nakamura Nana)',
  '小林 拓也 (Kobayashi Takuya)',
  '加藤 裕美 (Kato Yumi)',
  '吉田 剛 (Yoshida Tsuyoshi)',
  '山田 優 (Yamada Yu)',
  '佐々木 遥 (Sasaki Haruka)',
  '山口 健 (Yamaguchi Ken)',
  '松本 沙織 (Matsumoto Saori)',
  '井上 修 (Inoue Osamu)',
  '木村 綾 (Kimura Aya)',
  '林 浩二 (Hayashi Koji)',
  '斎藤 萌 (Saito Moe)',
  '清水 翔太 (Shimizu Shota)',
];

// Rough district centroids inside the Kōtō-ku generation bounding box, used
// to label each real coordinate with its nearest neighborhood.
export const DISTRICTS: { name: string; lng: number; lat: number }[] = [
  { name: 'Toyosu (豊洲)', lng: 139.796, lat: 35.655 },
  { name: 'Ariake (有明)', lng: 139.794, lat: 35.636 },
  { name: 'Shinonome (東雲)', lng: 139.803, lat: 35.645 },
  { name: 'Tatsumi (辰巳)', lng: 139.81, lat: 35.645 },
  { name: 'Kiba (木場)', lng: 139.806, lat: 35.669 },
  { name: 'Monzen-nakacho (門前仲町)', lng: 139.796, lat: 35.671 },
  { name: 'Kiyosumi (清澄)', lng: 139.799, lat: 35.681 },
  { name: 'Kameido (亀戸)', lng: 139.827, lat: 35.691 },
  { name: 'Ojima (大島)', lng: 139.826, lat: 35.684 },
  { name: 'Sunamachi (砂町)', lng: 139.822, lat: 35.67 },
];

// Backend SlotCode → display metadata (Japanese courier standard windows).
export const SLOT_LABELS: Record<string, string> = {
  am: '08:00 - 12:00',
  t1214: '12:00 - 14:00',
  t1416: '14:00 - 16:00',
  t1618: '16:00 - 18:00',
  t1821: '18:00 - 21:00',
};

export const SLOT_PERIODS: Record<string, 'Morning' | 'Afternoon' | 'Evening'> = {
  am: 'Morning',
  t1214: 'Afternoon',
  t1416: 'Afternoon',
  t1618: 'Afternoon',
  t1821: 'Evening',
};

export const SLOT_ORDER = ['am', 't1214', 't1416', 't1618', 't1821'];

export function slotLabel(code: string): string {
  return SLOT_LABELS[code] ?? code;
}

// ── Deterministic derivation helpers ─────────────────────────────────

/** FNV-1a string hash — stable across sessions for UUID-keyed personas. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function recipientNameFor(stopId: string): string {
  return JAPANESE_NAMES[hashString(stopId) % JAPANESE_NAMES.length];
}

export function districtFor(lng: number, lat: number): string {
  let best = DISTRICTS[0];
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = (d.lng - lng) ** 2 + (d.lat - lat) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best.name;
}

export function floorTypeFor(addressType: string, floor: number | null): string {
  if (addressType === 'house' || floor === null) return 'Detached House';
  if (floor >= 6) return 'Elevator Apt (High-rise)';
  return 'Stairs Apt (Low-rise)';
}

/**
 * 30-day historical hit-rate sparkline centered on the stop's real overall
 * home probability, with deterministic per-stop noise.
 */
export function sparklineFor(stopId: string, pHome: number): number[] {
  const rand = seededRandom(hashString(stopId));
  const values: number[] = [];
  for (let i = 0; i < 30; i++) {
    const noise = (rand() - 0.5) * 0.3;
    values.push(Math.round(Math.min(0.98, Math.max(0.05, pHome + noise)) * 100));
  }
  return values;
}

/** Build the per-slot prediction panel from the backend's real slot_probs. */
export function predictionsFor(stop: RouteStopDetail) {
  const entries = SLOT_ORDER.filter((code) => code in stop.slot_probs);
  const bestCode = entries.reduce(
    (best, code) => (stop.slot_probs[code] > (stop.slot_probs[best] ?? -1) ? code : best),
    entries[0] ?? 'am',
  );
  return entries.map((code) => ({
    slot: slotLabel(code),
    slotCode: code,
    period: SLOT_PERIODS[code] ?? 'Afternoon',
    pHome: stop.slot_probs[code],
    recommended: code === bestCode,
  }));
}

/**
 * Fallback 30-day comparison trend shown before the first Monte-Carlo run.
 * Clearly labeled as projected in the UI; replaced by real per-run rates
 * once a simulation has produced them.
 */
export function projectedTrend(): { day: string; baseline: number; takumi: number }[] {
  const rand = seededRandom(20260614);
  return Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    baseline: parseFloat((38.5 + Math.sin((i + 1) / 2) * 2 + (rand() - 0.5) * 4).toFixed(1)),
    takumi: parseFloat((14.2 + Math.cos((i + 1) / 3) * 1.5 + (rand() - 0.5) * 3).toFixed(1)),
  }));
}
