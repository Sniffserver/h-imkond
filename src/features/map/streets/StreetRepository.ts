/**
 * StreetRepository Layer
 * Consumes `StreetIndex` binary artifact layer and provides streets to `StreetDiscovery`.
 * Retains `streetData.ts` solely as a fallback / test fixture.
 */

import { Street } from '../../../types';
import { StreetIndex } from './StreetIndex';

export class StreetRepository {
  private static instance: StreetRepository | null = null;
  private streetIndex: StreetIndex;

  private constructor() {
    this.streetIndex = new StreetIndex();
  }

  public static getInstance(): StreetRepository {
    if (!StreetRepository.instance) {
      StreetRepository.instance = new StreetRepository();
    }
    return StreetRepository.instance;
  }

  public loadFromArtifact(buffer: ArrayBuffer | Uint8Array): Street[] {
    return this.streetIndex.decode(buffer);
  }

  public getAllStreets(): Street[] {
    return this.streetIndex.getStreets();
  }

  public getStreetById(id: string): Street | undefined {
    return this.streetIndex.getStreetById(id);
  }
}

export const streetRepository = StreetRepository.getInstance();
