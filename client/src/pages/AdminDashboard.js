// src/pages/AdminDashboard.js - VERSION AVEC DIALOGUES UNIFIÉS
import React, { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Grid, Box, Stack,
  Chip, Avatar, Alert, AlertTitle,
  Button, Paper, alpha, useTheme,
  CircularProgress, TextField, MenuItem,
  InputAdornment, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select,
  ToggleButton, ToggleButtonGroup,
  Snackbar
} from '@mui/material';
import {
  ShoppingCart as CartIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingIcon,
  People as PeopleIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Inventory as InventoryIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  CalendarToday as CalendarIcon,
  DateRange as DateRangeIcon,
  FilterAlt as FilterIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  TrendingFlat as FlatIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  PictureAsPdf as PdfIcon,
  Add as AddIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Description as DocumentIcon
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format, subDays, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { secureGet, securePost } from '../services/api';
import MuiAlert from '@mui/material/Alert';

// Import des composants de formulaire existants
import OrderFormDialog from '../components/OrderFormDialog';
import ContactFormDialog from '../components/ContactFormDialog';
import ProductFormDialog from '../components/ProductFormDialog';
import { useAuth } from '../auth/AuthContext';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Composant Alert pour les notifications
const AlertComponent = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

// ==================== FONCTIONS UTILITAIRES ====================

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('fr-FR').format(num || 0);
};

const formatDate = (date) => {
  if (!date) return '';
  try {
    return format(parseISO(date), 'dd/MM/yyyy');
  } catch (error) {
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch (e) {
      return date;
    }
  }
};

const StatusChip = ({ status }) => {
  const getStatusColor = (statut) => {
    switch (statut?.toLowerCase()) {
      case 'livrée':
      case 'livre':
        return 'success';
      case 'en cours':
      case 'en_cours':
        return 'warning';
      case 'en attente':
      case 'en_attente':
        return 'info';
      case 'annulée':
      case 'annulee':
      case 'annulé':
        return 'error';
      default: return 'default';
    }
  };
  
  return (
    <Chip 
      label={status || 'N/A'}
      size="small"
      color={getStatusColor(status)}
      variant="filled"
      sx={{ fontWeight: 500 }}
    />
  );
};

