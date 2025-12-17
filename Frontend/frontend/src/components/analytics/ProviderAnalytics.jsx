import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import {
  DollarSign,
  HardDrive,
  TrendingUp,
  Users,
  Activity,
  Download,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const ProviderAnalytics = ({ providerId }) => {
  const [analytics, setAnalytics] = useState({
    earnings: {
      total: 0,
      thisMonth: 0,
      lastMonth: 0,
      trend: 0
    },
    storage: {
      total: 0,
      used: 0,
      available: 0,
      utilization: 0
    },
    bandwidth: {
      upload: 0,
      download: 0,
      total: 0
    },
    contracts: {
      active: 0,
      completed: 0,
      pending: 0
    },
    uptime: {
      percentage: 0,
      lastDowntime: null,
      totalDowntime: 0
    },
    recentActivity: []
  });

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [providerId]);

  const loadAnalytics = async () => {
    try {
      // In production, fetch from backend
      // const response = await axios.get(`/api/providers/${providerId}/analytics`);
      
      // Mock data for demo
      setAnalytics({
        earnings: {
          total: 1250.50,
          thisMonth: 450.00,
          lastMonth: 380.50,
          trend: 18.3
        },
        storage: {
          total: 1000, // GB
          used: 650,
          available: 350,
          utilization: 65
        },
        bandwidth: {
          upload: 125, // GB
          download: 89,
          total: 214
        },
        contracts: {
          active: 12,
          completed: 45,
          pending: 3
        },
        uptime: {
          percentage: 99.7,
          lastDowntime: '2024-01-10T14:30:00Z',
          totalDowntime: 2.5 // hours
        },
        recentActivity: [
          { type: 'upload', user: 'User #1234', size: '15 MB', time: '2 min ago' },
          { type: 'download', user: 'User #5678', size: '8 MB', time: '5 min ago' },
          { type: 'contract', user: 'User #9012', size: '50 GB', time: '15 min ago' },
          { type: 'payment', amount: '25 FIL', time: '1 hour ago' }
        ]
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  // Earnings Chart Data
  const earningsData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Earnings (FIL)',
        data: [120, 150, 180, 200, 250, 300, 320, 380, 400, 420, 380, 450],
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Bandwidth Chart Data
  const bandwidthData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Upload (GB)',
        data: [12, 19, 15, 22, 18, 25, 14],
        backgroundColor: 'rgba(59, 130, 246, 0.8)'
      },
      {
        label: 'Download (GB)',
        data: [8, 12, 10, 15, 13, 18, 11],
        backgroundColor: 'rgba(168, 85, 247, 0.8)'
      }
    ]
  };

  // Storage Distribution
  const storageData = {
    labels: ['Used', 'Available'],
    datasets: [
      {
        data: [analytics.storage.used, analytics.storage.available],
        backgroundColor: [
          'rgba(147, 51, 234, 0.8)',
          'rgba(229, 231, 235, 0.8)'
        ],
        borderWidth: 0
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Earnings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8" />
            <span className={`text-sm px-2 py-1 rounded ${
              analytics.earnings.trend >= 0 ? 'bg-green-400' : 'bg-red-400'
            }`}>
              {analytics.earnings.trend >= 0 ? '+' : ''}{analytics.earnings.trend.toFixed(1)}%
            </span>
          </div>
          <h3 className="text-2xl font-bold">{analytics.earnings.total.toFixed(2)} FIL</h3>
          <p className="text-purple-100 text-sm">Total Earnings</p>
          <p className="text-xs text-purple-200 mt-2">
            This month: {analytics.earnings.thisMonth.toFixed(2)} FIL
          </p>
        </motion.div>

        {/* Storage Utilization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <HardDrive className="w-8 h-8" />
            <span className="text-sm px-2 py-1 rounded bg-blue-400">
              {analytics.storage.utilization}%
            </span>
          </div>
          <h3 className="text-2xl font-bold">{analytics.storage.used} GB</h3>
          <p className="text-blue-100 text-sm">Storage Used</p>
          <p className="text-xs text-blue-200 mt-2">
            of {analytics.storage.total} GB total
          </p>
        </motion.div>

        {/* Active Contracts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8" />
            <span className="text-sm px-2 py-1 rounded bg-green-400">
              {analytics.contracts.pending} pending
            </span>
          </div>
          <h3 className="text-2xl font-bold">{analytics.contracts.active}</h3>
          <p className="text-green-100 text-sm">Active Contracts</p>
          <p className="text-xs text-green-200 mt-2">
            {analytics.contracts.completed} completed
          </p>
        </motion.div>

        {/* Uptime */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8" />
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold">{analytics.uptime.percentage}%</h3>
          <p className="text-orange-100 text-sm">Uptime</p>
          <p className="text-xs text-orange-200 mt-2">
            {analytics.uptime.totalDowntime}h downtime
          </p>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <TrendingUp className="w-6 h-6 text-purple-500" />
            <h3 className="text-xl font-bold text-gray-800">Monthly Earnings</h3>
          </div>
          <div className="h-64">
            <Line data={earningsData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Bandwidth Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <Activity className="w-6 h-6 text-blue-500" />
            <h3 className="text-xl font-bold text-gray-800">Weekly Bandwidth</h3>
          </div>
          <div className="h-64">
            <Bar data={bandwidthData} options={chartOptions} />
          </div>
        </motion.div>
      </div>

      {/* Storage and Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <HardDrive className="w-6 h-6 text-purple-500" />
            <h3 className="text-xl font-bold text-gray-800">Storage</h3>
          </div>
          <div className="h-48 flex items-center justify-center">
            <Doughnut data={storageData} options={{ ...chartOptions, scales: {} }} />
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <Clock className="w-6 h-6 text-blue-500" />
            <h3 className="text-xl font-bold text-gray-800">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {analytics.recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {activity.type === 'upload' && <Upload className="w-5 h-5 text-blue-500" />}
                  {activity.type === 'download' && <Download className="w-5 h-5 text-green-500" />}
                  {activity.type === 'contract' && <Users className="w-5 h-5 text-purple-500" />}
                  {activity.type === 'payment' && <DollarSign className="w-5 h-5 text-orange-500" />}
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {activity.user || activity.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.size || activity.amount}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Performance Indicators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <h3 className="text-xl font-bold text-gray-800 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Response Time</span>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">45ms</p>
            <p className="text-xs text-gray-500 mt-1">Average latency</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Success Rate</span>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">99.8%</p>
            <p className="text-xs text-gray-500 mt-1">All operations</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Data Integrity</span>
              <AlertCircle className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-800">100%</p>
            <p className="text-xs text-gray-500 mt-1">No data loss</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProviderAnalytics;
