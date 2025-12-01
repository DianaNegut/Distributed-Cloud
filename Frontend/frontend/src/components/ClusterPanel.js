import React, { useState, useEffect, useCallback } from 'react';
import ipfsApi from '../api/ipfsApi';

function ClusterPanel() {
  const [peers, setPeers] = useState([]);
  const [newPeerId, setNewPeerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPeers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const clusterPeers = await ipfsApi.getClusterPeers();
      setPeers(Array.isArray(clusterPeers) ? clusterPeers : []);
    } catch (err) {
      setError('Failed to fetch cluster peers.');
      setPeers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeers();
  }, [fetchPeers]);

  const handleAddPeer = async (e) => {
    e.preventDefault();
    if (!newPeerId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await ipfsApi.addClusterPeer(newPeerId);
      setNewPeerId('');
      fetchPeers();
    } catch (err) {
      setError(`Failed to add peer ${newPeerId}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePeer = async (peerIdToRemove) => {
    setLoading(true);
    setError(null);
    try {
      await ipfsApi.removeClusterPeer(peerIdToRemove);
      fetchPeers();
    } catch (err) {
      setError(`Failed to remove peer ${peerIdToRemove}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel cluster-panel">
      <h2>IPFS Cluster Peers</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {loading && <p>Loading...</p>}

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