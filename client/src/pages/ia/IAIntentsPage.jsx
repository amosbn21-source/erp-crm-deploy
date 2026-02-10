import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Menu,
  MenuItem
} from '@mui/material';
import { 
  Check as CheckIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import iaService from '../../services/api-ia';

export default function IAIntentsPage() {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedIntentId, setSelectedIntentId] = useState(null);

  useEffect(() => {
    fetchIntents();
  }, []);

  const fetchIntents = async () => {
    try {
      setLoading(true);
      const response = await iaService.getIntents();
      if (response.success) {
        setIntents(response.intents);
      } else {
        setError(response.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Erreur intentions:', error);
      setError('Impossible de charger les intentions');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertIntent = async (intentId) => {
    try {
      const response = await iaService.convertIntentToOrder(intentId);
      if (response.success) {
        // Rafraîchir la liste
        fetchIntents();
        setConvertDialogOpen(false);
      } else {
        setError(response.error || 'Erreur lors de la conversion');
      }
    } catch (error) {
      console.error('Erreur conversion:', error);
      setError('Erreur lors de la conversion');
    }
  };

  const handleMenuOpen = (event, intentId) => {
    setAnchorEl(event.currentTarget);
    setSelectedIntentId(intentId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIntentId(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'detected': return 'warning';
      case 'converted': return 'success';
      case 'ignored': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'detected': return 'Détecté';
      case 'converted': return 'Converti';
      case 'ignored': return 'Ignoré';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              🎯 Intentions d'achat
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Opportunités détectées par l'IA ({intents.length} au total)
            </Typography>
          </Box>
          <Button 
            startIcon={<RefreshIcon />}
            onClick={fetchIntents}
            variant="outlined"
          >
            Actualiser
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: 'primary.light' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Produit</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Confiance</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Statut</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {intents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="textSecondary" py={3}>
                    Aucune intention détectée pour le moment
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              intents.map((intent) => (
                <TableRow key={intent.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {intent.nom} {intent.prenom}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {intent.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {intent.product_details ? (
                      <Typography>{intent.product_details.nom || 'Produit'}</Typography>
                    ) : (
                      <Typography color="textSecondary">Non spécifié</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={`${Math.round(intent.confidence_score * 100)}%`}
                      color={
                        intent.confidence_score >= 0.8 ? 'success' :
                        intent.confidence_score >= 0.5 ? 'warning' : 'error'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusText(intent.status)}
                      color={getStatusColor(intent.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(intent.created_at).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    {intent.status === 'detected' && (
                      <>
                        <IconButton 
                          color="success" 
                          onClick={() => handleConvertIntent(intent.id)}
                          title="Convertir en commande"
                        >
                          <CheckIcon />
                        </IconButton>
                        <IconButton 
                          color="error"
                          title="Ignorer"
                        >
                          <CloseIcon />
                        </IconButton>
                      </>
                    )}
                    <IconButton 
                      onClick={(e) => handleMenuOpen(e, intent.id)}
                      title="Plus d'options"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          // Voir les détails
        }}>
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
          Voir détails
        </MenuItem>
        <MenuItem onClick={() => {
          handleMenuClose();
          // Voir le profil client
        }}>
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
          Profil client
        </MenuItem>
      </Menu>

      {/* Dialog de conversion */}
      <Dialog open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)}>
        <DialogTitle>Convertir en commande</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir convertir cette intention en commande ?
          </Typography>
          {selectedIntent && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                Client: {selectedIntent.nom} {selectedIntent.prenom}
              </Typography>
              <Typography variant="body2">
                Produit: {selectedIntent.product_details?.nom}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertDialogOpen(false)}>Annuler</Button>
          <Button 
            variant="contained" 
            onClick={() => selectedIntent && handleConvertIntent(selectedIntent.id)}
          >
            Convertir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}