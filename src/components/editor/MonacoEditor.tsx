'use client';

import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import Editor, { OnMount } from '@monaco-editor/react';

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  path?: string;
  theme?: 'vs-dark' | 'vs-light';
}

export function MonacoEditor({
  value,
  onChange,
  language = 'javascript',
  readOnly = false,
  path = '',
  theme = 'vs-dark',
}: MonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      readOnly,
      minimap: { enabled: true },
      fontSize: 14,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Save command - you can trigger save from here
      console.log('Save command triggered');
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  // Map file extensions to Monaco languages
  const getLanguage = () => {
    if (language) return language;
    
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      md: 'markdown',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      sql: 'sql',
      sh: 'shell',
      bash: 'shell',
      txt: 'plaintext',
    };

    return languageMap[ext || ''] || 'plaintext';
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={getLanguage()}
        value={value}
        theme={theme}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
