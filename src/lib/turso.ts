import { createClient } from '@libsql/client';

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

export async function getTopLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!tursoClient) return [];
  try {
    await ensureTableExists();
    // Ordenar por pontuação DECRESCENTE. Em caso de empate, o registro mais recente (maior ID) vem PRIMEIRO!
    const result = await tursoClient.execute(`
      SELECT id, name, emoji, score, created_at
      FROM leaderboard
      ORDER BY score DESC, id DESC
      LIMIT 10;
    `);

    return result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      emoji: String(row.emoji),
      score: Number(row.score),
      created_at: String(row.created_at || ''),
    }));
  } catch (err) {
    console.error('Erro ao buscar Top 10 no Turso:', err);
    return [];
  }
}

export async function saveScoreToTurso(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  if (!tursoClient) return [];
  try {
    await ensureTableExists();

    // 1. Inserir a nova pontuação
    await tursoClient.execute({
      sql: `INSERT INTO leaderboard (name, emoji, score) VALUES (?, ?, ?);`,
      args: [entry.name.slice(0, 12), entry.emoji, entry.score],
    });

    // 2. Retornar os Top 10 atualizados
    return await getTopLeaderboard();
  } catch (err) {
    console.error('Erro ao salvar pontuação no Turso:', err);
    return [];
  }
}
