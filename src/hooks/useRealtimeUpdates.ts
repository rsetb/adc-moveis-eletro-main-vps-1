'use client';

import { useEffect, useRef } from 'react';
import type { ChangeKey } from '@/lib/change-notifier';

type Snapshot = Record<ChangeKey, number>;
type ChangeHandler = (changed: ChangeKey[]) => void;

export function useRealtimeUpdates(onChanges: ChangeHandler) {
  const handlerRef = useRef(onChanges);
  handlerRef.current = onChanges;

  useEffect(() => {
    let lastSnapshot: Snapshot | null = null;

    const connect = () => {
      const source = new EventSource('/api/stream');

      source.onmessage = (e) => {
        try {
          const snapshot: Snapshot = JSON.parse(e.data);

          if (!lastSnapshot) {
            lastSnapshot = snapshot;
            return;
          }

          const changed = (Object.keys(snapshot) as ChangeKey[]).filter(
            (k) => snapshot[k] !== lastSnapshot![k]
          );

          if (changed.length > 0) {
            lastSnapshot = snapshot;
            handlerRef.current(changed);
          }
        } catch {
          // ignore malformed messages
        }
      };

      source.onerror = () => {
        source.close();
        // Auto-reconnect after 3s
        setTimeout(connect, 3000);
      };

      return source;
    };

    const source = connect();
    return () => source.close();
  }, []);
}
