/**
 * OpenAI Service
 * Handles all interactions with OpenAI API including chat completion and streaming
 */

import { OpenAI} from 'openai';
import { AIMessage, AIModel } from '@/types';

export interface StreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

export interface ChatCompletionOptions {
  model?: AIModel | string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export class OpenAIService {
  private client: OpenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  /**
   * Send a chat completion request (non-streaming)
   */
  async chatCompletion(
    messages: AIMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<{ content: string; tokens_used: number; model: string }> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || 'gpt-4',
        messages: messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4000,
        top_p: options.top_p ?? 1,
        frequency_penalty: options.frequency_penalty ?? 0,
        presence_penalty: options.presence_penalty ?? 0,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from OpenAI');
      }

      return {
        content: choice.message.content || '',
        tokens_used: response.usage?.total_tokens || 0,
        model: response.model,
      };
    } catch (error: any) {
      console.error('OpenAI chat completion error:', error);
      
      // Handle specific error types
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      }
      if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key. Please check your configuration.');
      }
      if (error.code === 'rate_limit_exceeded') {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      }
      
      throw new Error(`OpenAI error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Send a streaming chat completion request
   */
  async *streamChatCompletion(
    messages: AIMessage[],
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<StreamChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model || 'gpt-4',
        messages: messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 4000,
        top_p: options.top_p ?? 1,
        frequency_penalty: options.frequency_penalty ?? 0,
        presence_penalty: options.presence_penalty ?? 0,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (content) {
          yield {
            content,
            done: false,
          };
        }

        if (finishReason) {
          yield {
            content: '',
            done: true,
          };
        }
      }
    } catch (error: any) {
      console.error('OpenAI streaming error:', error);
      yield {
        content: '',
        done: true,
        error: error.message || 'Streaming failed',
      };
    }
  }

  /**
   * Test if the API key is valid
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.models.list();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection test failed',
      };
    }
  }

  /**
   * Get available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => model.id);
    } catch (error) {
      console.error('Error listing OpenAI models:', error);
      return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  }

  /**
   * Estimate token count for messages
   * This is a rough estimate - actual token count may vary
   */
  estimateTokens(messages: AIMessage[]): number {
    const text = messages.map((m) => m.content).join(' ');
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Get system-wide OpenAI client (using env variable)
 */
export function getSystemOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Create OpenAI service instance
 */
export function createOpenAIService(apiKey: string): OpenAIService {
  return new OpenAIService(apiKey);
}
