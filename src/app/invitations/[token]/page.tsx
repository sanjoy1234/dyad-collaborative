'use client';

/**
 * Invitation Accept Page
 * MVP Phase 1 - Invitation System
 * 
 * Public page for accepting/rejecting project invitations
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InvitationDetails {
  projectId: string;
  projectName: string;
  email: string;
  role: string;
  inviterName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const { token } = resolvedParams;
  const router = useRouter();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError('Invitation not found. It may have been revoked or does not exist.');
        } else if (response.status === 410) {
          setError('This invitation has expired.');
        } else {
          setError(data.error || 'Failed to load invitation');
        }
        return;
      }

      setInvitation(data.invitation);

      // Check if already acted upon
      if (data.invitation.status !== 'pending') {
        setError(`This invitation has been ${data.invitation.status}.`);
      }

    } catch (err) {
      console.error('Failed to fetch invitation:', err);
      setError('Failed to load invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invitation) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in - redirect to login with return URL
          router.push(`/login?redirect=/invitations/${token}`);
          return;
        } else if (response.status === 403) {
          setError('This invitation was sent to a different email address. Please log in with the correct account.');
        } else if (response.status === 409) {
          setError('You already have access to this project.');
          setTimeout(() => {
            router.push(`/projects/${invitation.projectId}`);
          }, 2000);
        } else {
          setError(data.error || 'Failed to accept invitation');
        }
        return;
      }

      // Success!
      setSuccessMessage('Invitation accepted! Redirecting to project...');
      
      setTimeout(() => {
        router.push(`/projects/${data.project.id}`);
      }, 2000);

    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setError('Failed to accept invitation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!invitation) return;

    if (!confirm('Are you sure you want to reject this invitation?')) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}/reject`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reject invitation');
        return;
      }

      // Success!
      setSuccessMessage('Invitation rejected.');
      
      // Refresh to show updated status
      setTimeout(() => {
        fetchInvitation();
      }, 1500);

    } catch (err) {
      console.error('Failed to reject invitation:', err);
      setError('Failed to reject invitation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Please wait</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => router.push('/')}>
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <CardTitle className="text-green-600">Success!</CardTitle>
            </div>
            <CardDescription>{successMessage}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Project Invitation</CardTitle>
          <CardDescription>
            You've been invited to collaborate on a project
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Project</span>
              <span className="font-semibold">{invitation?.projectName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Invited by</span>
              <span className="font-medium">{invitation?.inviterName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Your email</span>
              <span className="font-medium">{invitation?.email}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Role</span>
              <Badge variant="secondary">{invitation?.role}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Expires</span>
              <span className="text-sm">
                {invitation?.expiresAt && 
                  new Date(invitation.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {invitation?.role === 'editor' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Editor</strong> role allows you to view and edit files in this project.
              </p>
            </div>
          )}

          {invitation?.role === 'viewer' && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Viewer</strong> role allows you to view files in this project (read-only).
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing || invitation?.status !== 'pending'}
            className="flex-1"
          >
            {isProcessing ? 'Processing...' : 'Reject'}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isProcessing || invitation?.status !== 'pending'}
            className="flex-1"
          >
            {isProcessing ? 'Processing...' : 'Accept Invitation'}
          </Button>
        </CardFooter>

        <div className="px-6 pb-6">
          <p className="text-xs text-muted-foreground text-center">
            Not you? You can safely close this page.
          </p>
        </div>
      </Card>
    </div>
  );
}