// Composant DatePicker simplifié
const SimpleDatePicker = ({ label, value, onChange }) => {
  return (
    <TextField
      label={label}
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      InputLabelProps={{
        shrink: true,
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <CalendarIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
    />
  );
};

// ==================== COMPOSANTS DE FILTRES ====================

const FilterPanel = ({ open, onClose, filters, onApplyFilters, onResetFilters }) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const theme = useTheme();

  const periodeOptions = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'yesterday', label: 'Hier' },
    { value: 'last7days', label: '7 derniers jours' },
    { value: 'last30days', label: '30 derniers jours' },
    { value: 'thismonth', label: 'Ce mois' },
    { value: 'lastmonth', label: 'Mois dernier' },
    { value: 'custom', label: 'Personnalisée' }
  ];

  const statutOptions = [
    { value: '', label: 'Tous les statuts' },
    { value: 'livrée', label: 'Livrées' },
    { value: 'en cours', label: 'En cours' },
    { value: 'en attente', label: 'En attente' },
    { value: 'annulée', label: 'Annulées' }
  ];

  const handlePeriodeChange = (value) => {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    switch (value) {
      case 'today':
        startDate = format(now, 'yyyy-MM-dd');
        endDate = format(now, 'yyyy-MM-dd');
        break;
      case 'yesterday':
        {
          const yesterday = subDays(now, 1);
          startDate = format(yesterday, 'yyyy-MM-dd');
          endDate = format(yesterday, 'yyyy-MM-dd');
        }
        break;
      case 'last7days':
        startDate = format(subDays(now, 7), 'yyyy-MM-dd');
        endDate = format(now, 'yyyy-MM-dd');
        break;
      case 'last30days':
        startDate = format(subDays(now, 30), 'yyyy-MM-dd');
        endDate = format(now, 'yyyy-MM-dd');
        break;
      case 'thismonth':
        startDate = format(startOfMonth(now), 'yyyy-MM-dd');
        endDate = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'lastmonth':
        {
          const lastMonth = subMonths(now, 1);
          startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
          endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        }
        break;
      case 'custom':
        // Garder les dates actuelles
        // Mais s'assurer qu'elles sont formatées si elles existent
        if (localFilters.startDate) {
          startDate = format(new Date(localFilters.startDate), 'yyyy-MM-dd');
        }
        if (localFilters.endDate) {
          endDate = format(new Date(localFilters.endDate), 'yyyy-MM-dd');
        }
        break;
      default:
        startDate = format(subDays(now, 30), 'yyyy-MM-dd');
        endDate = format(now, 'yyyy-MM-dd');
        break;
    }
    
    setLocalFilters({
      ...localFilters,
      periode: value,
      startDate,
      endDate
    });
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const now = new Date();
    const resetFilters = {
      periode: 'last30days',
      startDate: format(subDays(now, 30), 'yyyy-MM-dd'),
      endDate: format(now, 'yyyy-MM-dd'),
      statut: ''
    };
    setLocalFilters(resetFilters);
    onResetFilters();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <FilterIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Filtres du tableau de bord</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Période */}
          <FormControl fullWidth>
            <InputLabel>Période</InputLabel>
            <Select
              value={localFilters.periode || 'last30days'}
              label="Période"
              onChange={(e) => handlePeriodeChange(e.target.value)}
            >
              {periodeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Dates personnalisées */}
          {localFilters.periode === 'custom' && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <SimpleDatePicker
                  label="Date de début"
                  value={localFilters.startDate || ''}
                  onChange={(date) => {
                    // date est une string "YYYY-MM-DD" du input type="date"
                    console.log('Date sélectionnée:', date); // Ex: "2024-01-15"
                    
                    // IMPORTANT: S'assurer que la date est valide
                    if (date) {
                      try {
                        // Créer une Date object pour validation
                        const dateObj = new Date(date);
                        
                        // Vérifier si la date est valide
                        if (isNaN(dateObj.getTime())) {
                          console.error('Date invalide:', date);
                          return; // Ne pas mettre à jour si invalide
                        }
                        
                        // Formater la date pour l'API
                        // format() de date-fns attend un Date object
                        const formattedDate = format(dateObj, 'yyyy-MM-dd');
                        console.log('Date formatée:', formattedDate);
                        
                        setLocalFilters({
                          ...localFilters,
                          startDate: formattedDate
                        });
                        
                      } catch (error) {
                        console.error('Erreur lors du formatage de la date:', error);
                        // Fallback: utiliser la date telle quelle
                        setLocalFilters({
                          ...localFilters,
                          startDate: date
                        });
                      }
                    } else {
                      // Si date est vide ou null
                      setLocalFilters({
                        ...localFilters,
                        startDate: null
                      });
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={6}>
                <SimpleDatePicker
                  label="Date de fin"
                  value={localFilters.endDate || ''}
                  onChange={(date) => {
                    if (date) {
                      try {
                        const dateObj = new Date(date);
                        
                        // Validation supplémentaire: vérifier que la date de fin
                        // n'est pas avant la date de début
                        if (localFilters.startDate) {
                          const startDateObj = new Date(localFilters.startDate);
                          if (dateObj < startDateObj) {
                            // Optionnel: afficher un message d'erreur
                            console.warn('La date de fin ne peut pas être avant la date de début');
                            // On peut décider de ne pas mettre à jour ou de montrer une alerte
                          }
                        }
                        
                        if (isNaN(dateObj.getTime())) {
                          console.error('Date invalide:', date);
                          return;
                        }
                        
                        const formattedDate = format(dateObj, 'yyyy-MM-dd');
                        
                        setLocalFilters({
                          ...localFilters,
                          endDate: formattedDate
                        });
                        
                      } catch (error) {
                        console.error('Erreur lors du formatage de la date:', error);
                        setLocalFilters({
                          ...localFilters,
                          endDate: date
                        });
                      }
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        endDate: null
                      });
                    }
                  }}
                />
              </Grid>
            </Grid>
          )}

          {/* Statut */}
          <FormControl fullWidth>
            <InputLabel>Statut des commandes</InputLabel>
            <Select
              value={localFilters.statut || ''}
              label="Statut des commandes"
              onChange={(e) => setLocalFilters({
                ...localFilters,
                statut: e.target.value
              })}
            >
              {statutOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Affichage des dates sélectionnées */}
          {(localFilters.startDate || localFilters.endDate) && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
              <Typography variant="body2" color="text.secondary">
                Période sélectionnée :
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {localFilters.startDate ? formatDate(localFilters.startDate) : 'Début'} 
                {' → '}
                {localFilters.endDate ? formatDate(localFilters.endDate) : 'Fin'}
              </Typography>
              {localFilters.statut && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Statut : {statutOptions.find(s => s.value === localFilters.statut)?.label}
                </Typography>
              )}
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, p: 2 }}>
        <Button onClick={handleReset} color="inherit" startIcon={<RefreshIcon />}>
          Réinitialiser
        </Button>
        <Box flex={1} />
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button 
          onClick={handleApply} 
          variant="contained" 
          startIcon={<SaveIcon />}
        >
          Appliquer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== COMPOSANTS DE GRAPHIQUES ====================

