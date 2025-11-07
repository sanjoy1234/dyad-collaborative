'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Key, Sparkles } from 'lucide-react';

interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  model: string;
}

interface ModelConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: ModelConfig) => void;
  currentConfig?: ModelConfig | null;
}

const MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, multimodal' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast and capable' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and affordable' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance of speed and capability' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest and most compact' },
  ],
  google: [
    { id: 'gemini-pro', name: 'Gemini Pro', description: 'Google\'s most capable model' },
    { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', description: 'Multimodal capabilities' },
  ],
};

export function ModelConfigModal({ open, onOpenChange, onSave, currentConfig }: ModelConfigModalProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google'>(
    currentConfig?.provider || 'openai'
  );
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [model, setModel] = useState(currentConfig?.model || MODELS.openai[0].id);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleProviderChange = (newProvider: 'openai' | 'anthropic' | 'google') => {
    setProvider(newProvider);
    setModel(MODELS[newProvider][0].id);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/ai/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider, 
          api_key: apiKey,  // Backend expects api_key (snake_case)
          model 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: `✓ Connected successfully to ${provider} ${model}`,
        });
        toast({
          title: 'Success',
          description: 'API key is valid and working',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed',
        });
        toast({
          title: 'Error',
          description: data.error || 'Failed to connect',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Network error occurred',
      });
      toast({
        title: 'Error',
        description: 'Failed to test connection',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/ai/models/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider, 
          api_key: apiKey,  // Backend expects api_key (snake_case)
          model_name: model 
        }),
      });

      if (response.ok) {
        onSave({ provider, apiKey, model });
        toast({
          title: 'Success',
          description: 'Model configuration saved',
        });
        onOpenChange(false);
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to save configuration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Configure AI Model
          </DialogTitle>
          <DialogDescription>
            Choose your AI provider and configure API access. You can bring your own API keys or use pre-configured models.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={provider} onValueChange={(v) => handleProviderChange(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
            <TabsTrigger value="google">Google</TabsTrigger>
          </TabsList>

          <TabsContent value="openai" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                OpenAI API Key
              </Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={provider === 'openai' ? apiKey : ''}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Get your API key from{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  OpenAI Platform
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai-model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="openai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.openai.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="anthropic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anthropic-key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Anthropic API Key
              </Label>
              <Input
                id="anthropic-key"
                type="password"
                placeholder="sk-ant-..."
                value={provider === 'anthropic' ? apiKey : ''}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Get your API key from{' '}
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Anthropic Console
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anthropic-model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="anthropic-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.anthropic.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="google" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="google-key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Google API Key
              </Label>
              <Input
                id="google-key"
                type="password"
                placeholder="AIza..."
                value={provider === 'google' ? apiKey : ''}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Get your API key from{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Google AI Studio
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="google-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.google.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-md ${testResult.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}>
            {testResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-sm">{testResult.message}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={testing || !apiKey}>
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button onClick={handleSave} disabled={!apiKey}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
