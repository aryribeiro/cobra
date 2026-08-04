'use client';

import React, { useState } from 'react';
import { AVATAR_EMOJIS, AvatarEmoji } from '../lib/avatars';

interface SubmitScoreModalProps {
  score: number;
  onSubmit: (name: string, emoji: string) => void;
  onClose: () => void;
}

export default function SubmitScoreModal({ score, onSubmit, onClose }: SubmitScoreModalProps) {
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<AvatarEmoji>(AVATAR_EMOJIS[0]);
  const [filterCategory, setFilterCategory] = useState<'all' | 'animals' | 'people' | 'fantasy' | 'faces'>('all');

  const filteredEmojis = filterCategory === 'all' 
    ? AVATAR_EMOJIS 
    : AVATAR_EMOJIS.filter((a) => a.category === filterCategory);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || 'Snake Master';
    onSubmit(finalName, selectedEmoji.emoji);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white font-bold text-lg"
        >
          ✕
        </button>

        <div className="text-center mb-4">
          <div className="text-4xl mb-1">🎉🏆</div>
          <h2 className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-amber-300 via-cyan-400 to-purple-400 bg-clip-text text-transparent uppercase">
            NOVO RECORDE TOP 10!
          </h2>
          <p className="text-zinc-400 text-xs font-mono mt-1">
            Sua pontuação de <span className="text-cyan-400 font-bold text-sm">{score} pts</span> entrou para o Ranking!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* NOME DO JOGADOR */}
          <div>
            <label className="block text-xs uppercase font-mono text-zinc-400 mb-1">
              Seu Nome / Apelido
            </label>
            <input
              type="text"
              maxLength={12}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome (máx. 12)"
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 font-mono outline-none transition-all"
            />
          </div>

          {/* SELETOR DE EMOJIS DE AVATAR */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs uppercase font-mono text-zinc-400">
                Escolha seu Avatar Emoji ({AVATAR_EMOJIS.length} disponíveis)
              </label>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {selectedEmoji.emoji} {selectedEmoji.name}
              </span>
            </div>

            {/* ABAS DE CATEGORIA */}
            <div className="flex space-x-1 mb-2 text-[10px] font-mono uppercase">
              {(['all', 'animals', 'people', 'fantasy', 'faces'] as const).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    filterCategory === cat
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat === 'animals' ? 'Animais' : cat === 'people' ? 'Pessoas' : cat === 'fantasy' ? 'Fantasia' : 'Caras'}
                </button>
              ))}
            </div>

            {/* GRADE ROLÁVEL DE EMOJIS */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 max-h-44 overflow-y-auto grid grid-cols-6 gap-2 custom-scrollbar">
              {filteredEmojis.map((item, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setSelectedEmoji(item)}
                  className={`h-11 rounded-xl text-xl flex items-center justify-center transition-all transform hover:scale-110 ${
                    selectedEmoji.emoji === item.emoji
                      ? 'bg-cyan-950 border-2 border-cyan-400 shadow-glow scale-105'
                      : 'bg-zinc-950 border border-zinc-800 hover:border-zinc-600'
                  }`}
                  title={item.name}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-cyan-500 to-purple-500 text-black font-extrabold text-sm uppercase tracking-wider hover:opacity-95 shadow-glow transition-all"
          >
            SALVAR NO RANKING TOP 10 🚀
          </button>
        </form>
      </div>
    </div>
  );
}
