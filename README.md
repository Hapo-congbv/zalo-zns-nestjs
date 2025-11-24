# haposoft zalo-zns-nestjs

Zalo Notification Service (ZNS) NestJS module for sending notifications via Zalo ZNS API.

## Installation

```bash
npm install @hapo-congbv/zalo-zns-nestjs
```

or

```bash
yarn add @hapo-congbv/zalo-zns-nestjs
```

## Quick Start

### 1. Import Module

#### OAuth Configuration (Recommended)

The recommended approach is to use OAuth for automatic token management. This eliminates the need to manually manage access tokens.

First, create token storage services. Here's an example using Prisma:

**Token Storage Service:**

```typescript
import { Injectable } from '@nestjs/common';
import { TokenStorage, ZaloTokenData } from '@hapo-congbv/zalo-zns-nestjs';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaTokenStorageService implements TokenStorage {
  constructor(private readonly prisma: PrismaService) {}

  async getToken(): Promise<ZaloTokenData | null> {
    const token = await this.prisma.zaloToken.findUnique({
      where: { id: 'zalo-oauth-token' },
    });
    if (!token) return null;
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: Number(token.expiresAt),
      refreshExpiresAt: token.refreshExpiresAt ? Number(token.refreshExpiresAt) : undefined,
    };
  }

  async saveToken(token: ZaloTokenData): Promise<void> {
    await this.prisma.zaloToken.upsert({
      where: { id: 'zalo-oauth-token' },
      create: {
        id: 'zalo-oauth-token',
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: BigInt(token.expiresAt),
        refreshExpiresAt: token.refreshExpiresAt ? BigInt(token.refreshExpiresAt) : null,
      },
      update: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: BigInt(token.expiresAt),
        refreshExpiresAt: token.refreshExpiresAt ? BigInt(token.refreshExpiresAt) : null,
      },
    });
  }

  async clearToken(): Promise<void> {
    await this.prisma.zaloToken
      .delete({
        where: { id: 'zalo-oauth-token' },
      })
      .catch(() => {});
  }
}
```

**OAuth State Storage Service:**

```typescript
import { Injectable } from '@nestjs/common';
import { OAuthStateStorage } from '@hapo-congbv/zalo-zns-nestjs';
import { PrismaService } from './prisma.service';

@Injectable()
export class ZaloOAuthStateService implements OAuthStateStorage {
  constructor(private readonly prisma: PrismaService) {}

  async storeState(state: string, codeVerifier: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await this.prisma.zaloOAuthState.upsert({
      where: { state },
      create: { state, codeVerifier, expiresAt },
      update: { codeVerifier, expiresAt },
    });
  }

  async getCodeVerifier(state: string): Promise<string | null> {
    const record = await this.prisma.zaloOAuthState.findUnique({
      where: { state },
    });
    if (!record || new Date(record.expiresAt) < new Date()) {
      await this.deleteState(state);
      return null;
    }
    return record.codeVerifier;
  }

  async deleteState(state: string): Promise<void> {
    await this.prisma.zaloOAuthState
      .delete({
        where: { state },
      })
      .catch(() => {});
  }
}
```

**Module Configuration:**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZnsModule } from '@hapo-congbv/zalo-zns-nestjs';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaTokenStorageService } from './config/zalo-token-storage.service';
import { ZaloOAuthStateService } from './config/zalo-oauth-state.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule, // Import PrismaModule first to ensure services are available
    ZnsModule.forRootAsyncGlobal({
      imports: [ConfigModule, PrismaModule],
      useFactory: (
        configService: ConfigService,
        tokenStorage: PrismaTokenStorageService,
        oauthStateStorage: ZaloOAuthStateService,
      ) => ({
        oauthOptions: {
          appId: configService.get<string>('ZALO_APP_ID'),
          appSecret: configService.get<string>('ZALO_APP_SECRET'),
          oaId: configService.get<string>('ZALO_OA_ID'), // Official Account ID
          redirectUri: configService.get<string>('ZALO_REDIRECT_URI'),
        },
        tokenStorage,
        oauthStateStorage,
        enableOAuthController: true, // Enables /zalo/oauth/* endpoints
        apiUrl: configService.get<string>('ZALO_API_URL', 'https://business.openapi.zalo.me'),
        timeout: configService.get<number>('ZALO_TIMEOUT', 30000),
      }),
      inject: [ConfigService, PrismaTokenStorageService, ZaloOAuthStateService],
    }),
  ],
})
export class AppModule {}
```

**Note:** If you don't provide custom `tokenStorage` and `oauthStateStorage`, the package will use in-memory storage (tokens will be lost on server restart).

#### Global Module

If you want to use ZnsService globally without importing ZnsModule in every module:

```typescript
ZnsModule.forRootAsyncGlobal({
  imports: [ConfigModule, PrismaModule],
  useFactory: (
    configService: ConfigService,
    tokenStorage: PrismaTokenStorageService,
    oauthStateStorage: ZaloOAuthStateService,
  ) => ({
    oauthOptions: {
      appId: configService.get<string>('ZALO_APP_ID'),
      appSecret: configService.get<string>('ZALO_APP_SECRET'),
      oaId: configService.get<string>('ZALO_OA_ID'),
      redirectUri: configService.get<string>('ZALO_REDIRECT_URI'),
    },
    tokenStorage,
    oauthStateStorage,
    enableOAuthController: true,
  }),
  inject: [ConfigService, PrismaTokenStorageService, ZaloOAuthStateService],
});
```

### 2. Use ZnsService

```typescript
import { Injectable } from '@nestjs/common';
import { ZnsMessage, ZnsService } from '@hapo-congbv/zalo-zns-nestjs';

