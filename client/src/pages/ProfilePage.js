// ProfilePage.jsx - Version complète conforme Meta avec Webhooks Messenger
// VERSION OPTIMISÉE AVEC CONFORMITÉ META COMPLÈTE

// Import React hooks

import React from 'react';
import { useState, useEffect, useRef } from 'react';

// Import des composants MUI
import {
  Box,
  ListItemIcon,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  TextField,
  Button,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  InputAdornment,
  Tooltip,
  CircularProgress,
  Badge,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  AlertTitle,
  Collapse,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';

// Import de TOUTES les icônes
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Chat as ChatIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Key as KeyIcon,
  WhatsApp as WhatsAppIcon,
  Facebook as FacebookIcon,
  Sms as SmsIcon,
  Refresh as RefreshIcon,
  AccountCircle as AccountCircleIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  CalendarToday as CalendarTodayIcon,
  Psychology as PsychologyIcon,
  SmartToy as SmartToyIcon,
  Webhook as WebhookIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Insights as InsightsIcon,
  Bolt as BoltIcon,
  Memory as MemoryIcon,
  Business as BusinessIcon,
  Send as SendIcon,
  ContentCopy as ContentCopyIcon,
  CheckCircle as CheckCircleIcon,
  ChevronRight as ChevronRightIcon,
  People as PeopleIcon,
  BugReport as BugReportIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Cached as CachedIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  VerifiedUser as VerifiedUserIcon,
  Help as HelpIcon,
  Code as CodeIcon,
  Link as LinkIcon,
  Assignment as AssignmentIcon,
  DoneAll as DoneAllIcon,
  Telegram as TelegramIcon

} from '@mui/icons-material';

// Vos autres imports
import { useAuth } from '../auth/AuthContext';
import { secureGet, securePost, securePut, secureDelete } from '../services/api';
import { useSnackbar } from 'notistack';
import PlatformOnboardingWizard from '../components/onboarding/PlatformOnboardingWizard';

// Composant TabPanel
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Composant PlatformIcon
function PlatformIcon({ platform }) {
  switch (platform?.toLowerCase()) {
    case 'whatsapp':
    case 'twilio':
    case 'twilio_whatsapp':
      return <WhatsAppIcon color="success" />;
    case 'messenger':
    case 'facebook':
    case 'facebook_messenger':
      return <FacebookIcon color="primary" />;
    case 'sms':
      return <SmsIcon color="info" />;
    case 'whatsapp_business':
      return <WhatsAppIcon color="secondary" />;
    case 'telegram':
      return <TelegramIcon color="primary" />;
    default:
      return <KeyIcon />;
  }
}

