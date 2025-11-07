import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiGenerations, aiModelConfigs, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { 
  buildCodeGenerationPrompt, 
  parseAIResponse, 
  validateOperations,
  ProjectContext,
  detectFramework,
  FileOperation
} from '@/lib/ai/prompt-engineer';
import { generateUnifiedDiff } from '@/lib/ai/diff-generator';
import { createSnapshot } from '@/lib/ai/snapshot-manager';
import { listProjectFiles, readFile } from '@/lib/ai/file-operations';
import { AIProviderFactory } from '@/lib/ai/provider-factory';
import { decrypt } from '@/lib/encryption';
import { autoInjectBuildConfig, ensureMainEntryPoint } from '@/lib/ai/build-config-injector';

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
 * POST /api/ai/generate
 * Generate code from user prompt
 * 
 * Request Body:
 * {
 *   projectId: string;
 *   prompt: string;
 *   model?: string; // Optional - defaults to "auto"
 *   selectedFiles?: string[]; // Files user wants to modify
 * }
 * 
 * Response:
 * {
 *   generationId: string;
 *   operations: FileOperation[];
 *   diffs: UnifiedDiff;
 *   snapshotId: string;
 *   explanation: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, prompt, model = 'auto', selectedFiles = [] } = body;

    // Validate required fields
    if (!projectId || !prompt) {
      return NextResponse.json(
        { error: 'projectId and prompt are required' },
        { status: 400 }
      );
    }

    // Verify user has access to project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

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

    // Select provider
    let provider: string;
    let apiKey: string | undefined;

    if (model === 'auto') {
      const selected = AIProviderFactory.selectBestProvider(decryptedConfigs as any);
      if (!selected) {
        return NextResponse.json(
          { error: 'No AI provider configured. Please add an API key in settings.' },
          { status: 400 }
        );
      }
      provider = selected.provider;
      apiKey = selected.apiKey;
    } else {
      provider = AIProviderFactory.getProviderForModel(model);
      const config = decryptedConfigs.find((c) => c.provider === provider);
      apiKey = config?.apiKey;

      // Fall back to system keys
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

    if (!apiKey && provider !== 'google') {
      return NextResponse.json(
        { error: `No API key configured for ${provider}` },
        { status: 400 }
      );
    }

    // Create AI service
    const aiService = AIProviderFactory.createService(provider as any, apiKey || '');

    // Build project context
    const existingFiles = await listProjectFiles(projectId);
    
    // Get selected file contents
    const selectedFileContents = new Map<string, string>();
    for (const filePath of selectedFiles) {
      if (existingFiles.has(filePath)) {
        selectedFileContents.set(filePath, existingFiles.get(filePath)!);
      }
    }

    // Create a chat for this generation (required by schema)
    const [chat] = await db
      .insert(await import('@/lib/db/schema').then(m => m.aiChats))
      .values({
        project_id: projectId,
        created_by: session.user.id,
        name: `Code Gen: ${prompt.slice(0, 50)}`,
        model_name: model,
      })
      .returning();

    // Detect framework from package.json
    let framework: ProjectContext['framework'] = 'unknown';
    let dependencies: Record<string, string> = {};
    let typescript = false;

    try {
      const packageJsonContent = existingFiles.get('package.json');
      if (packageJsonContent) {
        const packageJson = JSON.parse(packageJsonContent);
        dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        framework = detectFramework(dependencies);
        typescript = existingFiles.has('tsconfig.json') || 
                     Object.keys(dependencies).some(dep => dep.includes('typescript'));
      }
    } catch (error) {
      console.error('Error parsing package.json:', error);
    }

    const context: ProjectContext = {
      framework,
      fileTree: [], // TODO: Build file tree from existingFiles
      existingFiles,
      dependencies,
      selectedFiles,
      typescript,
    };

    // Build prompt
    const { systemPrompt, userPrompt } = buildCodeGenerationPrompt(prompt, context);

    // Determine the actual model name being used
    let actualModelName = model;
    if (model === 'auto') {
      // Get default model from user configs or use fallback
      const defaultConfig = decryptedConfigs.find((c) => c.isDefault);
      actualModelName = defaultConfig?.model || 'gpt-3.5-turbo';
    }

    // Get appropriate max_tokens for this model
    const maxTokens = getMaxTokensForModel(actualModelName);
    console.log(`Generating code with model: ${actualModelName}, max_tokens: ${maxTokens}`);

    // Call AI to generate code
    const aiResponse = await aiService.chatCompletion(
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ] as any,
      {
        model: model === 'auto' ? undefined : model,
        temperature: 0.3, // Lower temperature for more consistent code
        max_tokens: maxTokens, // Dynamically set based on model
      }
    );

    // Parse AI response
    const parsed = parseAIResponse(aiResponse.content);

    if (parsed.error || parsed.operations.length === 0) {
      return NextResponse.json(
        { error: parsed.error || 'No operations generated' },
        { status: 400 }
      );
    }

    // AUTO-FIX: Inject build configuration if React project is missing package.json/vite.config
    let operations = autoInjectBuildConfig(parsed.operations, context.typescript);
    operations = ensureMainEntryPoint(operations, context.typescript);
    
    console.log(`[Auto-Fix] Final operations count: ${operations.length} (original: ${parsed.operations.length})`);

    // Validate operations
    const validation = validateOperations(operations, context);
    if (!validation.valid) {
      console.error('Operation validation failed:', validation.errors);
      console.error('Operations received:', JSON.stringify(parsed.operations, null, 2));
      console.error('Context:', { 
        framework: context.framework, 
        typescript: context.typescript,
        fileCount: context.existingFiles.size 
      });
      return NextResponse.json(
        { error: 'Invalid operations', details: validation.errors },
        { status: 400 }
      );
    }

    // Create snapshot before changes
    const snapshotId = await createSnapshot(
      projectId,
      session.user.id,
      `Before AI generation: ${prompt.slice(0, 100)}`
    );

    // Prepare operations with old content for diff
    const operationsWithOldContent: FileOperation[] = operations.map(op => ({
      ...op,
      oldContent: existingFiles.get(op.path) || '',
    }));

    // Generate diffs
    const diffs = generateUnifiedDiff(
      operationsWithOldContent.map(op => ({
        path: op.path,
        oldContent: op.oldContent,
        newContent: op.content,
        type: op.type,
      }))
    );

    // Save generation to database
    const [generation] = await db
      .insert(aiGenerations)
      .values({
        chat_id: chat.id,
        status: 'pending',
        files_created: operationsWithOldContent
          .filter(op => op.type === 'create')
          .map(op => op.path),
        files_modified: operationsWithOldContent
          .filter(op => op.type === 'modify')
          .map(op => op.path),
        files_deleted: operationsWithOldContent
          .filter(op => op.type === 'delete')
          .map(op => op.path),
        snapshot_before: snapshotId,
        metadata: {
          prompt,
          model,
          provider,
          diffs,
          operations: operationsWithOldContent,
        },
      })
      .returning();

    return NextResponse.json({
      generationId: generation.id,
      operations: operationsWithOldContent,
      diffs,
      snapshotId,
      explanation: parsed.explanation,
    });
  } catch (error) {
    console.error('Code generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
