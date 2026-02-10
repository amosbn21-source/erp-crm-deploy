// src/components/Dashboard.js
import React, { useEffect, useState } from 'react';
import { getOrdersPerDay, getTotalSales, getTopProducts } from '../api/statsApi';
import OrdersPerDayChart from './Charts/OrdersPerDayChart';
import TotalSalesCard from './Charts/TotalSalesCard';
import TopProductsChart from './Charts/TopProductsChart';

/**
 * Dashboard principal
 */
const Dashboard = () => {
  const [ordersPerDay, setOrdersPerDay] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    (async () => {
      // ⚡ Appels API
      setOrdersPerDay(await getOrdersPerDay());
      setTotalSales((await getTotalSales()).total_ventes);
      setTopProducts(await getTopProducts());
    })();
  }, []);

  return (
    <div>
      <h2>Dashboard Commandes</h2>
      <TotalSalesCard total={totalSales} />
      <OrdersPerDayChart data={ordersPerDay} />
      <TopProductsChart data={topProducts} />
    </div>
  );
};

export default Dashboard;
