// Emplacement suggéré : src/pages/VueGlobale.js
// Description : Vue globale centralisée avec CRUD complet pour Contacts, Produits et Commandes,
// et affichage des statistiques. Toutes les fonctions CRUD utilisent axios pour appeler l'API backend.
// Le fichier est entièrement commenté pour expliquer chaque section.

import React, { useEffect, useState } from 'react';
import axios from 'axios';

// Si tu veux les graphiques, décommente les imports Chart.js et installe react-chartjs-2 + chart.js
import { Bar, Pie } from 'react-chartjs-2';
import {
   Chart as ChartJS,
   CategoryScale,
   LinearScale,
   BarElement,
   ArcElement,
   Title,
   Tooltip,
   Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const VueGlobale = () => {
  // =========================
  // États principaux
  // =========================
  // Données récupérées depuis le backend
  const [contacts, setContacts] = useState([]);
  const [produits, setProduits] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [stats, setStats] = useState(null);

  // États pour les formulaires Contacts
  const [nomContact, setNomContact] = useState('');
  const [emailContact, setEmailContact] = useState('');
  const [editingContactId, setEditingContactId] = useState(null); // id en cours d'édition

  // États pour les formulaires Produits
  const [nomProduit, setNomProduit] = useState('');
  const [prixProduit, setPrixProduit] = useState('');
  const [editingProduitId, setEditingProduitId] = useState(null);

  // États pour les formulaires Commandes
  const [produitCmd, setProduitCmd] = useState('');
  const [quantiteCmd, setQuantiteCmd] = useState('');
  const [statusCmd, setStatusCmd] = useState('En cours');
  const [editingCommandeId, setEditingCommandeId] = useState(null);

  // URL de base de l'API (modifie si nécessaire)
  const API_BASE = 'http://localhost:5000/api';

  // =========================
  // useEffect initial pour charger toutes les données
  // =========================
  useEffect(() => {
    // Charger contacts, produits, commandes et stats en parallèle
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fonction utilitaire pour recharger toutes les données
  const fetchAll = async () => {
    try {
      const [resContacts, resProduits, resCommandes, resStats] = await Promise.all([
        axios.get(`${API_BASE}/contacts`),
        axios.get(`${API_BASE}/produits`),
        axios.get(`${API_BASE}/commandes`),
        axios.get(`${API_BASE}/stats`)
      ]);

      setContacts(Array.isArray(resContacts.data) ? resContacts.data : []);
      setProduits(Array.isArray(resProduits.data) ? resProduits.data : []);
      setCommandes(Array.isArray(resCommandes.data) ? resCommandes.data : []);
      setStats(resStats.data || null);
    } catch (err) {
      console.error('Erreur lors du chargement des données', err);
      // En cas d'erreur, on garde les tableaux vides pour éviter les crashs
      setContacts([]);
      setProduits([]);
      setCommandes([]);
      setStats(null);
    }
  };

  // =========================
  // CRUD Contacts
  // =========================

  // Ajouter un contact
  const addContact = async () => {
    try {
      const payload = { nom: nomContact, email: emailContact };
      const res = await axios.post(`${API_BASE}/contacts`, payload);
      // Mettre à jour la liste locale
      setContacts(prev => [...prev, res.data]);
      // Réinitialiser le formulaire
      setNomContact('');
      setEmailContact('');
      // Mettre à jour les stats
      refreshStats();
    } catch (err) {
      console.error('Erreur addContact', err);
    }
  };

  // Supprimer un contact
  const deleteContact = async (id) => {
    try {
      await axios.delete(`${API_BASE}/contacts/${id}`);
      setContacts(prev => prev.filter(c => c.id !== id));
      refreshStats();
    } catch (err) {
      console.error('Erreur deleteContact', err);
    }
  };

  // Préparer l'édition d'un contact (remplit le formulaire)
  const startEditContact = (contact) => {
    setEditingContactId(contact.id);
    setNomContact(contact.nom || '');
    setEmailContact(contact.email || '');
  };

  // Valider la modification d'un contact
  const updateContact = async () => {
    if (!editingContactId) return;
    try {
      const payload = { nom: nomContact, email: emailContact };
      const res = await axios.put(`${API_BASE}/contacts/${editingContactId}`, payload);
      setContacts(prev => prev.map(c => (c.id === editingContactId ? res.data : c)));
      // Réinitialiser l'édition
      setEditingContactId(null);
      setNomContact('');
      setEmailContact('');
      refreshStats();
    } catch (err) {
      console.error('Erreur updateContact', err);
    }
  };

  // Annuler l'édition de contact
  const cancelEditContact = () => {
    setEditingContactId(null);
    setNomContact('');
    setEmailContact('');
  };

  // =========================
  // CRUD Produits
  // =========================

  // Ajouter un produit
  const addProduit = async () => {
    try {
      // Convertir le prix en nombre si nécessaire
      const prix = Number(prixProduit) || 0;
      const payload = { nom: nomProduit, prix };
      const res = await axios.post(`${API_BASE}/produits`, payload);
      setProduits(prev => [...prev, res.data]);
      setNomProduit('');
      setPrixProduit('');
      refreshStats();
    } catch (err) {
      console.error('Erreur addProduit', err);
    }
  };

  // Supprimer un produit
  const deleteProduit = async (id) => {
    try {
      await axios.delete(`${API_BASE}/produits/${id}`);
      setProduits(prev => prev.filter(p => p.id !== id));
      refreshStats();
    } catch (err) {
      console.error('Erreur deleteProduit', err);
    }
  };

  // Préparer l'édition d'un produit
  const startEditProduit = (produit) => {
    setEditingProduitId(produit.id);
    setNomProduit(produit.nom || '');
    setPrixProduit(String(produit.prix || ''));
  };

  // Valider la modification d'un produit
  const updateProduit = async () => {
    if (!editingProduitId) return;
    try {
      const payload = { nom: nomProduit, prix: Number(prixProduit) || 0 };
      const res = await axios.put(`${API_BASE}/produits/${editingProduitId}`, payload);
      setProduits(prev => prev.map(p => (p.id === editingProduitId ? res.data : p)));
      setEditingProduitId(null);
      setNomProduit('');
      setPrixProduit('');
      refreshStats();
    } catch (err) {
      console.error('Erreur updateProduit', err);
    }
  };

  const cancelEditProduit = () => {
    setEditingProduitId(null);
    setNomProduit('');
    setPrixProduit('');
  };

  // =========================
  // CRUD Commandes
  // =========================

  // Ajouter une commande
  const addCommande = async () => {
    try {
      const payload = {
        produit: produitCmd,
        quantite: Number(quantiteCmd) || 0,
        status: statusCmd || 'En cours'
      };
      const res = await axios.post(`${API_BASE}/commandes`, payload);
      setCommandes(prev => [...prev, res.data]);
      setProduitCmd('');
      setQuantiteCmd('');
      setStatusCmd('En cours');
      refreshStats();
    } catch (err) {
      console.error('Erreur addCommande', err);
    }
  };

  // Supprimer une commande
  const deleteCommande = async (id) => {
    try {
      await axios.delete(`${API_BASE}/commandes/${id}`);
      setCommandes(prev => prev.filter(c => c.id !== id));
      refreshStats();
    } catch (err) {
      console.error('Erreur deleteCommande', err);
    }
  };

  // Préparer l'édition d'une commande
  const startEditCommande = (cmd) => {
    setEditingCommandeId(cmd.id);
    setProduitCmd(cmd.produit || '');
    setQuantiteCmd(String(cmd.quantite || ''));
    setStatusCmd(cmd.status || 'En cours');
  };

  // Valider la modification d'une commande
  const updateCommande = async () => {
    if (!editingCommandeId) return;
    try {
      const payload = {
        produit: produitCmd,
        quantite: Number(quantiteCmd) || 0,
        status: statusCmd
      };
      const res = await axios.put(`${API_BASE}/commandes/${editingCommandeId}`, payload);
      setCommandes(prev => prev.map(c => (c.id === editingCommandeId ? res.data : c)));
      setEditingCommandeId(null);
      setProduitCmd('');
      setQuantiteCmd('');
      setStatusCmd('En cours');
      refreshStats();
    } catch (err) {
      console.error('Erreur updateCommande', err);
    }
  };

  const cancelEditCommande = () => {
    setEditingCommandeId(null);
    setProduitCmd('');
    setQuantiteCmd('');
    setStatusCmd('En cours');
  };

  // =========================
  // Rafraîchir uniquement les stats
  // =========================
  const refreshStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/stats`);
      setStats(res.data || null);
    } catch (err) {
      console.error('Erreur refreshStats', err);
    }
  };

  // =========================
  // Rendu du composant
  // =========================
  return (
    <div style={{ padding: 16 }}>
      <h1>Vue Globale ERP CRM</h1>

      {/* =========================
          Section Statistiques
          - Affiche les KPI et (optionnel) graphiques
          ========================= */}
      <section style={{ marginBottom: 24 }}>
        <h2>Statistiques</h2>
        {stats ? (
          <div>
            <p><strong>Total commandes :</strong> {stats.totalCommandes ?? 0}</p>
            <p><strong>Chiffre d'affaires :</strong> {stats.totalVentes ?? 0} FCFA</p>

            {/* Si tu utilises Chart.js, décommente et adapte les données ci-dessous */}
            {
            <div style={{ maxWidth: 600 }}>
              <h3>Top Produits</h3>
              <Bar data={{
                labels: stats.topProduits.map(([nom]) => nom),
                datasets: [{ label: 'Quantité vendue', data: stats.topProduits.map(([_, q]) => q), backgroundColor: 'rgba(75,192,192,0.6)' }]
              }} />
              <h3>Répartition Statuts</h3>
              <Pie data={{
                labels: Object.keys(stats.statuts),
                datasets: [{ data: Object.values(stats.statuts), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'] }]
              }} />
            </div>
            }
          </div>
        ) : (
          <p>Chargement des statistiques...</p>
        )}
      </section>

      <hr />

      {/* =========================
          Section Contacts avec CRUD
          - Formulaire d'ajout / édition
          - Liste avec actions Modifier / Supprimer
          ========================= */}
      <section style={{ marginBottom: 24 }}>
        <h2>Contacts</h2>

        {/* Formulaire */}
        <div style={{ marginBottom: 8 }}>
          <input
            placeholder="Nom"
            value={nomContact}
            onChange={e => setNomContact(e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Email"
            value={emailContact}
            onChange={e => setEmailContact(e.target.value)}
            style={{ marginRight: 8 }}
          />

          {/* Si on est en édition, afficher Valider / Annuler */}
          {editingContactId ? (
            <>
              <button onClick={updateContact} style={{ marginRight: 8 }}>Valider</button>
              <button onClick={cancelEditContact}>Annuler</button>
            </>
          ) : (
            <button onClick={addContact}>Ajouter</button>
          )}
        </div>

        {/* Tableau des contacts */}
        <table border="1" width="100%" cellPadding="6">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length > 0 ? (
              contacts.map(c => (
                <tr key={c.id}>
                  <td>{c.nom}</td>
                  <td>{c.email}</td>
                  <td>
                    <button onClick={() => startEditContact(c)} style={{ marginRight: 8 }}>Modifier</button>
                    <button onClick={() => deleteContact(c.id)}>Supprimer</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="3">Aucun contact</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <hr />

      {/* =========================
          Section Produits avec CRUD
          ========================= */}
      <section style={{ marginBottom: 24 }}>
        <h2>Produits</h2>

        {/* Formulaire */}
        <div style={{ marginBottom: 8 }}>
          <input
            placeholder="Nom du produit"
            value={nomProduit}
            onChange={e => setNomProduit(e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Prix"
            value={prixProduit}
            onChange={e => setPrixProduit(e.target.value)}
            style={{ marginRight: 8 }}
          />

          {editingProduitId ? (
            <>
              <button onClick={updateProduit} style={{ marginRight: 8 }}>Valider</button>
              <button onClick={cancelEditProduit}>Annuler</button>
            </>
          ) : (
            <button onClick={addProduit}>Ajouter</button>
          )}
        </div>

        {/* Tableau des produits */}
        <table border="1" width="100%" cellPadding="6">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prix (FCFA)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produits.length > 0 ? (
              produits.map(p => (
                <tr key={p.id}>
                  <td>{p.nom}</td>
                  <td>{p.prix}</td>
                  <td>
                    <button onClick={() => startEditProduit(p)} style={{ marginRight: 8 }}>Modifier</button>
                    <button onClick={() => deleteProduit(p.id)}>Supprimer</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="3">Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <hr />

      {/* =========================
          Section Commandes avec CRUD
          ========================= */}
      <section style={{ marginBottom: 24 }}>
        <h2>Commandes</h2>

        {/* Formulaire */}
        <div style={{ marginBottom: 8 }}>
          <input
            placeholder="Produit"
            value={produitCmd}
            onChange={e => setProduitCmd(e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Quantité"
            value={quantiteCmd}
            onChange={e => setQuantiteCmd(e.target.value)}
            style={{ marginRight: 8 }}
          />
          <select value={statusCmd} onChange={e => setStatusCmd(e.target.value)} style={{ marginRight: 8 }}>
            <option>En cours</option>
            <option>Livrée</option>
            <option>Annulée</option>
          </select>

          {editingCommandeId ? (
            <>
              <button onClick={updateCommande} style={{ marginRight: 8 }}>Valider</button>
              <button onClick={cancelEditCommande}>Annuler</button>
            </>
          ) : (
            <button onClick={addCommande}>Ajouter</button>
          )}
        </div>

        {/* Tableau des commandes */}
        <table border="1" width="100%" cellPadding="6">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {commandes.length > 0 ? (
              commandes.map(cmd => (
                <tr key={cmd.id}>
                  <td>{cmd.produit}</td>
                  <td>{cmd.quantite}</td>
                  <td>{cmd.status}</td>
                  <td>
                    <button onClick={() => startEditCommande(cmd)} style={{ marginRight: 8 }}>Modifier</button>
                    <button onClick={() => deleteCommande(cmd.id)}>Supprimer</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4">Aucune commande</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* =========================
          Bouton manuel pour rafraîchir toutes les données
          - Utile en développement pour forcer la synchro
          ========================= */}
      <div style={{ marginTop: 24 }}>
        <button onClick={fetchAll}>Rafraîchir toutes les données</button>
      </div>
    </div>
  );
};

export default VueGlobale;
