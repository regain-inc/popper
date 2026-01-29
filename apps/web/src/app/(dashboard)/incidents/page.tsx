'use client';

import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  InformationCircleIcon,
  Loading03Icon,
  SecurityCheckIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  getIncidentStatusColor,
  getTriggerLevelColor,
  useAcknowledgeIncident,
  useIncidents,
  useResolveIncident,
} from '@/hooks/use-incidents';
import { useOrganization } from '@/hooks/use-organization';
import { cn } from '@/lib/utils';
import type { Incident } from '@/types/api';

function IncidentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-4">
        <Skeleton className="h-[100px] rounded-xl" />
        <Skeleton className="h-[100px] rounded-xl" />
        <Skeleton className="h-[100px] rounded-xl" />
        <Skeleton className="h-[100px] rounded-xl" />
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

export default function IncidentsPage() {
  const { selectedOrgId } = useOrganization();
  const [statusFilter, setStatusFilter] = useState<'all' | 'open'>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const { data, isLoading, error } = useIncidents(selectedOrgId || undefined, statusFilter);
  const acknowledgeMutation = useAcknowledgeIncident();
  const resolveMutation = useResolveIncident();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground text-sm">Track and resolve safety incidents</p>
        </div>
        <IncidentsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground text-sm">Track and resolve safety incidents</p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive font-medium">Failed to load incidents</p>
        </div>
      </div>
    );
  }

  const incidents = data?.incidents || [];
  const openCount = incidents.filter((i) => i.status === 'open').length;
  const acknowledgedCount = incidents.filter((i) => i.status === 'acknowledged').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const criticalCount = incidents.filter((i) => i.trigger_level === 'critical').length;

  const handleAcknowledge = async (incident: Incident) => {
    try {
      await acknowledgeMutation.mutateAsync(incident.id);
      toast.success('Incident acknowledged');
    } catch {
      toast.error('Failed to acknowledge incident');
    }
  };

  const handleResolve = async () => {
    if (!selectedIncident || !resolutionNotes.trim()) return;

    try {
      await resolveMutation.mutateAsync({
        id: selectedIncident.id,
        request: { resolution_notes: resolutionNotes },
      });
      toast.success('Incident resolved');
      setResolveDialogOpen(false);
      setSelectedIncident(null);
      setResolutionNotes('');
    } catch {
      toast.error('Failed to resolve incident');
    }
  };

  const openResolveDialog = (incident: Incident) => {
    setSelectedIncident(incident);
    setResolutionNotes('');
    setResolveDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground text-sm">Track and resolve safety incidents</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'open')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Incidents</SelectItem>
            <SelectItem value="open">Open Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className={cn(openCount > 0 && 'border-destructive/50 bg-destructive/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={AlertCircleIcon} className="text-destructive size-5" />
              <span className="text-2xl font-bold">{openCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(acknowledgedCount > 0 && 'border-warning/50 bg-warning/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Acknowledged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Clock01Icon} className="text-warning size-5" />
              <span className="text-2xl font-bold">{acknowledgedCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="text-success size-5" />
              <span className="text-2xl font-bold">{resolvedCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(criticalCount > 0 && 'border-destructive/50 bg-destructive/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={SecurityCheckIcon} className="text-destructive size-5" />
              <span className="text-2xl font-bold">{criticalCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Incidents</CardTitle>
          <CardDescription>
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
              <div className="text-center">
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  className="mx-auto mb-2 size-8 opacity-50"
                />
                <p>No incidents found</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Time</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[140px]">Signal</TableHead>
                    <TableHead className="w-[160px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(incident.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getIncidentStatusColor(incident.status) as 'default'}>
                          {incident.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {incident.trigger_level && (
                          <Badge
                            variant={getTriggerLevelColor(incident.trigger_level) as 'default'}
                          >
                            {incident.trigger_level}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate font-medium">{incident.title}</p>
                        {incident.description && (
                          <p className="text-muted-foreground truncate text-xs">
                            {incident.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {incident.trigger_signal?.replace(/_/g, ' ') || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {incident.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledge(incident)}
                              disabled={acknowledgeMutation.isPending}
                            >
                              {acknowledgeMutation.isPending ? (
                                <HugeiconsIcon
                                  icon={Loading03Icon}
                                  className="size-3 animate-spin"
                                />
                              ) : (
                                'Acknowledge'
                              )}
                            </Button>
                          )}
                          {(incident.status === 'open' || incident.status === 'acknowledged') && (
                            <Button size="sm" onClick={() => openResolveDialog(incident)}>
                              Resolve
                            </Button>
                          )}
                          {incident.status === 'resolved' && (
                            <span className="text-muted-foreground text-xs">
                              Resolved by {incident.resolved_by?.split('@')[0] || 'system'}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Incident</DialogTitle>
            <DialogDescription>
              Provide resolution notes for: {selectedIncident?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resolution-notes">Resolution Notes</Label>
              <Textarea
                id="resolution-notes"
                placeholder="Describe how the incident was resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!resolutionNotes.trim() || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? (
                <>
                  <HugeiconsIcon icon={Loading03Icon} className="mr-2 size-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                'Resolve Incident'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
