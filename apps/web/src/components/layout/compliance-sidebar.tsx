'use client';

import {
  AlertCircleIcon,
  Analytics01Icon,
  FileSearchIcon,
  FileZipIcon,
  FlowIcon,
  ShieldKeyIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const navigation = [
  {
    name: 'Overview',
    href: '/compliance',
    icon: Analytics01Icon,
    description: 'Aggregated system metrics',
  },
  {
    name: 'Audit Log',
    href: '/compliance/audit',
    icon: FileSearchIcon,
    description: 'De-identified decision history',
  },
  {
    name: 'Safe-Mode History',
    href: '/compliance/safe-mode',
    icon: ShieldKeyIcon,
    description: 'Safety control history',
  },
  {
    name: 'Drift Signals',
    href: '/compliance/drift',
    icon: FlowIcon,
    description: 'Anomaly detection signals',
  },
  {
    name: 'Incidents',
    href: '/compliance/incidents',
    icon: AlertCircleIcon,
    description: 'Safety incidents history',
  },
  {
    name: 'Export Bundle',
    href: '/compliance/export',
    icon: FileZipIcon,
    description: 'Generate compliance exports',
  },
];

interface NavItemProps {
  item: (typeof navigation)[0];
  isActive: boolean;
  collapsed?: boolean;
}

function NavItem({ item, isActive, collapsed }: NavItemProps) {
  const content = (
    <Link
      href={item.href as Route}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <HugeiconsIcon
        icon={item.icon}
        className={cn(
          'size-5 shrink-0 transition-transform group-hover:scale-105',
          isActive
            ? 'text-primary-foreground'
            : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex flex-col gap-1">
          <span className="font-medium">{item.name}</span>
          <span className="text-muted-foreground text-xs">{item.description}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface ComplianceSidebarProps {
  collapsed?: boolean;
}

export function ComplianceSidebar({ collapsed = false }: ComplianceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'bg-sidebar border-sidebar-border flex h-full flex-col border-r transition-all duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo */}
      <div
        className={cn('flex h-14 items-center border-b px-4', collapsed && 'justify-center px-2')}
      >
        <Link href={'/compliance' as Route} className="flex items-center gap-2">
          <div className="bg-amber-600 text-white flex size-8 items-center justify-center rounded-lg font-bold">
            C
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-tight">
                TA2 Supervisory Agent
              </span>
              <span className="text-muted-foreground text-[10px] leading-tight">
                Regain Popper<sup className="text-[7px] font-normal ml-0.5">TM</sup>
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={
              item.href === '/compliance'
                ? pathname === '/compliance'
                : pathname.startsWith(item.href)
            }
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Compliance badge */}
      {!collapsed && (
        <div className="border-t p-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 rounded-lg border p-3">
            <p className="text-amber-800 dark:text-amber-200 text-xs font-medium">
              Read-Only Access
            </p>
            <p className="text-amber-600 dark:text-amber-400 mt-1 text-xs">
              All data is de-identified for regulatory compliance.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
