/**
 * Dead Reckoning Service for HÕIMU
 * Provides continuous dead reckoning position tracking using DeviceMotionEvent (accelerometer)
 * and DeviceOrientationEvent (magnetometer/compass heading) when GPS signal is lost or degraded
 * (indoors, dense forest, jamming, underground).
 */

export interface DeadReckoningState {
  isActive: boolean;             // True when dead reckoning is active (GPS accuracy > 50m or GPS lost > 10s)
  currentLat: number;            // Current estimated latitude
  currentLng: number;            // Current estimated longitude
  currentX: number;              // Local grid X in meters
  currentY: number;              // Local grid Y in meters
  headingDegrees: number;        // Current heading in degrees (0 = North, 90 = East, 180 = South, 270 = West)
  driftEstimateMeters: number;   // Accumulated drift error estimate in meters
  confidencePercent: number;     // Confidence score 0 - 100%
  stepCount: number;             // Total steps taken during dead reckoning mode
  lastGpsFixTime: number | null; // Timestamp of last valid GPS fix
  lastGpsAccuracy: number;       // Last known GPS accuracy in meters
  reason: 'normal' | 'gps_lost' | 'low_accuracy';
}

export type DeadReckoningListener = (state: DeadReckoningState) => void;

class DeadReckoningService {
  private state: DeadReckoningState = {
    isActive: false,
    currentLat: 58.3780,
    currentLng: 26.7290,
    currentX: 0,
    currentY: 0,
    headingDegrees: 0,
    driftEstimateMeters: 0,
    confidencePercent: 100,
    stepCount: 0,
    lastGpsFixTime: Date.now(),
    lastGpsAccuracy: 10,
    reason: 'normal',
  };

  private listeners: DeadReckoningListener[] = [];
  private isListening = false;
  private lastStepTimestamp = 0;
  private stepLengthMeters = 0.75; // Average step length
  private checkGpsIntervalId: any = null;
  private driftTimerId: any = null;

