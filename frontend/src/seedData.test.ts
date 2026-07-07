import { describe, expect, it } from 'vitest';
import {
  districtFor,
  floorTypeFor,
  hashString,
  predictionsFor,
  recipientNameFor,
  slotLabel,
  sparklineFor,
} from './seedData';
import { getPHomeColor } from './utils';
import type { RouteStopDetail } from './api/client';

describe('seedData derivations', () => {
  it('hashString is deterministic and non-negative', () => {
    expect(hashString('stop-a')).toBe(hashString('stop-a'));
    expect(hashString('stop-a')).not.toBe(hashString('stop-b'));
    expect(hashString('stop-a')).toBeGreaterThanOrEqual(0);
  });

  it('recipient persona is stable per stop id', () => {
    const id = 'f2c1a6de-1234-4abc-9def-000000000001';
    expect(recipientNameFor(id)).toBe(recipientNameFor(id));
  });

  it('districtFor labels a Toyosu-side coordinate sensibly', () => {
    expect(districtFor(139.796, 35.655)).toContain('Toyosu');
  });

  it('floorTypeFor maps housing profiles', () => {
    expect(floorTypeFor('house', null)).toBe('Detached House');
    expect(floorTypeFor('apartment', 10)).toBe('Elevator Apt (High-rise)');
    expect(floorTypeFor('apartment', 2)).toBe('Stairs Apt (Low-rise)');
  });

  it('sparklineFor returns 30 bounded points centered near pHome', () => {
    const spark = sparklineFor('stop-x', 0.7);
    expect(spark).toHaveLength(30);
    for (const v of spark) {
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(98);
    }
  });

  it('predictionsFor marks the argmax slot recommended', () => {
    const stop: RouteStopDetail = {
      stop_id: 's1',
      latitude: 35.66,
      longitude: 139.81,
      sequence: 0,
      arrival_min: 30,
      assigned_slot: 'am',
      predicted_prob: 0.4,
      outcome: 'success',
      address: '東京都江東区1丁目1-1',
      address_type: 'apartment',
      floor: 3,
      slot_probs: { am: 0.3, t1214: 0.25, t1416: 0.28, t1618: 0.45, t1821: 0.72 },
    };
    const predictions = predictionsFor(stop);
    expect(predictions).toHaveLength(5);
    const recommended = predictions.filter((p) => p.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].slotCode).toBe('t1821');
    expect(recommended[0].period).toBe('Evening');
  });

  it('slotLabel maps backend codes to courier windows', () => {
    expect(slotLabel('t1821')).toBe('18:00 - 21:00');
    expect(slotLabel('unknown-code')).toBe('unknown-code');
  });
});

describe('p_home color dialect', () => {
  it('uses vermilion/amber/mint thresholds', () => {
    expect(getPHomeColor(0.2)).toBe('#E8442A');
    expect(getPHomeColor(0.6)).toBe('#F5A623');
    expect(getPHomeColor(0.9)).toBe('#00C896');
  });
});
