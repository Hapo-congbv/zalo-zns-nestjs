import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZnsModule } from './zns.module';
import { ZnsService } from './zns.service';
import { ZnsModuleOptions } from './interfaces/zns-options.interface';

describe('ZnsModule', () => {
  it('should be defined', () => {
    expect(ZnsModule).toBeDefined();
  });

  describe('forRoot', () => {
    it('should create module with synchronous options', () => {
      const options: ZnsModuleOptions = {
        accessToken: 'test-token',
      };

      const module = ZnsModule.forRoot(options);

      expect(module.module).toBe(ZnsModule);
      expect(module.providers).toBeDefined();
      expect(module.exports).toContain(ZnsService);
      expect(module.global).toBe(false);
    });
  });

  describe('forRootAsync', () => {
    it('should create module with async options', () => {
      const module = ZnsModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          accessToken: configService.get<string>('ZALO_ACCESS_TOKEN') || 'default-token',
        }),
        inject: [ConfigService],
      });

      expect(module.module).toBe(ZnsModule);
      expect(module.imports).toContain(ConfigModule);
      expect(module.providers).toBeDefined();
      expect(module.exports).toContain(ZnsService);
      expect(module.global).toBe(false);
    });
  });

  describe('forRootGlobal', () => {
    it('should create global module with synchronous options', () => {
      const options: ZnsModuleOptions = {
        accessToken: 'test-token',
      };

      const module = ZnsModule.forRootGlobal(options);

      expect(module.module).toBe(ZnsModule);
      expect(module.global).toBe(true);
      expect(module.exports).toContain(ZnsService);
    });
  });

  describe('forRootAsyncGlobal', () => {
    it('should create global module with async options', () => {
      const module = ZnsModule.forRootAsyncGlobal({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          accessToken: configService.get<string>('ZALO_ACCESS_TOKEN') || 'default-token',
        }),
        inject: [ConfigService],
      });

      expect(module.module).toBe(ZnsModule);
      expect(module.global).toBe(true);
      expect(module.exports).toContain(ZnsService);
    });
  });

  describe('Module Integration', () => {
    it('should provide ZnsService when imported', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ZnsModule.forRoot({
            accessToken: 'test-token',
          }),
        ],
      }).compile();

      const service = module.get<ZnsService>(ZnsService);
      expect(service).toBeDefined();
    });
  });
});
