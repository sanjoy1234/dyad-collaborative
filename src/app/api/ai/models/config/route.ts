/**
 * AI Model Configuration API - GET/POST
 * Allows users to manage their API keys and model preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { aiModelConfigs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt, maskSensitiveData } from '@/lib/encryption';
import { AIProviderFactory } from '@/lib/ai/provider-factory';
import { AIProvider } from '@/types';

// GET /api/ai/models/config - Get user's AI model configurations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's model configs
    const configs = await db
      .select()
      .from(aiModelConfigs)
      .where(eq(aiModelConfigs.user_id, session.user.id));

    // Mask API keys before sending to client
    const maskedConfigs = configs.map((config) => ({
      ...config,
      api_key_encrypted: config.api_key_encrypted
        ? maskSensitiveData(decrypt(config.api_key_encrypted))
        : null,
      api_key_masked: config.api_key_encrypted
        ? maskSensitiveData(decrypt(config.api_key_encrypted))
        : null,
    }));

    return NextResponse.json(maskedConfigs);
  } catch (error) {
    console.error('Error fetching AI model configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

// POST /api/ai/models/config - Create or update AI model configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, api_key, model_name, is_default, settings } = body;

    // Validate required fields
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders: AIProvider[] = ['auto', 'openai', 'anthropic', 'google', 'openrouter', 'local'];
    if (!validProviders.includes(provider as AIProvider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Auto provider doesn't need API key
    if (provider === 'auto') {
      const modelName = model_name || 'auto';
      const [autoConfig] = await db
        .insert(aiModelConfigs)
        .values({
          user_id: session.user.id,
          provider,
          model_name: modelName,
          is_default: is_default ?? true,
          settings: settings || {},
        })
        .onConflictDoUpdate({
          target: [aiModelConfigs.user_id, aiModelConfigs.provider, aiModelConfigs.model_name],
          set: {
            is_default: is_default ?? true,
            settings: settings || {},
            updated_at: new Date(),
          },
        })
        .returning();

      return NextResponse.json(autoConfig, { status: 201 });
    }

    // For other providers, API key is required
    if (!api_key) {
      return NextResponse.json(
        { error: 'API key is required for this provider' },
        { status: 400 }
      );
    }

    // Validate API key format
    if (!AIProviderFactory.validateAPIKeyFormat(provider as AIProvider, api_key)) {
      return NextResponse.json(
        { error: 'Invalid API key format for this provider' },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const encryptedKey = encrypt(api_key);

    // If this is set as default, unset other defaults for this user
    if (is_default) {
      await db
        .update(aiModelConfigs)
        .set({ is_default: false })
        .where(eq(aiModelConfigs.user_id, session.user.id));
    }

    // Insert or update the configuration
    const [config] = await db
      .insert(aiModelConfigs)
      .values({
        user_id: session.user.id,
        provider,
        api_key_encrypted: encryptedKey,
        model_name,
        is_default: is_default ?? false,
        settings: settings || {},
      })
      .onConflictDoUpdate({
        target: [aiModelConfigs.user_id, aiModelConfigs.provider, aiModelConfigs.model_name],
        set: {
          api_key_encrypted: encryptedKey,
          is_default: is_default ?? false,
          settings: settings || {},
          updated_at: new Date(),
        },
      })
      .returning();

    // Return config with masked API key
    return NextResponse.json(
      {
        ...config,
        api_key_encrypted: undefined,
        api_key_masked: maskSensitiveData(api_key),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error saving AI model config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/models/config?provider=openai
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider parameter is required' },
        { status: 400 }
      );
    }

    // Delete the configuration
    await db
      .delete(aiModelConfigs)
      .where(
        and(
          eq(aiModelConfigs.user_id, session.user.id),
          eq(aiModelConfigs.provider, provider as AIProvider)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting AI model config:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}
