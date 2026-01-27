'use client';

import { Cancel01Icon, SearchIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuditEventsParams, AuditEventType, SupervisionDecision } from '@/types/api';

interface AuditFiltersProps {
  filters: AuditEventsParams;
  onFiltersChange: (filters: AuditEventsParams) => void;
}

const eventTypes: { value: AuditEventType; label: string }[] = [
  { value: 'SUPERVISION_RESPONSE_DECIDED', label: 'Response Decided' },
  { value: 'SUPERVISION_REQUEST_RECEIVED', label: 'Request Received' },
  { value: 'SAFE_MODE_ENABLED', label: 'Safe-Mode On' },
  { value: 'SAFE_MODE_DISABLED', label: 'Safe-Mode Off' },
  { value: 'VALIDATION_FAILED', label: 'Validation Failed' },
  { value: 'CONTROL_COMMAND_ISSUED', label: 'Control Command' },
];

const decisions: { value: SupervisionDecision; label: string }[] = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'HARD_STOP', label: 'Hard Stop' },
  { value: 'ROUTE_TO_CLINICIAN', label: 'Route to Clinician' },
  { value: 'REQUEST_MORE_INFO', label: 'Request More Info' },
];

const reasonCodes = [
  'schema_invalid',
  'policy_violation',
  'insufficient_evidence',
  'high_uncertainty',
  'risk_too_high',
  'needs_human_review',
  'snapshot_stale',
];

export function AuditFilters({ filters, onFiltersChange }: AuditFiltersProps) {
  const [traceIdInput, setTraceIdInput] = useState(filters.trace_id || '');

  const activeFiltersCount = [
    filters.event_type,
    filters.decision,
    filters.reason_codes,
    filters.trace_id,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setTraceIdInput('');
    onFiltersChange({
      ...filters,
      event_type: undefined,
      decision: undefined,
      reason_codes: undefined,
      trace_id: undefined,
    });
  };

  const handleTraceIdSearch = () => {
    onFiltersChange({ ...filters, trace_id: traceIdInput || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Event Type */}
        <Select
          value={filters.event_type || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              event_type: value === 'all' ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            {eventTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Decision */}
        <Select
          value={filters.decision || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              decision: value === 'all' ? undefined : (value as SupervisionDecision),
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Decision" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            {decisions.map((decision) => (
              <SelectItem key={decision.value} value={decision.value}>
                {decision.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reason Code */}
        <Select
          value={filters.reason_codes || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              reason_codes: value === 'all' ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Reason Code" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reason Codes</SelectItem>
            {reasonCodes.map((code) => (
              <SelectItem key={code} value={code}>
                {code.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Trace ID Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              placeholder="Search trace ID..."
              value={traceIdInput}
              onChange={(e) => setTraceIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTraceIdSearch()}
              className="w-[200px] pr-8"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-2"
              onClick={handleTraceIdSearch}
            >
              <HugeiconsIcon icon={SearchIcon} className="size-4" />
            </Button>
          </div>
        </div>

        {/* Clear filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-2">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            Clear ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.event_type && (
            <Badge variant="secondary" className="gap-1">
              Event: {eventTypes.find((t) => t.value === filters.event_type)?.label}
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, event_type: undefined })}
                className="hover:bg-muted ml-1 rounded-full"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </Badge>
          )}
          {filters.decision && (
            <Badge variant="secondary" className="gap-1">
              Decision: {filters.decision}
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, decision: undefined })}
                className="hover:bg-muted ml-1 rounded-full"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </Badge>
          )}
          {filters.reason_codes && (
            <Badge variant="secondary" className="gap-1">
              Reason: {filters.reason_codes}
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, reason_codes: undefined })}
                className="hover:bg-muted ml-1 rounded-full"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </Badge>
          )}
          {filters.trace_id && (
            <Badge variant="secondary" className="gap-1">
              Trace: {filters.trace_id.slice(0, 12)}...
              <button
                type="button"
                onClick={() => {
                  setTraceIdInput('');
                  onFiltersChange({ ...filters, trace_id: undefined });
                }}
                className="hover:bg-muted ml-1 rounded-full"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
