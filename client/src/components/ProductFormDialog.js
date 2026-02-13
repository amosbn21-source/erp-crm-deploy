import React, { useState, useRef } from 'react';
import {
  DialogContent, TextField, Button, Stack, Grid,
  Typography, Box, IconButton, CircularProgress
} from '@mui/material';
import { Image as ImageIcon, Close as CloseIcon } from '@mui/icons-material';
import { secureUpload } from '../services/api';

const ProductFormDialog = ({ onClose, onSuccess, embedded = false }) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    prix: '',
    stock: '',
    codeBarres: '',
    categorie: ''
  });

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearFile = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!formData.nom || !formData.prix || !formData.categorie) {
      alert('Le nom, le prix et la catégorie sont obligatoires');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('nom', formData.nom.trim());
      form.append('description', formData.description.trim() || '');
      form.append('prix', Number(formData.prix) || 0);
      form.append('stock', Number(formData.stock) || 0);
      form.append('codeBarres', formData.codeBarres.trim() || '');
      form.append('categorie', formData.categorie.trim());
      
      if (imageFile) {
        form.append('image', imageFile);
      }

      const res = await secureUpload('/produits', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (onSuccess) {
        onSuccess(res.data);
      }
      
      if (!embedded) {
        onClose();
      }
    } catch (err) {
      console.error('Erreur création produit', err);
      alert('Erreur lors de la création du produit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <Stack spacing={3}>
        <Typography variant="h6" gutterBottom>
          Créer un nouveau produit
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Nom du produit *"
              value={formData.nom}
              onChange={(e) => setFormData({...formData, nom: e.target.value})}
              fullWidth
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Prix (Fcfa) *"
              value={formData.prix}
              onChange={(e) => setFormData({...formData, prix: e.target.value})}
              type="number"
              fullWidth
              required
              InputProps={{ endAdornment: 'Fcfa' }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Stock initial"
              value={formData.stock}
              onChange={(e) => setFormData({...formData, stock: e.target.value})}
              type="number"
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Code barres"
              value={formData.codeBarres}
              onChange={(e) => setFormData({...formData, codeBarres: e.target.value})}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Catégorie *"
              value={formData.categorie}
              onChange={(e) => setFormData({...formData, categorie: e.target.value})}
              fullWidth
              required
              placeholder="Ex: Électronique, Alimentaire, etc."
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              fullWidth
              multiline
              rows={3}
              placeholder="Description détaillée du produit..."
            />
          </Grid>
          
          {/* Image */}
          <Grid item xs={12}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Image du produit
              </Typography> {/* CORRECTION : fermeture correcte */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                />
                <Button 
                  variant="outlined" 
                  onClick={handleChooseFile}
                  startIcon={<ImageIcon />}
                >
                  Choisir une image
                </Button>
                
                {imagePreview && (
                  <Box sx={{ position: 'relative' }}>
                    <img 
                      src={imagePreview} 
                      alt="Aperçu" 
                      style={{ 
                        width: 100, 
                        height: 100, 
                        objectFit: 'cover', 
                        borderRadius: 4 
                      }} 
                    />
                    <IconButton
                      size="small"
                      onClick={clearFile}
                      sx={{ 
                        position: 'absolute', 
                        top: -8, 
                        right: -8,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.nom || !formData.prix || !formData.categorie}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              'Créer le produit'
            )}
          </Button>
        </Box>
      </Stack>
    </DialogContent>
  );
};

export default ProductFormDialog;
