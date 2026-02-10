// src/components/Charts/TopProductsChart.js
import { Bar } from 'react-chartjs-2';

/**
 * Affiche les produits les plus commandés
 * @param {Array} data - [{ nom: "Paracétamol", quantite_totale: 5 }]
 */
const TopProductsChart = ({ data }) => {
  const chartData = {
    labels: data.map(p => p.nom), // ⚡ Noms des produits
    datasets: [
      {
        label: 'Quantité totale',
        data: data.map(p => p.quantite_totale), // ⚡ Quantité totale
        backgroundColor: 'orange'
      }
    ]
  };

  return <Bar data={chartData} />;
};

export default TopProductsChart;
