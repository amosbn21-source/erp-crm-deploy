// PlatformOnboardingWizard.jsx - COMPOSANT PRINCIPAL
import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Switch,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Facebook as FacebookIcon,
  WhatsApp as WhatsAppIcon,
  Sms as SmsIcon,
  Telegram as TelegramIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon,
  Send as SendIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Link as LinkIcon,
  Key as KeyIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Configuration des plateformes
const PLATFORMS_CONFIG = {
  facebook_messenger: {
    name: 'Facebook Messenger',
    icon: FacebookIcon,
    color: '#1877F2',
    steps: ['Connexion', 'Message d\'accueil', 'Configuration'],
    needsOAuth: true,
    description: 'Connectez votre page Facebook pour gérer Messenger'
  },
  whatsapp_business: {
    name: 'WhatsApp Business',
    icon: WhatsAppIcon,
    color: '#25D366',
    steps: ['Identifiants API', 'Numéro', 'Configuration'],
    needsOAuth: false,
    description: 'API WhatsApp Business pour messages professionnels'
  },
  twilio: {
    name: 'Twilio',
    icon: SmsIcon,
    color: '#F22F46',
    steps: ['Compte Twilio', 'Numéro', 'Webhook'],
    needsOAuth: false,
    description: 'Envoyez et recevez des SMS/WhatsApp via Twilio'
  },
  telegram: {
    name: 'Telegram',
    icon: TelegramIcon,
    color: '#0088CC',
    steps: ['Token Bot', 'Configuration'],
    needsOAuth: false,
    description: 'Bot Telegram pour automatiser les conversations'
  }
};

