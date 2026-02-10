// src/components/Charts/OrdersPerDayChart.js
import { Line } from 'react-chartjs-2';

/**
 * Affiche un graphique des commandes par jour
 * @param {Array} data - [{ jour: "2025-01-02", nb_commandes: 3 }]
 */
const OrdersPerDayChart = ({ data }) => {
  const chartData = {
    labels: data.map(d => d.jour), // ⚡ Les dates
    datasets: [
      {
        label: 'Commandes par jour',
        data: data.map(d => d.nb_commandes), // ⚡ Nombre de commandes
        borderColor: 'blue',
        fill: false
      }
    ]
  };

  return <Line data={chartData} />;
};

export default OrdersPerDayChart;
