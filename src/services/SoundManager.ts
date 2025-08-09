import { getBasePath } from '../utils/paths';

const SOUND_NAMES = [
  'capture',
  'castle',
  'check',
  'gameEnd',
  'gameStart',
  'illegalMove',
  'opponentMove',
  'playerMove',
  'premove',
  'promote',
];

class SoundManager {
  audioContext: AudioContext;
  audioBuffers: Map<string, AudioBuffer>;
  preloaded: boolean;
  globalVolume: number;

  constructor() {
    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    if (!this.audioContext) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    this.audioBuffers = new Map();
    this.preloaded = false;
    this.globalVolume = 1;
  }

  async _ensureAudioContextReady(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async preloadAllSounds(): Promise<void> {
    if (this.preloaded) return;
    const basePath = getBasePath();
    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        try {
          const response = await fetch(`${basePath}/sounds/${name}.mp3`);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.audioContext.decodeAudioData(
            arrayBuffer
          );
          this.audioBuffers.set(name, audioBuffer);
        } catch (error) {
          console.error(`Failed to load sound: ${name}`, error);
        }
      })
    );
    this.preloaded = true;
  }

  async play(name: string, volume: number = 1): Promise<void> {
    await this._ensureAudioContextReady();
    if (!this.preloaded) await this.preloadAllSounds();

    const buffer = this.audioBuffers.get(name);
    if (!buffer) {
      console.error(`Sound "${name}" not loaded.`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume * this.globalVolume;

    source.buffer = buffer;
    source.connect(gainNode).connect(this.audioContext.destination);
    source.start();
  }

  setGlobalVolume(volume: number): void {
    if (volume < 0 || volume > 1 || volume === this.globalVolume) return;
    this.globalVolume = volume;
  }

  playMoveSound(
    moveType:
      | 'capture'
      | 'castle'
      | 'check'
      | 'checkmate'
      | 'gameEnd'
      | 'gameStart'
      | 'illegalMove'
      | 'opponentMove'
      | 'playerMove'
      | 'premove'
      | 'promote'
  ): void {
    if (moveType === 'checkmate') {
      this.play('check', 1);
      this.play('gameEnd', 1);
      return;
    }
    const sound = SOUND_NAMES.includes(moveType) ? moveType : 'playerMove';
    this.play(sound, 1);
  }

  playGameStateSound(state: 'start' | 'end' | 'draw'): void {
    switch (state) {
      case 'start':
        this.play('gameStart', 1);
        break;
      case 'end':
      case 'draw':
        this.play('gameEnd', 1);
        break;
    }
  }
}

const soundManager = new SoundManager();
export default soundManager;
