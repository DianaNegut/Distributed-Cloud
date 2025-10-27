// Frontend/frontend/src/components/ClusterPanel.js
import React, { useState, useEffect, useCallback } from 'react';
import ipfsApi from '../api/ipfsApi'; // Importă funcțiile API

function ClusterPanel() {
  const [peers, setPeers] = useState([]);
  const [newPeerId, setNewPeerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Funcție pentru a reîncărca lista de peers
  const fetchPeers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const clusterPeers = await ipfsApi.getClusterPeers();
      // Răspunsul din backend pare să fie un obiect cu cheia 'peers' care conține un array de string-uri
      // sau un array direct. Ajustează în funcție de structura exactă returnată.
      // Presupunând că e un array de string-uri:
      setPeers(Array.isArray(clusterPeers) ? clusterPeers : []);
    } catch (err) {
      setError('Failed to fetch cluster peers.');
      console.error(err);
      setPeers([]); // Resetează peers în caz de eroare
    } finally {
      setLoading(false);
    }
  }, []);

  // Încarcă peers la montarea componentei
  useEffect(() => {
    fetchPeers();
  }, [fetchPeers]);

  const handleAddPeer = async (e) => {
    e.preventDefault(); // Previne reîncărcarea paginii la submit-ul formularului
    if (!newPeerId.trim()) return; // Nu adăuga peerId gol

    setLoading(true);
    setError(null);
    try {
      await ipfsApi.addClusterPeer(newPeerId);
      setNewPeerId(''); // Golește inputul
      fetchPeers(); // Reîncarcă lista după adăugare
    } catch (err) {
      setError(`Failed to add peer ${newPeerId}.`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePeer = async (peerIdToRemove) => {
    setLoading(true);
    setError(null);
    try {
      await ipfsApi.removeClusterPeer(peerIdToRemove);
      fetchPeers(); // Reîncarcă lista după ștergere
    } catch (err) {
      setError(`Failed to remove peer ${peerIdToRemove}.`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel cluster-panel">
      <h2>IPFS Cluster Peers</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {loading && <p>Loading...</p>}

      {/* Formular pentru adăugare peer */}
      <form onSubmit={handleAddPeer} style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={newPeerId}
          onChange={(e) => setNewPeerId(e.target.value)}
          placeholder="Enter Peer ID to add"
          disabled={loading}
          style={{ marginRight: '10px' }}
        />
        <button type="submit" disabled={loading || !newPeerId.trim()}>
          Add Peer
        </button>
      </form>

      {/* Lista de peers */}
      {peers.length > 0 ? (
        <ul>
          {peers.map((peer) => (
            <li key={peer}>
              {peer}
              <button
                onClick={() => handleRemovePeer(peer)}
                disabled={loading}
                style={{ marginLeft: '10px', color: 'red', cursor: 'pointer' }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !loading && <p>No peers found in the cluster.</p>
      )}

       <button onClick={fetchPeers} disabled={loading} style={{ marginTop: '10px' }}>
          Refresh List
       </button>
    </div>
  );
}

export default ClusterPanel;