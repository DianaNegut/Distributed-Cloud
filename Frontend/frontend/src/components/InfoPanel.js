import { Shield, CheckCircle } from 'lucide-react';

export default function InfoPanel() {
  const steps = [
    ['Copiere swarm.key', 'Cheia secreta pentru reteaua privata'],
    ['Dezactivare AutoConf & AutoTLS', 'Izolare de reteaua publica IPFS'],
    ['Activare DHT Routing', 'Descoperire peer-uri in retea'],
    ['Stergere servicii externe', 'Routing si publishing doar intern'],
    ['Configurare Bootstrap', 'Adauga doar nodurile tale'],
  ];

  return (
    <div className="panel">
      <h2 className="panel-title">
        <Shield />
        Ce face configurarea?
      </h2>
      <ul className="info-list">
        {steps.map(([title, desc], i) => (
          <li key={i} className="info-item">
            <CheckCircle />
            <div>
              <div className="info-item-title">{title}</div>
              <div className="info-item-desc">{desc}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
