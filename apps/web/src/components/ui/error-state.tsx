'use client';

import { AlertCircleIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Unable to load data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="bg-destructive/10 mb-4 flex size-12 items-center justify-center rounded-full">
          <HugeiconsIcon icon={AlertCircleIcon} className="text-destructive size-6" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="mt-4 gap-2">
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface ConnectionErrorProps {
  onRetry?: () => void;
}

export function ConnectionError({ onRetry }: ConnectionErrorProps) {
  return (
    <ErrorState
      title="Unable to connect"
      message="Cannot reach the Popper service. Please check your connection and try again."
      onRetry={onRetry}
    />
  );
}

interface UnauthorizedErrorProps {
  onLogin?: () => void;
}

export function UnauthorizedError({ onLogin }: UnauthorizedErrorProps) {
  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="bg-warning/10 mb-4 flex size-12 items-center justify-center rounded-full">
          <HugeiconsIcon icon={AlertCircleIcon} className="text-warning size-6" />
        </div>
        <h3 className="text-lg font-semibold">Session expired</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Your session has expired. Please log in again to continue.
        </p>
        {onLogin && (
          <Button onClick={onLogin} className="mt-4">
            Log in
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = 'No data found',
  message = 'There are no items to display.',
  action,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <h3 className="text-muted-foreground text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
        {action && (
          <Button variant="outline" onClick={action.onClick} className="mt-4">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
