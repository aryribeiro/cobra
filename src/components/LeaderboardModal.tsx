'use client';

import React from 'react';
import { LeaderboardEntry } from '../lib/turso';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  isTurso: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ entries, isTurso, onClose }: LeaderboardModalProps) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white font-bold text-lg"
        >
          ✕
        </button>

        <div className="text-center mb-5">
          <div className="text-4xl mb-1">🏆</div>
          <h2 className="text-2xl font-extrabold tracking-widest bg-gradient-to-r from-amber-300 via-cyan-400 to-purple-400 bg-clip-text text-transparent uppercase">
            RANKING TOP 10 GLOBAL
          </h2>
          <p className="text-zinc-400 text-xs font-mono mt-1 flex items-center justify-center space-x-1">
            <span>Servidor:</span>
            {isTurso ? (
              <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
                ⚡ Turso Cloud SQLite
              </span>
            ) : (
              <span className="text-amber-400 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-700/50">
                💾 Armazenamento Local
              </span>
            )}
          </p>
        </div>

        {/* TABELA TOP 10 */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden mb-4">
          <div className="grid grid-cols-12 gap-2 p-3 text-[11px] font-mono uppercase text-zinc-500 border-b border-zinc-800 font-semibold">
            <div className="col-span-2 text-center">POS</div>
            <div className="col-span-6">JOGADOR</div>
            <div className="col-span-4 text-right">PONTOS</div>
          </div>

          <div className="divide-y divide-zinc-800/50 max-h-72 overflow-y-auto custom-scrollbar">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                Nenhum recorde registrado ainda. Seja o primeiro a entrar no Top 10! 🐍
              </div>
            ) : (
              entries.slice(0, 10).map((item, idx) => {
                const rank = idx + 1;
                const isGold = rank === 1;
                const isSilver = rank === 2;
                const isBronze = rank === 3;

                return (
                  <div
                    key={item.id || idx}
                    className={`grid grid-cols-12 gap-2 p-3 items-center text-xs font-mono transition-colors ${
                      isGold
                        ? 'bg-amber-950/20 text-amber-300 font-bold'
                        : isSilver
                        ? 'bg-slate-900/40 text-slate-200'
                        : isBronze
                        ? 'bg-orange-950/20 text-orange-300'
                        : 'hover:bg-zinc-800/40 text-zinc-300'
                    }`}
                  >
                    {/* POSIÇÃO E MEDALHA */}
                    <div className="col-span-2 text-center font-extrabold text-sm flex items-center justify-center">
                      {isGold ? '🥇 1º' : isSilver ? '🥈 2º' : isBronze ? '🥉 3º' : `${rank}º`}
                    </div>

                    {/* JOGADOR & AVATAR EMOJI */}
                    <div className="col-span-6 flex items-center space-x-2 truncate">
                      <span className="text-xl leading-none">{item.emoji || '🐍'}</span>
                      <span className="truncate font-semibold">{item.name || 'Anônimo'}</span>
                    </div>

                    {/* PONTUAÇÃO */}
                    <div className="col-span-4 text-right font-extrabold text-cyan-400 text-sm">
                      {item.score.toLocaleString()} pts
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-colors"
        >
          FECHAR RANKING
        </button>
      </div>
    </div>
  );
}
