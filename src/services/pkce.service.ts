import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PkceCodePair } from '../interfaces/zns-oauth.interface';

@Injectable()
export class PkceService {
  /**
   * Generate a random code verifier
   * @param length Length of the code verifier (default: 128)
   * @returns Base64URL encoded random string
   */
  generateCodeVerifier(length: number = 128): string {
    const randomBytes = crypto.randomBytes(length);
    return this.base64UrlEncode(randomBytes);
  }

  /**
   * Generate code challenge from code verifier using SHA256
   * @param codeVerifier The code verifier
   * @returns Base64URL encoded SHA256 hash
   */
  generateCodeChallenge(codeVerifier: string): string {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return this.base64UrlEncode(hash);
  }

  /**
   * Generate PKCE code pair (verifier and challenge)
   * @param verifierLength Length of the code verifier (default: 128)
   * @returns PKCE code pair
   */
  generatePkcePair(verifierLength: number = 128): PkceCodePair {
    const codeVerifier = this.generateCodeVerifier(verifierLength);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  /**
   * Encode buffer to Base64URL format
   * @param buffer Buffer to encode
   * @returns Base64URL encoded string
   */
  private base64UrlEncode(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
