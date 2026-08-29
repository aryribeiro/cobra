import { useState, useEffect, useRef, useCallback } from 'react';
import { soundManager } from '../lib/audio';
import { SnakeItem, getRandomItem, GAME_ITEMS } from '../lib/items';

export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';

export interface Position {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
}

export interface ShockRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
  width: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CELL_SIZE = 20;
const GRID_COLS = CANVAS_WIDTH / CELL_SIZE; // 40
const GRID_ROWS = CANVAS_HEIGHT / CELL_SIZE; // 30

const INITIAL_SNAKE: Position[] = [
  { x: 10, y: 15 },
  { x: 9, y: 15 },
  { x: 8, y: 15 },
  { x: 7, y: 15 },
  { x: 6, y: 15 },
];

const SPEED_CONFIG: Record<Difficulty, number> = {
  easy: 120,    // ms por tick
  medium: 90,
  hard: 65,
  insane: 45,
};

// Fila curta: comandos represados são latência artificial; o mais novo vence
const DIR_QUEUE_MAX = 2;
// Clamp de delta: evita rajada de ticks ao voltar de aba em background
const MAX_FRAME_DELTA = 100;
// Imunidade pós-impacto em ms de relógio (independe da dificuldade)
const POST_HIT_IMMUNITY_MS = 1500;

const DEFAULT_EFFECT_DURATION_S: Record<string, number> = {
  speed_up: 5,
  slow_down: 6,
  shield: 8,
  invincible: 7,
};

// Feedback háptico (mobile) — falha silenciosa onde não há suporte
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch { /* sem suporte */ }
  }
}

