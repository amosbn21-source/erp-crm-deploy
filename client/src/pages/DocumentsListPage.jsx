// src/pages/DocumentsListPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_ORIGIN
  ? `${process.env.REACT_APP_API_ORIGIN}/api`
  : 'http://localhost:5000/api';

export default function DocumentsListPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await axios.get(`${API_BASE}/documents`);
        setDocs(res.data);
      } catch (err) {
        console.error(err);
        alert("Erreur chargement liste documents: " + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, []);

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      <h2>Liste des documents</h2>
      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>ID</th>
            <th>Référence</th>
            <th>Type</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(doc => (
            <tr key={doc.id}>
              <td>{doc.id}</td>
              <td>{doc.reference}</td>
              <td>{doc.type}</td>
              <td>{doc.total}</td>
              <td>
                {/* Lien vers la page détail */}
                <Link to={`/documents/${doc.id}`}>Voir</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
