export interface ZnsModuleOptions {
  accessToken: string;
  apiUrl?: string;
  timeout?: number;
}

export interface ZnsAsyncOptions {
  useFactory?: (...args: any[]) => Promise<ZnsModuleOptions> | ZnsModuleOptions;
  inject?: any[];
  imports?: any[];
}
