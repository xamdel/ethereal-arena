import dotenv from 'dotenv';
import OpenAI from 'openai';

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
  httpReferer?: string;
  xTitle?: string;
}

// Default configuration
const DEFAULT_CONFIG: LLMClientConfig = {
  defaultModel: 'google/gemini-2.0-flash-001',
  maxRetries: 3,
  retryDelay: 1000,
  httpReferer: 'https://etherealarena.com', // Uncommented for proper attribution
  xTitle: 'Ethereal Arena', 
};

export class LLMClient {
  private openai: OpenAI;
  private config: LLMClientConfig;
  private apiKey: string;

  constructor(config: Partial<LLMClientConfig> = {}) {
    // Merge provided config with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Use provided API key or fall back to environment variable
    this.apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required. Provide it in .env or via constructor options.');
    }

    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.apiKey,
      defaultHeaders: {
        'HTTP-Referer': this.config.httpReferer,
        'X-Title': this.config.xTitle,
      },
    });
  }

  /**
   * Send a completion request to the LLM API
   * Uses native fetch instead of OpenAI SDK for better control and compatibility
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
          console.log(`[LLMClient] Sending request to ${model} with ${prompt.length} chars prompt`);
          
          // Create the request payload
          const payload = {
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
          };
          
          // Log the request payload for debugging
          console.log(`[LLMClient] Request payload:`, JSON.stringify({
            model,
            messages_count: payload.messages.length,
            system_message_length: systemPrompt.length,
            user_message_length: prompt.length,
            max_tokens: maxTokens,
            temperature,
          }));
          
          // Use native fetch instead of the OpenAI SDK
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': this.config.httpReferer || 'https://etherealarena.com',
              'X-Title': this.config.xTitle || 'Ethereal Arena',
            },
            body: JSON.stringify(payload),
          });
          
          // Check for HTTP errors
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[LLMClient] API Error: ${response.status} ${response.statusText}`);
            console.error(`[LLMClient] Error response: ${errorText}`);
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          // Parse the response
          const completion = await response.json() as OpenRouterResponse;
          
          // Log the raw response for debugging
          console.log(`[LLMClient] Raw response:`, JSON.stringify(completion));
          
          // Safety check for completion.choices
          if (!completion.choices || !Array.isArray(completion.choices) || completion.choices.length === 0) {
            console.error('[LLMClient] Invalid response format: No choices returned');
            throw new Error('Invalid response from LLM API: No choices returned');
          }
          
          // Extract the content from the response
          const content = completion.choices[0]?.message?.content || '';
          
          if (!content) {
            console.warn('[LLMClient] Warning: Empty content returned from LLM API');
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
          console.error(`[LLMClient] Attempt ${attempt + 1} failed:`, error.message);

          // Determine if we should retry based on error type
          const shouldRetry = this.isRetryableError(error);
          if (!shouldRetry) {
            console.log(`[LLMClient] Error not retryable, breaking retry loop`);
            break;
          }

          // Wait before retrying
          if (attempt < this.config.maxRetries - 1) {
            const delayTime = this.config.retryDelay * Math.pow(2, attempt);
            console.log(`[LLMClient] Retrying after ${delayTime}ms...`);
            await this.delay(delayTime);
          }
        }
      }

      // Handle the error if all retries failed
      console.error(`[LLMClient] All ${this.config.maxRetries} retry attempts failed`);
      throw this.normalizeError(lastError);
    } catch (error: any) {
      throw this.normalizeError(error);
    }
  }
  
  /**
   * Create a streaming completion request
   * Uses native fetch with SSE handling instead of OpenAI SDK stream
   * Returns an async generator that yields content chunks
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
    const {
      model = this.config.defaultModel,
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt = "You are a helpful AI assistant that generates card game content and interprets card effects.",
    } = options;

    try {
      console.log(`[LLMClient] Creating stream for ${model} with ${prompt.length} chars prompt`);
      
      // Use native fetch for more control over the SSE stream
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLMClient] API Error: ${response.status} ${response.statusText}`);
        console.error(`[LLMClient] Error response: ${errorText}`);
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      console.log(`[LLMClient] Stream response received with status ${response.status}`);
      
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
            console.log(`[LLMClient] Stream reader completed`);
            yield { choices: [{ delta: { content: '' }}], done: true };
            break;
          }
          
          // Decode and buffer the chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete lines from buffer
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);
            
            // Skip comments from SSE
            if (line.startsWith(':')) {
              continue;
            }
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              // Check for stream completion marker
              if (data === '[DONE]') {
                console.log(`[LLMClient] Received [DONE] marker`);
                yield { choices: [{ delta: { content: '' }}], done: true };
                break;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                
                // Yield the content in a format compatible with our existing code
                yield {
                  choices: [{ delta: { content }}],
                  done: false
                };
              } catch (e) {
                console.warn(`[LLMClient] Error parsing SSE data: ${e instanceof Error ? e.message : e}`);
                console.warn(`[LLMClient] Problematic data: ${data}`);
                // Continue processing other chunks
              }
            }
          }
        }
      } catch (streamError) {
        console.error(`[LLMClient] Error reading stream: ${streamError instanceof Error ? streamError.message : streamError}`);
        reader.cancel();
        throw streamError;
      }
    } catch (error: any) {
      console.error('[LLMClient] Error creating stream:', error);
      throw this.normalizeError(error);
    }
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
    const {
      model = this.config.defaultModel,
      maxTokens = 4000,
      temperature = 0.7,
      systemPrompt = "You are a helpful AI assistant that generates card game content and interprets card effects.",
      onError
    } = options;
    
    try {
      // Create the streaming request
      const stream = await this.openai.chat.completions.create({
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
      });
      
      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      
      // Process the stream
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        
        // Update token counts if available
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens;
          completionTokens = chunk.usage.completion_tokens;
        }
        
        // Yield the content chunk
        yield content;
      }
      
      // Return the full response when stream is complete
      return {
        content: fullContent,
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    } catch (error: any) {
      const normalizedError = this.normalizeError(error);
      if (onError) {
        onError(normalizedError);
      }
      throw normalizedError;
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
      instance = new LLMClient();
    }
    return instance;
  };
})()();