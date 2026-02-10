// utils/intent.js
async function executeIntent(db, contactId, intent) {
  const action = intent?.action;
  const data = intent?.data || {};
  const client = await db.connect();

  try {
    switch (action) {
      case 'present_products':
        const r = await client.query('SELECT nom, prix FROM produits LIMIT 5');
        return r.rows.map(p => `${p.nom}: ${p.prix} FCFA`).join('\n');

      case 'create_contact':
        await client.query(
          `UPDATE contacts SET nom = COALESCE($1, nom), prenom = COALESCE($2, prenom),
           email = COALESCE($3, email), telephone = COALESCE($4, telephone), updatedAt = NOW()
           WHERE id = $5`,
          [data.nom, data.prenom, data.email, data.phone, contactId]
        );
        return 'Vos informations ont été mises à jour.';

      case 'create_order':
        const prod = await client.query('SELECT id, prix FROM produits WHERE nom = $1', [data.produit]);
        if (prod.rows.length === 0) return 'Produit introuvable.';
        const q