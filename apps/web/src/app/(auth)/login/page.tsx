import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Login - TA2 Supervisory Agent',
  description: 'Sign in to access the TA2 Supervisory Agent Dashboard',
};

export default function LoginPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your account to continue</p>
      </div>

      {/* Login Form */}
      <LoginForm />

      {/* Footer */}
      <p className="text-muted-foreground text-center text-xs">
        This is an invite-only dashboard. Contact your administrator for access.
      </p>
    </div>
  );
}
