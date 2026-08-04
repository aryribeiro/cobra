export interface AvatarEmoji {
  emoji: string;
  name: string;
  category: 'animals' | 'people' | 'fantasy' | 'faces';
}

export const AVATAR_EMOJIS: AvatarEmoji[] = [
  // --- ANIMAIS (16 Emojis) ---
  { emoji: '🐍', name: 'Cobra Vercel', category: 'animals' },
  { emoji: '🐉', name: 'Dragão Neon', category: 'animals' },
  { emoji: '🦖', name: 'T-Rex Alpha', category: 'animals' },
  { emoji: '🦊', name: 'Raposa Hacker', category: 'animals' },
  { emoji: '🦁', name: 'Leão Rei', category: 'animals' },
  { emoji: '🐼', name: 'Panda Gamer', category: 'animals' },
  { emoji: '🐨', name: 'Koala Chill', category: 'animals' },
  { emoji: '🐯', name: 'Tigre Turbo', category: 'animals' },
  { emoji: '🦄', name: 'Unicórnio Mágico', category: 'animals' },
  { emoji: '🐙', name: 'Polvo Dev', category: 'animals' },
  { emoji: '🦅', name: 'Águia Real', category: 'animals' },
  { emoji: '🦉', name: 'Coruja Neon', category: 'animals' },
  { emoji: '🦈', name: 'Tubarão Pro', category: 'animals' },
  { emoji: '🐸', name: 'Sapo Pepe', category: 'animals' },
  { emoji: '🐵', name: 'Macaco Coder', category: 'animals' },
  { emoji: '🐝', name: 'Abelha Operária', category: 'animals' },

  // --- PESSOAS E DIVERSIDADE (15 Emojis) ---
  { emoji: '🥷', name: 'Ninja Dev', category: 'people' },
  { emoji: '🧙‍♂️', name: 'Mago dos Códigos', category: 'people' },
  { emoji: '👩‍💻', name: 'Dev Sênior (Ela)', category: 'people' },
  { emoji: '👨‍💻', name: 'Dev Sênior (Ele)', category: 'people' },
  { emoji: '👩‍🚀', name: 'Astronauta (Ela)', category: 'people' },
  { emoji: '👨‍🚀', name: 'Astronauta (Ele)', category: 'people' },
  { emoji: '🦸‍♀️', name: 'Super-Heroína', category: 'people' },
  { emoji: '🦸‍♂️', name: 'Super-Herói', category: 'people' },
  { emoji: '🕵️‍♀️', name: 'Detetive Tech', category: 'people' },
  { emoji: '👨‍🎤', name: 'Rockstar Coder', category: 'people' },
  { emoji: '👸', name: 'Princesa Cyber', category: 'people' },
  { emoji: '🤴', name: 'Príncipe Pixel', category: 'people' },
  { emoji: '👰‍♀️', name: 'Noiva Hacker', category: 'people' },
  { emoji: '🤵‍♂️', name: 'Lord Vercel', category: 'people' },
  { emoji: '🧕', name: 'Engenheira Cyber', category: 'people' },

  // --- FANTASIA & ROBÔS (10 Emojis) ---
  { emoji: '🤖', name: 'Vercel Bot AI', category: 'fantasy' },
  { emoji: '👾', name: 'Pixel Alien', category: 'fantasy' },
  { emoji: '🛸', name: 'OVNI Suprenutro', category: 'fantasy' },
  { emoji: '👻', name: 'Fantasma Code', category: 'fantasy' },
  { emoji: '💀', name: 'Skull Pro', category: 'fantasy' },
  { emoji: '🧌', name: 'Goblin Tech', category: 'fantasy' },
  { emoji: '👺', name: 'Tengu Neon', category: 'fantasy' },
  { emoji: '👹', name: 'Ogre Master', category: 'fantasy' },
  { emoji: '🧟', name: 'Zombie Dev', category: 'fantasy' },
  { emoji: '🧛‍♂️', name: 'Vampiro Night', category: 'fantasy' },

  // --- CARAS E EXPRESSÕES HILÁRIAS (9 Emojis) ---
  { emoji: '😎', name: 'Chefão Óculos', category: 'faces' },
  { emoji: '🤯', name: 'Mente Explodida', category: 'faces' },
  { emoji: '🥳', name: 'Festeiro Top', category: 'faces' },
  { emoji: '🤪', name: 'Crazy Gamer', category: 'faces' },
  { emoji: '🤠', name: 'Cowboy Tech', category: 'faces' },
  { emoji: '🥸', name: 'Disfarçado', category: 'faces' },
  { emoji: '👽', name: 'Alien de Marte', category: 'faces' },
  { emoji: '🤡', name: 'Clown Pro', category: 'faces' },
  { emoji: '😈', name: 'Devil Gamer', category: 'faces' },
];