export function useSnakeGame() {
  // Estado React apenas para o HUD; a verdade do jogo vive em refs
  const [status, setStatus] = useState<GameStatus>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [lives, setLives] = useState<number>(3);
  const [combo, setCombo] = useState<number>(1);
  const [itemsEaten, setItemsEaten] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeItemEffect, setActiveItemEffect] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Espelhos autoritativos lidos pelo loop rAF (nunca reiniciam o efeito)
  const statusRef = useRef<GameStatus>('menu');
  const difficultyRef = useRef<Difficulty>('medium');
  const scoreRef = useRef<number>(0);
  const highScoreRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const livesRef = useRef<number>(3);
  const comboRef = useRef<number>(1);
  const itemsEatenRef = useRef<number>(0);

  const snakeRef = useRef<Position[]>(INITIAL_SNAKE.map((p) => ({ ...p })));
  const dirRef = useRef<Position>({ x: 1, y: 0 });
  const nextDirQueueRef = useRef<Position[]>([]);
  const currentItemRef = useRef<{ item: SnakeItem; pos: Position } | null>(null);

  // Efeitos & Juice
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const shakeRef = useRef<number>(0);
  // Timers de power-up em ms de relógio (honram item.duration)
  const shieldMsRef = useRef<number>(0);
  const invincibleMsRef = useRef<number>(0);
  const speedBoostMsRef = useRef<number>(0);
  const slowMoMsRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const lastEffectLabelRef = useRef<string | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Juice extra: anéis de choque, flash de tela, pulso da cabeça, pop do item
  const ringsRef = useRef<ShockRing[]>([]);
  const flashRef = useRef<{ rgb: string; alpha: number } | null>(null);
  const headPulseRef = useRef<number>(1);
  const itemSpawnAtRef = useRef<number>(0);

  // Sprites pré-renderizados (offscreen) — evitam fillText de emoji e ~70 strokes por frame
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const itemSpritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Sincroniza o HUD (React) a partir das refs autoritativas. Chamado por um
  // timer de baixa frequência — nunca dentro do frame de animação/juice.
  const flushHud = useCallback(() => {
    setScore((v) => (v !== scoreRef.current ? scoreRef.current : v));
    setHighScore((v) => (v !== highScoreRef.current ? highScoreRef.current : v));
    setLevel((v) => (v !== levelRef.current ? levelRef.current : v));
    setCombo((v) => (v !== comboRef.current ? comboRef.current : v));
    setItemsEaten((v) => (v !== itemsEatenRef.current ? itemsEatenRef.current : v));
  }, []);

  const updateStatus = useCallback((s: GameStatus) => {
    statusRef.current = s;
    if (s === 'gameover') flushHud(); // garante valores finais no overlay/submit
    setStatus(s);
  }, [flushHud]);

  // HUD atualiza a ~8Hz enquanto joga, desacoplado do loop de render
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(flushHud, 120);
    return () => clearInterval(id);
  }, [status, flushHud]);

  // Carregar High Score e Mute do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHigh = localStorage.getItem('vercel_snake_highscore');
      if (savedHigh) {
        const parsed = parseInt(savedHigh, 10);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 500000) {
          highScoreRef.current = parsed;
          setHighScore(parsed);
        } else {
          localStorage.removeItem('vercel_snake_highscore');
        }
      }
      setIsMuted(soundManager.getMuted());
    }
  }, []);

  const toggleSound = useCallback(() => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  }, []);

  const spawnItem = useCallback(() => {
    let newPos: Position;
    let collision: boolean;
    do {
      newPos = {
        x: Math.floor(Math.random() * (GRID_COLS - 4)) + 2,
        y: Math.floor(Math.random() * (GRID_ROWS - 4)) + 2,
      };
      collision = snakeRef.current.some((seg) => seg.x === newPos.x && seg.y === newPos.y);
    } while (collision);

    const item = getRandomItem();
    currentItemRef.current = { item, pos: newPos };
    itemSpawnAtRef.current = performance.now();
  }, []);

  const addRing = (x: number, y: number, color: string, maxR = 40, width = 3) => {
    ringsRef.current.push({ x, y, r: 4, maxR, alpha: 0.9, color, width });
  };

  const addParticles = (x: number, y: number, color: string, count = 15) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02,
      });
    }
  };

  const addFloatingText = (text: string, x: number, y: number, color = '#00F0FF') => {
    floatingTextsRef.current.push({
      id: Date.now() + Math.random(),
      text,
      x,
      y,
      color,
      alpha: 1,
      scale: 1.8,
    });
  };

  const startGame = useCallback((selectedDifficulty?: Difficulty) => {
    // Aquece o áudio no gesto do clique (evita hitch no primeiro som/item)
    soundManager.warmUp();
    const diff = selectedDifficulty || difficultyRef.current;
    difficultyRef.current = diff;
    setDifficulty(diff);

    snakeRef.current = INITIAL_SNAKE.map((p) => ({ ...p }));
    dirRef.current = { x: 1, y: 0 };
    nextDirQueueRef.current = [];

    scoreRef.current = 0;
    setScore(0);
    levelRef.current = 1;
    setLevel(1);
    livesRef.current = 3;
    setLives(3);
    comboRef.current = 1;
    setCombo(1);
    itemsEatenRef.current = 0;
    setItemsEaten(0);
    lastEffectLabelRef.current = null;
    setActiveItemEffect(null);

    shieldMsRef.current = 0;
    invincibleMsRef.current = 0;
    speedBoostMsRef.current = 0;
    slowMoMsRef.current = 0;
    particlesRef.current = [];
    floatingTextsRef.current = [];
    ringsRef.current = [];
    flashRef.current = null;
    headPulseRef.current = 1;
    accRef.current = 0;
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);

    spawnItem();
    updateStatus('playing');
  }, [spawnItem, updateStatus]);

  const pauseGame = useCallback(() => {
    const s = statusRef.current;
    if (s === 'playing') updateStatus('paused');
    else if (s === 'paused') updateStatus('playing');
  }, [updateStatus]);

  const changeDirection = useCallback((newDir: Position) => {
    if (statusRef.current !== 'playing') return;
    const q = nextDirQueueRef.current;
    const isSameOrOpposite = (a: Position, b: Position) =>
      (a.x === b.x && a.y === b.y) || (a.x + b.x === 0 && a.y + b.y === 0);

    if (q.length < DIR_QUEUE_MAX) {
      const last = q.length > 0 ? q[q.length - 1] : dirRef.current;
      if (isSameOrOpposite(last, newDir)) return;
      q.push(newDir);
    } else {
      // Fila cheia: o comando mais novo substitui o último (input nunca é ignorado)
      const prev = q.length >= 2 ? q[q.length - 2] : dirRef.current;
      if (isSameOrOpposite(prev, newDir)) return;
      q[q.length - 1] = newDir;
    }
  }, []);

  // Loop Principal do Jogo — timestep fixo com acumulador + render interpolado.
  // Deps vazias de propósito: o loop nunca reinicia durante a partida.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastFrameTime = performance.now();

    // Fundo (grid neon) renderizado UMA vez para um canvas offscreen; nunca muda.
    const buildBackground = () => {
      const bg = document.createElement('canvas');
      bg.width = CANVAS_WIDTH;
      bg.height = CANVAS_HEIGHT;
      const bctx = bg.getContext('2d');
      if (!bctx) return null;
      bctx.fillStyle = '#050505';
      bctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      bctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      bctx.lineWidth = 1;
      bctx.beginPath();
      for (let x = 0; x <= CANVAS_WIDTH; x += CELL_SIZE) {
        bctx.moveTo(x, 0);
        bctx.lineTo(x, CANVAS_HEIGHT);
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += CELL_SIZE) {
        bctx.moveTo(0, y);
        bctx.lineTo(CANVAS_WIDTH, y);
      }
      bctx.stroke();
      return bg;
    };
    bgCanvasRef.current = buildBackground();

    // Sprites de item (halo + emoji): construídos UMA vez para todos os itens.
    // Comer nunca mais paga fillText de emoji nem alocação de canvas.
    const SPRITE = 48;
    const buildItemSprite = (emoji: string, legendary: boolean): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = SPRITE;
      c.height = SPRITE;
      const g = c.getContext('2d');
      if (g) {
        const cx = SPRITE / 2;
        const grad = g.createRadialGradient(cx, cx, 2, cx, cx, cx);
        grad.addColorStop(0, legendary ? 'rgba(255, 0, 128, 0.45)' : 'rgba(0, 240, 255, 0.32)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, cx, cx, 0, Math.PI * 2);
        g.fill();
        g.font = '22px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(emoji, cx, cx);
      }
      return c;
    };
    if (itemSpritesRef.current.size === 0) {
      for (const it of GAME_ITEMS) {
        if (!itemSpritesRef.current.has(it.emoji)) {
          itemSpritesRef.current.set(it.emoji, buildItemSprite(it.emoji, it.rarity === 'legendary'));
        }
      }
    }

    const tickOnce = (interval: number) => {
      // Processar fila de direção
      if (nextDirQueueRef.current.length > 0) {
        dirRef.current = nextDirQueueRef.current.shift()!;
      }

      // Timers de power-up em ms de relógio
      shieldMsRef.current = Math.max(0, shieldMsRef.current - interval);
      invincibleMsRef.current = Math.max(0, invincibleMsRef.current - interval);
      speedBoostMsRef.current = Math.max(0, speedBoostMsRef.current - interval);
      slowMoMsRef.current = Math.max(0, slowMoMsRef.current - interval);

      const label =
        invincibleMsRef.current > 0 ? 'Invencível'
        : shieldMsRef.current > 0 ? 'Escudo Ativo'
        : speedBoostMsRef.current > 0 ? 'Vercel Turbo'
        : slowMoMsRef.current > 0 ? 'Slow Motion'
        : null;
      if (label !== lastEffectLabelRef.current) {
        lastEffectLabelRef.current = label;
        setActiveItemEffect(label);
      }

      const snake = snakeRef.current;
      const head = snake[0];
      const newHead: Position = {
        x: head.x + dirRef.current.x,
        y: head.y + dirRef.current.y,
      };

      const isWallHit =
        newHead.x < 0 || newHead.x >= GRID_COLS || newHead.y < 0 || newHead.y >= GRID_ROWS;

      if (isWallHit) {
        if (shieldMsRef.current > 0 || invincibleMsRef.current > 0) {
          // Escudo ou invencibilidade: atravessa para o outro lado sem dano
          if (newHead.x < 0) newHead.x = GRID_COLS - 1;
          else if (newHead.x >= GRID_COLS) newHead.x = 0;
          if (newHead.y < 0) newHead.y = GRID_ROWS - 1;
          else if (newHead.y >= GRID_ROWS) newHead.y = 0;

          soundManager.playPowerup();
          shakeRef.current = 5;
          addRing(head.x * CELL_SIZE + CELL_SIZE / 2, head.y * CELL_SIZE + CELL_SIZE / 2, '#00F0FF', 50);
          vibrate(20);
          addFloatingText('SHIELD BOUNCE!', head.x * CELL_SIZE, head.y * CELL_SIZE, '#00F0FF');
          // Segue para o movimento normal com a cabeça teletransportada
        } else {
          // Colisão sem escudo: perde vida e encolhe
          shakeRef.current = 18;
          soundManager.playHit();
          flashRef.current = { rgb: '255, 0, 85', alpha: 0.3 };
          addRing(head.x * CELL_SIZE + CELL_SIZE / 2, head.y * CELL_SIZE + CELL_SIZE / 2, '#FF0055', 70, 4);
          vibrate(80);

          const newLives = livesRef.current - 1;
          livesRef.current = newLives;
          setLives(newLives);

          if (newLives <= 0) {
            soundManager.playGameOver();
            flashRef.current = { rgb: '255, 0, 85', alpha: 0.45 };
            vibrate([70, 50, 70]);
            updateStatus('gameover');
            return;
          }

          nextDirQueueRef.current = [];
          dirRef.current = { x: -dirRef.current.x, y: -dirRef.current.y };
          invincibleMsRef.current = POST_HIT_IMMUNITY_MS;

          const shrunk = snake.slice(0, Math.max(3, snake.length - 2));
          const safeX = Math.max(1, Math.min(GRID_COLS - 2, head.x + dirRef.current.x));
          const safeY = Math.max(1, Math.min(GRID_ROWS - 2, head.y + dirRef.current.y));
          shrunk[0] = { x: safeX, y: safeY };
          snakeRef.current = shrunk;

          addFloatingText(`-1 VIDA! (${newLives} RESTANTES)`, head.x * CELL_SIZE, head.y * CELL_SIZE, '#FF0055');
          return;
        }
      }

      // Regra clássica: mover para a célula que a cauda desocupa neste tick não é colisão
      const willGrow =
        currentItemRef.current !== null &&
        newHead.x === currentItemRef.current.pos.x &&
        newHead.y === currentItemRef.current.pos.y;
      const body = willGrow ? snake : snake.slice(0, -1);
      const selfCollision = body.some((seg) => seg.x === newHead.x && seg.y === newHead.y);

      if (selfCollision && invincibleMsRef.current <= 0) {
        shakeRef.current = 20;
        soundManager.playHit();
        soundManager.playGameOver();
        flashRef.current = { rgb: '255, 0, 85', alpha: 0.45 };
        vibrate([70, 50, 70]);
        updateStatus('gameover');
        return;
      }

      // Avançar a cobra
      snake.unshift(newHead);

      // Rastro de turbo: faíscas curtas atrás da cabeça enquanto o boost dura
      if (speedBoostMsRef.current > 0) {
        for (let i = 0; i < 2; i++) {
          particlesRef.current.push({
            x: head.x * CELL_SIZE + CELL_SIZE / 2 + (Math.random() - 0.5) * 8,
            y: head.y * CELL_SIZE + CELL_SIZE / 2 + (Math.random() - 0.5) * 8,
            vx: -dirRef.current.x * (Math.random() * 2 + 1),
            vy: -dirRef.current.y * (Math.random() * 2 + 1),
            color: '#00F0FF',
            size: Math.random() * 2.5 + 1,
            alpha: 0.8,
            decay: 0.08,
          });
        }
      }

      if (willGrow && currentItemRef.current) {
        const { item, pos } = currentItemRef.current;

        // HUD atualizado só via refs aqui; o React sincroniza a ~8Hz por fora
        // do frame de animação (não trava o juice ao comer).
        const earnedPoints = item.points * comboRef.current;
        scoreRef.current += earnedPoints;
        if (scoreRef.current > highScoreRef.current) {
          highScoreRef.current = scoreRef.current;
          try {
            localStorage.setItem('vercel_snake_highscore', String(scoreRef.current));
          } catch { /* storage indisponível */ }
        }

        itemsEatenRef.current += 1;
        if (itemsEatenRef.current % 5 === 0) {
          levelRef.current += 1;
          soundManager.playLevelUp();
          flashRef.current = { rgb: '0, 240, 255', alpha: 0.15 };
          addFloatingText(`LEVEL UP! LVL ${levelRef.current}`, CANVAS_WIDTH / 2 - 60, CANVAS_HEIGHT / 2, '#00F0FF');
        }

        comboRef.current = Math.min(comboRef.current + 1, 8);
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
        comboTimerRef.current = setTimeout(() => {
          comboRef.current = 1;
        }, 4000);

        soundManager.playEat();
        shakeRef.current = item.rarity === 'legendary' ? 12 : 5;
        headPulseRef.current = item.rarity === 'legendary' ? 1.6 : 1.35;
        vibrate(item.rarity === 'legendary' ? 35 : 12);
        const juiceColor = item.rarity === 'legendary' ? '#FF0080' : '#00F0FF';
        addParticles(pos.x * CELL_SIZE + CELL_SIZE / 2, pos.y * CELL_SIZE + CELL_SIZE / 2, juiceColor, item.rarity === 'legendary' ? 32 : 20);
        addRing(pos.x * CELL_SIZE + CELL_SIZE / 2, pos.y * CELL_SIZE + CELL_SIZE / 2, juiceColor, item.rarity === 'legendary' ? 64 : 36);
        if (item.rarity === 'legendary') {
          flashRef.current = { rgb: '255, 0, 128', alpha: 0.18 };
        }
        addFloatingText(`${item.emoji} +${earnedPoints}`, pos.x * CELL_SIZE, pos.y * CELL_SIZE, juiceColor);
        if (comboRef.current >= 4) {
          addFloatingText(`COMBO x${comboRef.current}!`, newHead.x * CELL_SIZE - 20, newHead.y * CELL_SIZE - 14, '#FFD700');
        }

        // Aplicar efeito do item (durações declaradas no próprio item)
        const durationMs = (item.duration ?? DEFAULT_EFFECT_DURATION_S[item.effect] ?? 0) * 1000;
        if (item.effect === 'speed_up') speedBoostMsRef.current = durationMs;
        else if (item.effect === 'slow_down') slowMoMsRef.current = durationMs;
        else if (item.effect === 'shield') shieldMsRef.current = durationMs;
        else if (item.effect === 'invincible') invincibleMsRef.current = durationMs;
        else if (item.effect === 'extra_life') {
          livesRef.current = Math.min(livesRef.current + 1, 5);
          setLives(livesRef.current);
        } else if (item.effect === 'shrink') {
          snakeRef.current = snakeRef.current.slice(0, Math.max(3, snakeRef.current.length - 3));
        }

        spawnItem();
      } else {
        snake.pop();
      }
    };

    const draw = (interval: number, time: number) => {
      // Fração do tick decorrida — interpola o desenho entre a célula anterior e a atual
      const t = statusRef.current === 'playing'
        ? Math.min(1, accRef.current / interval)
        : 1;

      ctx.save();
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Screen Shake
      if (shakeRef.current > 0) {
        const rx = (Math.random() - 0.5) * shakeRef.current;
        const ry = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(rx, ry);
        shakeRef.current = Math.max(0, shakeRef.current - 1);
      }

      // Fundo Dark Vercel com Grid Neon (cacheado — 1 drawImage no lugar de ~70 strokes)
      if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Borda Externa Neon
      ctx.strokeStyle = shieldMsRef.current > 0 ? '#00F0FF' : invincibleMsRef.current > 0 ? '#FF0080' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, CANVAS_WIDTH - 4, CANVAS_HEIGHT - 4);

      // Item: sprite pré-renderizado (halo+emoji) desenhado com escala — sem fillText por frame
      if (currentItemRef.current) {
        const { item, pos } = currentItemRef.current;
        const sprite = itemSpritesRef.current.get(item.emoji);
        if (sprite) {
          // Pop-in elástico (~250ms) + pulso/flutuação via escala e posição (baratos)
          const age = time - itemSpawnAtRef.current;
          const popT = Math.min(1, age / 250);
          const spawnScale = popT < 1 ? popT * (2 - popT) * (1 + 0.3 * (1 - popT)) : 1;
          const pulse = 1 + Math.sin(time * 0.008) * 0.08;
          const scale = spawnScale * pulse;
          const bob = Math.sin(time * 0.005) * 2;
          const cx = pos.x * CELL_SIZE + CELL_SIZE / 2;
          const cy = pos.y * CELL_SIZE + CELL_SIZE / 2 + bob;
          const size = SPRITE * scale;
          ctx.drawImage(sprite, cx - size / 2, cy - size / 2, size, size);
        }
      }

      // Cobra com interpolação PREDITIVA (para-frente): cada segmento desliza
      // em direção à PRÓXIMA célula. A cabeça fica na posição lógica (nunca
      // atrás), então o timing da curva casa com o que o jogador vê — crucial
      // a 165Hz, onde a dessincronia da interpolação retrospectiva era visível.
      const snake = snakeRef.current;
      snake.forEach((seg, idx) => {
        let gx = seg.x;
        let gy = seg.y;
        // A CABEÇA fica exatamente na célula lógica (idx 0, sem lead): resposta
        // instantânea e fiel à tecla — a mira da curva casa com o que se vê.
        // O CORPO desliza em direção ao segmento à frente (suavidade a 165Hz).
        if (idx > 0) {
          const fx = snake[idx - 1].x - seg.x;
          const fy = snake[idx - 1].y - seg.y;
          if (Math.abs(fx) + Math.abs(fy) === 1) { // passo unitário (não wrap/encolhe)
            gx = seg.x + fx * t;
            gy = seg.y + fy * t;
          }
        }
        const sx = gx * CELL_SIZE;
        const sy = gy * CELL_SIZE;
        const isHead = idx === 0;

        ctx.beginPath();
        if (isHead) {
          // Pulso da cabeça ao comer (decai suavemente de volta a 1)
          headPulseRef.current += (1 - headPulseRef.current) * 0.12;
          const grow = (headPulseRef.current - 1) * CELL_SIZE;
          ctx.roundRect(sx + 1 - grow / 2, sy + 1 - grow / 2, CELL_SIZE - 2 + grow, CELL_SIZE - 2 + grow, 6);
        } else {
          ctx.roundRect(sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
        }

        if (isHead) {
          ctx.fillStyle = invincibleMsRef.current > 0 ? '#FF0080' : shieldMsRef.current > 0 ? '#00F0FF' : '#FFFFFF';
          ctx.shadowColor = ctx.fillStyle;
          // Glow fixo e baixo: o pulso ao comer já aparece pelo tamanho (grow), sem custo de blur
          ctx.shadowBlur = 8;
        } else {
          const alpha = Math.max(0.2, 1 - idx / (snake.length * 1.2));
          ctx.fillStyle = invincibleMsRef.current > 0 ? `rgba(255, 0, 128, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
          ctx.shadowBlur = 0;
        }
        ctx.fill();

        if (isHead) {
          // Olhos acompanham a direção do movimento
          const d = dirRef.current;
          const ecx = sx + CELL_SIZE / 2 + d.x * 4;
          const ecy = sy + CELL_SIZE / 2 + d.y * 4;
          const px = -d.y;
          const py = d.x;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(ecx + px * 4, ecy + py * 4, 2.2, 0, Math.PI * 2);
          ctx.arc(ecx - px * 4, ecy - py * 4, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.shadowBlur = 0;

      // Anéis de choque (comer, escudo, dano)
      const aliveRings: ShockRing[] = [];
      for (const ring of ringsRef.current) {
        ring.r += (ring.maxR - ring.r) * 0.18 + 1.5;
        ring.alpha -= 0.05;
        if (ring.alpha > 0 && ring.r < ring.maxR) {
          ctx.save();
          ctx.globalAlpha = ring.alpha;
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = ring.width;
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          aliveRings.push(ring);
        }
      }
      ringsRef.current = aliveRings;

      // Partículas (rebuild da lista — sem splice durante iteração)
      const aliveParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          aliveParticles.push(p);
        }
      }
      particlesRef.current = aliveParticles;

      // Textos Flutuantes (pop de escala + subida com fade)
      const aliveTexts: FloatingText[] = [];
      for (const ft of floatingTextsRef.current) {
        ft.y -= 1.2;
        ft.alpha -= 0.02;
        ft.scale += (1 - ft.scale) * 0.15;
        if (ft.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = ft.alpha;
          ctx.font = `bold ${Math.round(14 * ft.scale)}px sans-serif`;
          // Contorno escuro barato (1 fill extra) no lugar de shadowBlur por texto por frame
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
          aliveTexts.push(ft);
        }
      }
      floatingTextsRef.current = aliveTexts;

      // Flash de tela (dano, level up, lendário) — decai a cada frame
      if (flashRef.current && flashRef.current.alpha > 0) {
        ctx.fillStyle = `rgba(${flashRef.current.rgb}, ${flashRef.current.alpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        flashRef.current.alpha -= 0.025;
        if (flashRef.current.alpha <= 0) flashRef.current = null;
      }

      ctx.restore();
    };

    const render = (time: number) => {
      const frameDelta = Math.min(time - lastFrameTime, MAX_FRAME_DELTA);
      lastFrameTime = time;

      let interval = SPEED_CONFIG[difficultyRef.current] - (levelRef.current - 1) * 4;
      if (speedBoostMsRef.current > 0) interval *= 0.6; // Turbo
      if (slowMoMsRef.current > 0) interval *= 1.4;     // Slow-Mo
      interval = Math.max(30, interval);

      if (statusRef.current === 'playing') {
        accRef.current += frameDelta;
        let guard = 0;
        while (accRef.current >= interval && statusRef.current === 'playing' && guard < 4) {
          tickOnce(interval);
          accRef.current -= interval;
          guard++;
        }
        if (guard >= 4) accRef.current = 0;
      } else {
        accRef.current = 0;
      }

      draw(interval, time);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, [spawnItem, updateStatus]);

  // Ouvinte de Teclado (WASD + Setas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'KeyW' || e.code === 'ArrowUp') changeDirection({ x: 0, y: -1 });
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') changeDirection({ x: 0, y: 1 });
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') changeDirection({ x: -1, y: 0 });
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') changeDirection({ x: 1, y: 0 });
      else if (e.code === 'KeyP' || e.code === 'Space') pauseGame();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, pauseGame]);

  return {
    canvasRef,
    status,
    difficulty,
    score,
    highScore,
    level,
    lives,
    combo,
    itemsEaten,
    isMuted,
    activeItemEffect,
    startGame,
    pauseGame,
    changeDirection,
    toggleSound,
  };
}