// Étape 1: Sélection de la plateforme
function PlatformSelectionStep({ onSelect, initialPlatform }) {
  const [selected, setSelected] = useState(initialPlatform);

  useEffect(() => {
    if (initialPlatform) {
      setSelected(initialPlatform);
    }
  }, [initialPlatform]);

  return (
    <Card variant="outlined" sx={{ m: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom align="center">
          🚀 Sélectionnez une plateforme
        </Typography>
        <Typography color="text.secondary" align="center" paragraph>
          Choisissez le service que vous souhaitez connecter
        </Typography>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          {Object.entries(PLATFORMS_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Grid item xs={12} sm={6} key={key}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    border: selected === key ? `2px solid ${config.color}` : '1px solid',
                    borderColor: selected === key ? config.color : 'grey.300',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3
                    }
                  }}
                  onClick={() => setSelected(key)}
                >
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Icon sx={{ fontSize: 40, color: config.color, mb: 1 }} />
                    <Typography variant="h6" gutterBottom>
                      {config.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                      {config.description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <Chip 
                        label={config.needsOAuth ? 'OAuth' : 'API Key'} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`${config.steps.length} étapes`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            variant="contained"
            disabled={!selected}
            onClick={() => onSelect(selected)}
            size="large"
            sx={{ minWidth: 200 }}
          >
            Continuer avec {selected ? PLATFORMS_CONFIG[selected].name : '...'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

// Étape 2: Configuration OAuth ou API
function ConfigurationStep({ platform, onComplete, onBack }) {
  const config = PLATFORMS_CONFIG[platform];
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Champs selon la plateforme
  const getPlatformFields = () => {
    switch(platform) {
      case 'facebook_messenger':
        return [
          { name: 'page_name', label: 'Nom de la page', required: true },
          { name: 'page_id', label: 'Page ID', required: true }
        ];
      case 'whatsapp_business':
        return [
          { name: 'business_id', label: 'Business ID', required: true },
          { name: 'phone_number', label: 'Numéro WhatsApp', required: true },
          { name: 'phone_id', label: 'Phone ID', required: true },
          { name: 'access_token', label: 'Access Token', type: 'password', required: true }
        ];
      case 'twilio':
        return [
          { name: 'account_sid', label: 'Account SID', required: true },
          { name: 'auth_token', label: 'Auth Token', type: 'password', required: true },
          { name: 'phone_number', label: 'Numéro Twilio', required: true }
        ];
      case 'telegram':
        return [
          { name: 'auth_token', label: 'Bot Token', type: 'password', required: true }
        ];
      default:
        return [];
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    // Simulation de la connexion
    setTimeout(() => {
      onComplete({
        ...formData,
        platform: platform,
        name: formData.page_name || formData.business_id || `${config.name} Account`
      });
      setLoading(false);
    }, 1500);
  };

  const handleFacebookOAuth = () => {
    const appId = process.env.REACT_APP_FACEBOOK_APP_ID || 'YOUR_APP_ID';
    
    // URL de callback - IMPORTANT : Doit correspondre à Facebook
    const redirectUri = `${window.location.origin}/oauth/facebook-callback`;
    
    // Scopes nécessaires
    const scopes = [
        'pages_manage_metadata',
        'pages_messaging',
        'pages_read_engagement',
        'pages_show_list'
    ].join(',');

    const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=token`;
    
    console.log('URL OAuth Facebook:', oauthUrl);
    window.open(oauthUrl, '_blank', 'width=600,height=700');
    };

  const Icon = config.icon;

  return (
    <Box sx={{ m: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Icon sx={{ color: config.color, mr: 2, fontSize: 40 }} />
        <Box>
          <Typography variant="h5">
            Configuration {config.name}
          </Typography>
          <Typography color="text.secondary">
            Étape 2 sur {config.steps.length}
          </Typography>
        </Box>
      </Box>

      {config.needsOAuth ? (
        // Interface OAuth pour Facebook
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Connexion Facebook
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Nous avons besoin d'accéder à vos pages Facebook pour configurer Messenger.
            </Alert>
            
            <Button
              variant="contained"
              startIcon={<FacebookIcon />}
              onClick={handleFacebookOAuth}
              disabled={loading}
              fullWidth
              size="large"
              sx={{ mb: 3, bgcolor: '#1877F2', py: 1.5 }}
            >
              {loading ? 'Connexion...' : 'Se connecter avec Facebook'}
            </Button>

            <Typography variant="subtitle2" gutterBottom>
              Ce que nous ferons :
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText primary="Lister vos pages Facebook" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText primary="Configurer Messenger" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText primary="Activer les réponses automatiques" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      ) : (
        // Interface API Key pour les autres plateformes
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Identifiants {config.name}
            </Typography>
            
            <Alert severity="warning" sx={{ mb: 3 }}>
              Ces informations sont sensibles. Gardez-les secrètes.
            </Alert>

            {getPlatformFields().map((field) => (
              <TextField
                key={field.name}
                fullWidth
                label={field.label}
                type={showToken && field.type === 'password' ? 'text' : field.type || 'text'}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                required={field.required}
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: field.type === 'password' ? (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowToken(!showToken)}>
                        {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }}
              />
            ))}

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={onBack}
                fullWidth
              >
                Retour
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading || Object.keys(formData).length === 0}
                fullWidth
              >
                {loading ? 'Connexion...' : 'Continuer'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// Étape 3: Configuration finale
function FinalStep({ platform, config, onComplete, onBack }) {
  const platformConfig = PLATFORMS_CONFIG[platform];
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoReply, setAutoReply] = useState(true);

  const handleFinish = async () => {
    setLoading(true);
    
    // Appel API pour créer le compte
    try {
      const response = await fetch('/api/webhook-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...config,
          ai_enabled: aiEnabled,
          auto_reply: autoReply,
          is_active: true
        })
      });

      const data = await response.json();
      
      onComplete({
        success: true,
        platform: platform,
        accountId: data.data?.id,
        config: config
      });
      
    } catch (error) {
      console.error('Erreur création compte:', error);
      onComplete({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const Icon = platformConfig.icon;

  return (
    <Box sx={{ m: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Icon sx={{ color: platformConfig.color, mr: 2, fontSize: 40 }} />
        <Box>
          <Typography variant="h5">
            Finalisation
          </Typography>
          <Typography color="text.secondary">
            Dernière étape !
          </Typography>
        </Box>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography fontWeight="medium">
              ✅ Configuration {platformConfig.name} prête
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Paramètres IA
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Activer l'intelligence artificielle"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                    L'IA analysera et répondra automatiquement aux messages
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoReply}
                        onChange={(e) => setAutoReply(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Réponses automatiques"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Répondre immédiatement aux messages entrants
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Récapitulatif
                  </Typography>
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <Icon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Plateforme"
                        secondary={platformConfig.name}
                      />
                    </ListItem>
                    
                    {config.page_name && (
                      <ListItem>
                        <ListItemIcon>
                          <BusinessIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Page"
                          secondary={config.page_name}
                        />
                      </ListItem>
                    )}
                    
                    {config.phone_number && (
                      <ListItem>
                        <ListItemIcon>
                          <PhoneIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Numéro"
                          secondary={config.phone_number}
                        />
                      </ListItem>
                    )}
                    
                    <ListItem>
                      <ListItemIcon>
                        <SettingsIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Fonctionnalités"
                        secondary={`IA: ${aiEnabled ? 'Oui' : 'Non'}, Auto-réponse: ${autoReply ? 'Oui' : 'Non'}`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={onBack}
              disabled={loading}
              fullWidth
            >
              Retour
            </Button>
            <Button
              variant="contained"
              onClick={handleFinish}
              disabled={loading}
              fullWidth
              size="large"
            >
              {loading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Connexion...
                </>
              ) : 'Terminer et connecter'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// Composant principal du Wizard
export default function PlatformOnboardingWizard({ initialPlatform, onComplete }) {
  const [step, setStep] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [configData, setConfigData] = useState(null);

  const handlePlatformSelect = (platform) => {
    setSelectedPlatform(platform);
    setStep(1);
  };

  const handleConfigComplete = (data) => {
    setConfigData(data);
    setStep(2);
  };

  const handleFinalComplete = (result) => {
    onComplete(result);
  };

  const handleBack = () => {
    if (step === 0) {
      onComplete(null);
    } else {
      setStep(step - 1);
    }
  };

  const getCurrentStepContent = () => {
    if (selectedPlatform === null || step === 0) {
      return <PlatformSelectionStep onSelect={handlePlatformSelect} initialPlatform={initialPlatform} />;
    }

    const platformConfig = PLATFORMS_CONFIG[selectedPlatform];
    
    if (!platformConfig) {
      return (
        <Alert severity="error" sx={{ m: 3 }}>
          Plateforme non supportée
        </Alert>
      );
    }

    switch(step) {
      case 1:
        return (
          <ConfigurationStep
            platform={selectedPlatform}
            onComplete={handleConfigComplete}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <FinalStep
            platform={selectedPlatform}
            config={configData}
            onComplete={handleFinalComplete}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {selectedPlatform && (
        <Box sx={{ px: 3, pt: 3 }}>
          <Stepper activeStep={step} alternativeLabel>
            {PLATFORMS_CONFIG[selectedPlatform]?.steps.map((label, index) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {getCurrentStepContent()}
    </Box>
  );
}