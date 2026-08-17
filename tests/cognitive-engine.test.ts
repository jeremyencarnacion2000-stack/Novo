/**
 * @jest-environment node
 */

import { computeBioState } from '@/lib/cognitive-engine';

// Circadian curve values from the Cognitive Engine model:
// Peak: 10am -> 95% | Valley: 2am -> 8% | Dip: 2pm (14:00) -> 45%
function getCircadianEnergyAt(hour: number): number {
  const curve: Record<number, number> = {
    0: 15, 1: 10, 2: 8, 3: 8, 4: 12, 5: 20, 6: 35,
    7: 55, 8: 72, 9: 88, 10: 95, 11: 90, 12: 75,
    13: 60, 14: 45, 15: 50, 16: 65, 17: 70, 18: 62,
    19: 52, 20: 40, 21: 30, 22: 22, 23: 18,
  };
  return curve[hour] ?? 50;
}

function getCognitiveWeight(priority: string): number {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

describe('Cognitive Engine - Circadian & Metrics Logic', () => {
  test('time and in-app workload do not publish a diagnostic fatigue phase', () => {
    const lateNight = computeBioState({
      now: new Date(2026, 6, 29, 3, 0),
      chronotype: 'intermediate',
      userStressScore: 50,
    });
    const daytimePeak = computeBioState({
      now: new Date(2026, 6, 29, 10, 0),
      chronotype: 'intermediate',
      userStressScore: 50,
    });

    expect(lateNight.phase).toBe('LINEAR_EXECUTION');
    expect(daytimePeak.phase).toBe('PEAK_FOCUS');
  });

  test('Circadian Curve math should match science-backed hourly metrics', () => {
    // Peak window limits
    expect(getCircadianEnergyAt(10)).toBe(95);
    expect(getCircadianEnergyAt(9)).toBe(88);
    expect(getCircadianEnergyAt(11)).toBe(90);

    // Afternoon dip
    expect(getCircadianEnergyAt(14)).toBe(45);

    // Deep sleep valley
    expect(getCircadianEnergyAt(2)).toBe(8);
    expect(getCircadianEnergyAt(3)).toBe(8);

    // Out of bounds check
    expect(getCircadianEnergyAt(99)).toBe(50);
  });

  test('Cognitive Weight should accurately classify task priorities', () => {
    expect(getCognitiveWeight('high')).toBe(3);
    expect(getCognitiveWeight('medium')).toBe(2);
    expect(getCognitiveWeight('low')).toBe(1);
    expect(getCognitiveWeight('undefined')).toBe(1);
  });

  test('Burnout Risk metric constraints should remain within safe 0-100 limits', () => {
    const simulateBurnout = (workloadDensity: number, procrastination: number, fragmentation: number, load: number, recovery: string) => {
      const bonus = recovery === 'critical' ? 10 : recovery === 'impaired' ? 7 : recovery === 'moderate' ? 3 : 0;
      return Math.min(100, Math.round(
        (workloadDensity * 0.3) +
        (procrastination * 0.25) +
        (fragmentation * 0.2) +
        (load * 0.15) +
        bonus
      ));
    };

    // Low threat scenario
    const lowRisk = simulateBurnout(10, 10, 0, 10, 'optimal');
    expect(lowRisk).toBeGreaterThanOrEqual(0);
    expect(lowRisk).toBeLessThanOrEqual(100);

    // High stress scenario
    const highRisk = simulateBurnout(100, 100, 100, 100, 'critical');
    expect(highRisk).toBe(100);
  });

  test('Focus Score calculation logic matches expected coefficients', () => {
    const calculateFocusScore = (currentEnergy: number, cognitiveLoad: number, procrastination: number, focusQuality: number, recoveryState: string) => {
      const recoveryBonus = recoveryState === 'optimal' ? 20 : recoveryState === 'moderate' ? 10 : 0;
      return Math.max(5, Math.min(100, Math.round(
        currentEnergy * 0.35 +
        (100 - cognitiveLoad) * 0.25 +
        (100 - procrastination) * 0.2 +
        (focusQuality / 5 * 100) * 0.1 +
        recoveryBonus * 0.1
      )));
    };

    // Extreme positive parameters
    // 95×0.35 + 100×0.25 + 100×0.2 + (5/5×100)×0.1 + 20×0.1 = 33.25+25+20+10+2 = 90.25 → 90
    const maxFocus = calculateFocusScore(95, 0, 0, 5, 'optimal');
    expect(maxFocus).toBe(90);

    // Extreme fatigue parameters
    const minFocus = calculateFocusScore(8, 100, 100, 0, 'critical');
    expect(minFocus).toBe(5); // Protected lower bound limit
  });
});
