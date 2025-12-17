import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const StorageChart = ({ data }) => {
  const chartData = {
    labels: data?.labels || ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'],
    datasets: [
      {
        label: 'Stocare Utilizată (GB)',
        data: data?.used || [2.1, 2.5, 3.2, 3.8, 4.2, 4.5, 4.8],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Limită Stocare (GB)',
        data: data?.limit || [10, 10, 10, 10, 10, 10, 10],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderDash: [5, 5],
        fill: false
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#9ca3af',
          usePointStyle: true
        }
      },
      title: {
        display: true,
        text: 'Utilizare Stocare în Timp',
        color: '#fff',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#d1d5db',
        borderColor: '#374151',
        borderWidth: 1
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9ca3af',
          callback: (value) => `${value} GB`
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        }
      },
      x: {
        ticks: {
          color: '#9ca3af'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        }
      }
    }
  };

  return (
    <div style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default StorageChart;
