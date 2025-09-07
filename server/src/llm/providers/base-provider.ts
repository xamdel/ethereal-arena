export interface LLMResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

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

export interface LLMProviderConfig {
  apiKey?: string;
  defaultModel: string;
  maxRetries: number;
  retryDelay: number;
  httpReferer?: string;
  xTitle?: string;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  response_format?: 'json_object' | { type: 'json_schema'; json_schema: any };
}

export interface StreamOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface LLMProvider {
  complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse>;
  createStream(prompt: string, options?: StreamOptions): AsyncGenerator<{choices: {delta: {content?: string}}[], done: boolean}>;
  getConfig(): LLMProviderConfig;
}
