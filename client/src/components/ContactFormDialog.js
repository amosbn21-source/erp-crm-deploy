import React, { useState } from 'react';
import {
  DialogContent, TextField, Button, Stack, Grid,
  FormControl, InputLabel, Select, MenuItem,
  Typography, Box, CircularProgress  // Ajout de Box ici
} from '@mui/material';
import { securePost } from '../services/api';

const ContactFormDialog = ({ onClose, onSuccess, embedded = false }) => {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    entreprise: '',
    typeContact: 'client',
    adresse: '',
    ville: '',
    codePostal: '',
    pays: '',
    notes: ''
  });

  const handleSubmit = async () => {
    if (!formData.nom || !formData.email) {
      alert('Le nom et l\'email sont obligatoires');
      return;
    }

    setLoading(true);
    try {
      const contactData = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim() || null,
        email: formData.email.trim(),
        telephone: formData.telephone.trim() || null,
        entreprise: formData.entreprise.trim() || null,
        typeContact: formData.typeContact,
        adresse: formData.adresse.trim() || null,
        ville: formData.ville.trim() || null,
        codePostal: formData.codePostal.trim() || null,
        pays: formData.pays.trim() || null,
        notes: formData.notes.trim() || null
      };

      const res = await securePost('/api/contacts', contactData);
      
      if (onSuccess) {
        onSuccess(res.data.data);
      }
      
      if (!embedded) {
        onClose();
      }
    } catch (err) {
      console.error('Erreur création contact', err);
      alert('Erreur lors de la création du contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Créer un nouveau contact
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Nom *"
              value={formData.nom}
              onChange={(e) => setFormData({...formData, nom: e.target.value})}
              fullWidth
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Prénom"
              value={formData.prenom}
              onChange={(e) => setFormData({...formData, prenom: e.target.value})}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              fullWidth
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Téléphone"
              value={formData.telephone}
              onChange={(e) => setFormData({...formData, telephone: e.target.value})}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Entreprise"
              value={formData.entreprise}
              onChange={(e) => setFormData({...formData, entreprise: e.target.value})}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Type de contact</InputLabel>
              <Select
                value={formData.typeContact}
                label="Type de contact"
                onChange={(e) => setFormData({...formData, typeContact: e.target.value})}
              >
                <MenuItem value="client">Client</MenuItem>
                <MenuItem value="prospect">Prospect</MenuItem>
                <MenuItem value="fournisseur">Fournisseur</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Adresse"
              value={formData.adresse}
              onChange={(e) => setFormData({...formData, adresse: e.target.value})}
              fullWidth
              multiline
              rows={2}
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <TextField
              label="Ville"
              value={formData.ville}
              onChange={(e) => setFormData({...formData, ville: e.target.value})}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <TextField
              label="Code postal"
              value={formData.codePostal}
              onChange={(e) => setFormData({...formData, codePostal: e.target.value})}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <TextField
              label="Pays"
              value={formData.pays}
              onChange={(e) => setFormData({...formData, pays: e.target.value})}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              fullWidth
              multiline
              rows={3}
              placeholder="Informations complémentaires..."
            />
          </Grid>
        </Grid>

        <Box display="flex" justifyContent="flex-end" gap={2}> {/* Box utilisé ici */}
          <Button onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.nom || !formData.email}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              'Créer le contact'
            )}
          </Button>
        </Box>
      </Stack>
    </DialogContent>
  );
};

export default ContactFormDialog;