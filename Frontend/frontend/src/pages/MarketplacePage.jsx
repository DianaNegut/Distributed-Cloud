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
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const MarketplacePage = () => {
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('space');
  const [showRentModal, setShowRentModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [myPeerId, setMyPeerId] = useState('');
  const [rentForm, setRentForm] = useState({
    renterId: '',
    renterName: '',
    allocatedGB: 10,
    durationMonths: 1,
    description: ''
  });
  const [calculatedPrice, setCalculatedPrice] = useState(null);

  useEffect(() => {
    loadProviders();
    loadMyPeerId();
  }, [sortBy]);

  const loadMyPeerId = async () => {
    try {
      const response = await axios.get(`${API_URL}/status`, {
        headers: { 'x-api-key': API_KEY }
      });
      const peerId = response.data?.data?.ID || response.data?.id || response.data?.peerId;
      if (peerId) {
        setMyPeerId(peerId);
      }
    } catch (error) {
      console.error('Error loading peer ID:', error);
    }
  };

  useEffect(() => {
    filterProviders();
  }, [searchTerm, providers]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/storage-providers`, {
        headers: { 'x-api-key': API_KEY },
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
    if (!searchTerm) {
      setFilteredProviders(providers);
      return;
    }

    const filtered = providers.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.metadata.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProviders(filtered);
  };

  const calculatePrice = async () => {
    if (!selectedProvider) return;

    try {
      const response = await axios.get(`${API_URL}/storage-contracts/calculate-price`, {
        headers: { 'x-api-key': API_KEY },
        params: {
          providerId: selectedProvider.id,
          sizeGB: rentForm.allocatedGB,
          durationMonths: rentForm.durationMonths
        }
      });
      setCalculatedPrice(response.data.pricing);
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
    if (!rentForm.renterId || !rentForm.renterName) {
      alert('Te rog completează Renter ID și Nume!');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/storage-contracts/create`, {
        ...rentForm,
        providerId: selectedProvider.id
      }, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        alert(`Contract creat cu succes! ID: ${response.data.contract.id}\nPreț total: $${response.data.pricing.finalPrice}`);
        setShowRentModal(false);
        loadProviders();
        
        // Procesează plata automat (pentru demo)
        await axios.post(`${API_URL}/storage-contracts/${response.data.contract.id}/pay`, {
          paymentMethod: 'credits'
        }, {
          headers: { 'x-api-key': API_KEY }
        });
      }
    } catch (error) {
      alert('Eroare la crearea contractului: ' + (error.response?.data?.error || error.message));
    }
  };

  const openRentModal = (provider) => {
    setSelectedProvider(provider);
    setShowRentModal(true);
    setCalculatedPrice(null);
    // Auto-completare cu peer ID-ul meu
    setRentForm(prev => ({
      ...prev,
      renterId: myPeerId || '',
      renterName: prev.renterName || 'User'
    }));
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
                        ${provider.pricing?.pricePerGBPerMonth || 0.10}/GB/lună
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
                  <label className="block text-gray-400 mb-2">ID Chiriaș * (auto-completat cu Peer ID)</label>
                  <Input
                    placeholder="Ex: user-123"
                    value={rentForm.renterId}
                    onChange={(e) => setRentForm({ ...rentForm, renterId: e.target.value })}
                  />
                  {myPeerId && (
                    <p className="text-xs text-gray-500 mt-1">Peer ID detectat: {myPeerId.slice(0, 20)}...</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Numele tău *</label>
                  <Input
                    placeholder="Ex: Ion Popescu"
                    value={rentForm.renterName}
                    onChange={(e) => setRentForm({ ...rentForm, renterName: e.target.value })}
                  />
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

                {calculatedPrice && (
                  <div className="p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
                    <h3 className="text-white font-bold mb-2">Rezumat preț:</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Preț de bază:</span>
                        <span>${calculatedPrice.basePrice}</span>
                      </div>
                      {calculatedPrice.discount > 0 && (
                        <>
                          <div className="flex justify-between text-green-400">
                            <span>Reducere ({calculatedPrice.discount}%):</span>
                            <span>-${calculatedPrice.discountAmount}</span>
                          </div>
                          <div className="border-t border-gray-600 pt-1"></div>
                        </>
                      )}
                      <div className="flex justify-between text-white font-bold text-lg">
                        <span>Total de plată:</span>
                        <span className="text-green-400">${calculatedPrice.finalPrice}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        ${calculatedPrice.pricePerGBPerMonth}/GB × {rentForm.allocatedGB}GB × {rentForm.durationMonths} luni
                      </p>
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
