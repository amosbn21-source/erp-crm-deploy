// src/pages/DocumentPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import GeneratePdfButton from '../components/GeneratePdfButton';

const API_BASE = process.env.REACT_APP_API_ORIGIN
  ? `${process.env.REACT_APP_API_ORIGIN}/api`
  : 'http://localhost:5000/api';

export default function DocumentPage({ documentId }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await axios.get(`${API_BASE}/documents/${documentId}`);
        setDoc(res.data);
      } catch (err) {
        console.error(err);
        alert("Erreur chargement document: " + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [documentId]);

  if (loading) return <div>Chargement...</div>;
  if (!doc) return <div>Document introuvable</div>;

  return (
    <div>
      <h2>{doc.type.toUpperCase()} #{doc.reference}</h2>
      <p>Date émission: {new Date(doc.date_emission).toLocaleDateString()}</p>
      <p>Notes: {doc.notes}</p>

      <h3>Lignes</h3>
      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantité</th>
            <th>PU</th>
            <th>Total ligne</th>
          </tr>
        </thead>
        <tbody>
          {doc.lignes.map(l => (
            <tr key={l.id}>
              <td>{l.description}</td>
              <td style={{ textAlign: 'center' }}>{l.quantite}</td>
              <td style={{ textAlign: 'right' }}>{l.prix_unitaire}</td>
              <td style={{ textAlign: 'right' }}>{l.total_ligne}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bouton Générer PDF */}
      <div style={{ marginTop: '20px' }}>
        <GeneratePdfButton documentId={doc.id} />
      </div>
    </div>
  );
}