@Injectable()
export class NotificationService {
  constructor(private readonly znsService: ZnsService) {}

  async sendNotification() {
    const message: ZnsMessage = {
      phone: '0912345678',
      templateId: 'your-template-id',
      templateData: {
        name: 'John Doe',
        code: '123456',
      },
      trackingId: 'optional-tracking-id',
    };

    const result = await this.znsService.sendMessage(message);

    if (result.error === 0) {
      console.log('Message sent successfully!', result.data?.trackingId);
    } else {
      console.error('Failed to send message:', result.message);
    }
  }

  async sendBulkNotifications() {
    const messages: ZnsMessage[] = [
      {
        phone: '0912345678',
        templateId: 'template-1',
        templateData: { name: 'User 1' },
      },
      {
        phone: '0987654321',
        templateId: 'template-2',
        templateData: { name: 'User 2' },
      },
    ];

    const results = await this.znsService.sendBulkMessages(messages);
    console.log('Bulk send results:', results);
  }
}
```

## API Reference

### ZnsModule

#### `forRoot(options: ZnsModuleOptions)`

Register ZNS module with synchronous options.

#### `forRootAsync(options: ZnsAsyncOptions)`

Register ZNS module with asynchronous options.

#### `forRootGlobal(options: ZnsModuleOptions)`

Register ZNS module as global with synchronous options.

#### `forRootAsyncGlobal(options: ZnsAsyncOptions)`

Register ZNS module as global with asynchronous options.

### ZnsService

#### `sendMessage(message: ZnsMessage): Promise<ZnsSendResponse>`

Send a single ZNS notification.

#### `sendBulkMessages(messages: ZnsMessage[]): Promise<ZnsSendResponse[]>`

Send multiple ZNS notifications.

### Interfaces

#### `ZnsModuleOptions`

```typescript
interface ZnsModuleOptions {
  // Option 1: OAuth configuration (recommended)
  oauthOptions?: {
    appId: string;
    appSecret: string;
    oaId: string; // Official Account ID
    redirectUri: string;
  };
  tokenStorage?: TokenStorage; // Optional: Custom token storage (defaults to in-memory)
  oauthStateStorage?: OAuthStateStorage; // Optional: Custom OAuth state storage (defaults to in-memory)
  enableOAuthController?: boolean; // Optional: Enable OAuth endpoints (default: true if oauthOptions provided)

  // Option 2: Direct access token (legacy mode)
  accessToken?: string;

