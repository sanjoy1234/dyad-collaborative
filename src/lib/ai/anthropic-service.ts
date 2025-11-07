/**
 * Anthropic Claude Service
 * Handles all interactions with Anthropic API including chat completion and streaming
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIMessage, AIModel } from '@/types';
import { StreamChunk, ChatCompletionOptions } from './openai-service';

export class AnthropicService {
  private client: Anthropic;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.apiKey = apiKey;
    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  /**
   * Convert our AIMessage format to Anthropic's format
   */
  private formatMessages(messages: AIMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Anthropic doesn't support system messages in the messages array
    // System message should be passed as a separate parameter
    return messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })) as Array<{ role: 'user' | 'assistant'; content: string }>;
  }

  /**
   * Extract system message from messages
   */
  private getSystemMessage(messages: AIMessage[]): string | undefined {
    const systemMsg = messages.find((msg) => msg.role === 'system');
    return systemMsg?.content;
  }

  /**
   * Send a chat completion request (non-streaming)
   */
  async chatCompletion(
    messages: AIMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<{ content: string; tokens_used: number; model: string }> {
    try {
      const systemMessage = this.getSystemMessage(messages);
      const formattedMessages = this.formatMessages(messages);

      const response = await this.client.messages.create({
        model: (options.model as string) || 'claude-3-5-sonnet-20241022',
        max_tokens: options.max_tokens || 4000,
        temperature: options.temperature ?? 0.7,
        system: systemMessage,
        messages: formattedMessages,
      });

      const textContent = response.content.find((block: any) => block.type === 'text');
      
      return {
        content: textContent?.text || '',
        tokens_used: response.usage.input_tokens + response.usage.output_tokens,
        model: response.model,
      };
    } catch (error: any) {
      console.error('Anthropic chat completion error:', error);
      
      // Handle specific error types
      if (error.status === 401) {
        throw new Error('Invalid Anthropic API key. Please check your configuration.');
      }
      if (error.status === 429) {
        throw new Error('Anthropic rate limit exceeded. Please try again later.');
      }
      if (error.status === 529) {
        throw new Error('Anthropic service is overloaded. Please try again later.');
      }
      
      throw new Error(`Anthropic error: ${error.message || 'Unknown error'}`);
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
      const systemMessage = this.getSystemMessage(messages);
      const formattedMessages = this.formatMessages(messages);

      const stream = await this.client.messages.create({
        model: (options.model as string) || 'claude-3-5-sonnet-20241022',
        max_tokens: options.max_tokens || 4000,
        temperature: options.temperature ?? 0.7,
        system: systemMessage,
        messages: formattedMessages,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta) {
            yield {
              content: delta.text,
              done: false,
            };
          }
        } else if (event.type === 'message_stop') {
          yield {
            content: '',
            done: true,
          };
        }
      }
    } catch (error: any) {
      console.error('Anthropic streaming error:', error);
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
      // Make a minimal API call to test the key
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
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
  listModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
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
 * Get system-wide Anthropic client (using env variable)
 */
export function getSystemAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Anthropic({ apiKey });
}

/**
 * Create Anthropic service instance
 */
export function createAnthropicService(apiKey: string): AnthropicService {
  return new AnthropicService(apiKey);
}
