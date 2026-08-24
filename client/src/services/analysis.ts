/**
 * Training Analysis Engine
 *
 * Rule-based analysis grounded in exercise science principles:
 *
 * 1. Progressive Overload (Kraemer & Ratamess, 2004; Schoenfeld 2010):
 *    Systematic increase in training stimulus is required for continued adaptation.
 *    Stagnation in load/volume over 3+ weeks indicates need for program adjustment.
 *
 * 2. Training Frequency (Schoenfeld et al., 2016 meta-analysis):
 *    Minimum 2x/week per muscle group for hypertrophy. Overall frequency of
 *    3-5 sessions/week is optimal for most trainees.
 *
 * 3. Volume Landmarks (Israetel, Scientific Principles of Hypertrophy Training):
 *    - MV (Maintenance Volume): ~6 sets/muscle/week
 *    - MEV (Minimum Effective Volume): ~8-10 sets/muscle/week
 *    - MAV (Maximum Adaptive Volume): 12-20 sets/muscle/week
 *    - MRV (Maximum Recoverable Volume): individual, typically >20 sets/muscle/week
 *
 * 4. Deload Principle (Pritchard et al., 2015):
 *    Planned reductions in volume/intensity every 4-8 weeks prevent overreaching.
 *    Regression in performance signals accumulated fatigue requiring deload.
 *
 * 5. Rate of Progression (NSCA Guidelines):
 *    Beginners: 5-10% load increase when target reps achieved
 *    Intermediate: 2-5% increase
 *    Advanced: 1-2% increase or periodized progression
 *
 * 6. Completion Rate & RPE (Helms et al., 2016):
 *    Consistently failing to complete prescribed sets indicates excessive intensity
 *    or insufficient recovery. Target completion >85% of planned volume.
 *
 * 7. Training Consistency (Dankel et al., 2017):
 *    Adherence is the strongest predictor of progress. Irregular training
 *    (>50% deviation from plan) undermines all other variables.
 */

import type { DbProgram, DbMeasurement } from '@/db';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsightType =
  | 'stagnation'
  | 'regression'
  | 'frequency'
  | 'volume'
  | 'body_composition'
  | 'completion'
  | 'progress'
  | 'consistency'
  | 'overreaching';

export type InsightSeverity = 'success' | 'info' | 'warning' | 'critical';

export interface Insight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  advice: string;
  exercise?: string;
  data?: Record<string, any>;
}

export interface ExerciseProgressItem {
  name: string;
  trend: 'up' | 'flat' | 'down';
  /** Best working weight per session over time */
  weightHistory: { date: string; weight: number; reps: number }[];
  /** Total volume (weight × reps × sets) per session */
  volumeHistory: { date: string; volume: number }[];
  /** Percentage change in max weight (first vs last) */
  weightChangePercent: number;
  /** Percentage change in volume (first vs last) */
  volumeChangePercent: number;
}

