// Solarpunk Organic Audio & Haptic Feedback Engine
// Synthesizes subtle analog frequencies via Web Audio API with zero external dependencies.

class SoundFeedbackService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hoimu_sound_muted');
      this.isMuted = saved ? JSON.parse(saved) : false;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('hoimu_sound_muted', JSON.stringify(muted));
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Subtle haptic vibration
  private vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignored if permissions or hardware lack vibration
      }
    }
  }

  // Gentle soft click for UI navigation
  public playClick() {
    if (this.isMuted) return;
    this.vibrate(10);
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.045);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // Solarpunk resonant chord for peer discovery or achievement
  public playDiscoveryChime() {
    if (this.isMuted) return;
    this.vibrate([20, 40, 30]);
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25]; // A Major Solarpunk triad

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.03, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.38);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // Success chime for trades, endorsements, and completions
  public playSuccess() {
    this.playDiscoveryChime();
  }

  // RF Packet transmit pulse
  public playPacketTransmit() {
    if (this.isMuted) return;
    this.vibrate(15);
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.05);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // Warning or critical emergency pulse
  public playEmergencyPulse() {
    this.vibrate([100, 50, 100, 50, 150]);
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(640, now + 0.15);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // High-Trust Peer Proximity Entry Notification (Haptic + Harmonious Resonant Chime)
  public playHighTrustProximityNotification() {
    if (this.isMuted) return;
    // Distinctive resonant haptic pattern: double heartbeat pulse + long flourish
    this.vibrate([60, 40, 100, 40, 180]);
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // High-trust Solarpunk pentatonic ascending arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), B5 (987.77), C6 (1046.5)
      const frequencies = [523.25, 659.25, 783.99, 987.77, 1046.5];
      
      frequencies.forEach((freq, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = now + index * 0.055;

        // Sine with slight warm harmonic overtone
        osc.type = index === frequencies.length - 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        // Attack and sustain
        gain.gain.setValueAtTime(0.0001, noteTime);
        gain.gain.linearRampToValueAtTime(0.045, noteTime + 0.015);
        // Exponential tail
        const duration = index === frequencies.length - 1 ? 0.6 : 0.28;
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + duration + 0.05);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

export const soundFeedback = new SoundFeedbackService();
