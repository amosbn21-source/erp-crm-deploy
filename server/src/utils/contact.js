// utils/contact.js
async function ensureContact(db, channel, externalId, initial = {}) {
  const client = await db.connect();
  try {
    if (channel === 'whatsapp') {
      // 🔎 Recherche par téléphone
      const q = await client.query('SELECT id FROM contacts WHERE telephone = $1 LIMIT 1', [externalId]);
      if (q.rows.length > 0) return q.rows[0].id;

      // ➕ Création si inexistant
      const ins = await client.query(
        `INSERT INTO contacts (nom, prenom, telephone, email, compte, createdAt, updatedAt, contactId, typeContact)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7)
         RETURNING id`,
        [
          initial.nom || 'WhatsApp',
          initial.prenom || 'User',
          externalId,
          initial.email || null,
          null, // compte non utilisé pour WhatsApp
          process.env.CONTACT_PARENT_ID || 1,
          'prospect'
        ]
      );
      return ins.rows[0].id;
    }

    if (channel === 'messenger') {
      // 🔎 Recherche par compte (senderId)
      const q = await client.query('SELECT id FROM contacts WHERE compte = $1 LIMIT 1', [externalId]);
      if (q.rows.length > 0) return q.rows[0].id;

      // ➕ Création si inexistant
      const ins = await client.query(
        `INSERT INTO contacts (nom, prenom, telephone, email, compte, createdAt, updatedAt, contactId, typeContact)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7)
         RETURNING id`,
        [
          initial.nom || 'Messenger',
          initial.prenom || 'User',
          null,
          initial.email || null,
          externalId,
          process.env.CONTACT_PARENT_ID || 1,
          'prospect'
        ]
      );
      return ins.rows[0].id;
    }
  } finally {
    client.release();
  }
}

module.exports = { ensureContact };
