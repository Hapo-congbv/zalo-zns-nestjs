# Hướng dẫn sử dụng OAuth với Zalo ZNS NestJS

Package này hỗ trợ tự động lấy và refresh `access_token` thông qua OAuth flow với PKCE, không cần phải cấu hình `access_token` qua biến môi trường.

## Cấu hình OAuth

### 1. Cấu hình Module với OAuth

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZnsModule } from '@hapo-congbv/zalo-zns-nestjs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ZnsModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        oauthOptions: {
          appId: configService.get<string>('ZALO_APP_ID'),
          appSecret: configService.get<string>('ZALO_APP_SECRET'),
          redirectUri: configService.get<string>('ZALO_REDIRECT_URI'),
        },
        apiUrl: configService.get<string>('ZALO_API_URL', 'https://business.openapi.zalo.me'),
        timeout: configService.get<number>('ZALO_TIMEOUT', 30000),
        enableOAuthController: true, // Bật OAuth controller endpoints
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 2. Biến môi trường

```env
ZALO_APP_ID=your-app-id
ZALO_APP_SECRET=your-app-secret
ZALO_REDIRECT_URI=https://your-domain.com/zalo/oauth/callback
ZALO_API_URL=https://business.openapi.zalo.me
ZALO_TIMEOUT=30000
```

## OAuth Flow

### Bước 1: Lấy Authorization URL

Gọi endpoint để lấy authorization URL:

```bash
GET /zalo/oauth/authorize?state=optional-state
```

Response:

```json
{
  "success": true,
  "data": {
    "url": "https://oauth.zaloapp.com/v4/oa/permission?...",
    "state": "generated-state"
  }
}
```

### Bước 2: Người dùng xác thực

Chuyển hướng người dùng đến URL nhận được. Sau khi người dùng xác thực, Zalo sẽ redirect về `redirectUri` với `code` và `state`.

### Bước 3: Xử lý Callback

Zalo sẽ redirect về:

```
https://your-domain.com/zalo/oauth/callback?code=AUTHORIZATION_CODE&state=STATE
```

Package tự động xử lý callback và lưu token. Bạn có thể tạo một route để xử lý callback:

```typescript
@Get('zalo/oauth/callback')
async handleCallback(@Query('code') code: string, @Query('state') state: string) {
  // Package đã tự động xử lý và lưu token
  // Bạn có thể redirect về trang thành công
  return { success: true };
}
```

Hoặc sử dụng endpoint có sẵn:

```
GET /zalo/oauth/callback?code=xxx&state=xxx
```

## Sử dụng ZnsService

Sau khi hoàn thành OAuth flow, `ZnsService` sẽ tự động sử dụng `access_token` đã lưu:

```typescript
import { Injectable } from '@nestjs/common';
import { ZnsService, ZnsMessage } from '@hapo-congbv/zalo-zns-nestjs';

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
    };

    // Token sẽ được tự động lấy và refresh nếu cần
    const result = await this.znsService.sendMessage(message);
    return result;
  }
}
```

## Token Management

### Kiểm tra trạng thái token

```bash
GET /zalo/oauth/token-status
```

### Refresh token thủ công

```bash
POST /zalo/oauth/refresh
Content-Type: application/json

{
  "refreshToken": "optional-refresh-token"
}
```

### Generate PKCE pair (cho testing)

```bash
GET /zalo/oauth/pkce
```

## Token Storage

Mặc định, package sử dụng in-memory storage. Token sẽ mất khi restart server.

### Sử dụng custom storage (ví dụ: Redis)

```typescript
import { Injectable } from '@nestjs/common';
import { TokenStorage, ZaloTokenData } from '@hapo-congbv/zalo-zns-nestjs';
import Redis from 'ioredis';

@Injectable()
export class RedisTokenStorage implements TokenStorage {
  constructor(private readonly redis: Redis) {}

  async getToken(): Promise<ZaloTokenData | null> {
    const data = await this.redis.get('zalo:token');
    return data ? JSON.parse(data) : null;
  }

  async saveToken(token: ZaloTokenData): Promise<void> {
    await this.redis.set('zalo:token', JSON.stringify(token));
  }

  async clearToken(): Promise<void> {
    await this.redis.del('zalo:token');
  }
}

// Trong module configuration
ZnsModule.forRoot({
  oauthOptions: { ... },
  tokenStorage: new RedisTokenStorage(redis),
});
```

## Tự động Refresh Token

Package tự động refresh token khi:

- Token hết hạn
- Token sắp hết hạn (trong vòng 5 phút)
- Khi gọi API và token không còn hợp lệ

## Migration từ Access Token cũ

Nếu bạn đang sử dụng `accessToken` trực tiếp, bạn vẫn có thể tiếp tục sử dụng:

```typescript
ZnsModule.forRoot({
  accessToken: 'your-token', // Vẫn hoạt động
});
```

Hoặc chuyển sang OAuth:

```typescript
ZnsModule.forRoot({
  oauthOptions: {
    appId: '...',
    appSecret: '...',
    redirectUri: '...',
  },
});
```

## Lưu ý

1. **Access Token hết hạn sau 25 giờ**: Package tự động refresh, không cần can thiệp thủ công
2. **Refresh Token**: Có thể hết hạn sau 30 ngày, cần re-authorize
3. **Code Verifier Storage**: Trong production, nên sử dụng Redis hoặc database thay vì in-memory
4. **Security**: Luôn sử dụng HTTPS cho redirect URI trong production
