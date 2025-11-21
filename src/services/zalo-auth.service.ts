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
  private readonly oauthAxiosInstance: AxiosInstance | null = null;
  private tokenRefreshPromise: Promise<ZaloTokenData> | null = null;

  constructor(
    @Inject(ZNS_OAUTH_OPTIONS)
    private readonly oauthOptions: ZaloOAuthOptions | null,
    @Inject(ZNS_TOKEN_STORAGE)
    private readonly tokenStorage: TokenStorage,
    private readonly pkceService: PkceService,
  ) {
    // The factory in zns.module.ts will return null in that case
    // This service should only be instantiated when oauthOptions is provided
    if (oauthOptions) {
      // Validate and normalize OAuth options
      this.validateAndNormalizeOAuthOptions(oauthOptions);

      this.oauthAxiosInstance = axios.create({
        baseURL: 'https://oauth.zaloapp.com/v4/oa',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      this.logger.warn(
        'ZaloAuthService created without oauthOptions. This should not happen if OAuth is properly configured.',
      );
    }
  }

  /**
   * Validate and normalize OAuth options
   * Ensures appId, appSecret, oaId, and redirectUri are properly formatted
   */
  private validateAndNormalizeOAuthOptions(options: ZaloOAuthOptions): void {
    // Trim whitespace from all string fields
    if (options.appId) {
      options.appId = options.appId.trim();
    }
    if (options.appSecret) {
      options.appSecret = options.appSecret.trim();
    }
    if (options.oaId) {
      options.oaId = options.oaId.trim();
    }
    if (options.redirectUri) {
      options.redirectUri = options.redirectUri.trim();
    }

    // Validate required fields
    if (!options.appId || options.appId.length === 0) {
      throw new Error('Zalo OAuth appId is required and cannot be empty');
    }
    if (!options.appSecret || options.appSecret.length === 0) {
      throw new Error('Zalo OAuth appSecret is required and cannot be empty');
    }
    if (!options.oaId || options.oaId.length === 0) {
      throw new Error('Zalo OAuth oaId is required and cannot be empty');
    }
    if (!options.redirectUri || options.redirectUri.length === 0) {
      throw new Error('Zalo OAuth redirectUri is required and cannot be empty');
    }

    // Log configuration (masked for security)
    this.logger.debug('Zalo OAuth configuration validated:', {
      appId: `${options.appId.substring(0, 4)}...${options.appId.substring(options.appId.length - 4)}`,
      appIdLength: options.appId.length,
      hasAppSecret: !!options.appSecret,
      oaId: `${options.oaId.substring(0, 4)}...${options.oaId.substring(options.oaId.length - 4)}`,
      redirectUri: options.redirectUri,
    });
  }

  private get oauthOptionsNonNull(): ZaloOAuthOptions {
    if (!this.oauthOptions) {
      throw new Error(
        'OAuth options not configured. Please provide oauthOptions in module configuration.',
      );
    }
    return this.oauthOptions;
  }

  async onModuleInit() {
    // Check if oauthOptions is configured
    if (!this.oauthOptions) {
      this.logger.warn(
        'ZaloAuthService initialized without oauthOptions. OAuth features will not be available.',
      );
      return;
    }

    // Check token status on module init
    const token = await this.tokenStorage.getToken();

    if (!token) {
      // No token available - provide helpful instructions
      this.logger.warn('⚠️  No Zalo access token found. OAuth authorization required.');
      this.logger.warn('📋 To get access token automatically, please:');
      this.logger.warn('   1. Call: GET /zalo/oauth/authorize to get authorization URL');
      this.logger.warn('   2. Visit the returned URL in your browser');
      this.logger.warn('   3. Authorize the application on Zalo');
      this.logger.warn('   4. Zalo will redirect to your callback URL');
      this.logger.warn('   5. Token will be automatically saved');
      this.logger.warn(`   Redirect URI: ${this.oauthOptionsNonNull.redirectUri}`);
      return;
    }

    // Token exists - check if expired or expiring soon
    if (this.isTokenExpired(token)) {
      this.logger.log('Token expired, attempting to refresh automatically...');
      try {
        await this.refreshToken();
        this.logger.log('✅ Token refreshed successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`❌ Failed to refresh token on init: ${errorMessage}`);
        this.logger.warn('⚠️  You may need to re-authorize. Use: GET /zalo/oauth/authorize');
      }
    } else if (this.isTokenExpiringSoon(token, 5 * 60 * 1000)) {
      this.logger.log('Token expiring soon, refreshing proactively...');
      try {
        await this.refreshToken();
        this.logger.log('✅ Token refreshed proactively');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to refresh token proactively: ${errorMessage}`);
      }
    } else {
      const expiresIn = Math.floor((token.expiresAt - Date.now()) / 1000 / 60);
      this.logger.log(`✅ Zalo access token is valid (expires in ${expiresIn} minutes)`);
    }
  }

  /**
   * Generate authorization URL for OAuth flow
   * @param state Optional state parameter for CSRF protection
   * @returns Authorization URL and code verifier
   */
  generateAuthorizationUrl(state?: string): AuthorizationUrlResponse {
    if (!this.oauthOptions) {
      throw new Error('OAuth options not configured');
    }
    const pkcePair = this.pkceService.generatePkcePair();
    const generatedState = state || this.generateRandomState();

    // Ensure all values are trimmed before building URL
    const appId = this.oauthOptions.appId.trim();
    const oaId = this.oauthOptions.oaId.trim();
    const redirectUri = this.oauthOptions.redirectUri.trim();

    // Validate required fields
    if (!appId || appId.length === 0) {
      throw new Error('Invalid appId: appId is empty or undefined');
    }
    if (!oaId || oaId.length === 0) {
      throw new Error('Invalid oaId: oaId is empty or undefined');
    }
    if (!redirectUri || redirectUri.length === 0) {
      throw new Error('Invalid redirectUri: redirectUri is empty or undefined');
    }

    const params = new URLSearchParams({
      app_id: appId,
      oa_id: oaId,
      redirect_uri: redirectUri,
      code_challenge: pkcePair.codeChallenge,
    });

    // Add state parameter separately to ensure it's properly encoded
    if (generatedState) {
      params.append('state', generatedState);
    }

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
    if (!this.oauthOptions || !this.oauthAxiosInstance) {
      throw new Error('OAuth options not configured');
    }
    try {
      this.logger.log('Exchanging authorization code for token...');

      // Validate appId before making request
      if (!this.oauthOptions.appId || this.oauthOptions.appId.trim().length === 0) {
        throw new Error('Invalid appId: appId is empty or undefined');
      }

      const requestBody = {
        app_id: this.oauthOptions.appId.trim(),
        app_secret: this.oauthOptions.appSecret.trim(),
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      };

      // Log request details (masked for security)
      this.logger.debug('Token exchange request:', {
        app_id: `${this.oauthOptions.appId.substring(0, 4)}...${this.oauthOptions.appId.substring(this.oauthOptions.appId.length - 4)}`,
        app_id_length: this.oauthOptions.appId.length,
        has_app_secret: !!this.oauthOptions.appSecret,
        code_length: code.length,
        grant_type: 'authorization_code',
      });

      const response = await this.oauthAxiosInstance.post<ZaloTokenResponse>(
        '/access_token',
        requestBody,
      );

      // Log the response for debugging
      this.logger.debug('Token response from Zalo:', JSON.stringify(response.data));

      const tokenData = this.mapTokenResponse(response.data);
      await this.tokenStorage.saveToken(tokenData);

      this.logger.log('Successfully exchanged code for token');
      return tokenData;
    } catch (error) {
      // Enhanced error logging and handling
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        const errorData = axiosError.response?.data;
        this.logger.error('Zalo API error response:', JSON.stringify(errorData));
        this.logger.error('Zalo API error status:', axiosError.response?.status);

        // Extract Zalo-specific error information
        if (errorData && typeof errorData === 'object') {
          const zaloError = errorData as any;
          if (zaloError.error_name || zaloError.error_description) {
            let detailedMessage = `Zalo API Error: ${zaloError.error_name || 'Unknown error'}`;
            if (zaloError.error_description) {
              detailedMessage += ` - ${zaloError.error_description}`;
            }
            if (zaloError.error) {
              detailedMessage += ` (Error code: ${zaloError.error})`;
            }
            if (zaloError.ref_doc) {
              detailedMessage += `\nReference: ${zaloError.ref_doc}`;
            }

            // Special handling for Invalid appId error
            if (zaloError.error === -14002 || zaloError.error_name === 'Invalid appId') {
              detailedMessage +=
                '\n\nPossible causes:\n' +
                '1. ZALO_APP_ID environment variable is not set or is empty\n' +
                '2. ZALO_APP_ID value is incorrect\n' +
                '3. ZALO_APP_ID has leading/trailing whitespace (should be trimmed)\n' +
                '4. The appId does not match your Zalo Developer account';
              this.logger.error(detailedMessage);
              throw new Error(detailedMessage);
            }

            this.logger.error(detailedMessage);
            throw new Error(detailedMessage);
          }
        }
      }

      // If it's already a mapped error, re-throw it
      if (error instanceof Error && error.message.includes('Invalid token response')) {
        throw error;
      }

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
    if (!this.oauthOptions || !this.oauthAxiosInstance) {
      throw new Error('OAuth options not configured');
    }
    try {
      const storedToken = await this.tokenStorage.getToken();
      const tokenToUse = refreshToken || storedToken?.refreshToken;

      if (!tokenToUse) {
        throw new Error('No refresh token available');
      }

      this.logger.log('Refreshing access token...');

      // Validate appId before making request
      if (!this.oauthOptions.appId || this.oauthOptions.appId.trim().length === 0) {
        throw new Error('Invalid appId: appId is empty or undefined');
      }

      const requestBody = {
        app_id: this.oauthOptions.appId.trim(),
        app_secret: this.oauthOptions.appSecret.trim(),
        refresh_token: tokenToUse,
        grant_type: 'refresh_token',
      };

      // Log request details (masked for security)
      this.logger.debug('Token refresh request:', {
        app_id: `${this.oauthOptions.appId.substring(0, 4)}...${this.oauthOptions.appId.substring(this.oauthOptions.appId.length - 4)}`,
        app_id_length: this.oauthOptions.appId.length,
        has_app_secret: !!this.oauthOptions.appSecret,
        grant_type: 'refresh_token',
      });

      const response = await this.oauthAxiosInstance.post<ZaloTokenResponse>(
        '/access_token',
        requestBody,
      );

      // Log the response for debugging
      this.logger.debug('Token refresh response from Zalo:', JSON.stringify(response.data));

      const tokenData = this.mapTokenResponse(response.data);
      await this.tokenStorage.saveToken(tokenData);

      this.logger.log('Successfully refreshed access token');
      return tokenData;
    } catch (error) {
      // Enhanced error logging and handling
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        const errorData = axiosError.response?.data;
        this.logger.error('Zalo API error response:', JSON.stringify(errorData));
        this.logger.error('Zalo API error status:', axiosError.response?.status);

        // Extract Zalo-specific error information
        if (errorData && typeof errorData === 'object') {
          const zaloError = errorData as any;
          if (zaloError.error_name || zaloError.error_description) {
            let detailedMessage = `Zalo API Error: ${zaloError.error_name || 'Unknown error'}`;
            if (zaloError.error_description) {
              detailedMessage += ` - ${zaloError.error_description}`;
            }
            if (zaloError.error) {
              detailedMessage += ` (Error code: ${zaloError.error})`;
            }
            if (zaloError.ref_doc) {
              detailedMessage += `\nReference: ${zaloError.ref_doc}`;
            }

            // Special handling for Invalid appId error
            if (zaloError.error === -14002 || zaloError.error_name === 'Invalid appId') {
              detailedMessage +=
                '\n\nPossible causes:\n' +
                '1. ZALO_APP_ID environment variable is not set or is empty\n' +
                '2. ZALO_APP_ID value is incorrect\n' +
                '3. ZALO_APP_ID has leading/trailing whitespace (should be trimmed)\n' +
                '4. The appId does not match your Zalo Developer account';
              this.logger.error(detailedMessage);
              throw new Error(detailedMessage);
            }

            this.logger.error(detailedMessage);
            throw new Error(detailedMessage);
          }
        }
      }

      // If it's already a mapped error, re-throw it
      if (error instanceof Error && error.message.includes('Invalid token response')) {
        throw error;
      }

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
      const errorMessage =
        'No Zalo access token available. Please complete OAuth authorization first.\n' +
        'To get started:\n' +
        '1. Call: GET /zalo/oauth/authorize\n' +
        '2. Visit the returned URL and authorize\n' +
        '3. Complete the OAuth callback\n' +
        '4. Token will be automatically saved and used';
      throw new Error(errorMessage);
    }

    // Check if token is expired or will expire in the next 5 minutes
    if (this.isTokenExpired(token) || this.isTokenExpiringSoon(token, 5 * 60 * 1000)) {
      this.logger.log('Token expired or expiring soon, refreshing...');
      try {
        const refreshedToken = await this.refreshToken();
        return refreshedToken.accessToken;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to refresh token: ${errorMessage}`);
        throw new Error(
          `Failed to refresh access token: ${errorMessage}. ` +
            'You may need to re-authorize. Use: GET /zalo/oauth/authorize',
        );
      }
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
    // Validate response
    if (!response.access_token) {
      throw new Error('Invalid token response: missing access_token');
    }
    if (!response.refresh_token) {
      throw new Error('Invalid token response: missing refresh_token');
    }

    // Validate and parse expires_in
    const expiresIn = Number(response.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      this.logger.error('Invalid expires_in value:', response.expires_in);
      throw new Error(
        `Invalid token response: expires_in is not a valid number (received: ${response.expires_in})`,
      );
    }

    const now = Date.now();
    const expiresAt = now + expiresIn * 1000;

    // Validate and parse refresh_expires_in (optional)
    let refreshExpiresAt: number | undefined = undefined;
    if (response.refresh_expires_in !== undefined && response.refresh_expires_in !== null) {
      const refreshExpiresIn = Number(response.refresh_expires_in);
      if (Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0) {
        refreshExpiresAt = now + refreshExpiresIn * 1000;
      } else {
        this.logger.warn(
          'Invalid refresh_expires_in value, ignoring:',
          response.refresh_expires_in,
        );
      }
    }

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

  /**
   * Check if authorization is needed (no token or token expired and can't refresh)
   * @returns Object with authorization status and URL if needed
   */
  async checkAuthorizationStatus(): Promise<{
    needsAuthorization: boolean;
    hasToken: boolean;
    tokenValid: boolean;
    authorizationUrl?: string;
    state?: string;
    message?: string;
  }> {
    const token = await this.tokenStorage.getToken();
    const hasToken = !!token;

    if (!hasToken) {
      const authData = this.generateAuthorizationUrl();
      return {
        needsAuthorization: true,
        hasToken: false,
        tokenValid: false,
        authorizationUrl: authData.url,
        state: authData.state,
        message: 'No token found. Authorization required.',
      };
    }

    const tokenValid =
      !this.isTokenExpired(token!) && !this.isTokenExpiringSoon(token!, 5 * 60 * 1000);

    if (!tokenValid) {
      // Try to refresh
      try {
        await this.refreshToken();
        return {
          needsAuthorization: false,
          hasToken: true,
          tokenValid: true,
          message: 'Token refreshed successfully.',
        };
      } catch {
        // Can't refresh, need re-authorization
        const authData = this.generateAuthorizationUrl();
        return {
          needsAuthorization: true,
          hasToken: true,
          tokenValid: false,
          authorizationUrl: authData.url,
          state: authData.state,
          message: 'Token expired and refresh failed. Re-authorization required.',
        };
      }
    }

    return {
      needsAuthorization: false,
      hasToken: true,
      tokenValid: true,
      message: 'Token is valid.',
    };
  }
}
