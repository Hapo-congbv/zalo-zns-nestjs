export interface ZnsMessage {
  phone: string;
  templateId: string;
  templateData?: Record<string, any>;
  trackingId?: string;
}

export interface ZnsSendResponse {
  error: number;
  message: string;
  data?: {
    trackingId: string;
  };
}
