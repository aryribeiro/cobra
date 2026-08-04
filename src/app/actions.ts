'use server';

import { getTopLeaderboard, saveScoreToTurso, isTursoConfigured, LeaderboardEntry } from '../lib/turso';

export async function fetchLeaderboardAction(): Promise<{ isTurso: boolean; data: LeaderboardEntry[] }> {
  if (!isTursoConfigured) {
    return { isTurso: false, data: [] };
  }
  const data = await getTopLeaderboard();
  return { isTurso: true, data };
}

export async function submitScoreAction(
  name: string,
  emoji: string,
  score: number
): Promise<{ isTurso: boolean; data: LeaderboardEntry[] }> {
  if (!isTursoConfigured) {
    return { isTurso: false, data: [] };
  }
  const data = await saveScoreToTurso({ name, emoji, score });
  return { isTurso: true, data };
}