export interface AnalysisResult {
  generatedAt: string;
  period: { from: string; to: string };
  insights: Insight[];
  exerciseProgress: ExerciseProgressItem[];
  summary: {
    totalSessions: number;
    totalWeeks: number;
    avgFrequency: number;
    avgCompletionRate: number;
    exercisesAnalyzed: number;
    bestProgress: string | null;
    needsAttention: string | null;
  };
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface SessionData {
  date: string;
  programName: string;
  dayName: string;
  durationSeconds: number | null;
  exercises: {
    name: string;
    sets: { weight: number | null; reps: number; count: number; done: boolean }[];
  }[];
}

interface ExerciseSession {
  date: string;
  maxWeight: number;
  totalVolume: number;
  totalSets: number;
  completedSets: number;
  avgReps: number;
}

// ─── Constants (evidence-based thresholds) ───────────────────────────────────

/** Weeks with no load increase to flag stagnation (Kraemer & Ratamess, 2004) */
const STAGNATION_WEEKS_THRESHOLD = 3;

/** Minimum weight change (%) to be considered progression */
const MIN_MEANINGFUL_CHANGE_PERCENT = 2.5;

/** Target training frequency per week (Schoenfeld et al., 2016) */
const MIN_FREQUENCY_PER_WEEK = 2;
const OPTIMAL_FREQUENCY_PER_WEEK = 3;

/** Completion rate below this is problematic (Helms et al., 2016) */
const MIN_COMPLETION_RATE = 0.85;

/** Weight regression threshold to flag overreaching (Pritchard et al., 2015) */
const REGRESSION_THRESHOLD_PERCENT = -5;

/** Minimum sessions for an exercise to be analyzed meaningfully */
const MIN_EXERCISE_SESSIONS = 3;

/** Minimum total sessions to generate any analysis */
const MIN_TOTAL_SESSIONS = 4;

// ─── Main analysis function ──────────────────────────────────────────────────

export function analyzeTraining(
  programs: DbProgram[],
  measurements: DbMeasurement[],
): AnalysisResult {
  const now = new Date().toISOString();

  // Extract completed sessions from all programs
  const sessions = extractSessions(programs);

  if (sessions.length < MIN_TOTAL_SESSIONS) {
    return {
      generatedAt: now,
      period: { from: '', to: '' },
      insights: [
        {
          type: 'info' as any,
          severity: 'info',
          title: 'Недостатньо даних',
          description: `Потрібно мінімум ${MIN_TOTAL_SESSIONS} завершених тренувань для аналізу. Зараз: ${sessions.length}.`,
          advice: 'Продовжуйте тренуватися і повертайтеся після кількох тижнів роботи за програмою.',
        },
      ],
      exerciseProgress: [],
      summary: {
        totalSessions: sessions.length,
        totalWeeks: 0,
        avgFrequency: 0,
        avgCompletionRate: 0,
        exercisesAnalyzed: 0,
        bestProgress: null,
        needsAttention: null,
      },
    };
  }

  // Sort sessions chronologically
  sessions.sort((a, b) => a.date.localeCompare(b.date));

  const from = sessions[0].date;
  const to = sessions[sessions.length - 1].date;
  const totalWeeks = Math.max(
    1,
    Math.ceil(
      (new Date(to).getTime() - new Date(from).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ),
  );

  // Group exercises across all sessions
  const exerciseMap = buildExerciseMap(sessions);

  // Run all analysis rules
  const insights: Insight[] = [];

  // 1. Frequency analysis
  insights.push(...analyzeFrequency(sessions, totalWeeks));

  // 2. Per-exercise analysis (stagnation, regression, progress)
  const exerciseProgress: ExerciseProgressItem[] = [];
  for (const [name, exSessions] of exerciseMap.entries()) {
    if (exSessions.length < MIN_EXERCISE_SESSIONS) continue;

    const progress = buildExerciseProgress(name, exSessions);
    exerciseProgress.push(progress);

    insights.push(...analyzeExerciseProgression(name, exSessions, progress));
  }

  // 3. Completion rate analysis
  insights.push(...analyzeCompletionRate(sessions));

  // 4. Body composition correlation
  insights.push(
    ...analyzeBodyComposition(measurements, exerciseProgress, sessions),
  );

  // 5. Consistency analysis
  insights.push(...analyzeConsistency(sessions, totalWeeks));

  // 6. Overreaching detection
  insights.push(...analyzeOverreaching(exerciseMap));

  // Sort: critical first, then warning, info, success
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Summary
  const avgCompletion = calculateOverallCompletionRate(sessions);
  const bestEx = exerciseProgress.reduce(
    (best, ep) =>
      ep.weightChangePercent > (best?.weightChangePercent ?? -Infinity)
        ? ep
        : best,
    null as ExerciseProgressItem | null,
  );
  const worstEx = exerciseProgress.reduce(
    (worst, ep) =>
      ep.weightChangePercent < (worst?.weightChangePercent ?? Infinity)
        ? ep
        : worst,
    null as ExerciseProgressItem | null,
  );

  return {
    generatedAt: now,
    period: { from, to },
    insights,
    exerciseProgress: exerciseProgress.sort(
      (a, b) => a.weightChangePercent - b.weightChangePercent,
    ),
    summary: {
      totalSessions: sessions.length,
      totalWeeks,
      avgFrequency: Math.round((sessions.length / totalWeeks) * 10) / 10,
      avgCompletionRate: Math.round(avgCompletion * 100),
      exercisesAnalyzed: exerciseProgress.length,
      bestProgress:
        bestEx && bestEx.weightChangePercent > 0 ? bestEx.name : null,
      needsAttention:
        worstEx && worstEx.weightChangePercent <= 0 ? worstEx.name : null,
    },
  };
}

// ─── Data extraction ─────────────────────────────────────────────────────────

function extractSessions(programs: DbProgram[]): SessionData[] {
  const sessions: SessionData[] = [];

  for (const program of programs) {
    if (!program.days) continue;
    for (const day of program.days) {
      if (!day.completed_at) continue;

      sessions.push({
        date: day.completed_at.split('T')[0],
        programName: program.name,
        dayName: day.name,
        durationSeconds: day.duration_seconds,
        exercises: day.exercises.map((ex) => ({
          name: normalizeExerciseName(ex.name),
          sets: ex.sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            count: s.count,
            done: s.done,
          })),
        })),
      });
    }
  }

  return sessions;
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}

