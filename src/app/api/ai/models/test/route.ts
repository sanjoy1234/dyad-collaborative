/**
 * AI Model Test API - POST
 * Tests if an API key is valid by making a minimal API call
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { AIProviderFactory } from '@/lib/ai/provider-factory';
import { AIProvider } from '@/types';

// POST /api/ai/models/test - Test an API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, api_key } = body;

    // Validate required fields
    if (!provider || !api_key) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders: AIProvider[] = ['openai', 'anthropic', 'google', 'openrouter'];
    if (!validProviders.includes(provider as AIProvider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate API key format first
    if (!AIProviderFactory.validateAPIKeyFormat(provider as AIProvider, api_key)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key format for this provider',
        },
        { status: 400 }
      );
    }

    // Create service and test connection
    try {
      const service = AIProviderFactory.createService(provider as AIProvider, api_key);
      const result = await service.testConnection();

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'API key is valid',
          provider,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Connection test failed',
          },
          { status: 400 }
        );
      }
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to test API key',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error testing AI model:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
