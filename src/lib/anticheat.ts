import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';

// Segredo de assinatura: SCORE_SECRET dedicado ou derivado do token do banco
// (server-only; nunca chega ao client). Trocar SCORE_SECRET invalida tokens em voo.
const secret =
  process.env.SCORE_SECRET ||
  createHash('sha256')
    .update('vercel-snake-hmac-v1:' + (process.env.DB_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || 'dev-secret'))
    .digest('hex');

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TOKEN_CLOCK_SKEW_MS = 2 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(sid: string, ts: number): string {
  return createHmac('sha256', secret).update(`${sid}.${ts}`).digest('hex');
}

// Token opaco emitido no início da partida: sid.timestamp.assinatura
export function issueGameToken(): string {
  const sid = randomUUID();
  const ts = Date.now();
  return `${sid}.${ts}.${sign(sid, ts)}`;
}

export interface GameTokenInfo {
  sid: string;
  startedAt: number;
}

export function verifyGameToken(token: string): GameTokenInfo | null {
  if (typeof token !== 'string' || token.length > 160) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sid, tsRaw, sig] = parts;
  if (!UUID_RE.test(sid)) return null;
  const ts = Number(tsRaw);
  if (!Number.isInteger(ts) || ts <= 0) return null;

  const expected = sign(sid, ts);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  const age = Date.now() - ts;
  if (age < -TOKEN_CLOCK_SKEW_MS || age > TOKEN_MAX_AGE_MS) return null;

  return { sid, startedAt: ts };
}

// Limites físicos do jogo (derivados das regras reais):
// - item mais valioso: 2.000 pts × combo máx 8 = 16.000 pts/item
// - deslocamento mínimo até um item: ~0,5s mesmo no modo insano com sorte
// - teto de taxa sustentada com folga generosa: 4.000 pts/s + 20.000 de tolerância
export function isPlausible(score: number, itemsEaten: number, elapsedMs: number): boolean {
  if (!Number.isInteger(itemsEaten) || itemsEaten < 0 || itemsEaten > 5000) return false;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 5000 || elapsedMs > 6 * 3600 * 1000) return false;
  if (score > 0 && itemsEaten < 1) return false;
  if (score > itemsEaten * 16000) return false;
  if (elapsedMs < itemsEaten * 500) return false;
  if (score > 20000 + (elapsedMs / 1000) * 4000) return false;
  return true;
}

// Hash de IP com o segredo (pseudonimizado — o IP bruto nunca é persistido)
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${secret}|ip|${ip}`).digest('hex').slice(0, 32);
}
