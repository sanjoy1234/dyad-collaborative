/**
 * Google Gemini Service
 * Handles all interactions with Google Generative AI API
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AIMessage, AIModel } from '@/types';
import { StreamChunk, ChatCompletionOptions } from './openai-service';

export class GoogleGeminiService {
  private client: GoogleGenerativeAI;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Google AI API key is required');
    }
    this.apiKey = apiKey;
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Convert our AIMessage format to Gemini's format
   */
  private formatMessages(messages: AIMessage[]) {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Get model instance
   */
  private getModel(modelName?: string): GenerativeModel {
    return this.client.getGenerativeModel({
      model: modelName || 'gemini-2.5-flash',
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
      const model = this.getModel(options.model as string);
      const formattedMessages = this.formatMessages(messages);

      // Separate system message and conversation history
      const systemMessage = messages.find((msg) => msg.role === 'system');
      const conversationHistory = messages.filter((msg) => msg.role !== 'system');

      // Start chat with history
      const chat = model.startChat({
        history: this.formatMessages(conversationHistory.slice(0, -1)),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.max_tokens ?? 4000,
          topP: options.top_p ?? 1,
        },
      });

      // Get the last user message
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      const prompt = systemMessage
        ? `${systemMessage.content}\n\n${lastMessage.content}`
        : lastMessage.content;

      const result = await chat.sendMessage(prompt);
      const response = result.response;
      
      return {
        content: response.text(),
        tokens_used: response.usageMetadata?.totalTokenCount || 0,
        model: options.model as string || 'gemini-2.5-flash',
      };
    } catch (error: any) {
      console.error('Google Gemini chat completion error:', error);
      
      // Handle specific error types
      if (error.message?.includes('API key not valid')) {
        throw new Error('Invalid Google AI API key. Please check your configuration.');
      }
      if (error.message?.includes('quota')) {
        throw new Error('Google AI quota exceeded. Please try again later.');
      }
      
      throw new Error(`Google Gemini error: ${error.message || 'Unknown error'}`);
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
      const model = this.getModel(options.model as string);
      
      // Separate system message and conversation history
      const systemMessage = messages.find((msg) => msg.role === 'system');
      const conversationHistory = messages.filter((msg) => msg.role !== 'system');

      // Start chat with history
      const chat = model.startChat({
        history: this.formatMessages(conversationHistory.slice(0, -1)),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.max_tokens ?? 4000,
          topP: options.top_p ?? 1,
        },
      });

      // Get the last user message
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      const prompt = systemMessage
        ? `${systemMessage.content}\n\n${lastMessage.content}`
        : lastMessage.content;

      const result = await chat.sendMessageStream(prompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            content: text,
            done: false,
          };
        }
      }

      yield {
        content: '',
        done: true,
      };
    } catch (error: any) {
      console.error('Google Gemini streaming error:', error);
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
      const model = this.getModel('gemini-2.5-flash');
      const result = await model.generateContent('Hi');
      const response = result.response;
      response.text(); // This will throw if there's an error
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
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
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
 * Get system-wide Google Gemini client (using env variable)
 */
export function getSystemGoogleClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Create Google Gemini service instance
 */
export function createGoogleGeminiService(apiKey: string): GoogleGeminiService {
  return new GoogleGeminiService(apiKey);
}
