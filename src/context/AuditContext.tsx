
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { AuditLog, User } from '@/lib/types';
import { getAuditLogsAction, logActionAction } from '@/app/actions/audit';

interface AuditContextType {
  auditLogs: AuditLog[];
  logAction: (action: string, details: string, user: User | null) => void;
  isLoading: boolean;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider = ({ children }: { children: ReactNode }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isPolling = useRef(true);

  const fetchLogs = useCallback(async () => {
    try {
      const result = await getAuditLogsAction();
      if (result.success && result.data) {
        setAuditLogs(result.data);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();

    const intervalId = setInterval(() => {
      if (isPolling.current) fetchLogs();
    }, 15000);

    return () => {
      clearInterval(intervalId);
      isPolling.current = false;
    };
  }, [fetchLogs]);


  const logAction = useCallback(async (action: string, details: string, user: User | null) => {
    if (!user) return;

    // Optimistic update (optional, but might be tricky without ID, so maybe just fire and forget)
    // We'll let polling pick it up or push it locally if we want instant feedback.

    try {
      const result = await logActionAction(action, details, user);
      if (result.success) {
        // fetchLogs(); // Refresh logs immediately
      }
    } catch (error) {
      console.error("Error writing audit log:", error);
    }
  }, []);

  return (
    <AuditContext.Provider value={{ auditLogs, logAction, isLoading }}>
      {children}
    </AuditContext.Provider>
  );
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};

