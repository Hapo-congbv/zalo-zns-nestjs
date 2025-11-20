import { Injectable } from '@nestjs/common';
import { OAuthStateStorage } from '../interfaces/zns-oauth.interface';

/**
 * In-memory OAuth state storage implementation
 * Note: This is not persistent across restarts. For production, use a database-backed storage.
 */
@Injectable()
export class MemoryOAuthStateStorageService implements OAuthStateStorage {
  private readonly stateStore: Map<string, { codeVerifier: string; expiresAt: number }> = new Map();
  private readonly STATE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

  async storeState(state: string, codeVerifier: string): Promise<void> {
    const expiresAt = Date.now() + this.STATE_EXPIRATION_MS;
    this.stateStore.set(state, { codeVerifier, expiresAt });
  }

  async getCodeVerifier(state: string): Promise<string | null> {
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      return null;
    }

    // Check if expired
    if (Date.now() >= stateData.expiresAt) {
      this.stateStore.delete(state);
      return null;
    }

    return stateData.codeVerifier;
  }

  async deleteState(state: string): Promise<void> {
    this.stateStore.delete(state);
  }
}
