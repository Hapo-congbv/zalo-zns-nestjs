import { ZaloOAuthOptions, TokenStorage } from './zns-oauth.interface';

/**
 * ZNS Module Options
 * Either provide accessToken directly OR oauthOptions for automatic token management
 */
export interface ZnsModuleOptions {
  // Option 1: Direct access token (legacy mode)
  accessToken?: string;

  // Option 2: OAuth configuration (recommended)
  oauthOptions?: ZaloOAuthOptions;

  // Optional: Custom token storage (defaults to in-memory storage)
  tokenStorage?: TokenStorage;

  // Optional: Enable OAuth controller endpoints
  enableOAuthController?: boolean;

  // Common options
  apiUrl?: string;
  timeout?: number;
}

export interface ZnsAsyncOptions {
  useFactory?: (...args: any[]) => Promise<ZnsModuleOptions> | ZnsModuleOptions;
  inject?: any[];
  imports?: any[];
}
