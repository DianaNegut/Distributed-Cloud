import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Server, 
  HardDrive, 
  DollarSign, 
  Award,
  Settings,
  Plus,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const ProviderPage = () => {
  const [providers, setProviders] = useState([]);
  const [myPeerId, setMyPeerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    peerId: '',
    name: '',
    description: '',
    totalCapacityGB: 50,
    location: '',
    pricePerGBPerMonth: 0.10,
    uptimeGuarantee: 95,
    discountThreeMonths: 5,
    discountSixMonths: 10,
    discountTwelveMonths: 20
  });

  useEffect(() => {
    loadProviders();
    loadMyPeerId();
  }, []);

  const loadMyPeerId = async () => {
    try {
      const response = await axios.get(`${API_URL}/status`, {
        headers: { 'x-api-key': API_KEY }
      });
      console.log('[PROVIDER] Peer ID response:', response.data);
      
      const peerId = response.data?.data?.ID || response.data?.id || response.data?.peerId;
      
      if (peerId) {
        setMyPeerId(peerId);
        setRegisterForm(prev => ({ ...prev, peerId: peerId }));
      }
    } catch (error) {
      console.error('Error loading peer ID:', error);
    }
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/storage-providers`, {
        headers: { 'x-api-key': API_KEY }
      });
      setProviders(response.data.providers || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.peerId || !registerForm.name || !registerForm.totalCapacityGB) {
      alert('Te rog completează toate câmpurile obligatorii!');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/storage-providers/register`, {
        ...registerForm,
        totalCapacityGB: parseFloat(registerForm.totalCapacityGB),
        pricePerGBPerMonth: parseFloat(registerForm.pricePerGBPerMonth),
        uptimeGuarantee: parseFloat(registerForm.uptimeGuarantee)
      }, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        alert(`Provider înregistrat cu succes! ID: ${response.data.provider.id}`);
        setShowRegisterModal(false);
        loadProviders();
        setRegisterForm({
          peerId: myPeerId,
          name: '',
          description: '',
          totalCapacityGB: 50,
          location: '',
          pricePerGBPerMonth: 0.10,
          uptimeGuarantee: 95,
          discountThreeMonths: 5,
          discountSixMonths: 10,
          discountTwelveMonths: 20
        });
      }
    } catch (error) {
      alert('Eroare la înregistrarea providerului: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteProvider = async (providerId) => {
    if (!window.confirm('Ești sigur că vrei să ștergi acest provider?')) return;

    try {
      await axios.delete(`${API_URL}/storage-providers/${providerId}`, {
        headers: { 'x-api-key': API_KEY }
      });
      alert('Provider șters cu succes!');
      loadProviders();
    } catch (error) {
      alert('Eroare: ' + (error.response?.data?.error || error.message));
    }
  };

  const myProviders = providers.filter(p => p.peerId === myPeerId);
  const totalEarnings = myProviders.reduce((sum, p) => sum + (p.earnings?.totalEarned || 0), 0);
  const totalCapacity = myProviders.reduce((sum, p) => sum + p.capacity.totalGB, 0);
  const totalUsed = myProviders.reduce((sum, p) => sum + p.capacity.usedGB, 0);
  const activeContracts = myProviders.reduce((sum, p) => sum + p.statistics.activeContracts, 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">Se încarcă...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Provider Dashboard</h1>
              <p className="text-gray-400">Oferă spațiu de stocare și câștigă bani</p>
            </div>
            <Button variant="primary" onClick={() => setShowRegisterModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Înregistrează-te ca Provider
            </Button>
          </div>
        </motion.div>

        {myProviders.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Venit Total"
                value={`$${totalEarnings.toFixed(2)}`}
                icon={DollarSign}
                color="success"
              />
              <StatCard
                title="Capacitate Totală"
                value={`${totalCapacity.toFixed(0)} GB`}
                icon={HardDrive}
                color="primary"
              />
              <StatCard
                title="Spațiu Utilizat"
                value={`${totalUsed.toFixed(1)} GB`}
                icon={Server}
                color="warning"
              />
              <StatCard
                title="Contracte Active"
                value={activeContracts}
                icon={Award}
                color="info"
              />
            </div>

            {/* My Providers */}
            <h2 className="text-2xl font-bold text-white mb-4">Providerii Tăi</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {myProviders.map((provider) => (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                            <Server className="w-6 h-6 text-primary-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                            <p className="text-gray-400 text-sm">{provider.metadata.location}</p>
                          </div>
                        </div>
                        <Badge variant={provider.status === 'active' ? 'success' : 'warning'}>
                          {provider.status}
                        </Badge>
                      </div>

                      {provider.description && (
                        <p className="text-gray-400 text-sm mb-4">{provider.description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 bg-dark-800/50 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Capacitate</p>
                          <p className="text-white font-bold">
                            {provider.capacity.totalGB} GB
                          </p>
                          <p className="text-xs text-gray-500">
                            {provider.capacity.availableGB.toFixed(1)} GB disponibil
                          </p>
                        </div>
                        <div className="p-3 bg-dark-800/50 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Preț</p>
                          <p className="text-green-400 font-bold">
                            ${provider.pricing?.pricePerGBPerMonth || 0.10}
                          </p>
                          <p className="text-xs text-gray-500">per GB/lună</p>
                        </div>
                        <div className="p-3 bg-dark-800/50 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Venit Total</p>
                          <p className="text-green-400 font-bold">
                            ${(provider.earnings?.totalEarned || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="p-3 bg-dark-800/50 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Contracte</p>
                          <p className="text-white font-bold">
                            {provider.statistics.activeContracts}
                          </p>
                          <p className="text-xs text-gray-500">active</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Utilizare storage</span>
                          <span className="text-white">
                            {((provider.capacity.usedGB / provider.capacity.totalGB) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-dark-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full"
                            style={{ width: `${(provider.capacity.usedGB / provider.capacity.totalGB) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteProvider(provider.id)}
                          disabled={provider.statistics.activeContracts > 0}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Șterge
                        </Button>
                        <Button variant="secondary" size="sm" disabled>
                          <Settings className="w-4 h-4 mr-2" />
                          Configurare
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {myProviders.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Server className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-bold text-white mb-2">Nu ești încă provider</h3>
                <p className="text-gray-400 mb-6">
                  Înregistrează-te ca provider pentru a oferi spațiu de stocare și a câștiga bani
                </p>
                <Button variant="primary" onClick={() => setShowRegisterModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Înregistrează-te acum
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Register Modal */}
        {showRegisterModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-dark-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                Înregistrează-te ca Storage Provider
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-gray-400 mb-2">Peer ID * {myPeerId ? '(auto-completat)' : '(se încarcă...)'}</label>
                  <Input
                    value={registerForm.peerId}
                    onChange={(e) => setRegisterForm({ ...registerForm, peerId: e.target.value })}
                    placeholder="QmXxxx... sau introdu manual"
                  />
                  {myPeerId && (
                    <p className="text-xs text-green-400 mt-1">✓ Peer ID detectat automat</p>
                  )}
                  {!myPeerId && (
                    <p className="text-xs text-yellow-400 mt-1">Asigură-te că backend-ul rulează și că IPFS este activ</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-400 mb-2">Nume Provider *</label>
                  <Input
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    placeholder="Ex: FastStorage Pro"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-400 mb-2">Descriere</label>
                  <textarea
                    value={registerForm.description}
                    onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                    placeholder="Descriere scurtă despre serviciul tău..."
                    className="w-full bg-dark-700 text-white px-4 py-2 rounded-lg border border-dark-600"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Capacitate Totală (GB) *</label>
                  <Input
                    type="number"
                    value={registerForm.totalCapacityGB}
                    onChange={(e) => setRegisterForm({ ...registerForm, totalCapacityGB: e.target.value })}
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Locație</label>
                  <Input
                    value={registerForm.location}
                    onChange={(e) => setRegisterForm({ ...registerForm, location: e.target.value })}
                    placeholder="Ex: București, Romania"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Preț ($/GB/lună) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={registerForm.pricePerGBPerMonth}
                    onChange={(e) => setRegisterForm({ ...registerForm, pricePerGBPerMonth: e.target.value })}
                    min="0.01"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Uptime Garantat (%)</label>
                  <Input
                    type="number"
                    value={registerForm.uptimeGuarantee}
                    onChange={(e) => setRegisterForm({ ...registerForm, uptimeGuarantee: e.target.value })}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="md:col-span-2 p-4 bg-dark-700/50 rounded-lg">
                  <h3 className="text-white font-bold mb-3">Reduceri pentru contracte pe termen lung</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">3 luni (%)</label>
                      <Input
                        type="number"
                        value={registerForm.discountThreeMonths}
                        onChange={(e) => setRegisterForm({ ...registerForm, discountThreeMonths: e.target.value })}
                        min="0"
                        max="50"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">6 luni (%)</label>
                      <Input
                        type="number"
                        value={registerForm.discountSixMonths}
                        onChange={(e) => setRegisterForm({ ...registerForm, discountSixMonths: e.target.value })}
                        min="0"
                        max="50"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">12 luni (%)</label>
                      <Input
                        type="number"
                        value={registerForm.discountTwelveMonths}
                        onChange={(e) => setRegisterForm({ ...registerForm, discountTwelveMonths: e.target.value })}
                        min="0"
                        max="50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowRegisterModal(false)}
                >
                  Anulează
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleRegister}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Înregistrează Provider
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderPage;
