// src/pages/ProduitsPage.js
// ✅ Gestion complète des produits avec upload d'images et design unifié
// Version responsive avec toutes les fonctionnalités du fichier original

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { secureGet, securePost, securePut, secureDelete, secureUpload } from '../services/api';
import {
  Box, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Typography, TextField, Avatar, Chip, IconButton, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Snackbar, CircularProgress, Select, MenuItem, FormControl, InputLabel,
  Card, CardContent, Tooltip, Divider, Autocomplete, TablePagination,
  Drawer, useMediaQuery, useTheme, Tabs, Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  AttachMoney as PriceIcon,
  Category as CategoryIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewList as ViewListIcon,
  GridView as GridIcon,
  Download as DownloadIcon,
  MoreVert as MoreIcon,
  CheckCircle as InStockIcon,
  Warning as LowStockIcon,
  Error as NoStockIcon
} from '@mui/icons-material';
import MuiAlert from '@mui/material/Alert';
import ValidatedTextField from '../components/ValidatedTextField';
import { validateProduct, validateFile } from '../utils/validation';


// ==================== COMPOSANTS RÉUTILISABLES ====================

// Composant Alert pour les notifications
const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

// Composant pour l'indicateur de stock
const StockChip = ({ stock }) => {
  const stockValue = parseInt(stock) || 0;
  
  if (stockValue > 10) {
    return (
      <Chip
        icon={<InStockIcon />}
        label={`${stockValue} en stock`}
        size="small"
        color="success"
        variant="outlined"
      />
    );
  } else if (stockValue > 0) {
    return (
      <Chip
        icon={<LowStockIcon />}
        label={`${stockValue} restants`}
        size="small"
        color="warning"
        variant="outlined"
      />
    );
  } else {
    return (
      <Chip
        icon={<NoStockIcon />}
        label="Rupture"
        size="small"
        color="error"
        variant="outlined"
      />
    );
  }
};

// Composant carte produit pour le mode grid
const ProductCard = ({ produit, onEdit, onDelete, buildImageUrl }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <Box sx={{ position: 'relative', pt: '75%' }}>
      <img
        src={buildImageUrl(produit.image)}
        alt={produit.nom}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/fallback-image.png';
        }}
      />
    </Box>
    <CardContent sx={{ flexGrow: 1, p: 2 }}>
      <Typography gutterBottom variant="h6" component="h3" noWrap>
        {produit.nom}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {produit.categorie || 'Non catégorisé'}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" color="primary">
          {parseFloat(produit.prix || 0).toFixed()} Fcfa
        </Typography>
        <StockChip stock={produit.stock} />
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button size="small" onClick={() => onEdit(produit)} fullWidth>
          <EditIcon fontSize="small" /> Modifier
        </Button>
        <Button size="small" color="error" onClick={() => onDelete(produit.id)} fullWidth>
          <DeleteIcon fontSize="small" /> Supprimer
        </Button>
      </Stack>
    </CardContent>
  </Card>
);

// ==================== CONFIGURATION ====================
const API_ORIGIN = process.env.REACT_APP_API_ORIGIN || 'http://localhost:5000';
const API_BASE = `${API_ORIGIN}/api`;
const UPLOADS_BASE = `${API_ORIGIN}/uploads`;

