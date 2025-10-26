import { Key } from 'lucide-react';
export default function ConfigPanel({ swarmKey, bootstrapNode, onCopy }) {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <Key />
        Configurare Swarm Key
      </h2>

      <div className="form-group">
        <label>Swarm Key (hex)</label>
        <input
          type="text"
          value={swarmKey}
          className="form-input"
          readOnly
         
        />
      </div>

      <div className="form-group">
        <label>Bootstrap Node</label>
        <input
          type="text"
          value={bootstrapNode}
          className="form-input"
          readOnly 
     
        />
      </div>

      <button onClick={onCopy} className="btn btn-secondary">
        Copiază Swarm Key
      </button>
    </div>
  );
}