import OpenAI from 'openai';
import { LLMProvider, LLMProviderConfig, CompletionOptions, StreamOptions, LLMResponse, LLMAPIError } from './base-provider';

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
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
}

export class OpenRouterProvider implements LLMProvider {
  private openai: OpenAI;
  private config: LLMProviderConfig;

  constructor(config: Partial<LLMProviderConfig> = {}) {
    const defaultConfig: LLMProviderConfig = {
      defaultModel: 'meta-llama/llama-4-scout',
      maxRetries: 3,
      retryDelay: 1000,
    };

    this.config = {
      ...defaultConfig,
      ...config,
    };

    const apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY || '';
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required for OpenRouter provider');
    }

    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': this.config.httpReferer,
        'X-Title': this.config.xTitle,
      },
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
          console.log(`[OpenRouterProvider] Sending request to ${model} with ${prompt.length} chars prompt`);
          
          const payload: any = {
            model,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: maxTokens,
            temperature,
            provider: {
              order: ["Groq"],
              allow_fallbacks: false,
            },
          };

          if (response_format) {
            payload.response_format = response_format;
          }
          
          console.log(`[OpenRouterProvider] Request payload:`, JSON.stringify({
            model,
            messages_count: payload.messages.length,
            system_message_length: systemPrompt.length,
            user_message_length: prompt.length,
            max_tokens: maxTokens,
            temperature,
            response_format_type: payload.response_format?.type,
            response_format_name: payload.response_format?.json_schema?.name,
            provider_order: payload.provider?.order,
            provider_allow_fallbacks: payload.provider?.allow_fallbacks,
          }));

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey || process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': this.config.httpReferer || 'https://etherealarena.com',
              'X-Title': this.config.xTitle || 'Ethereal Arena',
            },
            body: JSON.stringify(payload),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[OpenRouterProvider] API Error: ${response.status} ${response.statusText}`);
            console.error(`[OpenRouterProvider] Error response: ${errorText}`);
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const completion = await response.json() as OpenRouterResponse;
          
          console.log(`[OpenRouterProvider] Raw response:`, JSON.stringify(completion));
          
          if (!completion.choices || !Array.isArray(completion.choices) || completion.choices.length === 0) {
            console.error('[OpenRouterProvider] Invalid response format: No choices returned');
            throw new Error('Invalid response from LLM API: No choices returned');
          }
          
          const content = completion.choices[0]?.message?.content || '';
          
          if (!content) {
            console.warn('[OpenRouterProvider] Warning: Empty content returned from LLM API');
          }

          return {
            content,
            model: completion.model,
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
          };
        } catch (error: any) {
          lastError = error;
          console.error(`[OpenRouterProvider] Attempt ${attempt + 1} failed:`, error.message);

          const shouldRetry = this.isRetryableError(error);
          if (!shouldRetry) {
            console.log(`[OpenRouterProvider] Error not retryable, breaking retry loop`);
            break;
          }

          if (attempt < this.config.maxRetries - 1) {
            const delayTime = this.config.retryDelay * Math.pow(2, attempt);
            console.log(`[OpenRouterProvider] Retrying after ${delayTime}ms...`);
            await this.delay(delayTime);
          }
        }
      }

      console.error(`[OpenRouterProvider] All ${this.config.maxRetries} retry attempts failed`);
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
      console.log(`[OpenRouterProvider] Creating stream for ${model} with ${prompt.length} chars prompt`);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey || process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.config.httpReferer || '',
          'X-Title': this.config.xTitle || '',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: maxTokens,
          temperature,
          stream: true,
          provider: {
            order: ["Groq"],
            allow_fallbacks: false,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OpenRouterProvider] API Error: ${response.status} ${response.statusText}`);
        console.error(`[OpenRouterProvider] Error response: ${errorText}`);
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      console.log(`[OpenRouterProvider] Stream response received with status ${response.status}`);
      
      if (!response.body) {
        throw new Error('Response body is not readable');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log(`[OpenRouterProvider] Stream reader completed`);
            yield { choices: [{ delta: { content: '' }}], done: true };
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);
            
            if (line.startsWith(':')) {
              continue;
            }
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                console.log(`[OpenRouterProvider] Received [DONE] marker`);
                yield { choices: [{ delta: { content: '' }}], done: true };
                break;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                
                yield {
                  choices: [{ delta: { content }}],
                  done: false
                };
              } catch (e) {
                console.warn(`[OpenRouterProvider] Error parsing SSE data: ${e instanceof Error ? e.message : e}`);
                console.warn(`[OpenRouterProvider] Problematic data: ${data}`);
              }
            }
          }
        }
      } catch (streamError) {
        console.error(`[OpenRouterProvider] Error reading stream: ${streamError instanceof Error ? streamError.message : streamError}`);
        reader.cancel();
        throw streamError;
      }
    } catch (error: any) {
      console.error('[OpenRouterProvider] Error creating stream:', error);
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
