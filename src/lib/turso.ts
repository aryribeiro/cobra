import { createClient } from '@libsql/client';
import { AVATAR_EMOJIS } from './avatars';

export interface LeaderboardEntry {
  id?: number;
  name: string;
  emoji: string;
  score: number;
  created_at?: string;
}

const url = process.env.TURSO_DATABASE_URL || '';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

export const isTursoConfigured = Boolean(url && authToken);

export const tursoClient = isTursoConfigured
  ? createClient({ url, authToken })
  : null;

// Garante que a tabela exista
export async function ensureTableExists() {
  if (!tursoClient) return;
  try {
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('Erro ao inicializar tabela Turso:', err);
  }
}

// DevSecOps / Validation Constants
export const MAX_SCORE_LIMIT = 500000;
const VALID_EMOJIS = new Set(AVATAR_EMOJIS.map((a) => a.emoji));

export function sanitizeName(name: string): string {
  if (typeof name !== 'string') return 'Snake Master';
  const clean = name
    .replace(/<[^>]*>?/gm, '') // Prevenção de XSS
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
    return null; // Rejeita pontuações negativas, NaN ou absurdas (cheating)
  }
  return intScore;
}

export async function getTopLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!tursoClient) return [];
  try {
    await ensureTableExists();
    
    // DevSecOps / DB Integrity: Filtrar apenas scores numéricos inteiros e válidos <= MAX_SCORE_LIMIT
    // No SQLite, typeof(score) garante a rejeição de strings maliciosas ("gg", "NaN", etc.)
    const result = await tursoClient.execute({
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
    });

    return result.rows
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
  } catch (err) {
    console.error('Erro ao buscar Top 10 no Turso:', err);
    return [];
  }
}

export async function saveScoreToTurso(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  if (!tursoClient) return [];
  try {
    await ensureTableExists();

    // DevSecOps: Validação estrita de entrada antes de tocar no banco de dados
    const validScore = validateScore(entry.score);
    if (validScore === null) {
      console.warn(`[DevSecOps] Tentativa de submissão de score inválido ou manipulado rejeitada: ${entry.score}`);
      return await getTopLeaderboard();
    }

    const cleanName = sanitizeName(entry.name);
    const cleanEmoji = sanitizeEmoji(entry.emoji);

    // Inserir a nova pontuação sanitizada e validada
    await tursoClient.execute({
      sql: `INSERT INTO leaderboard (name, emoji, score) VALUES (?, ?, ?);`,
      args: [cleanName, cleanEmoji, validScore],
    });

    // Retornar os Top 10 atualizados
    return await getTopLeaderboard();
  } catch (err) {
    console.error('Erro ao salvar pontuação no Turso:', err);
    return [];
  }
}