  // Common options
  apiUrl?: string; // Optional: API URL (default: 'https://business.openapi.zalo.me')
  timeout?: number; // Optional: Request timeout in ms (default: 30000)
}
```

**Note:** Either provide `oauthOptions` (recommended) or `accessToken` (legacy). OAuth mode requires `tokenStorage` and `oauthStateStorage` for production use.

#### `ZnsMessage`

```typescript
interface ZnsMessage {
  phone: string; // Required: Phone number
  templateId: string; // Required: ZNS template ID
  templateData?: Record<string, any>; // Optional: Template data
  trackingId?: string; // Optional: Tracking ID
}
```

#### `ZnsSendResponse`

```typescript
interface ZnsSendResponse {
  error: number; // 0 = success, non-zero = error
  message: string; // Response message
  data?: {
    trackingId: string; // Tracking ID if successful
  };
}
```

### OAuth Endpoints

When `enableOAuthController` is true, the following endpoints are available:

- `GET /zalo/oauth/authorize` - Get authorization URL
- `GET /zalo/oauth/callback` - Handle OAuth callback
- `GET /zalo/oauth/token-status` - Check authorization status
- `POST /zalo/oauth/refresh` - Manually refresh token
- `DELETE /zalo/oauth/token` - Clear/revoke stored token (useful when changing app configuration)

### OAuth Flow

1. Call `GET /zalo/oauth/authorize` to get the authorization URL
2. Redirect user to the authorization URL
3. User authorizes the application on Zalo
4. Zalo redirects to your callback URL with authorization code
5. The callback endpoint automatically exchanges the code for tokens
6. Tokens are stored and automatically refreshed when needed

The package automatically refreshes tokens when they expire, so you don't need to manually manage token lifecycle.

### Legacy Mode (Static Access Token)

If you already have a Zalo access token and prefer to use it directly without OAuth flow, you can configure it as follows:

#### Synchronous Configuration

```typescript
import { Module } from '@nestjs/common';
import { ZnsModule } from '@hapo-congbv/zalo-zns-nestjs';

@Module({
  imports: [
    ZnsModule.forRootGlobal({
      accessToken: 'your-zalo-access-token',
      apiUrl: 'https://business.openapi.zalo.me', // Optional
      timeout: 30000, // Optional, default 30000ms
    }),
  ],
})
export class AppModule {}
```

#### Asynchronous Configuration (Recommended for Legacy Mode)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZnsModule } from '@hapo-congbv/zalo-zns-nestjs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ZnsModule.forRootAsyncGlobal({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        accessToken: configService.get<string>('ZALO_ACCESS_TOKEN'),
        apiUrl: configService.get<string>('ZALO_API_URL', 'https://business.openapi.zalo.me'),
        timeout: configService.get<number>('ZALO_TIMEOUT', 30000),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

#### How to Get Access Token

1. Go to [Zalo Developer Console](https://developers.zalo.me/)
2. Navigate to your app settings
3. Generate or copy your access token
4. Add it to your `.env` file as `ZALO_ACCESS_TOKEN`

**Important Notes:**

- ⚠️ **Token Expiration**: Static access tokens expire after **25 hours** and require manual refresh
- ⚠️ **Manual Management**: You must manually obtain a new token from Zalo Developer Console when the token expires
- ✅ **OAuth Recommended**: OAuth mode is **strongly recommended** for production use as it handles token refresh automatically
- 💡 **Use Cases**: Static token mode is suitable for:
  - Development and testing
  - Quick prototyping
  - When you have a specific reason not to use OAuth

## Environment Variables

### OAuth Mode (Recommended)

```env
ZALO_APP_ID=your-app-id
ZALO_APP_SECRET=your-app-secret
ZALO_OA_ID=your-official-account-id
ZALO_REDIRECT_URI=https://your-domain.com/zalo/oauth/callback
ZALO_API_URL=https://business.openapi.zalo.me
ZALO_TIMEOUT=30000
```

**Required for OAuth:**

- `ZALO_APP_ID` - Your Zalo App ID
- `ZALO_APP_SECRET` - Your Zalo App Secret
- `ZALO_OA_ID` - Your Official Account ID
- `ZALO_REDIRECT_URI` - OAuth callback URL (must match Zalo app configuration)

**Optional:**

- `ZALO_API_URL` - API base URL (default: `https://business.openapi.zalo.me`)
- `ZALO_TIMEOUT` - Request timeout in milliseconds (default: `30000`)

### Legacy Mode (Static Token)

If you already have a Zalo access token and prefer to use it directly without OAuth flow:

```env
ZALO_ACCESS_TOKEN=your-access-token
ZALO_API_URL=https://business.openapi.zalo.me
ZALO_TIMEOUT=30000
```

**Required for Legacy Mode:**

- `ZALO_ACCESS_TOKEN` - Your Zalo access token (obtained from Zalo Developer Console)

**Optional:**

- `ZALO_API_URL` - API base URL (default: `https://business.openapi.zalo.me`)
- `ZALO_TIMEOUT` - Request timeout in milliseconds (default: `30000`)

**Important Notes:**

- Static access tokens expire after **25 hours** and require manual refresh
- You need to manually obtain a new token from Zalo Developer Console when the token expires
- OAuth mode is **strongly recommended** for production use as it handles token refresh automatically
- Use static token mode only for development, testing, or when you have a specific reason not to use OAuth

## License

MIT

## Support

For issues and feature requests, please visit [GitHub Issues](https://github.com/haposoft/zalo-zns-nestjs/issues).
