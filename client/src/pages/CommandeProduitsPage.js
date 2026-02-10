// pages/CommandeProduitsPage.js
// ⚡ Gestion des lignes de commande-produits
// Affiche toutes les colonnes de la table CommandeProduits
// Permet CRUD complet (ajout, modification, suppression)

import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, TextField, Stack, Typography
} from '@mui/material';
import axios from 'axios';

export default function CommandeProduitsPage() {
  const [commandeProduits, setCommandeProduits] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // Champs du formulaire
  const [commandeId, setCommandeId] = useState('');
  const [produitId, setProduitId] = useState('');
  const [quantite, setQuantite] = useState('');
  const [prixUnitaire, setPrixUnitaire] = useState('');

  // Charger toutes les lignes
  const fetchCommandeProduits = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/commandeProduits');
      setCommandeProduits(res.data);
    } catch (err) {
      console.error('Erreur chargement commandeProduits', err);
    }
  };

  useEffect(() => {
    fetchCommandeProduits();
  }, []);

  // Ajouter ou modifier
  const submitLigne = async () => {
    const payload = { commandeId, produitId, quantite, prixUnitaire };
    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/commandeProduits/${editingId}`, payload);
      } else {
        await axios.post('http://localhost:5000/api/commandeProduits', payload);
      }
      resetForm();
      fetchCommandeProduits();
    } catch (err) {
      console.error('Erreur soumission ligne', err);
    }
  };

  // Supprimer
  const deleteLigne = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/commandeProduits/${id}`);
      fetchCommandeProduits();
    } catch (err) {
      console.error('Erreur suppression ligne', err);
    }
  };

  // Réinitialiser
  const resetForm = () => {
    setEditingId(null);
    setCommandeId('');
    setProduitId('');
    setQuantite('');
    setPrixUnitaire('');
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>Gestion des lignes CommandeProduits</Typography>

      <Stack spacing={2} direction="row">
        <TextField label="Commande ID" type="number" value={commandeId} onChange={e => setCommandeId(e.target.value)} />
        <TextField label="Produit ID" type="number" value={produitId} onChange={e => setProduitId(e.target.value)} />
        <TextField label="Quantité" type="number" value={quantite} onChange={e => setQuantite(e.target.value)} />
        <TextField label="Prix unitaire" type="number" value={prixUnitaire} onChange={e => setPrixUnitaire(e.target.value)} />
        <Button variant="contained" onClick={submitLigne}>{editingId ? 'Modifier' : 'Ajouter'}</Button>
        {editingId && <Button onClick={resetForm}>Annuler</Button>}
      </Stack>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Commande ID</TableCell>
            <TableCell>Produit ID</TableCell>
            <TableCell>Quantité</TableCell>
            <TableCell>Prix unitaire</TableCell>
            <TableCell>Sous-total</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {commandeProduits.map(cp => (
            <TableRow key={cp.id}>
              <TableCell>{cp.id}</TableCell>
              <TableCell>{cp.commandeId}</TableCell>
              <TableCell>{cp.produitId}</TableCell>
              <TableCell>{cp.quantite}</TableCell>
              <TableCell>{cp.prixUnitaire}</TableCell>
              <TableCell>{cp.quantite * cp.prixUnitaire}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => {
                    setEditingId(cp.id);
                    setCommandeId(cp.commandeId);
                    setProduitId(cp.produitId);
                    setQuantite(cp.quantite);
                    setPrixUnitaire(cp.prixUnitaire);
                  }}>Modifier</Button>
                  <Button size="small" color="error" onClick={() => deleteLigne(cp.id)}>Supprimer</Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
