import dotenv from 'dotenv';
import { ProviderFactory, ProviderType } from './providers/provider-factory';
import { LLMProvider, LLMResponse, LLMAPIError } from './providers/base-provider';

// Load environment variables
dotenv.config();

// LLM client configuration
interface LLMClientConfig {
  apiKey?: string;
  defaultModel: string;
  maxRetries: number;
  retryDelay: number;
  httpReferer?: string;
  xTitle?: string;
  provider?: ProviderType;
}

// Default configuration
const DEFAULT_CONFIG: LLMClientConfig = {
  defaultModel: 'llama-4-scout-17b-16e-instruct',
  maxRetries: 3,
  retryDelay: 1000,
  provider: ProviderFactory.getDefaultProvider(),
};

export class LLMClient {
  private provider: LLMProvider;
  private config: LLMClientConfig;

  constructor(config: Partial<LLMClientConfig> = {}) {
    // Merge provided config with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Create the appropriate provider
    this.provider = ProviderFactory.createProvider(this.config.provider!, {
      apiKey: this.config.apiKey,
      defaultModel: this.config.defaultModel,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      httpReferer: this.config.httpReferer,
      xTitle: this.config.xTitle,
    });
  }

  /**
   * Send a completion request to the LLM API
   * Delegates to the active provider
   */
  public async complete(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      response_format?: 'json_object' | { type: 'json_schema'; json_schema: any };
    } = {}
  ): Promise<LLMResponse> {
    // Convert options to provider format
    const providerOptions = {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
      response_format: options.response_format,
    };

    return await this.provider.complete(prompt, providerOptions);
  }
  
  /**
   * Create a streaming completion request
   * Delegates to the active provider
   */
  public async *createStream(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): AsyncGenerator<{choices: {delta: {content?: string}}[], done: boolean}> {
    // Convert options to provider format
    const providerOptions = {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
    };

    yield* this.provider.createStream(prompt, providerOptions);
  }
  
  /**
   * Send a streaming completion request to the LLM API
   * Returns an async generator that can be used with for-await-of
   */
  public async *completeStream(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      onError?: (error: Error) => void;
    } = {}
  ): AsyncGenerator<string, LLMResponse, unknown> {
    try {
      const stream = this.createStream(prompt, options);
      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        yield content;
      }
      
      // Return a mock response since we don't have token counts from streaming
      return {
        content: fullContent,
        model: options.model || this.config.defaultModel,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    } catch (error: any) {
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Rate limit errors should be retried
    if (error.status === 429) {
      return true;
    }

    // Server errors (5xx) should be retried
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Network errors should be retried
    if (error.name === 'FetchError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Normalize error to our standard error type
   */
  private normalizeError(error: any): LLMAPIError {
    if (!error) {
      return new LLMAPIError('Unknown error occurred', 'unknown');
    }

    // Already normalized
    if (error instanceof LLMAPIError) {
      return error;
    }

    let type: 'rate_limit' | 'auth' | 'server' | 'client' | 'unknown' = 'unknown';
    let status: number | undefined = undefined;
    let message = error.message || 'Unknown error occurred';

    try {
      if (error.response?.status) {
        status = error.response.status;
        message = error.response.data?.error?.message || message;

        if (status === 429) {
          type = 'rate_limit';
          message = 'Rate limit exceeded';
        } else if (status === 401 || status === 403) {
          type = 'auth';
          message = 'Authentication error';
        } else if (status && status >= 500) {
          type = 'server';
          message = 'Server error';
        } else if (status && status >= 400) {
          type = 'client';
          message = error.message || 'Client error';
        }
      }

      // Handle JSON parsing errors or unexpected response format
      if (message.includes('Unexpected token') || 
          message.includes('JSON') || 
          message.includes('Cannot read property') ||
          message.includes('Cannot read properties')) {
        type = 'server';
        message = `Invalid response format from LLM API: ${message}`;
      }
    } catch (e) {
      // If we get an error while trying to normalize an error, just return a generic error
      return new LLMAPIError(`Error normalizing error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'unknown');
    }

    return new LLMAPIError(message, type, status);
  }

  /**
   * Helper method for async delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a lazy-loaded singleton instance for convenience
export const llmClient = (() => {
  let instance: LLMClient | null = null;
  return () => {
    if (!instance) {
      instance = new LLMClient({
        provider: ProviderFactory.getDefaultProvider()
      });
    }
    return instance;
  };
})()();
