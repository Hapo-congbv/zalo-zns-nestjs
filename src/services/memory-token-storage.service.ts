import { Injectable } from '@nestjs/common';
import { TokenStorage, ZaloTokenData } from '../interfaces/zns-oauth.interface';

/**
 * In-memory token storage implementation
 * Note: This is not persistent across restarts. For production, use a database-backed storage.
 */
@Injectable()
export class MemoryTokenStorageService implements TokenStorage {
  private tokenData: ZaloTokenData | null = null;

  async getToken(): Promise<ZaloTokenData | null> {
    return this.tokenData;
  }

  async saveToken(token: ZaloTokenData): Promise<void> {
    this.tokenData = token;
  }

  async clearToken(): Promise<void> {
    this.tokenData = null;
  }
}
