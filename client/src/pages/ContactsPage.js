// src/pages/ContactsPage.js - VERSION CORRIGÉE AVEC GESTION DES ERREURS
// ✅ Gestion complète des contacts avec synchronisation backend/frontend

import React, { useEffect, useState } from 'react';
import { secureGet, securePost, securePut, secureDelete } from '../services/api';
import {
  Box, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Typography, TextField, Select, MenuItem, FormControl,
  InputLabel, Snackbar, Avatar, Chip, IconButton, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Card, CardContent, CircularProgress, Tooltip, Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Timeline as PipelineIcon,
  Close as CloseIcon,
  CheckCircle as ClientIcon,
  Pending as ProspectIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import MuiAlert from '@mui/material/Alert';
import PipelinePage from './PipelinePage';
import { validateEmail } from '../utils/validation';

// Composant Alert pour les notifications
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

// Composant TypeChip pour afficher le type de contact avec couleur
const TypeChip = ({ type }) => {
  const getTypeConfig = (type) => {
    const typeStr = String(type || '').toLowerCase();
    
    switch (typeStr) {
      case 'client':
        return { 
          label: 'Client', 
          color: 'success', 
          icon: <ClientIcon fontSize="small" /> 
        };
      case 'prospect':
        return { 
          label: 'Prospect', 
          color: 'info', 
          icon: <ProspectIcon fontSize="small" /> 
        };
      case 'fournisseur':
        return { 
          label: 'Fournisseur', 
          color: 'warning', 
          icon: <WorkIcon fontSize="small" /> 
        };
      default:
        return { 
          label: typeStr || 'Autre', 
          color: 'default', 
          icon: null 
        };
    }
  };
  
  const config = getTypeConfig(type);
  
  return (
    <Chip
      label={config.label}
      size="small"
      color={config.color}
      icon={config.icon}
      variant="outlined"
    />
  );
};

export default function ContactsPage() {
  // ==================== ÉTATS ====================
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [openPipelineDialog, setOpenPipelineDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    compte: '',
    typeContact: 'prospect',
    entreprise: '',
    adresse: '',
    ville: '',
    codePostal: '',
    pays: '',
    notes: ''
  });
  
  const [notif, setNotif] = useState({ 
    open: false,
    message: '', 
    type: 'success' 
  });

  // ==================== FONCTIONS UTILITAIRES ====================

  const showNotif = (message, type = 'success') => {
    setNotif({ open: true, message, type });
  };

  // Fonction pour normaliser un contact
  const normalizeContact = (contact) => {
    if (!contact) return null;
    
    return {
      id: contact.id || Math.random().toString(36).substr(2, 9),
      nom: contact.nom || '',
      prenom: contact.prenom || '',
      email: contact.email || '',
      telephone: contact.telephone || '',
      entreprise: contact.entreprise || '',
      compte: contact.compte || '',
      type_contact: contact.type_contact || contact.typeContact || 'prospect',
      typeContact: contact.type_contact || contact.typeContact || 'prospect',
      adresse: contact.adresse || '',
      ville: contact.ville || '',
      codePostal: contact.codePostal || contact.code_postal || '',
      code_postal: contact.codePostal || contact.code_postal || '',
      pays: contact.pays || '',
      notes: contact.notes || '',
      created_at: contact.created_at || new Date().toISOString(),
      updated_at: contact.updated_at || new Date().toISOString()
    };
  };

  // Fonction principale pour récupérer les contacts
  const fetchContacts = async () => {
    setLoadingData(true);
    console.log('🔄 fetchContacts démarré...');
    
    try {
      console.log('🔍 Appel API: GET /api/contacts');
      
      const res = await secureGet('/contacts');
      
      console.log('📦 Réponse API:', {
        status: res.status,
        data: res.data
      });
      
      let contactsData = [];
      
      // CAS 1: Format standard { success: true, data: [...] }
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        console.log('✅ Format standard: { success: true, data: [...] }');
        contactsData = res.data.data;
      }
      // CAS 2: Tableau direct
      else if (Array.isArray(res.data)) {
        console.log('✅ Format: Tableau direct');
        contactsData = res.data;
      }
      // CAS 3: Autre structure avec données
      else if (res.data && typeof res.data === 'object') {
        console.log('⚠️  Format non standard, recherche de tableau...');
        for (const key in res.data) {
          if (Array.isArray(res.data[key])) {
            console.log(`✅ Tableau trouvé dans la clé "${key}"`);
            contactsData = res.data[key];
            break;
          }
        }
      }
      
      console.log(`📊 ${contactsData.length} contacts extraits`);
      
      // Normalisation des contacts avec vérification
      const normalizedContacts = contactsData
        .map(normalizeContact)
        .filter(contact => contact !== null);
      
      setContacts(normalizedContacts);
      
    } catch (error) {
      console.error('❌ Erreur fetchContacts:', error);
      
      if (error.response?.status === 401) {
        showNotif('Session expirée. Veuillez vous reconnecter.', 'error');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      } else if (error.code === 'ERR_NETWORK') {
        showNotif('Erreur réseau. Vérifiez votre connexion.', 'error');
      } else {
        showNotif('Erreur lors du chargement des contacts', 'error');
      }
      
      // Données de démonstration en cas d'erreur
      const demoContacts = [
        normalizeContact({ 
          id: 1, 
          nom: 'Dupont', 
          prenom: 'Jean', 
          email: 'jean.dupont@example.com',
          telephone: '01 23 45 67 89',
          type_contact: 'client',
          entreprise: 'Entreprise ABC'
        }),
        normalizeContact({ 
          id: 2, 
          nom: 'Martin', 
          prenom: 'Marie', 
          email: 'marie.martin@example.com',
          telephone: '06 12 34 56 78',
          type_contact: 'prospect',
          entreprise: 'Société XYZ'
        })
      ].filter(Boolean);
      
      setContacts(demoContacts);
      
    } finally {
      setLoadingData(false);
    }
  };

  // Charger les contacts au montage
  useEffect(() => {
    fetchContacts();
  }, []);

  // ==================== GESTION DU FORMULAIRE ====================

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      telephone: '',
      email: '',
      compte: '',
      typeContact: 'prospect',
      entreprise: '',
      adresse: '',
      ville: '',
      codePostal: '',
      pays: '',
      notes: ''
    });
  };

  const handleOpenAddDialog = () => {
    setEditingContact(null);
    resetForm();
    setOpenFormDialog(true);
  };

  const handleOpenEditDialog = (contact) => {
    if (!contact) return;
    
    setEditingContact(contact);
    setFormData({
      nom: contact.nom || '',
      prenom: contact.prenom || '',
      telephone: contact.telephone || '',
      email: contact.email || '',
      compte: contact.compte || '',
      typeContact: contact.type_contact || contact.typeContact || 'prospect',
      entreprise: contact.entreprise || '',
      adresse: contact.adresse || '',
      ville: contact.ville || '',
      codePostal: contact.code_postal || contact.codePostal || '',
      pays: contact.pays || '',
      notes: contact.notes || ''
    });
    setOpenFormDialog(true);
  };

  const handleOpenPipelineDialog = (contact) => {
    if (!contact) return;
    setSelectedContact(contact);
    setOpenPipelineDialog(true);
  };

  const handleCloseFormDialog = () => {
    setOpenFormDialog(false);
    setEditingContact(null);
    resetForm();
  };

  const handleClosePipelineDialog = () => {
    setOpenPipelineDialog(false);
    setSelectedContact(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Fonction principale pour créer/modifier un contact
  const handleSubmit = async () => {
    // Validation
    if (!formData.nom || !formData.email) {
      showNotif('Le nom et l\'email sont obligatoires', 'error');
      return;
    }

    if (!validateEmail(formData.email).isValid) {
      showNotif('Email invalide', 'error');
      return;
    }

    setLoading(true);
    
    try {
      // Préparer les données pour l'API
      const contactData = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim() || null,
        email: formData.email.trim(),
        telephone: formData.telephone.trim() || null,
        entreprise: formData.entreprise.trim() || null,
        typeContact: formData.typeContact,
        compte: formData.compte.trim() || null,
        adresse: formData.adresse.trim() || null,
        ville: formData.ville.trim() || null,
        codePostal: formData.codePostal.trim() || null,
        pays: formData.pays.trim() || null,
        notes: formData.notes.trim() || null
      };

      let response;
      
      if (editingContact) {
        console.log(`✏️ Modification du contact ${editingContact.id}`);
        response = await securePut(`/api/contacts/${editingContact.id}`, contactData);
      } else {
        console.log('➕ Création d\'un nouveau contact');
        response = await securePost('/contacts', contactData);
      }

      console.log('📦 Réponse API:', response.data);

      // Gestion de la réponse avec vérification sécurisée
      if (response.data && response.data.success) {
        const contactFromServer = response.data.data;
        
        if (!contactFromServer) {
          console.warn('⚠️  Réponse API réussie mais data est undefined');
          
          // Créer un contact temporaire avec les données du formulaire
          const tempContact = {
            id: editingContact ? editingContact.id : Date.now(),
            ...contactData,
            type_contact: contactData.typeContact,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Mise à jour de l'état local avec le contact temporaire
          if (editingContact) {
            setContacts(prev => prev.map(c => 
              c.id === editingContact.id ? normalizeContact(tempContact) : c
            ));
            showNotif('Contact modifié avec succès');
          } else {
            setContacts(prev => [normalizeContact(tempContact), ...prev]);
            showNotif('Contact ajouté avec succès');
          }
          
        } else {
          // Contact valide reçu du serveur
          const normalizedContact = normalizeContact(contactFromServer);
          
          if (!normalizedContact) {
            throw new Error('Erreur de normalisation du contact');
          }
          
          if (editingContact) {
            setContacts(prev => prev.map(c => 
              c.id === editingContact.id ? normalizedContact : c
            ));
            showNotif(response.data.message || 'Contact modifié avec succès');
          } else {
            setContacts(prev => [normalizedContact, ...prev]);
            showNotif(response.data.message || 'Contact ajouté avec succès');
          }
        }
        
        // Fermer le dialogue
        handleCloseFormDialog();
        
      } else {
        // Format de réponse inattendu
        console.warn('⚠️  Format de réponse inattendu:', response.data);
        
        // Créer un contact temporaire
        const tempContact = {
          id: editingContact ? editingContact.id : Date.now(),
          ...contactData,
          type_contact: contactData.typeContact,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        if (editingContact) {
          setContacts(prev => prev.map(c => 
            c.id === editingContact.id ? normalizeContact(tempContact) : c
          ));
        } else {
          setContacts(prev => [normalizeContact(tempContact), ...prev]);
        }
        
        showNotif('Opération effectuée (mode local)');
        handleCloseFormDialog();
        
        // Recharger les données pour synchroniser
        setTimeout(() => {
          fetchContacts();
        }, 1000);
      }
      
    } catch (err) {
      console.error('❌ Erreur handleSubmit:', err);
      
      let errorMessage = 'Erreur lors de l\'opération';
      
      if (err.response) {
        const { status, data } = err.response;
        
        if (status === 409 || (status === 400 && data?.error?.includes('existe déjà'))) {
          errorMessage = 'Un contact avec cet email existe déjà';
        } else if (status === 400) {
          errorMessage = `Erreur de validation: ${data?.error || 'Données invalides'}`;
        } else if (status === 404) {
          errorMessage = 'Contact non trouvé';
        } else if (status === 500) {
          errorMessage = 'Erreur serveur, veuillez réessayer';
        } else {
          errorMessage = `Erreur: ${status} - ${err.response.statusText}`;
        }
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
      }
      
      showNotif(errorMessage, 'error');
      
      // Mode fallback : créer un contact local
      if (!editingContact) {
        const fallbackContact = {
          id: Date.now(),
          ...formData,
          type_contact: formData.typeContact,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setContacts(prev => [normalizeContact(fallbackContact), ...prev]);
        handleCloseFormDialog();
        showNotif('Contact ajouté localement (mode déconnecté)', 'warning');
      }
      
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un contact
  const handleDeleteContact = async (id, event) => {
    if (event) event.stopPropagation();
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
      return;
    }

    setLoading(true);
    try {
      await secureDelete(`/api/contacts/${id}`);
      
      // Mise à jour IMMÉDIATE de l'état local
      setContacts(prev => prev.filter(c => c.id !== id));
      
      showNotif('Contact supprimé avec succès');
    } catch (err) {
      console.error('❌ Erreur suppression contact:', err);
      
      if (err.response?.status === 404) {
        showNotif('Contact déjà supprimé', 'info');
        // Mettre à jour quand même l'état local
        setContacts(prev => prev.filter(c => c.id !== id));
      } else {
        showNotif('Erreur lors de la suppression', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Recherche de contacts
  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery.trim() || !contact) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      (contact.nom && contact.nom.toLowerCase().includes(query)) ||
      (contact.prenom && contact.prenom.toLowerCase().includes(query)) ||
      (contact.email && contact.email.toLowerCase().includes(query)) ||
      (contact.telephone && contact.telephone.includes(query)) ||
      (contact.entreprise && contact.entreprise.toLowerCase().includes(query)) ||
      (contact.compte && contact.compte.toLowerCase().includes(query))
    );
  });

  // ==================== CALCULS STATISTIQUES ====================

  const totalContacts = contacts.length;
  const totalClients = contacts.filter(c => 
    c && (c.type_contact === 'client' || c.typeContact === 'client')
  ).length;
  const totalProspects = contacts.filter(c => 
    c && (c.type_contact === 'prospect' || c.typeContact === 'prospect')
  ).length;
  const totalFournisseurs = contacts.filter(c => 
    c && (c.type_contact === 'fournisseur' || c.typeContact === 'fournisseur')
  ).length;

  // ==================== RENDU ====================

  if (loadingData && contacts.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Chargement des contacts...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* ==================== EN-TÊTE ==================== */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Gestion des Contacts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} au total
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ height: '40px' }}
        >
          Nouveau Contact
        </Button>
      </Box>

      {/* ==================== BARRE DE RECHERCHE ==================== */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center">
          <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Rechercher un contact par nom, email, téléphone, entreprise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
          />
          {searchQuery && (
            <Button 
              size="small" 
              onClick={() => setSearchQuery('')}
              sx={{ ml: 1 }}
            >
              Effacer
            </Button>
          )}
        </Box>
      </Paper>

      {/* ==================== STATISTIQUES ==================== */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{totalContacts}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Contacts totaux
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
                  <ClientIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{totalClients}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Clients
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
                  <ProspectIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{totalProspects}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Prospects
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
                  <WorkIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{totalFournisseurs}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Fournisseurs
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ==================== TABLEAU DES CONTACTS ==================== */}
      <Paper sx={{ overflow: 'hidden', mb: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'primary.main' }}>
            <TableRow>
              <TableCell sx={{ color: 'white' }}>Contact</TableCell>
              <TableCell sx={{ color: 'white' }}>Coordonnées</TableCell>
              <TableCell sx={{ color: 'white' }}>Entreprise/Compte</TableCell>
              <TableCell sx={{ color: 'white' }}>Type</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
 
          <TableBody>
            {filteredContacts.map(contact => {
              if (!contact) return null;
              
              const rowId = `contact-${contact.id}`;
              
              return (
                <TableRow 
                  key={rowId}
                  hover 
                  onClick={() => handleOpenPipelineDialog(contact)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: 'primary.main' }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {contact.nom} {contact.prenom || ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: #{contact.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Box display="flex" alignItems="center">
                        <EmailIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {contact.email || 'Non renseigné'}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center">
                        <PhoneIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {contact.telephone || 'Non renseigné'}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Box display="flex" alignItems="center">
                        <BusinessIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {contact.entreprise || contact.compte || 'Non renseigné'}
                        </Typography>
                      </Box>
                      {(contact.ville || contact.pays) && (
                        <Typography variant="caption" color="text.secondary">
                          {[contact.ville, contact.pays].filter(Boolean).join(', ')}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  
                  <TableCell>
                    <TypeChip type={contact.type_contact || contact.typeContact} />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Ouvrir le pipeline">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPipelineDialog(contact);
                          }}
                        >
                          <PipelineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Modifier">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditDialog(contact);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => handleDeleteContact(contact.id, e)}
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Message si aucun contact */}
            {filteredContacts.length === 0 && !loadingData && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    {searchQuery ? (
                      <>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Aucun contact trouvé pour "{searchQuery}"
                        </Typography>
                        <Button
                          variant="outlined"
                          onClick={() => setSearchQuery('')}
                          sx={{ mt: 1 }}
                        >
                          Effacer la recherche
                        </Button>
                      </>
                    ) : (
                      <>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Aucun contact trouvé
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Commencez par ajouter votre premier contact
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={handleOpenAddDialog}
                        >
                          Ajouter un contact
                        </Button>
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* ==================== DIALOG FORMULAIRE ==================== */}
      <Dialog 
        open={openFormDialog} 
        onClose={handleCloseFormDialog} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {editingContact ? 'Modifier le contact' : 'Nouveau contact'}
          <IconButton
            aria-label="close"
            onClick={handleCloseFormDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nom *"
                  value={formData.nom}
                  onChange={(e) => handleInputChange('nom', e.target.value)}
                  fullWidth
                  required
                  disabled={loading}
                  error={!formData.nom}
                  helperText={!formData.nom ? 'Ce champ est requis' : ''}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Prénom"
                  value={formData.prenom}
                  onChange={(e) => handleInputChange('prenom', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email *"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  type="email"
                  fullWidth
                  required
                  disabled={loading}
                  error={formData.email !== '' && !validateEmail(formData.email).isValid}
                  helperText={
                    formData.email !== '' && !validateEmail(formData.email).isValid 
                      ? validateEmail(formData.email).error 
                      : 'Ce champ est requis'
                  }
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Téléphone"
                  value={formData.telephone}
                  onChange={(e) => handleInputChange('telephone', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Entreprise"
                  value={formData.entreprise}
                  onChange={(e) => handleInputChange('entreprise', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Compte"
                  value={formData.compte}
                  onChange={(e) => handleInputChange('compte', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth disabled={loading}>
                  <InputLabel>Type de contact *</InputLabel>
                  <Select
                    value={formData.typeContact}
                    label="Type de contact *"
                    onChange={(e) => handleInputChange('typeContact', e.target.value)}
                    required
                  >
                    <MenuItem value="prospect">Prospect</MenuItem>
                    <MenuItem value="client">Client</MenuItem>
                    <MenuItem value="fournisseur">Fournisseur</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Divider />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Adresse (facultatif)
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Adresse"
                  value={formData.adresse}
                  onChange={(e) => handleInputChange('adresse', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Ville"
                  value={formData.ville}
                  onChange={(e) => handleInputChange('ville', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Code postal"
                  value={formData.codePostal}
                  onChange={(e) => handleInputChange('codePostal', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Pays"
                  value={formData.pays}
                  onChange={(e) => handleInputChange('pays', e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                  placeholder="Informations complémentaires sur le contact..."
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseFormDialog} disabled={loading}>
            Annuler
          </Button>
          
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!formData.nom || !formData.email || loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : editingContact ? (
              'Modifier'
            ) : (
              'Créer'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== DIALOG PIPELINE ==================== */}
      <Dialog 
        open={openPipelineDialog} 
        onClose={handleClosePipelineDialog} 
        fullWidth 
        maxWidth="lg"
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        {selectedContact && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center">
                  <PipelineIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    Pipeline commercial - {selectedContact.nom} {selectedContact.prenom || ''}
                  </Typography>
                </Box>
                <IconButton onClick={handleClosePipelineDialog} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {selectedContact.email} • {selectedContact.telephone || 'Tél. non renseigné'} • {selectedContact.entreprise || 'Entreprise non renseignée'}
              </Typography>
            </DialogTitle>
            <DialogContent sx={{ p: 0, height: '100%' }}>
              <PipelinePage 
                contact={selectedContact} 
                onClose={handleClosePipelineDialog} 
              />
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* ==================== NOTIFICATIONS ==================== */}
      <Snackbar
        open={notif.open}
        autoHideDuration={4000}
        onClose={() => setNotif({ ...notif, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={notif.type} 
          onClose={() => setNotif({ ...notif, open: false })}
          sx={{ width: '100%' }}
        >
          {notif.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
