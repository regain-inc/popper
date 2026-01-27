'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, UserRole } from './use-auth';

interface UserWithMeta extends AuthUser {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
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
  const response = await fetch('/api/auth/users', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  const data = await response.json();
  return data.users;
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

async function updateUserStatus(
  userId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/auth/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
    credentials: 'include',
  });
  return response.json();
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

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserStatus(userId, isActive),
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
