'use client';

import { Building02Icon, Globe02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SafeModeHistoryEntry } from '@/types/api';

interface SafeModeHistoryProps {
  history: SafeModeHistoryEntry[];
  filter: 'all' | 'global' | 'organization';
  onFilterChange: (filter: 'all' | 'global' | 'organization') => void;
}

export function SafeModeHistory({ history, filter, onFilterChange }: SafeModeHistoryProps) {
  const filteredHistory = history.filter((entry) => {
    if (filter === 'all') return true;
    if (filter === 'global') return entry.scope === 'global';
    return entry.scope === 'organization';
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">History</CardTitle>
          <Select
            value={filter}
            onValueChange={(v) => onFilterChange(v as 'all' | 'global' | 'organization')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="global">Global only</SelectItem>
              <SelectItem value="organization">Org only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredHistory.length === 0 ? (
          <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
            No history entries
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Time</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                  <TableHead className="w-[100px]">Scope</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[140px]">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((entry) => {
                  const ScopeIcon = entry.scope === 'global' ? Globe02Icon : Building02Icon;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(entry.effective_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.enabled ? 'warning' : 'success'}
                          className="capitalize"
                        >
                          {entry.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon
                            icon={ScopeIcon}
                            className="text-muted-foreground size-4"
                          />
                          <span
                            className={cn(
                              'text-sm capitalize',
                              entry.scope === 'global' ? 'font-medium' : 'text-muted-foreground',
                            )}
                          >
                            {entry.scope === 'global'
                              ? 'Global'
                              : entry.organization_id?.replace('org_', '') || 'Org'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {entry.reason}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.created_by.split('@')[0]}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
