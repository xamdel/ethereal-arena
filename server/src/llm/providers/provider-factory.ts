import { LLMProvider } from './base-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { CerebrasProvider } from './cerebras-provider';

export type ProviderType = 'openrouter' | 'cerebras';

export class ProviderFactory {
  static createProvider(providerType: ProviderType, config: any = {}): LLMProvider {
    switch (providerType) {
      case 'openrouter':
        return new OpenRouterProvider(config);
      case 'cerebras':
        return new CerebrasProvider(config);
      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }

  static getDefaultProvider(): ProviderType {
    const provider = process.env.LLM_PROVIDER;
    if (provider === 'cerebras') {
      return 'cerebras';
    }
    return 'openrouter'; // default to openrouter
  }
}
