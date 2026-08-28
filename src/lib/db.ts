import { createClient } from '@libsql/client';
import { AVATAR_EMOJIS } from './avatars';

export interface LeaderboardEntry {
  id?: number;
  name: string;
  emoji: string;
  score: number;
  created_at?: string;
}

const url = process.env.DB_URL || '';
const authToken = process.env.DB_AUTH_TOKEN || '';

export const isDbConfigured = Boolean(url && authToken);

export const dbClient = isDbConfigured ? createClient({ url, authToken }) : null;

// Schema criado uma única vez por instância (promise cacheada — sem custo por request)
let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!dbClient) return Promise.resolve();
  if (!schemaReady) {
    const client = dbClient;
    schemaReady = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          emoji TEXT NOT NULL,
          score INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS score_sessions (
          sid TEXT PRIMARY KEY,
          used_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS submit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ip_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.execute(
        `CREATE INDEX IF NOT EXISTS idx_submit_log_ip ON submit_log (ip_hash, created_at);`
      );
      // Índice cobrindo o ORDER BY score DESC, id DESC do Top 10
      await client.execute(
        `CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (score DESC, id DESC);`
      );
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// Retry com backoff exponencial + jitter para erros transitórios de rede.
// Erros de credencial/constraint não são transitórios: não faz sentido repetir.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message || err).toLowerCase();
      const transient =
        msg.includes('timeout') || msg.includes('network') || msg.includes('econn') ||
        msg.includes('fetch') || msg.includes('stream') || msg.includes('503') || msg.includes('502');
      if (!transient || i === attempts - 1) throw err;
      const backoff = 120 * 2 ** i + Math.random() * 100; // 120/240/480ms + jitter
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

export const MAX_SCORE_LIMIT = 500000;
const VALID_EMOJIS = new Set(AVATAR_EMOJIS.map((a) => a.emoji));

export function sanitizeName(name: string): string {
  if (typeof name !== 'string') return 'Snake Master';
  const clean = name
    .replace(/<[^>]*>?/gm, '')
    .replace(/[^\p{L}\p{N} _.\-]/gu, '') // allowlist: letras, números, espaço, _ . -
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
  return clean || 'Snake Master';
}

export function sanitizeEmoji(emoji: string): string {
  if (typeof emoji !== 'string') return '🐍';
  return VALID_EMOJIS.has(emoji) ? emoji : '🐍';
}

export function validateScore(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score)) {
    return null;
  }
  const intScore = Math.floor(score);
  if (intScore < 0 || intScore > MAX_SCORE_LIMIT) {
    return null;
  }
  return intScore;
}

// Cache em memória do Top 10 (por instância). Muitos jogadores abrindo o
// ranking na mesma janela leem do cache em vez de baterem no banco.
const LEADERBOARD_TTL_MS = 5000;
let leaderboardCache: { data: LeaderboardEntry[]; at: number } | null = null;

export function invalidateLeaderboardCache() {
  leaderboardCache = null;
}

export async function getTopLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!dbClient) return [];
  const now = Date.now();
  if (leaderboardCache && now - leaderboardCache.at < LEADERBOARD_TTL_MS) {
    return leaderboardCache.data;
  }
  try {
    await ensureSchema();

    const result = await withRetry(() =>
      dbClient.execute({
        sql: `
          SELECT id, name, emoji, score, created_at
          FROM leaderboard
          WHERE score IS NOT NULL
            AND typeof(score) IN ('integer', 'real')
            AND score >= 0
            AND score <= ?
          ORDER BY score DESC, id DESC
          LIMIT 10;
        `,
        args: [MAX_SCORE_LIMIT],
      })
    );

    const data = result.rows
      .map((row) => {
        const rawScore = Number(row.score);
        const safeScore = validateScore(rawScore) ?? 0;
        return {
          id: Number(row.id),
          name: sanitizeName(String(row.name)),
          emoji: sanitizeEmoji(String(row.emoji)),
          score: safeScore,
          created_at: String(row.created_at || ''),
        };
      })
      .filter((item) => item.score >= 0);

    leaderboardCache = { data, at: now };
    return data;
  } catch (err) {
    console.error('Erro ao buscar Top 10:', err);
    // Fallback: se o banco falhou mas há cache (mesmo expirado), serve o velho
    if (leaderboardCache) return leaderboardCache.data;
    return [];
  }
}

// Anti-replay: marca a sessão de jogo como usada; retorna false se já foi usada
export async function consumeGameSession(sid: string): Promise<boolean> {
  if (!dbClient) return true;
  try {
    await ensureSchema();
    await dbClient.execute({
      sql: `DELETE FROM score_sessions WHERE used_at < datetime('now', '-1 day');`,
      args: [],
    });
    await dbClient.execute({
      sql: `INSERT INTO score_sessions (sid) VALUES (?);`,
      args: [sid],
    });
    return true;
  } catch {
    return false; // PK duplicada = replay
  }
}

export async function countRecentSubmissions(ipHash: string): Promise<number> {
  if (!dbClient) return 0;
  try {
    await ensureSchema();
    const result = await dbClient.execute({
      sql: `SELECT COUNT(*) AS c FROM submit_log WHERE ip_hash = ? AND created_at >= datetime('now', '-1 hour');`,
      args: [ipHash],
    });
    return Number(result.rows[0]?.c ?? 0);
  } catch {
    return Number.MAX_SAFE_INTEGER; // fail-closed: em erro, trata como limite estourado
  }
}

export async function logSubmission(ipHash: string): Promise<void> {
  if (!dbClient) return;
  try {
    await ensureSchema();
    await dbClient.execute({
      sql: `DELETE FROM submit_log WHERE created_at < datetime('now', '-1 day');`,
      args: [],
    });
    await dbClient.execute({
      sql: `INSERT INTO submit_log (ip_hash) VALUES (?);`,
      args: [ipHash],
    });
  } catch (err) {
    console.error('Erro ao registrar submissão:', err);
  }
}

export async function saveScore(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  if (!dbClient) return [];
  try {
    await ensureSchema();

    const validScore = validateScore(entry.score);
    if (validScore === null) {
      return await getTopLeaderboard();
    }

    await withRetry(() =>
      dbClient.execute({
        sql: `INSERT INTO leaderboard (name, emoji, score) VALUES (?, ?, ?);`,
        args: [sanitizeName(entry.name), sanitizeEmoji(entry.emoji), validScore],
      })
    );

    invalidateLeaderboardCache(); // nova pontuação: força releitura fresca
    return await getTopLeaderboard();
  } catch (err) {
    console.error('Erro ao salvar pontuação:', err);
    return [];
  }
}
