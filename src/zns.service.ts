import { Injectable, Inject, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ZnsMessage, ZnsSendResponse } from './interfaces/zns-message.interface';
import {
  ZNS_MODULE_OPTIONS,
  DEFAULT_API_URL,
  DEFAULT_TIMEOUT,
  API_ENDPOINT,
} from './zns.constants';
import { ZnsModuleOptions } from './interfaces/zns-options.interface';

@Injectable()
export class ZnsService {
  private readonly logger = new Logger(ZnsService.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(
    @Inject(ZNS_MODULE_OPTIONS)
    private readonly options: ZnsModuleOptions,
  ) {
    const apiUrl = options.apiUrl || DEFAULT_API_URL;
    this.axiosInstance = axios.create({
      baseURL: apiUrl,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        access_token: options.accessToken,
      },
    });
  }

  /**
   * Send ZNS notification
   * @param message ZNS message object
   * @returns Promise with send response
   */
  async sendMessage(message: ZnsMessage): Promise<ZnsSendResponse> {
    try {
      this.logger.log(`Sending ZNS message to ${message.phone}`);

      const response = await this.axiosInstance.post<ZnsSendResponse>(API_ENDPOINT, {
        phone: message.phone,
        template_id: message.templateId,
        template_data: message.templateData || {},
        tracking_id: message.trackingId,
      });

      const { data } = response;
      if (data.error === 0) {
        this.logger.log(`ZNS message sent successfully. Tracking ID: ${data.data?.trackingId}`);
      } else {
        this.logger.warn(`ZNS message failed: ${data.message}`);
      }

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error sending ZNS message: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Send multiple ZNS notifications
   * @param messages Array of ZNS messages
   * @returns Promise with array of send responses
   */
  async sendBulkMessages(messages: ZnsMessage[]): Promise<ZnsSendResponse[]> {
    if (messages.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(messages.map((message) => this.sendMessage(message)));

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unknown error';
      return {
        error: -1,
        message: errorMessage,
      } as ZnsSendResponse;
    });
  }
}
