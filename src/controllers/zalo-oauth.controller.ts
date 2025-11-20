import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Res,
  HttpStatus,
  Logger,
  Optional,
  BadRequestException,
  SetMetadata,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { ZaloAuthService } from '../services/zalo-auth.service';
import { PkceService } from '../services/pkce.service';
import { OAuthStateStorage } from '../interfaces/zns-oauth.interface';
import { ZNS_OAUTH_STATE_STORAGE } from '../zns.constants';

// Public decorator to mark endpoints as public (bypass JWT auth)
const IS_PUBLIC_KEY = 'isPublic';
const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('zalo/oauth')
@Public() // Mark entire controller as public
export class ZaloOAuthController {
  private readonly logger = new Logger(ZaloOAuthController.name);

  constructor(
    @Optional()
    private readonly zaloAuthService: ZaloAuthService | null,
    private readonly pkceService: PkceService,
    @Inject(ZNS_OAUTH_STATE_STORAGE)
    private readonly stateStorage: OAuthStateStorage,
  ) {
    this.logger.log('🔍 ZaloOAuthController constructor called');
    this.logger.log(`🔍 ZaloAuthService injected: ${zaloAuthService ? 'YES' : 'NO'}`);
    this.logger.log(`🔍 ZaloAuthService type: ${typeof zaloAuthService}`);
    if (!zaloAuthService) {
      this.logger.warn('⚠️ ZaloAuthService is not available. OAuth endpoints will not work.');
      this.logger.warn(
        '💡 This usually means oauthOptions was not provided in module configuration.',
      );
    } else {
      this.logger.log('✅ ZaloAuthService is available and ready to use');
    }
  }

  private checkAuthService() {
    if (!this.zaloAuthService) {
      throw new BadRequestException(
        'OAuth is not configured. Please provide oauthOptions in module configuration.',
      );
    }
  }

  /**
   * Get authorization URL
   * GET /zalo/oauth/authorize
   * @param state Optional state parameter
   * @returns Authorization URL
   */
  @Public()
  @Get('authorize')
  async getAuthorizationUrl(@Query('state') state?: string) {
    this.checkAuthService();
    try {
      const authData = this.zaloAuthService!.generateAuthorizationUrl(state);

      // Store code verifier in state storage (database-backed or in-memory)
      await this.stateStorage.storeState(authData.state, authData.codeVerifier);

      return {
        success: true,
        data: {
          url: authData.url,
          state: authData.state,
        },
      };
    } catch (error) {
      this.logger.error('Failed to generate authorization URL', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * OAuth callback handler
   * GET /zalo/oauth/callback
   * @param code Authorization code from Zalo
   * @param state State parameter for verification
   * @param res Express response object
   */
  @Public()
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      if (!code) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Authorization code is required',
        });
      }

      if (!state) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'State parameter is required',
        });
      }

      // Retrieve code verifier from state storage
      const codeVerifier = await this.stateStorage.getCodeVerifier(state);
      if (!codeVerifier) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid or expired state parameter',
        });
      }

      this.checkAuthService();
      // Exchange code for token
      const tokenData = await this.zaloAuthService!.exchangeCodeForToken(code, codeVerifier);

      // Clean up stored code verifier
      await this.stateStorage.deleteState(state);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Authorization successful. Token saved to database.',
        data: {
          accessToken: tokenData.accessToken,
          expiresAt: new Date(tokenData.expiresAt).toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to handle OAuth callback', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Refresh access token
   * POST /zalo/oauth/refresh
   * @param body Optional refresh token
   * @returns New token data
   */
  @Public()
  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken?: string) {
    this.checkAuthService();
    try {
      const tokenData = await this.zaloAuthService!.refreshToken(refreshToken);

      return {
        success: true,
        data: {
          accessToken: tokenData.accessToken,
          expiresAt: new Date(tokenData.expiresAt).toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to refresh token', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current token status
   * GET /zalo/oauth/token-status
   * @returns Token status information
   */
  @Public()
  @Get('token-status')
  async getTokenStatus() {
    this.checkAuthService();
    try {
      const status = await this.zaloAuthService!.checkAuthorizationStatus();
      const accessToken = status.tokenValid ? await this.zaloAuthService!.getAccessToken() : null;

      return {
        success: true,
        data: {
          hasToken: status.hasToken,
          tokenValid: status.tokenValid,
          needsAuthorization: status.needsAuthorization,
          tokenPreview: accessToken ? `${accessToken.substring(0, 10)}...` : null,
          authorizationUrl: status.authorizationUrl,
          message: status.message,
        },
      };
    } catch (error) {
      return {
        success: false,
        hasToken: false,
        tokenValid: false,
        needsAuthorization: true,
        message: error instanceof Error ? error.message : 'No token available',
      };
    }
  }

  /**
   * Generate PKCE code pair (for testing/debugging)
   * GET /zalo/oauth/pkce
   * @returns PKCE code pair
   */
  @Public()
  @Get('pkce')
  generatePkce() {
    try {
      const pkcePair = this.pkceService.generatePkcePair();
      return {
        success: true,
        data: {
          codeVerifier: pkcePair.codeVerifier,
          codeChallenge: pkcePair.codeChallenge,
          codeChallengeMethod: pkcePair.codeChallengeMethod,
        },
      };
    } catch (error) {
      this.logger.error('Failed to generate PKCE pair', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
