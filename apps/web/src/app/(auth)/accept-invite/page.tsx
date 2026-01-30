import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Accept Invite - TA2 Supervisory Agent',
  description: 'Set up your TA2 Supervisory Agent account',
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
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl text-lg font-bold">
            P
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-semibold tracking-tight">TA2 Supervisory Agent</span>
            <span className="text-muted-foreground text-xs">
              Regain Popper<sup className="text-[8px] font-normal ml-0.5">TM</sup>
            </span>
          </div>
        </div>
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
