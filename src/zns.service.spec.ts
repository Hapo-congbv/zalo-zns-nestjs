import { Test, TestingModule } from '@nestjs/testing';
import { ZnsService } from './zns.service';
import { ZNS_MODULE_OPTIONS } from './zns.constants';
import { ZnsModuleOptions } from './interfaces/zns-options.interface';
import axios, { AxiosInstance } from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZnsService', () => {
  let service: ZnsService;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  const mockOptions: ZnsModuleOptions = {
    accessToken: 'test-access-token',
    apiUrl: 'https://business.openapi.zalo.me',
    timeout: 30000,
  };

  /**
   * Create a mock axios instance
   */
  const createMockAxiosInstance = (): jest.Mocked<AxiosInstance> =>
    ({
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      defaults: {} as any,
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
      },
      getUri: jest.fn(),
    }) as any;

  beforeEach(() => {
    mockAxiosInstance = createMockAxiosInstance();
    mockedAxios.create = jest.fn(() => mockAxiosInstance) as any;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZnsService,
        {
          provide: ZNS_MODULE_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<ZnsService>(ZnsService);
    // Clear only the post method mocks, not axios.create
    mockAxiosInstance.post.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mockedAxios.create).toHaveBeenCalled();
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        data: {
          error: 0,
          message: 'Success',
          data: {
            trackingId: 'tracking-123',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const message = {
        phone: '0912345678',
        templateId: 'template-123',
        templateData: { name: 'Test' },
      };

      const result = await service.sendMessage(message);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/message/template', {
        phone: message.phone,
        template_id: message.templateId,
        template_data: message.templateData,
        tracking_id: undefined,
      });
      expect(result).toEqual(mockResponse.data);
      expect(result.error).toBe(0);
      expect(result.data?.trackingId).toBe('tracking-123');
    });

    it('should handle error when sending message', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);

      const message = {
        phone: '0912345678',
        templateId: 'template-123',
      };

      await expect(service.sendMessage(message)).rejects.toThrow('Network error');
      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('sendBulkMessages', () => {
    it('should return empty array for empty messages', async () => {
      const results = await service.sendBulkMessages([]);
      expect(results).toEqual([]);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should send multiple messages', async () => {
      const mockResponse1 = {
        data: {
          error: 0,
          message: 'Success',
          data: { trackingId: 'tracking-123' },
        },
      };

      const mockResponse2 = {
        data: {
          error: 0,
          message: 'Success',
          data: { trackingId: 'tracking-456' },
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const messages = [
        { phone: '0912345678', templateId: 'template-1' },
        { phone: '0987654321', templateId: 'template-2' },
      ];

      const results = await service.sendBulkMessages(messages);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockResponse1.data);
      expect(results[1]).toEqual(mockResponse2.data);
      expect(results[0].error).toBe(0);
      expect(results[1].error).toBe(0);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in bulk send', async () => {
      const mockResponse1 = {
        data: {
          error: 0,
          message: 'Success',
          data: { trackingId: 'tracking-1' },
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockResponse1)
        .mockRejectedValueOnce(new Error('Failed'));

      const messages = [
        { phone: '0912345678', templateId: 'template-1' },
        { phone: '0987654321', templateId: 'template-2' },
      ];

      const results = await service.sendBulkMessages(messages);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBe(0);
      expect(results[1].error).toBe(-1);
      expect(results[1].message).toBe('Failed');
    });
  });
});
