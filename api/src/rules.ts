// All XP / level / streak rules live here, as pure functions.
// See docs/RULES.md for the recording lines that justify each rule.

import { dayNumber } from "./time.js";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const FULL_XP: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 50 };

const BONUS_PER_STREAK_DAY = 2;
const MAX_DAILY_BONUS = 14;
const XP_PER_LEVEL_STEP = 100;

/** XP a completion is worth. A late one-off quest earns half, rounded down. */
export function baseXp(difficulty: Difficulty, isLate: boolean): number {
  const full = FULL_XP[difficulty];
  return isLate ? Math.floor(full / 2) : full;
}

/** Bonus of a day whose streak (run of consecutive days ending on it) is `streakLength`. */
export function dailyBonus(streakLength: number): number {
  return Math.min(streakLength * BONUS_PER_STREAK_DAY, MAX_DAILY_BONUS);
}

export interface LevelProgress {
  level: number;
  xp_into_level: number;
  xp_to_next_level: number;
}

/** Level n spans 100 * n XP: 0-99, 100-299, 300-599, 600-999, ... */
export function levelFor(xp: number): LevelProgress {
  let level = 1;
  let levelStart = 0;
  while (xp >= levelStart + XP_PER_LEVEL_STEP * level) {
    levelStart += XP_PER_LEVEL_STEP * level;
    level++;
  }
  const levelEnd = levelStart + XP_PER_LEVEL_STEP * level;
  return { level, xp_into_level: xp - levelStart, xp_to_next_level: levelEnd - xp };
}

/** The sum of `base_xp` of all active completions made on one local day. */
export interface DayTotal {
  day: string;
  baseXp: number;
}

/**
 * Total XP and current streak, always recomputed from the active completions.
 * Recomputing (instead of patching) is what makes undo correct: removing a
 * completion can change the bonus of later days.
 *
 * @param days  one entry per day with at least one completion, ascending
 * @param today the user's current local day
 */
export function computeProgress(days: DayTotal[], today: string): { xp: number; streak: number } {
  let xp = 0;
  let run = 0;
  let previousDay: number | null = null;

  for (const { day, baseXp: dayXp } of days) {
    const current = dayNumber(day);
    run = previousDay !== null && current === previousDay + 1 ? run + 1 : 1;
    xp += dayXp + dailyBonus(run);
    previousDay = current;
  }

  // The run is still alive if its last day is today or yesterday.
  const isAlive = previousDay !== null && dayNumber(today) - previousDay <= 1;
  return { xp, streak: isAlive ? run : 0 };
}
