import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, API_BASE } from '../api/client';

interface BackendContextType {
  isOnline: boolean;
  isWaking: boolean;
  error: string | null;
  stateVersion: number;
  retry: () => Promise<void>;
  eventTicker: number;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export const BackendProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isWaking, setIsWaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stateVersion, setStateVersion] = useState<number>(1);
  const [eventTicker, setEventTicker] = useState<number>(0);

  const checkConnectivity = useCallback(async () => {
    try {
      setIsWaking(true);
      const res = await api.checkHealth();
      setIsOnline(true);
      setError(null);
      setStateVersion(res.state_version);
    } catch (err: any) {
      setIsOnline(false);
      setError(err.message || 'Backend offline or waking up');
    } finally {
      setIsWaking(false);
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkConnectivity();
  }, [checkConnectivity]);

  // Setup SSE stream with 1-second polling fallback
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;
    let sseActive = false;

    const startSSE = () => {
      try {
        const url = `${API_BASE.replace(/\/$/, '')}/api/events`;
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          sseActive = true;
          setIsOnline(true);
          setError(null);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.version) {
              setStateVersion(data.version);
            }
            setEventTicker((prev) => prev + 1);
          } catch {
            // ignore heartbeat
          }
        };

        eventSource.onerror = () => {
          sseActive = false;
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startPollingFallback();
        };
      } catch {
        startPollingFallback();
      }
    };

    const startPollingFallback = () => {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        try {
          const v = await api.getStateVersion();
          setIsOnline(true);
          setError(null);
          setStateVersion((prev) => {
            if (prev !== v.version) {
              setEventTicker((t) => t + 1);
              return v.version;
            }
            return prev;
          });
        } catch {
          setIsOnline(false);
          setError('Backend offline or waking up');
        }
      }, 1000);
    };

    startSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  return (
    <BackendContext.Provider
      value={{
        isOnline,
        isWaking,
        error,
        stateVersion,
        retry: checkConnectivity,
        eventTicker
      }}
    >
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = (): BackendContextType => {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error('useBackend must be used within a BackendProvider');
  }
  return context;
};
