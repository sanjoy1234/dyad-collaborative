'use client';

/**
 * Invite Collaborator Modal Component
 * MVP Phase 1 - Invitation System
 * 
 * Allows project owners to invite collaborators via email
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface InviteCollaboratorModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InviteCollaboratorModal({
  projectId,
  projectName,
  isOpen,
  onClose,
  onSuccess,
}: InviteCollaboratorModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          role,
          expiresInHours: 168, // 7 days
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      // Success!
      setInvitationUrl(data.invitation.invitationUrl);
      
      toast({
        title: 'Invitation Sent!',
        description: `Invitation email sent to ${email}`,
      });

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        setEmail('');
        setRole('editor');
        setInvitationUrl(null);
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Failed to send invitation:', error);
      
      toast({
        title: 'Failed to Send Invitation',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setRole('editor');
      setInvitationUrl(null);
      onClose();
    }
  };

  const copyInvitationUrl = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl);
      toast({
        title: 'Copied!',
        description: 'Invitation link copied to clipboard',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Collaborator</DialogTitle>
          <DialogDescription>
            Invite someone to collaborate on <strong>{projectName}</strong>
          </DialogDescription>
        </DialogHeader>

        {!invitationUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
              />
              <p className="text-sm text-muted-foreground">
                They'll receive an email with an invitation link
              </p>
            </div>

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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          // Success State - Show invitation URL
          <div className="space-y-4 py-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800 font-medium">
                ✓ Invitation sent successfully!
              </p>
            </div>

            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input
                  value={invitationUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyInvitationUrl}
                >
                  Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                You can also share this link directly. It expires in 7 days.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
