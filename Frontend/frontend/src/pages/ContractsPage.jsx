import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  HardDrive,
  User,
  Server,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const ContractsPage = () => {
  const [contracts, setContracts] = useState([]);
  const [myPeerId, setMyPeerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('renter'); // renter or provider

  useEffect(() => {
    loadContracts();
    loadMyPeerId();
  }, []);

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

  const loadContracts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/storage-contracts`, {
        headers: { 'x-api-key': API_KEY }
      });
      setContracts(response.data.contracts || []);
    } catch (error) {
      console.error('Error loading contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const renewContract = async (contractId) => {
    const days = prompt('Câte zile suplimentare dorești să adaugi?', '30');
    if (!days || isNaN(days)) return;

    try {
      const response = await axios.post(`${API_URL}/storage-contracts/${contractId}/renew`, {
        additionalDays: parseInt(days)
      }, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        alert('Contract reînnoit cu succes!');
        loadContracts();
      }
    } catch (error) {
      alert('Eroare: ' + (error.response?.data?.error || error.message));
    }
  };

  const cancelContract = async (contractId) => {
    const reason = prompt('Motiv anulare (opțional):');
    if (reason === null) return;

    try {
      const response = await axios.post(`${API_URL}/storage-contracts/${contractId}/cancel`, {
        reason
      }, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        alert('Contract anulat cu succes!');
        loadContracts();
      }
    } catch (error) {
      alert('Eroare: ' + (error.response?.data?.error || error.message));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending_payment': return 'warning';
      case 'expired': return 'danger';
      case 'cancelled': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'pending_payment': return AlertCircle;
      case 'expired': return XCircle;
      case 'cancelled': return XCircle;
      default: return FileText;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysRemaining = (endDate) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const myContracts = contracts.filter(c => {
    if (viewMode === 'renter') {
      return c.renterId === myPeerId || c.renterId.includes('user');
    } else {
      return c.providerId;
    }
  });

  const filteredContracts = filterStatus === 'all' 
    ? myContracts 
    : myContracts.filter(c => c.status === filterStatus);

  const activeCount = myContracts.filter(c => c.status === 'active').length;
  const pendingCount = myContracts.filter(c => c.status === 'pending_payment').length;
  const totalValue = myContracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (c.pricing?.totalPrice || 0), 0);
  const totalStorage = myContracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + c.storage.allocatedGB, 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white text-xl">Se încarcă contracte...</div>
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
          <h1 className="text-4xl font-bold text-white mb-2">Contractele Mele</h1>
          <p className="text-gray-400">Gestionează contractele de stocare</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Contracte Active"
            value={activeCount}
            icon={CheckCircle}
            color="success"
          />
          <StatCard
            title="În Așteptare"
            value={pendingCount}
            icon={Clock}
            color="warning"
          />
          <StatCard
            title="Valoare Totală"
            value={`$${totalValue.toFixed(2)}`}
            icon={DollarSign}
            color="primary"
          />
          <StatCard
            title="Stocare Totală"
            value={`${totalStorage} GB`}
            icon={HardDrive}
            color="info"
          />
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'renter' ? 'primary' : 'secondary'}
                  onClick={() => setViewMode('renter')}
                >
                  <User className="w-4 h-4 mr-2" />
                  Ca Chiriaș
                </Button>
                <Button
                  variant={viewMode === 'provider' ? 'primary' : 'secondary'}
                  onClick={() => setViewMode('provider')}
                >
                  <Server className="w-4 h-4 mr-2" />
                  Ca Furnizor
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'primary' : 'secondary'}
                  onClick={() => setFilterStatus('all')}
                  size="sm"
                >
                  Toate
                </Button>
                <Button
                  variant={filterStatus === 'active' ? 'primary' : 'secondary'}
                  onClick={() => setFilterStatus('active')}
                  size="sm"
                >
                  Active
                </Button>
                <Button
                  variant={filterStatus === 'pending_payment' ? 'primary' : 'secondary'}
                  onClick={() => setFilterStatus('pending_payment')}
                  size="sm"
                >
                  În Așteptare
                </Button>
                <Button
                  variant={filterStatus === 'expired' ? 'primary' : 'secondary'}
                  onClick={() => setFilterStatus('expired')}
                  size="sm"
                >
                  Expirate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredContracts.map((contract) => {
            const StatusIcon = getStatusIcon(contract.status);
            const daysRemaining = getDaysRemaining(contract.terms.endDate);
            const usagePercent = (contract.storage.usedGB / contract.storage.allocatedGB * 100).toFixed(1);

            return (
              <motion.div
                key={contract.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Left side - Main info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-primary-400" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">
                                Contract #{contract.id.slice(-8)}
                              </h3>
                              <p className="text-gray-400 text-sm">
                                {viewMode === 'renter' 
                                  ? `Furnizor: ${contract.providerName}`
                                  : `Chiriaș: ${contract.renterName}`
                                }
                              </p>
                            </div>
                          </div>
                          <Badge variant={getStatusColor(contract.status)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {contract.status}
                          </Badge>
                        </div>

                        {contract.metadata?.description && (
                          <p className="text-gray-400 text-sm mb-4">{contract.metadata.description}</p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Alocat</p>
                            <p className="text-white font-bold">{contract.storage.allocatedGB} GB</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Utilizat</p>
                            <p className="text-white font-bold">
                              {contract.storage.usedGB.toFixed(2)} GB
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Fișiere</p>
                            <p className="text-white font-bold">{contract.storage.files.length}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Preț</p>
                            <p className="text-green-400 font-bold">
                              ${contract.pricing?.totalPrice?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>

                        <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Utilizare stocare</span>
                          <span className="text-white">{usagePercent}%</span>
                        </div>
                          <div className="w-full bg-dark-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="lg:w-64 space-y-4">
                        <div className="p-4 bg-dark-800/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <p className="text-gray-400 text-sm">Perioadă</p>
                          </div>
                          <p className="text-white text-sm mb-1">
                            Început: {formatDate(contract.terms.startDate)}
                          </p>
                          <p className="text-white text-sm mb-2">
                            Sfârșit: {formatDate(contract.terms.endDate)}
                          </p>
                          {contract.status === 'active' && (
                            <div className={`text-sm font-medium ${daysRemaining <= 7 ? 'text-red-400' : 'text-green-400'}`}>
                              <Clock className="w-3 h-3 inline mr-1" />
                              {daysRemaining} zile rămase
                            </div>
                          )}
                        </div>

                        {contract.payment && (
                          <div className="p-4 bg-dark-800/50 rounded-lg">
                            <p className="text-gray-400 text-xs mb-2">Status Plată</p>
                            <Badge variant={contract.payment.status === 'paid' ? 'success' : 'warning'}>
                              {contract.payment.status}
                            </Badge>
                            {contract.payment.paymentDate && (
                              <p className="text-gray-500 text-xs mt-2">
                                {formatDate(contract.payment.paymentDate)}
                              </p>
                            )}
                          </div>
                        )}

                        {viewMode === 'renter' && (
                          <div className="flex flex-col gap-2">
                            {contract.status === 'active' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => renewContract(contract.id)}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reînnoiește
                              </Button>
                            )}
                            {(contract.status === 'active' || contract.status === 'pending_payment') && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => cancelContract(contract.id)}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Anulează
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {filteredContracts.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-bold text-white mb-2">Nu ai contracte</h3>
                <p className="text-gray-400 mb-6">
                  {viewMode === 'renter' 
                    ? 'Mergi la Piață pentru a închiria spațiu de stocare'
                    : 'Înregistrează-te ca furnizor pentru a oferi spațiu de stocare'
                  }
                </p>
                <Button variant="primary" onClick={() => window.location.href = viewMode === 'renter' ? '/marketplace' : '/provider'}>
                  {viewMode === 'renter' ? 'Mergi la Piață' : 'Devino Furnizor'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ContractsPage;
