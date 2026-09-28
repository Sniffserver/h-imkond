/**
 * FieldSession Lifecycle Abstraction
 * Unified orchestration layer for LocationManager, StreetDiscovery, FieldQuest, SignalTrail, and WalkSession.
 * Lifecycle: start session -> location fixes -> street discoveries -> POI visits -> radio observations -> route progress -> session report.
 */

import { StreetSegment } from '../../types';
import { GPSFix, streetDiscoveryService } from '../../features/map/streets/streetDiscoveryService';
import { fieldQuestService } from '../../features/map/discovery/fieldQuestService';
import { observationManager } from '../observation/ObservationManager';
import { haversineDistanceMeters } from '../../geo/projection';

export interface FieldSessionReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  totalFixesCount: number;
  totalDistanceMeters: number;
  newlyDiscoveredStreetSegments: StreetSegment[];
  visitedPoiCount: number;
  radioObservationsCount: number;
  activeQuestTitle?: string;
  questObjectivesCompletedCount: number;
}

export class FieldSession {
  private sessionId: string;
  private startTime: number;
  private isActive: boolean = false;
  private lastFix: GPSFix | null = null;
  private totalDistanceMeters: number = 0;
  private totalFixesCount: number = 0;
  private sessionDiscoveredSegments: StreetSegment[] = [];
  private initialRadioObservations: number = 0;
  private initialCompletedObjectives: number = 0;

  constructor() {
    this.sessionId = `session_${Date.now()}`;
    this.startTime = Date.now();
  }

  public startSession(): void {
    this.sessionId = `session_${Date.now()}`;
    this.startTime = Date.now();
    this.isActive = true;
    this.totalDistanceMeters = 0;
    this.totalFixesCount = 0;
    this.sessionDiscoveredSegments = [];
    this.lastFix = null;
    this.initialRadioObservations = observationManager.getAllObservations().length;
    this.initialCompletedObjectives = this.getCompletedQuestObjectivesCount();
  }

  public processLocationFix(fix: GPSFix): void {
    if (!this.isActive) return;

    this.totalFixesCount++;

    if (this.lastFix) {
      const d = haversineDistanceMeters(this.lastFix.lat, this.lastFix.lng, fix.lat, fix.lng);
      if (d < 500) { // Filter out unrealistic GPS teleportation jumps
        this.totalDistanceMeters += d;
      }
    }
    this.lastFix = fix;

    // 1. Street Discovery
    const discoveryResult = streetDiscoveryService.processGPSFix(fix);
    if (discoveryResult.length > 0) {
      this.sessionDiscoveredSegments.push(...discoveryResult);
    }

    // 2. Field Quest POI Visits & Accuracy Gated Dwell Updates
    fieldQuestService.processLocationUpdate(
      fix.lat,
      fix.lng,
      fix.accuracyMeters || 10,
      fix.timestamp || Date.now()
    );
  }

  public endSession(): FieldSessionReport {
    this.isActive = false;
    const endTime = Date.now();
    const durationSeconds = Math.max(1, Math.round((endTime - this.startTime) / 1000));

    const currentRadioObservations = observationManager.getAllObservations().length;
    const radioObsCount = Math.max(0, currentRadioObservations - this.initialRadioObservations);

    const currentCompletedObjectives = this.getCompletedQuestObjectivesCount();
    const questObjsCompleted = Math.max(0, currentCompletedObjectives - this.initialCompletedObjectives);

    const activeQuest = fieldQuestService.getActiveQuest();

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      durationSeconds,
      totalFixesCount: this.totalFixesCount,
      totalDistanceMeters: Math.round(this.totalDistanceMeters),
      newlyDiscoveredStreetSegments: this.sessionDiscoveredSegments,
      visitedPoiCount: questObjsCompleted,
      radioObservationsCount: radioObsCount,
      activeQuestTitle: activeQuest?.title,
      questObjectivesCompletedCount: questObjsCompleted,
    };
  }

  public isSessionActive(): boolean {
    return this.isActive;
  }

  private getCompletedQuestObjectivesCount(): number {
    const active = fieldQuestService.getActiveQuest();
    if (!active) return 0;
    return active.objectives.filter((o) => o.completed).length;
  }
}

export const fieldSession = new FieldSession();
