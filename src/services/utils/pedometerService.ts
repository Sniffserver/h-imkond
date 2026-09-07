import { Motion } from '@capacitor/motion';
import { Capacitor } from '@capacitor/core';

export interface StepUpdate {
  steps: number;
  distanceMeters: number;
  timestamp: number;
}

class PedometerService {
  private totalSteps = 0;
  private listeners: ((update: StepUpdate) => void)[] = [];
  private isTracking = false;

  constructor() {
    // Attempt to restore steps from localStorage to keep state persistent
    try {
      const stored = localStorage.getItem('hoimu_pedometer_steps');
      if (stored) {
        this.totalSteps = parseInt(stored, 10) || 0;
      }
    } catch {
      this.totalSteps = 0;
    }
  }

  /**
   * Alusta sammude lugemist. Native keskkonnas kasutab seadme sammulugejat,
   * veebis simuleerib või kasutab DeviceMotion API-t.
   */
  async startTracking(): Promise<void> {
    if (this.isTracking) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await Motion.addListener('accel', (event) => {
          this.processAcceleration(event.acceleration);
        });
      } catch (e) {
        console.warn('[Pedometer] Failed to add native listener:', e);
        // Fallback to web devicemotion
        window.addEventListener('devicemotion', this.handleDeviceMotion);
      }
    } else {
      window.addEventListener('devicemotion', this.handleDeviceMotion);
    }

    this.isTracking = true;
    this.notifyListeners();
  }

  /**
   * Peata sammude lugemine.
   */
  async stopTracking(): Promise<void> {
    if (!this.isTracking) return;
    
    if (Capacitor.isNativePlatform()) {
      try {
        await Motion.removeAllListeners();
      } catch {
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
      }
    } else {
      window.removeEventListener('devicemotion', this.handleDeviceMotion);
    }
    
    this.isTracking = false;
    this.notifyListeners();
  }

  /**
   * Simuleeri käsitsi samme (väga kasulik veebis või simulaatoris testimiseks!)
   */
  simulateSteps(count: number = 100): void {
    this.totalSteps += count;
    this.persistSteps();
    this.notifyListeners();
  }

  /**
   * Nulli sammude lugemine.
   */
  reset(): void {
    this.totalSteps = 0;
    this.persistSteps();
    this.notifyListeners();
  }

  /**
   * Töötle kiirendusandmeid ja tuvasta sammud.
   * Kasutab lihtsat lävipõhist algoritmi.
   */
  private processAcceleration(accel: { x: number; y: number; z: number }): void {
    const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
    
    // Lävi sammu tuvastamiseks (tavaliselt 9.8 + 1.5 = ~11.3 m/s²)
    if (magnitude > 11.3) {
      this.totalSteps++;
      this.persistSteps();
      this.notifyListeners();
    }
  }

  private handleDeviceMotion = (event: DeviceMotionEvent): void => {
    const accel = event.accelerationIncludingGravity;
    if (accel) {
      this.processAcceleration({ x: accel.x || 0, y: accel.y || 0, z: accel.z || 0 });
    }
  };

  private persistSteps(): void {
    try {
      localStorage.setItem('hoimu_pedometer_steps', String(this.totalSteps));
    } catch (e) {
      console.warn('[Pedometer] LocalStorage write error:', e);
    }
  }

  /**
   * Tagasta praegune sammude arv.
   */
  getTotalSteps(): number {
    return this.totalSteps;
  }

  /**
   * Arvuta läbitud vahemaa (eeldusel, et üks samm ≈ 0.75m).
   */
  getDistanceMeters(): number {
    return this.totalSteps * 0.75;
  }

  /**
   * Lisa kuulaja sammude uuendustele.
   */
  addListener(callback: (update: StepUpdate) => void): () => void {
    this.listeners.push(callback);
    // Return unsubscribe trigger
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    const update: StepUpdate = {
      steps: this.totalSteps,
      distanceMeters: this.getDistanceMeters(),
      timestamp: Date.now(),
    };
    this.listeners.forEach(l => l(update));
  }
}

export const pedometerService = new PedometerService();
