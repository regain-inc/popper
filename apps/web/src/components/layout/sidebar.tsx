'use client';

import {
  DashboardSquare02Icon,
  FileSearchIcon,
  Settings01Icon,
  ShieldKeyIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
];

const bottomNavigation = [
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
          {!collapsed && <span className="text-lg font-semibold tracking-tight">Popper</span>}
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
      </nav>

      <Separator />

      {/* Bottom navigation */}
      <nav className="space-y-1 p-2">
        {bottomNavigation.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </aside>
  );
}
