import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiChats, aiMessages, aiModelConfigs } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AIProviderFactory } from '@/lib/ai/provider-factory';
import { decrypt } from '@/lib/encryption';

/**
 * Get appropriate max_tokens for the model
 * Different models have different output token limits
 */
function getMaxTokensForModel(modelName: string): number {
  const model = modelName.toLowerCase();
  
  // GPT-4 models
  if (model.includes('gpt-4-turbo') || model.includes('gpt-4o')) {
    return 4096; // GPT-4-turbo and GPT-4o have 4096 token output limit
  }
  if (model.includes('gpt-4-32k')) {
    return 8192; // GPT-4-32k has higher limit
  }
  if (model.includes('gpt-4')) {
    return 8192; // Standard GPT-4 has 8192 token output limit
  }
  
  // GPT-3.5 models
  if (model.includes('gpt-3.5')) {
    return 4096; // GPT-3.5-turbo has 4096 token output limit
  }
  
  // Claude models (Anthropic)
  if (model.includes('claude')) {
    return 4096; // Safe default for Claude models
  }
  
  // Gemini models (Google)
  if (model.includes('gemini')) {
    return 8192; // Gemini has higher output limits
  }
  
  // Default safe limit
  return 4096;
}

/**
 * POST /api/ai/chat
 * Stream AI chat completions with Server-Sent Events
 * 
 * Request Body:
 * {
 *   chatId: string;
 *   message: string;
 *   model?: string; // Optional - uses chat's default or user's default
 *   projectId: string;
 * }
 * 
 * Response: Server-Sent Events stream
 * - data: {"type":"token","content":"Hello"}
 * - data: {"type":"done","messageId":"uuid","tokensUsed":150}
 * - data: {"type":"error","error":"Rate limit exceeded"}
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, message, model, projectId } = body;

    // Validate required fields
    if (!chatId || !message || !projectId) {
      return NextResponse.json(
        { error: 'chatId, message, and projectId are required' },
        { status: 400 }
      );
    }

    // Get chat and verify ownership
    const [chat] = await db
      .select()
      .from(aiChats)
      .where(and(eq(aiChats.id, chatId), eq(aiChats.created_by, session.user.id)))
      .limit(1);

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Determine which model to use
    const modelToUse = model || chat.model_name || 'auto';

    // Get user's API keys
    const userConfigs = await db
      .select()
      .from(aiModelConfigs)
      .where(eq(aiModelConfigs.user_id, session.user.id));

    // Decrypt API keys
    const decryptedConfigs = userConfigs.map((config) => ({
      provider: config.provider,
      apiKey: config.api_key_encrypted ? decrypt(config.api_key_encrypted) : undefined,
      model: config.model_name,
      isDefault: config.is_default,
    }));

    // Select provider based on model
    let provider: string;
    let apiKey: string | undefined;

    if (modelToUse === 'auto') {
      // Auto mode: prefer providers with user-configured keys
      const googleConfig = decryptedConfigs.find(c => c.provider === 'google' && c.apiKey);
      const openaiConfig = decryptedConfigs.find(c => c.provider === 'openai' && c.apiKey);
      const anthropicConfig = decryptedConfigs.find(c => c.provider === 'anthropic' && c.apiKey);

      if (googleConfig) {
        provider = 'google';
        apiKey = googleConfig.apiKey;
      } else if (openaiConfig) {
        provider = 'openai';
        apiKey = openaiConfig.apiKey;
      } else if (anthropicConfig) {
        provider = 'anthropic';
        apiKey = anthropicConfig.apiKey;
      } else {
        // Fall back to system keys
        provider = 'openai';
        apiKey = process.env.OPENAI_API_KEY;
      }
    } else {
      // Find provider for specific model
      provider = AIProviderFactory.getProviderForModel(modelToUse);
      const config = decryptedConfigs.find((c) => c.provider === provider);
      apiKey = config?.apiKey;

      // Fall back to system keys if no user key
      if (!apiKey) {
        if (provider === 'openai' && process.env.OPENAI_API_KEY) {
          apiKey = process.env.OPENAI_API_KEY;
        } else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
          apiKey = process.env.ANTHROPIC_API_KEY;
        } else if (provider === 'google' && process.env.GOOGLE_AI_API_KEY) {
          apiKey = process.env.GOOGLE_AI_API_KEY;
        }
      }
    }

    // Validate we have an API key (or it's a free provider)
    if (!apiKey && provider !== 'google') {
      return NextResponse.json(
        { error: `No API key configured for ${provider}. Please add one in settings.` },
        { status: 400 }
      );
    }

    // Create AI service
    const aiService = AIProviderFactory.createService(provider as any, apiKey!);

    // Get chat history for context
    const chatHistory = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.chat_id, chatId))
      .orderBy(desc(aiMessages.created_at))
      .limit(50);

    // Reverse to get chronological order
    chatHistory.reverse();

    // Build messages array
    const messages = [
      ...chatHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Save user message to database
    const [userMessage] = await db
      .insert(aiMessages)
      .values({
        chat_id: chatId,
        role: 'user',
        content: message,
        tokens_used: Math.ceil(message.length / 4), // Rough estimate
      })
      .returning();

    // Set up streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          let tokenCount = 0;

          // Determine actual model name for max_tokens calculation
          let actualModelName = modelToUse;
          if (modelToUse === 'auto') {
            const defaultConfig = decryptedConfigs.find((c) => c.isDefault);
            actualModelName = defaultConfig?.model || 'gpt-3.5-turbo';
          }

          // Get appropriate max_tokens for this model
          const maxTokens = getMaxTokensForModel(actualModelName);
          console.log(`Streaming chat with model: ${actualModelName}, max_tokens: ${maxTokens}`);

          // Stream from AI service
          for await (const chunk of aiService.streamChatCompletion(messages as any, {
            model: modelToUse === 'auto' ? undefined : modelToUse,
            temperature: 0.7,
            max_tokens: maxTokens, // Dynamically set based on model
          })) {
            if (chunk.error) {
              // Send error to client
              const data = JSON.stringify({
                type: 'error',
                error: chunk.error,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              controller.close();
              return;
            }
            
            if (chunk.content) {
              fullResponse += chunk.content;
              tokenCount++;

              // Send token to client
              const data = JSON.stringify({
                type: 'token',
                content: chunk.content,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            
            if (chunk.done) {
              // Streaming complete, fall through to save message
              break;
            }
          }

          // Save assistant message to database
          const [assistantMessage] = await db
            .insert(aiMessages)
            .values({
              chat_id: chatId,
              role: 'assistant',
              content: fullResponse,
              tokens_used: tokenCount,
            })
            .returning();

          // Update chat's last activity
          await db
            .update(aiChats)
            .set({ updated_at: new Date() })
            .where(eq(aiChats.id, chatId));

          // Send completion message
          const doneData = JSON.stringify({
            type: 'done',
            messageId: assistantMessage.id,
            tokensUsed: tokenCount,
            content: fullResponse,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
