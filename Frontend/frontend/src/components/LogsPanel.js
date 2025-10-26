import { AlertCircle } from 'lucide-react';

export default function LogsPanel({ logs }) {
  return (
    <div className="panel" style={{ marginTop: '24px' }}>
      <h2 className="panel-title">
        <AlertCircle /> Log Execuție
      </h2>
      <div className="logs-container">
        {logs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.type}`}>
            <span className="log-timestamp">[{log.timestamp}]</span> {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
