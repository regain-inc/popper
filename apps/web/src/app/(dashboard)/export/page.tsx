'use client';

import {
  Calendar03Icon,
  Download01Icon,
  FileZipIcon,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useDataSource } from '@/hooks/use-data-source';

type ExportScope = 'global' | 'organization';
type TimeRange = '24h' | '7d' | '30d' | 'custom';

interface ExportConfig {
  scope: ExportScope;
  organizationId?: string;
  timeRange: TimeRange;
  customFrom?: string;
  customTo?: string;
  includeAuditEvents: boolean;
  includeSupervisionReceipts: boolean;
  includeIncidents: boolean;
}

// Mock function - will be replaced with actual API call when POP-023A is implemented
async function generateExportBundle(
  _config: ExportConfig,
): Promise<{ bundleId: string; downloadUrl: string }> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // For now, return mock data
  const bundleId = `bundle_${Date.now()}`;
  return {
    bundleId,
    downloadUrl: `#mock-download-${bundleId}`,
  };
}

export default function ExportPage() {
  const { isAdmin } = useAuth();
  const { organizationId, dataSourceLabel } = useDataSource();

  const [config, setConfig] = useState<ExportConfig>({
    scope: 'global',
    timeRange: '7d',
    includeAuditEvents: true,
    includeSupervisionReceipts: true,
    includeIncidents: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastExport, setLastExport] = useState<{ bundleId: string; timestamp: string } | null>(
    null,
  );

  // Only admins can access this page
  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Access Denied</p>
          <p className="text-muted-foreground text-sm">
            Only administrators can generate export bundles.
          </p>
        </div>
      </div>
    );
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const exportConfig = {
        ...config,
        organizationId: config.scope === 'organization' ? organizationId : undefined,
      };
      const result = await generateExportBundle(exportConfig);
      setLastExport({
        bundleId: result.bundleId,
        timestamp: new Date().toISOString(),
      });
      toast.success('Export bundle generated successfully');
      toast.info('Note: Backend endpoint (POP-023A) is pending. This is a preview.');
    } catch {
      toast.error('Failed to generate export bundle');
    } finally {
      setIsGenerating(false);
    }
  };

  const getTimeRangeDescription = () => {
    switch (config.timeRange) {
      case '24h':
        return 'Last 24 hours';
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
      case 'custom':
        return config.customFrom && config.customTo
          ? `${config.customFrom} to ${config.customTo}`
          : 'Custom range (specify dates)';
    }
  };

  const selectedOrg = organizationId ? { name: dataSourceLabel } : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export Bundle Generator</h1>
        <p className="text-muted-foreground text-sm">
          Generate data bundles for audits and compliance
        </p>
      </div>

      {/* Backend status notice */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="flex items-center gap-3 py-3">
          <HugeiconsIcon icon={InformationCircleIcon} className="text-blue-600 size-5" />
          <div className="flex-1">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
              Backend Endpoint Pending
            </p>
            <p className="text-blue-600 dark:text-blue-400 text-xs">
              Export API (POP-023A) is in development. This UI is ready and will work once the
              backend is deployed.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
          >
            Preview
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scope Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Export Scope</CardTitle>
              <CardDescription>Select the scope for the export bundle</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={config.scope}
                onValueChange={(value) => setConfig({ ...config, scope: value as ExportScope })}
                className="grid gap-4 md:grid-cols-2"
              >
                <Label
                  htmlFor="scope-global"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent [&:has([data-state=checked])]:border-primary"
                >
                  <RadioGroupItem value="global" id="scope-global" />
                  <div className="space-y-1">
                    <p className="font-medium">Global (All Organizations)</p>
                    <p className="text-muted-foreground text-sm">Data from all organizations</p>
                  </div>
                </Label>
                <Label
                  htmlFor="scope-org"
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent [&:has([data-state=checked])]:border-primary ${!organizationId ? 'opacity-50' : ''}`}
                >
                  <RadioGroupItem value="organization" id="scope-org" disabled={!organizationId} />
                  <div className="space-y-1">
                    <p className="font-medium">Selected Organization</p>
                    <p className="text-muted-foreground text-sm">
                      {selectedOrg ? selectedOrg.name : 'Select an org from header first'}
                    </p>
                  </div>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Time Range Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Time Range</CardTitle>
              <CardDescription>Select the time window for exported data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={config.timeRange}
                onValueChange={(value) => setConfig({ ...config, timeRange: value as TimeRange })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              {config.timeRange === 'custom' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="from-date">From</Label>
                    <Input
                      id="from-date"
                      type="date"
                      value={config.customFrom || ''}
                      onChange={(e) => setConfig({ ...config, customFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-date">To</Label>
                    <Input
                      id="to-date"
                      type="date"
                      value={config.customTo || ''}
                      onChange={(e) => setConfig({ ...config, customTo: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Bundle Contents</CardTitle>
              <CardDescription>Select which data to include in the export</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="font-medium">Audit Events</p>
                  <p className="text-muted-foreground text-sm">
                    Supervision decisions and system events
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.includeAuditEvents}
                  onChange={(e) => setConfig({ ...config, includeAuditEvents: e.target.checked })}
                  className="size-5 rounded"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="font-medium">Supervision Receipts</p>
                  <p className="text-muted-foreground text-sm">
                    Audit redaction summaries and trace references
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.includeSupervisionReceipts}
                  onChange={(e) =>
                    setConfig({ ...config, includeSupervisionReceipts: e.target.checked })
                  }
                  className="size-5 rounded"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="font-medium">Incident Summaries</p>
                  <p className="text-muted-foreground text-sm">
                    Safety incidents and safe-mode activations
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.includeIncidents}
                  onChange={(e) => setConfig({ ...config, includeIncidents: e.target.checked })}
                  className="size-5 rounded"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary & Actions */}
        <div className="space-y-6">
          {/* Export Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Export Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <HugeiconsIcon
                    icon={SecurityCheckIcon}
                    className="text-muted-foreground size-4"
                  />
                  <span className="text-muted-foreground">Scope:</span>
                  <span className="font-medium">
                    {config.scope === 'global'
                      ? 'All Organizations'
                      : selectedOrg?.name || 'Selected Org'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <HugeiconsIcon icon={Calendar03Icon} className="text-muted-foreground size-4" />
                  <span className="text-muted-foreground">Range:</span>
                  <span className="font-medium">{getTimeRangeDescription()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <HugeiconsIcon icon={FileZipIcon} className="text-muted-foreground size-4" />
                  <span className="text-muted-foreground">Files:</span>
                  <span className="font-medium">
                    {[
                      config.includeAuditEvents && 'audit',
                      config.includeSupervisionReceipts && 'receipts',
                      config.includeIncidents && 'incidents',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'none'}
                  </span>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={
                  isGenerating ||
                  (!config.includeAuditEvents &&
                    !config.includeSupervisionReceipts &&
                    !config.includeIncidents)
                }
              >
                {isGenerating ? (
                  <>
                    <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Download01Icon} className="size-4" />
                    Generate Bundle
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Last Export */}
          {lastExport && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Last Export</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bundle ID:</span>
                    <span className="font-mono text-xs">{lastExport.bundleId.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Generated:</span>
                    <span>{new Date(lastExport.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bundle Format Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Bundle Format</CardTitle>
              <CardDescription>GZIP compressed archive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  <code className="bg-muted rounded px-1">bundle_manifest.json</code> - Metadata
                </p>
                <p>
                  <code className="bg-muted rounded px-1">audit_events.jsonl</code> - Events
                </p>
                <p>
                  <code className="bg-muted rounded px-1">supervision_receipts.jsonl</code> -
                  Receipts
                </p>
                <p>
                  <code className="bg-muted rounded px-1">incidents.jsonl</code> - Incidents
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