function buildExerciseMap(
  sessions: SessionData[],
): Map<string, ExerciseSession[]> {
  const map = new Map<string, ExerciseSession[]>();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      const allSets = ex.sets;
      if (allSets.length === 0) continue;

      const completedSets = allSets.filter((s) => s.done);
      const setsWithWeight = allSets.filter(
        (s) => s.weight !== null && s.weight > 0,
      );

      // Calculate total sets considering count field (4×10 = 4 sets)
      const totalSetCount = allSets.reduce((sum, s) => sum + s.count, 0);
      const completedSetCount = completedSets.reduce(
        (sum, s) => sum + s.count,
        0,
      );

      const maxWeight = setsWithWeight.length > 0
        ? Math.max(...setsWithWeight.map((s) => s.weight!))
        : 0;

      const totalVolume = setsWithWeight.reduce(
        (sum, s) => sum + (s.weight || 0) * s.reps * s.count,
        0,
      );

      const avgReps = allSets.length > 0
        ? allSets.reduce((sum, s) => sum + s.reps, 0) / allSets.length
        : 0;

      if (!map.has(ex.name)) {
        map.set(ex.name, []);
      }

      map.get(ex.name)!.push({
        date: session.date,
        maxWeight,
        totalVolume,
        totalSets: totalSetCount,
        completedSets: completedSetCount,
        avgReps,
      });
    }
  }

  return map;
}

// ─── Analysis rules ──────────────────────────────────────────────────────────

/**
 * Rule 1: Training Frequency
 * Based on: Schoenfeld et al. (2016) — "Effects of Resistance Training Frequency
 * on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis"
 *
 * Finding: Training frequency of ≥2x/week per muscle group produces superior
 * hypertrophic outcomes compared to 1x/week.
 */
function analyzeFrequency(
  sessions: SessionData[],
  totalWeeks: number,
): Insight[] {
  const insights: Insight[] = [];
  const avgFrequency = sessions.length / totalWeeks;

  if (avgFrequency < MIN_FREQUENCY_PER_WEEK) {
    insights.push({
      type: 'frequency',
      severity: 'warning',
      title: 'Низька частота тренувань',
      description: `Середня частота: ${avgFrequency.toFixed(1)} тренувань/тиждень за ${totalWeeks} тижнів. Мінімум для прогресу — ${MIN_FREQUENCY_PER_WEEK}/тиждень.`,
      advice:
        'Мета-аналіз Schoenfeld (2016) показує: тренування ≥2 рази/тиждень на групу м\'язів дає значно кращий результат для гіпертрофії. Спробуйте збільшити частоту або перейти на full-body програму.',
      data: { avgFrequency: Math.round(avgFrequency * 10) / 10, totalWeeks },
    });
  } else if (avgFrequency >= OPTIMAL_FREQUENCY_PER_WEEK) {
    insights.push({
      type: 'frequency',
      severity: 'success',
      title: 'Хороша частота тренувань',
      description: `${avgFrequency.toFixed(1)} тренувань/тиждень — оптимальний діапазон для прогресу.`,
      advice: 'Тримайте цю частоту. Головне — послідовність.',
      data: { avgFrequency: Math.round(avgFrequency * 10) / 10, totalWeeks },
    });
  }

  return insights;
}

