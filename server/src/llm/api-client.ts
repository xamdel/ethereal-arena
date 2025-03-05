import dotenv from 'dotenv';
import { AnthropicClient } from '@anthropic-ai/sdk';

// Load environment variables
dotenv.config();

// Define types for LLM responses
export interface LLMResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Error type for LLM API calls
export class LLMAPIError extends Error {
  public readonly status?: number;
  public readonly type: 'rate_limit' | 'auth' | 'server' | 'client' | 'unknown';
  public readonly retryable: boolean;

  constructor(message: string, type: 'rate_limit' | 'auth' | 'server' | 'client' | 'unknown', status?: number) {
    super(message);
    this.name = 'LLMAPIError';
    this.type = type;
    this.status = status;
    this.retryable = type === 'rate_limit' || type === 'server';
  }
}

// LLM client configuration
interface LLMClientConfig {
  apiKey?: string;
  defaultModel: string;
  maxRetries: number;
  retryDelay: number;
}

// Default configuration
const DEFAULT_CONFIG: LLMClientConfig = {
  defaultModel: 'claude-3-opus-20240229',
  maxRetries: 3,
  retryDelay: 1000,
};

export class LLMClient {
  private anthropic: AnthropicClient;
  private config: LLMClientConfig;

  constructor(config: Partial<LLMClientConfig> = {}) {
    // Merge provided config with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Use provided API key or fall back to environment variable
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required. Provide it in .env or via constructor options.');
    }

    this.anthropic = new AnthropicClient({ apiKey });
  }

  /**
   * Send a completion request to the LLM API
   */
  public async complete(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<LLMResponse> {
    const {
      model = this.config.defaultModel,
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt = "You are a helpful AI assistant that generates card game content and interprets card effects.",
    } = options;

    try {
      // Implement retry logic for transient errors
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
        try {
          const response = await this.anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
          });

          // Extract the content from the response
          const content = response.content[0].text;
          
          return {
            content,
            model: response.model,
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          };
        } catch (error: any) {
          lastError = error;
          
          // Determine if we should retry based on error type
          const shouldRetry = this.isRetryableError(error);
          if (!shouldRetry) {
            break;
          }
          
          // Wait before retrying
          if (attempt < this.config.maxRetries - 1) {
            await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          }
        }
      }

      // Handle the error if all retries failed
      throw this.normalizeError(lastError);
    } catch (error: any) {
      throw this.normalizeError(error);
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

    if (error.status) {
      status = error.status;
      if (status === 429) {
        type = 'rate_limit';
        message = 'Rate limit exceeded';
      } else if (status === 401 || status === 403) {
        type = 'auth';
        message = 'Authentication error';
      } else if (status >= 500) {
        type = 'server';
        message = 'Server error';
      } else if (status >= 400) {
        type = 'client';
        message = error.message || 'Client error';
      }
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

// Export a singleton instance for convenience
export const llmClient = new LLMClient();