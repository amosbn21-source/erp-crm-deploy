// src/components/Charts/TotalSalesCard.js

/**
 * Affiche le montant total des ventes
 * @param {number} total - montant total
 */
const TotalSalesCard = ({ total }) => (
  <div className="card">
    <h3>Total des ventes</h3>
    <p>{total} FCFA</p>
  </div>
);

export default TotalSalesCard;
