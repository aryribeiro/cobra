'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSnakeGame, Difficulty } from '../hooks/useSnakeGame';
import { fetchLeaderboardAction, submitScoreAction, startGameSessionAction } from '../app/actions';
import { LeaderboardEntry } from '../lib/db';
import LeaderboardModal from './LeaderboardModal';
import SubmitScoreModal from './SubmitScoreModal';

export default function VercelSnakeGame() {
  const {
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
  } = useSnakeGame();

  // Estados do Leaderboard
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [hasPromptedSubmit, setHasPromptedSubmit] = useState<boolean>(false);

  // Sessão de jogo assinada (anti-cheat): emitida a cada partida nova
  const gameTokenRef = useRef<string | null>(null);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status === 'playing' && (prev === 'menu' || prev === 'gameover')) {
      gameTokenRef.current = null;
      startGameSessionAction()
        .then((r) => { gameTokenRef.current = r.token; })
        .catch(() => { gameTokenRef.current = null; });
    }
  }, [status]);

  // Carregar Ranking inicial (nuvem ou localStorage Fallback)
  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetchLeaderboardAction();
      if (res.online && res.data.length > 0) {
        setLeaderboardEntries(res.data);
      } else {
        // Fallback para localStorage se o banco não estiver configurado
        const localData = localStorage.getItem('vercel_snake_local_top10');
        if (localData) {
          setLeaderboardEntries(JSON.parse(localData));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar leaderboard:', err);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Verificar ao dar Game Over se a pontuação é elegível para o Top 10
  useEffect(() => {
    if (status === 'gameover' && score > 0 && !hasPromptedSubmit) {
      const isTop10 =
        leaderboardEntries.length < 10 ||
        score >= (leaderboardEntries[leaderboardEntries.length - 1]?.score || 0);

      if (isTop10) {
        setShowSubmitModal(true);
        setHasPromptedSubmit(true);
      }
    } else if (status === 'playing') {
      setHasPromptedSubmit(false);
    }
  }, [status, score, leaderboardEntries, hasPromptedSubmit]);

  // Submeter Pontuação (nuvem ou local)
  const handleSubmitScore = async (name: string, emoji: string) => {
    try {
      const res = await submitScoreAction({
        name,
        emoji,
        score,
        itemsEaten,
        token: gameTokenRef.current ?? '',
      });
      if (res.online) {
        if (res.data.length > 0) setLeaderboardEntries(res.data);
      } else {
        // Salvar localmente no fallback
        const newEntry: LeaderboardEntry = {
          id: Date.now(),
          name,
          emoji,
          score,
          created_at: new Date().toISOString(),
        };

        const updated = [...leaderboardEntries, newEntry]
          .sort((a, b) => b.score - a.score || (b.id || 0) - (a.id || 0))
          .slice(0, 10);

        setLeaderboardEntries(updated);
        localStorage.setItem('vercel_snake_local_top10', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Erro ao registrar pontuação:', err);
    } finally {
      setShowSubmitModal(false);
      setShowLeaderboard(true);
    }
  };

  // Swipe detectado DURANTE o movimento do dedo (touchmove), não no soltar —
  // o comando dispara assim que o gesto cruza o limiar, e a âncora re-arma
  // para permitir vários comandos num único arrasto contínuo.
  const touchAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD = 24;

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchAnchorRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const anchor = touchAnchorRef.current;
    if (!anchor) return;
    const touch = e.touches[0];
    const dx = touch.clientX - anchor.x;
    const dy = touch.clientY - anchor.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      changeDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      changeDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
    touchAnchorRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = () => {
    touchAnchorRef.current = null;
  };

  // D-pad: dispara no pointerdown (dedo ENCOSTA), não no click (dedo solta)
  const handleDpadPress = (dir: { x: number; y: number }) => (e: React.PointerEvent) => {
    e.preventDefault();
    changeDirection(dir);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(10); } catch { /* sem suporte */ }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between pt-1 sm:pt-4 pb-1 px-3 select-none font-sans">
      <div className="w-full max-w-[800px] flex flex-col items-center">
        {/* HEADER HUD / BRANDING VERCEL */}
        <header className="w-full mb-1 sm:mb-3 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-0 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded-xl p-2 sm:p-3 shadow-2xl">
          {/* LINHA 1 (MOBILE & PC): LOGO VERCEL + TÍTULO + SLOGAN */}
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="w-7 h-7 bg-white clip-triangle flex items-center justify-center shadow-glow shrink-0">
              <svg width="18" height="18" viewBox="0 0 76 65" fill="none">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="black" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wider bg-gradient-to-r from-white via-zinc-200 to-cyan-400 bg-clip-text text-transparent leading-snug">
                VERCEL SNAKE
              </h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
                Arcade Edition • 40+ Emojis
              </p>
            </div>
          </div>

          {/* LINHA 2 (MOBILE: APÓS QUEBRA) / LADO DIREITO (PC): CORAÇÕES + CONTROLES */}
          <div className="flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto pt-1 sm:pt-0 border-t border-zinc-800/60 sm:border-t-0">
            {/* CORAÇÕES DE VIDA */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`text-lg transition-transform duration-300 ${
                    i < lives ? 'scale-100 opacity-100' : 'scale-75 opacity-20 filter grayscale'
                  }`}
                >
                  ❤️
                </span>
              ))}
            </div>

            {/* BOTÃO RANKING, ÁUDIO E PAUSA */}
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => { e.currentTarget.blur(); setShowLeaderboard(true); }}
                className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-bold text-xs font-mono transition-colors flex items-center space-x-1"
                title="Ver Ranking Top 10"
              >
                <span>🏆</span>
                <span>RANKING</span>
              </button>
              <button
                onClick={(e) => { e.currentTarget.blur(); toggleSound(); }}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-cyan-400 transition-colors text-sm"
                title={isMuted ? 'Desmutar Som' : 'Mutar Som'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              {status === 'playing' && (
                <button
                  onClick={(e) => { e.currentTarget.blur(); pauseGame(); }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold"
                >
                  PAUSAR
                </button>
              )}
            </div>
          </div>
        </header>

        {/* PAINEL DE ESTATÍSTICAS SUPERIOR */}
        <div className="w-full mb-1.5 sm:mb-2 grid grid-cols-4 gap-2 text-center text-xs font-mono">
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-1.5 sm:p-2">
            <div className="text-zinc-500 uppercase text-[10px] sm:text-xs">PONTOS</div>
            <div key={score} className="text-cyan-400 font-bold text-sm sm:text-base animate-stat-pop">{score}</div>
          </div>
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-1.5 sm:p-2">
            <div className="text-zinc-500 uppercase text-[10px] sm:text-xs">RECORDE</div>
            <div key={highScore} className="text-amber-400 font-bold text-sm sm:text-base animate-stat-pop">{highScore}</div>
          </div>
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-1.5 sm:p-2">
            <div className="text-zinc-500 uppercase text-[10px] sm:text-xs">NÍVEL</div>
            <div key={level} className="text-purple-400 font-bold text-sm sm:text-base animate-stat-pop">{level}</div>
          </div>
          <div className={`bg-zinc-950/60 border rounded-lg p-1.5 sm:p-2 transition-colors ${combo >= 4 ? 'border-pink-500/70' : 'border-zinc-800/80'}`}>
            <div className="text-zinc-500 uppercase text-[10px] sm:text-xs">COMBO</div>
            <div key={combo} className="text-pink-400 font-bold text-sm sm:text-base animate-stat-pop">{combo}x</div>
          </div>
        </div>

        {/* INDICADOR DE EFEITO ATIVO */}
        {activeItemEffect && (
          <div className="w-full mb-1.5 sm:mb-2 text-center">
            <span className="inline-block px-3 py-1 bg-cyan-950/80 border border-cyan-500/50 rounded-full text-cyan-300 text-xs font-mono font-semibold animate-pulse">
              ✨ EFEITO ATIVO: {activeItemEffect.toUpperCase()}
            </span>
          </div>
        )}

        {/* CONTAINER DO CANVAS COM OVERLAYS */}
        <div className={`relative w-full aspect-[4/3] bg-zinc-950 border rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${activeItemEffect ? 'border-cyan-500/70 shadow-glow' : 'border-zinc-800'}`}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full h-full object-contain cursor-crosshair touch-none"
          />

          {/* OVERLAY: MENU INICIAL */}
          {status === 'menu' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-16 h-16 bg-white clip-triangle flex items-center justify-center mb-4 animate-bounce">
                <svg width="40" height="40" viewBox="0 0 76 65" fill="none">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="black" />
                </svg>
              </div>
              <h2 className="text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-300 to-purple-500 mb-2">
                VERCEL SNAKE
              </h2>
              <p className="text-zinc-400 text-xs max-w-md mb-4 font-mono">
                O clássico da Nokia com físicas Canvas, 40+ emojis, ranking global e personalização de avatar.
              </p>

              {/* SELEÇÃO DE DIFICULDADE */}
              <div className="mb-5 w-full max-w-sm">
                <label className="block text-xs uppercase font-mono text-zinc-400 mb-2">
                  Dificuldade
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['easy', 'medium', 'hard', 'insane'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => startGame(d)}
                      className={`py-2 rounded-lg text-xs font-bold uppercase transition-all border ${
                        difficulty === d
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow-glow'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : d === 'hard' ? 'Difícil' : 'Insano'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center">
                <button
                  onClick={() => startGame()}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold text-sm uppercase tracking-wider hover:opacity-95 shadow-glow transition-all transform hover:scale-105"
                >
                  INICIAR JOGO ▶
                </button>
              </div>
            </div>
          )}

          {/* OVERLAY: PAUSADO */}
          {status === 'paused' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <h3 className="text-2xl font-bold tracking-widest text-cyan-400 mb-4">JOGO PAUSADO</h3>
              <button
                onClick={pauseGame}
                className="px-6 py-2.5 rounded-lg bg-cyan-500 text-black font-bold text-xs uppercase tracking-wider hover:bg-cyan-400"
              >
                CONTINUAR (P)
              </button>
            </div>
          )}

          {/* OVERLAY: GAME OVER */}
          {status === 'gameover' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="text-4xl mb-2">💥</div>
              <h3 className="text-3xl font-extrabold text-red-500 tracking-wider mb-2">GAME OVER</h3>
              <p className="text-zinc-400 text-xs font-mono mb-4">A sua cobrinha chegou ao fim!</p>

              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 w-full max-w-xs mb-6 text-xs font-mono space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pontuação Final:</span>
                  <span className="text-cyan-400 font-bold">{score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Recorde Atual:</span>
                  <span className="text-amber-400 font-bold">{highScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Itens Coletados:</span>
                  <span className="text-purple-400 font-bold">{itemsEaten}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Nível Alcançado:</span>
                  <span className="text-pink-400 font-bold">{level}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => startGame()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 shadow-glow"
                >
                  JOGAR NOVAMENTE 🔄
                </button>
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="px-5 py-3 rounded-xl bg-zinc-900 border border-amber-500/60 hover:border-amber-400 text-amber-300 font-bold text-xs uppercase tracking-wider"
                >
                  🏆 RANKING
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL DE REGISTRO DE SCORE */}
        {showSubmitModal && (
          <SubmitScoreModal
            score={score}
            onSubmit={handleSubmitScore}
            onClose={() => setShowSubmitModal(false)}
          />
        )}

        {/* MODAL DE LEADERBOARD TOP 10 */}
        {showLeaderboard && (
          <LeaderboardModal
            entries={leaderboardEntries}
            onClose={() => setShowLeaderboard(false)}
          />
        )}

        {/* D-PAD VIRTUAL PARA CONTROLES DE TOQUE MOBILE */}
        <div className="w-full mt-1 sm:mt-4 flex flex-col items-center justify-center md:hidden">
          <div className="grid grid-cols-3 gap-1 w-36">
            <div />
            <button
              onPointerDown={handleDpadPress({ x: 0, y: -1 })}
              className="h-9 rounded-lg bg-zinc-900 active:bg-cyan-500 active:text-black active:scale-95 border border-zinc-700 text-base font-bold flex items-center justify-center shadow touch-none select-none transition-transform"
            >
              ▲
            </button>
            <div />
            <button
              onPointerDown={handleDpadPress({ x: -1, y: 0 })}
              className="h-9 rounded-lg bg-zinc-900 active:bg-cyan-500 active:text-black active:scale-95 border border-zinc-700 text-base font-bold flex items-center justify-center shadow touch-none select-none transition-transform"
            >
              ◀
            </button>
            <button
              onPointerDown={handleDpadPress({ x: 0, y: 1 })}
              className="h-9 rounded-lg bg-zinc-900 active:bg-cyan-500 active:text-black active:scale-95 border border-zinc-700 text-base font-bold flex items-center justify-center shadow touch-none select-none transition-transform"
            >
              ▼
            </button>
            <button
              onPointerDown={handleDpadPress({ x: 1, y: 0 })}
              className="h-9 rounded-lg bg-zinc-900 active:bg-cyan-500 active:text-black active:scale-95 border border-zinc-700 text-base font-bold flex items-center justify-center shadow touch-none select-none transition-transform"
            >
              ▶
            </button>
          </div>
          <p className="text-[9px] text-zinc-500 font-mono mt-0">
            Botões virtuais ou deslize o dedo
          </p>
        </div>

        {/* INFORMAÇÃO CONTROLES PC */}
        <p className="hidden md:block mt-4 text-center text-zinc-500 text-xs font-mono">
          Controles PC: <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-300">W</kbd>{' '}
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-300">A</kbd>{' '}
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-300">S</kbd>{' '}
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-300">D</kbd> ou Setas Direcionais | <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-300">Espaço</kbd> para Pausar
        </p>
      </div>

      {/* RODAPÉ FIXO NO FUNDO DA TELA (MOBILE: FIXED / PC: NORMAL) */}
      <footer className="fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto sm:left-auto sm:right-auto w-full max-w-[800px] sm:mx-auto sm:mt-auto pt-1 sm:pt-4 pb-1 sm:pb-1 text-center bg-black/90 sm:bg-transparent z-50">
        <p className="text-zinc-400 text-xs font-sans">
          <span className="italic">por </span>
          <a
            href="https://www.linkedin.com/in/aryribeiro"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-white hover:text-cyan-400 underline transition-colors"
          >
            Ary Ribeiro
          </a>
        </p>
      </footer>
    </div>
  );
}