/**
 * Rule 2: Progressive Overload & Stagnation Detection
 * Based on: Kraemer & Ratamess (2004) — "Fundamentals of Resistance Training:
 * Progression and Exercise Prescription"
 *
 * Principle: Progressive overload (systematic increases in load, volume, or
 * density) is the fundamental driver of strength and hypertrophy adaptation.
 * Plateau >3 weeks signals need for variation.
 */
function analyzeExerciseProgression(
  name: string,
  exSessions: ExerciseSession[],
  progress: ExerciseProgressItem,
): Insight[] {
  const insights: Insight[] = [];
  const displayName = capitalize(name);

  // Check for sustained stagnation (same max weight for N+ consecutive sessions)
  const recentSessions = exSessions.slice(-STAGNATION_WEEKS_THRESHOLD);
  const weights = recentSessions.map((s) => s.maxWeight).filter((w) => w > 0);

  if (weights.length >= STAGNATION_WEEKS_THRESHOLD) {
    const allSame = weights.every((w) => Math.abs(w - weights[0]) < 0.5);
    const maxChange =
      weights.length > 1
        ? Math.max(...weights) - Math.min(...weights)
        : 0;
    const isStagnant = allSame || maxChange / weights[0] < 0.02;

    if (isStagnant && progress.weightChangePercent < MIN_MEANINGFUL_CHANGE_PERCENT) {
      insights.push({
        type: 'stagnation',
        severity: 'warning',
        title: `Застій: ${displayName}`,
        description: `Робоча вага не змінюється ${weights.length} тренувань поспіль (${weights[0]} кг). Відсутня прогресивне навантаження.`,
        advice:
          'Варіанти подолання плато:\n• Змініть схему підходів (наприклад, з 4×10 на 5×5 з більшою вагою)\n• Додайте варіацію вправи (інший кут, хват, амплітуда)\n• Застосуйте метод подвійної прогресії: спочатку збільшуйте повторення до верхньої межі, потім додавайте вагу\n• Перевірте відновлення (сон, харчування)',
        exercise: displayName,
        data: {
          currentWeight: weights[0],
          stagnationSessions: weights.length,
        },
      });
    }
  }

  // Positive progress
  if (progress.weightChangePercent >= 5) {
    insights.push({
      type: 'progress',
      severity: 'success',
      title: `Прогрес: ${displayName}`,
      description: `Робоча вага зросла на ${progress.weightChangePercent.toFixed(1)}% за період аналізу.`,
      advice: 'Прогресія йде добре. Продовжуйте поточну стратегію навантаження.',
      exercise: displayName,
      data: { changePercent: progress.weightChangePercent },
    });
  }

  return insights;
}

/**
 * Rule 3: Regression / Overreaching Detection
 * Based on: Pritchard et al. (2015) — "Tapering Practices of New Zealand's
 * Elite Sprint Athletes"; Meeusen et al. (2013) — ECSS position statement
 * on overtraining.
 *
 * Signal: Performance regression (decreased load for same reps/sets) over
 * multiple sessions indicates functional overreaching. Prescription: deload week
 * (40-60% volume reduction for 1 week).
 */
