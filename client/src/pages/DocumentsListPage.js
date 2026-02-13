// pages/DocumentsListPage.js - VERSION CORRIGÉE
import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, Stack, Typography, Paper, Chip, Box,
  IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, Alert, CircularProgress,
  Card, CardContent, Grid
} from '@mui/material';
// En haut du fichier avec les autres imports :
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Description as DocumentIcon, // <-- Déjà importé
  Receipt as InvoiceIcon,
  Description as QuoteIcon,
  Description // <-- Ajoutez cette ligne
} from '@mui/icons-material';
import { secureGet, securePost, secureDelete, securePut } from '../services/api';
import { format } from 'date-fns';

export default function DocumentsListPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formData, setFormData] = useState({
    type: 'devis',
    client_nom: '',
    client_email: '',
    client_adresse: '',
    tva_rate: 20,
    notes: '',
    lignes: [{ description: '', quantite: 1, prix_unitaire: 0 }]
  });

  // Charger les documents
  const fetchDocuments = async () => {
    setLoading(true);
    try {
        const res = await secureGet('/documents');
        console.log('📄 Réponse API documents complète:', res);
        
        // ✅ EXTRACTION CORRECTE DES DONNÉES
        let documentsData = [];
        
        if (res.data && res.data.success === true) {
        if (Array.isArray(res.data.data)) {
            documentsData = res.data.data;
            console.log('📄 Données extraites (tableau):', documentsData.length);
        } else {
            console.warn('⚠️ res.data.data n\'est pas un tableau:', res.data.data);
        }
        } else {
        console.warn('⚠️ Réponse API non standard:', res.data);
        // Fallback: essayer res.data directement
        if (Array.isArray(res.data)) {
            documentsData = res.data;
            console.log('📄 Fallback: données extraites de res.data:', documentsData.length);
        }
        }
        
        // ✅ NORMALISER LES DONNÉES CLIENTS
        const normalizedDocs = documentsData.map(doc => ({
        id: doc.id,
        reference: doc.reference || `DOC-${doc.id}`,
        type: doc.type || 'devis',
        statut: doc.statut || 'brouillon',
        // ✅ FORCER LES CHAMPS CLIENTS AVEC VALEURS PAR DÉFAUT
        client_nom: doc.client_nom || 'Client non spécifié',
        client_email: doc.client_email || '',
        client_adresse: doc.client_adresse || '',
        date_emission: doc.date_emission || doc.created_at,
        total_ht: doc.total_ht || 0,
        total_tva: doc.total_tva || 0,
        total_ttc: doc.total_ttc || 0,
        pdf_filename: doc.pdf_filename,
        created_at: doc.created_at
        }));
        
        console.log(`📄 ${normalizedDocs.length} document(s) normalisé(s)`);
        console.log('🔍 Premier document:', normalizedDocs[0]);
        
        setDocuments(normalizedDocs);
        
    } catch (err) {
        console.error('❌ Erreur fetchDocuments:', err);
        console.error('❌ Détails erreur:', err.response?.data || err.message);
        setDocuments([]);
    } finally {
        setLoading(false);
    }
    };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Fonction pour obtenir l'icône selon le type
  const getDocumentIcon = (type) => {
    switch (type) {
      case 'facture': return <InvoiceIcon />;
      case 'devis': return <QuoteIcon />;
      default: return <DocumentIcon />;
    }
  };

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (statut) => {
    switch (statut) {
      case 'payé': return 'success';
      case 'envoyé': return 'info';
      case 'brouillon': return 'warning';
      case 'annulé': return 'error';
      default: return 'default';
    }
  };

  // Fonction pour générer un PDF
  const handleGeneratePDF = async (documentId) => {
    try {
      const res = await securePost(`/api/documents-puppeteer/${documentId}/generate-pdf-puppeteer`);
      
      if (res.data && res.data.pdfUrl) {
        // Ouvrir le PDF dans un nouvel onglet
        const pdfUrl = `http://localhost:5000${res.data.pdfUrl}`;
        window.open(pdfUrl, '_blank');
      }
    } catch (err) {
      console.error('❌ Erreur génération PDF:', err);
      alert('Erreur lors de la génération du PDF');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Chargement des documents...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gestion des Documents</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Nouveau Document
        </Button>
      </Box>

      {/* Statistiques */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">{documents.length}</Typography>
              <Typography variant="caption" color="text.secondary">
                Documents totaux
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                {documents.filter(d => d.type === 'facture').length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Factures
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                {documents.filter(d => d.type === 'devis').length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Devis
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                {documents.filter(d => d.statut === 'payé').length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Payés
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Liste des documents */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Référence</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Montant</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <DocumentIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    Aucun document trouvé
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Créez votre premier document
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {getDocumentIcon(doc.type)}
                      <Typography variant="body2" sx={{ ml: 1, fontWeight: 'bold' }}>
                        {doc.reference}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={doc.type === 'facture' ? 'Facture' : 'Devis'}
                      size="small"
                      color={doc.type === 'facture' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{doc.client_nom}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.client_email || 'Email non renseigné'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {doc.date_emission 
                      ? format(new Date(doc.date_emission), 'dd/MM/yyyy')
                      : 'Non définie'
                    }
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={doc.statut}
                      size="small"
                      color={getStatusColor(doc.statut)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {doc.total_ttc?.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                      }) || '0 Fcfa'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      HT: {(doc.total_ht || 0).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton
                        size="small"
                        title="Voir"
                        onClick={() => window.open(`/documents/${doc.id}`, '_blank')}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      {doc.pdf_filename && (
                        <IconButton
                          size="small"
                          title="Télécharger PDF"
                          onClick={() => window.open(
                            `http://localhost:5000/uploads/${doc.pdf_filename}`,
                            '_blank'
                          )}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        title="Générer PDF"
                        onClick={() => handleGeneratePDF(doc.id)}
                      >
                        <Description fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
