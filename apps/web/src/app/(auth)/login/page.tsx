import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Login - Popper Dashboard',
  description: 'Sign in to access the Popper Safety Operations Dashboard',
};

export default function LoginPage() {
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
