/**
 * AI Models Available API - GET
 * Returns list of all available AI models with their metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { AIProviderFactory, MODEL_INFO } from '@/lib/ai/provider-factory';
import { AIProvider } from '@/types';

// GET /api/ai/models/available - Get all available models
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as AIProvider | null;

    // If provider specified, return models for that provider only
    if (provider) {
      const models = AIProviderFactory.getModelsForProvider(provider);
      return NextResponse.json(models);
    }

    // Return all models grouped by provider
    const allModels = AIProviderFactory.getAllModels();
    
    const groupedModels = {
      openai: allModels.filter((m) => m.provider === 'openai'),
      anthropic: allModels.filter((m) => m.provider === 'anthropic'),
      google: allModels.filter((m) => m.provider === 'google'),
      openrouter: [],
      local: [],
    };

    return NextResponse.json({
      models: allModels,
      grouped: groupedModels,
      total: allModels.length,
    });
  } catch (error: any) {
    console.error('Error fetching available models:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
