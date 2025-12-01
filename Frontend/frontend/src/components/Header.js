import { Network } from 'lucide-react';

export default function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <Network className="header-icon" />
        <div>
          <h1 className="header-title">IPFS Private Network Manager</h1>
          <p className="header-subtitle">
            Configureaza si gestioneaza reteaua ta privata IPFS
          </p>
        </div>
      </div>
    </header>
  );
}
