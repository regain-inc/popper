import type { ReactNode } from 'react';
import { ComplianceLayout } from '@/components/layout/compliance-layout';

export default function ComplianceRootLayout({ children }: { children: ReactNode }) {
  return <ComplianceLayout>{children}</ComplianceLayout>;
}
