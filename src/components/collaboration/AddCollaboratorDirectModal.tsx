/**
 * Add Collaborator Direct Modal (For Test Accounts)
 * Bypasses email invitation system
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface AddCollaboratorDirectModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TEST_ACCOUNTS = [
  { email: 'dev1@test.com', label: 'Dev1 (Test Account)' },
  { email: 'dev2@test.com', label: 'Dev2 (Test Account)' },
  { email: 'dev3@test.com', label: 'Dev3 (Test Account)' },
];

export function AddCollaboratorDirectModal({
  projectId,
  projectName,
  isOpen,
  onClose,
  onSuccess,
}: AddCollaboratorDirectModalProps) {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailToAdd = selectedEmail || customEmail;

    if (!emailToAdd) {
      toast({
        title: 'Email Required',
        description: 'Please select or enter an email address.',
        variant: 'destructive',
      });
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToAdd)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators/add-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailToAdd,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add collaborator');
      }

      toast({
        title: 'Collaborator Added!',
        description: `${emailToAdd} has been added as ${role}`,
      });

      if (onSuccess) {
        onSuccess();
      }

      // Reset form
      setSelectedEmail('');
      setCustomEmail('');
      setRole('editor');
      onClose();
    } catch (error) {
      console.error('Failed to add collaborator:', error);
      toast({
        title: 'Failed to Add Collaborator',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedEmail('');
      setCustomEmail('');
      setRole('editor');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Collaborator (Direct)</DialogTitle>
          <DialogDescription>
            Add a collaborator directly to <strong>{projectName}</strong> without email verification.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Test Account Selection */}
          <div className="space-y-2">
            <Label>Quick Select Test Account</Label>
            <div className="grid grid-cols-1 gap-2">
              {TEST_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setSelectedEmail(account.email);
                    setCustomEmail('');
                  }}
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-left border rounded-md hover:bg-muted transition-colors ${
                    selectedEmail === account.email ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  {account.label}
                  <div className="text-xs opacity-70">{account.email}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Email */}
          <div className="space-y-2">
            <Label htmlFor="custom-email">Or Enter Email</Label>
            <Input
              id="custom-email"
              type="email"
              placeholder="user@example.com"
              value={customEmail}
              onChange={(e) => {
                setCustomEmail(e.target.value);
                setSelectedEmail('');
              }}
              disabled={isSubmitting || !!selectedEmail}
            />
            <p className="text-sm text-muted-foreground">
              User must have an account with this email
            </p>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="editor"
                  checked={role === 'editor'}
                  onChange={(e) => setRole(e.target.value as 'editor')}
                  disabled={isSubmitting}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Editor</div>
                  <div className="text-sm text-muted-foreground">
                    Can view and edit files
                  </div>
                </div>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="viewer"
                  checked={role === 'viewer'}
                  onChange={(e) => setRole(e.target.value as 'viewer')}
                  disabled={isSubmitting}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Viewer</div>
                  <div className="text-sm text-muted-foreground">
                    Can only view files
                  </div>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Collaborator'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
