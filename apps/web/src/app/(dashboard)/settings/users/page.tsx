'use client';

import { Cancel01Icon, Copy01Icon, Mail01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type UserRole, useAuth } from '@/hooks/use-auth';
import {
  useBanUser,
  useDeleteInvite,
  useInvites,
  useInviteUser,
  useUnbanUser,
  useUsers,
} from '@/hooks/use-users';

function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const inviteUser = useInviteUser();

  async function handleInvite() {
    const result = await inviteUser.mutateAsync({ email, role });
    if (result.success && result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      setEmailSent(result.emailSent ?? false);
      if (result.emailSent) {
        toast.success(`Invite sent! Email delivered to ${email}`);
      } else {
        toast.success('Invite created');
      }
    } else {
      toast.error(result.error || 'Failed to create invite');
    }
  }

  function handleCopy() {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied to clipboard');
    }
  }

  function handleClose() {
    setOpen(false);
    setEmail('');
    setRole('viewer');
    setInviteUrl(null);
    setEmailSent(false);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button>
          <HugeiconsIcon icon={Mail01Icon} className="mr-2 size-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invite to allow a new user to access the dashboard.
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Admins can manage users and system settings. Viewers have read-only access.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-success/10 text-success rounded-lg p-3">
              <p className="text-sm font-medium">
                {emailSent ? 'Invite email sent!' : 'Invite created!'}
              </p>
              <p className="text-xs opacity-80">
                {emailSent
                  ? `We've sent an invitation email to ${email}.`
                  : `Share this link with ${email} to complete their registration.`}{' '}
                Expires in 48 hours.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">
                {emailSent ? 'Or share this link directly:' : 'Invite link:'}
              </Label>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  <HugeiconsIcon icon={Copy01Icon} className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!inviteUrl ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={!email || inviteUser.isPending}>
                {inviteUser.isPending ? 'Creating...' : 'Create Invite'}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: invites, isLoading: invitesLoading } = useInvites();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const deleteInvite = useDeleteInvite();

  // Redirect non-admins
  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Access Denied</p>
          <p className="text-muted-foreground text-sm">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  async function handleToggleActive(userId: string, isBanned: boolean) {
    if (isBanned) {
      const result = await unbanUser.mutateAsync(userId);
      if (result.success) {
        toast.success('User activated');
      } else {
        toast.error(result.error || 'Failed to activate user');
      }
    } else {
      const result = await banUser.mutateAsync(userId);
      if (result.success) {
        toast.success('User deactivated');
      } else {
        toast.error(result.error || 'Failed to deactivate user');
      }
    }
  }

  async function handleDeleteInvite(inviteId: string) {
    const result = await deleteInvite.mutateAsync(inviteId);
    if (result.success) {
      toast.success('Invite cancelled');
    } else {
      toast.error(result.error || 'Failed to cancel invite');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">Manage dashboard access and invites</p>
        </div>
        <InviteUserDialog />
      </div>

      {/* Users Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Active Users</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={!user.banned}
                        onCheckedChange={() => handleToggleActive(user.id, user.banned ?? false)}
                        disabled={user.id === currentUser?.id}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pending Invites */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Pending Invites</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitesLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ) : invites?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No pending invites
                  </TableCell>
                </TableRow>
              ) : (
                invites?.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant={invite.role === 'admin' ? 'default' : 'secondary'}>
                        {invite.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invite.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteInvite(invite.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