const RevenueChart = ({ data, periode, loading, chartType = 'line' }) => {
  const theme = useTheme();
  
  // Vérifier si des données existent
  const hasData = data && data.values && data.values.length > 0 && data.values.some(v => v > 0);
  
  if (loading) {
    return (
      <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!hasData) {
    return (
      <Box sx={{ 
        height: 300, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: alpha(theme.palette.grey[300], 0.2),
        borderRadius: 1
      }}>
        <TrendingIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
        <Typography color="text.secondary" align="center">
          Aucune vente enregistrée
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
          Le graphique s'affichera après vos premières commandes livrées
        </Typography>
      </Box>
    );
  }

  const chartData = {
    labels: data.labels || [],
    datasets: [
      {
        label: 'Chiffre d\'affaires (ventes livrées)',
        data: data.values || [],
        borderColor: theme.palette.success.main,
        backgroundColor: chartType === 'bar' 
          ? alpha(theme.palette.success.main, 0.7)
          : alpha(theme.palette.success.main, 0.1),
        fill: chartType === 'line',
        tension: 0.4,
        borderWidth: 2
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => `CA: ${formatCurrency(context.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCurrency(value)
        },
        grid: {
          color: alpha(theme.palette.grey[500], 0.1)
        },
        title: {
          display: true,
          text: 'Chiffre d\'affaires (XOF)'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'nearest'
    }
  };

  return (
    <Box>
      <Box sx={{ height: 250 }}>
        {chartType === 'line' ? (
          <Line data={chartData} options={options} />
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </Box>
      {periode && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          {periode} • CA calculé uniquement sur les commandes livrées
        </Typography>
      )}
    </Box>
  );
};

const OrdersStatusChart = ({ stats, periode }) => {
  const theme = useTheme();
  
  const hasData = stats && (stats.livrees > 0 || stats.en_cours > 0 || stats.en_attente > 0 || stats.annulees > 0);
  
  if (!hasData) {
    return (
      <Box sx={{ 
        height: 250, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: alpha(theme.palette.grey[300], 0.2),
        borderRadius: 1
      }}>
        <CartIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
        <Typography color="text.secondary" align="center">
          Aucune commande enregistrée
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
          Créez votre première commande pour voir les statistiques
        </Typography>
      </Box>
    );
  }

  const data = {
    labels: ['Livrées', 'En cours', 'En attente', 'Annulées'],
    datasets: [
      {
        data: [
          stats.livrees || 0,
          stats.en_cours || 0,
          stats.en_attente || 0,
          stats.annulees || 0
        ],
        backgroundColor: [
          theme.palette.success.main,
          theme.palette.warning.main,
          theme.palette.info.main,
          theme.palette.error.main
        ],
        borderColor: [
          theme.palette.success.dark,
          theme.palette.warning.dark,
          theme.palette.info.dark,
          theme.palette.error.dark
        ],
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw} commandes (${((context.raw / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
        }
      }
    },
    cutout: '65%'
  };

  return (
    <Box>
      <Box sx={{ height: 250 }}>
        <Doughnut data={data} options={options} />
      </Box>
      {periode && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          {periode} • Total: {data.datasets[0].data.reduce((a, b) => a + b, 0)} commandes
        </Typography>
      )}
    </Box>
  );
};

const TopProductsChart = ({ products, periode }) => {
  const theme = useTheme();
  
  // S'assurer que products est un tableau
  const topProducts = Array.isArray(products) ? 
    products.filter(p => p.total_vendu > 0).slice(0, 5) : [];
  
  if (topProducts.length === 0) {
    return (
      <Box sx={{ 
        height: 250, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: alpha(theme.palette.grey[300], 0.2),
        borderRadius: 1
      }}>
        <InventoryIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
        <Typography color="text.secondary" align="center">
          Aucun produit vendu
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
          Les produits apparaîtront après vos premières ventes
        </Typography>
      </Box>
    );
  }

  const data = {
    labels: topProducts.map(p => p.nom?.substring(0, 15) || `Produit ${p.id}`),
    datasets: [
      {
        label: 'Unités vendues',
        data: topProducts.map(p => p.total_vendu || 0),
        backgroundColor: [
          alpha(theme.palette.primary.main, 0.7),
          alpha(theme.palette.secondary.main, 0.7),
          alpha(theme.palette.success.main, 0.7),
          alpha(theme.palette.warning.main, 0.7),
          alpha(theme.palette.info.main, 0.7)
        ],
        borderColor: [
          theme.palette.primary.dark,
          theme.palette.secondary.dark,
          theme.palette.success.dark,
          theme.palette.warning.dark,
          theme.palette.info.dark
        ],
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw} unités`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        },
        title: {
          display: true,
          text: 'Unités vendues'
        }
      }
    }
  };

  return (
    <Box>
      <Box sx={{ height: 250 }}>
        <Bar data={data} options={options} />
      </Box>
      {periode && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          {periode} • Classement par unités vendues
        </Typography>
      )}
    </Box>
  );
};

