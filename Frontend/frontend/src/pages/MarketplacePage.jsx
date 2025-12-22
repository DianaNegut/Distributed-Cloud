import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  HardDrive,
  MapPin,
  Award,
  Filter,
  Search,
  ShoppingCart,
  Check
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import filecoinService from '../services/filecoinService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const MarketplacePage = () => {
  const { user, sessionToken } = useAuth();
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('space');
  const [showRentModal, setShowRentModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [filBalance, setFilBalance] = useState(null);
  const [calculatedFilCost, setCalculatedFilCost] = useState(null);
  const [rentForm, setRentForm] = useState({
    allocatedGB: 10,
    durationMonths: 1,
    description: ''
  });
  const [calculatedPrice, setCalculatedPrice] = useState(null);

  useEffect(() => {
    if (user) {
      loadProviders();
      loadFilBalance();
    }
  }, [sortBy, user]);

  const loadFilBalance = async () => {
    if (!user) return;
    try {
      const data = await filecoinService.getBalance(user.username);
      if (data.success) {
        setFilBalance(data.balance);
      }
    } catch (error) {
      console.error('Error loading FIL balance:', error);
    }
  };

  useEffect(() => {
    filterProviders();
  }, [searchTerm, providers]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/storage-providers`, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        },
        params: {
          status: 'active',
          sortBy: sortBy
        }
      });
      setProviders(response.data.providers || []);
      setFilteredProviders(response.data.providers || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProviders = () => {
    // First filter out user's own providers (prevent self-rental)
    let available = providers.filter(p => p.peerId !== user?.username);

    // Then apply search filter
    if (searchTerm) {
      available = available.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.metadata.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProviders(available);
  };

  const calculatePrice = async () => {
    if (!selectedProvider) return;

    try {
      // Calculate USD price (legacy)
      const response = await axios.get(`${API_URL}/storage-contracts/calculate-price`, {
        headers: { 'x-api-key': API_KEY },
        params: {
          providerId: selectedProvider.id,
          sizeGB: rentForm.allocatedGB,
          durationMonths: rentForm.durationMonths
        }
      });
      setCalculatedPrice(response.data.pricing);

      // Calculate FIL cost
      const filResponse = await filecoinService.calculateStorageCost(
        rentForm.allocatedGB,
        rentForm.durationMonths
      );
      if (filResponse.success) {
        setCalculatedFilCost(filResponse);
      }
    } catch (error) {
      console.error('Error calculating price:', error);
    }
  };

  useEffect(() => {
    if (selectedProvider && showRentModal) {
      calculatePrice();
    }
  }, [rentForm.allocatedGB, rentForm.durationMonths]);

  const handleRent = async () => {
    if (!user) {
      alert('Trebuie să fii autentificat pentru a închiria spațiu!');
      return;
    }

    // Validate FIL balance
    if (calculatedFilCost && filBalance !== null) {
      if (filBalance < calculatedFilCost.totalCost) {
        alert(`Balanță insuficientă!\nNecesar: ${calculatedFilCost.totalCost.toFixed(6)} FIL\nDisponibil: ${filBalance.toFixed(6)} FIL\n\nLipsește: ${(calculatedFilCost.totalCost - filBalance).toFixed(6)} FIL`);
        return;
      }
    }

    if (!window.confirm(`Confirmă închirierea:\n\nStorage: ${rentForm.allocatedGB} GB\nDurată: ${rentForm.durationMonths} lună/luni\nCost: ${calculatedFilCost?.totalCost.toFixed(6) || '0.000000'} FIL\n\nFondurile vor fi blocate în escrow până la finalizarea contractului.`)) {
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/storage-contracts/create`, {
        ...rentForm,
        renterId: user.username,
        renterName: user.username,
        providerId: selectedProvider.id
      }, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });

      if (response.data.success) {
        alert(`✅ Contract creat cu succes!\n\nID: ${response.data.contract.id}\nCost: ${calculatedFilCost?.totalCost.toFixed(6) || 'N/A'} FIL\nEscrow: Deposited\n\nMergi la Contracte pentru a gestiona contractul.`);
        setShowRentModal(false);
        loadProviders();
        loadFilBalance(); // Refresh balance
      }
    } catch (error) {
      alert('❌ Eroare la crearea contractului: ' + (error.response?.data?.error || error.message));
    }
  };

  const openRentModal = (provider) => {
    setSelectedProvider(provider);
    setShowRentModal(true);
    setCalculatedPrice(null);
    setCalculatedFilCost(null);
    loadFilBalance(); // Refresh balance
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">Se încarcă provideri...</div>
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
          <h1 className="text-4xl font-bold text-white mb-2">Piață de Stocare</h1>
          <p className="text-gray-400">Rentează spațiu de stocare de la provideri verificați</p>
        </motion.div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Caută după nume sau locație..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === 'space' ? 'primary' : 'secondary'}
                  onClick={() => setSortBy('space')}
                >
                  <HardDrive className="w-4 h-4 mr-2" />
                  Spațiu
                </Button>
                <Button
                  variant={sortBy === 'uptime' ? 'primary' : 'secondary'}
                  onClick={() => setSortBy('uptime')}
                >
                  <Award className="w-4 h-4 mr-2" />
                  Disponibilitate
                </Button>
                <Button
                  variant={sortBy === 'name' ? 'primary' : 'secondary'}
                  onClick={() => setSortBy('name')}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Nume
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card className="h-full">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                        <Server className="w-6 h-6 text-primary-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                          <MapPin className="w-3 h-3" />
                          {provider.metadata.location}
                        </div>
                      </div>
                    </div>
                    <Badge variant={provider.status === 'active' ? 'success' : 'warning'}>
                      {provider.status}
                    </Badge>
                  </div>

                  {provider.description && (
                    <p className="text-gray-400 text-sm mb-4">{provider.description}</p>
                  )}

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Disponibil:</span>
                      <span className="text-white font-medium">
                        {provider.capacity.availableGB.toFixed(1)} GB
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Capacitate totală:</span>
                      <span className="text-white font-medium">
                        {provider.capacity.totalGB.toFixed(1)} GB
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Preț:</span>
                      <span className="text-green-400 font-bold">
                        {(provider.pricing?.pricePerGBPerMonth || 0.10).toFixed(6)} FIL/GB/lună
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Disponibilitate:</span>
                      <span className="text-white font-medium">
                        {provider.statistics.uptimePercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Contracte active:</span>
                      <span className="text-white font-medium">
                        {provider.statistics.activeContracts}
                      </span>
                    </div>
                  </div>

                  {/* Discounts */}
                  {provider.pricing?.discounts && (
                    <div className="mb-4 p-3 bg-dark-800/50 rounded-lg">
                      <p className="text-xs text-gray-400 mb-2">Reduceri:</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.pricing.discounts.threeMonths > 0 && (
                          <Badge variant="success">3 luni: -{provider.pricing.discounts.threeMonths}%</Badge>
                        )}
                        {provider.pricing.discounts.sixMonths > 0 && (
                          <Badge variant="success">6 luni: -{provider.pricing.discounts.sixMonths}%</Badge>
                        )}
                        {provider.pricing.discounts.twelveMonths > 0 && (
                          <Badge variant="success">12 luni: -{provider.pricing.discounts.twelveMonths}%</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => openRentModal(provider)}
                    disabled={provider.capacity.availableGB < 1}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Închiriază Spațiu
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredProviders.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <Server className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Nu au fost găsiți provideri disponibili</p>
          </div>
        )}

        {showRentModal && selectedProvider && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-dark-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                Închiriază Spațiu de la {selectedProvider.name}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2">Utilizator *</label>
                  <Input
                    value={user?.username || ''}
                    disabled
                    className="bg-dark-700"
                  />
                  <p className="text-xs text-green-400 mt-1">✓ Autentificat ca {user?.username}</p>
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">
                    Spațiu necesar (GB): {rentForm.allocatedGB} GB
                  </label>
                  <input
                    type="range"
                    min="1"
                    max={Math.min(selectedProvider.capacity.availableGB, 100)}
                    value={rentForm.allocatedGB}
                    onChange={(e) => setRentForm({ ...rentForm, allocatedGB: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Durată contract:</label>
                  <select
                    value={rentForm.durationMonths}
                    onChange={(e) => setRentForm({ ...rentForm, durationMonths: parseInt(e.target.value) })}
                    className="w-full bg-dark-700 text-white px-4 py-2 rounded-lg border border-dark-600"
                  >
                    <option value="1">1 lună</option>
                    <option value="3">3 luni (reducere {selectedProvider.pricing?.discounts?.threeMonths || 5}%)</option>
                    <option value="6">6 luni (reducere {selectedProvider.pricing?.discounts?.sixMonths || 10}%)</option>
                    <option value="12">12 luni (reducere {selectedProvider.pricing?.discounts?.twelveMonths || 20}%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Descriere (opțional)</label>
                  <textarea
                    placeholder="Scopul contractului..."
                    value={rentForm.description}
                    onChange={(e) => setRentForm({ ...rentForm, description: e.target.value })}
                    className="w-full bg-dark-700 text-white px-4 py-2 rounded-lg border border-dark-600"
                    rows="3"
                  />
                </div>

                {calculatedFilCost && (
                  <div className="p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
                    <h3 className="text-white font-bold mb-2">💰 Cost în FIL:</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Storage:</span>
                        <span>{calculatedFilCost.sizeGB} GB × {calculatedFilCost.months} luni</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Preț/GB/lună:</span>
                        <span>{calculatedFilCost.pricePerGBPerMonth.toFixed(6)} FIL</span>
                      </div>
                      <div className="border-t border-gray-600 pt-2 mt-2"></div>
                      <div className="flex justify-between text-white font-bold text-lg">
                        <span>Total cost:</span>
                        <span className="text-primary-400">{calculatedFilCost.totalCost.toFixed(6)} FIL</span>
                      </div>

                      {/* Balance check */}
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Balanța ta:</span>
                          <span className={`font-semibold ${filBalance !== null && filBalance >= calculatedFilCost.totalCost ? 'text-green-400' : 'text-red-400'}`}>
                            {filBalance !== null ? `${filBalance.toFixed(6)} FIL` : 'Se încarcă...'}
                          </span>
                        </div>
                        {filBalance !== null && filBalance < calculatedFilCost.totalCost && (
                          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">
                            ⚠️ Balanță insuficientă! Lipsesc {(calculatedFilCost.totalCost - filBalance).toFixed(6)} FIL
                          </div>
                        )}
                        {filBalance !== null && filBalance >= calculatedFilCost.totalCost && (
                          <div className="mt-2 p-2 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-xs">
                            ✓ Balanță suficientă! După plată vei avea {(filBalance - calculatedFilCost.totalCost).toFixed(6)} FIL
                          </div>
                        )}
                      </div>

                      <div className="mt-2 p-2 bg-orange-500/20 border border-orange-500/50 rounded text-orange-300 text-xs">
                        💡 Fondurile vor fi blocate în escrow până la finalizarea contractului
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowRentModal(false)}
                  >
                    Anulează
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleRent}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Confirmă Închirierea
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplacePage;
