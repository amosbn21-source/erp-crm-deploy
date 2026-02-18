// pages/CommandesPage.js
// ✅ VERSION COMPLÈTE AVEC TOUTES LES FONCTIONNALITÉS
// ✅ MODIFICATION : Ajout des boutons Devis/Facture dans la section détails

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  Button, Stack, Typography, CircularProgress, Chip, Box,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Paper, Snackbar, Grid, Card, CardContent,
  Menu, Tooltip, Avatar, Badge, LinearProgress, Divider
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingIcon,
  ShoppingCart as CartIcon,
  Person as PersonIcon,
  MoreVert as MoreIcon,
  AttachMoney as MoneyIcon,
  Inventory as InventoryIcon,
  CalendarToday as CalendarIcon,
  Description as DevisIcon,
  Description,
  Receipt as FactureIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { secureGet, securePost, securePut, secureDelete, securePatch } from '../services/api';
import { format } from 'date-fns';
import { fr, se } from 'date-fns/locale';

// Composant Alert pour les notifications
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

// Composant pour les statuts
const StatusChip = ({ status }) => {
  const getStatusColor = (statut) => {
    switch (statut) {
      case 'livrée': return { color: 'success', label: 'Livrée' };
      case 'en cours': return { color: 'warning', label: 'En cours' };
      case 'en attente': return { color: 'info', label: 'En attente' };
      case 'annulée': return { color: 'error', label: 'Annulée' };
      default: return { color: 'default', label: statut };
    }
  };
  
  const statusInfo = getStatusColor(status);
  
  const [contacts, setContacts] = useState([]); // Déjà correct si c'est un tableau vide

  return (
    <Chip 
      label={statusInfo.label}
      size="small"
      color={statusInfo.color}
      variant="outlined"
    />
  );
};

