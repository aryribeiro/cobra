// Reprodução de SFX a partir de arquivos WAV locais (public/sounds/*).
// Sem dependência de terceiros: os áudios ficam no repositório e são
// decodificados uma vez para AudioBuffers (baixa latência, permitem overlap).

type SfxName = 'eat' | 'powerup' | 'hit' | 'levelup' | 'gameover';

const SFX_FILES: Record<SfxName, string> = {
  eat: '/sounds/eat.wav',
  powerup: '/sounds/powerup.wav',
  hit: '/sounds/hit.wav',
  levelup: '/sounds/levelup.wav',
  gameover: '/sounds/gameover.wav',
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private buffers: Partial<Record<SfxName, AudioBuffer>> = {};
  private loadStarted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('vercel_snake_muted');
      this.isMuted = savedMute === 'true';
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  // Carrega e decodifica todos os SFX uma única vez.
  private loadAll() {
    if (this.loadStarted || !this.ctx) return;
    this.loadStarted = true;
    (Object.keys(SFX_FILES) as SfxName[]).forEach(async (name) => {
      try {
        const res = await fetch(SFX_FILES[name]);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx!.decodeAudioData(arr);
        this.buffers[name] = buf;
      } catch {
        /* arquivo indisponível — som apenas não toca */
      }
    });
  }

  // Pré-aquece no gesto do usuário (clique de iniciar): cria o contexto e
  // dispara o carregamento, pagando o custo ANTES do jogo começar.
  public warmUp() {
    this.initCtx();
    this.loadAll();
  }

  private play(name: SfxName, volume = 1) {
    if (this.isMuted) return;
    this.initCtx();
    this.loadAll();
    if (!this.ctx) return;
    const buffer = this.buffers[name];
    if (!buffer) return; // ainda decodificando: ignora em vez de travar
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vercel_snake_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playEat() { this.play('eat'); }
  public playPowerup() { this.play('powerup'); }
  public playHit() { this.play('hit'); }
  public playLevelUp() { this.play('levelup'); }
  public playGameOver() { this.play('gameover'); }
}

export const soundManager = new SoundManager();
