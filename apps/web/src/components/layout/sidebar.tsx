'use client';

import {
  AlertCircleIcon,
  ArrowUpRight01Icon,
  BarChartIcon,
  DashboardSquare02Icon,
  FileSearchIcon,
  FileZipIcon,
  FlowIcon,
  PlayIcon,
  SecurityCheckIcon,
  Settings01Icon,
  ShieldKeyIcon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useDataSource } from '@/hooks/use-data-source';
import { cn } from '@/lib/utils';

const navigation = [
  {
    name: 'Status',
    href: '/',
    icon: DashboardSquare02Icon,
    description: 'System health and metrics',
  },
  {
    name: 'Audit Log',
    href: '/audit',
    icon: FileSearchIcon,
    description: 'Decision history',
  },
  {
    name: 'Safe-Mode',
    href: '/safe-mode',
    icon: ShieldKeyIcon,
    description: 'Safety controls',
  },
  {
    name: 'Drift Signals',
    href: '/drift',
    icon: FlowIcon,
    description: 'Anomaly detection',
  },
  {
    name: 'Incidents',
    href: '/incidents',
    icon: AlertCircleIcon,
    description: 'Safety incidents',
  },
];

const benchNavigation = [
  {
    name: 'Bench Runs',
    href: '/bench/runs',
    icon: PlayIcon,
    description: 'Validation run history',
  },
  {
    name: 'Bench Analytics',
    href: '/bench/analytics',
    icon: BarChartIcon,
    description: 'Trends and readiness',
  },
];

const bottomNavigation = [
  {
    name: 'User management',
    href: '/settings/users',
    icon: UserMultipleIcon,
    description: 'User management',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings01Icon,
    description: 'Configuration',
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

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { isBench } = useDataSource();

  const exportNavItem = {
    name: 'Export Bundle',
    href: '/export',
    icon: FileZipIcon,
    description: 'Generate data exports',
  };

  const complianceNavItem = {
    name: 'Compliance',
    href: '/compliance',
    icon: SecurityCheckIcon,
    description: 'Regulatory compliance view',
  };

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
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg font-bold">
            P
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
            isActive={pathname === item.href}
            collapsed={collapsed}
          />
        ))}

        {/* Bench section - shown only when bench data source is selected */}
        {isBench && (
          <>
            <Separator className="my-2" />
            {!collapsed && (
              <p className="text-muted-foreground px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider">
                Bench
              </p>
            )}
            {benchNavigation.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
            {/* External link to full bench dashboard */}
            <a
              href="https://bench.regain.ai"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                className="text-muted-foreground group-hover:text-foreground size-5 shrink-0 transition-transform group-hover:scale-105"
              />
              {!collapsed && <span>Full Dashboard</span>}
            </a>
          </>
        )}
      </nav>

      {/* Admin-only links: Export and Compliance */}
      {isAdmin && (
        <>
          <Separator />
          <nav className="space-y-1 p-2">
            <NavItem item={exportNavItem} isActive={pathname === '/export'} collapsed={collapsed} />
            <NavItem
              item={complianceNavItem}
              isActive={pathname.startsWith('/compliance')}
              collapsed={collapsed}
            />
          </nav>
        </>
      )}

      <Separator />

      {/* Bottom navigation */}
      <nav className="space-y-1 p-2">
        {bottomNavigation.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={
              pathname === item.href ||
              (item.href === '/settings' &&
                pathname.startsWith('/settings') &&
                pathname !== '/settings/users')
            }
            collapsed={collapsed}
          />
        ))}
      </nav>
    </aside>
  );
}