// ==================== COMPOSANT PRINCIPAL ====================
export default function ProduitsPage() {
  // ==================== HOOKS RESPONSIVE ====================
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // ==================== ÉTATS ====================
  
  // Données
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  // Vue et filtres
  const [viewMode, setViewMode] = useState(isMobile ? 'grid' : 'table');
  const [activeTab, setActiveTab] = useState(0);
  const [openFilterDrawer, setOpenFilterDrawer] = useState(false);
  const [openFormDialog, setOpenFormDialog] = useState(false);
  
  // Formulaire
  const [editingProduit, setEditingProduit] = useState(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [stock, setStock] = useState('');
  const [codeBarres, setCodeBarres] = useState('');
  const [categorie, setCategorie] = useState('');
  // Remplacer les anciens états d'image unique
  const [imageFiles, setImageFiles] = useState([]);         // Fichiers sélectionnés
  const [imagePreviews, setImagePreviews] = useState([]);   // URLs d'aperçu
  const [existingImages, setExistingImages] = useState([]); // Noms des images déjà en base (pour édition)
  
  // État pour le modal de détails
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  
  // Filtres et recherche
  const [filterCategorie, setFilterCategorie] = useState(null);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : isTablet ? 8 : 10);
  
  // Notifications
  const [notif, setNotif] = useState({ 
    open: false,
    message: '', 
    type: 'success' 
  });

  // Références
  const fileInputRef = useRef(null);

  // ==================== FONCTIONS UTILITAIRES ====================

  // Affiche une notification
  const showNotif = (message, type = 'success') => {
    setNotif({ open: true, message, type });
  };

  // Construit l'URL complète d'une image
  const buildImageUrl = (filename) => {
    if (!filename) return '/fallback-image.png';
    return `${UPLOADS_BASE}/${encodeURIComponent(filename)}`;
  };

  // Gère les erreurs de chargement d'image
  const handleImgError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = '/fallback-image.png';
  };

  // ==================== EFFETS ====================

  // Ajuste la pagination en fonction de la taille d'écran
  useEffect(() => {
    setRowsPerPage(isMobile ? 5 : isTablet ? 8 : 10);
  }, [isMobile, isTablet]);

  // Charge les données au montage
  useEffect(() => {
    fetchProduits();
    fetchCategories();
    
    // Nettoyage des URLs d'objets
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, []);

  // ==================== FONCTIONS API ====================

  // Charge la liste des produits
  const fetchProduits = async (opts = {}) => {
    setLoadingData(true);
    try {
      const params = {};
      if (opts.categorie !== undefined) {
        if (opts.categorie) params.categorie = opts.categorie;
      } else if (filterCategorie) {
        params.categorie = filterCategorie;
      }
      if (opts.search !== undefined) {
        if (opts.search) params.search = opts.search;
      } else if (search) {
        params.search = search;
      }

      const res = await secureGet('/produits', { params });
      
      // Le backend retourne { success: true, data: [...], count: ... }
      if (res.data.success) {
        setProduits(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        setProduits([]);
      }
    } catch (err) {
      console.error('Erreur chargement produits', err);
      showNotif('Erreur lors du chargement des produits', 'error');
      setProduits([]);
    } finally {
      setLoadingData(false);
    }
  };

  // Charge la liste des catégories
  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const res = await secureGet('/categories');
      
      // Le backend retourne { success: true, data: [...], count: ... }
      if (res.data.success) {
        setCategories(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        // Extraction des catégories depuis les produits
        const distinct = Array.from(new Set(produits.map(p => p.categorie).filter(Boolean)));
        setCategories(distinct);
      }
    } catch (err) {
      console.warn('API catégories non disponible');
      // Extraction des catégories depuis les produits
      const distinct = Array.from(new Set(produits.map(p => p.categorie).filter(Boolean)));
      setCategories(distinct);
    } finally {
      setCatLoading(false);
    }
  };

  // Crée une nouvelle catégorie
  const createCategorie = async () => {
    const catName = window.prompt('Entrez le nom de la nouvelle catégorie:');
    
    if (!catName || catName.trim() === '') {
      return;
    }
    
    const trimmedCat = catName.trim();
    setLoading(true);
    
    try {
      const response = await securePost('/categories', { nom: trimmedCat }); 
      
      const createdCat = response.data?.data?.nom || response.data?.nom || trimmedCat;
      
      setCategories(prev => {
        const newCats = Array.from(new Set([createdCat, ...prev]));
        return newCats;
      });
      
      showNotif(`Catégorie "${createdCat}" créée avec succès`, 'success');
      
    } catch (err) {
      console.error('Erreur création catégorie:', err);
      
      // Ajout local en cas d'échec
      if (!categories.includes(trimmedCat)) {
        setCategories(prev => {
          const updated = Array.from(new Set([trimmedCat, ...prev]));
          return updated;
        });
        
        showNotif(
          `Catégorie "${trimmedCat}" ajoutée localement. ` +
          `Note: Non enregistrée dans la base de données.`,
          'warning'
        );
      } else {
        showNotif(`La catégorie "${trimmedCat}" existe déjà`, 'info');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== GESTION DES IMAGES ====================

  const handleChooseFile = () => fileInputRef.current?.click();
  
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
  
    // Limiter à 5 images au total (existantes + nouvelles)
    const totalAfterAdd = imageFiles.length + existingImages.length + files.length;
    if (totalAfterAdd > 5) {
      showNotif('Vous ne pouvez pas ajouter plus de 5 images', 'warning');
      return;
    }
  
    // Créer les aperçus
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  
    // Réinitialiser l'input pour permettre de resélectionner les mêmes fichiers
    e.target.value = '';
  };
  
  const removeImage = (index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeExistingImage = (imageName) => {
    setExistingImages(prev => prev.filter(img => img !== imageName));
    // Optionnel : on peut stocker les images à supprimer dans un état séparé pour l'envoyer au serveur
  };
  
  const clearFile = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==================== GESTION DU FORMULAIRE ====================

  const resetForm = () => {
    setEditingProduit(null);
    setNom('');
    setDescription('');
    setPrix('');
    setStock('');
    setCodeBarres('');
    setCategorie('');
    setCurrentEditingImage(null);  // à supprimer si vous ne l'utilisez plus
    // Nettoyer les états d'images multiples
    imagePreviews.forEach(URL.revokeObjectURL);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Ouvre le dialogue pour ajouter un produit
  const handleOpenAddDialog = () => {
    resetForm();
    setOpenFormDialog(true);
  };

  // Ouvre le dialogue pour modifier un produit
  const handleOpenEditDialog = (produit) => {
    setEditingProduit(produit);
    setNom(produit.nom || '');
    setDescription(produit.description || '');
    setPrix(String(produit.prix ?? ''));
    setStock(String(produit.stock ?? ''));
    setCodeBarres(produit.codeBarres || '');
    setCategorie(produit.categorie || '');
    
    // Charger les images existantes
    let imagesArray = [];
    if (produit.images && Array.isArray(produit.images)) {
      imagesArray = produit.images;
    } else if (produit.image) {
      // Si le backend utilise un seul champ image, on le transforme en tableau
      imagesArray = [produit.image];
    }
    setExistingImages(imagesArray);
    
    clearFile(); // nettoie les éventuelles previews
    setOpenFormDialog(true);
  };

  // Ferme le dialogue formulaire
  const handleCloseFormDialog = () => {
    setOpenFormDialog(false);
    resetForm();
  };

  // Ajoute un produit
  const addProduit = async () => {
    const catValue = typeof categorie === 'object' 
      ? categorie?.nom || categorie 
      : categorie;
    
    if (!nom.trim() || !prix.trim() || !catValue?.trim()) {
      showNotif('Nom, prix et catégorie sont obligatoires', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      const form = new FormData();
      form.append('nom', nom.trim());
      form.append('description', description.trim() || '');
      form.append('prix', Number(prix) || 0);
      form.append('stock', Number(stock) || 0);
      form.append('codeBarres', codeBarres.trim() || '');
      form.append('categorie', catValue.trim());
      
      // Ajouter chaque fichier
      imageFiles.forEach(file => {
        form.append('images', file);  // le backend doit accepter 'images' comme champ multiple
      });
      
      const res = await secureUpload('/produits', form,{
        headers: { 'Content-Type': 'multipart/form-data',
         }
      });

      // Extraction sécurisée du produit
      const newProduct = res.data?.data || res.data;
      setProduits(prev => [res.data, ...prev]);
      
      // Ajoute la catégorie si elle n'existe pas
      if (!categories.includes(categorie.trim())) {
        setCategories(prev => [...prev, categorie.trim()]);
      }
      
      handleCloseFormDialog();
      showNotif('Produit ajouté avec succès', 'success');
      
    } catch (err) {
      console.error('Erreur ajout produit:', err);
      showNotif(
        err.response?.data?.error || 'Erreur lors de l\'ajout du produit', 
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Met à jour un produit
  const updateProduit = async () => {
    if (!editingProduit) return;
    
    const catValue = typeof categorie === 'object' 
      ? categorie?.nom || categorie 
      : categorie;
    
    if (!nom.trim() || !prix.trim() || !catValue?.trim()) {
      showNotif('Nom, prix et catégorie sont obligatoires', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      const form = new FormData();
      form.append('nom', nom.trim());
      form.append('description', description.trim() || '');
      form.append('prix', Number(prix) || 0);
      form.append('stock', Number(stock) || 0);
      form.append('codeBarres', codeBarres.trim() || '');
      form.append('categorie', catValue.trim());
      
      // Nouvelles images
      imageFiles.forEach(file => {
        form.append('images', file);
      });

      // Indiquer les images à conserver (optionnel, selon votre logique backend)
      form.append('existingImages', JSON.stringify(existingImages));
      
      const res = await securePut(`/produits/${editingProduit.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Extraction sécurisée
      const updatedProduct = res.data?.data || res.data;
      setProduits(prev => prev.map(p => p.id === editingProduit.id ? updatedProduct : p));
      
      // Ajoute la catégorie si elle n'existe pas
      if (!categories.includes(categorie.trim())) {
        setCategories(prev => [...prev, categorie.trim()]);
      }
      
      handleCloseFormDialog();
      showNotif('Produit modifié avec succès', 'success');
      
    } catch (err) {
      console.error('Erreur modification produit:', err);
      showNotif('Erreur lors de la modification', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Supprime un produit
  const handleDeleteProduit = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      return;
    }

    setLoading(true);
    try {
      await secureDelete(`/produits/${id}`);
      setProduits(prev => prev.filter(p => p.id !== id));
      showNotif('Produit supprimé avec succès', 'success');
    } catch (err) {
      console.error('Erreur suppression produit', err);
      showNotif('Erreur lors de la suppression', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== GESTION DES FILTRES ====================

  const applyFilters = () => {
    setPage(0);
    fetchProduits({ categorie: filterCategorie || '', search });
    setOpenFilterDrawer(false);
  };
  
  const resetFilters = () => {
    setFilterCategorie(null);
    setSearch('');
    setPage(0);
    fetchProduits({ categorie: '', search: '' });
    setOpenFilterDrawer(false);
  };

  // ==================== GESTION DE LA PAGINATION ====================

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { 
    setRowsPerPage(parseInt(e.target.value, 10)); 
    setPage(0); 
  };

  // Produits visibles selon la pagination
  const visibleRows = useMemo(() => 
    produits.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), 
    [produits, page, rowsPerPage]
  );

  // ==================== CALCULS STATISTIQUES ====================

  const totalProduits = produits.length;
  const produitsEnStock = produits.filter(p => (parseInt(p.stock) || 0) > 0).length;
  const produitsStockFaible = produits.filter(p => {
    const stock = parseInt(p.stock) || 0;
    return stock > 0 && stock <= 10;
  }).length;
  const produitsRupture = produits.filter(p => (parseInt(p.stock) || 0) === 0).length;

  // ==================== RENDU ====================

  // Affichage du chargement initial
  if (loadingData && produits.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Chargement des produits...
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
            Gestion des Produits
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gérez votre catalogue de produits avec images
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ height: '40px' }}
        >
          Nouveau Produit
        </Button>
      </Box>

      {/* ==================== STATISTIQUES ==================== */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <InventoryIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{totalProduits}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Produits totaux
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
                  <InStockIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{produitsEnStock}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    En stock
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
                  <LowStockIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{produitsStockFaible}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stock faible
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
                <Avatar sx={{ bgcolor: 'error.main', mr: 2 }}>
                  <NoStockIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{produitsRupture}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    En rupture
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ==================== BARRE D'OUTILS ==================== */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Boutons de vue (cachés sur mobile) */}
          {!isMobile && (
            <Grid item xs={12} md={2}>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Mode tableau">
                  <IconButton 
                    size="small"
                    onClick={() => setViewMode('table')}
                    color={viewMode === 'table' ? 'primary' : 'default'}
                  >
                    <ViewListIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Mode grille">
                  <IconButton 
                    size="small"
                    onClick={() => setViewMode('grid')}
                    color={viewMode === 'grid' ? 'primary' : 'default'}
                  >
                    <GridIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Grid>
          )}

          {/* Barre de recherche */}
          <Grid item xs={12} md={4}>
            <TextField
              size="small"
              label="Rechercher un produit"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              onKeyPress={(e) => e.key === 'Enter' && applyFilters()}
            />
          </Grid>

          {/* Filtre par catégorie */}
          <Grid item xs={12} md={4}>
            <Autocomplete
              size="small"
              options={categories}
              value={filterCategorie}
              onChange={(e, newValue) => setFilterCategorie(newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Filtrer par catégorie" 
                  placeholder="Toutes catégories"
                />
              )}
              fullWidth
              loading={catLoading}
            />
          </Grid>

          {/* Boutons d'action */}
          <Grid item xs={12} md={2}>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Appliquer les filtres">
                <Button 
                  variant="outlined" 
                  onClick={applyFilters}
                  size="small"
                  fullWidth
                >
                  Filtrer
                </Button>
              </Tooltip>
              <Tooltip title="Nouvelle catégorie">
                <Button 
                  variant="contained" 
                  onClick={createCategorie}
                  size="small"
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  + Catégorie
                </Button>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ==================== FILTRES MOBILE (DRAWER) ==================== */}
      {isMobile && (
        <Drawer
          anchor="right"
          open={openFilterDrawer}
          onClose={() => setOpenFilterDrawer(false)}
        >
          <Box sx={{ width: '100vw', p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">Filtres</Typography>
              <IconButton onClick={() => setOpenFilterDrawer(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
            
            <Stack spacing={3}>
              <Autocomplete
                size="small"
                options={categories}
                value={filterCategorie}
                onChange={(e, newValue) => setFilterCategorie(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Catégorie" />
                )}
                fullWidth
              />
              
              <TextField
                size="small"
                label="Recherche"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={applyFilters} fullWidth>
                  Appliquer
                </Button>
                <Button variant="outlined" onClick={resetFilters} fullWidth>
                  Réinitialiser
                </Button>
              </Box>
            </Stack>
          </Box>
        </Drawer>
      )}

      {/* ==================== AFFICHAGE DES PRODUITS ==================== */}
      
      {/* Mode Tableau (Desktop/Tablet) */}
      {viewMode === 'table' && !isMobile ? (
        <Paper sx={{ overflow: 'hidden' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'primary.main' }}>
              <TableRow>
                <TableCell sx={{ color: 'white' }}>Produit</TableCell>
                <TableCell sx={{ color: 'white' }}>Catégorie</TableCell>
                <TableCell sx={{ color: 'white' }}>Prix</TableCell>
                <TableCell sx={{ color: 'white' }}>Stock</TableCell>
                <TableCell sx={{ color: 'white' }}>Code barres</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map(produit => (
                <TableRow key={produit.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Badge badgeContent={produit.images?.length || (produit.image ? 1 : 0)} color="primary" overlap="circular">
                        <Avatar 
                          src={buildImageUrl(produit.images?.[0] || produit.image)} 
                          sx={{ width: 50, height: 50, mr: 2 }}
                          variant="rounded"
                        >
                          <ImageIcon />
                        </Avatar>
                      </Badge>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">{produit.nom}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {produit.description?.substring(0, 50)}...
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={produit.categorie || 'Non catégorisé'}
                      size="small"
                      icon={<CategoryIcon />}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <PriceIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body1" fontWeight="medium" color="primary">
                        {parseFloat(produit.prix || 0).toFixed()} Fcfa
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <StockChip stock={produit.stock} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {produit.codeBarres || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Modifier">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenEditDialog(produit)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteProduit(produit.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {produits.length > 0 && (
            <TablePagination
              component="div"
              count={produits.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={isMobile ? [5, 10] : [5, 10, 25]}
              labelRowsPerPage="Produits par page:"
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
          )}
        </Paper>
      ) : (
        /* Mode Grille (Mobile ou sélectionné) */
        <Grid container spacing={2}>
          {visibleRows.map(produit => (
            <Grid item xs={6} sm={4} md={3} key={produit.id}>
              <ProductCard 
                produit={produit}
                onEdit={handleOpenEditDialog}
                onDelete={handleDeleteProduit}
                buildImageUrl={buildImageUrl}
              />
            </Grid>
          ))}
          
          {/* Pagination pour le mode grille */}
          {produits.length > 0 && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <TablePagination
                  component="div"
                  count={produits.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5, 10, 25]}
                  labelRowsPerPage="Produits par page:"
                />
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      {/* Message si aucun produit */}
      {produits.length === 0 && !loadingData && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 3 }}>
          <InventoryIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Aucun produit trouvé
          </Typography>
          <Button 
            variant="contained" 
            onClick={handleOpenAddDialog}
            startIcon={<AddIcon />}
            sx={{ mt: 2 }}
          >
            Ajouter votre premier produit
          </Button>
        </Paper>
      )}

      {/* ==================== DIALOG FORMULAIRE ==================== */}
      <Dialog
        open={openFormDialog}
        onClose={handleCloseFormDialog}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingProduit ? 'Modifier le produit' : 'Nouveau produit'}
          {isMobile && (
            <IconButton
              onClick={handleCloseFormDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress />
            </Box>
          )}
          
          <Stack spacing={2} sx={{ mt: 1, opacity: loading ? 0.5 : 1 }}>
            <Grid container spacing={2}>
              {/* Informations de base */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nom du produit *"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  fullWidth
                  required
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Prix (Fcfa) *"
                  value={prix}
                  onChange={(e) => setPrix(e.target.value)}
                  type="number"
                  fullWidth
                  required
                  disabled={loading}
                  InputProps={{
                    endAdornment: 'Fcfa'
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Stock"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Code barres"
                  value={codeBarres}
                  onChange={(e) => setCodeBarres(e.target.value)}
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              
              {/* Catégorie */}
              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={categories}
                  value={categorie}
                  onChange={(e, newValue) => setCategorie(newValue || '')}
                  disabled={loading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Catégorie *"
                      required
                      disabled={loading}
                    />
                  )}
                  fullWidth
                />
              </Grid>
              
              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={loading}
                  placeholder="Description détaillée du produit..."
                />
              </Grid>
              
              {/* Image */}
              <Grid item xs={12}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Images du produit (max 5)
                  </Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => fileInputRef.current.click()}
                    startIcon={<ImageIcon />}
                    disabled={loading || imagePreviews.length + existingImages.length >= 5}
                  >
                    Ajouter des images
                  </Button>
              
                  {/* Grille des aperçus */}
                  <Grid container spacing={1} sx={{ mt: 2 }}>
                    {/* Images déjà existantes (en édition) */}
                    {existingImages.map((imgName, idx) => (
                      <Grid item key={`existing-${idx}`}>
                        <Box sx={{ position: 'relative' }}>
                          <img
                            src={buildImageUrl(imgName)}
                            alt={`exist-${idx}`}
                            style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }}
                            onError={handleImgError}
                          />
                          <IconButton
                            size="small"
                            onClick={() => removeExistingImage(imgName)}
                            sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper' }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Grid>
                    ))}
              
                    {/* Nouvelles images sélectionnées */}
                    {imagePreviews.map((preview, idx) => (
                      <Grid item key={`preview-${idx}`}>
                        <Box sx={{ position: 'relative' }}>
                          <img
                            src={preview}
                            alt={`preview-${idx}`}
                            style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => removeImage(idx)}
                            sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper' }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            variant="outlined" 
            onClick={handleCloseFormDialog}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button 
            variant="contained" 
            onClick={editingProduit ? updateProduit : addProduit}
            disabled={!nom || !prix || !categorie || loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : editingProduit ? (
              'Mettre à jour'
            ) : (
              'Ajouter'
            )}
          </Button>
        </DialogActions>
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