const MetricCard = ({ title, value, icon, color, change, subtitle, onClick }) => {
  const theme = useTheme();
  
  const getChangeIcon = () => {
    if (change > 0) return <ArrowUpIcon fontSize="small" color="success" />;
    if (change < 0) return <ArrowDownIcon fontSize="small" color="error" />;
    return <FlatIcon fontSize="small" color="action" />;
  };

  const getChangeColor = () => {
    if (change > 0) return 'success.main';
    if (change < 0) return 'error.main';
    return 'text.secondary';
  };

  const getChangeText = () => {
    if (change === 0) return 'Stable';
    return `${change > 0 ? '+' : ''}${Math.abs(change).toFixed(1)}%`;
  };

  const getChangeTooltip = () => {
    if (change > 0) return `Augmentation de ${Math.abs(change).toFixed(1)}%`;
    if (change < 0) return `Diminution de ${Math.abs(change).toFixed(1)}%`;
    return 'Pas de changement';
  };

  return (
    <Card 
      sx={{ 
        height: '100%',
        background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
        border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        transition: 'transform 0.3s, box-shadow 0.3s',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          transform: onClick ? 'translateY(-4px)' : 'none',
          boxShadow: onClick ? theme.shadows[4] : 'none'
        }
      }}
      onClick={onClick}
      title={onClick ? `Cliquer pour filtrer par ${title.toLowerCase()}` : ''}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ mt: 1, mb: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
              {getChangeIcon()}
              <Typography 
                variant="caption" 
                color={getChangeColor()}
                sx={{ fontWeight: 600 }}
                title={getChangeTooltip()}
              >
                {getChangeText()}
              </Typography>
            </Stack>
          </Box>
          <Avatar 
            sx={{ 
              bgcolor: `${color}.main`,
              width: 56,
              height: 56,
              boxShadow: `0 4px 12px ${alpha(theme.palette[color].main, 0.3)}`
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

// ==================== WRAPPERS POUR LES DIALOGUES EXISTANTS ====================

// Wrapper pour le dialogue de commande
const DashboardOrderDialog = ({ open, onClose, onSuccess }) => {
  const handleSuccess = (commande) => {
    if (onSuccess) onSuccess(commande);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Nouvelle commande</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <OrderFormDialog 
          onClose={onClose}
          onSuccess={handleSuccess}
          embedded={true}
        />
      </DialogContent>
    </Dialog>
  );
};

// Wrapper pour le dialogue de contact
const DashboardContactDialog = ({ open, onClose, onSuccess }) => {
  const handleSuccess = (contact) => {
    if (onSuccess) onSuccess(contact);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Nouveau contact</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <ContactFormDialog 
          onClose={onClose}
          onSuccess={handleSuccess}
          embedded={true}
        />
      </DialogContent>
    </Dialog>
  );
};

// Wrapper pour le dialogue de produit
const DashboardProductDialog = ({ open, onClose, onSuccess }) => {
  const handleSuccess = (produit) => {
    if (onSuccess) onSuccess(produit);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Nouveau produit</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <ProductFormDialog 
          onClose={onClose}
          onSuccess={handleSuccess}
          embedded={true}
        />
      </DialogContent>
    </Dialog>
  );
};

// ==================== COMPOSANT PRINCIPAL ====================

export default function AdminDashboard() {
  const theme = useTheme();
  const { user, getUserRole, getUserSchema, hasPermission } = useAuth()
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState({ labels: [], values: [] });
  const [commandes, setCommandes] = useState([]);
  const [topProduits, setTopProduits] = useState([]);
  const [error, setError] = useState(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    periode: 'last30days',
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    statut: ''
  });
  const [revenueChartType, setRevenueChartType] = useState('line');
  const [revenuePeriod, setRevenuePeriod] = useState('daily');
  
  // États pour les dialogues d'actions rapides
  const [openNewOrderDialog, setOpenNewOrderDialog] = useState(false);
  const [openNewContactDialog, setOpenNewContactDialog] = useState(false);
  const [openNewProductDialog, setOpenNewProductDialog] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // États pour les notifications
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fonction pour afficher les notifications
  const showNotification = (message, severity = 'success') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  // Fonction pour formater les dates pour l'API
  const formatForAPI = (dateString) => {
    if (!dateString) return '';
    try {
      // Si la date est déjà au format yyyy-MM-dd, on la retourne
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      // Sinon, on tente de la parser et formater
      const date = parseISO(dateString);
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error('Erreur formatage date:', error);
      // Fallback: essayer de formater directement
      try {
        return format(new Date(dateString), 'yyyy-MM-dd');
      } catch (e) {
        return dateString;
      }
    }
  };

  // Fonction pour générer un rapport simple (fallback)
  const generateSimpleReport = () => {
    const now = new Date();
    return `
RAPPORT DASHBOARD - ${format(now, 'dd/MM/yyyy HH:mm')}
====================================================

Période: ${getPeriodeDisplay()}
${filters.statut ? `Statut filtré: ${filters.statut}` : ''}

MÉTRIQUES PRINCIPALES:
-----------------------
• Chiffre d'affaires: ${formatCurrency(stats?.chiffre_affaires || 0)}
• Commandes totales: ${stats?.total_commandes || 0}
• Panier moyen: ${formatCurrency(stats?.moyenne_commande || 0)}
• Clients actifs: ${stats?.clients_actifs || 0}

RÉPARTITION COMMANDES:
----------------------
• Livrées: ${stats?.livrees || 0}
• En cours: ${stats?.en_cours || 0}
• En attente: ${stats?.en_attente || 0}
• Annulées: ${stats?.annulees || 0}

TOP PRODUITS:
-------------
${topProduits.slice(0, 5).map((p, i) => 
  `${i + 1}. ${p.nom || 'Produit'}: ${p.total_vendu || 0} unités - ${formatCurrency(p.chiffre_produit || 0)}`
).join('\n') || 'Aucun produit vendu'}

DERNIÈRES COMMANDES:
--------------------
${commandes.slice(0, 5).map((cmd, i) => 
  `#${cmd.id}: ${cmd.contactNom || 'Client'} - ${formatCurrency(cmd.total || 0)} - ${cmd.statut || 'N/A'}`
).join('\n') || 'Aucune commande récente'}

Filtres appliqués: ${JSON.stringify(filters, null, 2)}

Généré automatiquement depuis le dashboard.
    `;
  };

  // Fonction pour télécharger le rapport
  const downloadReportAsPDF = (content) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `rapport-dashboard-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Fonction principale pour générer le rapport
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      // Construire les données du rapport
      const reportData = {
        periode: getPeriodeDisplay(),
        filters: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          statut: filters.statut,
          periode: filters.periode
        },
        metrics: {
          totalCA: stats?.chiffre_affaires || 0,
          totalCommandes: stats?.total_commandes || 0,
          moyennePanier: stats?.moyenne_commande || 0,
          clientsActifs: stats?.clients_actifs || 0,
          livrees: stats?.livrees || 0,
          enCours: stats?.en_cours || 0,
          enAttente: stats?.en_attente || 0,
          annulees: stats?.annulees || 0
        },
        topProduits: topProduits.slice(0, 5),
        commandesRecentes: commandes.slice(0, 5),
        revenueData: revenueData,
        generatedAt: new Date().toISOString()
      };
      
      console.log('📊 Génération rapport avec données:', reportData);
      
      // Option 1: Essayer l'API de génération de PDF
      try {
        const response = await securePost('/reports/generate-dashboard-report', reportData, {
          timeout: 30000
        });
        
        if (response.data && response.data.pdfUrl) {
          // Ouvrir le PDF généré
          const pdfUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${response.data.pdfUrl}`;
          window.open(pdfUrl, '_blank');
          showNotification('Rapport PDF généré avec succès !', 'success');
          return;
        }
      } catch (apiError) {
        console.log('API PDF non disponible, utilisation du fallback:', apiError.message);
      }
      
      // Option 2: Fallback - Générer un rapport texte
      const simpleReport = generateSimpleReport();
      downloadReportAsPDF(simpleReport);
      showNotification('Rapport texte généré (fallback)', 'info');
      
    } catch (err) {
      console.error('❌ Erreur génération rapport:', err);
      showNotification('Erreur lors de la génération du rapport', 'error');
      
      // Dernier fallback: message d'erreur
      alert('Impossible de générer le rapport. Veuillez réessayer plus tard.');
      
    } finally {
      setGeneratingReport(false);
    }
  };

  // Fonctions de callback pour les dialogues
  const handleOrderSuccess = (commande) => {
    showNotification(`Commande #${commande.id} créée avec succès !`, 'success');
    // Rafraîchir les stats après création
    setTimeout(() => {
      fetchStats();
      fetchCommandes();
    }, 1000);
  };

  const handleContactSuccess = (contact) => {
    showNotification(`Contact ${contact.nom} ${contact.prenom} créé avec succès !`, 'success');
    // Rafraîchir les stats après création
    setTimeout(() => {
      fetchStats();
    }, 1000);
  };

  const handleProductSuccess = (produit) => {
    showNotification(`Produit "${produit.nom}" créé avec succès !`, 'success');
    // Rafraîchir les stats après création
    setTimeout(() => {
      fetchStats();
      fetchCommandes();
    }, 1000);
  };

  const fetchStats = async (currentFilters = filters) => {
    setLoading(true);
    setError(null);
    
    try {
      // Construire les query params
      const params = new URLSearchParams();
      if (currentFilters.startDate) params.append('startDate', formatForAPI(currentFilters.startDate));
      if (currentFilters.endDate) params.append('endDate', formatForAPI(currentFilters.endDate));
      if (currentFilters.statut) params.append('statut', currentFilters.statut);

      /// Ajouter l'ID utilisateur et le schéma
      if (user) {
        params.append('userId', user.id);
        params.append('schema', getUserSchema());
      }
      
      const url = `/dashboard/stats?${params.toString()}`;
      console.log('📊 Fetching dashboard stats:', url);
      
      const statsRes = await secureGet(url);
      console.log('📊 Dashboard stats Response:', statsRes.data);
      
      if (statsRes.data.success) {
        const statsData = statsRes.data.data;
        
        // Normaliser les données
        const normalizedStats = {
          // Totaux
          total_contacts: statsData.total_contacts || 0,
          total_produits: statsData.total_produits || 0,
          total_commandes: statsData.total_commandes || 0,
          
          // Chiffre d'affaires (uniquement commandes livrées)
          chiffre_affaires: statsData.chiffre_affaires || 0,
          moyenne_commande: statsData.moyenne_commande || 0,
          evolution_mensuelle: statsData.evolution_mensuelle || 0,
          
          // Statuts commandes
          livrees: statsData.livrees || 0,
          en_cours: statsData.en_cours || 0,
          en_attente: statsData.en_attente || 0,
          annulees: statsData.annulees || 0,
          
          // Autres métriques
          clients_actifs: statsData.clients_actifs || 0,
          produits_stock_faible: statsData.produits_stock_faible || 0,
          
          // Top produits (ventes réelles)
          topProduits: Array.isArray(statsData.topProduits) ? statsData.topProduits : [],
          
          // Données pour graphiques
          revenue_data: statsData.revenue_data || { labels: [], values: [] }
        };
        
        setStats(normalizedStats);
        
        // Extraire les top produits
        if (Array.isArray(normalizedStats.topProduits)) {
          setTopProduits(normalizedStats.topProduits);
        } else {
          setTopProduits([]);
        }
        
        // Mettre à jour les données de revenue
        if (normalizedStats.revenue_data) {
          setRevenueData(normalizedStats.revenue_data);
        }
        
      } else {
        throw new Error(statsRes.data.error || 'Erreur lors du chargement des stats');
      }
      
    } catch (err) {
      console.error('❌ Erreur chargement stats dashboard:', err);
      setError('Impossible de charger les statistiques du dashboard');
      
      // Données vides par défaut
      setStats({
        total_commandes: 0,
        chiffre_affaires: 0,
        moyenne_commande: 0,
        livrees: 0,
        en_cours: 0,
        en_attente: 0,
        annulees: 0,
        clients_actifs: 0,
        produits_stock_faible: 0,
        total_contacts: 0,
        total_produits: 0,
        evolution_mensuelle: 0,
        topProduits: [],
        revenue_data: { labels: [], values: [] }
      });
      
      setRevenueData({ labels: [], values: [] });
      setTopProduits([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommandes = async (currentFilters = filters) => {
    try {
      // Construire les query params pour les commandes récentes
      const params = new URLSearchParams();
      params.append('limit', '5');
      if (currentFilters.startDate) params.append('startDate', formatForAPI(currentFilters.startDate));
      if (currentFilters.endDate) params.append('endDate', formatForAPI(currentFilters.endDate));
      if (currentFilters.statut) params.append('statut', currentFilters.statut);

      // Ajouter l'ID utilisateur
      if (user) {
        params.append('userId', user.id);
        params.append('schema', getUserSchema());
      }
      
      const response = await secureGet(`/commandes/recentes?limit=5&${params.toString()}`);
      console.log('📦 Commandes API Response:', res.data);
      
      if (res.data.success && Array.isArray(res.data.data)) {
        setCommandes(res.data.data);
      } else {
        setCommandes([]);
      }
      
    } catch (err) {
      console.error('❌ Erreur chargement commandes:', err);
      setCommandes([]);
    }
  };

  const fetchRevenueDetails = async (period = 'daily') => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', formatForAPI(filters.startDate));
      if (filters.endDate) params.append('endDate', formatForAPI(filters.endDate));
      if (filters.statut) params.append('statut', filters.statut);
      
      const url = `/api/stats/revenue-details?${params.toString()}`;
      const res = await secureGet(url);
      
      if (res.data.success && res.data.data) {
        if (period === 'daily') {
          setRevenueData(res.data.data.daily);
        } else {
          setRevenueData(res.data.data.monthly);
        }
      }
    } catch (err) {
      console.error('❌ Erreur chargement détails revenue:', err);
    }
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    fetchStats(newFilters);
    fetchCommandes(newFilters);
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      periode: 'last30days',
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      statut: ''
    };
    setFilters(defaultFilters);
    fetchStats(defaultFilters);
    fetchCommandes(defaultFilters);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchStats();
    fetchCommandes();
  };

  const handleRevenueChartTypeChange = (event, newType) => {
    if (newType !== null) {
      setRevenueChartType(newType);
    }
  };

  const handleRevenuePeriodChange = (event, newPeriod) => {
    if (newPeriod !== null) {
      setRevenuePeriod(newPeriod);
      fetchRevenueDetails(newPeriod);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCommandes();
  }, []);

  // Calculer l'évolution du CA
  const calculateRevenueEvolution = () => {
    return stats?.evolution_mensuelle || 0;
  };

  // Calculer l'évolution des commandes
  const calculateOrdersEvolution = () => {
    const totalCommandes = stats?.total_commandes || 0;
    // Pour l'exemple, on simule une évolution basée sur les commandes livrées
    const livrees = stats?.livrees || 0;
    const previousMonthLivrees = Math.max(0, livrees - Math.floor(livrees * 0.2));
    
    if (previousMonthLivrees > 0) {
      return ((livrees - previousMonthLivrees) / previousMonthLivrees) * 100;
    }
    return totalCommandes > 0 ? 100 : 0;
  };

  // Calculer l'évolution des clients
  const calculateClientsEvolution = () => {
    const clientsActifs = stats?.clients_actifs || 0;
    const previousClients = Math.max(0, clientsActifs - Math.floor(clientsActifs * 0.3));
    
    if (previousClients > 0) {
      return ((clientsActifs - previousClients) / previousClients) * 100;
    }
    return clientsActifs > 0 ? 100 : 0;
  };

  const getPeriodeDisplay = () => {
    if (filters.periode === 'custom' && filters.startDate && filters.endDate) {
      return `${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`;
    }
    
    const periodeLabels = {
      'today': "Aujourd'hui",
      'yesterday': 'Hier',
      'last7days': '7 derniers jours',
      'last30days': '30 derniers jours',
      'thismonth': 'Ce mois',
      'lastmonth': 'Mois dernier'
    };
    
    return periodeLabels[filters.periode] || 'Période';
  };

  const hasActiveFilters = () => {
    return filters.periode !== 'last30days' || filters.statut !== '';
  };

  const hasRevenueData = revenueData && revenueData.values && 
    revenueData.values.length > 0 && 
    revenueData.values.some(v => v > 0);

  const hasOrdersData = stats && stats.total_commandes > 0;

  if (error && !stats) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Erreur</AlertTitle>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => {
            setError(null);
            handleRefresh();
          }}
        >
          Réessayer
        </Button>
      </Box>
    );
  }

  if (loading && !stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Box textAlign="center">
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Chargement du tableau de bord...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* En-tête avec filtres */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold">
              Tableau de bord
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Vue d'ensemble de votre activité commerciale
              {hasActiveFilters() && (
                <Chip 
                  label={`Période: ${getPeriodeDisplay()}`}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ ml: 2 }}
                />
              )}
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2}>
            {hasActiveFilters() && (
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleResetFilters}
                disabled={loading}
              >
                Réinitialiser
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<FilterIcon />}
              onClick={() => setFilterDialogOpen(true)}
              sx={{
                background: hasActiveFilters() 
                  ? `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`
                  : undefined
              }}
              disabled={loading}
            >
              Filtres {hasActiveFilters() && '✓'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Actualiser
            </Button>
          </Stack>
        </Box>
        
        {/* Filtres actifs */}
        {hasActiveFilters() && (
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              mb: 2,
              bgcolor: alpha(theme.palette.info.main, 0.05),
              borderColor: alpha(theme.palette.info.main, 0.3)
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center">
                <DateRangeIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="body2">
                  Filtres actifs : {getPeriodeDisplay()}
                  {filters.statut && ` • Statut: ${filters.statut}`}
                </Typography>
              </Box>
              <Button 
                size="small" 
                onClick={handleResetFilters}
                startIcon={<CloseIcon />}
                disabled={loading}
              >
                Effacer
              </Button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* KPIs Principaux */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Chiffre d'affaires"
            value={formatCurrency(stats?.chiffre_affaires || 0)}
            icon={<MoneyIcon />}
            color="success"
            change={calculateRevenueEvolution()}
            subtitle={getPeriodeDisplay()}
            onClick={() => {
              setFilterDialogOpen(true);
              setFilters(prev => ({ ...prev, statut: 'livrée' }));
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Commandes totales"
            value={formatNumber(stats?.total_commandes || 0)}
            icon={<CartIcon />}
            color="primary"
            change={calculateOrdersEvolution()}
            subtitle={getPeriodeDisplay()}
            onClick={() => setFilterDialogOpen(true)}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Clients actifs"
            value={formatNumber(stats?.clients_actifs || 0)}
            icon={<PeopleIcon />}
            color="info"
            change={calculateClientsEvolution()}
            subtitle="Derniers 30 jours"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Panier moyen"
            value={formatCurrency(stats?.moyenne_commande || 0)}
            icon={<TrendingIcon />}
            color="warning"
            change={0}
            subtitle="Par commande livrée"
            onClick={() => {
              setFilterDialogOpen(true);
              setFilters(prev => ({ ...prev, statut: 'livrée' }));
            }}
          />
        </Grid>
      </Grid>

      {/* Graphiques principaux */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Graphique d'évolution des ventes */}
        <Grid item xs={12} md={8}>
          <Paper 
            sx={{ 
              p: 3, 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Évolution du chiffre d'affaires
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getPeriodeDisplay()}
                  {!hasRevenueData && !loading && ' • Aucune donnée'}
                </Typography>
              </Box>
              
              <Stack direction="row" spacing={1}>
                <ToggleButtonGroup
                  value={revenueChartType}
                  exclusive
                  onChange={handleRevenueChartTypeChange}
                  size="small"
                >
                  <ToggleButton value="line" title="Graphique en ligne">
                    <LineChartIcon />
                  </ToggleButton>
                  <ToggleButton value="bar" title="Graphique en barres">
                    <BarChartIcon />
                  </ToggleButton>
                </ToggleButtonGroup>
                
                <ToggleButtonGroup
                  value={revenuePeriod}
                  exclusive
                  onChange={handleRevenuePeriodChange}
                  size="small"
                >
                  <ToggleButton value="daily" title="Vue quotidienne">
                    30j
                  </ToggleButton>
                  <ToggleButton value="monthly" title="Vue mensuelle">
                    12m
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {hasRevenueData && (
                  <Chip 
                    label={`${calculateRevenueEvolution() >= 0 ? '+' : ''}${calculateRevenueEvolution().toFixed(1)}%`} 
                    color={calculateRevenueEvolution() >= 0 ? "success" : "error"} 
                    size="small"
                    icon={calculateRevenueEvolution() >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    title="Évolution mensuelle"
                  />
                )}
              </Stack>
            </Box>
            
            <RevenueChart 
              data={revenueData}
              periode={getPeriodeDisplay()}
              loading={loading}
              chartType={revenueChartType}
            />
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
              <Typography variant="caption" color="text.secondary">
                CA total sur la période: {formatCurrency(stats?.chiffre_affaires || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats?.livrees || 0} commandes livrées
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Graphique des statuts de commandes */}
        <Grid item xs={12} md={4}>
          <Paper 
            sx={{ 
              p: 3, 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}
          >
            <Typography variant="h6" fontWeight="bold" mb={3}>
              Répartition des commandes
              <Typography variant="body2" color="text.secondary">
                {getPeriodeDisplay()}
                {!hasOrdersData && ' • Aucune commande'}
              </Typography>
            </Typography>
            
            <OrdersStatusChart 
              stats={stats || {}} 
              periode={getPeriodeDisplay()}
            />
            
            <Stack spacing={1} mt={2}>
              {[
                { label: 'Livrées', value: stats?.livrees || 0, color: 'success', description: 'Ventes réalisées' },
                { label: 'En cours', value: stats?.en_cours || 0, color: 'warning', description: 'En préparation' },
                { label: 'En attente', value: stats?.en_attente || 0, color: 'info', description: 'À traiter' },
                { label: 'Annulées', value: stats?.annulees || 0, color: 'error', description: 'Commandes annulées' }
              ].map((item, index) => (
                <Box key={index} display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center">
                    <Box 
                      sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        bgcolor: `${item.color}.main`,
                        mr: 1 
                      }} 
                    />
                    <Box>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.description}
                      </Typography>
                    </Box>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2" fontWeight="bold">
                      {item.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({((item.value / ((stats?.total_commandes || 0) || 1)) * 100).toFixed(1)}%)
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Deuxième ligne de graphiques */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Top produits */}
        <Grid item xs={12} md={7}>
          <Paper 
            sx={{ 
              p: 3, 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Top produits les plus vendus
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Classement par unités vendues - {getPeriodeDisplay()}
                </Typography>
              </Box>
              <Chip 
                label={`${topProduits.filter(p => p.total_vendu > 0).length} produits actifs`} 
                size="small"
                variant="outlined"
              />
            </Box>
            
            <TopProductsChart 
              products={topProduits} 
              periode={getPeriodeDisplay()}
            />
            
            {topProduits.filter(p => p.total_vendu > 0).length > 0 && (
              <Grid container spacing={2} mt={2}>
                {topProduits.slice(0, 3).map((produit, index) => (
                  <Grid item xs={12} sm={4} key={produit.id || index}>
                    <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
                          width: 40,
                          height: 40,
                          mx: 'auto',
                          mb: 1
                        }}
                      >
                        {index + 1}
                      </Avatar>
                      <Typography variant="body2" fontWeight="medium" noWrap>
                        {produit.nom || `Produit ${index + 1}`}
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {produit.total_vendu || 0} unités
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatCurrency(produit.chiffre_produit || 0)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Prix: {formatCurrency(produit.prix || 0)}
                      </Typography>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
            
            {topProduits.filter(p => p.total_vendu > 0).length === 0 && (
              <Box textAlign="center" py={2}>
                <Typography variant="body2" color="text.secondary">
                  Aucun produit n'a été vendu sur cette période.
                </Typography>
                <Button 
                  size="small" 
                  variant="text" 
                  sx={{ mt: 1 }}
                  onClick={() => setOpenNewProductDialog(true)}
                >
                  Ajouter un produit
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Dernières commandes */}
        <Grid item xs={12} md={5}>
          <Paper 
            sx={{ 
              p: 3, 
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Dernières commandes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Les 5 commandes les plus récentes
                  {hasActiveFilters() && ` (filtrées)`}
                </Typography>
              </Box>
              <Button 
                size="small" 
                variant="outlined" 
                onClick={() => window.location.href = '/commandes'}
              >
                Voir tout
              </Button>
            </Box>
            
            <Stack spacing={2}>
              {commandes.map((cmd, index) => (
                <Paper 
                  key={cmd.id || index} 
                  variant="outlined" 
                  sx={{ 
                    p: 2,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        #{cmd.id || `CMD${index + 1}`}
                      </Typography>
                      <Typography variant="body2">
                        {cmd.contactNom ? `${cmd.contactNom} ${cmd.contactPrenom || ''}` : 
                         cmd.clientNom ? cmd.clientNom : `Client ${cmd.contact_id || 'Inconnu'}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cmd.date ? format(new Date(cmd.date), 'dd/MM/yyyy HH:mm') : 'Date inconnue'}
                      </Typography>
                    </Box>
                    <Box textAlign="right">
                      <StatusChip status={cmd.statut} />
                      <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                        {formatCurrency(cmd.total || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
              
              {commandes.length === 0 && (
                <Box textAlign="center" py={4}>
                  <CartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography color="text.secondary">
                    Aucune commande récente
                  </Typography>
                  {hasActiveFilters() && (
                    <Typography variant="caption" color="text.secondary">
                      (Essayez de modifier vos filtres)
                    </Typography>
                  )}
                  <Button 
                    size="small" 
                    variant="text" 
                    sx={{ mt: 1 }}
                    onClick={() => setOpenNewOrderDialog(true)}
                  >
                    Créer une commande
                  </Button>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* KPIs supplémentaires */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: 'info.main',
                width: 48,
                height: 48,
                mx: 'auto',
                mb: 1
              }}
            >
              <ShippingIcon />
            </Avatar>
            <Typography variant="h5">
              {stats?.en_cours || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Commandes en cours
            </Typography>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                color: 'warning.main',
                width: 48,
                height: 48,
                mx: 'auto',
                mb: 1
              }}
            >
              <InventoryIcon />
            </Avatar>
            <Typography variant="h5">
              {stats?.produits_stock_faible || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Produits stock faible
            </Typography>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: 'success.main',
                width: 48,
                height: 48,
                mx: 'auto',
                mb: 1
              }}
            >
              <CheckIcon />
            </Avatar>
            <Typography variant="h5">
              {((stats?.livrees || 0) / ((stats?.total_commandes || 0) || 1) * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Taux de livraison
            </Typography>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, textAlign: "center" }}>
            <Avatar 
              sx={{ 
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: 'error.main',
                width: 48,
                height: 48,
                mx: 'auto',
                mb: 1
              }}
            >
              <ErrorIcon />
            </Avatar>
            <Typography variant="h5">
              {((stats?.annulees || 0) / ((stats?.total_commandes || 0) || 1) * 100).toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Taux d'annulation
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Actions rapides */}
      <Paper 
        sx={{ 
          p: 3, 
          mt: 4,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}
      >
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Actions rapides
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="contained" 
              fullWidth
              startIcon={<CartIcon />}
              sx={{ py: 1.5 }}
              onClick={() => setOpenNewOrderDialog(true)}
            >
              Nouvelle commande
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="outlined" 
              fullWidth
              startIcon={<PeopleIcon />}
              sx={{ py: 1.5 }}
              onClick={() => setOpenNewContactDialog(true)}
            >
              Ajouter client
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="outlined" 
              fullWidth
              startIcon={<InventoryIcon />}
              sx={{ py: 1.5 }}
              onClick={() => setOpenNewProductDialog(true)}
            >
              Ajouter produit
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="outlined" 
              fullWidth
              startIcon={<PdfIcon />}
              sx={{ py: 1.5 }}
              onClick={handleGenerateReport}
              disabled={generatingReport}
            >
              {generatingReport ? (
                <CircularProgress size={20} />
              ) : (
                'Générer rapport'
              )}
            </Button>
          </Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Le rapport inclura les filtres actuellement appliqués: {getPeriodeDisplay()}
          {filters.statut && ` • Statut: ${filters.statut}`}
        </Typography>
      </Paper>

      {/* Dialogues d'actions rapides - Utilisant les mêmes composants que les pages */}
      <DashboardOrderDialog 
        open={openNewOrderDialog}
        onClose={() => setOpenNewOrderDialog(false)}
        onSuccess={handleOrderSuccess}
      />
      
      <DashboardContactDialog 
        open={openNewContactDialog}
        onClose={() => setOpenNewContactDialog(false)}
        onSuccess={handleContactSuccess}
      />
      
      <DashboardProductDialog 
        open={openNewProductDialog}
        onClose={() => setOpenNewProductDialog(false)}
        onSuccess={handleProductSuccess}
      />

      {/* Dialogue de filtres */}
      <FilterPanel
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <AlertComponent 
          severity={notification.severity}
          onClose={() => setNotification({ ...notification, open: false })}
        >
          {notification.message}
        </AlertComponent>
      </Snackbar>
    </Box>
  );
}
