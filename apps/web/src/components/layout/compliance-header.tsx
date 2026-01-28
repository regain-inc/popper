'use client';

import { Logout02Icon, SecurityCheckIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';

export function ComplianceHeader() {
  const { user, logout } = useAuth();

  // Get initials from user name
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4 backdrop-blur">
      <div className="flex items-center gap-4">
        {/* Global View Badge */}
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={SecurityCheckIcon} className="text-amber-600 size-4" />
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
          >
            Global Aggregated View
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* De-identified indicator */}
        <div className="hidden items-center gap-2 text-sm sm:flex">
          <div className="bg-amber-500 size-2 rounded-full" />
          <span className="text-muted-foreground">De-identified Data</span>
        </div>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="size-9">
                <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                <p className="text-muted-foreground text-xs leading-none">{user?.email}</p>
                <Badge variant="secondary" className="mt-2 w-fit text-xs">
                  Compliance Role
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => logout()}>
              <HugeiconsIcon icon={Logout02Icon} className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
