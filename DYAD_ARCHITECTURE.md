# Dyad-Style Web Collaborative Platform - Architecture Document

## Overview
Transform current collaborative code editor into a full Dyad-style AI-powered application builder with multi-developer collaboration.

## Core Dyad Features to Implement

### 1. AI Model Management
- **Auto Model Selection**: Intelligent model routing based on task and availability
- **Supported Providers**:
  - Google Gemini (Free tier: 250 msgs/day)
  - OpenAI (GPT-4, GPT-4.1 mini with free tier)
  - Anthropic Claude (Premium, no free tier)
  - OpenRouter (Aggregator with free models like DeepSeek v3)
  - Local Models (Ollama integration)
- **User Features**:
  - Per-user API key management
  - Per-project default model selection
  - Bring-your-own-key support
  - Model switching mid-conversation

### 2. AI Chat Interface
- **Multi-Chat Support**: Multiple conversation threads per project
- **Chat Features**:
  - Streaming AI responses
  - Code diff preview before approval
  - Approve/Reject generated changes
  - Chat history with timestamps
  - Context-aware prompting
- **UI Layout** (Dyad-style):
  - Left Panel: File tree + Chat switcher
  - Center Panel: Live preview pane
  - Right Panel: AI chat interface

### 3. Code Generation System
- **Prompt Engineering**:
  - System prompts for code generation
  - File context injection
  - Project structure awareness
- **Code Modification**:
  - File creation/modification/deletion
  - Multi-file changes in single generation
  - Syntax-aware edits
- **Change Management**:
  - Show diffs before applying
  - Rollback capability
  - Version snapshots

### 4. Live Preview System
- **Preview Features**:
  - Iframe-based preview pane
  - Auto-reload on file changes
  - Support for React/Next.js/Vite apps
  - Dev server integration
  - Error display in preview
  - Console log capture

### 5. Versioning System
- **Version Control**:
  - Snapshot before each AI change
  - Per-chat version history
  - Timeline view of changes
  - Rollback to any version
  - Compare versions (diff view)

### 6. Multi-Developer Collaboration
- **Collaborative Features**:
  - Multiple users in same project
  - Shared AI chat history
  - Real-time file sync (WebSocket)
  - Presence indicators
  - Collaborative approval (voting on AI changes)

## Database Schema Extensions

### New Tables

```sql
-- AI Model Configurations
CREATE TABLE ai_model_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'google', 'openrouter', 'local'
    api_key_encrypted TEXT,
    model_name VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Chats (multiple conversations per project)
CREATE TABLE ai_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    model_provider VARCHAR(50),
    model_name VARCHAR(100),
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Messages in chats
CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES ai_chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    tokens_used INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Code Generations (track what AI generated)
CREATE TABLE ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES ai_chats(id) ON DELETE CASCADE,
    message_id UUID REFERENCES ai_messages(id),
    files_created JSONB DEFAULT '[]',
    files_modified JSONB DEFAULT '[]',
    files_deleted JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by UUID REFERENCES users(id),
    snapshot_version UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Version Snapshots (before each AI change)
CREATE TABLE project_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES ai_chats(id),
    generation_id UUID REFERENCES ai_generations(id),
    snapshot_data JSONB NOT NULL, -- Full file tree snapshot
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Preview Server Configurations
CREATE TABLE preview_servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    port INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'stopped', -- 'running', 'stopped', 'error'
    process_id INTEGER,
    logs TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE
);
```

## API Routes to Create

### AI Model Management
- `POST /api/ai/models/config` - Save user API keys
- `GET /api/ai/models/config` - Get user's model configs
- `GET /api/ai/models/available` - List available models
- `POST /api/ai/models/test` - Test API key validity

### AI Chat
- `POST /api/ai/chat` - Send message (streaming response)
- `GET /api/projects/[id]/chats` - List project chats
- `POST /api/projects/[id]/chats` - Create new chat
- `DELETE /api/projects/[id]/chats/[chatId]` - Delete chat
- `GET /api/projects/[id]/chats/[chatId]/messages` - Get chat history

### AI Code Generation
- `POST /api/ai/generate` - Generate code from prompt
- `POST /api/ai/generations/[id]/approve` - Approve changes
- `POST /api/ai/generations/[id]/reject` - Reject changes
- `GET /api/ai/generations/[id]/diff` - Get code diffs

### Preview System
- `POST /api/preview/[projectId]/start` - Start dev server
- `POST /api/preview/[projectId]/stop` - Stop dev server
- `GET /api/preview/[projectId]/status` - Get server status
- `GET /api/preview/[projectId]/logs` - Get console logs

### Versioning
- `GET /api/projects/[id]/versions` - List all snapshots
- `POST /api/projects/[id]/versions/snapshot` - Create snapshot
- `POST /api/projects/[id]/versions/[versionId]/restore` - Restore version
- `GET /api/projects/[id]/versions/[versionId]/diff` - Compare versions

## UI Components to Create

