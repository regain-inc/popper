'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDataSource } from '@/hooks/use-data-source';

export default function BenchLayout({ children }: { children: React.ReactNode }) {
  const { isBench } = useDataSource();
  const router = useRouter();

  useEffect(() => {
    if (!isBench) router.push('/');
  }, [isBench, router]);

  if (!isBench) return null;
  return <>{children}</>;
}