function analyzeOverreaching(
  exerciseMap: Map<string, ExerciseSession[]>,
): Insight[] {
  const insights: Insight[] = [];
  let regressingCount = 0;

  for (const [name, sessions] of exerciseMap.entries()) {
    if (sessions.length < MIN_EXERCISE_SESSIONS) continue;

    const displayName = capitalize(name);
    const recent = sessions.slice(-4);
    const older = sessions.slice(0, Math.max(1, sessions.length - 4));

    if (recent.length < 2 || older.length < 1) continue;

    const recentAvgWeight =
      recent.reduce((s, r) => s + r.maxWeight, 0) / recent.length;
    const olderAvgWeight =
      older.reduce((s, r) => s + r.maxWeight, 0) / older.length;

    if (olderAvgWeight === 0) continue;

    const changePct =
      ((recentAvgWeight - olderAvgWeight) / olderAvgWeight) * 100;

    if (changePct <= REGRESSION_THRESHOLD_PERCENT) {
      regressingCount++;
      insights.push({
        type: 'regression',
        severity: 'critical',
        title: `Регрес: ${displayName}`,
        description: `Робоча вага знизилась на ${Math.abs(changePct).toFixed(1)}% порівняно з попереднім періодом (${olderAvgWeight.toFixed(1)} → ${recentAvgWeight.toFixed(1)} кг).`,
        advice:
          'Регрес сили — ознака накопиченої втоми (функціональне перенавантаження). Рекомендації:\n• Deload тиждень: зменшіть об\'єм на 40-60%, зберігаючи інтенсивність\n• Перевірте якість сну (7-9 годин) та харчування (достатньо білка: 1.6-2.2 г/кг)\n• Після деload поверніться до ваг на 5-10% нижче попереднього максимуму',
        exercise: displayName,
        data: { changePct: Math.round(changePct * 10) / 10 },
      });
    }
  }

  if (regressingCount >= 3) {
    insights.push({
      type: 'overreaching',
      severity: 'critical',
      title: 'Системне перенавантаження',
      description: `Регрес одночасно в ${regressingCount} вправах. Це сигнал загальної перевтоми, а не локальної проблеми.`,
      advice:
        'Рекомендовано повний deload тиждень або навіть 4-5 днів повного відпочинку. Після відновлення перегляньте загальний об\'єм програми — можливо, він перевищує вашу відновлювальну здатність (MRV).',
    });
  }

  return insights;
}

/**
 * Rule 4: Completion Rate
 * Based on: Helms et al. (2016) — "Application of the Repetitions in Reserve-Based
 * Rating of Perceived Exertion Scale for Resistance Training"
 *
 * Rationale: Consistently failing to complete prescribed volume indicates either
 * excessive prescribed intensity (too heavy) or insufficient recovery. Both
 * scenarios impair long-term progress.
 */
function analyzeCompletionRate(sessions: SessionData[]): Insight[] {
  const insights: Insight[] = [];
  const overallRate = calculateOverallCompletionRate(sessions);

  if (overallRate < MIN_COMPLETION_RATE) {
    const pct = Math.round(overallRate * 100);
    insights.push({
      type: 'completion',
      severity: pct < 70 ? 'critical' : 'warning',
      title: 'Низький відсоток виконання',
      description: `Виконуєте ${pct}% запланованих підходів (рекомендовано ≥85%).`,
      advice:
        pct < 70
          ? 'Програма значно перевищує поточний рівень. Зменшіть робочі ваги на 10-15% і поступово нарощуйте. Краще виконати 100% легшої програми, ніж 60% важкої — адаптація потребує достатнього об\'єму.'
          : 'Дещо не дотягуєте до плану. Переконайтеся, що відпочиваєте достатньо між підходами (2-3 хв для базових вправ, 1-2 хв для ізоляції). Або трохи зменшіть вагу в останніх підходах.',
      data: { completionRate: pct },
    });
  } else if (overallRate >= 0.95) {
    // Very high completion might mean weights are too light
    insights.push({
      type: 'completion',
      severity: 'info',
      title: 'Дуже високе виконання',
      description: `Виконуєте ${Math.round(overallRate * 100)}% підходів. Це може означати, що ваги занадто легкі.`,
      advice:
        'Якщо останні підходи даються легко (RPE < 7), спробуйте підвищити вагу на 2.5-5%. Для гіпертрофії ефективний діапазон — RPE 7-9 (1-3 повторення в запасі).',
      data: { completionRate: Math.round(overallRate * 100) },
    });
  }

  return insights;
}

