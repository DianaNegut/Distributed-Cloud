import { useState } from 'react';

export function useLogs() {
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { message, type, timestamp }]);
  };

  const clearLogs = () => setLogs([]);

  return { logs, addLog, clearLogs };
}
