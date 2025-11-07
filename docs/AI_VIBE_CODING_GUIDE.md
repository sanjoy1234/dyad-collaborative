# Dyad Collaborative - AI Vibe Coding User Guide

## 🎯 Complete Workflow: From Dashboard to AI-Generated React App

**Last Updated:** November 5, 2025  
**Status:** ✅ All components implemented and tested

---

## Table of Contents
1. [Accessing the AI Editor](#1-accessing-the-ai-editor)
2. [Understanding the 3-Panel Layout](#2-understanding-the-3-panel-layout)
3. [Configuring Your AI Model](#3-configuring-your-ai-model)
4. [Generating React Code with Prompts](#4-generating-react-code-with-prompts)
5. [Reviewing and Applying Changes](#5-reviewing-and-applying-changes)
6. [Complete Example: Building a React App](#6-complete-example-building-a-react-app)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Accessing the AI Editor

### Step 1: Login
1. Navigate to http://localhost:3000
2. Login with your credentials (or register if first time)
3. You'll be redirected to the **Dashboard**

### Step 2: Access a Project
1. On the Dashboard, you'll see your project cards
2. **Click on ANY project card** to open the AI editor
3. You'll be redirected to `/editor/{projectId}`

**What you should see:**
- URL changes to `http://localhost:3000/editor/660e8400-e29b-41d4-a716-446655440001` (or similar)
- 3-panel editor interface loads
- Left panel: File explorer
- Center panel: Preview/Code/Diff tabs
- Right panel: **AI Chat Interface** ← THIS IS WHERE YOU TYPE PROMPTS!

---

## 2. Understanding the 3-Panel Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Dashboard] Project Name [Next.js] [Configure Model] [Sign Out]        │
├──────────────┬─────────────────────────────────┬────────────────────────┤
│              │                                 │                        │
│  📁 FILES    │    📋 PREVIEW / CODE / DIFF    │   💬 AI ASSISTANT     │
│  (320px)     │         (Flexible)              │   (384px)             │
│              │                                 │                        │
│  ☐ src/      │  ┌────────────────────────┐   │  Model: gpt-4o        │
│  ☐ app/      │  │                        │   │  [Configure Model]    │
│  ☐ comp/     │  │   Tab Content          │   │                        │
│  ☐ public/   │  │                        │   │  ┌─────────────────┐  │
│              │  │                        │   │  │ Type prompt...  │  │
│  [Toggle]    │  └────────────────────────┘   │  └─────────────────┘  │
│              │                                 │  [Send] ↑             │
│              │                                 │                        │
│              │                                 │  Chat History:        │
│              │                                 │  • Previous messages  │
│              │                                 │  • AI responses       │
│              │                                 │  • Status badges      │
│              │                                 │                        │
│              │                                 │  2 files selected     │
└──────────────┴─────────────────────────────────┴────────────────────────┘
```

### Left Panel - File Explorer
- **Purpose:** Browse and select files for AI context
- **Features:**
  - Hierarchical folder structure
  - Checkboxes to select files for AI context
  - Click file name to view in Code tab
  - Expand/collapse folders
  - Selected file count at bottom
- **Collapsible:** Click `[←]` button to collapse

### Center Panel - Tabs
- **Preview Tab:** Future iframe with live app preview
- **Code Tab:** View selected file's content
- **Diff Tab:** Review AI-generated code changes
  - Shows before/after diff
  - Color-coded: Green (+) for additions, Red (-) for deletions
  - Approve & Apply or Reject buttons

### Right Panel - AI Chat Interface ⭐ **KEY FEATURE**
- **Model Badge:** Shows current AI model (e.g., "gpt-4o")
- **Configure Model Button:** Click to set up API keys
- **Prompt Input:** Large text area to type your requests
- **Send Button:** Submit prompt to AI
- **Chat History:** See all previous prompts and responses
- **Status Badges:**
  - 🟡 Pending: AI is generating
  - 🟢 Applied: Changes were applied
  - 🔴 Rejected: Changes were rejected
- **Files Context:** Shows which files AI will consider
- **Collapsible:** Click `[→]` button to collapse

---

## 3. Configuring Your AI Model

**IMPORTANT:** You must configure an AI model before generating code!

### Step 1: Click "Configure Model"
- Located in the top header or right panel
- Opens the **Model Configuration Modal**

### Step 2: Choose Your AI Provider
**Three tabs available:**
1. **OpenAI** (GPT-4o, GPT-4 Turbo, GPT-3.5)
2. **Anthropic** (Claude 3.5 Sonnet, Opus, Haiku)
3. **Google** (Gemini Pro, Vision)

### Step 3: Enter Your API Key
- **OpenAI:** Get key from https://platform.openai.com/api-keys
- **Anthropic:** Get key from https://console.anthropic.com/
- **Google:** Get key from https://makersuite.google.com/app/apikey

```
┌─────────────────────────────────────────────┐
│  Configure AI Model                    [X]  │
├─────────────────────────────────────────────┤
│  [OpenAI] [Anthropic] [Google]              │
│                                             │
│  OpenAI API Key *                           │
│  ┌─────────────────────────────────────┐   │
│  │ sk-proj-...                   [👁️]  │   │
│  └─────────────────────────────────────┘   │
│  [Get API Key from OpenAI]                  │
│                                             │
│  Model *                                    │
│  ┌─────────────────────────────────────┐   │
│  │ GPT-4o                          [▼] │   │
│  └─────────────────────────────────────┘   │
│  Most capable, good for complex tasks       │
│                                             │
│  [Test Connection]                          │
│                                             │
│         [Cancel]  [Save Configuration]      │
└─────────────────────────────────────────────┘
```

### Step 4: Test Connection
- Click **"Test Connection"** button
- Wait for green checkmark ✅
- If error, verify API key is correct

### Step 5: Save
- Click **"Save Configuration"**
- Configuration is stored securely in database (encrypted)
- Model badge updates in chat interface

---

## 4. Generating React Code with Prompts

### Basic Workflow

1. **Select Files for Context (Optional but Recommended)**
   - In left panel, check boxes next to relevant files
   - AI will read these files to understand your project
   - Example: Check `app/page.tsx` and `components/` folder

2. **Type Your Prompt**
   - Click in the large text area (right panel)
   - Type what you want to build
   - Be specific and clear

3. **Send to AI**
   - Press **Enter** or click **Send** button
   - AI starts generating (you'll see "Generating code..." spinner)
   - Wait 5-15 seconds depending on complexity

4. **Review the Diff**
   - Center panel automatically switches to **Diff tab**
   - See all changes: files created, modified, deleted
   - Each file shows:
     - File path and operation (Created/Modified/Deleted)
     - Unified diff with line numbers
     - Green lines (+) for additions
     - Red lines (-) for deletions
     - White lines for context

5. **Apply or Reject**
   - **"Approve & Apply":** Changes are written to files immediately
   - **"Reject":** Changes are discarded, nothing happens
   - After approval, file tree refreshes automatically

### Example Prompts

#### Beginner - Create a Component
```
Create a Button component in src/components/Button.tsx with:
- Props for variant (primary, secondary, danger)
- Props for size (sm, md, lg)
- Click handler
- TypeScript types
- Tailwind styling
```

#### Intermediate - Add Feature
```
Add a search bar to the homepage (app/page.tsx):
- Text input with placeholder
- Search icon from lucide-react
- OnChange handler to filter results
- Debounced search (300ms)
- Clear button when text exists
```

#### Advanced - Full Feature
```
Create a complete task management feature:
1. TaskList component in src/components/TaskList.tsx
2. TaskItem component with checkbox, text, delete button
3. AddTask form with input and submit
4. Update homepage to use TaskList
5. Use React state for task array
6. Include TypeScript interfaces
```

---

## 5. Reviewing and Applying Changes

### Reading the Diff

```
┌─────────────────────────────────────────────────────────────┐
│  Diff View - Generation #abc123                             │
├─────────────────────────────────────────────────────────────┤
│  📄 src/components/Button.tsx (Created) [▼]                 │
│  +42 additions                                              │
│                                                             │
│  @@ -0,0 +1,42 @@                                          │
│  + import React from 'react';                              │
│  + import { cn } from '@/lib/utils';                       │
│  +                                                          │
│  + interface ButtonProps {                                 │
│  +   variant?: 'primary' | 'secondary' | 'danger';         │
│  +   size?: 'sm' | 'md' | 'lg';                           │
│  +   children: React.ReactNode;                            │
│  +   onClick?: () => void;                                 │
│  + }                                                        │
│  +                                                          │
│  + export function Button({                                │
│  +   variant = 'primary',                                  │
│  +   size = 'md',                                          │
│  +   children,                                             │
│  +   onClick                                               │
│  + }: ButtonProps) {                                       │
│  +   return (                                              │
│  +     <button                                             │
│  +       className={cn(                                    │
│  +         'rounded font-medium',                          │
│  +         variant === 'primary' && 'bg-blue-500',         │
│  +         variant === 'secondary' && 'bg-gray-500',       │
│  +         size === 'sm' && 'px-2 py-1 text-sm',          │
│  +         size === 'md' && 'px-4 py-2'                   │
│  +       )}                                                 │
│  +       onClick={onClick}                                 │
│  +     >                                                    │
│  +       {children}                                        │
│  +     </button>                                           │
│  +   );                                                     │
│  + }                                                        │
│                                                             │
│  [Approve & Apply] [Reject]                                │
└─────────────────────────────────────────────────────────────┘
```

### Understanding Diff Symbols
- **`+`** (Green): New line added
- **`-`** (Red): Line removed
- **` `** (White): Unchanged context line
- **`@@`**: Hunk header showing line ranges

### Best Practices
1. **Always review diffs carefully** before applying
2. **Check imports** - are they correct?
3. **Verify file paths** - are files in the right location?
4. **Test TypeScript types** - do they make sense?
5. **Read the AI's explanation** - shown above the diff

---

## 6. Complete Example: Building a React App

### Scenario: Build a Todo App from Scratch

#### Step 1: Configure AI (One-time setup)
1. Click "Configure Model"
2. Select OpenAI tab
3. Enter API key: `sk-proj-...`
4. Choose "GPT-4o"
5. Test connection → ✅
6. Save

#### Step 2: Create Data Types
**Prompt:**
```
Create TypeScript interfaces in src/types/todo.ts for:
- Todo interface with id, text, completed, createdAt
- TodoFilter type: 'all' | 'active' | 'completed'
```

**Action:** Click Send → Review Diff → Approve & Apply

#### Step 3: Create TodoItem Component
**Context:** Check `src/types/todo.ts` (just created)

**Prompt:**
```
Create TodoItem component in src/components/TodoItem.tsx:
- Accept todo prop (use Todo interface from types)
- Display todo text
- Checkbox for completed status
- Delete button (X icon)
- Props for onToggle and onDelete callbacks
- Use Tailwind for styling
- Gray text when completed
```

**Action:** Send → Review → Apply

#### Step 4: Create TodoList Component
**Context:** Check `src/components/TodoItem.tsx` and `src/types/todo.ts`

**Prompt:**
```
Create TodoList component in src/components/TodoList.tsx:
- Import TodoItem component
- Accept todos array and callbacks as props
- Map over todos and render TodoItem for each
- Empty state message when no todos
- Use TypeScript for all props
```

**Action:** Send → Review → Apply

#### Step 5: Create AddTodo Form
**Prompt:**
```
Create AddTodo component in src/components/AddTodo.tsx:
- Text input for new todo
- Submit button (or Enter key)
- Clear input after submit
- Callback prop onAdd(text: string)
- Form validation (min 1 character)
- Tailwind styling
```

**Action:** Send → Review → Apply

#### Step 6: Integrate into Homepage
**Context:** Check ALL components (TodoItem, TodoList, AddTodo) and types

**Prompt:**
```
Update app/page.tsx to create a complete todo app:
1. Import all todo components
2. Use useState for todos array
3. Use useState for filter ('all'|'active'|'completed')
4. Implement add, toggle, and delete functions
5. Filter todos based on current filter
6. Add filter buttons (All, Active, Completed)
7. Display count of active todos
8. Add proper TypeScript types
9. Use Tailwind for layout
```

**Action:** Send → Review → Apply

#### Step 7: Test Your App!
1. Look at file tree - all files should be there
2. Click on `app/page.tsx` in Code tab
3. See your complete todo app code
4. (Future) View Preview tab to see running app

---

## 7. Troubleshooting

### Issue: "No place to pass prompts"
**Solution:**
1. Make sure you clicked on a **project card** from the dashboard
2. Check you're on the URL `/editor/{projectId}`, not just `/dashboard`
3. Look for the **right panel** with "AI Assistant" heading
4. If right panel is collapsed, click the `[▶]` toggle button

### Issue: Chat input not visible
**Solution:**
1. Right panel might be collapsed - click expand button
2. Scroll down in the right panel
3. Refresh the page (F5)
4. Check browser console for errors (F12)

### Issue: "Configure your AI model first"
**Solution:**
1. You haven't set up an AI provider yet
2. Click "Configure Model" button in header
3. Follow steps in [Section 3](#3-configuring-your-ai-model)

### Issue: AI not generating code
**Possible Causes:**
1. **No API key:** Configure model first
2. **Invalid API key:** Re-enter and test connection
3. **No credits:** Check your OpenAI/Anthropic account balance
4. **Network error:** Check Docker logs: `docker logs dyad-collaborative-app-1`

### Issue: Diff not showing after generation
**Solution:**
1. Check chat message status - is it "Pending" or "Error"?
2. Look for error message in chat
3. Center panel should auto-switch to Diff tab
4. Manually click "Diff" tab if needed

### Issue: Changes not applied after approval
**Solution:**
1. Check chat message - status should change to "Applied" (green)
2. Refresh file tree by clicking the refresh icon
3. Check database: `docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "SELECT * FROM project_files WHERE project_id='YOUR_ID';"`

### Issue: TypeScript errors in files
**Solution:**
1. This is normal - AI might generate imperfect code
2. Edit manually in Code tab if needed
3. Or send another prompt: "Fix TypeScript errors in Button.tsx"

---

## 🎉 Success Checklist

After following this guide, you should be able to:
- ✅ Navigate from dashboard to editor
- ✅ See 3-panel layout with file explorer, tabs, and chat
- ✅ Configure an AI model with your API key
- ✅ Type prompts in the chat interface
- ✅ Select files for context
- ✅ Generate code with AI
- ✅ Review diffs with color-coded changes
- ✅ Approve and apply changes
- ✅ See new files appear in file tree
- ✅ Build complete React components and apps

---

## 📞 Need More Help?

1. **Check Browser Console:** Press F12, look for errors
2. **Check Docker Logs:** `docker logs dyad-collaborative-app-1 -f`
3. **Verify Database:** `docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative`
4. **Restart Containers:** `docker compose restart`
5. **Rebuild:** `docker compose down && docker compose up -d --build`

---

## 🚀 Next Steps

Once comfortable with basic usage:
1. **Explore Complex Prompts:** Try multi-file generations
2. **Use Context Effectively:** Select relevant files before prompting
3. **Iterate on Code:** Send follow-up prompts to refine
4. **Leverage AI Knowledge:** Ask for best practices, optimization, testing
5. **Build Full Apps:** Combine components into complete features

**Happy Coding! 🎨🤖**

---

*Last Updated: November 5, 2025*  
*Version: 1.0.0*  
*Dyad Collaborative - AI-Powered Vibe Coding*
