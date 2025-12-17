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
  RefreshCw,
  Coins,
  Check,
  Wallet,
  Send,
  ArrowDownUp,
  TrendingUp,
  Users,
  Shield
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import BackupManager from '../components/backup/BackupManager';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import filecoinService from '../services/filecoinService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const ContractsPage = () => {
  const { user, sessionToken } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('renter'); // renter or provider
  const [filBalance, setFilBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('contracts'); // contracts, wallet, transactions, backup
  
  // Wallet data
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  
  // Transfer form
  const [transferForm, setTransferForm] = useState({
    toUserId: '',
    amount: '',
    note: ''
  });
  const [transferResult, setTransferResult] = useState(null);

  useEffect(() => {
    if (user) {
      loadContracts();
      loadFilBalance();
      loadWalletData();
      loadStatistics();
    }
  }, [user]);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/storage-contracts`, {
        headers: { 
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      setContracts(response.data.contracts || []);
    } catch (error) {
      console.error('Error loading contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilBalance = async () => {
    if (!user) return;
    try {
      setWalletLoading(true);
      const balance = await filecoinService.getBalance(user.username);
      if (balance.success) {
        setFilBalance(balance.balance);
      }
    } catch (error) {
      console.error('Error loading FIL balance:', error);
    } finally {
      setWalletLoading(false);
    }
  };
  const loadWalletData = async () => {
    if (!user) return;
    try {
      // Get wallet
      const walletResponse = await filecoinService.getWallet(user.username);
      if (walletResponse.success) {
        setWallet(walletResponse.wallet);
      }

      // Get balance
      const balanceResponse = await filecoinService.getBalance(user.username);
      if (balanceResponse.success) {
        setBalance(balanceResponse);
      }

      // Get transactions
      const txResponse = await filecoinService.getWalletTransactions(user.username);
      if (txResponse.success) {
        setTransactions(txResponse.transactions || []);
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const statsResponse = await filecoinService.getStatistics();
      if (statsResponse.success) {
        setStatistics(statsResponse);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setTransferResult(null);

    try {
      const amount = parseFloat(transferForm.amount);
      if (isNaN(amount) || amount <= 0) {
        setTransferResult({ success: false, error: 'Sumă invalidă' });
        return;
      }

      if (!transferForm.toUserId) {
        setTransferResult({ success: false, error: 'User ID destinatar este obligatoriu' });
        return;
      }

      const result = await filecoinService.transfer(
        user.username,
        transferForm.toUserId,
        amount,
        { note: transferForm.note }
      );

      if (result.success) {
        setTransferResult({ success: true, transaction: result.transaction });
        setTransferForm({ toUserId: '', amount: '', note: '' });
        await loadWalletData();
        await loadFilBalance();
      } else {
        setTransferResult({ success: false, error: result.error });
      }
    } catch (error) {
      setTransferResult({ success: false, error: error.message });
    }
  };

  const getTransactionTypeColor = (type) => {
    const colors = {
      'initial_bonus': 'text-green-600',
      'transfer': 'text-blue-600',
      'escrow_deposit': 'text-orange-600',
      'escrow_release': 'text-green-600',
      'escrow_refund': 'text-purple-600'
    };
    return colors[type] || 'text-gray-600';
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'initial_bonus': 'Bonus Inițial',
      'transfer': 'Transfer',
      'escrow_deposit': 'Deposit Escrow',
      'escrow_release': 'Plată Primită',
      'escrow_refund': 'Refund'
    };
    return labels[type] || type;
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
        alert('Contract anulat cu succes! Escrow-ul a fost rambursat.');
        loadContracts();
        loadFilBalance(); // Refresh FIL balance
      }
    } catch (error) {
      alert('Eroare: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCompleteContract = async (contractId) => {
    if (!window.confirm('Sigur doriți să finalizați contractul? Fondurile din escrow vor fi plătite furnizorului.')) {
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/storage-contracts/${contractId}/complete`, {}, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        alert('Contract finalizat cu succes! Plata a fost efectuată furnizorului.');
        loadContracts();
        loadFilBalance(); // Refresh FIL balance
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

  const myContracts = user ? contracts.filter(c => {
    if (viewMode === 'renter') {
      return c.renterId === user.username;
    } else {
      return c.providerId === user.username;
    }
  }) : [];

  const filteredContracts = filterStatus === 'all' 
    ? myContracts 
    : myContracts.filter(c => c.status === filterStatus);

  const activeCount = myContracts.filter(c => c.status === 'active').length;
  const pendingCount = myContracts.filter(c => c.status === 'pending_payment').length;
  const totalValue = myContracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (c.pricing?.priceInFIL || c.pricing?.totalPrice || 0), 0);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Contractele Mele</h1>
              <p className="text-gray-400">Gestionează contractele de stocare și wallet FIL</p>
            </div>
            {balance && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Balanță disponibilă</p>
                <p className="text-3xl font-bold text-primary-400">
                  {filecoinService.formatFIL(balance.balance)} FIL
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-dark-700">
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'contracts'
                ? 'border-b-2 border-primary-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Contracte
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'wallet'
                ? 'border-b-2 border-primary-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Wallet FIL
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'transactions'
                ? 'border-b-2 border-primary-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDownUp className="w-4 h-4" />
            Istoric Tranzacții
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'backup'
                ? 'border-b-2 border-primary-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Backup & Recovery
          </button>
        </div>

        {/* Tab Content: Contracts */}
        {activeTab === 'contracts' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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
            value={`${Number(totalValue).toFixed(6)} FIL`}
            icon={Coins}
            color="primary"
          />
          <StatCard
            title="Wallet FIL"
            value={walletLoading ? '...' : filBalance !== null ? `${Number(filBalance).toFixed(6)} FIL` : 'N/A'}
            icon={DollarSign}
            color="purple"
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
                              {Number(contract.storage.usedGB || 0).toFixed(2)} GB
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Fișiere</p>
                            <p className="text-white font-bold">{contract.storage.files.length}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Preț</p>
                            <div className="flex items-center gap-1">
                              <Coins className="w-4 h-4 text-green-400" />
                              <p className="text-green-400 font-bold">
                                {Number(contract.pricing?.priceInFIL || 0).toFixed(6)} FIL
                              </p>
                            </div>
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
                          <div className="p-4 bg-dark-800/50 rounded-lg space-y-3">
                            <div>
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
                            {contract.payment.escrowStatus && (
                              <div>
                                <p className="text-gray-400 text-xs mb-2">Status Escrow</p>
                                <Badge variant={
                                  contract.payment.escrowStatus === 'released' ? 'success' :
                                  contract.payment.escrowStatus === 'deposited' ? 'warning' :
                                  contract.payment.escrowStatus === 'refunded' ? 'secondary' : 'default'
                                }>
                                  {contract.payment.escrowStatus}
                                </Badge>
                                {contract.payment.escrowAmount && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <Coins className="w-3 h-3 text-gray-400" />
                                    <p className="text-gray-400 text-xs">
                                      {Number(contract.payment.escrowAmount).toFixed(6)} FIL
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {viewMode === 'renter' && (
                          <div className="flex flex-col gap-2">
                            {contract.status === 'active' && contract.payment?.escrowStatus === 'deposited' && (
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleCompleteContract(contract.id)}
                                title="Finalizează contractul și plătește furnizorul"
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Finalizează
                              </Button>
                            )}
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
          </>
        )}

        {/* Tab Content: Wallet */}
        {activeTab === 'wallet' && (
          <>
            {/* Wallet Info Card */}
            {wallet && (
              <Card className="mb-6 bg-gradient-to-r from-primary-500 to-purple-600">
                <CardContent className="pt-6">
                  <p className="text-sm text-white/80 mb-2">Adresă Wallet</p>
                  <p className="text-lg font-mono text-white break-all">{wallet.address}</p>
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/20">
                    <div>
                      <p className="text-xs text-white/70">User ID</p>
                      <p className="text-sm font-medium text-white">{wallet.userId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/70">Creat la</p>
                      <p className="text-sm font-medium text-white">
                        {new Date(wallet.createdAt).toLocaleDateString('ro-RO')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/70">Ultima actualizare</p>
                      <p className="text-sm font-medium text-white">
                        {new Date(wallet.updatedAt).toLocaleString('ro-RO', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                  title="Total Wallets"
                  value={statistics.wallets?.totalWallets || 0}
                  icon={Users}
                  color="info"
                />
                <StatCard
                  title="Total în Sistem"
                  value={`${Number(statistics.wallets?.totalBalance || 0).toFixed(2)} FIL`}
                  icon={DollarSign}
                  color="success"
                />
                <StatCard
                  title="Tranzacții Total"
                  value={statistics.transactions?.totalTransactions || 0}
                  icon={ArrowDownUp}
                  color="purple"
                />
                <StatCard
                  title="Volum Tranzacții"
                  value={`${Number(statistics.transactions?.totalVolume || 0).toFixed(2)} FIL`}
                  icon={TrendingUp}
                  color="warning"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Wallet Details */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-white mb-4">Detalii Wallet</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-dark-700">
                      <span className="text-gray-400">Balanță disponibilă:</span>
                      <span className="text-xl font-bold text-primary-400">
                        {balance ? filecoinService.formatFIL(balance.balance) : '0.000000'} FIL
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-dark-700">
                      <span className="text-gray-400">Total primit:</span>
                      <span className="text-green-400 font-semibold">
                        +{Number(transactions.filter(tx => tx.to === wallet?.address).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)).toFixed(6)} FIL
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-dark-700">
                      <span className="text-gray-400">Total trimis:</span>
                      <span className="text-red-400 font-semibold">
                        -{Number(transactions.filter(tx => tx.from === wallet?.address).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)).toFixed(6)} FIL
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-gray-400">Număr tranzacții:</span>
                      <span className="text-white font-semibold">{transactions.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transfer Form */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-white mb-4">Transfer FIL</h3>
                  <form onSubmit={handleTransfer} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        User ID Destinatar
                      </label>
                      <input
                        type="text"
                        value={transferForm.toUserId}
                        onChange={(e) => setTransferForm({...transferForm, toUserId: e.target.value})}
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="user-12345"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Sumă (FIL)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="0.000000"
                        required
                      />
                      {balance && (
                        <p className="text-sm text-gray-500 mt-1">
                          Disponibil: {filecoinService.formatFIL(balance.balance)} FIL
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Notă (opțional)
                      </label>
                      <textarea
                        value={transferForm.note}
                        onChange={(e) => setTransferForm({...transferForm, note: e.target.value})}
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows="3"
                        placeholder="Descriere transfer..."
                      />
                    </div>

                    <Button type="submit" variant="primary" className="w-full">
                      <Send className="w-4 h-4 mr-2" />
                      Trimite FIL
                    </Button>
                  </form>

                  {transferResult && (
                    <div className={`mt-4 p-4 rounded-lg ${
                      transferResult.success 
                        ? 'bg-green-500/20 border border-green-500/50' 
                        : 'bg-red-500/20 border border-red-500/50'
                    }`}>
                      {transferResult.success ? (
                        <>
                          <p className="font-semibold text-green-400">✓ Transfer realizat cu succes!</p>
                          <p className="text-sm text-gray-400 mt-1">ID Tranzacție: {transferResult.transaction?.id}</p>
                        </>
                      ) : (
                        <p className="font-semibold text-red-400">✗ Eroare: {transferResult.error}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Tab Content: Transactions */}
        {activeTab === 'transactions' && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold text-white mb-4">Istoric Tranzacții</h3>
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowDownUp className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">Nu există tranzacții încă</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${getTransactionTypeColor(tx.type)}`}>
                            {getTransactionTypeLabel(tx.type)}
                          </span>
                          {tx.contractId && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
                              Contract: {tx.contractId.substring(0, 20)}...
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {filecoinService.formatDate(tx.timestamp)}
                        </p>
                        {tx.metadata?.note && (
                          <p className="text-xs text-gray-400 mt-1 italic">"{tx.metadata.note}"</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          tx.to === wallet?.address ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.to === wallet?.address ? '+' : '-'}
                          {filecoinService.formatFIL(tx.amount)} FIL
                        </p>
                        <p className="text-xs text-gray-500">
                          {tx.status === 'completed' ? '✓ Completat' : 'În așteptare'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab Content: Backup */}
        {activeTab === 'backup' && (
          <BackupManager contracts={contracts} />
        )}
      </div>
    </div>
  );
};

export default ContractsPage;
