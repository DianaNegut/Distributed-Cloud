import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const ActivityChart = ({ data }) => {
  const chartData = {
    labels: data?.labels || ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'],
    datasets: [
      {
        label: 'Upload-uri',
        data: data?.uploads || [5, 8, 12, 7, 15, 10, 14],
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1
      },
      {
        label: 'Download-uri',
        data: data?.downloads || [12, 15, 18, 20, 22, 18, 25],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
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
        text: 'Activitate Upload/Download',
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
          stepSize: 5
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
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default ActivityChart;
