# haposoft zalo-zns-nestjs

Zalo Notification Service (ZNS) NestJS module for sending notifications via Zalo ZNS API.

> **Note**: Publish public packages lên npm hoàn toàn **miễn phí**. Package này là public package nên không có chi phí.

## Installation

```bash
npm install @haposoft/zalo-zns-nestjs
```

or

```bash
yarn add @haposoft/zalo-zns-nestjs
```

## Quick Start

### 1. Import Module

#### Synchronous Configuration

```typescript
import { Module } from '@nestjs/common';
import { ZnsModule } from '@haposoft/zalo-zns-nestjs';

@Module({
  imports: [
    ZnsModule.forRoot({
      accessToken: 'your-zalo-access-token',
      apiUrl: 'https://business.openapi.zalo.me', // Optional, default value
      timeout: 30000, // Optional, default 30000ms
    }),
  ],
})
export class AppModule {}
```

#### Asynchronous Configuration (Recommended)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZnsModule } from '@haposoft/zalo-zns-nestjs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ZnsModule.forRootAsync({
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

#### Global Module

If you want to use ZnsService globally without importing ZnsModule in every module:

```typescript
// Synchronous
ZnsModule.forRootGlobal({
  accessToken: 'your-zalo-access-token',
})

// Asynchronous
ZnsModule.forRootAsyncGlobal({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    accessToken: configService.get<string>('ZALO_ACCESS_TOKEN'),
  }),
  inject: [ConfigService],
})
```

### 2. Use ZnsService

```typescript
import { Injectable } from '@nestjs/common';
import { ZnsService } from '@haposoft/zalo-zns-nestjs';
import { ZnsMessage } from '@haposoft/zalo-zns-nestjs';

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
  accessToken: string;      // Required: Zalo access token
  apiUrl?: string;          // Optional: API URL (default: 'https://business.openapi.zalo.me')
  timeout?: number;         // Optional: Request timeout in ms (default: 30000)
}
```

#### `ZnsMessage`

```typescript
interface ZnsMessage {
  phone: string;                    // Required: Phone number
  templateId: string;               // Required: ZNS template ID
  templateData?: Record<string, any>; // Optional: Template data
  trackingId?: string;              // Optional: Tracking ID
}
```

#### `ZnsSendResponse`

```typescript
interface ZnsSendResponse {
  error: number;                    // 0 = success, non-zero = error
  message: string;                  // Response message
  data?: {
    trackingId: string;             // Tracking ID if successful
  };
}
```

## Environment Variables

```env
ZALO_ACCESS_TOKEN=your-access-token
ZALO_API_URL=https://business.openapi.zalo.me
ZALO_TIMEOUT=30000
```

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## License

MIT

## Support

For issues and feature requests, please visit [GitHub Issues](https://github.com/haposoft/zalo-zns-nestjs/issues).