### 1. Model Configuration UI
- `src/components/ai/ModelConfigModal.tsx` - API key setup
- `src/components/ai/ModelSelector.tsx` - Model dropdown
- `src/components/ai/ModelStatus.tsx` - Show current model, credits

### 2. AI Chat UI
- `src/components/ai/ChatPanel.tsx` - Main chat interface
- `src/components/ai/ChatMessage.tsx` - Individual message
- `src/components/ai/ChatInput.tsx` - Prompt input with autocomplete
- `src/components/ai/CodeDiff.tsx` - Show code changes
- `src/components/ai/ApprovalButtons.tsx` - Approve/Reject UI

### 3. Preview UI
- `src/components/preview/PreviewPane.tsx` - Iframe preview
- `src/components/preview/PreviewControls.tsx` - Refresh, open, console
- `src/components/preview/ConsoleViewer.tsx` - Show logs/errors

### 4. Version UI
- `src/components/versioning/VersionTimeline.tsx` - Visual history
- `src/components/versioning/VersionDiff.tsx` - Compare versions
- `src/components/versioning/ChatSwitcher.tsx` - Switch between chats

### 5. Redesigned Editor
- `src/app/editor/[projectId]/dyad-editor.tsx` - New 3-panel layout

## Implementation Phases

### Phase 1: Database & API Foundation (Priority: HIGH)
1. Create database migrations for new tables
2. Implement AI model configuration API
3. Test API key storage and encryption

### Phase 2: AI Integration (Priority: HIGH)
1. Integrate OpenAI SDK
2. Integrate Anthropic SDK
3. Integrate Google Gemini SDK
4. Implement streaming responses
5. Create prompt engineering system

### Phase 3: Chat Interface (Priority: HIGH)
1. Build chat UI components
2. Implement message streaming
3. Add code diff preview
4. Create approval workflow

### Phase 4: Code Generation (Priority: HIGH)
1. Implement file creation/modification logic
2. Build diff generation system
3. Create snapshot system
4. Test generation accuracy

### Phase 5: Live Preview (Priority: MEDIUM)
1. Implement dev server management
2. Create preview pane UI
3. Add hot reload capability
4. Capture console logs

### Phase 6: Versioning (Priority: MEDIUM)
1. Implement snapshot creation
2. Build timeline UI
3. Add rollback functionality
4. Create diff viewer

### Phase 7: Testing & Polish (Priority: HIGH)
1. Comprehensive positive/negative testing
2. Error handling for all AI failures
3. Rate limiting protection
4. Security audit
5. Performance optimization

## Testing Strategy

### Unit Tests
- AI provider integrations
- Code generation logic
- Diff calculation
- Snapshot creation/restoration

### Integration Tests
- Full chat flow (prompt → generation → approval → file update)
- Multi-user collaboration on AI chats
- Version rollback scenarios
- Preview server lifecycle

### End-to-End Tests
- Create project → Chat with AI → Generate code → Approve → Preview
- Model switching mid-conversation
- Multi-chat management
- Collaborative approval (multiple users)

### Negative Scenarios
- Invalid API keys
- Rate limiting exceeded
- Malformed prompts
- Generation failures
- Network timeouts
- Concurrent edit conflicts
- Preview server crashes

## Security Considerations

1. **API Key Encryption**: Store user API keys encrypted (AES-256)
2. **Input Sanitization**: Validate all prompts and generated code
3. **Rate Limiting**: Prevent abuse of AI APIs
4. **Access Control**: Users can only access their API keys
5. **Code Execution**: Sandbox preview servers
6. **Audit Logging**: Track all AI generations

## Performance Optimizations

1. **Streaming**: Use SSE for AI responses (no waiting for full response)
2. **Caching**: Cache common AI responses
3. **Lazy Loading**: Load chat history on demand
4. **Debouncing**: Debounce file changes before preview refresh
5. **Worker Threads**: Run preview servers in isolated processes

## User Experience Goals

1. **Seamless**: AI chat feels natural, no lag
2. **Transparent**: Always show what AI is doing
3. **Safe**: Clear approval flow, easy rollback
4. **Collaborative**: Multiple users can use AI together
5. **Flexible**: Switch models, bring own keys
6. **Fast**: Preview updates instantly

## Success Metrics

1. ✅ User can add API key and select model
2. ✅ User can chat with AI and get code generations
3. ✅ User can preview generated code instantly
4. ✅ User can approve/reject AI changes
5. ✅ User can rollback to previous versions
6. ✅ Multiple users can collaborate on same project
7. ✅ All positive/negative scenarios tested
8. ✅ 100% feature parity with Dyad desktop app

## Timeline Estimate

- Phase 1-2: 2 days (Database + AI Integration)
- Phase 3-4: 3 days (Chat UI + Code Generation)
- Phase 5-6: 2 days (Preview + Versioning)
- Phase 7: 2 days (Testing & Polish)
- **Total**: ~9 days for full implementation

## Next Steps

1. Get approval for architecture
2. Start Phase 1: Database migrations
3. Implement AI provider integrations
4. Build chat interface
5. Test thoroughly before user testing
