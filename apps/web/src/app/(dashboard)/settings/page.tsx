'use client';

import { ArrowRight01Icon, Timer01Icon, UserMultiple02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/use-auth';
import { useSettings } from '@/hooks/use-settings';

const refreshOptions = [
  { value: '0', label: 'Disabled', description: 'Manual refresh only' },
  { value: '15', label: '15 seconds', description: 'High frequency updates' },
  { value: '30', label: '30 seconds', description: 'Recommended for active monitoring' },
  { value: '60', label: '1 minute', description: 'Standard refresh rate' },
  { value: '300', label: '5 minutes', description: 'Low frequency updates' },
];

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { refreshInterval, setRefreshInterval } = useSettings();

  const handleRefreshChange = (value: string) => {
    const interval = Number.parseInt(value, 10);
    setRefreshInterval(interval);
    if (interval === 0) {
      toast.success('Auto-refresh disabled');
    } else {
      toast.success(`Auto-refresh set to ${interval} seconds`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure dashboard preferences</p>
      </div>

      {/* Refresh Interval */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
              <HugeiconsIcon icon={Timer01Icon} className="text-muted-foreground size-5" />
            </div>
            <div>
              <CardTitle className="text-base">Auto-Refresh Interval</CardTitle>
              <CardDescription>
                How often the dashboard data should automatically refresh
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={refreshInterval.toString()}
            onValueChange={handleRefreshChange}
            className="grid gap-3"
          >
            {refreshOptions.map((option) => (
              <Label
                key={option.value}
                htmlFor={`refresh-${option.value}`}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={option.value} id={`refresh-${option.value}`} />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs">{option.description}</span>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* User Management (Admin only) */}
      {isAdmin && (
        <Card className="group cursor-pointer transition-colors hover:border-primary/50">
          <Link href="/settings/users">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
                    <HugeiconsIcon
                      icon={UserMultiple02Icon}
                      className="text-muted-foreground size-5"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base">User Management</CardTitle>
                    <CardDescription>Manage dashboard users and invitations</CardDescription>
                  </div>
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="text-muted-foreground size-5 transition-transform group-hover:translate-x-1"
                />
              </div>
            </CardHeader>
          </Link>
        </Card>
      )}
    </div>
  );
}
