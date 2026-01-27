'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';

interface OrganizationContextType {
  selectedOrgId: string | null;
  setSelectedOrgId: (orgId: string | null) => void;
  organizations: Array<{ id: string; name: string }>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Mock organizations - in production, fetch from API
  const organizations = [
    { id: 'org_regain', name: 'Regain Health' },
    { id: 'org_demo', name: 'Demo Organization' },
  ];

  return (
    <OrganizationContext.Provider value={{ selectedOrgId, setSelectedOrgId, organizations }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
