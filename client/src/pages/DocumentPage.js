// pages/DocumentPage.js - CORRECTION DES IMPORTS
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, CircularProgress, Alert, Grid, Card, CardContent
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  RemoveCircle as RemoveIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Email as EmailIcon
} from '@mui/icons-material';
// ✅ CORRECTION : Ajouter securePost à l'import
import { secureGet, securePost, secureDelete } from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';



export default function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocument = async () => {
    try {
      const res = await secureGet(`/api/documents/${id}`);
      console.log('📄 Réponse API document:', res.data);
      
      // ✅ CORRECTION : Extraire les données de res.data.data
      const docData = res.data?.data || res.data;
      
      if (!docData) {
        setError('Document introuvable');
        return;
      }
      
      // Normaliser les données
      const normalizedDoc = {
        id: docData.id,
        reference: docData.reference || `DOC-${docData.id}`,
        type: docData.type || 'document',
        statut: docData.statut || 'brouillon',
        client_nom: docData.client_nom || 'Client non spécifié',
        client_email: docData.client_email || '',
        client_adresse: docData.client_adresse || '',
        date_emission: docData.date_emission || docData.created_at,
        date_validite: docData.date_validite,
        total_ht: docData.total_ht || 0,
        total_tva: docData.total_tva || 0,
        total_ttc: docData.total_ttc || 0,
        tva_rate: docData.tva_rate || 20,
        notes: docData.notes || '',
        pdf_filename: docData.pdf_filename,
        lignes: Array.isArray(docData.lignes) ? docData.lignes : [],
        created_at: docData.created_at
      };
      
      setDocument(normalizedDoc);
      
    } catch (err) {
      console.error('❌ Erreur chargement document:', err);
      setError(err.response?.data?.error || 'Erreur lors du chargement du document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const handleGeneratePDF = async () => {
    try {
        setLoading(true); // Ajoutez ceci pour montrer le chargement
        
        // ✅ CORRECTION : Ajouter timeout à 60000ms (60 secondes)
        const res = await securePost(`/api/documents-puppeteer/${id}/generate-pdf-puppeteer`, {}, {
        timeout: 60000 // ⬅️ AUGMENTEZ LE TIMEOUT ICI
        });
        
        if (res.data && res.data.pdfUrl) {
        // Rafraîchir le document pour obtenir le nouveau nom de fichier
        await fetchDocument();
        
        // Ouvrir le PDF
        const pdfUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${res.data.pdfUrl}`;
        window.open(pdfUrl, '_blank');
        
        // Notification de succès
        alert('PDF généré avec succès !');
        }
    } catch (err) {
        console.error('❌ Erreur génération PDF:', err);
        
        // Message d'erreur plus informatif
        if (err.code === 'ECONNABORTED') {
        alert('Le temps de génération du PDF a dépassé la limite. Le document est peut-être trop complexe.');
        } else {
        alert('Erreur lors de la génération du PDF : ' + (err.response?.data?.error || err.message));
        }
    } finally {
        setLoading(false); // Arrêter le chargement
    }
  };

  // ==================== FONCTIONS DE GÉNÉRATION DE DOCUMENTS ====================

  /**
   * Fonction pour générer un devis à partir d'une commande
   * @param {Object} commande - La commande à convertir en devis
   */
  const handleGenererDevis = async (commande) => {
    console.log('🔄 Début handleGenererDevis pour commande:', commande.id);
    
    // Validation de la commande
    if (!commande || !commande.produits || commande.produits.length === 0) {
      alert('La commande ne contient pas de produits');
      return;
    }
    
    // Vérifier si un devis existe déjà pour cette commande
    try {
      const documentsRes = await secureGet('/api/documents');
      const documentsData = documentsRes.data?.data || [];
      
      const devisExistants = documentsData.filter(doc => 
        doc.type === 'devis' && 
        (doc.notes?.includes(`commande #${commande.id}`) || 
        doc.reference?.includes(`CMD-${commande.id}`))
      );
      
      if (devisExistants.length > 0) {
        const confirmer = window.confirm(
          `Un devis existe déjà pour cette commande (référence: ${devisExistants[0].reference}).\n` +
          `Voulez-vous créer un nouveau devis ?`
        );
        
        if (!confirmer) {
          // Ouvrir le devis existant
          if (devisExistants[0].pdf_url || devisExistants[0].pdf_filename) {
            const pdfUrl = devisExistants[0].pdf_url || 
              `http://localhost:5000/uploads/${devisExistants[0].pdf_filename}`;
            window.open(pdfUrl, '_blank');
          } else {
            // Rediriger vers la page du document
            navigate(`/documents/${devisExistants[0].id}`);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('⚠️ Impossible de vérifier les devis existants:', err.message);
    }
    
    setLoading(true);
    
    try {
      // 1. Préparer les données du devis
      const lignes = commande.produits.map(produit => ({
        description: produit.produitNom || `Produit #${produit.produitId}`,
        quantite: produit.quantite,
        prix_unitaire: produit.prixUnitaire,
        produit_id: produit.produitId
      }));
      
      const commandeReference = commande.numero_commande || `CMD-${commande.id}`;
      const clientNom = `${commande.contactNom || ''} ${commande.contactPrenom || ''}`.trim() || 'Client';
      
      const documentData = {
        type: 'devis',
        tva_rate: 20,
        reference: `DEVIS-${commandeReference}-${Date.now().toString().slice(-6)}`,
        client_nom: clientNom,
        client_email: commande.contactEmail,
        client_adresse: commande.contactAdresse || '',
        date: new Date().toISOString().split('T')[0],
        date_validite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Devis généré à partir de la commande #${commande.id} (${commandeReference})\n` +
              `Client: ${clientNom}\n` +
              `Date commande: ${commande.date ? new Date(commande.date).toLocaleDateString('fr-FR') : 'N/A'}\n` +
              `Statut commande: ${commande.statut}`,
        lignes: lignes,
        total_ht: commande.totalHT || commande.produits.reduce((sum, p) => 
          sum + (p.quantite * p.prixUnitaire), 0
        ),
        metadata: {
          commande_id: commande.id,
          commande_reference: commandeReference,
          commande_statut: commande.statut,
          commande_total: commande.total,
          generated_from: 'CommandesPage',
          generated_at: new Date().toISOString()
        }
      };
      
      console.log('📝 Création devis avec données:', documentData);
      
      // 2. Créer le document de devis
      const createRes = await securePost('/api/documents', documentData);
      
      // 3. Extraire l'ID du document
      const documentId = 
        createRes.data?.id || 
        createRes.data?.data?.id || 
        createRes.data?.document?.id ||
        (createRes.data && typeof createRes.data === 'object' ? createRes.data.id : null);
      
      if (!documentId) {
        console.error('❌ ID document non trouvé:', createRes.data);
        alert('Devis créé mais ID non reçu. Vérifiez la console.');
        return;
      }
      
      const documentReference = 
        createRes.data?.reference ||
        createRes.data?.data?.reference ||
        createRes.data?.document?.reference ||
        `DEVIS-${commandeReference}`;
      
      console.log('✅ Devis créé - ID:', documentId, 'Référence:', documentReference);
      
      alert(`Devis ${documentReference} créé avec succès ! Redirection...`);
      
      // 4. Rediriger vers la page du document
      navigate(`/documents/${documentId}`);
      
      // 5. Optionnel: générer automatiquement le PDF
      setTimeout(async () => {
        try {
          console.log(`📄 Début génération PDF pour devis #${documentId}`);
          const pdfRes = await securePost(`/api/documents-puppeteer/${documentId}/generate-pdf-puppeteer`, {}, {
            timeout: 60000
          });
          
          if (pdfRes.data?.pdfUrl) {
            const pdfUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${pdfRes.data.pdfUrl}`;
            console.log('✅ PDF généré:', pdfUrl);
            
            // Ouvrir le PDF dans un nouvel onglet
            window.open(pdfUrl, '_blank');
          }
        } catch (pdfErr) {
          console.warn('⚠️ PDF non généré automatiquement:', pdfErr.message);
          // L'utilisateur pourra générer le PDF manuellement depuis la page du document
        }
      }, 2000);
      
    } catch (err) {
      console.error('❌ Erreur génération devis:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = 'Erreur lors de la création du devis';
      
      if (err.response?.status === 404) {
        errorMessage = 'Route API /api/documents non trouvée';
      } else if (err.response?.status === 400) {
        errorMessage = err.response?.data?.error || 'Données invalides';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Timeout lors de la création du devis';
      }
      
      alert(`${errorMessage}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fonction pour générer une facture à partir d'une commande
   * @param {Object} commande - La commande à convertir en facture
   */
  const handleGenererFacture = async (commande) => {
    console.log('🔄 Début handleGenererFacture pour commande:', commande.id);
    
    // Validation de la commande
    if (!commande || !commande.produits || commande.produits.length === 0) {
      alert('La commande ne contient pas de produits');
      return;
    }
    
    // Vérification du statut
    if (commande.statut === 'annulée') {
      alert('Impossible de facturer une commande annulée');
      return;
    }
    
    // Vérifier si une facture existe déjà
    try {
      const documentsRes = await secureGet('/api/documents');
      const documentsData = documentsRes.data?.data || [];
      
      const facturesExistantes = documentsData.filter(doc => 
        doc.type === 'facture' && 
        (doc.notes?.includes(`commande #${commande.id}`) || 
        doc.reference?.includes(`CMD-${commande.id}`))
      );
      
      if (facturesExistantes.length > 0) {
        const confirmer = window.confirm(
          `Une facture existe déjà pour cette commande (référence: ${facturesExistantes[0].reference}).\n` +
          `Voulez-vous créer une nouvelle facture ?`
        );
        
        if (!confirmer) {
          // Ouvrir la facture existante
          if (facturesExistantes[0].pdf_url || facturesExistantes[0].pdf_filename) {
            const pdfUrl = facturesExistantes[0].pdf_url || 
              `http://localhost:5000/uploads/${facturesExistantes[0].pdf_filename}`;
            window.open(pdfUrl, '_blank');
          } else {
            navigate(`/documents/${facturesExistantes[0].id}`);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('⚠️ Impossible de vérifier les factures existantes:', err.message);
    }
    
    // Avertissement pour commande non livrée
    if (commande.statut !== 'livrée' && commande.statut !== 'facturée') {
      const confirmer = window.confirm(
        `La commande n'est pas encore livrée (statut: ${commande.statut}).\n` +
        `Êtes-vous sûr de vouloir générer une facture maintenant ?\n\n` +
        `Conseil : Les factures sont généralement générées après livraison.`
      );
      
      if (!confirmer) {
        return;
      }
    }
    
    setLoading(true);
    
    try {
      // 1. Préparer les données de la facture
      const lignes = commande.produits.map(produit => ({
        description: produit.produitNom || `Produit #${produit.produitId}`,
        quantite: produit.quantite,
        prix_unitaire: produit.prixUnitaire,
        produit_id: produit.produitId
      }));
      
      const commandeReference = commande.numero_commande || `CMD-${commande.id}`;
      const clientNom = `${commande.contactNom || ''} ${commande.contactPrenom || ''}`.trim() || 'Client';
      
      // Calculer les totaux
      const totalHT = commande.totalHT || commande.produits.reduce((sum, p) => 
        sum + (p.quantite * p.prixUnitaire), 0
      );
      const tvaRate = 20;
      const tva = commande.tva || totalHT * (tvaRate / 100);
      const totalTTC = commande.total || totalHT + tva;
      
      const documentData = {
        type: 'facture',
        tva_rate: tvaRate,
        reference: `FACT-${commandeReference}-${Date.now().toString().slice(-6)}`,
        client_nom: clientNom,
        client_email: commande.contactEmail,
        client_adresse: commande.contactAdresse || '',
        date: new Date().toISOString().split('T')[0],
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Facture générée à partir de la commande #${commande.id} (${commandeReference})\n` +
              `Client: ${clientNom}\n` +
              `Date commande: ${commande.date ? new Date(commande.date).toLocaleDateString('fr-FR') : 'N/A'}\n` +
              `Statut commande: ${commande.statut}\n` +
              `Conditions de paiement : 30 jours net`,
        lignes: lignes,
        total_ht: totalHT,
        total_tva: tva,
        total_ttc: totalTTC,
        statut: 'en attente',
        metadata: {
          commande_id: commande.id,
          commande_reference: commandeReference,
          commande_statut: commande.statut,
          commande_date: commande.date,
          facture_generee_le: new Date().toISOString(),
          generated_from: 'CommandesPage'
        }
      };
      
      console.log('📝 Création facture avec données:', documentData);
      
      // 2. Créer le document de facture
      const createRes = await securePost('/api/documents', documentData);
      
      // 3. Extraire l'ID du document
      const documentId = 
        createRes.data?.id || 
        createRes.data?.data?.id || 
        createRes.data?.document?.id ||
        (createRes.data && typeof createRes.data === 'object' ? createRes.data.id : null);
      
      if (!documentId) {
        console.error('❌ ID document non trouvé:', createRes.data);
        alert('Facture créée mais ID non reçu. Vérifiez la console.');
        return;
      }
      
      const documentReference = 
        createRes.data?.reference ||
        createRes.data?.data?.reference ||
        createRes.data?.document?.reference ||
        `FACT-${commandeReference}`;
      
      console.log('✅ Facture créée - ID:', documentId, 'Référence:', documentReference);
      
      // 4. Mettre à jour le statut de la commande
      if (commande.statut !== 'facturée' && commande.statut !== 'livrée') {
        try {
          await securePost(`/api/commandes/${commande.id}/update-statut`, {
            statut: 'facturée'
          });
          console.log('📝 Statut commande mis à jour: facturée');
        } catch (statutErr) {
          console.warn('⚠️ Impossible de mettre à jour le statut:', statutErr.message);
        }
      }
      
      alert(`Facture ${documentReference} créée avec succès ! Redirection...`);
      
      // 5. Rediriger vers la page du document
      navigate(`/documents/${documentId}`);
      
      // 6. Optionnel: générer automatiquement le PDF
      setTimeout(async () => {
        try {
          console.log(`📄 Début génération PDF pour facture #${documentId}`);
          const pdfRes = await securePost(`/api/documents-puppeteer/${documentId}/generate-pdf-puppeteer`, {}, {
            timeout: 60000
          });
          
          if (pdfRes.data?.pdfUrl) {
            const pdfUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${pdfRes.data.pdfUrl}`;
            console.log('✅ PDF généré:', pdfUrl);
            
            // Ouvrir le PDF
            window.open(pdfUrl, '_blank');
          }
        } catch (pdfErr) {
          console.warn('⚠️ PDF non généré automatiquement:', pdfErr.message);
        }
      }, 2000);
      
    } catch (err) {
      console.error('❌ Erreur génération facture:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      
      let errorMessage = 'Erreur lors de la création de la facture';
      
      if (err.response?.status === 404) {
        errorMessage = 'Service de documents indisponible';
      } else if (err.response?.status === 400) {
        errorMessage = err.response?.data?.error || 'Données invalides';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Timeout - le serveur met trop de temps à répondre';
      }
      
      alert(`${errorMessage}: ${err.message}`);
      
      // Offrir une alternative
      setTimeout(() => {
        const alternative = window.confirm(
          `La génération a échoué.\n` +
          `Voulez-vous créer la facture manuellement ?`
        );
        
        if (alternative) {
          window.open('/documents', '_blank');
        }
      }, 1000);
      
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fonction pour supprimer un document
   * @param {Object} document - Le document à supprimer
   * @param {Function} onSuccess - Callback après succès
   */
  const handleSupprimerDocument = async (document, onSuccess) => {
    if (!document || !document.id) {
      alert('Document invalide');
      return;
    }
    
    const confirmer = window.confirm(
      `Êtes-vous sûr de vouloir supprimer le document "${document.reference}" ?\n\n` +
      `Cette action est irréversible.`
    );
    
    if (!confirmer) return;
    
    setLoading(true);
    
    try {
      // 1. Supprimer le document
      await securePost(`/api/documents/${document.id}/delete`);
      
      // 2. Supprimer le fichier PDF associé s'il existe
      if (document.pdf_filename) {
        try {
          await securePost(`/api/documents/${document.id}/delete-pdf`);
        } catch (pdfErr) {
          console.warn('⚠️ Impossible de supprimer le PDF:', pdfErr.message);
        }
      }
      
      alert(`Document ${document.reference} supprimé avec succès`);
      
      // 3. Callback de succès
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess();
      }
      
      // 4. Rediriger vers la liste des documents
      navigate('/documents');
      
    } catch (err) {
      console.error('❌ Erreur suppression document:', err);
      alert(`Erreur lors de la suppression: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fonction pour télécharger un document PDF
   * @param {Object} document - Le document à télécharger
   */
  const handleTelechargerPDF = (document) => {
    if (!document) {
      alert('Document invalide');
      return;
    }
    
    let pdfUrl = '';
    
    // Déterminer l'URL du PDF
    if (document.pdf_url) {
      pdfUrl = document.pdf_url.startsWith('http') 
        ? document.pdf_url 
        : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${document.pdf_url}`;
    } else if (document.pdf_filename) {
      pdfUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/${document.pdf_filename}`;
    } else {
      alert('Aucun PDF disponible pour ce document');
      return;
    }
    
    // Ouvrir dans un nouvel onglet
    window.open(pdfUrl, '_blank');
  };

  /**
   * Fonction pour envoyer un document par email
   * @param {Object} document - Le document à envoyer
   */
  const handleEnvoyerEmail = async (document) => {
    if (!document || !document.client_email) {
      alert('Document invalide ou email client manquant');
      return;
    }
    
    const confirmer = window.confirm(
      `Envoyer le document "${document.reference}" à ${document.client_email} ?`
    );
    
    if (!confirmer) return;
    
    setLoading(true);
    
    try {
      const res = await securePost(`/api/documents/${document.id}/send-email`, {
        recipient: document.client_email,
        subject: `${document.type === 'facture' ? 'Facture' : 'Devis'} - ${document.reference}`,
        message: `Bonjour,\n\nVeuillez trouver ci-joint votre ${document.type} ${document.reference}.\n\nCordialement`
      });
      
      alert(res.data?.message || 'Email envoyé avec succès');
      
    } catch (err) {
      console.error('❌ Erreur envoi email:', err);
      alert(`Erreur lors de l'envoi: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  



  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Chargement du document...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/documents')}>
          Retour à la liste
        </Button>
      </Box>
    );
  }

  if (!document) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Document introuvable
        </Alert>
        <Button variant="contained" onClick={() => navigate('/documents')} sx={{ mt: 2 }}>
          Retour à la liste
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* En-tête */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          {/* ✅ CORRECTION ICI : Ajout de vérification pour .toUpperCase() */}
          <Typography variant="h4">
            {(document.type || 'DOCUMENT').toUpperCase()} - {document.reference}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Créé le {format(new Date(document.created_at), 'dd/MM/yyyy à HH:mm')}
          </Typography>
        </Box>
        
        <Box display="flex" gap={2}>
          <Chip
            label={document.statut}
            color={
              document.statut === 'payé' ? 'success' :
              document.statut === 'envoyé' ? 'info' :
              document.statut === 'brouillon' ? 'warning' : 'default'
            }
            variant="outlined"
          />
          
          <Button
            variant="contained"
            startIcon={<PdfIcon />}
            onClick={handleGeneratePDF}
          >
            Générer PDF
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleSupprimerDocument(document, () => navigate('/documents'))}
            disabled={loading}
            sx={{ ml: 1 }}
          >
            Supprimer
          </Button>

          {/*  Bouton envoyer par email */}
          {document.client_email && (
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={() => handleEnvoyerEmail(document)}
              disabled={loading || !document.pdf_filename}
              sx={{ ml: 1 }}
            >
              Envoyer
            </Button>
          )}
          
          {document.pdf_filename && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => window.open(
                `http://localhost:5000/uploads/${document.pdf_filename}`,
                '_blank'
              )}
            >
              Télécharger
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Informations client */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Client</Typography>
              <Typography variant="body1" fontWeight="medium">
                {document.client_nom}
              </Typography>
              {document.client_email && (
                <Typography variant="body2" color="text.secondary">
                  {document.client_email}
                </Typography>
              )}
              {document.client_adresse && (
                <Typography variant="body2" color="text.secondary">
                  {document.client_adresse}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Informations document */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Dates</Typography>
              <Typography variant="body2">
                <strong>Émission:</strong> {format(new Date(document.date_emission), 'dd/MM/yyyy')}
              </Typography>
              {document.date_validite && (
                <Typography variant="body2">
                  <strong>Validité:</strong> {format(new Date(document.date_validite), 'dd/MM/yyyy')}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Totaux */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Totaux</Typography>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Total HT:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {(document.total_ht || 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                  })}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">TVA ({document.tva_rate || 20}%):</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {(document.total_tva || 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                  })}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="body1" fontWeight="bold">Total TTC:</Typography>
                <Typography variant="h6" color="primary">
                  {(document.total_ttc || 0).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                  })}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Lignes du document */}
        <Grid item xs={12}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Quantité</TableCell>
                  <TableCell align="right">Prix unitaire</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {document.lignes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Aucune ligne dans ce document
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  document.lignes.map((ligne, index) => (
                    <TableRow key={index}>
                      <TableCell>{ligne.description || 'Produit'}</TableCell>
                      <TableCell align="center">{ligne.quantite || 1}</TableCell>
                      <TableCell align="right">
                        {(ligne.prix_unitaire || 0).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        })}
                      </TableCell>
                      <TableCell align="right">
                        {(ligne.total_ligne || 0).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {/* Notes */}
        {document.notes && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Notes</Typography>
                <Typography variant="body2" style={{ whiteSpace: 'pre-line' }}>
                  {document.notes}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}