// src/components/InvoiceManager.jsx
import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_ORIGIN ? `${process.env.REACT_APP_API_ORIGIN}/api` : '/api';

export default function InvoiceManager() {
  const [loading, setLoading] = useState(false);
  const [docId, setDocId] = useState(null);

  // Exemple de payload minimal
  const samplePayload = {
    type: 'facture',
    contact_id: null,
    date_echeance: null,
    tva_rate: 18,
    notes: 'Merci pour votre confiance.',
    lignes: [
      { description: 'Produit A', quantite: 2, prix_unitaire: 1500 },
      { description: 'Service B', quantite: 1, prix_unitaire: 5000 }
    ]
  };

  const createDocument = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/documents`, samplePayload);
      setDocId(res.data.id);
      alert(`Document créé id=${res.data.id} ref=${res.data.reference}`);
    } catch (err) {
      console.error(err);
      alert('Erreur création document');
    } finally {
      setLoading(false);
    }
  };

  const generatePdf = async () => {
    if (!docId) return alert('Créer d\'abord un document');
    setLoading(true);
    try {
      // Appel PDFKit endpoint
      const res = await axios.post(`${API_BASE}/documents/${docId}/generate-pdf`);
      const pdfUrl = res.data.pdfUrl;
      // Ouvrir le PDF dans un nouvel onglet
      window.open(pdfUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Erreur génération PDF');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!docId) return alert('Créer d\'abord un document');
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/documents/${docId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      alert('Erreur téléchargement PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Gestion Devis / Factures</h3>
      <button onClick={createDocument} disabled={loading}>Créer document exemple</button>
      <button onClick={generatePdf} disabled={loading || !docId}>Générer PDF</button>
      <button onClick={downloadPdf} disabled={loading || !docId}>Télécharger PDF</button>
      <div>Document id: {docId || '—'}</div>
    </div>
  );
}
