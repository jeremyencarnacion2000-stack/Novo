export interface CognitiveInsight {
  type: 'recovery' | 'procrastination' | 'cognitive_load' | 'focus_window' | 'pattern';
  severity: 'info' | 'warning' | 'critical';
  headline: string;
  detail: string;
  action?: string;
}

export interface ReorganizedTask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  scheduledHour: number;
  scheduledTime: string;
  reason: string;
}

export interface EnergyPoint {
  hour: number;
  label: string;
  energy: number;
  isCurrent: boolean;
  isPeak: boolean;
  isDip: boolean;
}

export interface CognitiveReport {
  focusScore: number;
  energyLevel: 'high' | 'medium' | 'low' | 'critical';
  recoveryState: 'optimal' | 'moderate' | 'impaired' | 'critical';
  procrastinationAlert: boolean;
  cognitiveLoad: number;
  burnoutRisk: number;
  focusFragmentation: number;
  peakWindowStart: number;
  peakWindowEnd: number;
  reorganizedDay: ReorganizedTask[];
  insights: CognitiveInsight[];
  recommendation: string;
  cognitiveMemory: string;
}

export interface CognitiveSignals {
  focusScore: number;
  currentHour: number;
  currentEnergy: number;
  energyTimeline: EnergyPoint[];
  cognitiveLoad: number;
  procrastinationScore: number;
  burnoutRisk: number;
  focusFragmentation: number;
  workloadDensity: number;
  recoveryState: string;
  totalFocusMinutesToday: number;
  overdueTasks: number;
  pendingTasks: number;
  completionRate: number;
  todayTaskCount: number;
}

export interface CognitiveEngineResponse {
  success: boolean;
  report: CognitiveReport;
  signals: CognitiveSignals;
  generatedAt: string;
  // Which provider actually generated this report — 'gemini' | 'groq' |
  // 'local-fallback' — replaces a static "Powered by Gemini" footer claim.
  modelUsed?: string | null;
  // The twin's real, currently-learned confidence/trust (process-twin-signal.ts),
  // not derived from this engine — surfaced so /cognitive can show it.
  twin?: { confidenceScore: number; trustLevel: string } | null;
}
