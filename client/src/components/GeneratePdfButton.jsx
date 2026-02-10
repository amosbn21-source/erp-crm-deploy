// src/components/GeneratePdfButton.jsx
import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_ORIGIN
  ? `${process.env.REACT_APP_API_ORIGIN}/api`
  : 'http://localhost:5000/api';

export default function GeneratePdfButton({ documentId }) {
  const [loading, setLoading] = useState(false);

  const handleGeneratePdf = async () => {
    if (!documentId) {
      alert("Aucun document sélectionné");
      return;
    }
    setLoading(true);
    try {
      // Appel backend pour générer le PDF
      const res = await axios.post(`${API_BASE}/documents/${documentId}/generate-pdf-puppeteer`);
      const pdfUrl = res.data.pdfUrl;

      if (pdfUrl) {
        // Ouvrir le PDF dans un nouvel onglet
        const fullUrl = pdfUrl.startsWith('http')
          ? pdfUrl
          : `${window.location.origin}${pdfUrl}`;
        window.open(fullUrl, '_blank');
      } else {
        alert("PDF non généré");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur génération PDF: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleGeneratePdf} disabled={loading}>
      {loading ? "Génération en cours..." : "Générer PDF"}
    </button>
  );
}
