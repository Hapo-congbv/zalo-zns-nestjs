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
} from '@nestjs/common';
import { Response } from 'express';
import { ZaloAuthService } from '../services/zalo-auth.service';
import { PkceService } from '../services/pkce.service';

// Public decorator to mark endpoints as public (bypass JWT auth)
const IS_PUBLIC_KEY = 'isPublic';
const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller('zalo/oauth')
@Public() // Mark entire controller as public
export class ZaloOAuthController {
  private readonly logger = new Logger(ZaloOAuthController.name);
  private readonly codeVerifierStore: Map<string, string> = new Map();

  constructor(
    @Optional()
    private readonly zaloAuthService: ZaloAuthService | null,
    private readonly pkceService: PkceService,
  ) {
    if (!zaloAuthService) {
      this.logger.warn('ZaloAuthService is not available. OAuth endpoints will not work.');
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
  @Get('authorize')
  getAuthorizationUrl(@Query('state') state?: string) {
    this.checkAuthService();
    try {
      const authData = this.zaloAuthService!.generateAuthorizationUrl(state);

      // Store code verifier temporarily (in production, use Redis or database)
      this.codeVerifierStore.set(authData.state, authData.codeVerifier);

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

      // Retrieve code verifier
      const codeVerifier = this.codeVerifierStore.get(state);
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
      this.codeVerifierStore.delete(state);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Authorization successful',
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
  @Get('token-status')
  async getTokenStatus() {
    this.checkAuthService();
    try {
      const accessToken = await this.zaloAuthService!.getAccessToken();
      return {
        success: true,
        data: {
          hasToken: !!accessToken,
          tokenPreview: accessToken ? `${accessToken.substring(0, 10)}...` : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        hasToken: false,
        message: error instanceof Error ? error.message : 'No token available',
      };
    }
  }

  /**
   * Generate PKCE code pair (for testing/debugging)
   * GET /zalo/oauth/pkce
   * @returns PKCE code pair
   */
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
