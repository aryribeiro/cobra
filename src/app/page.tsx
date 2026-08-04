import VercelSnakeGame from '../components/VercelSnakeGame';

export const metadata = {
  title: 'Vercel Snake • Next-Gen Arcade Game',
  description: 'Jogo da cobrinha (Snake) no estilo Vercel Arcade com 40+ emojis, físicas de canvas, tremores de tela, áudio e controles WASD / toque.',
};

export default function Home() {
  return (
    <main className="w-full min-h-screen bg-black flex items-center justify-center">
      <VercelSnakeGame />
    </main>
  );
}
