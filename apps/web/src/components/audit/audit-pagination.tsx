'use client';

import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';

interface AuditPaginationProps {
  total: number;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
}

export function AuditPagination({ total, offset, limit, onOffsetChange }: AuditPaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startItem = offset + 1;
  const endItem = Math.min(offset + limit, total);

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-sm">
        Showing {formatNumber(startItem)}-{formatNumber(endItem)} of {formatNumber(total)}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOffsetChange(offset - limit)}
          disabled={!hasPrev}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 size-4" />
          Prev
        </Button>

        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <span>Page</span>
          <span className="text-foreground font-medium">{currentPage}</span>
          <span>of</span>
          <span>{totalPages}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onOffsetChange(offset + limit)}
          disabled={!hasNext}
        >
          Next
          <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}
