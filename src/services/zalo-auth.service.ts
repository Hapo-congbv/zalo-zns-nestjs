import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import {
  ZaloOAuthOptions,
  ZaloTokenData,
  ZaloTokenResponse,
  TokenStorage,
  AuthorizationUrlResponse,
} from '../interfaces/zns-oauth.interface';
import { PkceService } from './pkce.service';
import { ZNS_OAUTH_OPTIONS, ZNS_TOKEN_STORAGE } from '../zns.constants';

@Injectable()
export class ZaloAuthService implements OnModuleInit {
  private readonly logger = new Logger(ZaloAuthService.name);
  private readonly oauthAxiosInstance: AxiosInstance;
  private tokenRefreshPromise: Promise<ZaloTokenData> | null = null;

  constructor(
    @Inject(ZNS_OAUTH_OPTIONS)
    private readonly oauthOptions: ZaloOAuthOptions | null,
    @Inject(ZNS_TOKEN_STORAGE)
    private readonly tokenStorage: TokenStorage,
    private readonly pkceService: PkceService,
  ) {
    if (!oauthOptions) {
      throw new Error('OAuth options are required for ZaloAuthService');
    }
    this.oauthAxiosInstance = axios.create({
      baseURL: 'https://oauth.zaloapp.com/v4/oa',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private get oauthOptionsNonNull(): ZaloOAuthOptions {
    if (!this.oauthOptions) {
      throw new Error('OAuth options not configured');
    }
    return this.oauthOptions;
  }

  async onModuleInit() {
    // Try to refresh token on module init if token exists
    const token = await this.tokenStorage.getToken();
    if (token && this.isTokenExpired(token)) {
      this.logger.log('Token expired, attempting to refresh...');
      try {
        await this.refreshToken();
      } catch (error) {
        this.logger.warn('Failed to refresh token on init', error);
      }
    }
  }

  /**
   * Generate authorization URL for OAuth flow
   * @param state Optional state parameter for CSRF protection
   * @returns Authorization URL and code verifier
   */
  generateAuthorizationUrl(state?: string): AuthorizationUrlResponse {
    const pkcePair = this.pkceService.generatePkcePair();
    const generatedState = state || this.generateRandomState();

    const params = new URLSearchParams({
      app_id: this.oauthOptionsNonNull.appId,
      redirect_uri: this.oauthOptionsNonNull.redirectUri,
      code_challenge: pkcePair.codeChallenge,
      code_challenge_method: pkcePair.codeChallengeMethod,
      state: generatedState,
    });

    const url = `https://oauth.zaloapp.com/v4/oa/permission?${params.toString()}`;

    return {
      url,
      state: generatedState,
      codeVerifier: pkcePair.codeVerifier,
    };
  }

  /**
   * Exchange authorization code for access token
   * @param code Authorization code from callback
   * @param codeVerifier Code verifier used in authorization request
   * @returns Token data
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<ZaloTokenData> {
    try {
      this.logger.log('Exchanging authorization code for token...');

      const response = await this.oauthAxiosInstance.post<ZaloTokenResponse>('/access_token', {
        app_id: this.oauthOptionsNonNull.appId,
        app_secret: this.oauthOptionsNonNull.appSecret,
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      });

      const tokenData = this.mapTokenResponse(response.data);
      await this.tokenStorage.saveToken(tokenData);

      this.logger.log('Successfully exchanged code for token');
      return tokenData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to exchange code for token: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Optional refresh token (if not provided, uses stored token)
   * @returns New token data
   */
  async refreshToken(refreshToken?: string): Promise<ZaloTokenData> {
    // Prevent concurrent refresh requests
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.performTokenRefresh(refreshToken);

    try {
      const result = await this.tokenRefreshPromise;
      return result;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async performTokenRefresh(refreshToken?: string): Promise<ZaloTokenData> {
    try {
      const storedToken = await this.tokenStorage.getToken();
      const tokenToUse = refreshToken || storedToken?.refreshToken;

      if (!tokenToUse) {
        throw new Error('No refresh token available');
      }

      this.logger.log('Refreshing access token...');

      const response = await this.oauthAxiosInstance.post<ZaloTokenResponse>('/access_token', {
        app_id: this.oauthOptionsNonNull.appId,
        app_secret: this.oauthOptionsNonNull.appSecret,
        refresh_token: tokenToUse,
        grant_type: 'refresh_token',
      });

      const tokenData = this.mapTokenResponse(response.data);
      await this.tokenStorage.saveToken(tokenData);

      this.logger.log('Successfully refreshed access token');
      return tokenData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to refresh token: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get current access token, refresh if needed
   * @returns Access token
   */
  async getAccessToken(): Promise<string> {
    const token = await this.tokenStorage.getToken();

    if (!token) {
      throw new Error('No token available. Please complete OAuth authorization first.');
    }

    // Check if token is expired or will expire in the next 5 minutes
    if (this.isTokenExpired(token) || this.isTokenExpiringSoon(token, 5 * 60 * 1000)) {
      this.logger.log('Token expired or expiring soon, refreshing...');
      const refreshedToken = await this.refreshToken();
      return refreshedToken.accessToken;
    }

    return token.accessToken;
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: ZaloTokenData): boolean {
    return Date.now() >= token.expiresAt;
  }

  /**
   * Check if token is expiring soon
   */
  private isTokenExpiringSoon(token: ZaloTokenData, thresholdMs: number): boolean {
    return Date.now() >= token.expiresAt - thresholdMs;
  }

  /**
   * Map Zalo token response to internal token data format
   */
  private mapTokenResponse(response: ZaloTokenResponse): ZaloTokenData {
    const now = Date.now();
    const expiresAt = now + response.expires_in * 1000;
    const refreshExpiresAt = response.refresh_expires_in
      ? now + response.refresh_expires_in * 1000
      : undefined;

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt,
      refreshExpiresAt,
    };
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateRandomState(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
