'use client';

/**
 * Collaborators List Component
 * MVP Phase 1 - Invitation System
 * 
 * Shows all project collaborators and pending invitations
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { InviteCollaboratorModal } from './InviteCollaboratorModal';
import { AddCollaboratorDirectModal } from './AddCollaboratorDirectModal';

interface Collaborator {
  id: string;
  user_id: string;
  username: string;
  email: string;
  role: string;
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  inviterName: string;
  expiresAt: string;
  createdAt: string;
}

interface CollaboratorsListProps {
  projectId: string;
  projectName: string;
  currentUserId: string;
  isOwner: boolean;
}

export function CollaboratorsList({
  projectId,
  projectName,
  currentUserId,
  isOwner,
}: CollaboratorsListProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAddDirectModalOpen, setIsAddDirectModalOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch collaborators
      const collabResponse = await fetch(`/api/projects/${projectId}/collaborators`);
      if (collabResponse.ok) {
        const collabData = await collabResponse.json();
        setCollaborators(collabData.collaborators || []);
      }

      // Fetch invitations (only if owner)
      if (isOwner) {
        const inviteResponse = await fetch(`/api/projects/${projectId}/invitations`);
        if (inviteResponse.ok) {
          const inviteData = await inviteResponse.json();
          setInvitations(inviteData.invitations || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch collaborators:', error);
      toast({
        title: 'Failed to Load',
        description: 'Could not load collaborators',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/invitations/${invitationId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke invitation');
      }

      toast({
        title: 'Invitation Revoked',
        description: `Invitation for ${email} has been revoked`,
      });

      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Failed to revoke invitation:', error);
      toast({
        title: 'Failed to Revoke',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string, username: string) => {
    if (!confirm(`Remove ${username} from this project?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/collaborators/${collaboratorId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to remove collaborator');
      }

      toast({
        title: 'Collaborator Removed',
        description: `${username} has been removed from the project`,
      });

      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      toast({
        title: 'Failed to Remove',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
        return 'default';
      case 'editor':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'default';
      case 'accepted':
        return 'secondary';
      case 'expired':
        return 'outline';
      case 'revoked':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collaborators</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Collaborators</CardTitle>
              <CardDescription>
                {collaborators.length} {collaborators.length === 1 ? 'member' : 'members'}
                {pendingInvitations.length > 0 && `, ${pendingInvitations.length} pending`}
              </CardDescription>
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <Button onClick={() => setIsAddDirectModalOpen(true)} variant="default">
                  Add Collaborator
                </Button>
                <Button onClick={() => setIsInviteModalOpen(true)} variant="outline">
                  Invite via Email
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Active Collaborators */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Members</h3>
            <div className="space-y-2">
              {collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground">No collaborators yet</p>
              ) : (
                collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{collab.username}</span>
                        <Badge variant={getRoleBadgeVariant(collab.role)}>
                          {collab.role}
                        </Badge>
                        {collab.user_id === currentUserId && (
                          <span className="text-xs text-muted-foreground">(You)</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{collab.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Joined {new Date(collab.joined_at).toLocaleDateString()}
                      </div>
                    </div>

                    {isOwner && collab.role !== 'owner' && collab.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCollaborator(collab.id, collab.username)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Invitations */}
          {isOwner && pendingInvitations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Pending Invitations
              </h3>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{invitation.email}</span>
                        <Badge variant={getRoleBadgeVariant(invitation.role)}>
                          {invitation.role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(invitation.status)}>
                          {invitation.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Invited by {invitation.inviterName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeInvitation(invitation.id, invitation.email)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Statuses (for owners) */}
          {isOwner && invitations.filter(inv => inv.status !== 'pending').length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Invitation History
              </h3>
              <div className="space-y-2">
                {invitations
                  .filter(inv => inv.status !== 'pending')
                  .slice(0, 5)
                  .map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-muted-foreground">
                            {invitation.email}
                          </span>
                          <Badge variant={getStatusBadgeVariant(invitation.status)}>
                            {invitation.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {invitation.status === 'accepted' && 'Accepted'}
                          {invitation.status === 'rejected' && 'Rejected'}
                          {invitation.status === 'expired' && 'Expired'}
                          {invitation.status === 'revoked' && 'Revoked'} on{' '}
                          {new Date(invitation.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <InviteCollaboratorModal
        projectId={projectId}
        projectName={projectName}
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => fetchData()}
      />

      <AddCollaboratorDirectModal
        projectId={projectId}
        projectName={projectName}
        isOpen={isAddDirectModalOpen}
        onClose={() => setIsAddDirectModalOpen(false)}
        onSuccess={() => fetchData()}
      />
    </>
  );
}
