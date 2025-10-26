import { Users } from 'lucide-react';

export default function PeersPanel({ peers }) {
  return (
    <div className="panel" style={{ marginTop: '24px' }}>
      <h2 className="panel-title">
        <Users /> Peers Conectați ({peers.length})
      </h2>
      <div className="peers-container">
        {peers.map((peer, index) => (
          <div key={index} className="peer-item">
            {peer}
          </div>
        ))}
      </div>
    </div>
  );
}
