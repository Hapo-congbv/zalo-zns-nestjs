import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZnsService } from './zns.service';
import { ZnsModuleOptions, ZnsAsyncOptions } from './interfaces/zns-options.interface';
import { ZNS_MODULE_OPTIONS } from './zns.constants';

@Module({})
export class ZnsModule {
  /**
   * Create providers array for module configuration
   */
  private static createProviders(options: ZnsModuleOptions | ZnsAsyncOptions): Provider[] {
    if ('useFactory' in options && options.useFactory) {
      return [
        {
          provide: ZNS_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        ZnsService,
      ];
    }

    return [
      {
        provide: ZNS_MODULE_OPTIONS,
        useValue: options,
      },
      ZnsService,
    ];
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
      providers: this.createProviders(options),
      exports: [ZnsService],
      global: true,
    };
  }
}
