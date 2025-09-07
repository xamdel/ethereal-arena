import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { LLMProvider, LLMProviderConfig, CompletionOptions, StreamOptions, LLMResponse, LLMAPIError } from './base-provider';

interface CerebrasResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  created: number;
  object: string;
}

interface CerebrasStreamResponse {
  id: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  created: number;
  object: string;
}

export class CerebrasProvider implements LLMProvider {
  private cerebras: Cerebras;
  private config: LLMProviderConfig;

  constructor(config: Partial<LLMProviderConfig> = {}) {
    const defaultConfig: LLMProviderConfig = {
      defaultModel: 'llama-4-scout-17b-16e-instruct',
      maxRetries: 3,
      retryDelay: 1000,
    };

    this.config = {
      ...defaultConfig,
      ...config,
    };

    const apiKey = this.config.apiKey || process.env.CEREBRAS_API_KEY || '';
    if (!apiKey) {
      throw new Error('CEREBRAS_API_KEY is required for Cerebras provider');
    }

    this.cerebras = new Cerebras({
      apiKey: apiKey,
    });
  }

  public async complete(prompt: string, options: CompletionOptions = {}): Promise<LLMResponse> {
    const {
      model = this.config.defaultModel,
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt = "You are a helpful AI assistant that generates card game content and interprets card effects.",
      response_format,
    } = options;

    try {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
        try {
          console.log(`[CerebrasProvider] Sending request to ${model} with ${prompt.length} chars prompt`);
          
          const messages = [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: prompt },
          ];

          console.log(`[CerebrasProvider] Request payload:`, JSON.stringify({
            model,
            messages_count: messages.length,
            system_message_length: systemPrompt.length,
            user_message_length: prompt.length,
            max_tokens: maxTokens,
            temperature,
            response_format_type: response_format?.type,
            response_format_name: (response_format as any)?.json_schema?.name,
          }));

          const requestPayload: any = {
            messages,
            model,
            max_tokens: maxTokens,
            temperature,
          };

          if (response_format) {
            requestPayload.response_format = response_format;
          }

          const response = await this.cerebras.chat.completions.create(requestPayload);

          console.log(`[CerebrasProvider] Raw response:`, JSON.stringify(response));

          const responseData = response as any;
          
          if (!responseData.choices || !Array.isArray(responseData.choices) || responseData.choices.length === 0) {
            console.error('[CerebrasProvider] Invalid response format: No choices returned');
            throw new Error('Invalid response from LLM API: No choices returned');
          }

          const content = responseData.choices[0]?.message?.content || '';
          
          if (!content) {
            console.warn('[CerebrasProvider] Warning: Empty content returned from LLM API');
          }

          return {
            content,
            model: responseData.model || model,
            promptTokens: responseData.usage?.prompt_tokens || 0,
            completionTokens: responseData.usage?.completion_tokens || 0,
            totalTokens: responseData.usage?.total_tokens || 0,
          };
        } catch (error: any) {
          lastError = error;
          console.error(`[CerebrasProvider] Attempt ${attempt + 1} failed:`, error.message);

          const shouldRetry = this.isRetryableError(error);
          if (!shouldRetry) {
            console.log(`[CerebrasProvider] Error not retryable, breaking retry loop`);
            break;
          }

          if (attempt < this.config.maxRetries - 1) {
            const delayTime = this.config.retryDelay * Math.pow(2, attempt);
            console.log(`[CerebrasProvider] Retrying after ${delayTime}ms...`);
            await this.delay(delayTime);
          }
        }
      }

      console.error(`[CerebrasProvider] All ${this.config.maxRetries} retry attempts failed`);
      throw this.normalizeError(lastError);
    } catch (error: any) {
      throw this.normalizeError(error);
    }
  }

  public async *createStream(prompt: string, options: StreamOptions = {}): AsyncGenerator<{choices: {delta: {content?: string}}[], done: boolean}> {
    const {
      model = this.config.defaultModel,
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt = "You are a helpful AI assistant that generates card game content and interprets card effects.",
    } = options;

    try {
      console.log(`[CerebrasProvider] Creating stream for ${model} with ${prompt.length} chars prompt`);
      
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt },
      ];

      const stream = await this.cerebras.chat.completions.create({
        messages,
        model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }) as AsyncIterable<any>;

      console.log(`[CerebrasProvider] Stream response received`);

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        
        yield {
          choices: [{ delta: { content }}],
          done: false
        };
      }

      // Send final completion marker
      yield { choices: [{ delta: { content: '' }}], done: true };

    } catch (error: any) {
      console.error('[CerebrasProvider] Error creating stream:', error);
      throw this.normalizeError(error);
    }
  }

  public getConfig(): LLMProviderConfig {
    return this.config;
  }

  private isRetryableError(error: any): boolean {
    if (error.status === 429) {
      return true;
    }

    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    if (error.name === 'FetchError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  private normalizeError(error: any): LLMAPIError {
    if (!error) {
      return new LLMAPIError('Unknown error occurred', 'unknown');
    }

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

      if (message.includes('Unexpected token') || 
          message.includes('JSON') || 
          message.includes('Cannot read property') ||
          message.includes('Cannot read properties')) {
        type = 'server';
        message = `Invalid response format from LLM API: ${message}`;
      }
    } catch (e) {
      return new LLMAPIError(`Error normalizing error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'unknown');
    }

    return new LLMAPIError(message, type, status);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