  constructor() {
    // Restore saved state from localStorage if available
    try {
      const saved = localStorage.getItem('hoimu_dead_reckoning_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = {
          ...this.state,
          ...parsed,
          // Re-evaluate isActive based on last fix time
          isActive: parsed.isActive || false,
        };
      }
    } catch {}
  }

  /**
   * Start listening to device sensors (Motion & Orientation)
   */
  public startTracking(): void {
    if (this.isListening) return;

    if (typeof window !== 'undefined') {
      window.addEventListener('devicemotion', this.handleDeviceMotion);
      window.addEventListener('deviceorientation', this.handleDeviceOrientation);
    }

    // Periodic check for GPS timeout (> 10s without GPS update or accuracy > 50m)
    this.checkGpsIntervalId = setInterval(() => {
      this.evaluateGpsHealth();
    }, 2000);

    // Periodic drift estimation timer when dead reckoning is active
    this.driftTimerId = setInterval(() => {
      if (this.state.isActive) {
        // Accumulate baseline time-based sensor drift (0.15m per second)
        this.state.driftEstimateMeters += 0.15;
        this.recalculateConfidence();
        this.notifyListeners();
      }
    }, 1000);

    this.isListening = true;
    this.notifyListeners();
  }

  /**
   * Stop listening to device sensors
   */
  public stopTracking(): void {
    if (!this.isListening) return;

    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleDeviceMotion);
      window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
    }

    if (this.checkGpsIntervalId) {
      clearInterval(this.checkGpsIntervalId);
      this.checkGpsIntervalId = null;
    }

    if (this.driftTimerId) {
      clearInterval(this.driftTimerId);
      this.driftTimerId = null;
    }

    this.isListening = false;
  }

  /**
   * Update dead reckoning service with latest GPS update
   */
  public updateGpsFix(lat: number, lng: number, accuracy: number, timestamp: number = Date.now(), x?: number, y?: number): void {
    this.state.lastGpsFixTime = timestamp;
    this.state.lastGpsAccuracy = accuracy;

    if (accuracy > 50) {
      // GPS accuracy degraded > 50m
      if (!this.state.isActive) {
        this.state.isActive = true;
        this.state.reason = 'low_accuracy';
        this.state.driftEstimateMeters = accuracy;
      }
    } else {
      // Valid GPS return (accuracy <= 50m) -> GPS Snap & Drift Correction
      if (this.state.isActive) {
        // Snap back to GPS
        this.state.currentLat = lat;
        this.state.currentLng = lng;
        if (x !== undefined) this.state.currentX = x;
        if (y !== undefined) this.state.currentY = y;

        // Reset accumulated drift error
        this.state.driftEstimateMeters = 0;
        this.state.stepCount = 0;
        this.state.isActive = false;
        this.state.reason = 'normal';
        this.state.confidencePercent = 100;
      } else {
        this.state.currentLat = lat;
        this.state.currentLng = lng;
        if (x !== undefined) this.state.currentX = x;
        if (y !== undefined) this.state.currentY = y;
        this.state.driftEstimateMeters = 0;
        this.state.confidencePercent = 100;
      }
    }

    this.persistState();
    this.notifyListeners();
  }

  /**
   * Manual position correction ("I am here" button on map)
   */
  public manualResetPosition(lat: number, lng: number, x?: number, y?: number): void {
    this.state.currentLat = lat;
    this.state.currentLng = lng;
    if (x !== undefined) this.state.currentX = x;
    if (y !== undefined) this.state.currentY = y;

    // Reset drift error & set 100% confidence
    this.state.driftEstimateMeters = 0;
    this.state.confidencePercent = 100;
    this.state.stepCount = 0;

    this.persistState();
    this.notifyListeners();
  }

  /**
   * Force activate or deactivate Dead Reckoning mode manually (e.g. indoor simulation toggle)
   */
  public setDeadReckoningActive(active: boolean, reason: 'normal' | 'gps_lost' | 'low_accuracy' = 'gps_lost'): void {
    this.state.isActive = active;
    this.state.reason = active ? reason : 'normal';
    if (!active) {
      this.state.driftEstimateMeters = 0;
      this.state.confidencePercent = 100;
    }
    this.notifyListeners();
  }

  /**
   * Simulate steps for indoor/field testing when hardware motion sensors are unavailable
   */
  public simulateStep(stepsCount: number = 1, overrideHeadingDegrees?: number, customStepLengthMeters?: number): void {
    const heading = overrideHeadingDegrees !== undefined ? overrideHeadingDegrees : this.state.headingDegrees;
    const stride = customStepLengthMeters || this.stepLengthMeters;

    for (let i = 0; i < stepsCount; i++) {
      const headingRad = (heading * Math.PI) / 180;
      // Grid offsets in meters
      const dx = Math.sin(headingRad) * stride;
      const dy = Math.cos(headingRad) * stride;

      this.state.currentX += dx;
      this.state.currentY += dy;

      // Lat/Lng offset conversions (~110574 meters per lat degree, ~111320 per lng degree)
      const dLat = dy / 110574;
      const dLng = dx / (111320 * Math.cos((this.state.currentLat * Math.PI) / 180));

      this.state.currentLat += dLat;
      this.state.currentLng += dLng;

      this.state.stepCount += 1;

      // Add step drift error (~0.3m per step)
      this.state.driftEstimateMeters += 0.3;
    }

    // Force dead reckoning mode active if stepping without GPS
    if (!this.state.isActive && (Date.now() - (this.state.lastGpsFixTime || 0) > 5000)) {
      this.state.isActive = true;
      this.state.reason = 'gps_lost';
    }

    this.recalculateConfidence();
    this.persistState();
    this.notifyListeners();
  }

  /**
   * Subscribe to state updates
   */
  public addListener(listener: DeadReckoningListener): () => void {
    this.listeners.push(listener);
    listener(this.getState());

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current state snapshot
   */
  public getState(): DeadReckoningState {
    return { ...this.state };
  }

  /**
   * Handle Accelerometer Motion for Step Detection
   */
  private handleDeviceMotion = (event: DeviceMotionEvent) => {
    const accel = event.accelerationIncludingGravity || event.acceleration;
    if (!accel) return;

    const x = accel.x || 0;
    const y = accel.y || 0;
    const z = accel.z || 0;

    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();

    // Peak detection threshold (~11.5 m/s² including gravity) with 280ms debouncing
    if (magnitude > 11.5 && now - this.lastStepTimestamp > 280) {
      this.lastStepTimestamp = now;
      this.registerStepDetected();
    }
  };

  /**
   * Handle Magnetometer / Orientation for Heading
   */
  private handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    // webkitCompassHeading for iOS, alpha for Android/standard
    let heading = 0;
    if ((event as any).webkitCompassHeading !== undefined) {
      heading = (event as any).webkitCompassHeading;
    } else if (event.alpha !== null) {
      heading = (360 - event.alpha) % 360;
    }

    this.state.headingDegrees = Math.round(heading);
  };

  /**
   * Process a detected step
   */
  private registerStepDetected(): void {
    const headingRad = (this.state.headingDegrees * Math.PI) / 180;
    const dx = Math.sin(headingRad) * this.stepLengthMeters;
    const dy = Math.cos(headingRad) * this.stepLengthMeters;

    this.state.currentX += dx;
    this.state.currentY += dy;

    const dLat = dy / 110574;
    const dLng = dx / (111320 * Math.cos((this.state.currentLat * Math.PI) / 180));

    this.state.currentLat += dLat;
    this.state.currentLng += dLng;

    this.state.stepCount += 1;

    if (this.state.isActive) {
      this.state.driftEstimateMeters += 0.25;
    }

    this.recalculateConfidence();
    this.persistState();
    this.notifyListeners();
  }

  /**
   * Evaluate GPS Health status
   */
  private evaluateGpsHealth(): void {
    const now = Date.now();
    const timeSinceLastGps = this.state.lastGpsFixTime ? now - this.state.lastGpsFixTime : 999999;

    if (timeSinceLastGps > 10000) {
      // GPS signal lost for over 10 seconds
      if (!this.state.isActive) {
        this.state.isActive = true;
        this.state.reason = 'gps_lost';
        this.recalculateConfidence();
        this.notifyListeners();
      }
    } else if (this.state.lastGpsAccuracy > 50) {
      // GPS accuracy degraded > 50m
      if (!this.state.isActive) {
        this.state.isActive = true;
        this.state.reason = 'low_accuracy';
        this.recalculateConfidence();
        this.notifyListeners();
      }
    }
  }

  /**
   * Recalculate confidence score (0 - 100%) based on accumulated drift estimate in meters
   * Confidence = 100 * e^(-drift / 25)
   * At 0m drift => 100%
   * At 15m drift => ~55%
   * At 21m drift => 43% (<50% -> triggers '?' on ASCII map)
   */
  private recalculateConfidence(): void {
    if (!this.state.isActive && this.state.driftEstimateMeters === 0) {
      this.state.confidencePercent = 100;
      return;
    }

    const confidence = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-this.state.driftEstimateMeters / 25))));
    this.state.confidencePercent = confidence;
  }

  private notifyListeners(): void {
    const stateCopy = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(stateCopy);
      } catch (err) {
        console.error('Error in DeadReckoning listener:', err);
      }
    });
  }

  private persistState(): void {
    try {
      localStorage.setItem('hoimu_dead_reckoning_state', JSON.stringify({
        currentLat: this.state.currentLat,
        currentLng: this.state.currentLng,
        currentX: this.state.currentX,
        currentY: this.state.currentY,
        driftEstimateMeters: this.state.driftEstimateMeters,
        confidencePercent: this.state.confidencePercent,
        stepCount: this.state.stepCount,
        headingDegrees: this.state.headingDegrees,
      }));
    } catch {}
  }
}

export const deadReckoningService = new DeadReckoningService();
