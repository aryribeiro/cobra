export type ItemEffect =
  | 'none'
  | 'speed_up'
  | 'slow_down'
  | 'shield'
  | 'shrink'
  | 'extra_life'
  | 'invincible'
  | 'ghost'
  | 'mega_points';

export interface SnakeItem {
  emoji: string;
  name: string;
  points: number;
  effect: ItemEffect;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  duration?: number; // em segundos se houver efeito com tempo
}

export const GAME_ITEMS: SnakeItem[] = [
  // --- Comidas Comuns (25 Emojis) ---
  { emoji: '🍎', name: 'Maçã', points: 100, effect: 'none', rarity: 'common' },
  { emoji: '🍌', name: 'Banana', points: 100, effect: 'none', rarity: 'common' },
  { emoji: '🍓', name: 'Morango', points: 120, effect: 'none', rarity: 'common' },
  { emoji: '🍇', name: 'Uva', points: 120, effect: 'none', rarity: 'common' },
  { emoji: '🍉', name: 'Melancia', points: 150, effect: 'none', rarity: 'common' },
  { emoji: '🍒', name: 'Cereja', points: 150, effect: 'none', rarity: 'common' },
  { emoji: '🍍', name: 'Abacaxi', points: 180, effect: 'none', rarity: 'common' },
  { emoji: '🥑', name: 'Abacate', points: 180, effect: 'none', rarity: 'common' },
  { emoji: '🍕', name: 'Pizza', points: 200, effect: 'none', rarity: 'common' },
  { emoji: '🍔', name: 'Hambúrguer', points: 200, effect: 'none', rarity: 'common' },
  { emoji: '🌮', name: 'Taco', points: 220, effect: 'none', rarity: 'common' },
  { emoji: '🍩', name: 'Donut', points: 220, effect: 'none', rarity: 'common' },
  { emoji: '🍦', name: 'Sorvete', points: 250, effect: 'none', rarity: 'common' },
  { emoji: '🥨', name: 'Pretzel', points: 250, effect: 'none', rarity: 'common' },
  { emoji: '🍟', name: 'Batata Frita', points: 220, effect: 'none', rarity: 'common' },
  { emoji: '🥐', name: 'Croissant', points: 240, effect: 'none', rarity: 'common' },
  { emoji: '🧀', name: 'Queijo', points: 230, effect: 'none', rarity: 'common' },
  { emoji: '🍿', name: 'Pipoca', points: 210, effect: 'none', rarity: 'common' },
  { emoji: '🍳', name: 'Ovo Frito', points: 230, effect: 'none', rarity: 'common' },
  { emoji: '🥩', name: 'Bife', points: 300, effect: 'none', rarity: 'common' },
  { emoji: '🍊', name: 'Laranja', points: 130, effect: 'none', rarity: 'common' },
  { emoji: '🍋', name: 'Limão', points: 140, effect: 'none', rarity: 'common' },
  { emoji: '🥭', name: 'Manga', points: 190, effect: 'none', rarity: 'common' },
  { emoji: '🥞', name: 'Panqueca', points: 260, effect: 'none', rarity: 'common' },
  { emoji: '🧇', name: 'Waffle', points: 270, effect: 'none', rarity: 'common' },

  // --- Itens Especiais e Power-ups (17 Emojis) ---
  { emoji: '🚀', name: 'Vercel Turbo', points: 500, effect: 'speed_up', rarity: 'uncommon', duration: 5 },
  { emoji: '🐢', name: 'Slow Motion', points: 500, effect: 'slow_down', rarity: 'uncommon', duration: 6 },
  { emoji: '🛡️', name: 'Escudo Neon', points: 700, effect: 'shield', rarity: 'rare', duration: 8 },
  { emoji: '🔮', name: 'Esfera Encolhedora', points: 600, effect: 'shrink', rarity: 'rare' },
  { emoji: '💖', name: 'Vida Extra', points: 800, effect: 'extra_life', rarity: 'rare' },
  { emoji: '🌟', name: 'Estrela Invencível', points: 1200, effect: 'invincible', rarity: 'legendary', duration: 7 },
  { emoji: '💎', name: 'Diamante Vercel', points: 1000, effect: 'mega_points', rarity: 'rare' },
  { emoji: '⚡', name: 'Hyper Flash', points: 750, effect: 'speed_up', rarity: 'uncommon', duration: 4 },
  { emoji: '🌀', name: 'Vórtex Warp', points: 850, effect: 'shrink', rarity: 'rare' },
  { emoji: '👑', name: 'Coroa Imperial', points: 1500, effect: 'mega_points', rarity: 'legendary' },
  { emoji: '🏆', name: 'Troféu de Ouro', points: 2000, effect: 'mega_points', rarity: 'legendary' },
  { emoji: '💰', name: 'Saco de Ouro', points: 1200, effect: 'mega_points', rarity: 'rare' },
  { emoji: '🎆', name: 'Fogo de Artifício', points: 700, effect: 'none', rarity: 'uncommon' },
  { emoji: '🤖', name: 'Vercel Bot AI', points: 1100, effect: 'shield', rarity: 'rare', duration: 7 },
  { emoji: '🛸', name: 'OVNI Galáctico', points: 1300, effect: 'invincible', rarity: 'legendary', duration: 6 },
  { emoji: '🌈', name: 'Prisma Arco-Íris', points: 1400, effect: 'mega_points', rarity: 'legendary' },
  { emoji: '💫', name: 'Estrela Guia', points: 900, effect: 'slow_down', rarity: 'uncommon', duration: 5 },

  // --- Novas mecânicas (sobrevivência — não inflam pontuação) ---
  { emoji: '👻', name: 'Modo Fantasma', points: 600, effect: 'ghost', rarity: 'rare', duration: 6 },
  { emoji: '🔱', name: 'Aura Divina', points: 1300, effect: 'invincible', rarity: 'legendary', duration: 8 },
  { emoji: '😇', name: 'Anjo da Guarda', points: 900, effect: 'ghost', rarity: 'rare', duration: 7 },
];

export function getRandomItem(): SnakeItem {
  const rand = Math.random();
  let pool: SnakeItem[];

  if (rand < 0.60) {
    // 60% chance de comida comum
    pool = GAME_ITEMS.filter((item) => item.rarity === 'common');
  } else if (rand < 0.85) {
    // 25% chance de incomum
    pool = GAME_ITEMS.filter((item) => item.rarity === 'uncommon');
  } else if (rand < 0.96) {
    // 11% chance de raro
    pool = GAME_ITEMS.filter((item) => item.rarity === 'rare');
  } else {
    // 4% chance de lendário
    pool = GAME_ITEMS.filter((item) => item.rarity === 'legendary');
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index] || GAME_ITEMS[0];
}
