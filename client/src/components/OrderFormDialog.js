import React, { useState, useEffect, useCallback } from 'react';
import {
  DialogContent, TextField, Button, Stack, Grid,
  FormControl, InputLabel, Select, MenuItem, Box,
  Typography, Paper, IconButton, Chip, Divider,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { secureGet, securePost } from '../services/api';
import { format } from 'date-fns';

const OrderFormDialog = ({ onClose, onSuccess, embedded = false }) => {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [produits, setProduits] = useState([]);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 16),
    statut: 'en attente',
    contactId: '',
    produits: []
  });
  
  const [newProduit, setNewProduit] = useState({
    produitId: '',
    quantite: 1,
    prixUnitaire: 0
  });

  const fetchContacts = useCallback(async () => {
    try {
      const res = await secureGet('/api/contacts');
      if (res.data?.success) {
        setContacts(res.data.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement contacts', err);
    }
  }, []);

  const fetchProduits = useCallback(async () => {
    try {
      const res = await secureGet('/api/produits');
      if (res.data?.success) {
        setProduits(res.data.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement produits', err);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchProduits();
  }, [fetchContacts, fetchProduits]);

  const handleAddProduit = () => {
    if (!newProduit.produitId) return;
    
    const produit = produits.find(p => p.id === newProduit.produitId);
    if (!produit) return;
    
    const produitToAdd = {
      produitId: newProduit.produitId,
      quantite: newProduit.quantite,
      prixUnitaire: produit.prix || 0,
      produitNom: produit.nom
    };
    
    setFormData(prev => ({
      ...prev,
      produits: [...prev.produits, produitToAdd]
    }));
    
    setNewProduit({ produitId: '', quantite: 1, prixUnitaire: 0 });
  };

  const handleRemoveProduit = (index) => {
    setFormData(prev => ({
      ...prev,
      produits: prev.produits.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.contactId || formData.produits.length === 0) {
      alert('Veuillez sélectionner un client et ajouter au moins un produit');
      return;
    }

    setLoading(true);
    try {
      const commandeData = {
        date: new Date(formData.date).toISOString(),
        statut: formData.statut,
        contactId: formData.contactId,
        produits: formData.produits.map(p => ({
          produitId: p.produitId,
          quantite: p.quantite,
          prixUnitaire: p.prixUnitaire
        }))
      };

      const res = await securePost('/api/commandes', commandeData);
      
      if (onSuccess) {
        onSuccess(res.data.data);
      }
      
      if (!embedded) {
        onClose();
      }
    } catch (err) {
      console.error('Erreur création commande', err);
      alert('Erreur lors de la création de la commande');
    } finally {
      setLoading(false);
    }
  };

  const total = formData.produits.reduce((sum, p) => sum + (p.quantite * p.prixUnitaire), 0);
  const totalHT = total;
  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;

  return (
    <DialogContent>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Créer une nouvelle commande
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Date et heure"
              type="datetime-local"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Statut</InputLabel>
              <Select
                value={formData.statut}
                label="Statut"
                onChange={(e) => setFormData({...formData, statut: e.target.value})}
              >
                <MenuItem value="en attente">En attente</MenuItem>
                <MenuItem value="en cours">En cours</MenuItem>
                <MenuItem value="livrée">Livrée</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <FormControl fullWidth>
          <InputLabel>Client *</InputLabel>
          <Select
            value={formData.contactId}
            label="Client *"
            onChange={(e) => setFormData({...formData, contactId: e.target.value})}
            required
          >
            {contacts.map(contact => (
              <MenuItem key={contact.id} value={contact.id}>
                <Box>
                  <Typography variant="body2">
                    {contact.nom} {contact.prenom}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {contact.email} | {contact.telephone}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Section produits */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Produits
          </Typography>
          
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Produit</InputLabel>
                  <Select
                    value={newProduit.produitId}
                    label="Produit"
                    onChange={(e) => {
                      const produit = produits.find(p => p.id === e.target.value);
                      setNewProduit({
                        ...newProduit,
                        produitId: e.target.value,
                        prixUnitaire: produit?.prix || 0
                      });
                    }}
                  >
                    {produits.map(p => (
                      <MenuItem key={p.id} value={p.id}>
                        <Box>
                          <Typography variant="body2">{p.nom}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Stock: {p.stock} | Prix: {p.prix} Fcfa
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={6} md={2}>
                <TextField
                  label="Quantité"
                  type="number"
                  value={newProduit.quantite}
                  onChange={(e) => setNewProduit({...newProduit, quantite: parseInt(e.target.value) || 1})}
                  fullWidth
                  size="small"
                  inputProps={{ min: 1 }}
                />
              </Grid>
              
              <Grid item xs={6} md={3}>
                <TextField
                  label="Prix unitaire"
                  type="number"
                  value={newProduit.prixUnitaire}
                  onChange={(e) => setNewProduit({...newProduit, prixUnitaire: parseFloat(e.target.value) || 0})}
                  fullWidth
                  size="small"
                  InputProps={{ endAdornment: 'Fcfa' }}
                />
              </Grid>
              
              <Grid item xs={12} md={2}>
                <Button
                  variant="contained"
                  onClick={handleAddProduit}
                  disabled={!newProduit.produitId}
                  fullWidth
                  size="small"
                >
                  Ajouter
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Liste des produits ajoutés */}
          {formData.produits.map((produit, index) => {
            const produitInfo = produits.find(p => p.id === produit.produitId);
            return (
              <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={5}>
                    <Typography variant="body2" fontWeight="medium">
                      {produitInfo?.nom || produit.produitNom}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Réf: {produitInfo?.id || 'N/A'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={2}>
                    <Chip label={`${produit.quantite} unités`} size="small" />
                  </Grid>
                  
                  <Grid item xs={3}>
                    <Typography variant="body2">
                      {produit.prixUnitaire} Fcfa × {produit.quantite} = {produit.prixUnitaire * produit.quantite} Fcfa
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={2}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveProduit(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Paper>
            );
          })}
        </Box>

        {/* Résumé */}
        {formData.produits.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle1" gutterBottom>
              Récapitulatif
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2">Nombre de produits:</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography variant="body2" fontWeight="bold">
                  {formData.produits.length}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2">Total articles:</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography variant="body2" fontWeight="bold">
                  {formData.produits.reduce((sum, p) => sum + p.quantite, 0)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2">Total HT:</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography variant="body2" fontWeight="bold">
                  {totalHT.toFixed(0)} Fcfa
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2">TVA (20%):</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography variant="body2" fontWeight="bold">
                  {tva.toFixed(0)} Fcfa
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body1" fontWeight="bold">
                  Total TTC:
                </Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography variant="h6" color="primary" fontWeight="bold">
                  {totalTTC.toFixed(0)} Fcfa
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.contactId || formData.produits.length === 0}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              'Créer la commande'
            )}
          </Button>
        </Box>
      </Stack>
    </DialogContent>
  );
};

export default OrderFormDialog;