/**
 * Rule 5: Body Composition Correlation
 * Based on: Slater et al. (2019) — "Is an Energy Surplus Required to Maximize
 * Skeletal Muscle Hypertrophy?"; Ribeiro et al. (2022).
 *
 * Key relationships:
 * - Stable body weight + strength stagnation → caloric surplus needed for further gains
 * - Weight increasing + no strength increase → excess fat gain, program issue
 * - Weight decreasing + strength maintained → successful recomposition/cut
 */
function analyzeBodyComposition(
  measurements: DbMeasurement[],
  exerciseProgress: ExerciseProgressItem[],
  sessions: SessionData[],
): Insight[] {
  const insights: Insight[] = [];

  if (measurements.length < 2) return insights;

  // Sort measurements by date
  const sorted = [...measurements]
    .filter((m) => m.weight !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) return insights;

  const firstWeight = sorted[0].weight!;
  const lastWeight = sorted[sorted.length - 1].weight!;
  const weightChange = lastWeight - firstWeight;
  const weightChangePct = (weightChange / firstWeight) * 100;

  // Check if any exercises are progressing
  const hasStrengthProgress = exerciseProgress.some(
    (ep) => ep.weightChangePercent > MIN_MEANINGFUL_CHANGE_PERCENT,
  );
  const hasStagnation = exerciseProgress.some(
    (ep) => Math.abs(ep.weightChangePercent) < MIN_MEANINGFUL_CHANGE_PERCENT,
  );
  const allStagnant = exerciseProgress.length > 0 && exerciseProgress.every(
    (ep) => Math.abs(ep.weightChangePercent) < MIN_MEANINGFUL_CHANGE_PERCENT,
  );

  // Stable body weight + stagnant strength
  if (Math.abs(weightChangePct) < 2 && allStagnant && sessions.length >= 8) {
    insights.push({
      type: 'body_composition',
      severity: 'info',
      title: 'Стабільна вага тіла + застій сили',
      description: `Вага тіла стабільна (${firstWeight} → ${lastWeight} кг), але сила не росте. На певному етапі для подальшого прогресу потрібен профіцит калорій.`,
      advice:
        'Для побудови м\'язової маси потрібен помірний профіцит калорій (+200-300 ккал/день). Збільшіть споживання білка до 1.6-2.2 г/кг маси тіла на день. Контролюйте по обхватах — якщо талія не росте, а плечі/стегна ростуть — все правильно.',
      data: { weightChange, firstWeight, lastWeight },
    });
  }

  // Weight going up but strength not
  if (weightChangePct > 3 && !hasStrengthProgress && sessions.length >= 6) {
    insights.push({
      type: 'body_composition',
      severity: 'warning',
      title: 'Набір ваги без росту сили',
      description: `Вага тіла зросла на ${weightChange.toFixed(1)} кг (+${weightChangePct.toFixed(1)}%), але робочі ваги не прогресують.`,
      advice:
        'Надлишок калорій не конвертується в м\'язову масу. Можливі причини:\n• Програма не забезпечує достатній стимул (мало об\'єму або інтенсивності)\n• Надто великий профіцит (зменшіть до +200 ккал)\n• Недостатньо білка\nПерегляньте програму: чи є прогресія навантаження, чи достатній об\'єм на кожну групу.',
      data: { weightChange, weightChangePct },
    });
  }

  // Weight down but strength maintained = good cut
  if (weightChangePct < -2 && hasStrengthProgress) {
    insights.push({
      type: 'body_composition',
      severity: 'success',
      title: 'Ефективне зниження ваги',
      description: `Вага зменшилась на ${Math.abs(weightChange).toFixed(1)} кг, при цьому сила зростає. Це ідеальний сценарій рекомпозиції.`,
      advice: 'Відмінний результат. Продовжуйте в тому ж режимі. Тримайте білок високим (2.0-2.4 г/кг) для збереження м\'язової маси під час дефіциту.',
      data: { weightChange, weightChangePct },
    });
  }

  return insights;
}

/**
 * Rule 6: Training Consistency
 * Based on: Dankel et al. (2017) — "Frequency: The Overlooked Resistance Training
 * Variable for Inducing Muscle Hypertrophy?"
 *
 * Consistency (adherence to scheduled sessions) is the strongest predictor of
 * long-term training outcomes, surpassing program design variables.
 */
