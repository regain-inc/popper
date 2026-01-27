'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import type { UserRole } from './use-auth';

interface UserWithMeta {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  image?: string | null;
  banned?: boolean | null;
  createdAt: Date;
}

interface Invite {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
}

interface InviteUserParams {
  email: string;
  role: UserRole;
}

async function fetchUsers(): Promise<UserWithMeta[]> {
  const result = await authClient.admin.listUsers({
    query: {
      limit: 100,
    },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to fetch users');
  }

  return (result.data?.users || []).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: (user.role as UserRole) || 'viewer',
    image: user.image,
    banned: user.banned,
    createdAt: new Date(user.createdAt),
  }));
}

async function fetchInvites(): Promise<Invite[]> {
  const response = await fetch('/api/auth/invites', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch invites');
  }
  const data = await response.json();
  return data.invites;
}

async function inviteUser(params: InviteUserParams): Promise<{
  success: boolean;
  invite?: Invite;
  inviteUrl?: string;
  emailSent?: boolean;
  error?: string;
}> {
  const response = await fetch('/api/auth/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    credentials: 'include',
  });
  return response.json();
}

async function banUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const result = await authClient.admin.banUser({
    userId,
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }
  return { success: true };
}

async function unbanUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const result = await authClient.admin.unbanUser({
    userId,
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }
  return { success: true };
}

async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<{ success: boolean; error?: string }> {
  // Map 'viewer' to 'user' for better-auth compatibility
  const betterAuthRole = role === 'viewer' ? 'user' : role;
  const result = await authClient.admin.setRole({
    userId,
    role: betterAuthRole as 'user' | 'admin',
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }
  return { success: true };
}

async function deleteInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/auth/invites/${inviteId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return response.json();
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });
}

export function useInvites() {
  return useQuery({
    queryKey: ['invites'],
    queryFn: fetchInvites,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: banUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unbanUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => setUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}
