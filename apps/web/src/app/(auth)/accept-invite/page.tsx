import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Accept Invite - Popper Dashboard',
  description: 'Set up your Popper Dashboard account',
};

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3">
        <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl text-lg font-bold">
          P
        </div>
        <span className="text-2xl font-semibold tracking-tight">Popper</span>
      </div>

      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your account</h1>
        <p className="text-muted-foreground text-sm">
          Complete your registration to access the dashboard
        </p>
      </div>

      {/* Set Password Form */}
      <Suspense fallback={<FormSkeleton />}>
        <SetPasswordForm />
      </Suspense>
    </div>
  );
}