function analyzeConsistency(
  sessions: SessionData[],
  totalWeeks: number,
): Insight[] {
  const insights: Insight[] = [];

  if (totalWeeks < 3) return insights;

  // Calculate weekly distribution
  const weekMap = new Map<string, number>();
  for (const session of sessions) {
    const date = new Date(session.date);
    const weekStart = getWeekStart(date);
    weekMap.set(weekStart, (weekMap.get(weekStart) || 0) + 1);
  }

  const weekCounts = Array.from(weekMap.values());
  if (weekCounts.length < 2) return insights;

  const avg = weekCounts.reduce((s, c) => s + c, 0) / weekCounts.length;
  const variance =
    weekCounts.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / weekCounts.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? stdDev / avg : 0; // Coefficient of variation

  // Weeks with 0 sessions (gaps)
  const weeksWithSessions = weekMap.size;
  const gapWeeks = totalWeeks - weeksWithSessions;
  const gapRatio = gapWeeks / totalWeeks;

  if (cv > 0.5 || gapRatio > 0.3) {
    insights.push({
      type: 'consistency',
      severity: gapRatio > 0.5 ? 'critical' : 'warning',
      title: 'Нерегулярні тренування',
      description: `Значні коливання частоти: від ${Math.min(...weekCounts)} до ${Math.max(...weekCounts)} тренувань/тиждень. ${gapWeeks > 0 ? `Пропущено ${gapWeeks} тижнів повністю.` : ''}`,
      advice:
        'Послідовність — найважливіший фактор прогресу (Dankel et al., 2017). Навіть 2 тренування/тиждень стабільно дадуть більше, ніж 5 тренувань один тиждень і 0 наступного. Спробуйте:\n• Встановіть фіксовані дні тренувань\n• Якщо пропустили — не намагайтеся "надолужити", просто продовжуйте за планом\n• Зменшіть кількість днів, якщо не встигаєте — краще менше, але стабільно',
      data: { cv: Math.round(cv * 100) / 100, gapWeeks, weekCounts },
    });
  }

  return insights;
}

// ─── Helper functions ────────────────────────────────────────────────────────

function buildExerciseProgress(
  name: string,
  sessions: ExerciseSession[],
): ExerciseProgressItem {
  const weightHistory = sessions
    .filter((s) => s.maxWeight > 0)
    .map((s) => ({
      date: s.date,
      weight: s.maxWeight,
      reps: Math.round(s.avgReps),
    }));

  const volumeHistory = sessions
    .filter((s) => s.totalVolume > 0)
    .map((s) => ({ date: s.date, volume: s.totalVolume }));

  let weightChangePercent = 0;
  if (weightHistory.length >= 2) {
    const first = weightHistory[0].weight;
    const last = weightHistory[weightHistory.length - 1].weight;
    weightChangePercent = first > 0 ? ((last - first) / first) * 100 : 0;
  }

  let volumeChangePercent = 0;
  if (volumeHistory.length >= 2) {
    const first = volumeHistory[0].volume;
    const last = volumeHistory[volumeHistory.length - 1].volume;
    volumeChangePercent = first > 0 ? ((last - first) / first) * 100 : 0;
  }

  let trend: 'up' | 'flat' | 'down' = 'flat';
  if (weightChangePercent > MIN_MEANINGFUL_CHANGE_PERCENT) trend = 'up';
  else if (weightChangePercent < -MIN_MEANINGFUL_CHANGE_PERCENT) trend = 'down';

  return {
    name: capitalize(name),
    trend,
    weightHistory,
    volumeHistory,
    weightChangePercent: Math.round(weightChangePercent * 10) / 10,
    volumeChangePercent: Math.round(volumeChangePercent * 10) / 10,
  };
}

function calculateOverallCompletionRate(sessions: SessionData[]): number {
  let totalSets = 0;
  let completedSets = 0;

  for (const session of sessions) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        totalSets += set.count;
        if (set.done) completedSets += set.count;
      }
    }
  }

  return totalSets > 0 ? completedSets / totalSets : 1;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = start of week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
