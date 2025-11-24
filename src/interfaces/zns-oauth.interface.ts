/**
 * OAuth configuration options for Zalo
 */
export interface ZaloOAuthOptions {
  appId: string;
  appSecret: string;
  oaId: string; // Official Account ID required for authorization
  redirectUri: string;
}

/**
 * Token storage interface
 */
export interface ZaloTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  refreshExpiresAt?: number; // Unix timestamp in milliseconds
}

/**
 * PKCE code pair
 */
export interface PkceCodePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

/**
 * Authorization URL response
 */
export interface AuthorizationUrlResponse {
  url: string;
  state: string;
  codeVerifier: string;
}

/**
 * Token response from Zalo
 */
export interface ZaloTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  refresh_expires_in?: number; // seconds
}

/**
 * Token storage interface (for dependency injection)
 */
export interface TokenStorage {
  getToken(): Promise<ZaloTokenData | null>;
  saveToken(token: ZaloTokenData): Promise<void>;
  clearToken(): Promise<void>;
}

/**
 * OAuth state storage interface (for storing code verifier)
 */
export interface OAuthStateStorage {
  storeState(state: string, codeVerifier: string): Promise<void>;
  getCodeVerifier(state: string): Promise<string | null>;
  deleteState(state: string): Promise<void>;
}
