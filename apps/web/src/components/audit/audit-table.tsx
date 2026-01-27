'use client';

import { ArrowDown01Icon, ArrowUp01Icon, Copy01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { AuditEvent } from '@/types/api';

interface AuditTableProps {
  events: AuditEvent[];
  onTraceClick?: (traceId: string) => void;
}

const eventTypeBadges: Record<
  string,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
    label: string;
  }
> = {
  SUPERVISION_RESPONSE_DECIDED: { variant: 'info', label: 'Decision' },
  SUPERVISION_REQUEST_RECEIVED: { variant: 'secondary', label: 'Request' },
  SAFE_MODE_ENABLED: { variant: 'warning', label: 'Safe-Mode On' },
  SAFE_MODE_DISABLED: { variant: 'success', label: 'Safe-Mode Off' },
  VALIDATION_FAILED: { variant: 'destructive', label: 'Validation' },
  CONTROL_COMMAND_ISSUED: { variant: 'default', label: 'Command' },
  OTHER: { variant: 'outline', label: 'Other' },
};

const decisionBadges: Record<
  string,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
    label: string;
  }
> = {
  APPROVED: { variant: 'success', label: 'Approved' },
  HARD_STOP: { variant: 'destructive', label: 'Hard Stop' },
  ROUTE_TO_CLINICIAN: { variant: 'warning', label: 'Route' },
  REQUEST_MORE_INFO: { variant: 'info', label: 'Info' },
};

function EventRow({
  event,
  onTraceClick,
}: {
  event: AuditEvent;
  onTraceClick?: (traceId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const eventBadge = eventTypeBadges[event.event_type] || eventTypeBadges.OTHER;
  const decision = event.tags?.decision as string | undefined;
  const decisionBadge = decision ? decisionBadges[decision] : null;

  const copyTraceId = () => {
    navigator.clipboard.writeText(event.trace.trace_id);
    toast.success('Trace ID copied to clipboard');
  };

  return (
    <Fragment>
      <TableRow
        className={cn('cursor-pointer transition-colors', isOpen && 'bg-muted/50')}
        onClick={() => setIsOpen(!isOpen)}
      >
        <TableCell className="w-[140px]">
          <span className="text-muted-foreground text-sm">
            {new Date(event.occurred_at).toLocaleTimeString()}
          </span>
        </TableCell>
        <TableCell>
          <Badge variant={eventBadge.variant}>{eventBadge.label}</Badge>
        </TableCell>
        <TableCell>
          {decisionBadge ? (
            <Badge variant={decisionBadge.variant}>{decisionBadge.label}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="font-mono text-xs">
            {event.mode}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[300px] truncate">
          <span className="text-sm">{event.summary}</span>
        </TableCell>
        <TableCell className="w-[40px]">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          >
            <HugeiconsIcon icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon} className="size-4" />
          </Button>
        </TableCell>
      </TableRow>

      {isOpen && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Trace Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Trace Information</h4>
                <div className="bg-background space-y-1 rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Trace ID</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs">{event.trace.trace_id}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyTraceId();
                        }}
                      >
                        <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Event ID</span>
                    <code className="font-mono text-xs">{event.id}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subject</span>
                    <code className="font-mono text-xs">{event.subject.subject_id}</code>
                  </div>
                  {event.subject.organization_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Organization</span>
                      <code className="font-mono text-xs">{event.subject.organization_id}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tags</h4>
                <div className="bg-background rounded-lg border p-3">
                  {event.tags && Object.keys(event.tags).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(event.tags).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="gap-1">
                          <span className="text-muted-foreground">{key}:</span>
                          <span>{value}</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">No tags</span>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTraceClick?.(event.trace.trace_id);
                    }}
                  >
                    View Related Events
                  </Button>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export function AuditTable({ events, onTraceClick }: AuditTableProps) {
  if (events.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border">
        <div className="text-center">
          <p className="text-muted-foreground font-medium">No events found</p>
          <p className="text-muted-foreground text-sm">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Time</TableHead>
            <TableHead>Event Type</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <EventRow key={event.id} event={event} onTraceClick={onTraceClick} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
