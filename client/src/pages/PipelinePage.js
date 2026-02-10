// src/pages/PipelinePage.js
// ⚡ Composant React pour afficher et gérer le pipeline d'opportunités
// - Affiche les opportunités d'un contact sous forme de Kanban (colonnes par étape)
// - Permet d'ajouter une opportunité via formulaire
// - Permet de déplacer une opportunité entre étapes (drag & drop)
// - Permet de supprimer une opportunité avec un bouton

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { secureGet, securePost, securePut, secureDelete, secureUpload } from '../services/api';
import {
  Typography,
  Stack,
  TextField,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete'; // ⚡ Icône de suppression
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { se } from 'date-fns/locale';



// ⚙️ Étapes du pipeline (doivent correspondre aux valeurs en base)
const ETAPES = [
  'Prospect identifié',
  'Qualification',
  'Proposition envoyée',
  'Négociation',
  'Gagné',
  'Perdu',
];

export default function PipelinePage({ contact, onClose }) {
  // 📦 État local des opportunités
  const [opportunites, setOpportunites] = useState([]);

  // 📦 État du formulaire d’ajout
  const [titre, setTitre] = useState('');
  const [montant, setMontant] = useState('');
  const [etapeForm, setEtapeForm] = useState('Prospect identifié');

  // 🔄 Fonction pour charger les opportunités d’un contact
  const fetchOpportunites = useCallback(async (contactId) => {
    try {
      const res = await secureGet(`/api/contacts/${contactId}/opportunites`);
      setOpportunites(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erreur fetchOpportunites', err);
    }
  }, []);

  // 🔄 Charger opportunités au montage ou changement de contact
  useEffect(() => {
    if (contact?.id) {
      fetchOpportunites(contact.id);
    }
  }, [contact, fetchOpportunites]);

  // ➕ Ajouter une opportunité
  const ajouterOpportunite = async () => {
    if (!titre || !montant) return;
    try {
      await securePost(`/api/contacts/${contact.id}/opportunites`, {
        titre,
        montant,
        etape: etapeForm,
      });
      // Réinitialiser le formulaire
      setTitre('');
      setMontant('');
      setEtapeForm('Prospect identifié');
      // Recharger les opportunités
      fetchOpportunites(contact.id);
    } catch (err) {
      console.error('Erreur POST opportunite', err);
    }
  };

  // ❌ Supprimer une opportunité
  const supprimerOpportunite = async (id) => {
    try {
      await secureDelete(`/api/opportunites/${id}`);
      // Mise à jour locale immédiate
      setOpportunites((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error('Erreur DELETE opportunite', err);
    }
  };

  // 🔁 Groupage des opportunités par étape
  const colonnes = useMemo(() => {
    const map = {};
    ETAPES.forEach((e) => {
      map[e] = [];
    });
    opportunites.forEach((op) => {
      const key = ETAPES.includes(op.etape) ? op.etape : 'Prospect identifié';
      map[key].push(op);
    });
    return map;
  }, [opportunites]);

  // 🧠 Gestion du drag & drop
  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const op = opportunites.find((o) => String(o.id) === String(draggableId));
    if (!op) return;

    // ⚡ Optimistic UI : mise à jour immédiate
    setOpportunites((prev) =>
      prev.map((o) => (o.id === op.id ? { ...o, etape: destination.droppableId } : o))
    );

    try {
      await securePut(`/api/opportunites/${op.id}`, {
        etape: destination.droppableId,
      });
    } catch (err) {
      console.error('Erreur PUT opportunite', err);
      // rollback si erreur
      setOpportunites((prev) =>
        prev.map((o) => (o.id === op.id ? { ...o, etape: source.droppableId } : o))
      );
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* En-tête */}
      <Typography variant="h6" gutterBottom>
        Pipeline – {contact?.nom} {contact?.prenom}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Email: {contact?.email} • Tél: {contact?.telephone} • Type: {contact?.typeContact}
      </Typography>

      {/* Formulaire ajout */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          size="small"
        />
        <TextField
          label="Montant"
          type="number"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          size="small"
        />
        <Select
          size="small"
          value={etapeForm}
          onChange={(e) => setEtapeForm(e.target.value)}
        >
          {ETAPES.map((e) => (
            <MenuItem key={e} value={e}>
              {e}
            </MenuItem>
          ))}
        </Select>
        <Button variant="contained" onClick={ajouterOpportunite}>
          Ajouter
        </Button>
        <Button variant="text" onClick={onClose}>
          Fermer
        </Button>
      </Stack>

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${ETAPES.length}, 1fr)`,
            gap: 12,
            minHeight: 300,
          }}
        >
          {ETAPES.map((etape) => (
            <Droppable droppableId={etape} key={etape}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: 8,
                    background: snapshot.isDraggingOver ? '#f5f5f5' : '#fff',
                    minHeight: 200,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {etape} ({colonnes[etape]?.length ?? 0})
                  </Typography>

                  {(colonnes[etape] || []).map((op, index) => (
                    <Draggable draggableId={String(op.id)} index={index} key={op.id}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          style={{
                            userSelect: 'none',
                            padding: 8,
                            marginBottom: 8,
                            borderRadius: 6,
                            border: '1px solid #e0e0e0',
                            background: dragSnapshot.isDragging ? '#e3f2fd' : '#fafafa',
                            ...dragProvided.draggableProps.style,
                          }}
                        >
                          {/* Infos opportunité */}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {op.titre}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Montant: {op.montant}
                          </Typography>

                          {/* Bouton supprimer */}
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => supprimerOpportunite(op.id)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
