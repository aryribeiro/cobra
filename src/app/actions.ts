'use server';

import {
  getTopLeaderboard,
  saveScoreToTurso,
  isTursoConfigured,
  LeaderboardEntry,
  validateScore,
  sanitizeName,
  sanitizeEmoji,
} from '../lib/turso';

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

  // DevSecOps: Validação de segurança no Server Action
  const validScore = validateScore(score);
  if (validScore === null) {
    console.warn(`[DevSecOps] Server Action rejeitou score inválido: ${score}`);
    const data = await getTopLeaderboard();
    return { isTurso: true, data };
  }

  const cleanName = sanitizeName(name);
  const cleanEmoji = sanitizeEmoji(emoji);

  const data = await saveScoreToTurso({ name: cleanName, emoji: cleanEmoji, score: validScore });
  return { isTurso: true, data };
}

