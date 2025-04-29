'use client';

import { useState, useEffect } from 'react';
import { checkHealth } from '../api';

export default function ApiStatus() {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        await checkHealth();
        setStatus('online');
        setError(null);
      } catch (err) {
        setStatus('offline');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 p-2 rounded-md shadow-md bg-white">
      <div className="flex items-center space-x-2">
        <div
          className={`w-3 h-3 rounded-full ${
            status === 'online'
              ? 'bg-green-500'
              : status === 'offline'
              ? 'bg-red-500'
              : 'bg-yellow-500'
          }`}
        />
        <span className="text-sm font-medium">
          {status === 'online'
            ? 'Backend Online'
            : status === 'offline'
            ? 'Backend Offline'
            : 'Checking Backend...'}
        </span>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
} 