// Composant PlatformDisplay
function PlatformDisplay({ account }) {
  const getPlatformName = (platform) => {
    const names = {
      'facebook_messenger': 'Facebook Messenger',
      'whatsapp_business': 'WhatsApp Business',
      'whatsapp': 'WhatsApp',
      'twilio': 'Twilio',
      'sms': 'SMS',
      'telegram': 'Telegram'
    };
    return names[platform] || platform;
  };

  const getPlatformColor = (platform) => {
    const colors = {
      'facebook_messenger': '#1877F2',
      'whatsapp_business': '#25D366',
      'whatsapp': '#25D366',
      'twilio': '#F22F46',
      'sms': '#666666',
      'telegram': '#0088cc'
    };
    return colors[platform] || '#666666';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${getPlatformColor(account.platform)}15`,
          color: getPlatformColor(account.platform)
        }}
      >
        <PlatformIcon platform={account.platform} />
      </Box>
      <Box>
        <Typography variant="body2" fontWeight="medium">
          {getPlatformName(account.platform)}
        </Typography>
        {account.platform_type && account.platform_type !== 'generic' && (
          <Typography variant="caption" color="text.secondary">
            {account.platform_type}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// Composant StatusChip
function StatusChip({ status }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'connected':
      case 'enabled':
      case 'success':
      case 'verified':
        return 'success';
      case 'inactive':
      case 'disconnected':
      case 'disabled':
      case 'error':
      case 'failed':
        return 'error';
      case 'pending':
      case 'processing':
      case 'warning':
      case 'verification_pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'verification_pending': 'Vérification en attente',
      'verified': 'Vérifié',
      'failed': 'Échec',
      'active': 'Actif',
      'inactive': 'Inactif'
    };
    return labels[status] || status;
  };

  return (
    <Chip
      label={getStatusLabel(status)}
      size="small"
      color={getStatusColor(status)}
      variant="outlined"
    />
  );
}

// Composant WebhookLogEntry
function WebhookLogEntry({ log, onExpand }) {
  const [expanded, setExpanded] = useState(false);
  
  const getStatusIcon = (status) => {
    if (status >= 200 && status < 300) return <CheckCircleIcon color="success" fontSize="small" />;
    if (status >= 400 && status < 500) return <WarningIcon color="warning" fontSize="small" />;
    if (status >= 500) return <ErrorIcon color="error" fontSize="small" />;
    return <InfoIcon fontSize="small" />;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getPayloadSummary = (payload) => {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (parsed.object === 'page') return 'Facebook Page Event';
      if (parsed.entry) return `Facebook Entry: ${parsed.entry.length} events`;
      if (parsed.message) return `Message: ${parsed.message.substring(0, 50)}...`;
      if (parsed.event) return `Event: ${parsed.event}`;
      return `${Object.keys(parsed).length} champs`;
    } catch {
      return 'Données brutes';
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ py: 1, px: 2 }}>
        <Grid container alignItems="center" spacing={1}>
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlatformIcon platform={log.platform} />
              <Typography variant="body2" fontWeight="medium">
                {log.platform === 'facebook_messenger' ? 'Messenger' : log.platform}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon(log.status_code)}
              <StatusChip status={log.status_code >= 200 && log.status_code < 300 ? 'success' : 'error'} />
              <Typography variant="body2" color="text.secondary">
                {log.status_code}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Typography variant="body2" noWrap title={log.url}>
              {log.url?.split('/').pop() || 'N/A'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Typography variant="body2" color="text.secondary">
              {getPayloadSummary(log.payload)}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(log.timestamp)}
              </Typography>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Grid>
        </Grid>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Headers
                </Typography>
                <pre style={{ 
                  fontSize: '12px', 
                  backgroundColor: '#f5f5f5', 
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(log.headers || {}, null, 2)}
                </pre>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Payload
                </Typography>
                <pre style={{ 
                  fontSize: '12px', 
                  backgroundColor: '#f5f5f5', 
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(typeof log.payload === 'string' ? JSON.parse(log.payload || '{}') : log.payload, null, 2)}
                </pre>
              </Grid>
              
              {log.error && (
                <Grid item xs={12}>
                  <Alert severity="error">
                    <AlertTitle>Erreur</AlertTitle>
                    {log.error}
                  </Alert>
                </Grid>
              )}
              
              {log.response && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Réponse
                  </Typography>
                  <pre style={{ 
                    fontSize: '12px', 
                    backgroundColor: '#e8f5e8', 
                    padding: '8px',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(log.response, null, 2)}
                  </pre>
                </Grid>
              )}
            </Grid>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

const ReconnectNotification = ({ accounts, onReconnect, onClose }) => {
  if (accounts.length === 0) return null;
  
  const getMessage = () => {
    if (accounts.length === 1) {
      return `La page "${accounts[0].page_name}" nécessite une reconnexion Facebook.`;
    } else {
      return `${accounts.length} pages Facebook nécessitent une reconnexion.`;
    }
  };
  
  return (
    <Alert 
      severity="warning"
      sx={{ 
        mb: 3,
        borderLeft: '4px solid',
        borderColor: 'warning.main',
        '& .MuiAlert-message': { width: '100%' }
      }}
      action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            color="inherit"
            size="small"
            variant="outlined"
            onClick={onReconnect}
            startIcon={<FacebookIcon />}
          >
            Reconnecter maintenant
          </Button>
          <IconButton
            size="small"
            onClick={onClose}
          >
            <ClearIcon />
          </IconButton>
        </Box>
      }
    >
      <AlertTitle>Reconnexion requise</AlertTitle>
      {getMessage()}
      <Typography variant="body2" sx={{ mt: 1 }}>
        Cliquez sur "Reconnecter maintenant" pour lancer le processus OAuth.
      </Typography>
      
      {/* Liste des comptes expirés */}
      <List dense sx={{ mt: 1 }}>
        {accounts.map(account => (
          <ListItem key={account.id} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <FacebookIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText 
              primary={account.page_name || account.name}
              secondary={`Statut: ${account.verification_status || 'inconnu'}`}
            />
          </ListItem>
        ))}
      </List>
    </Alert>
  );
};

// Composant principal
export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [tabValue, setTabValue] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true); 
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [loadingAIStats, setLoadingAIStats] = useState(false);
  
  // Informations utilisateur
  const [editMode, setEditMode] = useState(false);
  const [userData, setUserData] = useState(() => ({
    name: user?.name || user?.username || '',
    email: user?.email || '',
    username: user?.username || '',
    phone: '',
    role: user?.role || 'Utilisateur',
    department: 'Général',
    createdAt: ''
  }));
  
  // Comptes webhooks - MIS À JOUR POUR META
  const [webhookAccounts, setWebhookAccounts] = useState([]);
  const [showNewAccountDialog, setShowNewAccountDialog] = useState(false);
  const [showToken, setShowToken] = useState({});
  const [newAccount, setNewAccount] = useState({
    platform: 'facebook_messenger', // Default to Facebook Messenger
    platform_type: 'facebook_messenger',
    account_sid: '',
    auth_token: '',
    phone_number: '',
    webhook_url: '',
    is_active: true,
    name: '',
    
    // Champs spécifiques Facebook Messenger
    access_token: '',
    page_id: '',
    page_name: '',
    app_id: '',
    app_secret: '',
    verify_token: Math.random().toString(36).substring(2, 15), // Génère un token aléatoire
    webhook_fields: ['messages', 'messaging_postbacks'],
    graph_api_version: 'v18.0',
    
    business_id: '',
    ai_enabled: false,
    auto_reply: false,
    config_data: {}
  });
  const [showPlatformWizard, setShowPlatformWizard] = useState(false);
  const [selectedPlatformForWizard, setSelectedPlatformForWizard] = useState(null);

  // LOGS DES WEBHOOKS
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilters, setLogFilters] = useState({
    platform: 'all',
    status: 'all',
    search: '',
    dateRange: '24h'
  });
  const [logsPage, setLogsPage] = useState(0);
  const [logsPerPage, setLogsPerPage] = useState(10);
  const [totalLogs, setTotalLogs] = useState(0);
  const [liveLogging, setLiveLogging] = useState(false);
  const [logSocket, setLogSocket] = useState(null);
  const logsEndRef = useRef(null);

  // Statistiques générales
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeConversations: 0,
    totalMessages: 0,
    lastActivity: '',
    automationEnabled: true,
    facebookConnected: false,
    facebookPages: 0
  });
  
  // Statistiques IA
  const [aiStats, setAiStats] = useState({
    total_ai_conversations: 0,
    orders_converted: 0,
    active_rules: 0,
    avg_intent_confidence: 0,
    clients_profiled: 0,
    recent_activity: []
  });
  
  // Paramètres automation
  const [automationSettings, setAutomationSettings] = useState({
    autoResponder: true,
    autoCreateContacts: true,
    autoUpdateConversations: true,
    autoProcessOrders: true,
    autoGenerateQuotes: false,
    workingHoursOnly: false,
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00'
  });
  
  // Paramètres IA
  const [aiSettings, setAiSettings] = useState({
    enabled: true,
    confidence_threshold: 0.7,
    max_context_length: 10,
    learning_enabled: true,
    rule_based_responses: true,
    product_recommendations: true,
    sentiment_analysis: true,
    language: 'fr'
  });
  
  // Configuration webhook IA
  const [webhookConfig, setWebhookConfig] = useState({
    ai_webhook_url: '',
    webhook_secret: '',
    verify_token: '',
    webhook_enabled: true,
    auto_setup: true
  });

  // États pour le mode agence
  const [simplifiedMode, setSimplifiedMode] = useState(false);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [invitationData, setInvitationData] = useState({
    client_name: '',
    client_email: '',
    invitation_method: 'email',
    client_phone: ''
  });

  // États pour le flux OAuth
  const [facebookOAuth, setFacebookOAuth] = useState({
    isActive: false,
    currentStep: 0, // 0: non démarré, 1: connexion, 2: sélection page, 3: configuration
    sessionId: null,
    pages: [],
    selectedPage: null,
    facebookUser: null
  });

  const [accountsNeedReconnect, setAccountsNeedReconnect] = useState([]);
  const [showReconnectNotification, setShowReconnectNotification] = useState(false);

  // Démarrer le flux OAuth Facebook
  const startFacebookOAuthFlow = async () => {
    try {
      setLoading(true);
      setFacebookOAuth(prev => ({ ...prev, currentStep: 1 }));
      
      const initResponse = await secureGet('/facebook/oauth/init');
      if (!initResponse.data?.success) throw new Error('Init failed');

      const authWindow = window.open(
        initResponse.data.oauth_url,
        'facebook_oauth',
        'width=600,height=700,left=100,top=100'
      );

      if (!authWindow) throw new Error('Popup blocked');

      // POLLING AU LIEU D'ATTENDRE UN MESSAGE
      const sessionId = initResponse.data.state; // ou générez un ID côté client
      
      const pollInterval = setInterval(async () => {
        try {
          // Utiliser le STATE (pas sessionId) pour vérifier
          const checkResponse = await secureGet(`/facebook/oauth/check/${initResponse.data.state}`);
          
          if (checkResponse.data?.success && checkResponse.data?.ready) {
            clearInterval(pollInterval);
            
            // SUCCÈS ! Récupérer les données directement depuis check
            setFacebookOAuth({
              isActive: true,
              currentStep: 2,
              sessionId: checkResponse.data.sessionId,
              pages: checkResponse.data.pages || [],
              facebookUser: checkResponse.data.facebookUser
            });
            setLoading(false);
            enqueueSnackbar(`${checkResponse.data.pages?.length || 0} pages trouvées!`, { variant: 'success' });
          }
        } catch (error) {
          console.log('Polling...', error.message);
          if (error.response?.status === 404) {
            // Session pas encore créée, c'est normal, on continue
            console.log('En attente de connexion Facebook...');
          }
        }
      }, 2000);// Vérifier toutes les 2 secondes

      // Nettoyage après 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (authWindow && !authWindow.closed) authWindow.close();
      }, 300000);

    } catch (error) {
      console.error('OAuth Error:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
      setFacebookOAuth({ isActive: false, currentStep: 0 });
      setLoading(false);
    }
  };

  // Gérer la fin de l'OAuth
  const handleOAuthComplete = async (sessionId, facebookUser) => {
    try {
      console.log('✅ OAuth complété, session:', sessionId);
      
      // 1. Récupérer les pages depuis la session
      const pagesResponse = await secureGet(`/facebook/oauth/pages/${sessionId}`);
      
      if (pagesResponse.data.success) {
        setFacebookOAuth(prev => ({
          ...prev,
          currentStep: 2,
          sessionId: sessionId,
          pages: pagesResponse.data.pages,
          facebookUser: facebookUser
        }));
        
        enqueueSnackbar(
          `${pagesResponse.data.pages.length} pages trouvées`, 
          { variant: 'success' }
        );
        
        // Si une seule page, la sélectionner automatiquement
        if (pagesResponse.data.pages.length === 1) {
          setTimeout(() => {
            selectPageForConnection(pagesResponse.data.pages[0]);
          }, 500);
        }
        
      } else {
        throw new Error(pagesResponse.data.error || 'Erreur récupération pages');
      }
      
    } catch (error) {
      console.error('❌ Erreur récupération pages:', error);
      enqueueSnackbar('Erreur lors de la récupération des pages', { variant: 'error' });
      
      // Revenir à l'étape initiale
      setFacebookOAuth({
        isActive: false,
        currentStep: 0,
        sessionId: null,
        pages: [],
        selectedPage: null,
        facebookUser: null
      });
    }
  };

  // Sélectionner une page
  const selectPageForConnection = (page) => {
    console.log('📝 Page sélectionnée:', page.name);
    
    setFacebookOAuth(prev => ({
      ...prev,
      currentStep: 3,
      selectedPage: page
    }));
    
    // Pré-remplir le formulaire
    setNewAccount(prev => ({
      ...prev,
      platform: 'facebook_messenger',
      platform_type: 'facebook_messenger',
      name: `${page.name} (Messenger)`,
      page_id: page.id,
      page_name: page.name,
      access_token: page.access_token,
      verify_token: `fb_${user?.id}_${page.id}_${Date.now()}`,
      webhook_fields: ['messages', 'messaging_postbacks'],
      is_active: true,
      ai_enabled: true,
      auto_reply: true,
      
    }));
  };

  // Finaliser la connexion
  const finalizeFacebookConnection = async () => {
    try {
      setLoading(true);
      
      const { sessionId, selectedPage } = facebookOAuth;
      const userId = user?.id || user?.userId;
      const schemaName = `user_${userId}`;
      
      // 1. Préparer les données - TOUJOURS ACTIF
      const accountPayload = {
        name: `${selectedPage.name} (Messenger)`,
        platform: 'facebook_messenger',
        platform_type: 'facebook_messenger',
        page_id: selectedPage.id,
        page_name: selectedPage.name,
        access_token: selectedPage.access_token,
        verify_token: newAccount.verify_token || `fb_${Date.now()}`,
        webhook_url: `${window.location.origin}/api/webhook/messenger/${userId}`,
        webhook_fields: ['messages', 'messaging_postbacks'],
        
        // ⭐ CRITIQUE : Toujours actif et vérifié à la création
        is_active: true,              // Pas false !
        meta_verified: true,          // Marquer comme vérifié
        verification_status: 'verified', // Statut explicite
        
        ai_enabled: newAccount.ai_enabled !== false,
        auto_reply: newAccount.auto_reply !== false,
        
        config_data: {
          page_id: selectedPage.id,
          connected_at: new Date().toISOString(),
          oauth_completed: true
        }
      };
      
      console.log('🔧 Création compte avec statut:', {
        is_active: accountPayload.is_active,
        verification_status: accountPayload.verification_status
      });
      
      // 2. Créer le compte
      const response = await securePost('/webhook-accounts', accountPayload);
      
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erreur création');
      }
      
      const newAccountId = response.data.data.id;
      console.log('✅ Compte créé ID:', newAccountId);
      
      // 3. Créer le mapping GLOBAL immédiatement (pour que le webhook fonctionne)
      await securePost('/facebook/mapping', {
        page_id: selectedPage.id,
        user_id: userId,
        schema_name: schemaName,
        account_id: newAccountId,
        page_name: selectedPage.name,
        verify_token: accountPayload.verify_token,
        is_active: true  // aussi actif dans le mapping
      });
      
      // 4. Mettre à jour l'UI immédiatement avec le statut actif
      const accountWithActiveStatus = {
        ...response.data.data,
        is_active: true,
        verification_status: 'verified',
        meta_verified: true
      };
      
      setWebhookAccounts(prev => [accountWithActiveStatus, ...prev]);
      
      enqueueSnackbar(`"${selectedPage.name}" connectée avec succès !`, { variant: 'success' });
      
      // 5. Nettoyer et fermer
      setShowPlatformWizard(false);
      setFacebookOAuth({
        isActive: false,
        currentStep: 0,
        sessionId: null,
        pages: [],
        selectedPage: null,
        facebookUser: null
      });
      
      // 6. Forcer le rafraîchissement des stats
      await fetchStats();
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };


  
  // Écouteur pour les messages OAuth - À placer dans vos useEffect, après les déclarations de state
  useEffect(() => {
    console.log('👂 [OAuth] Installation de l\'écouteur de messages');
    
    // Vérifier s'il y a déjà une connexion en cours (localStorage fallback)
    const checkPendingOAuth = () => {
      try {
        const pending = localStorage.getItem('fb_oauth_pending');
        if (pending) {
          const data = JSON.parse(pending);
          // Vérifier si c'est récent (moins de 2 minutes)
          if (Date.now() - data.timestamp < 120000) {
            console.log('🔄 [OAuth] Reprise d\'une connexion en cours:', data);
            setFacebookOAuth(prev => ({
              ...prev,
              isActive: true,
              currentStep: 1
            }));
          } else {
            localStorage.removeItem('fb_oauth_pending');
          }
        }
      } catch (e) {
        console.error('❌ [OAuth] Erreur checkPending:', e);
      }
    };
    
    checkPendingOAuth();

    const handleOAuthMessage = (event) => {
      console.log('📩 [OAuth] Message reçu:', {
        origin: event.origin,
        type: event.data?.type,
        data: event.data
      });

      // Sécurité : vérifier le type de message pour éviter les conflits avec d'autres iframes
      if (!event.data || typeof event.data !== 'object') {
        console.log('⚠️ [OAuth] Message ignoré (format invalide):', event.data);
        return;
      }

      if (event.data.type === 'FACEBOOK_OAUTH_SUCCESS') {
        console.log('✅ [OAuth] Succès détecté! Session:', event.data.sessionId);
        
        // IMPORTANT : Vérifier que les données essentielles sont présentes
        if (!event.data.sessionId) {
          console.error('❌ [OAuth] sessionId manquant dans le message!');
          enqueueSnackbar('Erreur: Données de sessionincomplètes', { variant: 'error' });
          return;
        }

        // Mise à jour immédiate du state
        setFacebookOAuth(prev => {
          console.log('🔄 [OAuth] Mise à jour state:', {
            oldStep: prev.currentStep,
            newStep: 2,
            pagesCount: event.data.pages?.length || 0
          });
          return {
            ...prev,
            isActive: true,
            currentStep: 2, // Passage à l'étape "Sélection des pages"
            sessionId: event.data.sessionId,
            facebookUser: event.data.facebookUser || null,
            pages: event.data.pages || []
          };
        });

        // Notification succès
        const pageCount = event.data.pages?.length || 0;
        enqueueSnackbar(
          pageCount > 0 
            ? `${pageCount} page(s) Facebook trouvée(s)!` 
            : 'Connecté à Facebook (aucune page trouvée)',
          { variant: pageCount > 0 ? 'success' : 'warning' }
        );

        // Nettoyer le localStorage
        localStorage.removeItem('fb_oauth_pending');
        localStorage.removeItem('fb_oauth_success');

      } else if (event.data.type === 'FACEBOOK_OAUTH_ERROR') {
        console.error('❌ [OAuth] Erreur reçue:', event.data.error);
        
        enqueueSnackbar(
          `Erreur connexion: ${event.data.error || 'Inconnue'}`, 
          { variant: 'error' }
        );
        
        // Reset complet
        setFacebookOAuth({
          isActive: false,
          currentStep: 0,
          sessionId: null,
          pages: [],
          selectedPage: null,
          facebookUser: null
        });
        
        localStorage.removeItem('fb_oauth_pending');
      }
    };

    // Ajouter l'écouteur
    window.addEventListener('message', handleOAuthMessage);
    
    // Vérifier périodiquement le localStorage (backup si postMessage échoue)
    const localStorageCheck = setInterval(() => {
      try {
        const success = localStorage.getItem('fb_oauth_success');
        if (success) {
          const data = JSON.parse(success);
          // Vérifier que c'est récent
          if (Date.now() - data.timestamp < 60000) {
            console.log('📦 [OAuth] Données trouvées dans localStorage');
            handleOAuthMessage({ 
              data,
              origin: window.location.origin 
            });
          }
          localStorage.removeItem('fb_oauth_success');
        }
      } catch (e) {
        console.error('❌ [OAuth] Erreur localStorage:', e);
      }
    }, 2000); // Vérifier toutes les 2 secondes

    return () => {
      console.log('🧹 [OAuth] Nettoyage de l\'écouteur');
      window.removeEventListener('message', handleOAuthMessage);
      clearInterval(localStorageCheck);
    };
  }, []); // IMPORTANT: Dépendances vides pour n'exécuter qu'une fois

  // Nouvelle fonction pour récupérer les pages via la session (fallback)
  const fetchFacebookPagesFromSession = async (sessionId) => {
    try {
      setLoading(true);
      console.log('📄 Récupération des pages via session:', sessionId);
      
      const response = await secureGet(`/facebook/oauth/pages/${sessionId}`);
      
      if (response.data?.success) {
        console.log('✅ Pages récupérées via API:', response.data.pages?.length);
        
        setFacebookOAuth(prev => ({
          ...prev,
          pages: response.data.pages || [],
          facebookUser: response.data.facebook_user || prev.facebookUser
        }));
      } else {
        throw new Error(response.data?.error || 'Erreur API');
      }
    } catch (error) {
      console.error('❌ Erreur récupération pages:', error);
      enqueueSnackbar('Erreur lors du chargement des pages', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fonction obsolète mais gardée pour compatibilité si besoin
  //const fetchFacebookPages = async (accessToken) => {
    console.log('⚠️ fetchFacebookPages appelé avec token (obsolète)');
    // Cette fonction n'est plus nécessaire car les pages viennent avec le postMessage
    // ou via fetchFacebookPagesFromSession
  
  
  // État pour les étapes de configuration Facebook
  const [facebookSetupStep, setFacebookSetupStep] = useState(0);
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingFacebookPages, setLoadingFacebookPages] = useState(false);
  
  const isAgencyUser = user?.role === 'admin' || user?.role === 'agence';

  // ==================== FONCTIONS PRINCIPALES ====================

  // Fonction pour récupérer les logs des webhooks
  const fetchWebhookLogs = async (page = 0, filters = logFilters) => {
    try {
      setLoadingLogs(true);
      
      const params = new URLSearchParams({
        page: page + 1,
        limit: logsPerPage,
        ...(filters.platform !== 'all' && { platform: filters.platform }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.dateRange && { date_range: filters.dateRange })
      });

      const response = await secureGet(`/webhook-logs?${params}`);
      
      if (response.data && response.data.data) {
        setWebhookLogs(response.data.data.logs || []);
        setTotalLogs(response.data.data.total || 0);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des logs:', error);
      enqueueSnackbar('Erreur lors du chargement des logs', { variant: 'error' });
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fonction pour démarrer l'écoute en temps réel
  const startLiveLogging = () => {
    if (logSocket) {
      logSocket.close();
    }

    const socket = new WebSocket(`ws://${window.location.host}/ws/webhook-logs`);
    
    socket.onmessage = (event) => {
      const log = JSON.parse(event.data);
      setWebhookLogs(prev => [log, ...prev.slice(0, 99)]); // Garder seulement les 100 derniers
      
      // Scroll automatique vers le bas
      if (logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    socket.onopen = () => {
      setLiveLogging(true);
      enqueueSnackbar('Logs en temps réel activés', { variant: 'success' });
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      enqueueSnackbar('Erreur de connexion WebSocket', { variant: 'error' });
      setLiveLogging(false);
    };

    socket.onclose = () => {
      setLiveLogging(false);
    };

    setLogSocket(socket);
  };

  // Fonction pour arrêter l'écoute en temps réel
  const stopLiveLogging = () => {
    if (logSocket) {
      logSocket.close();
      setLogSocket(null);
      setLiveLogging(false);
      enqueueSnackbar('Logs en temps réel désactivés', { variant: 'info' });
    }
  };

  // Fonction pour exporter les logs
  const exportLogs = async () => {
    try {
      const response = await secureGet('/webhook-logs/export', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `webhook-logs-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      enqueueSnackbar('Logs exportés avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      enqueueSnackbar('Erreur lors de l\'export', { variant: 'error' });
    }
  };

  // Fonction pour effacer les logs
  const clearLogs = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir effacer tous les logs ? Cette action est irréversible.')) {
      return;
    }

    try {
      await secureDelete('/webhook-logs');
      setWebhookLogs([]);
      setTotalLogs(0);
      enqueueSnackbar('Logs effacés avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'effacement:', error);
      enqueueSnackbar('Erreur lors de l\'effacement', { variant: 'error' });
    }
  };

  // Fonction pour récupérer les données utilisateur
  const fetchUserData = async () => {
    try {
      setInitialLoading(true);
      const userId = user?.id || user?.userId;
      
      if (!userId) {
        setUserData({
          name: user?.name || user?.username || '',
          email: user?.email || '',
          username: user?.username || '',
          phone: '',
          role: user?.role || 'Utilisateur',
          department: 'Général',
          createdAt: ''
        });
        return;
      }
      
      try {
        const response = await secureGet(`/users/${userId}`);
        if (response.data && response.data.data) {
          setUserData({
            name: response.data.data.name || user?.name || user?.username || '',
            email: response.data.data.email || user?.email || '',
            username: response.data.data.username || user?.username || '',
            phone: response.data.data.phone || '',
            role: response.data.data.role || user?.role || 'Utilisateur',
            department: response.data.data.department || 'Général',
            createdAt: response.data.data.createdAt || ''
          });
        }
      } catch (apiError) {
        setUserData({
          name: user?.name || user?.username || '',
          email: user?.email || '',
          username: user?.username || '',
          phone: '',
          role: user?.role || 'Utilisateur',
          department: 'Général',
          createdAt: ''
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
      enqueueSnackbar('Erreur lors du chargement des données', { variant: 'error' });
      setUserData({
        name: user?.name || user?.username || '',
        email: user?.email || '',
        username: user?.username || '',
        phone: '',
        role: user?.role || 'Utilisateur',
        department: 'Général',
        createdAt: ''
      });
    } finally {
      setInitialLoading(false);
    }
  };

  // Fonction pour récupérer les comptes webhooks
  const fetchWebhookAccounts = async () => {
    try {
      setLoadingWebhooks(true);
      const response = await secureGet('/webhook-accounts');
      
      if (response.data && response.data.data) {
        const accounts = Array.isArray(response.data.data) ? response.data.data : [];
        setWebhookAccounts(accounts);

        // VÉRIFIER LES COMPTES EXPIRÉS
        detectAccountsNeedingReconnect(accounts);
        checkAccountsNeedReconnect(accounts);
        
        const tokenStates = {};
        accounts.forEach(account => {
          if (account && account.id) {
            tokenStates[account.id] = false;
          }
        });
        setShowToken(tokenStates);
        
        // Mettre à jour les statistiques Facebook
        const facebookAccounts = accounts.filter(acc => acc.platform === 'facebook_messenger');
        setStats(prev => ({
          ...prev,
          facebookConnected: facebookAccounts.length > 0,
          facebookPages: facebookAccounts.length
        }));
      } else {
        setWebhookAccounts([]);
        setShowToken({});
      }
    } catch (error) {
      console.error('Erreur lors du chargement des comptes webhook:', error);
      enqueueSnackbar('Erreur lors du chargement des comptes webhook', { variant: 'error' });
      setWebhookAccounts([]);
      setShowToken({});
    } finally {
      setLoadingWebhooks(false);
    }
  };

  // Fonction pour détecter les comptes nécessitant reconnexion
  const detectAccountsNeedingReconnect = (accounts) => {
    const expiredAccounts = accounts.filter(account => {
      // Critères : compte Facebook + statut indiquant problème
      return account.platform === 'facebook_messenger' && 
            (account.verification_status === 'token_expired' || 
              account.verification_status === 'needs_reconnect' ||
              account.verification_status === 'needs_check' ||
              !account.is_active);
    });
    
    setAccountsNeedReconnect(expiredAccounts);
    
    // Afficher notification si on est sur l'onglet webhooks
    if (expiredAccounts.length > 0 && tabValue === 1) {
      setShowReconnectNotification(true);
    }
  };

  const checkAccountsNeedReconnect = (accounts) => {
    const expiredAccounts = accounts.filter(account => {
      // Critères pour détecter un compte expiré :
      // 1. Plateforme Facebook
      // 2. Statut inactif ou token expiré
      // 3. Pas de token valide
      return account.platform === 'facebook_messenger' && 
            (account.verification_status === 'token_expired' || 
              account.verification_status === 'needs_reconnect' ||
              !account.is_active);
    });
    
    setAccountsNeedReconnect(expiredAccounts);
    
    // Afficher notification si des comptes expirés
    if (expiredAccounts.length > 0) {
      setShowReconnectNotification(true);
    }
  };

  // Fonction pour récupérer les pages Facebook de l'utilisateur
  const fetchFacebookPages = async (accessToken) => {
    try {
      setLoading(true);
      const response = await securePost('/facebook/pages', {
        access_token: accessToken
      });
      
      if (response.data?.success) {
        setFacebookOAuth(prev => ({
          ...prev,
          pages: response.data.pages || []
        }));
      }
    } catch (error) {
      console.error('Erreur pages:', error);
    } finally {
      setLoading(false);
    }
  };
  // Fonction pour récupérer les statistiques
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await secureGet('/users/me/stats');
      
      if (response.data) {
        setStats({
          totalConversations: response.data.data?.totalConversations || 0,
          activeConversations: response.data.data?.activeConversations || 0,
          totalMessages: response.data.data?.totalMessages || 0,
          lastActivity: response.data.data?.lastActivity ? 
            new Date(response.data.data.lastActivity).toLocaleString('fr-FR') : 'Jamais',
          automationEnabled: response.data.data?.automationEnabled !== false,
          facebookConnected: response.data.data?.facebookConnected || false,
          facebookPages: response.data.data?.facebookPages || 0
        });
      }
    } catch (error) {
      setStats({
        totalConversations: 0,
        activeConversations: 0,
        totalMessages: 0,
        lastActivity: 'Jamais',
        automationEnabled: true,
        facebookConnected: false,
        facebookPages: 0
      });
    } finally {
      setLoadingStats(false);
    }
  };

  // Fonction pour récupérer les statistiques IA
  const fetchAIStats = async () => {
    try {
      setLoadingAIStats(true);
      const response = await secureGet('/ia/stats');
      
      if (response.data && response.data.success) {
        setAiStats({
          total_ai_conversations: response.data.stats?.total_conversations || 0,
          orders_converted: response.data.stats?.orders_converted || 0,
          active_rules: response.data.stats?.active_rules || 0,
          avg_intent_confidence: response.data.stats?.avg_intent_confidence || 0,
          clients_profiled: response.data.stats?.clients_profiled || 0,
          recent_activity: response.data.recent_activity || []
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques IA:', error);
      setAiStats({
        total_ai_conversations: 0,
        orders_converted: 0,
        active_rules: 0,
        avg_intent_confidence: 0,
        clients_profiled: 0,
        recent_activity: []
      });
    } finally {
      setLoadingAIStats(false);
    }
  };

  // Fonction pour récupérer les paramètres automation
  const fetchAutomationSettings = async () => {
    try {
      const response = await secureGet('/automation/settings');
      if (response.data) {
        setAutomationSettings({
          autoResponder: response.data.autoResponder !== false,
          autoCreateContacts: response.data.autoCreateContacts !== false,
          autoUpdateConversations: response.data.autoUpdateConversations !== false,
          autoProcessOrders: response.data.autoProcessOrders !== false,
          autoGenerateQuotes: response.data.autoGenerateQuotes || false,
          workingHoursOnly: response.data.workingHoursOnly || false,
          workingHoursStart: response.data.workingHoursStart || '08:00',
          workingHoursEnd: response.data.workingHoursEnd || '18:00'
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres automation:', error);
    }
  };

  // Fonction pour récupérer les paramètres IA
  const fetchAISettings = async () => {
    try {
      const response = await secureGet('/ia/settings');
      if (response.data && response.data.success) {
        setAiSettings({
          enabled: response.data.enabled !== false,
          confidence_threshold: response.data.confidence_threshold || 0.7,
          max_context_length: response.data.max_context_length || 10,
          learning_enabled: response.data.learning_enabled !== false,
          rule_based_responses: response.data.rule_based_responses !== false,
          product_recommendations: response.data.product_recommendations !== false,
          sentiment_analysis: response.data.sentiment_analysis !== false,
          language: response.data.language || 'fr'
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres IA:', error);
    }
  };

  // Fonction pour récupérer la configuration webhook
  const fetchWebhookConfig = async () => {
    try {
      const response = await secureGet('/webhooks/config');
      if (response.data && response.data.success) {
        setWebhookConfig({
          ai_webhook_url: response.data.ai_webhook_url || '',
          webhook_secret: response.data.webhook_secret || '',
          verify_token: response.data.verify_token || '',
          webhook_enabled: response.data.webhook_enabled !== false,
          auto_setup: response.data.auto_setup !== false
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration webhook:', error);
    }
  };

  // Fonction pour récupérer les clients (agence)
  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await secureGet('/agence/clients');
      if (response.data) {
        setClients(response.data);
      }
    } catch (error) {
      console.error('Erreur chargement clients', error);
      enqueueSnackbar('Erreur chargement clients', { variant: 'error' });
    } finally {
      setLoadingClients(false);
    }
  };

  // Fonction pour sauvegarder les données utilisateur
  const handleSaveUserData = async () => {
    try {
      setLoading(true);
      const userId = user?.id || user?.userId;
      
      if (!userId) {
        throw new Error('ID utilisateur manquant');
      }
      
      const response = await securePut(`/users/${userId}`, userData);
      
      if (response.data) {
        updateUser({
          ...user,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          role: userData.role
        });
        
        setEditMode(false);
        enqueueSnackbar('Profil mis à jour avec succès', { variant: 'success' });
        fetchUserData();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      if (error.response?.data?.error?.includes('email') || error.message.includes('23505')) {
        enqueueSnackbar('Cet email est déjà utilisé par un autre compte', { variant: 'error' });
      } else {
        enqueueSnackbar('Erreur lors de la mise à jour', { variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ==================== FONCTIONS META SPÉCIFIQUES ====================

  // Fonction pour vérifier le webhook Facebook
  const verifyFacebookWebhook = async (accountId, verifyToken) => {
    try {
      setLoading(true);
      const response = await securePost(`/api/webhook-accounts/${accountId}/verify-facebook`, {
        verify_token: verifyToken,
        mode: 'subscribe'
      });
      
      if (response.data && response.data.success) {
        enqueueSnackbar('Webhook Facebook vérifié avec succès', { variant: 'success' });
        
        // Mettre à jour le statut du compte
        const currentAccounts = [...webhookAccounts];
        const accountIndex = currentAccounts.findIndex(acc => acc.id === accountId);
        if (accountIndex !== -1) {
          currentAccounts[accountIndex] = {
            ...currentAccounts[accountIndex],
            meta_verified: true,
            verification_status: 'verified'
          };
          setWebhookAccounts(currentAccounts);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du webhook Facebook:', error);
      enqueueSnackbar('Erreur lors de la vérification du webhook Facebook', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour configurer le webhook Facebook automatiquement
  const setupFacebookWebhook = async (accountId) => {
    try {
      setLoading(true);
      const response = await securePost(`/api/webhook-accounts/${accountId}/setup-facebook`, {
        webhook_url: `${window.location.origin}/api/webhook/messenger/${user?.id}/${accountId}`,
        verify_token: newAccount.verify_token,
        fields: newAccount.webhook_fields
      });
      
      if (response.data && response.data.success) {
        enqueueSnackbar('Webhook Facebook configuré avec succès', { variant: 'success' });
      }
    } catch (error) {
      console.error('Erreur lors de la configuration du webhook Facebook:', error);
      enqueueSnackbar('Erreur lors de la configuration du webhook Facebook', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour synchroniser les abonnements Facebook
  const syncFacebookSubscriptions = async (accountId) => {
    try {
      setLoading(true);
      const response = await securePost(`/api/webhook-accounts/${accountId}/sync-subscriptions`, {});
      
      if (response.data && response.data.success) {
        enqueueSnackbar('Abonnements Facebook synchronisés', { variant: 'success' });
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation des abonnements:', error);
      enqueueSnackbar('Erreur lors de la synchronisation des abonnements', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const startPlatformOnboarding = (platform) => {
    setSelectedPlatformForWizard(platform);
    setShowPlatformWizard(true);
  };

  const handleReconfigureAccount = (account) => {
    setSelectedPlatformForWizard(account.platform);
    setShowPlatformWizard(true);
    // Vous pourriez pré-remplir les données ici
  };

  const getAccountIdentifier = (account) => {
    switch(account.platform) {
      case 'facebook_messenger':
        return account.page_id || 'ID Page';
      case 'whatsapp_business':
        return account.phone_number || account.business_id || 'WhatsApp';
      case 'twilio':
        return account.phone_number || account.account_sid?.substring(0, 12) || 'Twilio';
      default:
        return account.account_sid?.substring(0, 8) || 'N/A';
    }
  };

  // ==================== EFFETS ====================

  // Effet pour les logs en temps réel
  useEffect(() => {
    if (liveLogging) {
      startLiveLogging();
    }
    
    return () => {
      if (logSocket) {
        logSocket.close();
      }
    };
  }, [liveLogging]);

  // Effet pour charger les logs au changement de page
  useEffect(() => {
    if (tabValue === 1) { // Onglet webhooks
      fetchWebhookLogs(logsPage, logFilters);
    }
  }, [logsPage, logsPerPage, logFilters, tabValue]);

  // Effet d'initialisation
  useEffect(() => {
    console.log('🚀 Initialisation ProfilePage...');
    
    // 1. Initialiser immédiatement avec les données utilisateur disponibles
    setUserData(prev => ({
      ...prev,
      name: user?.name || user?.username || prev.name,
      email: user?.email || prev.email,
      username: user?.username || prev.username,
      role: user?.role || prev.role,
      department: user?.department || 'Général'
    }));

    // 2. Fonction de chargement des données
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        console.log('⏳ Chargement des données...');

        // Charger toutes les données en parallèle
        await Promise.all([
          fetchUserData(),
          fetchWebhookAccounts(),
          fetchStats(),
          fetchAIStats(),
          fetchAutomationSettings(),
          fetchAISettings(),
          fetchWebhookConfig()
        ]);

        // Charger les clients si l'utilisateur est une agence
        if (isAgencyUser) {
          console.log('👥 Chargement clients agence...');
          await fetchClients();
        }

        console.log('✅ Données chargées avec succès');

      } catch (error) {
        console.error('❌ Erreur chargement initial:', error);
        enqueueSnackbar('Erreur lors du chargement des données', { 
          variant: 'error',
          autoHideDuration: 5000 
        });
      } finally {
        setInitialLoading(false);
        console.log('🏁 Chargement terminé');
      }
    };

    // 3. Lancer le chargement
    loadInitialData();

    // Nettoyage (optionnel si vous utilisez des subscriptions)
    return () => {
      console.log('🧹 Nettoyage ProfilePage');
    };
    
  }, []); // Dépendances vides = exécuté une seule fois au montage

  useEffect(() => {
    if (user) {
      setUserData(prev => ({
        ...prev,
        name: user.name || user.username || prev.name,
        email: user.email || prev.email,
        username: user.username || prev.username,
        role: user.role || prev.role
      }));
    }
  }, [user]);

  // ==================== GESTIONNAIRES D'ÉVÉNEMENTS ====================

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Enlever tous les caractères non numériques sauf +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // Format international par défaut
    if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    return cleaned;
  };

  const handleAddWebhookAccount = async () => {
    try {
      setLoading(true);
      
      // Validation des données selon la plateforme
      let validationError = null;
      const requiredFields = [];
      
      // Validation par plateforme
      switch (newAccount.platform) {
        case 'twilio':
          if (!newAccount.account_sid) requiredFields.push('Account SID');
          if (!newAccount.auth_token) requiredFields.push('Auth Token');
          break;
          
        case 'facebook_messenger':
          if (!newAccount.access_token) requiredFields.push('Access Token');
          if (!newAccount.page_id) requiredFields.push('Page ID');
          if (!newAccount.verify_token) requiredFields.push('Verify Token');
          break;
          
        case 'whatsapp_business':
          if (!newAccount.access_token) requiredFields.push('Access Token');
          if (!newAccount.phone_id) requiredFields.push('Phone ID');
          break;
          
        case 'sms':
          if (!newAccount.account_sid) requiredFields.push('Account SID');
          if (!newAccount.auth_token) requiredFields.push('Auth Token');
          break;
          
        case 'telegram':
          if (!newAccount.auth_token) requiredFields.push('Bot Token');
          break;
          
        default:
          validationError = `Plateforme ${newAccount.platform} non supportée`;
      }
      
      // Validation générale
      if (!newAccount.name) requiredFields.push('Nom du compte');
      if (!newAccount.platform) requiredFields.push('Plateforme');
      
      if (requiredFields.length > 0) {
        validationError = `Champs requis manquants: ${requiredFields.join(', ')}`;
      }
      
      if (validationError) {
        enqueueSnackbar(validationError, { variant: 'error' });
        setLoading(false);
        return;
      }
      
      // Préparer l'objet de données selon la plateforme
      const accountData = {
        name: newAccount.name.trim(),
        platform: newAccount.platform,
        platform_type: newAccount.platform_type || 'generic',
        is_active: newAccount.is_active !== false,
        ai_enabled: newAccount.ai_enabled || false,
        auto_reply: newAccount.auto_reply || false,
        config_data: {},
        created_at: new Date().toISOString()
      };
      
      // Ajouter les champs spécifiques selon la plateforme
      switch (newAccount.platform) {
        case 'twilio':
        case 'sms':
          accountData.account_sid = newAccount.account_sid.trim();
          accountData.auth_token = newAccount.auth_token.trim();
          if (newAccount.phone_number) {
            accountData.phone_number = formatPhoneNumber(newAccount.phone_number.trim());
          }
          if (newAccount.webhook_url) {
            accountData.webhook_url = newAccount.webhook_url.trim();
          }
          break;
          
        case 'facebook_messenger':
          accountData.access_token = newAccount.access_token.trim();
          accountData.page_id = newAccount.page_id.trim();
          accountData.page_name = newAccount.page_name || '';
          accountData.verify_token = newAccount.verify_token.trim();
          accountData.app_id = newAccount.app_id || '';
          accountData.app_secret = newAccount.app_secret || '';
          accountData.webhook_fields = newAccount.webhook_fields || ['messages'];
          accountData.graph_api_version = newAccount.graph_api_version || 'v18.0';
          if (newAccount.webhook_url) {
            accountData.webhook_url = newAccount.webhook_url.trim();
          } else {
            // Générer l'URL webhook automatiquement
            accountData.webhook_url = `${window.location.origin}/api/webhook/messenger/${user?.id}`;
          }
          break;
          
        case 'whatsapp_business':
          accountData.access_token = newAccount.access_token.trim();
          accountData.phone_id = newAccount.phone_id.trim();
          if (newAccount.business_id) {
            accountData.business_id = newAccount.business_id.trim();
          }
          if (newAccount.phone_number) {
            accountData.phone_number = newAccount.phone_number.trim();
          }
          if (newAccount.webhook_url) {
            accountData.webhook_url = newAccount.webhook_url.trim();
          }
          break;
          
        case 'telegram':
          accountData.auth_token = newAccount.auth_token.trim();
          if (newAccount.webhook_url) {
            accountData.webhook_url = newAccount.webhook_url.trim();
          }
          break;
      }
      
      // Envoyer la requête
      const response = await securePost('/webhook-accounts', accountData);
      
      if (response.data && response.data.success) {
        // Mettre à jour la liste des comptes
        const currentAccounts = Array.isArray(webhookAccounts) ? webhookAccounts : [];
        setWebhookAccounts([response.data.data, ...currentAccounts]);
        
        // Mettre à jour l'état pour masquer les tokens
        const newTokenState = { ...showToken };
        if (response.data.data.id) {
          newTokenState[response.data.data.id] = false;
        }
        setShowToken(newTokenState);
        
        // Si c'est un compte Facebook, proposer la configuration automatique
        if (newAccount.platform === 'facebook_messenger' && newAccount.auto_setup !== false) {
          setTimeout(() => {
            enqueueSnackbar(
              'Voulez-vous configurer automatiquement le webhook Facebook ?',
              {
                variant: 'info',
                persist: true,
                action: (
                  <Button 
                    color="inherit" 
                    size="small"
                    onClick={() => setupFacebookWebhook(response.data.data.id)}
                  >
                    Configurer
                  </Button>
                )
              }
            );
          }, 1000);
        }
        
        // Fermer le dialog et réinitialiser le formulaire
        setShowNewAccountDialog(false);
        setNewAccount({
          platform: 'facebook_messenger',
          platform_type: 'facebook_messenger',
          account_sid: '',
          auth_token: '',
          phone_number: '',
          webhook_url: '',
          is_active: true,
          name: '',
          access_token: '',
          page_id: '',
          page_name: '',
          app_id: '',
          app_secret: '',
          verify_token: Math.random().toString(36).substring(2, 15),
          webhook_fields: ['messages', 'messaging_postbacks'],
          graph_api_version: 'v18.0',
          business_id: '',
          ai_enabled: false,
          auto_reply: false,
          config_data: {}
        });
        
        // Afficher un message de succès
        enqueueSnackbar(`Compte ${response.data.data.name} ajouté avec succès`, { 
          variant: 'success',
          action: (
            <Button 
              color="inherit" 
              size="small"
              onClick={() => {
                // Option: rediriger ou tester immédiatement
                if (response.data.data.id) {
                  handleTestWebhookAccount(response.data.data.id);
                }
              }}
            >
              Tester
            </Button>
          )
        });
        
        // Rafraîchir les statistiques
        fetchStats();
        
      } else {
        throw new Error(response.data?.error || 'Réponse invalide du serveur');
      }
      
    } catch (error) {
      console.error('❌ Erreur détaillée lors de l\'ajout du compte webhook:', error);
      
      // Gestion d'erreurs détaillée
      let errorMessage = 'Erreur lors de l\'ajout du compte';
      
      if (error.response?.status === 400) {
        errorMessage = error.response.data?.error || 'Données invalides';
      } else if (error.response?.status === 401) {
        errorMessage = 'Session expirée, veuillez vous reconnecter';
      } else if (error.response?.status === 409) {
        errorMessage = 'Un compte avec ces paramètres existe déjà';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      enqueueSnackbar(errorMessage, { 
        variant: 'error',
        persist: error.response?.status === 401 // Garde l'erreur si session expirée
      });
      
      // Si l'erreur est liée à la session, on peut rediriger
      if (error.response?.status === 401) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
      
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhookAccount = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce compte webhook ?')) {
      return;
    }
    
    try {
      setLoading(true);
      await secureDelete(`/api/webhook-accounts/${id}`);
      
      const currentAccounts = Array.isArray(webhookAccounts) ? webhookAccounts : [];
      setWebhookAccounts(currentAccounts.filter(account => account && account.id !== id));
      
      enqueueSnackbar('Compte webhook supprimé avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la suppression du compte webhook:', error);
      enqueueSnackbar('Erreur lors de la suppression', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutomation = async () => {
    try {
      const newState = !stats.automationEnabled;
      const response = await securePost('/automation/toggle', { enabled: newState });
      
      if (response.data) {
        setStats(prev => ({ ...prev, automationEnabled: newState }));
        enqueueSnackbar(
          `Automation ${newState ? 'activée' : 'désactivée'} avec succès`,
          { variant: 'success' }
        );
      }
    } catch (error) {
      console.error('Erreur lors du changement d\'état automation:', error);
      enqueueSnackbar('Erreur lors du changement d\'état', { variant: 'error' });
    }
  };

  const handleSaveAutomationSettings = async () => {
    try {
      setLoading(true);
      const response = await securePost('/automation/settings', automationSettings);
      
      if (response.data) {
        enqueueSnackbar('Paramètres automation sauvegardés', { variant: 'success' });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres:', error);
      enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAISettings = async () => {
    try {
      setLoading(true);
      const response = await securePost('/ia/settings', aiSettings);
      
      if (response.data && response.data.success) {
        enqueueSnackbar('Paramètres IA sauvegardés', { variant: 'success' });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres IA:', error);
      enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebhookConfig = async () => {
    try {
      setLoading(true);
      const response = await securePost('/webhook/config', webhookConfig);
      
      if (response.data && response.data.success) {
        enqueueSnackbar('Configuration webhook sauvegardée', { variant: 'success' });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la configuration webhook:', error);
      enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhookAccount = async (accountId) => {
    try {
      setLoading(true);
      const response = await securePost(`/api/webhook-accounts/${accountId}/test`, {});
      
      if (response.data.success) {
        enqueueSnackbar('Test de connexion réussi', { variant: 'success' });
      } else {
        enqueueSnackbar('Échec du test de connexion', { variant: 'warning' });
      }
    } catch (error) {
      console.error('Erreur lors du test du compte:', error);
      enqueueSnackbar('Erreur lors du test', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccountAI = async (accountId, enabled) => {
    try {
      const response = await securePut(`/api/webhook-accounts/${accountId}/ai-settings`, {
        ai_enabled: enabled,
        auto_reply: enabled // Active aussi la réponse automatique
      });
      
      if (response.data.success) {
        // Mettre à jour l'état local
        setWebhookAccounts(prev => prev.map(account => 
          account.id === accountId 
            ? { ...account, ai_enabled: enabled, auto_reply: enabled }
            : account
        ));
        
        enqueueSnackbar(
          `IA ${enabled ? 'activée' : 'désactivée'} pour ce compte`,
          { variant: 'success' }
        );
      }
    } catch (error) {
      console.error('Erreur lors du changement d\'état IA:', error);
      enqueueSnackbar('Erreur lors du changement d\'état', { variant: 'error' });
    }
  };

  const handleGetAccountAIStats = async (accountId) => {
    try {
      setLoading(true);
      const response = await secureGet(`/webhook-accounts/${accountId}/ai-stats`);
      
      if (response.data.success) {
        enqueueSnackbar(
          `Statistiques IA: ${response.data.data.total_conversations || 0} conversations`,
          { variant: 'info' }
        );
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques IA:', error);
      enqueueSnackbar('Erreur lors de la récupération des statistiques', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);

    // Si on change vers l'onglet webhooks ET il y a des comptes à reconnecter
    if (newValue === 1 && accountsNeedReconnect.length > 0) {
      setShowReconnectNotification(true);
    }

    // Si on change vers l'onglet webhooks ET il y a des comptes à reconnecter
    if (newValue === 1 && accountsNeedReconnect.length > 0) {
      setShowReconnectNotification(true);
    }
    
    // Si on change vers l'onglet webhooks, charger les logs
    if (newValue === 1) {
      fetchWebhookLogs(0, logFilters);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewAccountChange = (e) => {
    const { name, value } = e.target;
    
    // Si la plateforme change, réinitialiser certains champs
    if (name === 'platform') {
      setNewAccount(prev => ({
        ...prev,
        [name]: value,
        // Réinitialiser les champs spécifiques à la plateforme
        account_sid: '',
        auth_token: '',
        access_token: '',
        phone_id: '',
        page_id: '',
        page_name: '',
        app_id: '',
        app_secret: '',
        verify_token: Math.random().toString(36).substring(2, 15),
        // Ajuster le platform_type selon la plateforme
        platform_type: value === 'whatsapp_business' ? 'whatsapp_business' : 
                     value === 'facebook_messenger' ? 'facebook_messenger' : 'generic'
      }));
    } else {
      setNewAccount(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAISettingChange = (setting, value) => {
    setAiSettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleAutomationSettingChange = (setting, value) => {
    setAutomationSettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleWebhookConfigChange = (setting, value) => {
    setWebhookConfig(prev => ({ ...prev, [setting]: value }));
  };

  const toggleTokenVisibility = (accountId) => {
    setShowToken(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const createClientInvitation = async () => {
    try {
      setLoading(true);
      
      // Préparer les données avec client_phone
      const invitationPayload = {
        client_name: invitationData.client_name,
        client_email: invitationData.client_email,
        invitation_method: invitationData.invitation_method,
        client_phone: invitationData.client_phone || null
      };
      
      // Envoyer la requête
      const response = await securePost('/agence/invitations', invitationPayload);
      
      if (response.data && response.data.success) {
        if (invitationData.invitation_method === 'email') {
          // Envoyer l'email
          await securePost('/agence/send-invitation', {
            invitation_id: response.data.invitation_id,
            client_email: invitationData.client_email
          });
          enqueueSnackbar('Invitation envoyée par email', { variant: 'success' });
        } else {
          // Générer le lien
          const invitationLink = `${window.location.origin}/client-onboarding/${response.data.invitation_token}`;
          enqueueSnackbar(
            `Lien généré : ${invitationLink}`,
            { 
              variant: 'info',
              action: (
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(invitationLink);
                    enqueueSnackbar('Lien copié', { variant: 'success' });
                  }}
                >
                  Copier
                </Button>
              )
            }
          );
        }
        
        // Réinitialiser le formulaire
        setShowInvitationDialog(false);
        setInvitationData({
          client_name: '',
          client_email: '',
          client_phone: '',
          invitation_method: 'email'
        });
        
        // Actualiser la liste des clients
        fetchClients();
      } else {
        enqueueSnackbar('Erreur lors de la création de l\'invitation', { variant: 'error' });
      }
    } catch (error) {
      console.error('Erreur création invitation:', error);
      enqueueSnackbar(
        error.response?.data?.message || 'Erreur création invitation', 
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationDataChange = (field, value) => {
    setInvitationData(prev => ({ ...prev, [field]: value }));
  };

  const handleRepairAccount = async (accountId) => {
    try {
      setLoading(true);
      const response = await secureGet(`/webhook-accounts/${accountId}/verify-and-repair`);
      
      if (response.data?.requires_reconnect) {
        // Lancer OAuth pour ce compte spécifique
        const repairResponse = await securePost(`/api/webhook-accounts/${accountId}/repair-via-oauth`, {});
        
        if (repairResponse.data?.oauth_url) {
          // Ouvrir la fenêtre OAuth
          window.open(
            repairResponse.data.oauth_url,
            'facebook_repair',
            'width=600,height=700'
          );
          
          enqueueSnackbar('Processus de réparation lancé', { variant: 'info' });
        }
      }
    } catch (error) {
      enqueueSnackbar('Erreur lors de la réparation', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Gestionnaires pour les filtres de logs
  const handleLogFilterChange = (filter, value) => {
    setLogFilters(prev => ({ ...prev, [filter]: value }));
  };

  const handleLogsPageChange = (event, newPage) => {
    setLogsPage(newPage);
  };

  const handleLogsPerPageChange = (event) => {
    setLogsPerPage(parseInt(event.target.value, 10));
    setLogsPage(0);
  };

  const maskToken = (token) => {
    if (!token) return '';
    return token.length > 8 
      ? `${token.substring(0, 4)}${'*'.repeat(token.length - 8)}${token.substring(token.length - 4)}`
      : '****';
  };

  const generateAIWebhookUrl = () => {
    const userId = user?.id || user?.userId;
    if (!userId) return '';
    return `${window.location.origin}/api/webhook/ai/${userId}/{accountId}`;
  };

  // Fonction pour copier l'URL webhook
  const copyWebhookUrl = (accountId) => {
    const webhookUrl = `${window.location.origin}/api/webhook/messenger/${user?.id}/${accountId}`;
    navigator.clipboard.writeText(webhookUrl);
    enqueueSnackbar('URL webhook copiée', { variant: 'success' });
  };

  // ==================== COMPOSANTS INTERNES ====================

  // Composant pour la section de logs
  const WebhookLogsSection = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title="Logs des Webhooks"
            subheader="Suivi en temps réel des requêtes entrantes"
            avatar={<BugReportIcon color="primary" />}
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  startIcon={liveLogging ? <StopIcon /> : <PlayArrowIcon />}
                  variant={liveLogging ? "contained" : "outlined"}
                  color={liveLogging ? "error" : "success"}
                  onClick={liveLogging ? stopLiveLogging : startLiveLogging}
                >
                  {liveLogging ? "Arrêter" : "Live"}
                </Button>
                
                <Button
                  startIcon={<DownloadIcon />}
                  variant="outlined"
                  onClick={exportLogs}
                >
                  Exporter
                </Button>
                
                <Button
                  startIcon={<ClearIcon />}
                  variant="outlined"
                  color="error"
                  onClick={clearLogs}
                  disabled={webhookLogs.length === 0}
                >
                  Effacer
                </Button>
                
                <Button
                  startIcon={<RefreshIcon />}
                  variant="outlined"
                  onClick={() => fetchWebhookLogs(logsPage, logFilters)}
                  disabled={loadingLogs}
                >
                  Actualiser
                </Button>
              </Box>
            }
          />
          
          <CardContent>
            {/* Barre de filtres */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Plateforme</InputLabel>
                    <Select
                      value={logFilters.platform}
                      onChange={(e) => handleLogFilterChange('platform', e.target.value)}
                      label="Plateforme"
                    >
                      <MenuItem value="all">Toutes les plateformes</MenuItem>
                      <MenuItem value="facebook_messenger">Facebook Messenger</MenuItem>
                      <MenuItem value="whatsapp">WhatsApp</MenuItem>
                      <MenuItem value="whatsapp_business">WhatsApp Business</MenuItem>
                      <MenuItem value="sms">SMS</MenuItem>
                      <MenuItem value="telegram">Telegram</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Statut</InputLabel>
                    <Select
                      value={logFilters.status}
                      onChange={(e) => handleLogFilterChange('status', e.target.value)}
                      label="Statut"
                    >
                      <MenuItem value="all">Tous les statuts</MenuItem>
                      <MenuItem value="success">Succès (2xx)</MenuItem>
                      <MenuItem value="client_error">Erreur client (4xx)</MenuItem>
                      <MenuItem value="server_error">Erreur serveur (5xx)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Période</InputLabel>
                    <Select
                      value={logFilters.dateRange}
                      onChange={(e) => handleLogFilterChange('dateRange', e.target.value)}
                      label="Période"
                    >
                      <MenuItem value="1h">Dernière heure</MenuItem>
                      <MenuItem value="24h">24 dernières heures</MenuItem>
                      <MenuItem value="7d">7 derniers jours</MenuItem>
                      <MenuItem value="30d">30 derniers jours</MenuItem>
                      <MenuItem value="all">Tout</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Rechercher"
                    value={logFilters.search}
                    onChange={(e) => handleLogFilterChange('search', e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: logFilters.search && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => handleLogFilterChange('search', '')}>
                            <ClearIcon />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Indicateur de live logging */}
            {liveLogging && (
              <Alert 
                severity="info" 
                icon={<TimelineIcon />}
                action={
                  <Button color="inherit" size="small" onClick={stopLiveLogging}>
                    Arrêter
                  </Button>
                }
                sx={{ mb: 2 }}
              >
                Écoute en temps réel active. {webhookLogs.length} logs affichés.
              </Alert>
            )}

            {/* Statistiques rapides */}
            {!liveLogging && (
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Chip
                  icon={<ScheduleIcon />}
                  label={`${totalLogs} logs au total`}
                  variant="outlined"
                />
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`${webhookLogs.filter(l => l.status_code >= 200 && l.status_code < 300).length} succès`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  icon={<WarningIcon />}
                  label={`${webhookLogs.filter(l => l.status_code >= 400 && l.status_code < 500).length} erreurs client`}
                  color="warning"
                  variant="outlined"
                />
                <Chip
                  icon={<ErrorIcon />}
                  label={`${webhookLogs.filter(l => l.status_code >= 500).length} erreurs serveur`}
                  color="error"
                  variant="outlined"
                />
              </Box>
            )}

            {/* Liste des logs */}
            <Box sx={{ 
              maxHeight: '500px', 
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1
            }}>
              {loadingLogs ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : webhookLogs.length === 0 ? (
                <Alert severity="info">
                  Aucun log disponible. {liveLogging ? 'En attente de nouvelles requêtes...' : 'Modifiez les filtres ou attendez de nouvelles requêtes.'}
                </Alert>
              ) : (
                <>
                  {webhookLogs.map((log, index) => (
                    <WebhookLogEntry
                      key={log.id || `log-${index}-${Date.now()}`}
                      log={log}
                      onExpand={() => {}} 
                    />
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </Box>

            {/* Pagination */}
            {!liveLogging && totalLogs > 0 && (
              <TablePagination
                component="div"
                count={totalLogs}
                page={logsPage}
                onPageChange={handleLogsPageChange}
                rowsPerPage={logsPerPage}
                onRowsPerPageChange={handleLogsPerPageChange}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Logs par page:"
                sx={{ mt: 2 }}
              />
            )}

            {/* Instructions pour Messenger */}
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">
                  <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Comment tester votre configuration Messenger ?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stepper activeStep={facebookSetupStep} orientation="vertical">
                  <Step>
                    <StepLabel>Étape 1: Configurer l'Espace App Meta</StepLabel>
                    <StepContent>
                      <ol>
                        <li>Allez dans <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer">developers.facebook.com</a></li>
                        <li>Créez une application ou sélectionnez-en une existante</li>
                        <li>Ajoutez le produit "Webhooks"</li>
                        <li>Configurez le callback URL avec l'URL ci-dessous</li>
                        <li>Ajoutez le Verify Token défini dans votre compte</li>
                        <li>Sélectionnez "Page" comme objet et abonnez-vous aux champs souhaités</li>
                        <li>Cliquez sur "Vérifier et sauvegarder"</li>
                      </ol>
                    </StepContent>
                  </Step>
                  <Step>
                    <StepLabel>Étape 2: Tester la connexion</StepLabel>
                    <StepContent>
                      <ol>
                        <li>Ouvrez Facebook Messenger</li>
                        <li>Recherchez votre page</li>
                        <li>Envoyez un message de test</li>
                        <li>Le log devrait apparaître dans la liste ci-dessus</li>
                      </ol>
                    </StepContent>
                  </Step>
                  <Step>
                    <StepLabel>Étape 3: Vérifier la configuration</StepLabel>
                    <StepContent>
                      <Alert severity="info">
                        Vérifiez que votre webhook est actif dans l'Espace App Meta
                      </Alert>
                    </StepContent>
                  </Step>
                </Stepper>
                
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    URL de webhook pour Facebook Messenger:
                  </Typography>
                  <code style={{ display: 'block', padding: '8px', background: 'white', borderRadius: '4px' }}>
                    {`${window.location.origin}/api/webhook/messenger/${user?.id || 'your-user-id'}/{accountId}`}
                  </code>
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button 
                      size="small" 
                      startIcon={<ContentCopyIcon />}
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhook/messenger/${user?.id || 'your-user-id'}/{accountId}`);
                        enqueueSnackbar('URL copiée', { variant: 'success' });
                      }}
                    >
                      Copier l'URL modèle
                    </Button>
                    <Button 
                      size="small" 
                      startIcon={<LinkIcon />}
                      href="https://developers.facebook.com/docs/messenger-platform/webhooks"
                      target="_blank"
                    >
                      Documentation Meta
                    </Button>
                  </Box>
                </Box>
                
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <AlertTitle>Important</AlertTitle>
                  Assurez-vous que votre serveur est accessible en HTTPS et peut répondre aux requêtes GET de vérification de Meta.
                </Alert>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Composant pour l'onglet Agence
  const AgencyTabContent = () => {
    // Calculer les statistiques
    const activeClients = clients.filter(c => c.messenger_status === 'active').length;
    const pendingClients = clients.filter(c => c.messenger_status === 'pending').length;
    const totalMessages = clients.reduce((sum, client) => sum + (client.monthly_messages || 0), 0);
    
    // Fonction pour copier le lien d'invitation
    const copyClientEmails = () => {
      const emails = clients.map(c => c.client_email).join(', ');
      navigator.clipboard.writeText(emails);
      enqueueSnackbar('Emails copiés', { variant: 'success' });
    };
    
    // Fonction pour configurer un client
    const configureClient = (clientId) => {
      enqueueSnackbar(`Configuration du client ${clientId}`, { variant: 'info' });
    };
    
    return (
      <Grid container spacing={3}>
        {/* Carte principale - Liste des clients */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Gestion Clients Agence"
              subheader={`${clients.length} clients gérés (${activeClients} actifs)`}
              avatar={
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <BusinessIcon />
                </Avatar>
              }
              action={
                <Button
                  startIcon={<SendIcon />}
                  variant="contained"
                  color="primary"
                  onClick={() => setShowInvitationDialog(true)}
                  sx={{ ml: 2 }}
                >
                  Inviter un client
                </Button>
              }
            />
            <CardContent>
              {loadingClients ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : clients.length === 0 ? (
                <Alert 
                  severity="info" 
                  action={
                    <Button 
                      color="inherit" 
                      size="small"
                      onClick={() => setShowInvitationDialog(true)}
                    >
                      Inviter
                    </Button>
                  }
                >
                  Aucun client pour le moment. Invitez votre premier client pour configurer son Messenger.
                </Alert>
              ) : (
                <>
                  {/* Statistiques rapides */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                    <Chip 
                      icon={<CheckCircleIcon />}
                      label={`${activeClients} actifs`}
                      color="success"
                      variant="outlined"
                    />
                    <Chip 
                      icon={<RefreshIcon />}
                      label={`${pendingClients} en attente`}
                      color="warning"
                      variant="outlined"
                    />
                    <Chip 
                      icon={<ChatIcon />}
                      label={`${totalMessages} messages/mois`}
                      color="info"
                      variant="outlined"
                    />
                  </Box>
                  
                  {/* Tableau des clients */}
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Client</strong></TableCell>
                          <TableCell><strong>Contact</strong></TableCell>
                          <TableCell><strong>Page Facebook</strong></TableCell>
                          <TableCell><strong>Statut Messenger</strong></TableCell>
                          <TableCell><strong>Dernière activité</strong></TableCell>
                          <TableCell><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {clients.map((client) => {
                          // Formater la date
                          const lastActivity = client.last_activity 
                            ? new Date(client.last_activity).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })
                            : 'Jamais';
                          
                          return (
                            <TableRow 
                              key={client.id}
                              hover
                              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                              <TableCell>
                                <Box>
                                  <Typography fontWeight="medium">
                                    {client.client_name}
                                  </Typography>
                                  {client.company && (
                                    <Typography variant="body2" color="text.secondary">
                                      {client.company}
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box>
                                  <Typography variant="body2">
                                    {client.client_email}
                                  </Typography>
                                  {client.client_phone && (
                                    <Typography variant="body2" color="text.secondary">
                                      {client.client_phone}
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {client.facebook_page ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <FacebookIcon color="primary" fontSize="small" />
                                    <Typography variant="body2">
                                      {client.facebook_page.name}
                                    </Typography>
                                    {client.facebook_page.followers && (
                                      <Chip 
                                        label={`${client.facebook_page.followers} abonnés`}
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                ) : (
                                  <Chip 
                                    label="À configurer" 
                                    size="small" 
                                    color="warning" 
                                    variant="outlined"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <StatusChip status={client.messenger_status || 'pending'} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {lastActivity}
                                </Typography>
                                {client.last_message && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {client.last_message}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Tooltip title="Voir les conversations">
                                    <IconButton size="small" color="info">
                                      <ChatIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Reconfigurer">
                                    <IconButton 
                                      size="small" 
                                      color="primary"
                                      onClick={() => configureClient(client.id)}
                                    >
                                      <SettingsIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Supprimer">
                                    <IconButton size="small" color="error">
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Colonne gauche : Statistiques détaillées */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Statistiques Agence" 
              avatar={<InsightsIcon color="primary" />}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography color="text.secondary" variant="body2">
                        Clients actifs
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 1 }}>
                        {activeClients}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(activeClients / clients.length) * 100} 
                        color="success"
                        sx={{ mt: 2 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography color="text.secondary" variant="body2">
                        Messages/mois
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 1 }}>
                        {totalMessages}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Moyenne: {clients.length > 0 ? Math.round(totalMessages / clients.length) : 0}/client
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Graphique simple d'activité */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Répartition des statuts
                </Typography>
                <Box sx={{ display: 'flex', height: 20, borderRadius: 1, overflow: 'hidden', mt: 1 }}>
                  <Box 
                    sx={{ 
                      flex: activeClients, 
                      bgcolor: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'white'
                    }}
                  >
                    {activeClients > 0 && 'Actifs'}
                  </Box>
                  <Box 
                    sx={{ 
                      flex: pendingClients, 
                      bgcolor: 'warning.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'white'
                    }}
                  >
                    {pendingClients > 0 && 'En attente'}
                  </Box>
                  <Box 
                    sx={{ 
                      flex: clients.length - activeClients - pendingClients, 
                      bgcolor: 'grey.400',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: 'white'
                    }}
                  >
                    {clients.length - activeClients - pendingClients > 0 && 'Inactifs'}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="caption">Actifs: {activeClients}</Typography>
                  <Typography variant="caption">En attente: {pendingClients}</Typography>
                  <Typography variant="caption">Inactifs: {clients.length - activeClients - pendingClients}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Colonne droite : Actions rapides */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Actions rapides" 
              avatar={<BoltIcon color="warning" />}
            />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchClients}
                  fullWidth
                >
                  Actualiser la liste
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={copyClientEmails}
                  fullWidth
                  disabled={clients.length === 0}
                >
                  Copier tous les emails
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={() => {
                    enqueueSnackbar('Fonctionnalité à venir', { variant: 'info' });
                  }}
                  fullWidth
                  disabled={clients.length === 0}
                >
                  Envoyer une newsletter
                </Button>
                
                <Divider sx={{ my: 1 }} />
                
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Conseil :</strong> Vérifiez régulièrement que tous les webhooks sont actifs.
                  </Typography>
                </Alert>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => setShowInvitationDialog(true)}
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  Ajouter un nouveau client
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Composant pour la section Facebook Messenger
  const FacebookMessengerSection = ({ account }) => (
    <Card sx={{ mt: 2, borderColor: 'primary.main', borderWidth: 1 }}>
      <CardHeader
        title="Configuration Facebook Messenger"
        avatar={<FacebookIcon color="primary" />}
        action={
          account.meta_verified ? (
            <Chip icon={<VerifiedUserIcon />} label="Vérifié" color="success" size="small" />
          ) : (
            <Chip label="Non vérifié" color="warning" size="small" />
          )
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Page ID
              </Typography>
              <Typography variant="body1">
                {account.page_id}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                URL Webhook
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontFamily="monospace" fontSize="12px">
                  {`${window.location.origin}/api/webhook/messenger/${user?.id}/${account.id}`}
                </Typography>
                <IconButton size="small" onClick={() => copyWebhookUrl(account.id)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Token de vérification
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">
                  {showToken[account.id] ? account.verify_token : maskToken(account.verify_token)}
                </Typography>
                <IconButton size="small" onClick={() => toggleTokenVisibility(account.id)}>
                  {showToken[account.id] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Champs abonnés
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {(account.webhook_fields || []).map((field, index) => (
                  <Chip key={index} label={field} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              {!account.meta_verified && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VerifiedUserIcon />}
                  onClick={() => verifyFacebookWebhook(account.id, account.verify_token)}
                  disabled={loading}
                >
                  Vérifier
                </Button>
              )}
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkIcon />}
                onClick={() => setupFacebookWebhook(account.id)}
                disabled={loading}
              >
                Configurer Webhook
              </Button>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => syncFacebookSubscriptions(account.id)}
                disabled={loading}
              >
                Synchroniser
              </Button>
            </Box>
          </Grid>
        </Grid>
        
        {!account.meta_verified && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>Webhook non vérifié</AlertTitle>
            Pour activer Facebook Messenger, vous devez vérifier le webhook dans l'Espace App Meta.
            Utilisez l'URL et le token ci-dessus pour la configuration.
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  // ==================== RENDU PRINCIPAL ====================

  // Au début du composant, avant le return principal
  if (initialLoading && tabValue === 0) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography color="text.secondary">
            Chargement de votre profil...
          </Typography>
        </Box>
      </Container>
    );
  }
  


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Avatar
          sx={{ 
            width: 64, 
            height: 64, 
            mr: 2, 
            bgcolor: 'primary.main',
            fontSize: '1.5rem',
            fontWeight: 'bold'
          }}
        >
          {userData.name?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        <Box>
          <Typography variant="h4" gutterBottom>
            {userData.name || user?.name || user?.username || 'Mon Profil'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {userData.role} • {userData.department}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {userData.email || user?.email || 'Aucun email'}
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Informations Personnelles" icon={<PersonIcon />} />
          <Tab 
            label={
              <Badge 
                badgeContent={
                  // AFFICHAGE INTELLIGENT :
                  // 1. Si comptes expirés : badge rouge avec indicateur "!"
                  // 2. Sinon : badge normal avec nombre de comptes
                  accountsNeedReconnect.length > 0 
                    ? "!" 
                    : webhookAccounts.length
                } 
                color={
                  // COULEUR DU BADGE :
                  // Rouge si comptes expirés, bleu sinon
                  accountsNeedReconnect.length > 0 ? "error" : "primary"
                }
              >
                <WebhookIcon />
              </Badge>
            } 
          />
          {/* Nouvel onglet Agence - visible seulement pour les rôles admin/agence */}
          {(user?.role === 'admin' || user?.role === 'agence') && (
            <Tab 
              label={(
                <Badge badgeContent={clients.length} color="secondary">
                  <PeopleIcon />
                </Badge>
              )} 
              iconPosition="start"
            />
          )}
          <Tab 
            label={(
              <Badge badgeContent={stats.activeConversations} color="secondary">
                <ChatIcon />
              </Badge>
            )} 
          />
          <Tab label="Intelligence Artificielle" icon={<PsychologyIcon />} />
          <Tab label="Automation" icon={<PowerSettingsNewIcon />} />
        </Tabs>

        <Divider />

        {/* Tab 1: Informations Personnelles */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader
                  title="Informations Personnelles"
                  subheader="Ces informations sont pré-remplies avec vos données actuelles"
                  action={
                    editMode ? (
                      <Box>
                        <Button
                          startIcon={<SaveIcon />}
                          variant="contained"
                          color="primary"
                          onClick={handleSaveUserData}
                          sx={{ mr: 1 }}
                          disabled={loading}
                        >
                          Sauvegarder
                        </Button>
                        <Button
                          startIcon={<CancelIcon />}
                          variant="outlined"
                          onClick={() => {
                            setEditMode(false);
                            fetchUserData();
                          }}
                        >
                          Annuler
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        startIcon={<EditIcon />}
                        variant="outlined"
                        onClick={() => setEditMode(true)}
                      >
                        Modifier
                      </Button>
                    )
                  }
                />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Nom complet"
                        name="name"
                        value={userData.name}
                        onChange={handleInputChange}
                        disabled={!editMode}
                        helperText="Votre nom tel qu'affiché dans l'application"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Nom d'utilisateur"
                        name="username"
                        value={userData.username}
                        onChange={handleInputChange}
                        disabled={!editMode}
                        helperText="Identifiant de connexion"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <AccountCircleIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        name="email"
                        type="email"
                        value={userData.email}
                        onChange={handleInputChange}
                        disabled={!editMode}
                        helperText="Adresse email principale"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Téléphone"
                        name="phone"
                        value={userData.phone}
                        onChange={handleInputChange}
                        disabled={!editMode}
                        helperText="Numéro de téléphone (optionnel)"
                        placeholder="Ex: +33 1 23 45 67 89"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Rôle"
                        name="role"
                        value={userData.role}
                        onChange={handleInputChange}
                        disabled={!editMode}
                        helperText="Votre rôle dans l'organisation"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <WorkIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Département"
                        name="department"
                        value={userData.department}
                        onChange={handleInputChange}
                        disabled={!editMode}
                        helperText="Votre département/service"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <WorkIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    {userData.createdAt && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Date d'inscription"
                          value={userData.createdAt}
                          disabled
                          helperText="Date de création de votre compte"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <CalendarTodayIcon />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    )}
                  </Grid>
                  
                  {!editMode && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Cliquez sur "Modifier" pour mettre à jour vos informations personnelles.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            {/* Stats rapides */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Statistiques rapides" />
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Comptes webhook:</Typography>
                      <Chip 
                        label={webhookAccounts.length} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Pages Facebook:</Typography>
                      <Chip 
                        label={stats.facebookPages} 
                        size="small" 
                        color="info" 
                        variant="outlined"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Conversations IA:</Typography>
                      <Chip 
                        label={aiStats.total_ai_conversations} 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Règles actives:</Typography>
                      <Chip 
                        label={aiStats.active_rules} 
                        size="small" 
                        color="success" 
                        variant="outlined"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Confiance moyenne:</Typography>
                      <Chip 
                        label={`${(aiStats.avg_intent_confidence * 100).toFixed(0)}%`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                    <Divider />
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        fetchUserData();
                        fetchWebhookAccounts();
                        fetchAIStats();
                      }}
                    >
                      Actualiser les données
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Comptes Webhooks avec IA ET LOGS */}
        {/* Tab 2: Comptes Connectés - VERSION REFACTORISÉE */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>

            {/* === NOTIFICATION DE RECONNEXION - AJOUTEZ CE BLOC === */}
            {showReconnectNotification && accountsNeedReconnect.length > 0 && (
              <Grid item xs={12}>
                <ReconnectNotification 
                  accounts={accountsNeedReconnect}
                  onReconnect={() => {
                    // Fermer la notification
                    setShowReconnectNotification(false);
                    // Ouvrir le wizard OAuth
                    setShowPlatformWizard(true);
                    // Lancer le flux OAuth
                    startFacebookOAuthFlow();
                  }}
                  onClose={() => setShowReconnectNotification(false)}
                />
              </Grid>
            )}
            
            {/* ==================== EN-TÊTE ==================== */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                <Grid container alignItems="center" justifyContent="space-between">
                  <Grid item>
                    <Typography variant="h5" gutterBottom>
                      🔌 Connectez vos plateformes de messagerie
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Gérer vos conversations depuis un seul tableau de bord
                    </Typography>
                  </Grid>
                  <Grid item>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setShowPlatformWizard(true)}
                      size="large"
                      sx={{ borderRadius: 2 }}
                    >
                      Nouvelle connexion
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            

            {/* ==================== MES COMPTES CONNECTÉS ==================== */}
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Mes comptes connectés"
                  subheader={`${webhookAccounts.length} compte(s) configuré(s)`}
                  avatar={<WebhookIcon color="primary" />}
                  action={
                    <Button
                      startIcon={<RefreshIcon />}
                      onClick={fetchWebhookAccounts}
                      disabled={loadingWebhooks}
                    >
                      Actualiser
                    </Button>
                  }
                />
                <CardContent>
                  {loadingWebhooks ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress />
                    </Box>
                  ) : webhookAccounts.length === 0 ? (
                    <Alert 
                      severity="info" 
                      action={
                        <Button 
                          color="inherit" 
                          size="small"
                          onClick={() => setShowPlatformWizard(true)}
                        >
                          Connecter mon premier compte
                        </Button>
                      }
                    >
                      <Typography variant="body1" fontWeight="medium">
                        Aucun compte connecté pour le moment
                      </Typography>
                      <Typography variant="body2">
                        Connectez votre première plateforme pour recevoir et gérer vos messages automatiquement.
                      </Typography>
                    </Alert>
                  ) : (
                    <>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Plateforme</TableCell>
                              <TableCell>Nom</TableCell>
                              <TableCell>Identifiant</TableCell>
                              <TableCell>IA</TableCell>
                              <TableCell>Statut</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {webhookAccounts.map((account) => (
                              <TableRow key={account.id} hover>
                                <TableCell>
                                  <PlatformDisplay account={account} />
                                </TableCell>
                                <TableCell>
                                  <Typography fontWeight="medium">
                                    {account.name}
                                  </Typography>
                                  {account.page_name && (
                                    <Typography variant="caption" color="text.secondary">
                                      {account.page_name}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontFamily="monospace" fontSize="12px">
                                    {getAccountIdentifier(account)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Switch
                                      checked={account.ai_enabled || false}
                                      onChange={(e) => handleToggleAccountAI(account.id, e.target.checked)}
                                      size="small"
                                    />
                                    <Typography variant="caption">
                                      {account.ai_enabled ? 'Activée' : 'Désactivée'}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <StatusChip status={account.verification_status || (account.is_active ? 'active' : 'inactive')} />
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Tooltip title="Tester">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleTestWebhookAccount(account.id)}
                                      >
                                        <RefreshIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Configurer">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleReconfigureAccount(account)}
                                      >
                                        <SettingsIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Supprimer">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDeleteWebhookAccount(account.id)}
                                        color="error"
                                      >
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

                      {/* Statistiques rapides */}
                      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Chip 
                          icon={<FacebookIcon />}
                          label={`${webhookAccounts.filter(a => a.platform === 'facebook_messenger').length} Facebook`}
                          variant="outlined"
                        />
                        <Chip 
                          icon={<WhatsAppIcon />}
                          label={`${webhookAccounts.filter(a => a.platform.includes('whatsapp')).length} WhatsApp`}
                          color="success"
                          variant="outlined"
                        />
                        <Chip 
                          icon={<SmsIcon />}
                          label={`${webhookAccounts.filter(a => a.platform === 'sms' || a.platform === 'twilio').length} SMS`}
                          color="info"
                          variant="outlined"
                        />
                        <Chip 
                          icon={<CheckCircleIcon />}
                          label={`${webhookAccounts.filter(a => a.is_active).length} actifs`}
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* ==================== GUIDES RAPIDES ==================== */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardHeader
                  title="📚 Guides de connexion rapide"
                  subheader="Documentation par plateforme"
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: '100%', border: '1px solid', borderColor: '#1877F2' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <FacebookIcon sx={{ color: '#1877F2', mr: 1 }} />
                            <Typography variant="h6">Facebook Messenger</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            Connectez votre page Facebook en 2 minutes
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<FacebookIcon />}
                            onClick={() => startPlatformOnboarding('facebook_messenger')}
                            fullWidth
                            size="small"
                          >
                            Lancer la connexion
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: '100%', border: '1px solid', borderColor: '#25D366' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <WhatsAppIcon sx={{ color: '#25D366', mr: 1 }} />
                            <Typography variant="h6">WhatsApp Business</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            Configuration API WhatsApp Business
                          </Typography>
                          <Button
                            variant="outlined"
                            color="success"
                            startIcon={<WhatsAppIcon />}
                            onClick={() => startPlatformOnboarding('whatsapp_business')}
                            fullWidth
                            size="small"
                          >
                            Configurer WhatsApp
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Card sx={{ height: '100%', border: '1px solid', borderColor: '#F22F46' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <SmsIcon sx={{ color: '#F22F46', mr: 1 }} />
                            <Typography variant="h6">Twilio (SMS/WhatsApp)</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            Connectez votre compte Twilio
                          </Typography>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<SmsIcon />}
                            onClick={() => startPlatformOnboarding('twilio')}
                            fullWidth
                            size="small"
                          >
                            Connecter Twilio
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* TabPanel Agence - conditionnel */}
        {isAgencyUser && (
          <TabPanel value={tabValue} index={2}>
            <AgencyTabContent />
          </TabPanel>
        )}

        {/* Tab 3: Statistiques des Discussions avec IA */}
        <TabPanel value={tabValue} index={isAgencyUser ? 3 : 2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="text.secondary" gutterBottom>
                    Discussions Totales
                  </Typography>
                  <Typography variant="h3" component="div">
                    {loadingStats ? (
                      <CircularProgress size={30} />
                    ) : (
                      stats.totalConversations
                    )}
                  </Typography>
                  <ChatIcon color="primary" sx={{ fontSize: 48, mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="text.secondary" gutterBottom>
                    Discussions IA
                  </Typography>
                  <Typography variant="h3" component="div">
                    {loadingAIStats ? (
                      <CircularProgress size={30} />
                    ) : (
                      aiStats.total_ai_conversations
                    )}
                  </Typography>
                  <SmartToyIcon color="secondary" sx={{ fontSize: 48, mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="text.secondary" gutterBottom>
                    Commandes Converties
                  </Typography>
                  <Typography variant="h3" component="div">
                    {loadingAIStats ? (
                      <CircularProgress size={30} />
                    ) : (
                      aiStats.orders_converted
                    )}
                  </Typography>
                  <BoltIcon color="success" sx={{ fontSize: 48, mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="text.secondary" gutterBottom>
                    Confiance IA
                  </Typography>
                  <Typography variant="h3" component="div">
                    {loadingAIStats ? (
                      <CircularProgress size={30} />
                    ) : (
                      `${(aiStats.avg_intent_confidence * 100).toFixed(0)}%`
                    )}
                  </Typography>
                  <PsychologyIcon color="info" sx={{ fontSize: 48, mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>

            {/* Détails statistiques IA */}
            <Grid item xs={12}>
              <Card>
                <CardHeader 
                  title="Statistiques détaillées IA"
                  action={
                    <Button
                      startIcon={<RefreshIcon />}
                      onClick={fetchAIStats}
                      disabled={loadingAIStats}
                    >
                      Actualiser
                    </Button>
                  }
                />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                          Vue d'ensemble
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography color="text.secondary">Règles actives</Typography>
                                <Typography variant="h5">{aiStats.active_rules}</Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid item xs={6}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography color="text.secondary">Clients profilés</Typography>
                                <Typography variant="h5">{aiStats.clients_profiled}</Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          Activité récente (7 jours)
                        </Typography>
                        {aiStats.recent_activity.length > 0 ? (
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Date</TableCell>
                                  <TableCell align="right">Conversations</TableCell>
                                  <TableCell align="right">Réponses IA</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {aiStats.recent_activity.map((activity, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{activity.date}</TableCell>
                                    <TableCell align="right">{activity.conversations}</TableCell>
                                    <TableCell align="right">{activity.rule_based_responses || 0}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Alert severity="info">Aucune activité récente</Alert>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 4: Paramètres Intelligence Artificielle */}
        <TabPanel value={tabValue} index={isAgencyUser ? 4 : 3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader
                  title="Paramètres de l'Intelligence Artificielle"
                  subheader="Configurez le comportement de l'IA pour les conversations et le traitement"
                  action={
                    <Button
                      startIcon={<SaveIcon />}
                      variant="contained"
                      color="primary"
                      onClick={handleSaveAISettings}
                      disabled={loading}
                    >
                      Sauvegarder
                    </Button>
                  }
                />
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Section Générale */}
                    <Box>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PsychologyIcon /> Configuration Générale
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={aiSettings.enabled}
                                onChange={(e) => handleAISettingChange('enabled', e.target.checked)}
                                color="primary"
                              />
                            }
                            label="IA Activée"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2" sx={{ minWidth: 200 }}>
                              Seuil de confiance: {Math.round(aiSettings.confidence_threshold * 100)}%
                            </Typography>
                            <Slider
                              value={aiSettings.confidence_threshold}
                              onChange={(e, newValue) => handleAISettingChange('confidence_threshold', newValue)}
                              step={0.05}
                              min={0.1}
                              max={1}
                              marks={[
                                { value: 0.1, label: '10%' },
                                { value: 0.5, label: '50%' },
                                { value: 0.9, label: '90%' }
                              ]}
                              valueLabelDisplay="auto"
                              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                              sx={{ flex: 1 }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Niveau de confiance minimum pour que l'IA réponde automatiquement
                          </Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <FormControl fullWidth>
                            <InputLabel>Langue principale</InputLabel>
                            <Select
                              value={aiSettings.language}
                              onChange={(e) => handleAISettingChange('language', e.target.value)}
                              label="Langue principale"
                            >
                              <MenuItem value="fr">Français</MenuItem>
                              <MenuItem value="en">Anglais</MenuItem>
                              <MenuItem value="es">Espagnol</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Box>

                    <Divider />

                    {/* Section Fonctionnalités */}
                    <Box>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SettingsIcon /> Fonctionnalités
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={aiSettings.learning_enabled}
                                onChange={(e) => handleAISettingChange('learning_enabled', e.target.checked)}
                                color="primary"
                              />
                            }
                            label="Apprentissage automatique"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={aiSettings.rule_based_responses}
                                onChange={(e) => handleAISettingChange('rule_based_responses', e.target.checked)}
                                color="primary"
                              />
                            }
                            label="Réponses basées sur les règles"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={aiSettings.product_recommendations}
                                onChange={(e) => handleAISettingChange('product_recommendations', e.target.checked)}
                                color="primary"
                              />
                            }
                            label="Recommandations de produits"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={aiSettings.sentiment_analysis}
                                onChange={(e) => handleAISettingChange('sentiment_analysis', e.target.checked)}
                                color="primary"
                              />
                            }
                            label="Analyse de sentiment"
                          />
                        </Grid>
                      </Grid>
                    </Box>

                    <Divider />

                    {/* Section Contexte */}
                    <Box>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MemoryIcon /> Gestion du Contexte
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2" sx={{ minWidth: 200 }}>
                              Longueur du contexte: {aiSettings.max_context_length} messages
                            </Typography>
                            <Slider
                              value={aiSettings.max_context_length}
                              onChange={(e, newValue) => handleAISettingChange('max_context_length', newValue)}
                              step={1}
                              min={1}
                              max={20}
                              marks={[
                                { value: 1, label: '1' },
                                { value: 10, label: '10' },
                                { value: 20, label: '20' }
                              ]}
                              valueLabelDisplay="auto"
                              sx={{ flex: 1 }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Nombre de messages précédents que l'IA prend en compte pour le contexte
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="État de l'IA" />
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Statut global:</Typography>
                      <Chip
                        label={aiSettings.enabled ? "Activée" : "Désactivée"}
                        color={aiSettings.enabled ? "success" : "error"}
                        icon={aiSettings.enabled ? <PsychologyIcon /> : <PsychologyIcon />}
                      />
                    </Box>
                    
                    <Divider />
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Apprentissage:</Typography>
                      <Chip
                        label={aiSettings.learning_enabled ? "Activé" : "Désactivé"}
                        color={aiSettings.learning_enabled ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Règles:</Typography>
                      <Chip
                        label={aiSettings.rule_based_responses ? "Activées" : "Désactivées"}
                        color={aiSettings.rule_based_responses ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Recommandations:</Typography>
                      <Chip
                        label={aiSettings.product_recommendations ? "Activées" : "Désactivées"}
                        color={aiSettings.product_recommendations ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Analyse sentiment:</Typography>
                      <Chip
                        label={aiSettings.sentiment_analysis ? "Activée" : "Désactivée"}
                        color={aiSettings.sentiment_analysis ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    
                    <Divider />
                    
                    <Alert 
                      severity={aiSettings.confidence_threshold > 0.8 ? "warning" : "info"}
                      sx={{ mt: 1 }}
                    >
                      Seuil de confiance: {Math.round(aiSettings.confidence_threshold * 100)}%
                      {aiSettings.confidence_threshold > 0.8 && 
                        " (Élevé - moins de réponses automatiques)"}
                      {aiSettings.confidence_threshold < 0.5 && 
                        " (Bas - plus de réponses automatiques)"}
                    </Alert>
                    
                    <Button
                      variant="outlined"
                      color={aiSettings.enabled ? "error" : "success"}
                      startIcon={<PsychologyIcon />}
                      onClick={() => handleAISettingChange('enabled', !aiSettings.enabled)}
                      fullWidth
                      sx={{ mt: 1 }}
                    >
                      {aiSettings.enabled ? "Désactiver l'IA" : "Activer l'IA"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 5: Paramètres Automation */}
        <TabPanel value={tabValue} index={isAgencyUser ? 5 : 4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader
                  title="Paramètres d'Automation"
                  subheader="Configurez le comportement automatique des conversations et des CRUD"
                  action={
                    <Button
                      startIcon={<SaveIcon />}
                      variant="contained"
                      color="primary"
                      onClick={handleSaveAutomationSettings}
                      disabled={loading}
                    >
                      Sauvegarder
                    </Button>
                  }
                />
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={automationSettings.autoResponder}
                          onChange={(e) => handleAutomationSettingChange('autoResponder', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Répondeur automatique"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={automationSettings.autoCreateContacts}
                          onChange={(e) => handleAutomationSettingChange('autoCreateContacts', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Création automatique de contacts"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={automationSettings.autoUpdateConversations}
                          onChange={(e) => handleAutomationSettingChange('autoUpdateConversations', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Mise à jour automatique des conversations"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={automationSettings.autoProcessOrders}
                          onChange={(e) => handleAutomationSettingChange('autoProcessOrders', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Traitement automatique des commandes"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={automationSettings.autoGenerateQuotes}
                          onChange={(e) => handleAutomationSettingChange('autoGenerateQuotes', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Génération automatique de devis"
                    />
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={automationSettings.workingHoursOnly}
                          onChange={(e) => handleAutomationSettingChange('workingHoursOnly', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Heures de travail uniquement"
                    />
                    
                    {automationSettings.workingHoursOnly && (
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Heure de début"
                            type="time"
                            value={automationSettings.workingHoursStart}
                            onChange={(e) => handleAutomationSettingChange('workingHoursStart', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Heure de fin"
                            type="time"
                            value={automationSettings.workingHoursEnd}
                            onChange={(e) => handleAutomationSettingChange('workingHoursEnd', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="État de l'Automation" />
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Statut global:</Typography>
                      <Chip
                        label={stats.automationEnabled ? "Activée" : "Désactivée"}
                        color={stats.automationEnabled ? "success" : "error"}
                        size="small"
                      />
                    </Box>
                    
                    <Divider />
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Répondeur automatique:</Typography>
                      <Chip
                        label={automationSettings.autoResponder ? "Activé" : "Désactivé"}
                        color={automationSettings.autoResponder ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Création contacts:</Typography>
                      <Chip
                        label={automationSettings.autoCreateContacts ? "Activé" : "Désactivé"}
                        color={automationSettings.autoCreateContacts ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Traitement commandes:</Typography>
                      <Chip
                        label={automationSettings.autoProcessOrders ? "Activé" : "Désactivé"}
                        color={automationSettings.autoProcessOrders ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    
                    <Divider />
                    
                    {automationSettings.workingHoursOnly && (
                      <Alert severity="info">
                        Active de {automationSettings.workingHoursStart} à {automationSettings.workingHoursEnd}
                      </Alert>
                    )}
                    
                    <Button
                      variant="outlined"
                      color={stats.automationEnabled ? "error" : "success"}
                      startIcon={<PowerSettingsNewIcon />}
                      onClick={handleToggleAutomation}
                      fullWidth
                    >
                      {stats.automationEnabled ? "Désactiver l'automation" : "Activer l'automation"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Dialog pour ajouter un nouveau compte webhook */}
      <Dialog 
        open={showNewAccountDialog} 
        onClose={() => setShowNewAccountDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon />
            Ajouter un nouveau compte webhook
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              fullWidth
              label="Nom du compte"
              name="name"
              value={newAccount.name}
              onChange={handleNewAccountChange}
              required
              helperText="Nom d'affichage pour ce compte"
            />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Plateforme</InputLabel>
                  <Select
                    name="platform"
                    value={newAccount.platform}
                    onChange={handleNewAccountChange}
                    label="Plateforme"
                  >
                    <MenuItem value="facebook_messenger">Facebook Messenger</MenuItem>
                    <MenuItem value="whatsapp_business">WhatsApp Business</MenuItem>
                    <MenuItem value="twilio">Twilio (WhatsApp/SMS)</MenuItem>
                    <MenuItem value="sms">SMS API</MenuItem>
                    <MenuItem value="telegram">Telegram</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Type de plateforme</InputLabel>
                  <Select
                    name="platform_type"
                    value={newAccount.platform_type}
                    onChange={handleNewAccountChange}
                    label="Type de plateforme"
                  >
                    <MenuItem value="facebook_messenger">Facebook Messenger API</MenuItem>
                    <MenuItem value="whatsapp_business">WhatsApp Business API</MenuItem>
                    <MenuItem value="twilio_whatsapp">Twilio WhatsApp</MenuItem>
                    <MenuItem value="generic">Générique</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            {/* Section conditionnelle pour Facebook Messenger */}
            {newAccount.platform === 'facebook_messenger' && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FacebookIcon color="primary" />
                    <Typography>Configuration Facebook Messenger</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Access Token (Page Access Token)"
                      name="access_token"
                      type="password"
                      value={newAccount.access_token}
                      onChange={handleNewAccountChange}
                      required
                      helperText="Token d'accès de la page Facebook"
                    />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Page ID"
                          name="page_id"
                          value={newAccount.page_id}
                          onChange={handleNewAccountChange}
                          required
                          helperText="ID de la page Facebook"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Nom de la page (optionnel)"
                          name="page_name"
                          value={newAccount.page_name}
                          onChange={handleNewAccountChange}
                          helperText="Pour référence seulement"
                        />
                      </Grid>
                    </Grid>
                    
                    <TextField
                      fullWidth
                      label="App ID (optionnel)"
                      name="app_id"
                      value={newAccount.app_id}
                      onChange={handleNewAccountChange}
                      helperText="ID de l'application Facebook"
                    />
                    
                    <TextField
                      fullWidth
                      label="App Secret (optionnel)"
                      name="app_secret"
                      type="password"
                      value={newAccount.app_secret}
                      onChange={handleNewAccountChange}
                      helperText="Secret de l'application Facebook"
                    />
                    
                    <TextField
                      fullWidth
                      label="Token de vérification"
                      name="verify_token"
                      value={newAccount.verify_token}
                      onChange={handleNewAccountChange}
                      required
                      helperText="Doit correspondre au Verify Token dans Meta"
                    />
                    
                    <FormControl fullWidth>
                      <InputLabel>Champs à s'abonner</InputLabel>
                      <Select
                        multiple
                        value={newAccount.webhook_fields}
                        onChange={(e) => setNewAccount(prev => ({ 
                          ...prev, 
                          webhook_fields: e.target.value 
                        }))}
                        label="Champs à s'abonner"
                      >
                        <MenuItem value="messages">Messages</MenuItem>
                        <MenuItem value="messaging_postbacks">Postbacks</MenuItem>
                        <MenuItem value="messaging_optins">Opt-ins</MenuItem>
                        <MenuItem value="messaging_referrals">Referrals</MenuItem>
                        <MenuItem value="messaging_handovers">Handovers</MenuItem>
                        <MenuItem value="messaging_policy_enforcement">Policy Enforcement</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <Alert severity="info">
                      Ces informations sont disponibles dans l'Espace App Facebook. L'URL webhook sera générée automatiquement.
                    </Alert>
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
            
            {/* Pour les autres plateformes */}
            {newAccount.platform !== 'facebook_messenger' && (
              <>
                <TextField
                  fullWidth
                  label="Account SID / API Key"
                  name="account_sid"
                  value={newAccount.account_sid}
                  onChange={handleNewAccountChange}
                  required={newAccount.platform !== 'telegram'}
                  helperText={newAccount.platform === 'telegram' ? "Optionnel pour Telegram" : "Ce champ est requis"}
                />
                
                <TextField
                  fullWidth
                  label="Auth Token / Secret"
                  name="auth_token"
                  type="password"
                  value={newAccount.auth_token}
                  onChange={handleNewAccountChange}
                  required={newAccount.platform !== 'telegram'}
                  helperText={newAccount.platform === 'telegram' ? "Bot Token pour Telegram" : "Ce champ est requis"}
                />
              </>
            )}
            
            {/* Numéro de téléphone pour certaines plateformes */}
            {(newAccount.platform === 'twilio' || newAccount.platform === 'sms' || newAccount.platform === 'whatsapp_business') && (
              <TextField
                fullWidth
                label="Numéro de téléphone"
                name="phone_number"
                value={newAccount.phone_number}
                onChange={handleNewAccountChange}
                placeholder="+1234567890"
                helperText="Numéro associé au compte"
              />
            )}
            
            {/* WhatsApp Business spécifique */}
            {newAccount.platform === 'whatsapp_business' && (
              <>
                <TextField
                  fullWidth
                  label="Phone ID (WhatsApp Business)"
                  name="phone_id"
                  value={newAccount.phone_id}
                  onChange={handleNewAccountChange}
                  placeholder="123456789012345"
                />
                <TextField
                  fullWidth
                  label="Business ID (optionnel)"
                  name="business_id"
                  value={newAccount.business_id}
                  onChange={handleNewAccountChange}
                />
              </>
            )}
            
            <TextField
              fullWidth
              label="URL Webhook (optionnel)"
              name="webhook_url"
              value={newAccount.webhook_url}
              onChange={handleNewAccountChange}
              placeholder="https://votre-domaine.com/webhook/twilio"
              helperText="Laisser vide pour utiliser l'URL par défaut"
            />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newAccount.is_active}
                      onChange={(e) => setNewAccount(prev => ({ 
                        ...prev, 
                        is_active: e.target.checked 
                      }))}
                      color="primary"
                    />
                  }
                  label="Activer immédiatement"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newAccount.ai_enabled}
                      onChange={(e) => setNewAccount(prev => ({ 
                        ...prev, 
                        ai_enabled: e.target.checked ,
                        auto_reply: e.target.checked ? true : prev.auto_reply
                      }))}
                      color="primary"
                    />
                  }
                  label="Activer l'IA pour ce compte"
                />
              </Grid>
            </Grid>
            
            {newAccount.ai_enabled && (
              <FormControlLabel
                control={
                  <Switch
                    checked={newAccount.auto_reply}
                    onChange={(e) => setNewAccount(prev => ({ 
                      ...prev, 
                      auto_reply: e.target.checked 
                    }))}
                    color="primary"
                  />
                }
                label="Réponses automatiques IA"
              />
            )}
            
            <Alert severity="info">
              Après l'ajout du compte, vous devrez configurer le webhook dans l'interface de la plateforme respective.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewAccountDialog(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleAddWebhookAccount} 
            variant="contained" 
            disabled={loading || !newAccount.name || !newAccount.platform ||
              (newAccount.platform === 'facebook_messenger' && (!newAccount.access_token || !newAccount.page_id || !newAccount.verify_token)) ||
              (['twilio', 'sms'].includes(newAccount.platform) && (!newAccount.account_sid || !newAccount.auth_token)) ||
              (newAccount.platform === 'whatsapp_business' && (!newAccount.access_token || !newAccount.phone_id))
            }
          >
            {loading ? "Ajout en cours..." : "Ajouter le compte"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== WIZARD D'ONBOARDING ==================== */}
      {/* Wizard OAuth Facebook pour TOUS les utilisateurs */}
      <Dialog 
        open={showPlatformWizard} 
        onClose={() => {
          setShowPlatformWizard(false);
          setFacebookOAuth({
            isActive: false,
            currentStep: 0,
            sessionId: null,
            pages: [],
            selectedPage: null,
            facebookUser: null
          });
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { 
            borderRadius: 2,
            minHeight: facebookOAuth.currentStep === 2 ? '500px' : 'auto'
          }
        }}
      >
        {/* En-tête avec progression */}
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: '#1877F2' }}>
              <FacebookIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">
                {facebookOAuth.currentStep === 0 && 'Connecter Facebook Messenger'}
                {facebookOAuth.currentStep === 1 && 'Connexion en cours...'}
                {facebookOAuth.currentStep === 2 && 'Choisissez votre page'}
                {facebookOAuth.currentStep === 3 && 'Configuration finale'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Étape {facebookOAuth.currentStep + 1} sur 4
              </Typography>
            </Box>
            
            {/* Indicateur de progression */}
            <Box sx={{ width: 100 }}>
              <LinearProgress 
                variant="determinate" 
                value={(facebookOAuth.currentStep + 1) * 25} 
                sx={{ borderRadius: 5, height: 6 }}
              />
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          
          {/* ÉTAPE 0 : Introduction */}
          {facebookOAuth.currentStep === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <FacebookIcon sx={{ fontSize: 72, color: '#1877F2', mb: 3 }} />
              
              <Typography variant="h5" gutterBottom fontWeight="600">
                Connectez votre Page Facebook
              </Typography>
              
              <Typography variant="body1" color="text.secondary" paragraph>
                Connectez-vous pour afficher vos pages Facebook et configurer Messenger automatiquement.
              </Typography>
              
              <Box sx={{ my: 4, p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  ✅ Ce que nous faisons :
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Connexion sécurisée à Facebook" />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Liste automatique de vos pages" />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Configuration automatique de Messenger" />
                  </ListItem>
                </List>
              </Box>
              
              <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                <Typography variant="body2">
                  <strong>Note :</strong> Vous devez être administrateur de la page pour la connecter.
                </Typography>
              </Alert>
              
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={startFacebookOAuthFlow}
                sx={{ 
                  py: 1.5,
                  bgcolor: '#1877F2',
                  '&:hover': { bgcolor: '#0D5AB9' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FacebookIcon />
                  <Typography variant="button">
                    Se connecter avec Facebook
                  </Typography>
                </Box>
              </Button>
              
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                En continuant, vous autorisez l'accès à vos pages Facebook
              </Typography>
            </Box>
          )}
          
          {/* ÉTAPE 1 : Connexion en cours */}
          {facebookOAuth.currentStep === 1 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={60} thickness={4} sx={{ mb: 3, color: '#1877F2' }} />
              
              <Typography variant="h6" gutterBottom>
                Connexion à Facebook...
              </Typography>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Une fenêtre s'est ouverte pour vous connecter à Facebook.
                <br />
                Si aucune fenêtre n'apparaît, vérifiez vos bloqueurs de popups.
              </Typography>
              
              <Box sx={{ mt: 4, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography variant="caption">
                  <strong>Conseil :</strong> La fenêtre Facebook peut s'ouvrir en arrière-plan.
                </Typography>
              </Box>
            </Box>
          )}
          
          {/* ÉTAPE 2 : Sélection de la page */}
          {facebookOAuth.currentStep === 2 && (
            <Box>
              {facebookOAuth.facebookUser && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <AlertTitle>Connecté en tant que {facebookOAuth.facebookUser.name}</AlertTitle>
                  Sélectionnez la page à connecter
                </Alert>
              )}
              
              <Typography variant="subtitle1" gutterBottom>
                Vos pages Facebook
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : facebookOAuth.pages.length === 0 ? (
                <Alert severity="warning">
                  <Typography variant="body2">
                    Aucune page avec Messenger activé trouvée.
                    <br />
                    <Button 
                      size="small" 
                      onClick={startFacebookOAuthFlow}
                      sx={{ mt: 1 }}
                    >
                      Réessayer
                    </Button>
                  </Typography>
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {facebookOAuth.pages.length} page(s) disponible(s)
                  </Typography>
                  
                  <List sx={{ maxHeight: 350, overflow: 'auto' }}>
                    {facebookOAuth.pages.map((page) => (
                      <Card 
                        key={page.id}
                        variant="outlined"
                        sx={{ 
                          mb: 1.5,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: 'primary.main',
                            boxShadow: 1,
                            transform: 'translateY(-2px)'
                          }
                        }}
                        onClick={() => selectPageForConnection(page)}
                      >
                        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                          <Grid container alignItems="center" spacing={2}>
                            <Grid item>
                              <Avatar 
                                src={page.picture?.data?.url} 
                                sx={{ bgcolor: '#1877F2' }}
                              >
                                <FacebookIcon />
                              </Avatar>
                            </Grid>
                            
                            <Grid item xs>
                              <Typography variant="subtitle1" fontWeight="500">
                                {page.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {page.category || 'Page Facebook'} • ID: {page.id.substring(0, 8)}...
                              </Typography>
                              
                              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                {(page.permissions || []).includes('ADVERTISE') && (
                                  <Chip label="Publicité" size="small" />
                                )}
                                {(page.tasks || []).includes('MODERATE') && (
                                  <Chip label="Messenger" size="small" />
                                )}
                              </Box>
                            </Grid>
                            
                            <Grid item>
                              <IconButton size="small">
                                <ChevronRightIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))}
                  </List>
                </>
              )}
            </Box>
          )}
          
          {/* ÉTAPE 3: Configuration finale - FIX THE CUT OFF */}
          {facebookOAuth.currentStep === 3 && facebookOAuth.selectedPage && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>Configuration finale</AlertTitle>
                Vérifiez les paramètres avant de finaliser
              </Alert>
              
              {/* Informations de la page */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Page sélectionnée
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar 
                    src={typeof facebookOAuth.selectedPage.picture === 'string' 
                      ? facebookOAuth.selectedPage.picture 
                      : facebookOAuth.selectedPage.picture?.data?.url
                    }
                  >
                    <FacebookIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {facebookOAuth.selectedPage.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {facebookOAuth.selectedPage.id}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
              
              {/* Actions */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                <Button
                  onClick={() => setFacebookOAuth(prev => ({ ...prev, currentStep: 2 }))}
                >
                  Retour
                </Button>
                <Button
                  variant="contained"
                  onClick={finalizeFacebookConnection}
                  disabled={loading}
                >
                  {loading ? 'Configuration...' : 'Finaliser la connexion'}
                </Button>
              </Box>
            </Box>
          )}
          
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
          <Button
            onClick={() => {
              setShowPlatformWizard(false);
              setFacebookOAuth({
                isActive: false,
                currentStep: 0,
                sessionId: null,
                pages: [],
                selectedPage: null,
                facebookUser: null
              });
            }}
            disabled={loading}
          >
            Annuler
          </Button>
          
          {facebookOAuth.currentStep === 2 && facebookOAuth.pages.length > 0 && (
            <Button
              onClick={startFacebookOAuthFlow}
              startIcon={<RefreshIcon />}
            >
              Actualiser
            </Button>
          )}
          
          {facebookOAuth.currentStep === 3 && (
            <Button
              onClick={finalizeFacebookConnection}
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            >
              {loading ? 'Configuration...' : 'Connecter cette page'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog pour inviter un client */}
      <Dialog 
        open={showInvitationDialog} 
        onClose={() => setShowInvitationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Inviter un nouveau client</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <Alert severity="info">
              Le client recevra un lien pour configurer lui-même son Messenger
            </Alert>
            
            <TextField
              fullWidth
              label="Nom du client/entreprise"
              value={invitationData.client_name}
              onChange={(e) => handleInvitationDataChange('client_name', e.target.value)}
              required
            />
            
            <TextField
              fullWidth
              label="Email du client"
              type="email"
              value={invitationData.client_email}
              onChange={(e) => handleInvitationDataChange('client_email', e.target.value)}
              required
            />
            
            <TextField
              fullWidth
              label="Téléphone (optionnel)"
              value={invitationData.client_phone || ''}
              onChange={(e) => handleInvitationDataChange('client_phone', e.target.value)}
            />
            
            <FormControl fullWidth>
              <InputLabel>Méthode d'invitation</InputLabel>
              <Select
                value={invitationData.invitation_method}
                onChange={(e) => handleInvitationDataChange('invitation_method', e.target.value)}
                label="Méthode d'invitation"
              >
                <MenuItem value="email">Envoyer par email automatiquement</MenuItem>
                <MenuItem value="link">Générer un lien à partager</MenuItem>
              </Select>
            </FormControl>
            
            {invitationData.invitation_method === 'email' && (
              <Alert severity="warning">
                Un email sera envoyé à {invitationData.client_email} avec les instructions
              </Alert>
            )}
            
            {invitationData.invitation_method === 'link' && (
              <Alert severity="info">
                Vous devrez partager manuellement le lien avec votre client
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInvitationDialog(false)}>
            Annuler
          </Button>
          <Button 
            onClick={createClientInvitation} 
            variant="contained" 
            disabled={loading || !invitationData.client_name || !invitationData.client_email}
          >
            {loading ? 'Création...' : 'Créer l\'invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}






