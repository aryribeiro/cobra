import { useState, useEffect, useRef, useCallback } from 'react';
import { soundManager } from '../lib/audio';
import { GAME_ITEMS, SnakeItem, getRandomItem } from '../lib/items';

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

export function useSnakeGame() {
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

  // Estados mutáveis mantidos por ref para garantir performance no rAF loop
  const snakeRef = useRef<Position[]>(INITIAL_SNAKE);
  const dirRef = useRef<Position>({ x: 1, y: 0 });
  const nextDirQueueRef = useRef<Position[]>([]);
  const currentItemRef = useRef<{ item: SnakeItem; pos: Position } | null>(null);

  // Efeitos & Juice
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const shakeRef = useRef<number>(0);
  const shieldTimeRef = useRef<number>(0);
  const invincibleTimeRef = useRef<number>(0);
  const speedBoostTimeRef = useRef<number>(0);
  const slowMoTimeRef = useRef<number>(0);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar High Score e Mute do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHigh = localStorage.getItem('vercel_snake_highscore');
      if (savedHigh) setHighScore(parseInt(savedHigh, 10));
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
      // eslint-disable-next-line no-loop-func
      collision = snakeRef.current.some((seg) => seg.x === newPos.x && seg.y === newPos.y);
    } while (collision);

    const item = getRandomItem();
    currentItemRef.current = { item, pos: newPos };
  }, []);

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
      scale: 1.2,
    });
  };

  const startGame = useCallback((selectedDifficulty?: Difficulty) => {
    const diff = selectedDifficulty || difficulty;
    setDifficulty(diff);
    snakeRef.current = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 },
      { x: 7, y: 15 },
      { x: 6, y: 15 },
    ];
    dirRef.current = { x: 1, y: 0 };
    nextDirQueueRef.current = [];
    setScore(0);
    setLevel(1);
    setLives(3);
    setCombo(1);
    setItemsEaten(0);
    setActiveItemEffect(null);
    shieldTimeRef.current = 0;
    invincibleTimeRef.current = 0;
    speedBoostTimeRef.current = 0;
    slowMoTimeRef.current = 0;
    particlesRef.current = [];
    floatingTextsRef.current = [];

    spawnItem();
    setStatus('playing');
  }, [difficulty, spawnItem]);

  const pauseGame = useCallback(() => {
    setStatus((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
  }, []);

  const changeDirection = useCallback((newDir: Position) => {
    if (status !== 'playing') return;
    const lastDir = nextDirQueueRef.current.length > 0 
      ? nextDirQueueRef.current[nextDirQueueRef.current.length - 1] 
      : dirRef.current;

    // Impedir giro de 180 graus no mesmo eixo
    if (lastDir.x + newDir.x === 0 && lastDir.y + newDir.y === 0) return;
    if (nextDirQueueRef.current.length < 3) {
      nextDirQueueRef.current.push(newDir);
    }
  }, [status]);

  // Loop Principal do Jogo (Canvas Render + Game Physics)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTickTime = performance.now();

    const render = (time: number) => {
      // 1. Atualizar Físicas baseadas na velocidade do nível
      let baseSpeed = SPEED_CONFIG[difficulty] - (level - 1) * 4;
      if (speedBoostTimeRef.current > 0) baseSpeed *= 0.6; // Turbo
      if (slowMoTimeRef.current > 0) baseSpeed *= 1.4;    // Slow-Mo
      baseSpeed = Math.max(30, baseSpeed);

      const delta = time - lastTickTime;

      if (status === 'playing' && delta >= baseSpeed) {
        lastTickTime = time;

        // Processar fila de direção
        if (nextDirQueueRef.current.length > 0) {
          dirRef.current = nextDirQueueRef.current.shift()!;
        }

        const head = snakeRef.current[0];
        const newHead: Position = {
          x: head.x + dirRef.current.x,
          y: head.y + dirRef.current.y,
        };

        // --- DECREMENTAR TIMERS DE POWER-UPS ---
        if (shieldTimeRef.current > 0) shieldTimeRef.current--;
        if (invincibleTimeRef.current > 0) invincibleTimeRef.current--;
        if (speedBoostTimeRef.current > 0) speedBoostTimeRef.current--;
        if (slowMoTimeRef.current > 0) slowMoTimeRef.current--;

        // Atualizar estado visível de efeito ativo
        if (invincibleTimeRef.current > 0) setActiveItemEffect('Invencível');
        else if (shieldTimeRef.current > 0) setActiveItemEffect('Escudo Ativo');
        else if (speedBoostTimeRef.current > 0) setActiveItemEffect('Vercel Turbo');
        else if (slowMoTimeRef.current > 0) setActiveItemEffect('Slow Motion');
        else setActiveItemEffect(null);

        // --- VERIFICAR COLISÃO NAS BORDAS ---
        let isWallHit = false;
        if (newHead.x < 0 || newHead.x >= GRID_COLS || newHead.y < 0 || newHead.y >= GRID_ROWS) {
          isWallHit = true;
        }

        if (isWallHit) {
          if (shieldTimeRef.current > 0 || invincibleTimeRef.current > 0) {
            // Escudo ou invencibilidade: Teleporta para o outro lado sem dano!
            if (newHead.x < 0) newHead.x = GRID_COLS - 1;
            else if (newHead.x >= GRID_COLS) newHead.x = 0;
            if (newHead.y < 0) newHead.y = GRID_ROWS - 1;
            else if (newHead.y >= GRID_ROWS) newHead.y = 0;

            soundManager.playPowerup();
            shakeRef.current = 5;
            addFloatingText('SHIELD BOUNCE!', head.x * CELL_SIZE, head.y * CELL_SIZE, '#00F0FF');
          } else {
            // Colisão sem escudo: sofre tremer, perde vida e encolhe
            shakeRef.current = 18;
            soundManager.playHit();

            setLives((prevLives) => {
              const newLives = prevLives - 1;
              if (newLives <= 0) {
                // Morte real: vidas zeradas!
                soundManager.playGameOver();
                setStatus('gameover');
                return 0;
              } else {
                // Perdeu 1 vida mas AINDA TEM VIDAS RESTANTES!
                // 1. Limpar fila de comandos para não bater novamente
                nextDirQueueRef.current = [];

                // 2. Rebater direção para o centro da arena
                dirRef.current = { x: -dirRef.current.x, y: -dirRef.current.y };

                // 3. Conceder 1.5s de imunidade pós-impacto para evitar múltiplos hits em cascata
                invincibleTimeRef.current = 15;

                // 4. Encolher a cobrinha suavemente (mantendo mínimo de 3 segmentos)
                snakeRef.current = snakeRef.current.slice(0, Math.max(3, snakeRef.current.length - 2));

                // 5. Mover a cabeça 1 célula para DENTRO da arena em segurança
                const safeX = Math.max(1, Math.min(GRID_COLS - 2, head.x + dirRef.current.x));
                const safeY = Math.max(1, Math.min(GRID_ROWS - 2, head.y + dirRef.current.y));
                snakeRef.current[0] = { x: safeX, y: safeY };

                addFloatingText(`-1 VIDA! (${newLives} RESTANTES)`, head.x * CELL_SIZE, head.y * CELL_SIZE, '#FF0055');

                return newLives;
              }
            });
          }
        } else {
          // --- VERIFICAR AUTO-COLISÃO (Cobra encostar no próprio corpo) ---
          const selfCollision = snakeRef.current.some((seg, idx) => idx !== 0 && seg.x === newHead.x && seg.y === newHead.y);
          
          if (selfCollision && invincibleTimeRef.current <= 0) {
            shakeRef.current = 20;
            soundManager.playHit();
            soundManager.playGameOver();
            setStatus('gameover');
          } else {
            // Avançar a cobra
            snakeRef.current.unshift(newHead);

            // --- VERIFICAR SE COMEU ITEM ---
            if (currentItemRef.current && newHead.x === currentItemRef.current.pos.x && newHead.y === currentItemRef.current.pos.y) {
              const { item, pos } = currentItemRef.current;

              // Calcular Pontuação com Combo
              const earnedPoints = item.points * combo;
              setScore((prev) => {
                const updated = prev + earnedPoints;
                setHighScore((oldHigh) => {
                  if (updated > oldHigh) {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('vercel_snake_highscore', String(updated));
                    }
                    return updated;
                  }
                  return oldHigh;
                });
                return updated;
              });

              // Atualizar estatísticas e Nível
              setItemsEaten((prev) => {
                const updated = prev + 1;
                if (updated % 5 === 0) {
                  setLevel((lvl) => {
                    soundManager.playLevelUp();
                    addFloatingText(`LEVEL UP! LVL ${lvl + 1}`, CANVAS_WIDTH / 2 - 60, CANVAS_HEIGHT / 2, '#00F0FF');
                    return lvl + 1;
                  });
                }
                return updated;
              });

              // Multiplicador de Combo
              setCombo((c) => Math.min(c + 1, 8));
              if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
              comboTimerRef.current = setTimeout(() => setCombo(1), 4000);

              // Som e partículas
              soundManager.playEat();
              shakeRef.current = item.rarity === 'legendary' ? 12 : 5;
              addParticles(pos.x * CELL_SIZE + CELL_SIZE / 2, pos.y * CELL_SIZE + CELL_SIZE / 2, '#00F0FF', 20);
              addFloatingText(`${item.emoji} +${earnedPoints}`, pos.x * CELL_SIZE, pos.y * CELL_SIZE, item.rarity === 'legendary' ? '#FF0080' : '#00F0FF');

              // APLICAR EFEITO DO ITEM
              if (item.effect === 'speed_up') speedBoostTimeRef.current = 40;
              else if (item.effect === 'slow_down') slowMoTimeRef.current = 40;
              else if (item.effect === 'shield') shieldTimeRef.current = 60;
              else if (item.effect === 'invincible') invincibleTimeRef.current = 50;
              else if (item.effect === 'extra_life') setLives((l) => Math.min(l + 1, 5));
              else if (item.effect === 'shrink') {
                snakeRef.current = snakeRef.current.slice(0, Math.max(3, snakeRef.current.length - 3));
              }

              spawnItem();
            } else {
              // Remover cauda normal se não comeu item
              snakeRef.current.pop();
            }
          }
        }
      }

      // --- 2. RENDERIZAÇÃO NO CANVAS (60 FPS) ---
      ctx.save();
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Aplicar Tremer de Tela (Screen Shake)
      if (shakeRef.current > 0) {
        const rx = (Math.random() - 0.5) * shakeRef.current;
        const ry = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(rx, ry);
        shakeRef.current = Math.max(0, shakeRef.current - 1);
      }

      // Fundo Dark Vercel com Grid Neon sutil
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Desenhar Borda Externa Neon
      ctx.strokeStyle = shieldTimeRef.current > 0 ? '#00F0FF' : invincibleTimeRef.current > 0 ? '#FF0080' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, CANVAS_WIDTH - 4, CANVAS_HEIGHT - 4);

      // Desenhar Item (Emoji Flutuante com brilho)
      if (currentItemRef.current) {
        const { item, pos } = currentItemRef.current;
        const ix = pos.x * CELL_SIZE + CELL_SIZE / 2;
        const iy = pos.y * CELL_SIZE + CELL_SIZE / 2;

        // Halo Iluminado
        const gradient = ctx.createRadialGradient(ix, iy, 2, ix, iy, 18);
        gradient.addColorStop(0, item.rarity === 'legendary' ? 'rgba(255, 0, 128, 0.4)' : 'rgba(0, 240, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ix, iy, 18, 0, Math.PI * 2);
        ctx.fill();

        // Renderizar Emoji
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, ix, iy);
      }

      // Desenhar Cobra (Vercel Neon Gradient Body)
      const snake = snakeRef.current;
      snake.forEach((seg, idx) => {
        const sx = seg.x * CELL_SIZE;
        const sy = seg.y * CELL_SIZE;
        const isHead = idx === 0;

        ctx.beginPath();
        ctx.roundRect(sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2, isHead ? 6 : 4);

        if (isHead) {
          ctx.fillStyle = invincibleTimeRef.current > 0 ? '#FF0080' : shieldTimeRef.current > 0 ? '#00F0FF' : '#FFFFFF';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 10;
        } else {
          const alpha = Math.max(0.2, 1 - idx / (snake.length * 1.2));
          ctx.fillStyle = invincibleTimeRef.current > 0 ? `rgba(255, 0, 128, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
          ctx.shadowBlur = 0;
        }
        ctx.fill();

        // Olhos na Cabeça
        if (isHead) {
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(sx + 6, sy + 6, 2, 0, Math.PI * 2);
          ctx.arc(sx + 14, sy + 6, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.shadowBlur = 0;

      // Desenhar Partículas ("Juice")
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particlesRef.current.splice(idx, 1);
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // Desenhar Textos Flutuantes
      floatingTextsRef.current.forEach((ft, idx) => {
        ft.y -= 1;
        ft.alpha -= 0.02;
        if (ft.alpha <= 0) {
          floatingTextsRef.current.splice(idx, 1);
        } else {
          ctx.save();
          ctx.globalAlpha = ft.alpha;
          ctx.font = 'bold 14px sans-serif';
          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, difficulty, level, combo, spawnItem]);

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
