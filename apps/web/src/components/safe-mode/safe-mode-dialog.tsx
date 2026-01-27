'use client';

import { Alert02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type DialogMode = 'enable' | 'disable';

interface SafeModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  scope: 'global' | 'organization';
  organizationName?: string;
  onConfirm: (reason: string, duration: string | null) => void;
  isLoading?: boolean;
}

const durations = [
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours', recommended: true },
  { value: '8h', label: '8 hours' },
  { value: 'indefinite', label: 'Indefinite (until manually disabled)' },
];

export function SafeModeDialog({
  open,
  onOpenChange,
  mode,
  scope,
  organizationName,
  onConfirm,
  isLoading,
}: SafeModeDialogProps) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('4h');

  const isEnable = mode === 'enable';
  const scopeLabel =
    scope === 'global' ? 'globally' : `for ${organizationName || 'this organization'}`;

  const handleConfirm = () => {
    const effectiveUntil = duration === 'indefinite' ? null : duration;
    onConfirm(reason, effectiveUntil);
  };

  const isValid = reason.length >= 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEnable && <HugeiconsIcon icon={Alert02Icon} className="size-5 text-warning" />}
            {isEnable ? 'Enable Safe-Mode' : 'Disable Safe-Mode'}
          </DialogTitle>
          <DialogDescription>
            {isEnable
              ? `This will enable safe-mode ${scopeLabel}. More decisions will be routed to clinicians.`
              : `This will disable safe-mode ${scopeLabel}. Normal operation will resume.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder={
                isEnable
                  ? 'e.g., Investigating spike in route_to_clinician decisions'
                  : 'e.g., Investigation complete, metrics back to normal'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-muted-foreground text-xs">
              Minimum 10 characters ({reason.length}/10)
            </p>
          </div>

          {/* Duration (only for enable) */}
          {isEnable && (
            <div className="space-y-3">
              <Label>Duration</Label>
              <RadioGroup value={duration} onValueChange={setDuration}>
                {durations.map((d) => (
                  <div key={d.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={d.value} id={d.value} />
                    <Label
                      htmlFor={d.value}
                      className={cn('font-normal cursor-pointer', d.recommended && 'font-medium')}
                    >
                      {d.label}
                      {d.recommended && (
                        <span className="text-muted-foreground ml-2 text-xs">(Recommended)</span>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Warning */}
          {isEnable && (
            <div className="flex gap-3 rounded-lg bg-warning/10 p-3">
              <HugeiconsIcon icon={Alert02Icon} className="size-5 shrink-0 text-warning" />
              <p className="text-sm">
                {scope === 'global'
                  ? 'This will affect ALL organizations. More decisions will be routed to clinicians instead of being auto-approved.'
                  : 'This will affect only this organization. More decisions will be routed to clinicians instead of being auto-approved.'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={isEnable ? 'default' : 'outline'}
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className={cn(isEnable && 'bg-warning text-warning-foreground hover:bg-warning/90')}
          >
            {isLoading ? 'Processing...' : isEnable ? 'Enable Safe-Mode' : 'Disable Safe-Mode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
