// src/components/ProductDetailsDialog.js
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Grid,
  Box,
  Chip,
  Divider,
  Stack,
  Button
} from '@mui/material';
import { Close as CloseIcon, Image as ImageIcon } from '@mui/icons-material';
import StockChip from './StockChip'; // si vous avez extrait ce composant, sinon importez-le depuis ProduitsPage

// Si StockChip n'est pas encore extrait, vous pouvez le définir ici ou l'importer.
// Pour simplifier, je vais supposer que StockChip est exporté depuis un fichier commun.

const ProductDetailsDialog = ({ open, produit, onClose, buildImageUrl, onEdit }) => {
  console.log('🎯 Modal - open:', open, 'produit:', produit);
  const [selectedImage, setSelectedImage] = useState(0);

  if (!produit) return null;

  // Gestion des images : on suppose que produit.images est un tableau, ou produit.image est une chaîne
  const images = produit.images && Array.isArray(produit.images) && produit.images.length > 0
    ? produit.images
    : produit.image
    ? [produit.image]
    : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Détails du produit
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Galerie d'images */}
          <Grid item xs={12} md={6}>
            {images.length > 0 ? (
              <>
                <Box
                  sx={{
                    width: '100%',
                    height: 300,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    bgcolor: '#f5f5f5',
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={buildImageUrl(images[selectedImage])}
                    alt={produit.nom}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/fallback-image.png';
                    }}
                  />
                </Box>
                {images.length > 1 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 2, overflowX: 'auto', pb: 1 }}
                  >
                    {images.map((img, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        sx={{
                          width: 60,
                          height: 60,
                          flexShrink: 0,
                          border: selectedImage === idx ? '2px solid primary.main' : '1px solid #ccc',
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          bgcolor: '#f5f5f5'
                        }}
                      >
                        <img
                          src={buildImageUrl(img)}
                          alt={`mini-${idx}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/fallback-image.png';
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </>
            ) : (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                height={300}
                bgcolor="#f5f5f5"
                borderRadius={1}
              >
                <ImageIcon sx={{ fontSize: 100, color: 'text.disabled' }} />
              </Box>
            )}
          </Grid>

          {/* Informations produit */}
          <Grid item xs={12} md={6}>
            <Typography variant="h5" gutterBottom>
              {produit.nom}
            </Typography>
            <Chip
              label={produit.categorie || 'Non catégorisé'}
              size="small"
              sx={{ mb: 2 }}
            />
            <Typography variant="body1" paragraph>
              {produit.description || 'Aucune description'}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" color="primary">
                {parseFloat(produit.prix || 0).toFixed()} Fcfa
              </Typography>
              {/* On suppose que StockChip est disponible, soit importé, soit défini ici */}
              <StockChip stock={produit.stock} />
            </Box>
            {produit.codeBarres && (
              <Typography variant="body2" sx={{ mt: 2 }}>
                <strong>Code-barres :</strong> {produit.codeBarres}
              </Typography>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
        <Button
          variant="contained"
          onClick={() => {
            onClose();
            onEdit(produit);
          }}
        >
          Modifier
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductDetailsDialog;