export default function CommandesPage() {
  // ==================== ÉTATS PRINCIPAUX ====================
  const [commandes, setCommandes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [produits, setProduits] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedCommande, setSelectedCommande] = useState(null);
  
  // ==================== ÉTATS FORMULAIRE ====================
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCommande, setEditingCommande] = useState(null);
  const [date, setDate] = useState('');
  const [statut, setStatut] = useState('en attente');
  const [total, setTotal] = useState(0);
  const [contactId, setContactId] = useState('');
  const [produitsSelectionnes, setProduitsSelectionnes] = useState([]);
  
  // ==================== ÉTATS NOTIFICATIONS ====================
  const [notif, setNotif] = useState({ open: false, message: '', type: 'success' });

  const showNotif = useCallback((message, type = 'success') => {
    setNotif({ open: true, message, type });
  }, []);

  // ==================== ÉTATS FILTRES ====================
  const [filters, setFilters] = useState({
    dateDebut: '',
    dateFin: '',
    clientId: '',
    statut: '',
    produitNom: ''
  });
  

  // ==================== FONCTIONS DE CHARGEMENT ====================
  

  const resetFilters = () => {
    setFilters({
      dateDebut: '',
      dateFin: '',
      clientId: '',
      statut: '',
      produitNom: ''
    });
  };

  const statutsOptions = ['en attente', 'en cours', 'livrée', 'annulée'];
  
  const fetchCommandes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureGet('/commandes');
      console.log('📦 Réponse API commandes:', res.data);
      
      const commandesData = res.data?.data || [];
      
      // ✅ CORRECTION : Normaliser les noms de propriétés snake_case → camelCase
      const safe = commandesData.map(cmd => {
        const normalizedCmd = {
          ...cmd,
          contactNom: cmd.contact_nom || cmd.contactNom || '',
          contactPrenom: cmd.contact_prenom || cmd.contactPrenom || '',
          contactEmail: cmd.contact_email || cmd.contactEmail || '',
          contactTelephone: cmd.contact_telephone || cmd.contactTelephone || '',
          contactId: cmd.contact_id || cmd.contactId,
          total: cmd.total_ht || cmd.total || 0,            // ← on utilise total_ht comme total
          date: cmd.date || cmd.created_at,
          produits: Array.isArray(cmd.produits) ? cmd.produits.map(p => ({
            ...p,
            produitId: p.produit_id || p.produitId,
            produitNom: p.produit_nom || p.produitNom,
            prixUnitaire: p.prix_unitaire || p.prixUnitaire || 0,
            sousTotal: p.sousTotal || (p.quantite * (p.prix_unitaire || p.prixUnitaire || 0))
          })) : []
        };
        return normalizedCmd;
      });
      
      console.log('📦 Commandes chargées:', safe.length);
      setCommandes(safe);
    } catch (err) {
      console.error('❌ Erreur chargement commandes', err);
      showNotif('Erreur lors du chargement des commandes', 'error');
      setCommandes([]);
    } finally {
      setLoading(false);
    }
  }, [showNotif]);

  const filteredCommandes = useMemo(() => {
    return commandes.filter(cmd => {
      // Filtre par date de début
      if (filters.dateDebut && new Date(cmd.date) < new Date(filters.dateDebut)) return false;
      // Filtre par date de fin
      if (filters.dateFin && new Date(cmd.date) > new Date(filters.dateFin)) return false;
      // Filtre par client
      if (filters.clientId && cmd.contactId != filters.clientId) return false;
      // Filtre par statut
      if (filters.statut && cmd.statut !== filters.statut) return false;
      // Filtre par produit (recherche dans les noms de produits de la commande)
      if (filters.produitNom) {
        const searchTerm = filters.produitNom.toLowerCase();
        const hasProduct = cmd.produits.some(p => 
          p.produitNom && p.produitNom.toLowerCase().includes(searchTerm)
        );
        if (!hasProduct) return false;
      }
      return true;
    });
  }, [commandes, filters]);

  

  // Modifiez la fonction fetchContacts :

  const fetchContacts = useCallback(async () => {
    console.log('🔍 fetchContacts appelé');

    try {
      const res = await secureGet('/contacts'); // ⚠️ PAS /api/commandes/contacts
      
      console.log('📋 Réponse API contacts (appel unique):', res.data?.data?.length || 0)
      
      // Extraction sécurisée
      let contactsData = [];
      
      if (res.data && res.data.success === true) {
        if (Array.isArray(res.data.data)) {
          contactsData = res.data.data;
        } else if (Array.isArray(res.data)) {
          contactsData = res.data;
        }
      }
      
      // ✅ Dédupliquer par ID
      const uniqueContacts = [];
      const seenIds = new Set();
      
      contactsData.forEach(contact => {
        if (contact && contact.id && !seenIds.has(contact.id)) {
          seenIds.add(contact.id);
          uniqueContacts.push(contact);
        }
      });
      
      setContacts(uniqueContacts);
      console.log('👥 Contacts chargés:', uniqueContacts.length, '(dédupliqués)');
      
    } catch (err) {
      console.error('❌ Erreur chargement contacts', err);
      setContacts([]);
    }
  }, []);
  useEffect(() => {
    console.log('🔍 DEBUG - Contacts dans state:', contacts);
    console.log('🔍 DEBUG - Nombre de contacts:', contacts.length);
    console.log('🔍 DEBUG - IDs uniques:', [...new Set(contacts.map(c => c.id))]);
  }, [contacts]);
  


  const fetchProduits = useCallback(async () => {
    try {
      console.log('🛍️ Début fetchProduits...');
      const res = await secureGet('/produits');
      console.log('🔗 URL appelée: /api/produits');
      console.log('🔗 Token présent:', !!localStorage.getItem('authToken'));
      console.log('🛍️ Réponse API produits complète:', res);
      console.log('🛍️ Réponse data:', res.data);
      
      // ✅ CORRECTION : L'API retourne { success: true, data: [...], count: ..., schema: ... }
      // Nous devons extraire res.data.data
      let produitsData = [];
      
      if (res.data && res.data.success === true) {
        if (Array.isArray(res.data.data)) {
          produitsData = res.data.data;
          console.log('🛍️ Données extraites (tableau):', produitsData.length);
        } else {
          console.warn('⚠️ res.data.data n\'est pas un tableau:', res.data.data);
        }
      } else {
        console.warn('⚠️ Réponse API non standard:', res.data);
        // Fallback: essayer res.data directement
        if (Array.isArray(res.data)) {
          produitsData = res.data;
          console.log('🛍️ Fallback: données extraites de res.data:', produitsData.length);
        }
      }
      
      // Normaliser les propriétés (snake_case → camelCase)
      const normalizedProduits = produitsData.map(p => ({
        id: p.id,
        nom: p.nom || '',
        description: p.description || '',
        prix: parseFloat(p.prix || 0),
        stock: parseInt(p.stock || 0),
        code_barres: p.code_barres || '',
        categorie: p.categorie || '',
        image: p.image || ''
      }));
      
      // Filtrer les produits avec stock > 0 pour la sélection
      const produitsAvecStock = normalizedProduits.filter(p => p.stock > 0);
      
      console.log('🛍️ Produits normalisés:', normalizedProduits.length);
      console.log('🛍️ Produits avec stock > 0:', produitsAvecStock.length);
      
      if (produitsAvecStock.length === 0) {
        console.warn('⚠️ Aucun produit avec stock disponible');
        showNotif('Aucun produit avec stock disponible. Créez des produits d\'abord.', 'warning');
      }
      
      setProduits(produitsAvecStock);
      
    } catch (err) {
      console.error('❌ Erreur fetchProduits:', err);
      console.error('❌ Détails erreur:', err.response?.data || err.message);
      
      // Afficher un message d'erreur spécifique
      if (err.response?.status === 404) {
        showNotif('API produits non disponible (404). Vérifiez le serveur.', 'error');
      } else if (err.response?.status === 401) {
        showNotif('Non autorisé à accéder aux produits.', 'error');
      } else {
        showNotif('Erreur lors du chargement des produits', 'error');
      }
      
      setProduits([]);
    }
  }, [showNotif]);


  const fetchStats = useCallback(async () => {
    try {
      const res = await secureGet('/commandes/stats');
      console.log('📊 Réponse API stats:', res.data);
      
      const statsData = res.data?.data || {};
      
      // ✅ Normaliser les noms si nécessaire
      const normalizedStats = {
        total_commandes: statsData.total_commandes || 0,
        chiffre_affaires: statsData.chiffre_affaires || 0,
        moyenne_commande: statsData.moyenne_commande || 0,
        en_cours: statsData.en_cours || 0,
        livrees: statsData.livrees || 0,
        en_attente: statsData.en_attente || 0,
        annulees: statsData.annulees || 0
      };
      
      setStats(normalizedStats);
    } catch (err) {
      console.error('❌ Erreur chargement stats', err);
      setStats(null);
    }
  }, []);

  useEffect(() => {
    fetchCommandes();
    fetchContacts();
    fetchProduits();
    fetchStats();
  }, [fetchCommandes, fetchContacts, fetchProduits, fetchStats]);

  const filteredStats = useMemo(() => {
    const total_commandes = filteredCommandes.length;
    const chiffre_affaires = filteredCommandes
      .filter(cmd => cmd.statut === 'livrée')
      .reduce((sum, cmd) => sum + (cmd.total || 0), 0);
    const moyenne_commande = total_commandes > 0
      ? filteredCommandes.reduce((sum, cmd) => sum + (cmd.total || 0), 0) / total_commandes
      : 0;
    const en_cours = filteredCommandes.filter(cmd => cmd.statut === 'en cours').length;
    const livrees = filteredCommandes.filter(cmd => cmd.statut === 'livrée').length;
    const en_attente = filteredCommandes.filter(cmd => cmd.statut === 'en attente').length;
    const annulees = filteredCommandes.filter(cmd => cmd.statut === 'annulée').length;
  
    return {
      total_commandes,
      chiffre_affaires,
      moyenne_commande,
      en_cours,
      livrees,
      en_attente,
      annulees
    };
  }, [filteredCommandes]);

  

  // ==================== NOUVELLES FONCTIONS POUR GÉNÉRATION DE DOCUMENTS ====================
  
  /**
   * Fonction pour générer un devis à partir d'une commande
   * @param {Object} commande - La commande à convertir en devis
   */
  

  const handleGenererDevis = async (commande) => {
    console.log('🔄 Début handleGenererDevis pour commande:', commande.id);
    
    if (!commande || !commande.produits || commande.produits.length === 0) {
      showNotif('La commande ne contient pas de produits', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const lignes = commande.produits.map(produit => ({
        description: produit.produitNom || `Produit #${produit.produitId}`,
        quantite: produit.quantite,
        prix_unitaire: produit.prixUnitaire
      }));
      
      const documentData = {
        type: 'devis',
        tva_rate: 20,
        notes: `Devis généré à partir de la commande #${commande.id}\nClient: ${getContactName(commande)}`,
        lignes: lignes
      };
      
      console.log('📝 Création devis avec données:', documentData);
      
      // Créer le document
      const createRes = await securePost('/documents', documentData);
      
      // DEBUG: Voir la structure complète de la réponse
      console.log('📦 Réponse COMPLÈTE POST /api/documents:', createRes);
      console.log('📊 Structure de createRes:', {
        data: createRes.data,
        status: createRes.status,
        headers: createRes.headers,
        hasData: !!createRes.data,
        dataKeys: createRes.data ? Object.keys(createRes.data) : 'no data'
      });
      
      // Vérifiez toutes les possibilités d'ID
      const documentId = 
        createRes.data?.id || 
        createRes.data?.data?.id || 
        createRes.data?.document?.id ||
        (createRes.data && typeof createRes.data === 'object' ? createRes.data.id : null);
      
      const documentReference = 
        createRes.data?.reference ||
        createRes.data?.data?.reference ||
        createRes.data?.document?.reference ||
        'N/A';
      
      console.log('🔍 ID document trouvé:', documentId);
      console.log('🔍 Référence document trouvée:', documentReference);
      
      if (documentId) {
        showNotif(`Devis #${documentReference} créé. Génération PDF...`, 'success');
        
        // Court délai
        await new Promise(resolve => setTimeout(resolve, 800));
        
        try {
          console.log(`🔄 Appel PDF pour doc #${documentId}`);
          const pdfRes = await securePost(`/documents-puppeteer/${documentId}/generate-pdf-puppeteer`);
          console.log('📄 Réponse PDF:', pdfRes.data);
          
          if (pdfRes.data && pdfRes.data.pdfUrl) {
            const baseUrl = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
            const fullUrl = `${baseUrl}${pdfRes.data.pdfUrl}`;
            console.log('🔗 URL PDF complète:', fullUrl);
            
            showNotif(`PDF prêt! Ouverture...`, 'success');
            
            setTimeout(() => {
              const newWindow = window.open(fullUrl, '_blank', 'noopener,noreferrer');
              if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                showNotif(`Popup bloquée. Accédez au PDF: ${fullUrl}`, 'warning');
                // Alternative: téléchargement
                const link = document.createElement('a');
                link.href = fullUrl;
                link.download = `devis-${documentReference}.pdf`;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }, 300);
          } else {
            console.warn('⚠️ pdfUrl manquant:', pdfRes.data);
            showNotif('PDF généré mais URL non trouvée', 'warning');
          }
          
        } catch (pdfErr) {
          console.error('❌ Erreur PDF:', {
            message: pdfErr.message,
            status: pdfErr.response?.status,
            data: pdfErr.response?.data,
            stack: pdfErr.stack
          });
          showNotif(`Erreur PDF: ${pdfErr.response?.data?.error || pdfErr.message}`, 'warning');
        }
      } else {
        // Afficher la réponse complète pour déboguer
        console.error('❌ ID document non trouvé. Réponse complète:', createRes);
        showNotif('Document créé mais ID manquant dans la réponse', 'warning');
        
        // Voir si on peut utiliser autre chose
        if (createRes.data) {
          console.log('🔍 Tentative d\'extraction alternative d\'ID:', createRes.data);
        }
      }
      
    } catch (err) {
      console.error('❌ Erreur complète devis:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      
      showNotif(`Erreur: ${err.response?.data?.error || err.message}`, 'error');
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
    
    if (!commande || !commande.produits || commande.produits.length === 0) {
      showNotif('La commande ne contient pas de produits', 'error');
      return;
    }
    
    // Vérifier que la commande peut être facturée (statut approprié)
    if (commande.statut !== 'livrée' && commande.statut !== 'en cours') {
      const confirmer = window.confirm(
        `La commande n'est pas encore livrée (statut: ${commande.statut}).\n` +
        `Voulez-vous quand même générer une facture ?`
      );
      if (!confirmer) return;
    }
    
    setLoading(true);
    try {
      // Préparer les lignes du document
      const lignes = commande.produits.map(produit => ({
        description: produit.produitNom || `Produit #${produit.produitId}`,
        quantite: produit.quantite,
        prix_unitaire: produit.prixUnitaire
      }));
      
      // Créer le document de type "facture"
      const documentData = {
        type: 'facture',
        tva_rate: 20,
        notes: `Facture générée à partir de la commande #${commande.id}\n` +
              `Client: ${commande.contactNom} ${commande.contactPrenom || ''}\n` +
              `Date commande: ${commande.date ? format(new Date(commande.date), 'dd/MM/yyyy') : 'N/A'}`,
        lignes: lignes
      };
      
      console.log('📝 Création facture avec données:', documentData);
      
      // Créer la facture
      const createRes = await securePost('/documents', documentData);
      
      // DEBUG: Voir la structure complète de la réponse
      console.log('📦 Réponse COMPLÈTE POST /api/documents:', createRes);
      console.log('📊 Structure de createRes:', {
        data: createRes.data,
        status: createRes.status,
        headers: createRes.headers,
        hasData: !!createRes.data,
        dataKeys: createRes.data ? Object.keys(createRes.data) : 'no data'
      });
      
      // Vérifiez toutes les possibilités d'ID
      const documentId = 
        createRes.data?.id || 
        createRes.data?.data?.id || 
        createRes.data?.document?.id ||
        (createRes.data && typeof createRes.data === 'object' ? createRes.data.id : null);
      
      const documentReference = 
        createRes.data?.reference ||
        createRes.data?.data?.reference ||
        createRes.data?.document?.reference ||
        'N/A';
      
      console.log('🔍 ID document trouvé:', documentId);
      console.log('🔍 Référence document trouvée:', documentReference);
      
      if (documentId) {
        showNotif(`Facture #${documentReference} créée. Génération PDF...`, 'success');
        
        // Court délai pour laisser le document s'enregistrer
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Générer le PDF
        try {
          console.log(`🔄 Appel PDF pour facture #${documentId}`);
          const pdfRes = await securePost(`/documents-puppeteer/${documentId}/generate-pdf-puppeteer`);
          console.log('📄 Réponse PDF:', pdfRes.data);
          
          if (pdfRes.data && pdfRes.data.pdfUrl) {
            const fullUrl = `http://localhost:5000${pdfRes.data.pdfUrl}`;
            console.log('🔗 URL PDF complète:', fullUrl);
            
            // Ouvrir IMMÉDIATEMENT le PDF dans un nouvel onglet
            showNotif(`PDF prêt! Ouverture...`, 'success');
            
            // Pas de setTimeout - ouverture directe
            const newWindow = window.open(fullUrl, '_blank', 'noopener,noreferrer');
            
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
              showNotif(`Popup bloquée. Accédez au PDF: ${fullUrl}`, 'warning');
              
              // Alternative : créer un lien et le cliquer
              const link = document.createElement('a');
              link.href = fullUrl;
              link.download = `facture-${documentReference}.pdf`;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          } else {
            console.warn('⚠️ pdfUrl manquant dans la réponse:', pdfRes.data);
            showNotif('PDF généré mais URL non trouvée', 'warning');
          }
          
        } catch (pdfErr) {
          console.error('❌ Erreur détaillée PDF:', {
            message: pdfErr.message,
            status: pdfErr.response?.status,
            data: pdfErr.response?.data,
            stack: pdfErr.stack
          });
          
          if (pdfErr.response?.status === 404) {
            showNotif('Route PDF non trouvée. Vérifiez documents-puppeteer.js', 'error');
          } else {
            showNotif(`Erreur PDF: ${pdfErr.response?.data?.error || pdfErr.message}`, 'warning');
          }
        }
      } else {
        // Afficher la réponse complète pour déboguer
        console.error('❌ ID document non trouvé. Réponse complète:', createRes);
        showNotif('Document créé mais ID manquant dans la réponse', 'warning');
      }
      
    } catch (err) {
      console.error('❌ Erreur complète facture:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      
      showNotif(`Erreur: ${err.response?.data?.error || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Fonction pour voir les documents liés à une commande
   * @param {Object} commande - La commande
   */
  const handleVoirDocuments = (commande) => {
    // Redirection vers la page des documents ou ouverture d'un modal
    window.open('/documents', '_blank');
  };

  // ==================== FONCTIONS DU MENU CONTEXTUEL ====================
  
  const handleMenuOpen = (event, commande) => {
    setMenuAnchor(event.currentTarget);
    setSelectedCommande(commande);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedCommande(null);
  };

  const handleChangeStatut = async (nouveauStatut) => {
    if (!selectedCommande) return;
    
    try {
      // Mettre à jour le statut de la commande via PATCH
      const res = await securePatch(`/commandes/${selectedCommande.id}`, {
        statut: nouveauStatut
      }
    );
      
      
      showNotif(`Statut changé à "${nouveauStatut}"`, 'success');
      fetchCommandes();
      fetchStats();
    } catch (err) {
      showNotif('Erreur lors du changement de statut', 'error');
    } finally {
      handleMenuClose();
    }
  };

  const handleAnnulerCommande = async () => {
    if (!selectedCommande || !window.confirm('Êtes-vous sûr de vouloir annuler cette commande ? Le stock sera restauré.')) {
      return;
    }
    
    setLoading(true);
    try {
      await securePost(`/commandes/${selectedCommande.id}/annuler`);
      showNotif('Commande annulée et stock restauré', 'success');
      fetchCommandes();
      fetchProduits();
      fetchStats();
    } catch (err) {
      showNotif(err.response?.data?.error || 'Erreur lors de l\'annulation', 'error');
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  // ==================== FONCTIONS FORMULAIRE ====================

  const handleOpenAddDialog = () => {
    setEditingCommande(null);
    setDate(new Date().toISOString().slice(0, 16));
    setStatut('en attente');
    setTotal(0);
    setContactId(contacts.length > 0 ? contacts[0].id : '');
    setProduitsSelectionnes([]);
    setOpenDialog(true);
  };

  const handleOpenEditDialog = async (commande) => {
    setEditingCommande(commande);
    setDate(commande.date ? commande.date.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setStatut(commande.statut || 'en attente');
    setTotal(commande.total || 0);
    setContactId(commande.contactId || '');
    
    if (commande.produits && Array.isArray(commande.produits)) {
      const produitsAvecInfos = commande.produits.map(p => ({
        produitId: p.produitId,
        quantite: p.quantite,
        prixUnitaire: p.prixUnitaire,
        produitNom: p.produitNom
      }));
      setProduitsSelectionnes(produitsAvecInfos);
    } else {
      setProduitsSelectionnes([]);
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCommande(null);
  };

  const handleAddProduit = () => {
    console.log('🔍 handleAddProduit appelé');
    console.log('📦 État produits:', produits);
    console.log('📦 Nombre de produits:', produits.length);
    console.log('📦 Premier produit (si existe):', produits[0]);
    
    if (produits.length === 0) {
      showNotif('Aucun produit disponible. Créez des produits avec du stock d\'abord.', 'warning');
      
      // Optionnel: ouvrir la page produits dans un nouvel onglet
      const ouvrirProduits = window.confirm(
        'Aucun produit disponible.\nVoulez-vous ouvrir la page de gestion des produits ?'
      );
      if (ouvrirProduits) {
        window.open('/produits', '_blank');
      }
      
      return;
    }
    
    const premierProduit = produits[0];
    console.log('📦 Détails premier produit:', premierProduit);
    
    const nouveauxProduits = [
      ...produitsSelectionnes,
      { 
        produitId: premierProduit.id, 
        quantite: 1, 
        prixUnitaire: premierProduit.prix || 0,
        produitNom: premierProduit.nom || 'Produit sans nom'
      }
    ];
    
    console.log('📦 Nouveaux produits après ajout:', nouveauxProduits);
    setProduitsSelectionnes(nouveauxProduits);
    calculerTotaux(nouveauxProduits);
    
    showNotif(`Produit "${premierProduit.nom}" ajouté à la commande`, 'success');
  };

  const handleUpdateProduit = (index, field, value) => {
    const nouveauxProduits = [...produitsSelectionnes];
    nouveauxProduits[index][field] = value;
    
    if (field === 'produitId') {
      const produit = produits.find(p => p.id === value);
      if (produit) {
        nouveauxProduits[index].prixUnitaire = produit.prix;
        nouveauxProduits[index].produitNom = produit.nom;
      }
    }
    
    setProduitsSelectionnes(nouveauxProduits);
    calculerTotaux(nouveauxProduits);
  };

  const handleRemoveProduit = (index) => {
    const nouveauxProduits = produitsSelectionnes.filter((_, i) => i !== index);
    setProduitsSelectionnes(nouveauxProduits);
    calculerTotaux(nouveauxProduits);
  };

  const calculerTotaux = (produitsList = produitsSelectionnes) => {
    const total = produitsList.reduce((sum, p) => sum + (p.quantite * p.prixUnitaire), 0);
    setTotal(total);
  };

  const handleSubmit = async () => {
    if (!contactId) {
      showNotif('Veuillez sélectionner un contact', 'error');
      return;
    }

    if (produitsSelectionnes.length === 0) {
      showNotif('Veuillez ajouter au moins un produit', 'error');
      return;
    }

    setLoading(true);
    try {
      const produitsPourAPI = produitsSelectionnes.map(p => ({
        produitId: p.produitId,
        quantite: p.quantite,
        prixUnitaire: p.prixUnitaire
      }));

      const commandeData = {
        date: new Date(date).toISOString(),
        statut,
        total,                    // ← total calculé sans TVA
        contactId,
        produits: produitsPourAPI
      };

      console.log('📤 Envoi des données:', commandeData);
      
      let res;
      if (editingCommande) {
        // ✅ URL CORRECTE : /api/commandes/:id
        console.log(`✏️ Modification commande #${editingCommande.id}`);
        res = await securePut(`/commandes/${editingCommande.id}`, commandeData);
      } else {
        console.log('➕ Création nouvelle commande');
        res = await securePost('/commandes', commandeData);
      }
      
      console.log('✅ Réponse API:', res.data);
      
      showNotif(editingCommande ? 'Commande modifiée avec succès' : 'Commande ajoutée avec succès');
      
      // Rafraîchir les données
      fetchCommandes();
      fetchProduits();
      fetchStats();
      
      handleCloseDialog();
      
    } catch (err) {
      console.error('❌ Erreur lors de la soumission', err);
      console.error('❌ Détails erreur:', err.response?.data || err.message);
      
      if (err.response?.data?.details?.includes('Stock insuffisant')) {
        showNotif(err.response.data.details, 'error');
      } else if (err.response?.data?.error) {
        showNotif(err.response.data.error, 'error');
      } else if (err.response?.status === 404) {
        showNotif('Route API non trouvée. Vérifiez la configuration serveur.', 'error');
      } else {
        showNotif('Erreur lors de l\'opération', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCommande = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cette commande ?')) {
      return;
    }

    setLoading(true);
    try {
      await secureDelete(`/commandes/${id}`);
      setCommandes(prev => prev.filter(c => c.id !== id));
      showNotif('Commande supprimée avec succès');
      fetchStats();
    } catch (err) {
      console.error('❌ Erreur suppression commande', err);
      showNotif('Erreur lors de la suppression', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // ==================== FONCTIONS UTILITAIRES ====================

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getContactName = (commande) => {
    // Gérer les deux formats : snake_case et camelCase
    const nom = commande.contact_nom || commande.contactNom;
    const prenom = commande.contact_prenom || commande.contactPrenom;
    
    if (nom && prenom) {
      return `${nom} ${prenom}`;
    } else if (nom) {
      return nom;
    } else if (prenom) {
      return prenom;
    }
    return `Client ${commande.contact_id || commande.contactId || 'Inconnu'}`;
  };

  // ==================== RENDU ====================

  if (loading && commandes.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Chargement des commandes...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* En-tête */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Gestion des Commandes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gérez vos commandes, suivez les livraisons et analysez vos ventes
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ height: '40px' }}
        >
          Nouvelle Commande
        </Button>
      </Box>

      {/* Barre de filtres */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Date début"
              type="date"
              value={filters.dateDebut}
              onChange={(e) => setFilters({...filters, dateDebut: e.target.value})}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Date fin"
              type="date"
              value={filters.dateFin}
              onChange={(e) => setFilters({...filters, dateFin: e.target.value})}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Client</InputLabel>
              <Select
                value={filters.clientId}
                label="Client"
                onChange={(e) => setFilters({...filters, clientId: e.target.value})}
              >
                <MenuItem value="">Tous</MenuItem>
                {contacts.map(contact => (
                  <MenuItem key={contact.id} value={contact.id}>
                    {contact.nom} {contact.prenom}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Statut</InputLabel>
              <Select
                value={filters.statut}
                label="Statut"
                onChange={(e) => setFilters({...filters, statut: e.target.value})}
              >
                <MenuItem value="">Tous</MenuItem>
                {statutsOptions.map(statut => (
                  <MenuItem key={statut} value={statut}>
                    {statut}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Produit"
              value={filters.produitNom}
              onChange={(e) => setFilters({...filters, produitNom: e.target.value})}
              fullWidth
              size="small"
              placeholder="Nom du produit"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="outlined"
              onClick={resetFilters}
              fullWidth
              size="medium"
            >
              Réinitialiser
            </Button>
          </Grid>
        </Grid>
      </Paper>



      {/* Cartes statistiques */}
      {filteredStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <CartIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{filteredStats.total_commandes}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Commandes totales
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                    <MoneyIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{formatCurrency(filteredStats.chiffre_affaires)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Chiffre d'affaires
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <ShippingIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{filteredStats.en_cours}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      En cours
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                    <TrendingIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{formatCurrency(filteredStats.moyenne_commande)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Moyenne par commande
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tableau des commandes */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'primary.main' }}>
            <TableRow>
              <TableCell sx={{ color: 'white' }}>ID</TableCell>
              <TableCell sx={{ color: 'white' }}>Date</TableCell>
              <TableCell sx={{ color: 'white' }}>Client</TableCell>
              <TableCell sx={{ color: 'white' }}>Statut</TableCell>
              <TableCell sx={{ color: 'white' }}>Produits</TableCell>
              <TableCell sx={{ color: 'white' }}>Total</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredCommandes.map(cmd => (
              <React.Fragment key={cmd.id}>
                <TableRow hover>
                  <TableCell>
                    <Typography fontWeight="bold">#{cmd.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {cmd.date ? format(new Date(cmd.date), 'dd MMM yyyy', { locale: fr }) : '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cmd.date ? format(new Date(cmd.date), 'HH:mm', { locale: fr }) : ''}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {getContactName(cmd)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {cmd.contactEmail || 'Email non disponible'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={cmd.statut} />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {cmd.produits?.length || 0} produit(s)
                      </Typography>
                      {cmd.produits && cmd.produits.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {cmd.produits[0].quantite}x {cmd.produits[0].produitNom}
                          {cmd.produits.length > 1 && ` +${cmd.produits.length - 1}`}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="bold" color="primary">
                      {formatCurrency(cmd.total)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Voir les détails">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => toggleExpand(cmd.id)}
                        >
                          {expandedId === cmd.id ? '▲' : '▼'}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Modifier">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenEditDialog(cmd)}
                          disabled={cmd.statut === 'livrée'}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Actions">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, cmd)}
                        >
                          <MoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>

                {/* Détails dépliés */}
                {expandedId === cmd.id && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Box sx={{ p: 3, bgcolor: '#f8f9fa' }}>
                        <Grid container spacing={3}>
                          {/* Informations client */}
                          <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2 }}>
                              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Informations client
                              </Typography>
                              <Divider sx={{ mb: 2 }} />
                              <Grid container spacing={2}>
                                <Grid item xs={6}>
                                  <Typography variant="body2">
                                    <strong>Nom complet:</strong><br />
                                    {getContactName(cmd)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="body2">
                                    <strong>Email:</strong><br />
                                    {cmd.contactEmail || 'Non renseigné'}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="body2">
                                    <strong>Téléphone:</strong><br />
                                    {cmd.contactTelephone || 'Non renseigné'}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="body2">
                                    <strong>Date de commande:</strong><br />
                                    {cmd.date ? format(new Date(cmd.date), 'dd MMMM yyyy à HH:mm', { locale: fr }) : '-'}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Paper>
                          </Grid>

                          {/* Détails financiers simplifiés */}
                          <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2 }}>
                              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                <MoneyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Total de la commande
                              </Typography>
                              <Divider sx={{ mb: 2 }} />
                              <Typography variant="h4" color="primary" align="center">
                                {formatCurrency(cmd.total)}
                              </Typography>
                            </Paper>
                          </Grid>

                          {/* Section avec boutons Devis/Facture */}
                          <Grid item xs={12}>
                            <Paper sx={{ p: 2, mb: 2, bgcolor: '#e3f2fd' }}>
                              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                <PdfIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Génération de documents
                              </Typography>
                              <Divider sx={{ mb: 2 }} />
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={4}>
                                  <Tooltip title="Créer un devis à partir de cette commande">
                                    <Button
                                      variant="contained"
                                      startIcon={<DevisIcon />}
                                      fullWidth
                                      sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
                                      onClick={() => handleGenererDevis(cmd)}
                                      disabled={loading}
                                    >
                                      Générer Devis
                                    </Button>
                                  </Tooltip>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <Tooltip title="Créer une facture à partir de cette commande">
                                    <Button
                                      variant="contained"
                                      startIcon={<FactureIcon />}
                                      fullWidth
                                      sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
                                      onClick={() => handleGenererFacture(cmd)}
                                      disabled={loading}
                                    >
                                      Générer Facture
                                    </Button>
                                  </Tooltip>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <Tooltip title="Voir tous les documents">
                                    <Button
                                      variant="outlined"
                                      startIcon={<Description />}
                                      fullWidth
                                      onClick={handleVoirDocuments}
                                    >
                                      Voir Documents
                                    </Button>
                                  </Tooltip>
                                </Grid>
                              </Grid>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Les documents générés seront disponibles dans la section "Documents" du système
                              </Typography>
                            </Paper>
                          </Grid>

                          {/* Liste des produits */}
                          <Grid item xs={12}>
                            <Paper sx={{ p: 2 }}>
                              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Produits commandés ({cmd.produits?.length || 0})
                              </Typography>
                              <Divider sx={{ mb: 2 }} />
                              
                              {cmd.produits && cmd.produits.length > 0 ? (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Produit</TableCell>
                                      <TableCell>Référence</TableCell>
                                      <TableCell align="right">Quantité</TableCell>
                                      <TableCell align="right">Prix unitaire</TableCell>
                                      <TableCell align="right">Sous-total</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {cmd.produits.map((p, index) => (
                                      <TableRow key={index}>
                                        <TableCell>
                                          <Box display="flex" alignItems="center">
                                            <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: 'secondary.main' }}>
                                              <InventoryIcon fontSize="small" />
                                            </Avatar>
                                            <Typography variant="body2">
                                              {p.produitNom || 'Produit sans nom'}
                                            </Typography>
                                          </Box>
                                        </TableCell>
                                        <TableCell>
                                          <Chip 
                                            label={p.produitReference || 'N/A'} 
                                            size="small" 
                                            variant="outlined"
                                          />
                                        </TableCell>
                                        <TableCell align="right">
                                          <Chip 
                                            label={p.quantite || 0} 
                                            size="small"
                                            color="primary"
                                          />
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography variant="body2">
                                            {formatCurrency(p.prixUnitaire || 0)}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography variant="body2" fontWeight="bold">
                                            {formatCurrency(p.sousTotal || 0)}
                                          </Typography>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <Typography color="text.secondary" textAlign="center" py={2}>
                                  Aucun produit dans cette commande.
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        </Grid>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>

        {/* Message si aucune commande */}
        {filteredCommandes.length === 0 && !loading && (
          <Box textAlign="center" py={8}>
            <CartIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Aucune commande trouvée
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {commandes.length > 0 
                ? "Aucune commande ne correspond aux filtres sélectionnés." 
                : "Commencez par créer votre première commande"}
            </Typography>
            {commandes.length > 0 ? (
              <Button variant="outlined" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddDialog}
              >
                Créer votre première commande
              </Button>
            )}
          </Box>
        )}
      </Paper>

      {/* Menu contextuel */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {selectedCommande && selectedCommande.statut !== 'livrée' && (
          [
            <MenuItem key="livree" onClick={() => handleChangeStatut('livrée')}>
              <CheckIcon sx={{ mr: 1 }} fontSize="small" />
              Marquer comme livrée
            </MenuItem>,
            <MenuItem key="en-cours" onClick={() => handleChangeStatut('en cours')}>
              <ShippingIcon sx={{ mr: 1 }} fontSize="small" />
              Marquer comme en cours
            </MenuItem>,
            <Divider key="divider" />
          ]
        )}
        <MenuItem key="annuler" onClick={handleAnnulerCommande}>
          <CancelIcon sx={{ mr: 1 }} fontSize="small" />
          Annuler la commande
        </MenuItem>
        <MenuItem key="supprimer" onClick={() => {
          handleMenuClose();
          handleDeleteCommande(selectedCommande?.id);
        }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Supprimer définitivement
        </MenuItem>
      </Menu>

      {/* ==================== DIALOG FORMULAIRE ==================== */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editingCommande ? `Modifier la commande #${editingCommande.id}` : 'Nouvelle commande'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Informations de base */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Date et heure"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={statut}
                    label="Statut"
                    onChange={(e) => setStatut(e.target.value)}
                  >
                    <MenuItem value="en attente">En attente</MenuItem>
                    <MenuItem value="en cours">En cours</MenuItem>
                    <MenuItem value="livrée">Livrée</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Sélection du client */}
      

            <FormControl fullWidth>
              <InputLabel>Client *</InputLabel>
              <Select
                value={contactId}
                label="Client *"
                onChange={(e) => setContactId(e.target.value)}
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
                {/* ✅ Vérification supplémentaire */}
                {Array.isArray(contacts) && contacts.length > 0 ? (
                  contacts.map(contact => (
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
                  ))
                ) : (
                  <MenuItem disabled value="">
                    <Typography variant="body2" color="text.disabled">
                      {!contacts ? 'Chargement...' : 'Aucun contact disponible'}
                    </Typography>
                  </MenuItem>
                )}
              </Select>
            </FormControl>

            {/* Section produits */}
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Produits</Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddProduit}
                  disabled={produits.length === 0}
                >
                  Ajouter un produit
                </Button>
              </Box>

              {produitsSelectionnes.map((produit, index) => {
                const produitInfo = produits.find(p => p.id === produit.produitId);
                const stockDisponible = produitInfo?.stock || 0;
                const quantiteDemandee = produit.quantite || 0;
                const stockSuffisant = quantiteDemandee <= stockDisponible;
                
                return (
                  <Paper 
                    key={index} 
                    sx={{ 
                      p: 2, 
                      mb: 2, 
                      bgcolor: stockSuffisant ? '#f8f9fa' : '#ffebee',
                      border: stockSuffisant ? '1px solid #e0e0e0' : '1px solid #f44336'
                    }}
                  >
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Produit</InputLabel>
                          <Select
                            value={produit.produitId}
                            label="Produit"
                            onChange={(e) => handleUpdateProduit(index, 'produitId', e.target.value)}
                            error={!stockSuffisant}
                          >
                            {produits.map(p => (
                              <MenuItem key={p.id} value={p.id}>
                                <Box>
                                  <Typography variant="body2">{p.nom}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Stock: {p.stock} | {formatCurrency(p.prix)}
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
                          value={produit.quantite}
                          onChange={(e) => handleUpdateProduit(index, 'quantite', parseInt(e.target.value) || 1)}
                          fullWidth
                          size="small"
                          inputProps={{ 
                            min: 1, 
                            max: stockDisponible 
                          }}
                          error={!stockSuffisant}
                          helperText={!stockSuffisant ? `Max: ${stockDisponible}` : ''}
                        />
                      </Grid>
                      
                      <Grid item xs={6} md={2}>
                        <TextField
                          label="Prix unitaire"
                          type="number"
                          value={produit.prixUnitaire}
                          onChange={(e) => handleUpdateProduit(index, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                          fullWidth
                          size="small"
                          InputProps={{
                            endAdornment: 'Fcfa'
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={6} md={2}>
                        <Box textAlign="center">
                          <Typography variant="h6" color="primary">
                            {formatCurrency(produit.quantite * produit.prixUnitaire)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Sous-total
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={5} md={2}>
                        <Chip 
                          label={`Stock: ${stockDisponible}`}
                          size="small"
                          color={stockSuffisant ? 'success' : 'error'}
                          variant="outlined"
                        />
                        {produitInfo && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {produitInfo.nom}
                          </Typography>
                        )}
                      </Grid>
                      
                      <Grid item xs={1} md={1}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveProduit(index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                );
              })}

              {produitsSelectionnes.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: '#e8f5e9' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Résumé de la commande
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2">Nombre de produits :</Typography>
                    </Grid>
                    <Grid item xs={6} textAlign="right">
                      <Typography variant="body2" fontWeight="bold">
                        {produitsSelectionnes.length}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">Articles totaux :</Typography>
                    </Grid>
                    <Grid item xs={6} textAlign="right">
                      <Typography variant="body2" fontWeight="bold">
                        {produitsSelectionnes.reduce((sum, p) => sum + p.quantite, 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h6">Total :</Typography>
                    </Grid>
                    <Grid item xs={6} textAlign="right">
                      <Typography variant="h5" color="primary">
                        {formatCurrency(total)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!contactId || produitsSelectionnes.length === 0 || loading}
          >
            {loading ? 'Chargement...' : (editingCommande ? 'Modifier' : 'Créer la commande')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={notif.open}
        autoHideDuration={4000}
        onClose={() => setNotif({ ...notif, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={notif.type} onClose={() => setNotif({ ...notif, open: false })}>
          {notif.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
