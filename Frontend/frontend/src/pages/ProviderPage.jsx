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
  CheckCircle,
  Coins,
  BarChart3,
  Shield,
  Download,
  Link,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import LocationAutocomplete from '../components/ui/LocationAutocomplete';
import ProviderAnalytics from '../components/analytics/ProviderAnalytics';
import BackupManager from '../components/backup/BackupManager';
import axios from 'axios';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const ProviderPage = () => {
  const { user, sessionToken } = useAuth();
  const { balance: walletBalance } = useWallet();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [activeTab, setActiveTab] = useState('providers'); // providers, analytics, backup
  const [registerForm, setRegisterForm] = useState({
    name: '',
    description: '',
    totalCapacityGB: 50,
    location: '',
    pricePerGBPerMonth: 0.10
  });

  // Get balance from wallet hook
  const filBalance = walletBalance?.formatted ? parseFloat(walletBalance.formatted) : null;
  const walletLoading = false; // Managed by WalletContext

  useEffect(() => {
    loadProviders();
  }, [user]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/storage-providers`, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      setProviders(response.data.providers || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funcție pentru descărcarea config-ului ProviderAgent
  const downloadProviderConfig = (provider) => {
    const config = {
      BACKEND_URL: API_URL,
      PROVIDER_TOKEN: provider.providerToken,
      PROVIDER_USERNAME: provider.peerId,
      API_KEY: API_KEY,
      // Instrucțiuni
      _instructions: 'Copiază acest fișier în folderul ProviderAgent și rulează: npm start'
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'provider-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Magic Link - deschide ProviderAgent setup direct în browser
  const openMagicLink = (provider) => {
    if (!provider.providerToken) {
      alert('Token-ul nu este disponibil. Te rog reînregistrează provider-ul.');
      return;
    }

    const magicUrl = `http://localhost:4000/setup?token=${provider.providerToken}`;

    // Deschide într-o fereastră nouă
    const popup = window.open(magicUrl, 'ProviderSetup', 'width=700,height=500');

    if (!popup) {
      // Dacă popup-ul e blocat, copiază link-ul în clipboard
      navigator.clipboard.writeText(magicUrl).then(() => {
        alert(
          'Link-ul a fost copiat \u00een clipboard!\n\n' +
          'Asigur\u0103-te c\u0103 ProviderAgent ruleaz\u0103 (npm start), apoi lipesc link-ul \u00een browser.'
        );
      });
    }
  };

  const handleRegister = async () => {
    if (!user || !registerForm.name || !registerForm.totalCapacityGB) {
      alert('Te rog completează toate câmpurile obligatorii!');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/storage-providers/register`, {
        ...registerForm,
        peerId: user.username,
        totalCapacityGB: parseFloat(registerForm.totalCapacityGB),
        pricePerGBPerMonth: parseFloat(registerForm.pricePerGBPerMonth)
      }, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });

      if (response.data.success) {
        alert(
          `✅ Provider înregistrat cu succes!\n\n` +
          `Pentru a porni ProviderAgent:\n` +
          `1. Pornește ProviderAgent (npm start)\n` +
          `2. Apasă butonul "Setup" de lângă provider-ul tău`
        );

        setShowRegisterModal(false);
        loadProviders();
        setRegisterForm({
          name: '',
          description: '',
          totalCapacityGB: 50,
          location: '',
          pricePerGBPerMonth: 0.10
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
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      alert('Provider șters cu succes!');
      loadProviders();
    } catch (error) {
      alert('Eroare: ' + (error.response?.data?.error || error.message));
    }
  };

  const myProviders = user ? providers.filter(p => p.peerId === user.username) : [];
  const totalEarnings = myProviders.reduce((sum, p) => sum + (p.earnings?.totalEarned || 0), 0);
  const totalCapacity = myProviders.reduce((sum, p) => sum + p.capacity.totalGB, 0);
  const totalUsed = myProviders.reduce((sum, p) => sum + p.capacity.usedGB, 0);
  const activeContracts = myProviders.reduce((sum, p) => sum + p.statistics.activeContracts, 0);
  const isAlreadyProvider = myProviders.length > 0;

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
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('providers')}
            className={`px-4 py-3 font-medium transition-colors ${activeTab === 'providers'
              ? 'text-purple-500 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <div className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <span>Provideri</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-3 font-medium transition-colors ${activeTab === 'analytics'
              ? 'text-purple-500 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Analytics</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-3 font-medium transition-colors ${activeTab === 'backup'
              ? 'text-purple-500 border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Backup & Recovery</span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'providers' && (
          <div>

            {myProviders.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
                  <StatCard
                    title="Venit Total"
                    value={`${totalEarnings.toFixed(6)} FIL`}
                    icon={Coins}
                    color="success"
                  />
                  <StatCard
                    title="Wallet FIL"
                    value={walletLoading ? 'Se încarcă...' : `${(filBalance || 0).toFixed(6)} FIL`}
                    icon={DollarSign}
                    color="purple"
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

                            {/* Warning dacă spațiu disponibil < 10% */}
                            {provider.capacity.availableGB < (provider.capacity.totalGB * 0.1) && (
                              <div className="col-span-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                                <div>
                                  <p className="text-yellow-400 text-sm font-medium">
                                    Spațiu de stocare scăzut!
                                  </p>
                                  <p className="text-yellow-500/70 text-xs">
                                    Mai ai doar {provider.capacity.availableGB.toFixed(1)} GB din {provider.capacity.totalGB} GB ({((provider.capacity.availableGB / provider.capacity.totalGB) * 100).toFixed(0)}%)
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="p-3 bg-dark-800/50 rounded-lg">
                              <p className="text-gray-400 text-xs mb-1">Preț</p>
                              <div className="flex items-center gap-1">
                                <Coins className="w-4 h-4 text-green-400" />
                                <p className="text-green-400 font-bold">
                                  {(provider.pricing?.pricePerGBPerMonth || 0.10).toFixed(6)}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500">FIL per GB/lună</p>
                            </div>
                            <div className="p-3 bg-dark-800/50 rounded-lg">
                              <p className="text-gray-400 text-xs mb-1">Venit Total</p>
                              <div className="flex items-center gap-1">
                                <Coins className="w-4 h-4 text-green-400" />
                                <p className="text-green-400 font-bold">
                                  {(provider.earnings?.totalEarned || 0).toFixed(6)}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500">FIL câștigat</p>
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

                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openMagicLink(provider)}
                              title="Setup automat - deschide link în browser (ProviderAgent trebuie să ruleze)"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Setup
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => downloadProviderConfig(provider)}
                              title="Descărcă fișierul de config manual"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Config
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => deleteProvider(provider.id)}
                              disabled={provider.statistics.activeContracts > 0}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Șterge
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
                      <label className="block text-gray-400 mb-2">Username *</label>
                      <Input
                        value={user?.username || ''}
                        disabled
                        className="bg-dark-700"
                      />
                      <p className="text-xs text-green-400 mt-1">✓ Vei fi înregistrat ca provider cu username-ul tău</p>
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
                      <LocationAutocomplete
                        value={registerForm.location}
                        onChange={(value) => setRegisterForm({ ...registerForm, location: value })}
                        placeholder="Ex: București, România"
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
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && user && (
          <ProviderAnalytics providerId={user.username} />
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <BackupManager contracts={[]} />
        )}
      </div>
    </div>
  );
};

export default ProviderPage;
