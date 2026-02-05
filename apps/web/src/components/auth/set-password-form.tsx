'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';

interface InviteInfo {
  email: string;
  role: string;
}

export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('No invite token provided');
        setIsValidating(false);
        return;
      }

      try {
        const { data, error: apiError } = await authApi.api.invites.validate.get({
          query: { token },
        });

        if (apiError || !data?.valid) {
          setError(data?.error || 'Invalid or expired invite');
        } else {
          setInviteInfo({ email: data.email!, role: data.role! });
        }
      } catch {
        setError('Failed to validate invite');
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: apiError } = await authApi.api.invites.accept.post({
        token: token!,
        name,
        password,
      });

      if (apiError || !data?.success) {
        setError(data?.error || 'Failed to create account');
      } else {
        // Redirect based on role - compliance users go to /compliance
        const redirectUrl = inviteInfo?.role === 'compliance' ? '/compliance' : '/';
        router.push(redirectUrl);
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  if (isValidating) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-muted-foreground">Validating invite...</div>
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
          <p className="font-medium">Invalid Invite</p>
          <p className="text-sm">{error}</p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => router.push('/login')}>
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={inviteInfo.email} disabled className="bg-muted" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={isLoading}
        />
        <p className="text-muted-foreground text-xs">Must be at least 8 characters</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  );
}
