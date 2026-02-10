import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  LinearProgress,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Fab,
  Drawer,
  Toolbar,
  ListItemIcon,
  Collapse,
  Rating,
  Autocomplete
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as TrainIcon,
  Assessment as EvaluateIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  School as SchoolIcon,
  Psychology as PsychologyIcon,
  Dataset as DatasetIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  AutoAwesome as AutoAwesomeIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Security as SecurityIcon,
  GppGood as GppGoodIcon,
  Code as CodeIcon,
  Api as ApiIcon,
  PsychologyAlt as PsychologyAltIcon,
  Biotech as BiotechIcon,
  Science as ScienceIcon,
  Engineering as EngineeringIcon,
  Build as BuildIcon,
  SettingsSuggest as SettingsSuggestIcon,
  Tune as TuneIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Sort as SortIcon,
  ViewList as ViewListIcon,
  GridView as GridViewIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Archive as ArchiveIcon,
  Restore as RestoreIcon,
  Share as ShareIcon,
  Compare as CompareIcon,
  Insights as InsightsIcon,
  ModelTraining as ModelTrainingIcon,
  DataObject as DataObjectIcon,
  Functions as FunctionsIcon,
  Calculate as CalculateIcon,
  Analytics as AnalyticsIcon,
  Numbers as NumbersIcon,
  Tag as TagIcon,
  Category as CategoryIcon,
  Label as LabelIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  NoteAdd as NoteAddIcon,
  Description as DescriptionIcon,
  Article as ArticleIcon,
  TextFields as TextFieldsIcon,
  ShortText as ShortTextIcon,
  Subject as SubjectIcon,
  Title as TitleIcon,
  FormatQuote as FormatQuoteIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatListNumbered as FormatListNumberedIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignRight as FormatAlignRightIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  Link as LinkIcon,
  Attachment as AttachmentIcon,
  Image as ImageIcon,
  InsertPhoto as InsertPhotoIcon,
  VideoLibrary as VideoLibraryIcon,
  Audiotrack as AudiotrackIcon,
  Cloud as CloudIcon,
  Devices as DevicesIcon,
  Computer as ComputerIcon,
  Smartphone as SmartphoneIcon,
  Tablet as TabletIcon,
  Laptop as LaptopIcon,
  DesktopWindows as DesktopWindowsIcon,
  LaptopMac as LaptopMacIcon,
  PhoneIphone as PhoneIphoneIcon,
  PhoneAndroid as PhoneAndroidIcon,
  Settings as SettingsIcon,
  SettingsApplications as SettingsApplicationsIcon,
  BuildCircle as BuildCircleIcon,
  Handyman as HandymanIcon,
  Construction as ConstructionIcon,
  Engineering as EngineeringIcon,
  Architecture as ArchitectureIcon,
  DesignServices as DesignServicesIcon,
  Palette as PaletteIcon,
  Brush as BrushIcon,
  ColorLens as ColorLensIcon,
  Gradient as GradientIcon,
  Opacity as OpacityIcon,
  BlurOn as BlurOnIcon,
  Filter as FilterIcon,
  Filter1 as Filter1Icon,
  Filter2 as Filter2Icon,
  Filter3 as Filter3Icon,
  Filter4 as Filter4Icon,
  Filter5 as Filter5Icon,
  Filter6 as Filter6Icon,
  Filter7 as Filter7Icon,
  Filter8 as Filter8Icon,
  Filter9 as Filter9Icon,
  Filter9Plus as Filter9PlusIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { secureGet, securePost, securePut, secureDelete } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import TrainingScenarioEditor from '../components/training/TrainingScenarioEditor';

