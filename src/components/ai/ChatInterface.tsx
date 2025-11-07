'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Send,
  Loader2,
  User,
  Bot,
  FileCode,
  Check,
  X,
  Clock,
  Sparkles,
  Settings,
} from 'lucide-react';
// Simple timestamp formatter
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  generationId?: string;
  status?: 'pending' | 'applied' | 'rejected';
  filesChanged?: string[];
}

interface ChatInterfaceProps {
  projectId: string;
  selectedFiles?: string[];
  onGenerationComplete?: (generationId: string) => void;
  onOpenModelConfig?: () => void;
  currentModel?: string;
}

export function ChatInterface({
  projectId,
  selectedFiles = [],
  onGenerationComplete,
  onOpenModelConfig,
  currentModel,
}: ChatInterfaceProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Load chat history
    loadChatHistory();
  }, [projectId]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chats`);
      if (response.ok) {
        const data = await response.json();
        // TODO: Convert chats to messages format
        // For now, start with empty messages
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    if (!currentModel) {
      toast({
        title: 'No Model Configured',
        description: 'Please configure an AI model first',
        variant: 'destructive',
      });
      if (onOpenModelConfig) {
        onOpenModelConfig();
      }
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt: userMessage.content,
          model: currentModel,
          selectedFiles,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate code');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.explanation || 'Code generated successfully',
        timestamp: new Date(),
        generationId: data.generationId,
        status: 'pending',
        filesChanged: [
          ...((data.operations?.filter((op: any) => op.type === 'create').map((op: any) => op.path)) || []),
          ...((data.operations?.filter((op: any) => op.type === 'modify').map((op: any) => op.path)) || []),
        ],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (onGenerationComplete && data.generationId) {
        onGenerationComplete(data.generationId);
      }

      toast({
        title: 'Code Generated',
        description: 'Review the changes in the diff viewer',
      });
    } catch (error) {
      console.error('Generation error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to generate code'}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate code',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const updateMessageStatus = (messageId: string, status: 'applied' | 'rejected') => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, status } : msg
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          {currentModel ? (
            <Badge variant="secondary" className="text-xs">
              {currentModel}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              No model configured
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenModelConfig}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Start a conversation</p>
              <p className="text-sm">
                Ask me to create components, add features, or modify your code
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex gap-3 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Card
                    className={`p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </Card>

                  {message.filesChanged && message.filesChanged.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileCode className="h-3 w-3" />
                      <span>{message.filesChanged.length} files affected</span>
                    </div>
                  )}

                  {message.status && (
                    <div className="flex items-center gap-2">
                      {message.status === 'pending' && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Review
                        </Badge>
                      )}
                      {message.status === 'applied' && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Applied
                        </Badge>
                      )}
                      {message.status === 'rejected' && (
                        <Badge variant="destructive" className="text-xs">
                          <X className="h-3 w-3 mr-1" />
                          Rejected
                        </Badge>
                      )}
                    </div>
                  )}

                  <span className="text-xs text-muted-foreground">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex gap-3 justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <Card className="p-3 bg-muted">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating code...</span>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Selected Files Info */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode className="h-3 w-3" />
            <span>{selectedFiles.length} file(s) selected for context</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={isGenerating}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
