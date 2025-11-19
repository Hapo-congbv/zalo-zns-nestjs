import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZnsService } from './zns.service';
import { ZnsModuleOptions, ZnsAsyncOptions } from './interfaces/zns-options.interface';
import { ZNS_MODULE_OPTIONS, ZNS_OAUTH_OPTIONS, ZNS_TOKEN_STORAGE } from './zns.constants';
import { ZaloAuthService } from './services/zalo-auth.service';
import { PkceService } from './services/pkce.service';
import { MemoryTokenStorageService } from './services/memory-token-storage.service';
import { TokenStorage } from './interfaces/zns-oauth.interface';
import { ZaloOAuthController } from './controllers/zalo-oauth.controller';

@Module({})
export class ZnsModule {
  /**
   * Create providers array for module configuration
   */
  private static createProviders(options: ZnsModuleOptions | ZnsAsyncOptions): Provider[] {
    const providers: Provider[] = [];

    // Handle async or sync options
    if ('useFactory' in options && options.useFactory) {
      providers.push({
        provide: ZNS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      });

      // For async, always set up OAuth providers (they'll check if oauthOptions exists)
      providers.push({
        provide: ZNS_OAUTH_OPTIONS,
        useFactory: async (...args: any[]) => {
          const result = options.useFactory!(...args);
          const moduleOptions = result instanceof Promise ? await result : result;
          const oauthOptions = moduleOptions?.oauthOptions;
          console.log('ZNS_OAUTH_OPTIONS factory - moduleOptions:', {
            hasModuleOptions: !!moduleOptions,
            hasOauthOptions: !!oauthOptions,
            oauthOptionsType: typeof oauthOptions,
          });
          return oauthOptions;
        },
        inject: options.inject || [],
      });
      providers.push({
        provide: ZNS_TOKEN_STORAGE,
        useFactory: async (...args: any[]) => {
          const moduleOptions = await options.useFactory!(...args);
          return moduleOptions?.tokenStorage || new MemoryTokenStorageService();
        },
        inject: options.inject || [],
      });
    } else {
      const syncOptions = options as ZnsModuleOptions;
      providers.push({
        provide: ZNS_MODULE_OPTIONS,
        useValue: syncOptions,
      });

      // Always provide OAuth providers (they'll be null/undefined if OAuth not configured)
      providers.push({
        provide: ZNS_OAUTH_OPTIONS,
        useValue: syncOptions.oauthOptions || null,
      });
      providers.push({
        provide: ZNS_TOKEN_STORAGE,
        useValue: syncOptions.tokenStorage || new MemoryTokenStorageService(),
      });
    }

    // Always add OAuth services (they'll be conditionally used)
    providers.push(PkceService);
    providers.push({
      provide: ZaloAuthService,
      useFactory: async (
        oauthOptions: any,
        tokenStorage: TokenStorage,
        pkceService: PkceService,
      ) => {
        // Handle both sync and async oauthOptions
        const resolvedOauthOptions =
          oauthOptions instanceof Promise ? await oauthOptions : oauthOptions;
        console.log('ZaloAuthService factory - oauthOptions:', {
          isNull: resolvedOauthOptions === null,
          isUndefined: resolvedOauthOptions === undefined,
          hasValue: !!resolvedOauthOptions,
          type: typeof resolvedOauthOptions,
        });
        if (!resolvedOauthOptions) {
          return null; // Return null if OAuth not configured
        }
        return new ZaloAuthService(resolvedOauthOptions, tokenStorage, pkceService);
      },
      inject: [ZNS_OAUTH_OPTIONS, ZNS_TOKEN_STORAGE, PkceService],
    });

    // Main service
    providers.push(ZnsService);

    return providers;
  }

  /**
   * Get controllers based on configuration
   */
  private static getControllers(options: ZnsModuleOptions | ZnsAsyncOptions): any[] {
    // For async, we can't determine at compile time, so include controller
    // It will check at runtime if OAuth is configured
    if ('useFactory' in options) {
      return [ZaloOAuthController];
    }

    // For sync, check if OAuth is enabled
    const resolvedOptions = options as ZnsModuleOptions;
    const enableController =
      resolvedOptions?.enableOAuthController !== false &&
      resolvedOptions?.oauthOptions !== undefined;

    return enableController ? [ZaloOAuthController] : [];
  }

  /**
   * Ensure ConfigModule is included in imports if needed
   */
  private static ensureConfigModule(imports: any[] = []): any[] {
    if (!imports.some((imp) => imp === ConfigModule)) {
      return [...imports, ConfigModule];
    }
    return imports;
  }

  /**
   * Register ZNS module with synchronous options
   */
  static forRoot(options: ZnsModuleOptions): DynamicModule {
    return {
      module: ZnsModule,
      controllers: this.getControllers(options),
      providers: this.createProviders(options),
      exports: [ZnsService],
      global: false,
    };
  }

  /**
   * Register ZNS module with async options
   */
  static forRootAsync(options: ZnsAsyncOptions): DynamicModule {
    return {
      module: ZnsModule,
      imports: this.ensureConfigModule(options.imports),
      controllers: this.getControllers(options),
      providers: this.createProviders(options),
      exports: [ZnsService],
      global: false,
    };
  }

  /**
   * Register ZNS module as global with synchronous options
   */
  static forRootGlobal(options: ZnsModuleOptions): DynamicModule {
    return {
      module: ZnsModule,
      controllers: this.getControllers(options),
      providers: this.createProviders(options),
      exports: [ZnsService],
      global: true,
    };
  }

  /**
   * Register ZNS module as global with async options
   */
  static forRootAsyncGlobal(options: ZnsAsyncOptions): DynamicModule {
    return {
      module: ZnsModule,
      imports: this.ensureConfigModule(options.imports),
      controllers: this.getControllers(options),
      providers: this.createProviders(options),
      exports: [ZnsService],
      global: true,
    };
  }
}
