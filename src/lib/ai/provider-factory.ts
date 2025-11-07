/**
 * AI Provider Factory
 * Intelligently selects and creates AI service instances
 * Implements the "Auto" model selection logic similar to Dyad desktop
 */

import { AIProvider, AIModel, AIMessage, AIModelConfig } from '@/types';
import { OpenAIService, createOpenAIService } from './openai-service';
import { AnthropicService, createAnthropicService } from './anthropic-service';
import { GoogleGeminiService, createGoogleGeminiService } from './google-service';
import { StreamChunk, ChatCompletionOptions } from './openai-service';

export interface AIServiceInterface {
  chatCompletion(
    messages: AIMessage[],
    options?: ChatCompletionOptions
  ): Promise<{ content: string; tokens_used: number; model: string }>;
  
  streamChatCompletion(
    messages: AIMessage[],
    options?: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk>;
  
  testConnection(): Promise<{ success: boolean; error?: string }>;
  listModels(): string[] | Promise<string[]>;
  estimateTokens(messages: AIMessage[]): number;
}

/**
 * Model availability and pricing information
 */
export const MODEL_INFO = {
  'gpt-4': {
    provider: 'openai' as AIProvider,
    display_name: 'GPT-4',
    description: 'Most capable GPT-4 model, best for complex tasks',
    context_window: 8192,
    pricing: { input_per_1k_tokens: 0.03, output_per_1k_tokens: 0.06 },
    is_free: false,
  },
  'gpt-4-turbo': {
    provider: 'openai' as AIProvider,
    display_name: 'GPT-4 Turbo',
    description: 'Faster and cheaper than GPT-4, 128K context',
    context_window: 128000,
    pricing: { input_per_1k_tokens: 0.01, output_per_1k_tokens: 0.03 },
    is_free: false,
  },
  'gpt-4.1-mini': {
    provider: 'openai' as AIProvider,
    display_name: 'GPT-4.1 Mini',
    description: 'Fast and affordable, with free tier',
    context_window: 16384,
    pricing: { input_per_1k_tokens: 0.00015, output_per_1k_tokens: 0.0006 },
    is_free: true,
  },
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic' as AIProvider,
    display_name: 'Claude 3.5 Sonnet',
    description: 'Best Claude model for coding, excellent reasoning',
    context_window: 200000,
    pricing: { input_per_1k_tokens: 0.003, output_per_1k_tokens: 0.015 },
    is_free: false,
  },
  'claude-3-opus-20240229': {
    provider: 'anthropic' as AIProvider,
    display_name: 'Claude 3 Opus',
    description: 'Most powerful Claude model',
    context_window: 200000,
    pricing: { input_per_1k_tokens: 0.015, output_per_1k_tokens: 0.075 },
    is_free: false,
  },
  'gemini-2.5-flash': {
    provider: 'google' as AIProvider,
    display_name: 'Gemini 2.5 Flash',
    description: 'Fast and free (250 msgs/day), great for prototyping',
    context_window: 32768,
    pricing: { input_per_1k_tokens: 0, output_per_1k_tokens: 0 },
    is_free: true,
  },
  'gemini-2.5-pro': {
    provider: 'google' as AIProvider,
    display_name: 'Gemini 2.5 Pro',
    description: 'Most capable Gemini model, 2M context',
    context_window: 2000000,
    pricing: { input_per_1k_tokens: 0.00125, output_per_1k_tokens: 0.005 },
    is_free: false,
  },
};

/**
 * AI Provider Factory
 * Creates appropriate AI service based on provider and API key
 */
export class AIProviderFactory {
  /**
   * Create AI service instance based on provider
   */
  static createService(
    provider: AIProvider,
    apiKey: string
  ): AIServiceInterface {
    switch (provider) {
      case 'openai':
        return createOpenAIService(apiKey);
      case 'anthropic':
        return createAnthropicService(apiKey);
      case 'google':
        return createGoogleGeminiService(apiKey);
      case 'auto':
        throw new Error('Cannot create service for "auto" provider. Use selectBestProvider() first.');
      case 'openrouter':
        throw new Error('OpenRouter not yet implemented');
      case 'local':
        throw new Error('Local models not yet implemented');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Auto-select the best available provider based on user's API keys
   * Priority: Google Gemini (free) -> OpenAI -> Anthropic -> System keys
   */
  static selectBestProvider(
    userConfigs: AIModelConfig[]
  ): { provider: AIProvider; model: AIModel | string; apiKey: string } | null {
    // Priority 1: Google Gemini (free tier)
    const googleConfig = userConfigs.find((c) => c.provider === 'google' && c.api_key_encrypted);
    if (googleConfig && googleConfig.api_key_encrypted) {
      return {
        provider: 'google',
        model: 'gemini-2.5-flash',
        apiKey: googleConfig.api_key_encrypted, // Will be decrypted by caller
      };
    }

    // Priority 2: OpenAI (if user has key)
    const openaiConfig = userConfigs.find((c) => c.provider === 'openai' && c.api_key_encrypted);
    if (openaiConfig && openaiConfig.api_key_encrypted) {
      return {
        provider: 'openai',
        model: openaiConfig.model_name || 'gpt-4',
        apiKey: openaiConfig.api_key_encrypted,
      };
    }

    // Priority 3: Anthropic (if user has key)
    const anthropicConfig = userConfigs.find((c) => c.provider === 'anthropic' && c.api_key_encrypted);
    if (anthropicConfig && anthropicConfig.api_key_encrypted) {
      return {
        provider: 'anthropic',
        model: anthropicConfig.model_name || 'claude-3-5-sonnet-20241022',
        apiKey: anthropicConfig.api_key_encrypted,
      };
    }

    // Priority 4: System-wide keys (from env variables)
    if (process.env.GOOGLE_AI_API_KEY) {
      return {
        provider: 'google',
        model: 'gemini-2.5-flash',
        apiKey: process.env.GOOGLE_AI_API_KEY,
      };
    }

    if (process.env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY,
      };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    }

    // No API keys available
    return null;
  }

  /**
   * Get provider from model name
   */
  static getProviderForModel(model: AIModel | string): AIProvider {
    const modelInfo = MODEL_INFO[model as keyof typeof MODEL_INFO];
    if (modelInfo) {
      return modelInfo.provider;
    }

    // Infer from model name
    if (model.includes('gpt')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('gemini')) return 'google';
    if (model.includes('deepseek')) return 'openrouter';
    
    throw new Error(`Unknown model: ${model}`);
  }

  /**
   * Validate API key format
   */
  static validateAPIKeyFormat(provider: AIProvider, apiKey: string): boolean {
    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      case 'anthropic':
        return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
      case 'google':
        return apiKey.length >= 30; // Google API keys don't have a specific prefix
      default:
        return apiKey.length > 10;
    }
  }

  /**
   * Get all available models
   */
  static getAllModels() {
    return Object.entries(MODEL_INFO).map(([key, value]) => ({
      name: key as AIModel,
      ...value,
    }));
  }

  /**
   * Get models for a specific provider
   */
  static getModelsForProvider(provider: AIProvider) {
    return Object.entries(MODEL_INFO)
      .filter(([_, value]) => value.provider === provider)
      .map(([key, value]) => ({
        name: key as AIModel,
        ...value,
      }));
  }
}
