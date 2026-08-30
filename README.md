# 🐍 Vercel Snake • Next-Gen Arcade Game

Web game arcade inspirado no clássico jogo da cobrinha (Nokia), reimaginado com a identidade visual da **Vercel** (dark mode obsidian, neon cyan/purple gradients e glassmorphism), renderização via HTML5 Canvas (60 FPS), 40+ emojis de itens com efeitos especiais, efeitos sonoros em arquivos locais (sem dependência externa), **Ranking Top 10 Global na nuvem** e suporte completo para PC, Tablet e Smartphone.

🌐 **URL Oficial do Projeto**: [https://snake2026.vercel.app](https://snake2026.vercel.app)

---

## 🚀 Funcionalidades

- **🏆 Ranking Top 10 Global**:
  - Persistência permanente em banco de dados na nuvem.
  - **Anti-cheat no servidor**: sessão de jogo assinada, validação de plausibilidade da pontuação e limite de submissões — pontuações forjadas são rejeitadas silenciosamente.
  - Seletor de Avatares com **44+ emojis engraçados** (Animais 🐍🦊🐼, Pessoas 🥷🧙‍♂️, Fantasia 🤖👾, Expressões 😎🤯).
  - Sistema de **Desempate Inteligente**: em empates de pontuação, o jogador mais recente assume automaticamente a posição mais alta no pódio.
  - **Fallback Gracioso**: sem credenciais do banco, o jogo utiliza `localStorage` sem interromper a partida.
- **⚡ Renderização HTML5 Canvas (60 FPS)**: Resolução nativa de 800x600 px escalada responsivamente mantendo a proporção de aspecto.
- **⚡ Input Imediato (v0.2.0)**:
  - D-Pad mobile dispara no **toque** (`pointerdown`), não no soltar do dedo.
  - Swipe detectado **durante o gesto** (`touchmove`) com re-arme — vários comandos num único arrasto.
  - Timestep fixo com acumulador: o relógio do jogo nunca engasga (nem ao comer itens, nem ao voltar de outra aba).
  - Fila de direções curta (2) onde o comando mais novo sempre vence — sem curvas "fantasma".
  - Regra clássica de cauda: mover para a célula que a cauda desocupa no mesmo tick não é colisão.
- **✨ Game Juice & Sensação de Jogo**:
  - **Movimento interpolado a 60 FPS**: a cobra desliza suavemente entre as células em vez de teleportar.
  - Tremores de tela (*Screen Shake*) em colisões com a borda e itens lendários.
  - Flashes de tela (dano, level up, item lendário), anéis de choque e pulso da cabeça ao comer.
  - Olhos da cobrinha acompanham a direção do movimento; itens flutuam com halo pulsante e pop de spawn.
  - Vibração háptica no mobile (comer, dano, game over).
  - Efeitos sonoros em **arquivos WAV locais** (`public/sounds/`), decodificados uma vez e tocados com baixa latência — sem dependência de serviços de áudio externos.
  - Partículas visuais, rastro de faíscas no turbo e popups de texto flutuantes ("+500", "COMBO x4!", "SHIELD BOUNCE!").
- **👻 Mecânicas de Sobrevivência (v0.8.0)**:
  - **Modo Fantasma** (👻/😇): a cobrinha atravessa o próprio corpo por alguns segundos.
  - **Invencibilidade Arco-Íris** (🌟/🛸/🔱): atravessa paredes e o próprio corpo, com a cobra em cores de arco-íris e rastro cintilante.
  - Borda da arena pulsa e muda de cor conforme o efeito ativo.
- **🍎 40+ Emojis & Power-ups**:
  - 25 comidas comuns (🍎, 🍌, 🍕, 🍔, 🍓, 🥑, 🥩...).
  - 17 power-ups especiais: 🚀 Turbo Speed, 🐢 Slow Motion, 🛡️ Escudo de Borda, 🔮 Esfera Encolhedora, 💖 Vida Extra, 🌟 Estrela Invencível, 💎 Diamantes.
- **❤️ Mecânica Inovadora de Borda**:
  - Sistema de 3 Vidas (❤️).
  - Colidir com a parede sem escudo encolhe a cobrinha em 3 segmentos e remove 1 vida, evitando morte instantânea punitiva.
- **🎮 Controles Responsivos**:
  - **PC**: Teclas WASD ou Setas Direcionais com fila de entradas (*direction queue*) impedindo giro acidental de 180°.
  - **Mobile / Tablet**: D-Pad virtual interativo na tela + gestos de toque (*swipe*).

---

## 🛠️ Como Configurar e Rodar Localmente

1. **Clonar e instalar dependências**:
```bash
npm install
```

2. **Configurar variáveis de ambiente do banco (Opcional)**:
Copie o exemplo para `.env.local` e insira as credenciais do seu banco de dados:
```bash
cp .env.local.example .env.local
```

Conteúdo de `.env.local`:
```env
DB_URL="url-do-seu-banco"
DB_AUTH_TOKEN="seu-auth-token-aqui"
```

3. **Rodar o servidor de desenvolvimento**:
```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

---

## 📦 Deploy na Vercel

O deploy é gerenciado via Vercel CLI:

```bash
npx vercel --prod
```