const AITrainingPage = () => {
  const theme = useTheme();
  const { user, loading: authLoading } = useAuth();
  
  // États principaux
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState([]);
  const [trainingMetrics, setTrainingMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [trainingProgress, setTrainingProgress] = useState(null);
  const [batchTraining, setBatchTraining] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  
  // États pour les modèles
  const [aiModels, setAiModels] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [modelTrainingHistory, setModelTrainingHistory] = useState([]);
  
  // Charger les données
  const loadData = useCallback(async () => {
    if (!user || authLoading) return;
    
    setLoading(true);
    try {
      // Charger les scénarios
      const scenariosRes = await secureGet('/api/ai-intent/training-scenarios');
      setScenarios(scenariosRes.data || []);
      
      // Charger les métriques d'entraînement
      const metricsRes = await secureGet('/api/ai-intent/training-metrics');
      setTrainingMetrics(metricsRes.data || {});
      
      // Charger les modèles
      const modelsRes = await secureGet('/api/ai-intent/models');
      setAiModels(modelsRes.data || []);
      
      // Définir le modèle actif
      const active = (modelsRes.data || []).find(m => m.isActive);
      setActiveModel(active || null);
      
      // Charger l'historique d'entraînement
      const historyRes = await secureGet('/api/ai-intent/training-history');
      setModelTrainingHistory(historyRes.data || []);
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
      showSnackbar('Erreur chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Gestion des scénarios
  const handleCreateScenario = () => {
    setEditorMode('create');
    setSelectedScenario(null);
    setEditorOpen(true);
  };

  const handleEditScenario = (scenario) => {
    setEditorMode('edit');
    setSelectedScenario(scenario);
    setEditorOpen(true);
  };

  const handleDeleteScenario = async (scenarioId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce scénario ?')) {
      try {
        await secureDelete(`/api/ai-intent/training-scenarios/${scenarioId}`);
        showSnackbar('Scénario supprimé avec succès', 'success');
        loadData();
      } catch (error) {
        showSnackbar('Erreur suppression', 'error');
      }
    }
  };

  const handleDuplicateScenario = async (scenario) => {
    try {
      const duplicate = {
        ...scenario,
        id: null,
        name: `${scenario.name} (Copie)`,
        metadata: {
          ...scenario.metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      };
      
      await securePost('/api/ai-intent/training-scenarios', duplicate);
      showSnackbar('Scénario dupliqué avec succès', 'success');
      loadData();
    } catch (error) {
      showSnackbar('Erreur duplication', 'error');
    }
  };

  const handleScenarioSaved = () => {
    setEditorOpen(false);
    showSnackbar('Scénario sauvegardé avec succès', 'success');
    loadData();
  };

  // Entraînement de l'IA
  const handleTrainModel = async (scenarioId = null) => {
    try {
      setTrainingProgress({ status: 'starting', progress: 0 });
      
      const endpoint = scenarioId 
        ? `/api/ai-intent/train/${scenarioId}`
        : '/api/ai-intent/train';
      
      const response = await securePost(endpoint, { batch: !scenarioId });
      
      // Simuler la progression (dans un vrai projet, utilisez WebSockets ou polling)
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setTrainingProgress({ status: 'training', progress });
        
        if (progress >= 100) {
          clearInterval(interval);
          setTrainingProgress({ status: 'completed', progress: 100 });
          
          setTimeout(() => {
            setTrainingProgress(null);
            showSnackbar(
              scenarioId ? 'Scénario entraîné avec succès' : 'Modèle entraîné avec succès',
              'success'
            );
            loadData();
          }, 1000);
        }
      }, 300);
      
    } catch (error) {
      setTrainingProgress({ status: 'failed', progress: 0 });
      showSnackbar('Erreur pendant l\'entraînement', 'error');
      console.error('Erreur entraînement:', error);
    }
  };

  const handleBatchTrain = async () => {
    setBatchTraining(true);
    await handleTrainModel();
    setBatchTraining(false);
  };

  // Évaluation du modèle
  const handleEvaluateModel = async () => {
    try {
      setTrainingProgress({ status: 'evaluating', progress: 0 });
      
      const response = await securePost('/api/ai-intent/evaluate');
      
      // Simuler la progression
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        setTrainingProgress({ status: 'evaluating', progress });
        
        if (progress >= 100) {
          clearInterval(interval);
          setTrainingProgress({ status: 'evaluation_completed', progress: 100 });
          
          setTimeout(() => {
            setTrainingProgress(null);
            showSnackbar('Évaluation terminée', 'success');
            loadData();
          }, 1500);
        }
      }, 200);
      
    } catch (error) {
      setTrainingProgress(null);
      showSnackbar('Erreur évaluation', 'error');
    }
  };

  // Export/Import
  const handleExportScenarios = async () => {
    try {
      const response = await secureGet('/api/ai-intent/export-scenarios');
      
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', `ai-scenarios-${new Date().toISOString().split('T')[0]}.json`);
      linkElement.click();
      
      showSnackbar('Scénarios exportés avec succès', 'success');
    } catch (error) {
      showSnackbar('Erreur export', 'error');
    }
  };

  const handleImportScenarios = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const scenarios = JSON.parse(e.target.result);
        
        await securePost('/api/ai-intent/import-scenarios', scenarios);
        showSnackbar('Scénarios importés avec succès', 'success');
        loadData();
      } catch (error) {
        showSnackbar('Format de fichier invalide ou erreur import', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Filtrage et recherche
  const filteredScenarios = scenarios.filter(scenario => {
    // Filtre par catégorie
    if (filterCategory !== 'all' && scenario.category !== filterCategory) {
      return false;
    }
    
    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        scenario.name.toLowerCase().includes(query) ||
        scenario.description?.toLowerCase().includes(query) ||
        scenario.input.toLowerCase().includes(query) ||
        scenario.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  // Statistiques
  const getStats = () => {
    const total = scenarios.length;
    const active = scenarios.filter(s => s.isActive).length;
    const categories = [...new Set(scenarios.map(s => s.category))];
    const avgConfidence = scenarios.reduce((sum, s) => sum + (s.confidenceThreshold || 0), 0) / total || 0;
    
    return { total, active, categories: categories.length, avgConfidence };
  };

  // Rendu des onglets
  const renderTabContent = () => {
    switch(activeTab) {
      case 0: // Scénarios
        return renderScenariosTab();
      case 1: // Performance
        return renderPerformanceTab();
      case 2: // Modèles
        return renderModelsTab();
      case 3: // Historique
        return renderHistoryTab();
      default:
        return null;
    }
  };

  const renderScenariosTab = () => (
    <Box>
      {/* Barre d'outils */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Rechercher un scénario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={filterCategory}
                label="Catégorie"
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <MenuItem value="all">Toutes les catégories</MenuItem>
                {[...new Set(scenarios.map(s => s.category))].map(category => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={() => setViewMode('list')} color={viewMode === 'list' ? 'primary' : 'default'}>
                <ViewListIcon />
              </IconButton>
              <IconButton onClick={() => setViewMode('grid')} color={viewMode === 'grid' ? 'primary' : 'default'}>
                <GridViewIcon />
              </IconButton>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateScenario}
            >
              Nouveau
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistiques rapides */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4">{getStats().total}</Typography>
              <Typography variant="caption">Scénarios</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4">{getStats().active}</Typography>
              <Typography variant="caption">Actifs</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4">{getStats().categories}</Typography>
              <Typography variant="caption">Catégories</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4">
                {(getStats().avgConfidence * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption">Confiance moyenne</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Liste/Grid des scénarios */}
      {viewMode === 'list' ? (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Catégorie</TableCell>
                  <TableCell>Intention</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell>Confiance</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredScenarios.map((scenario) => (
                  <TableRow key={scenario.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {scenario.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {scenario.description?.substring(0, 50)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={scenario.category} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{scenario.intent}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {scenario.tags?.slice(0, 3).map((tag, index) => (
                          <Chip key={index} label={tag} size="small" variant="outlined" />
                        ))}
                        {scenario.tags?.length > 3 && (
                          <Chip label={`+${scenario.tags.length - 3}`} size="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <LinearProgress 
                        variant="determinate" 
                        value={(scenario.confidenceThreshold || 0) * 100}
                        sx={{ width: 60 }}
                      />
                      <Typography variant="caption">
                        {(scenario.confidenceThreshold * 100).toFixed(0)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={scenario.isActive ? 'Actif' : 'Inactif'}
                        size="small"
                        color={scenario.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Tester">
                          <IconButton size="small" onClick={() => handleTrainModel(scenario.id)}>
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Modifier">
                          <IconButton size="small" onClick={() => handleEditScenario(scenario)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dupliquer">
                          <IconButton size="small" onClick={() => handleDuplicateScenario(scenario)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" onClick={() => handleDeleteScenario(scenario.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredScenarios.map((scenario) => (
            <Grid item xs={12} sm={6} md={4} key={scenario.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" noWrap sx={{ maxWidth: '70%' }}>
                      {scenario.name}
                    </Typography>
                    <Switch
                      size="small"
                      checked={scenario.isActive}
                      onChange={() => {/* TODO: Toggle actif/inactif */}}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" paragraph sx={{ mb: 2 }}>
                    {scenario.description?.substring(0, 100)}...
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Intention
                    </Typography>
                    <Chip label={scenario.intent} size="small" sx={{ mt: 0.5 }} />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {scenario.tags?.slice(0, 3).map((tag, index) => (
                        <Chip key={index} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Confiance
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={(scenario.confidenceThreshold || 0) * 100}
                      sx={{ mt: 0.5 }}
                    />
                    <Typography variant="caption" align="right" display="block">
                      {(scenario.confidenceThreshold * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEditScenario(scenario)}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => handleTrainModel(scenario.id)}
                    >
                      Tester
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  const renderPerformanceTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Performance du modèle
      </Typography>
      
      {trainingMetrics ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Métriques d'évaluation
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h3" color="primary">
                      {(trainingMetrics.accuracy * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">Précision</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h3" color="success.main">
                      {(trainingMetrics.precision * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">Précision</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h3" color="info.main">
                      {(trainingMetrics.recall * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">Rappel</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h3" color="warning.main">
                      {(trainingMetrics.f1Score * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption">F1-Score</Typography>
                  </Paper>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="h6" gutterBottom>
                Performance par catégorie
              </Typography>
              
              {trainingMetrics.categoryMetrics && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Catégorie</TableCell>
                        <TableCell align="right">Précision</TableCell>
                        <TableCell align="right">Rappel</TableCell>
                        <TableCell align="right">F1-Score</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(trainingMetrics.categoryMetrics).map(([category, metrics]) => (
                        <TableRow key={category}>
                          <TableCell>
                            <Chip label={category} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            {(metrics.precision * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell align="right">
                            {(metrics.recall * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell align="right">
                            {(metrics.f1Score * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Actions rapides
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<TrainIcon />}
                  onClick={handleBatchTrain}
                  disabled={batchTraining || trainingProgress}
                >
                  {batchTraining ? 'Entraînement en cours...' : 'Entraîner le modèle'}
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<EvaluateIcon />}
                  onClick={handleEvaluateModel}
                  disabled={trainingProgress}
                >
                  Évaluer la performance
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<ExportIcon />}
                  onClick={handleExportScenarios}
                >
                  Exporter les scénarios
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<ImportIcon />}
                  component="label"
                >
                  Importer des scénarios
                  <input
                    type="file"
                    hidden
                    accept=".json"
                    onChange={handleImportScenarios}
                  />
                </Button>
              </Box>
              
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="h6" gutterBottom>
                État actuel
              </Typography>
              
              {activeModel && (
                <Box>
                  <Typography variant="body2">
                    Modèle: <strong>{activeModel.name}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Version: <strong>{activeModel.version}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Entraîné le: <strong>
                      {new Date(activeModel.lastTrained).toLocaleDateString()}
                    </strong>
                  </Typography>
                  <Typography variant="body2">
                    Scénarios: <strong>{activeModel.trainedScenarios || 0}</strong>
                  </Typography>
                </Box>
              )}
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Aucune donnée de performance disponible
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Entraînez votre modèle pour voir les métriques de performance.
          </Typography>
          <Button
            variant="contained"
            startIcon={<TrainIcon />}
            onClick={handleBatchTrain}
          >
            Entraîner le modèle
          </Button>
        </Paper>
      )}
    </Box>
  );

  const renderModelsTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Gestion des modèles IA
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">
                Modèles disponibles
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />}>
                Nouveau modèle
              </Button>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Scénarios</TableCell>
                    <TableCell>Performance</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aiModels.map((model) => (
                    <TableRow 
                      key={model.id}
                      sx={{ 
                        bgcolor: model.isActive ? 'action.selected' : 'inherit',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {model.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {model.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={model.type} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">v{model.version}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{model.trainedScenarios || 0}</Typography>
                      </TableCell>
                      <TableCell>
                        <LinearProgress 
                          variant="determinate" 
                          value={(model.accuracy || 0) * 100}
                          sx={{ width: 60 }}
                        />
                        <Typography variant="caption">
                          {(model.accuracy * 100).toFixed(0)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={model.isActive ? 'Actif' : 'Inactif'}
                          size="small"
                          color={model.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Activer">
                            <IconButton size="small">
                              <PlayArrowIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Dupliquer">
                            <IconButton size="small">
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Information du modèle actif
            </Typography>
            
            {activeModel ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <PsychologyIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{activeModel.name}</Typography>
                    <Typography variant="caption">
                      Version {activeModel.version}
                    </Typography>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Description
                  </Typography>
                  <Typography variant="body2">{activeModel.description}</Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Type de modèle
                  </Typography>
                  <Chip label={activeModel.type} size="small" sx={{ mt: 0.5 }} />
                </Box>
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Scénarios
                    </Typography>
                    <Typography variant="h6">{activeModel.trainedScenarios || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Précision
                    </Typography>
                    <Typography variant="h6">
                      {(activeModel.accuracy * 100).toFixed(1)}%
                    </Typography>
                  </Grid>
                </Grid>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Dernier entraînement
                  </Typography>
                  <Typography variant="body2">
                    {new Date(activeModel.lastTrained).toLocaleString()}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Taille
                  </Typography>
                  <Typography variant="body2">
                    {(activeModel.size || 0).toFixed(2)} MB
                  </Typography>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" fullWidth>
                    Entraîner
                  </Button>
                  <Button variant="outlined" fullWidth>
                    Télécharger
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <PsychologyIcon sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Aucun modèle actif
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Créez ou activez un modèle pour commencer.
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderHistoryTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Historique d'entraînement
      </Typography>
      
      {modelTrainingHistory.length > 0 ? (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Modèle</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Scénarios</TableCell>
                  <TableCell>Durée</TableCell>
                  <TableCell>Performance</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modelTrainingHistory.map((history) => (
                  <TableRow key={history.id}>
                    <TableCell>
                      {new Date(history.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{history.modelName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={history.trainingType} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{history.scenariosTrained}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {Math.round(history.duration / 60)} min
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <LinearProgress 
                        variant="determinate" 
                        value={(history.accuracy || 0) * 100}
                        sx={{ width: 60 }}
                      />
                      <Typography variant="caption">
                        {(history.accuracy * 100).toFixed(0)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={history.status}
                        size="small"
                        color={
                          history.status === 'completed' ? 'success' :
                          history.status === 'failed' ? 'error' : 'warning'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <HistoryIcon sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Aucun historique disponible
          </Typography>
          <Typography variant="body2" color="textSecondary">
            L'historique d'entraînement apparaîtra ici après vos premiers entraînements.
          </Typography>
        </Paper>
      )}
    </Box>
  );

  // Progress overlay
  const renderProgressOverlay = () => {
    if (!trainingProgress) return null;

    const getStatusText = () => {
      switch(trainingProgress.status) {
        case 'starting': return 'Démarrage de l\'entraînement...';
        case 'training': return 'Entraînement en cours...';
        case 'evaluating': return 'Évaluation en cours...';
        case 'completed': return 'Entraînement terminé !';
        case 'evaluation_completed': return 'Évaluation terminée !';
        case 'failed': return 'Échec de l\'entraînement';
        default: return 'Traitement en cours...';
      }
    };

    return (
      <Dialog open={true} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress 
            size={60} 
            thickness={4}
            variant="determinate"
            value={trainingProgress.progress}
            sx={{ mb: 3 }}
          />
          
          <Typography variant="h6" gutterBottom>
            {getStatusText()}
          </Typography>
          
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {trainingProgress.progress}% complété
          </Typography>
          
          <LinearProgress 
            variant="determinate" 
            value={trainingProgress.progress}
            sx={{ width: '100%', mb: 3 }}
          />
          
          {trainingProgress.status === 'failed' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Une erreur est survenue pendant l'entraînement.
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Chargement...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* En-tête */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          <SchoolIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Entraînement de l'IA
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Gestion des scénarios d'entraînement, monitoring de performance et optimisation des modèles IA
        </Typography>
      </Box>

      {/* Statistiques rapides */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DatasetIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">{scenarios.length}</Typography>
                  <Typography variant="caption">Scénarios</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">
                    {trainingMetrics ? (trainingMetrics.accuracy * 100).toFixed(1) : '0'}%
                  </Typography>
                  <Typography variant="caption">Précision</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TimerIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">
                    {modelTrainingHistory.length}
                  </Typography>
                  <Typography variant="caption">Entraînements</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PrecisionManufacturingIcon sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4">
                    {aiModels.length}
                  </Typography>
                  <Typography variant="caption">Modèles</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Onglets */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<DatasetIcon />} label="Scénarios" />
          <Tab icon={<TrendingUpIcon />} label="Performance" />
          <Tab icon={<PsychologyIcon />} label="Modèles" />
          <Tab icon={<HistoryIcon />} label="Historique" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderTabContent()
          )}
        </Box>
      </Paper>

      {/* Dialog d'édition de scénario */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={window.innerWidth < 900}
      >
        <DialogTitle>
          {editorMode === 'create' ? 'Nouveau scénario' : 'Modifier le scénario'}
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: '60vh' }}>
          <TrainingScenarioEditor
            initialData={selectedScenario}
            mode={editorMode}
            onScenarioSaved={handleScenarioSaved}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Overlay de progression */}
      {renderProgressOverlay()}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* SpeedDial pour actions rapides */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleCreateScenario}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default AITrainingPage;
