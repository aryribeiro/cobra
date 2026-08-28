'use server';

import { headers } from 'next/headers';
import {
  getTopLeaderboard,
  saveScore,
  isDbConfigured,
  LeaderboardEntry,
  validateScore,
  sanitizeName,
  sanitizeEmoji,
  consumeGameSession,
  countRecentSubmissions,
  logSubmission,
} from '../lib/db';
import { issueGameToken, verifyGameToken, isPlausible, hashIp } from '../lib/anticheat';

const SUBMITS_PER_HOUR_PER_IP = 8;

export interface LeaderboardResponse {
  online: boolean;
  data: LeaderboardEntry[];
}

export interface SubmitScoreResponse extends LeaderboardResponse {
  accepted: boolean;
}

export interface SubmitScorePayload {
  name: string;
  emoji: string;
  score: number;
  itemsEaten: number;
  token: string;
}

export async function fetchLeaderboardAction(): Promise<LeaderboardResponse> {
  if (!isDbConfigured) {
    return { online: false, data: [] };
  }
  const data = await getTopLeaderboard();
  return { online: true, data };
}

// Emitido no início de cada partida; obrigatório para submeter pontuação.
export async function startGameSessionAction(): Promise<{ token: string | null }> {
  if (!isDbConfigured) return { token: null };
  return { token: issueGameToken() };
}

export async function submitScoreAction(payload: SubmitScorePayload): Promise<SubmitScoreResponse> {
  if (!isDbConfigured) {
    return { online: false, accepted: false, data: [] };
  }

  // Fail-closed sem oráculo: toda rejeição responde igual, sem revelar qual checagem falhou
  const reject = async (reason: string): Promise<SubmitScoreResponse> => {
    console.warn(`[anticheat] submissão rejeitada: ${reason}`);
    return { online: true, accepted: false, data: await getTopLeaderboard() };
  };

  if (!payload || typeof payload !== 'object') return reject('payload inválido');
  const { name, emoji, score, itemsEaten, token } = payload;

  const validScore = validateScore(score);
  if (validScore === null) return reject('score fora dos limites');

  const session = typeof token === 'string' ? verifyGameToken(token) : null;
  if (!session) return reject('token ausente/inválido');

  const elapsedMs = Date.now() - session.startedAt;
  if (!isPlausible(validScore, itemsEaten, elapsedMs)) return reject('pontuação implausível');

  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = hashIp(ip);
  if ((await countRecentSubmissions(ipHash)) >= SUBMITS_PER_HOUR_PER_IP) {
    return reject('rate limit por IP');
  }

  // Uso único da sessão: bloqueia replay do token e duplo clique no submit
  if (!(await consumeGameSession(session.sid))) return reject('sessão já utilizada');

  await logSubmission(ipHash);
  const data = await saveScore({
    name: sanitizeName(name),
    emoji: sanitizeEmoji(emoji),
    score: validScore,
  });
  return { online: true, accepted: true, data };
}
