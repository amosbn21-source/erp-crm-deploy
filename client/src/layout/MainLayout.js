// src/layout/MainLayout.jsx - Version avec bouton IA unique
import React, { useState, useEffect } from 'react'; // <-- AJOUTEZ useEffect
import iaService from '../services/api-ia'; // <-- AJOUTEZ cet import
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  AppBar,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  CssBaseline,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Fab,
  Chip,
  Alert,
  Snackbar,
  Button
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  Description as DescriptionIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
  AccountCircle as AccountCircleIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Help as HelpIcon,
  Person as PersonIcon,
  // ICÔNES IA
  SmartToy as AIIcon,
  Chat as ChatIcon,
  Psychology as PsychologyIcon,
  Analytics as AnalyticsIcon,
  AutoAwesome as AutoAwesomeIcon,
  Bolt as BoltIcon,
  TrendingUp as TrendingUpIcon,
  RocketLaunch as RocketLaunchIcon,
  Close as CloseIcon,
  ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';

const drawerWidth = 260;

export default function MainLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [iaMenuAnchorEl, setIaMenuAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchIaStats();
    const interval = setInterval(fetchIaStats, 30000); // Rafraîchir toutes les 30s
    return () => clearInterval(interval);
  }, []);

  // Dans MainLayout.js, modifiez la fonction fetchIaStats :
  const fetchIaStats = async () => {
    try {
      const response = await iaService.getStats();
      if (response.success && response.stats) {
        setIaStats({
          conversations: response.stats.total_conversations || 0,
          intents: response.stats.orders_converted || 0,
          conversions: response.stats.active_rules || 0,
          performance: response.stats.avg_intent_confidence * 100 || 0
        });
      }
    } catch (error) {
      console.error('Erreur stats IA:', error);
    }
  };

  // État pour les stats IA
  const [iaStats, setIaStats] = useState({
    conversations: 15,
    intents: 3,
    conversions: 8,
    performance: 92
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleIaMenuOpen = (event) => {
    setIaMenuAnchorEl(event.currentTarget);
  };

  const handleIaMenuClose = () => {
    setIaMenuAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const mainMenuItems = [
    { 
      text: 'Tableau de bord', 
      icon: <DashboardIcon />, 
      path: '/dashboard',
      description: 'Vue d\'ensemble'
    },
    { 
      text: 'Contacts', 
      icon: <PeopleIcon />, 
      path: '/contacts',
      description: 'Gestion des clients'
    },
    { 
      text: 'Produits', 
      icon: <InventoryIcon />, 
      path: '/produits',
      description: 'Catalogue et stocks'
    },
    { 
      text: 'Commandes', 
      icon: <ShoppingCartIcon />, 
      path: '/commandes',
      description: 'Ventes et facturation'
    },
    { 
      text: 'Documents', 
      icon: <DescriptionIcon />, 
      path: '/documents',
      description: 'Devis et factures'
    },
  ];

  // MENU IA - 6 options comme demandé
  const iaMenuItems = [
    { 
      text: '🤖 Dashboard IA', 
      icon: <AIIcon sx={{ color: '#7C3AED' }} />, 
      path: '/ia/dashboard',
      description: 'Tableau de bord intelligent',
      badge: 'Nouveau'
    },
    { 
      text: '💬 Chat IA', 
      icon: <ChatIcon sx={{ color: '#10B981' }} />, 
      path: '/ia/chat',
      description: 'Assistant conversationnel'
    },
    { 
      text: '🎯 Intentions d\'achat', 
      icon: <PsychologyIcon sx={{ color: '#F59E0B' }} />, 
      path: '/ia/intents',
      description: 'Opportunités détectées',
      badge: iaStats.intents > 0 ? `${iaStats.intents} nouvelles` : null
    },
    { 
      text: '⚡ Règles métier', 
      icon: <BoltIcon sx={{ color: '#EC4899' }} />, 
      path: '/ia/rules',
      description: 'Automatisations intelligentes'
    },
    { 
      text: '📊 Analytics IA', 
      icon: <AnalyticsIcon sx={{ color: '#3B82F6' }} />, 
      path: '/ia/analytics',
      description: 'Statistiques avancées'
    },
    { 
      text: '🚀 Apprentissage', 
      icon: <RocketLaunchIcon sx={{ color: '#8B5CF6' }} />, 
      path: '/ia/learning',
      description: 'Amélioration continue'
    },
  ];

  const settingsMenuItems = [
    { 
      text: 'Paramètres', 
      icon: <SettingsIcon />, 
      path: '/settings'
    },
    { 
      text: 'Aide & Support', 
      icon: <HelpIcon />, 
      path: '/help'
    },
  ];

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* En-tête du drawer */}
      <Toolbar sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        px: 2,
        minHeight: '64px !important'
      }}>
        <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
          ERP-CRM
        </Typography>
        {!isMobile && (
          <IconButton onClick={handleDrawerToggle} size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />

      {/* Menu principal */}
      <List sx={{ flexGrow: 1 }}>
        {mainMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.text}
              component={Link}
              to={item.path}
              onClick={isMobile ? handleDrawerToggle : undefined}
              sx={{
                mb: 0.5,
                mx: 1,
                borderRadius: 1,
                backgroundColor: isActive ? 'primary.main' : 'transparent',
                color: isActive ? 'primary.contrastText' : 'inherit',
                '&:hover': {
                  backgroundColor: isActive ? 'primary.dark' : 'action.hover',
                },
                '& .MuiListItemIcon-root': {
                  color: isActive ? 'primary.contrastText' : 'inherit',
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText 
                primary={item.text}
                secondary={item.description}
                secondaryTypographyProps={{
                  sx: {
                    fontSize: '0.75rem',
                    color: isActive ? 'primary.contrastText' : 'text.secondary',
                    opacity: 0.8
                  }
                }}
              />
            </ListItemButton>
          );
        })}
        
        {/* Bouton IA unique */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AIIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={handleIaMenuOpen}
            sx={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              py: 1.5,
              bgcolor: '#7C3AED',
              '&:hover': {
                bgcolor: '#6D28D9',
              },
              fontWeight: 'bold',
              fontSize: '0.95rem'
            }}
          >
            Assistant IA
            {iaStats.intents > 0 && (
              <Chip 
                label={iaStats.intents} 
                size="small" 
                sx={{ 
                  ml: 'auto',
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: 'white',
                  color: '#7C3AED'
                }}
              />
            )}
          </Button>
          
          {/* Menu déroulant IA */}
          <Menu
            anchorEl={iaMenuAnchorEl}
            open={Boolean(iaMenuAnchorEl)}
            onClose={handleIaMenuClose}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 280,
                maxHeight: 400,
                overflow: 'auto'
              }
            }}
          >
            <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="bold" color="primary">
                🤖 INTELLIGENCE ARTIFICIELLE
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Assistant CRM intelligent
              </Typography>
            </Box>
            
            {iaMenuItems.map((item) => (
              <MenuItem
                key={item.text}
                onClick={() => {
                  handleIaMenuClose();
                  navigate(item.path);
                  if (isMobile) handleDrawerToggle();
                }}
                sx={{
                  py: 1.5,
                  borderLeft: 3,
                  borderLeftColor: 'transparent',
                  '&:hover': {
                    borderLeftColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2">
                    {item.text}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {item.description}
                  </Typography>
                </Box>
                {item.badge && (
                  <Chip 
                    label={item.badge} 
                    size="small" 
                    sx={{ 
                      ml: 1,
                      height: 18,
                      fontSize: '0.6rem',
                      bgcolor: item.badge.includes('nouvelles') ? 'warning.main' : 'primary.light',
                      color: 'white'
                    }}
                  />
                )}
              </MenuItem>
            ))}
            
            <Divider sx={{ my: 1 }} />
            
            <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="textSecondary">
                📊 Performance IA: {iaStats.performance}%
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="textSecondary">
                  💬 {iaStats.conversations} conv
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  🎯 {iaStats.intents} intentions
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  💰 {iaStats.conversions} ventes
                </Typography>
              </Box>
            </Box>
          </Menu>
        </Box>
      </List>

      {/* Section utilisateur en bas */}
      <Box sx={{ mt: 'auto', borderTop: 1, borderColor: 'divider' }}>
        <ListItemButton 
          onClick={() => navigate('/profile')}
          sx={{ 
            p: 2,
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <ListItemIcon>
            <Avatar 
              sx={{ 
                width: 36, 
                height: 36, 
                bgcolor: 'secondary.main',
                fontSize: '1rem'
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
          </ListItemIcon>
          <ListItemText 
            primary={user?.name || user?.username || 'Utilisateur'}
            secondary={user?.email || user?.role || 'Compte'}
            primaryTypographyProps={{ fontWeight: 'medium' }}
            secondaryTypographyProps={{ 
              sx: { 
                fontSize: '0.75rem',
                cursor: 'pointer',
                '&:hover': {
                  textDecoration: 'underline'
                }
              } 
            }}
          />
          {iaStats.intents > 0 && (
            <Chip 
              label={iaStats.intents} 
              size="small" 
              sx={{ 
                height: 20,
                fontSize: '0.7rem',
                bgcolor: 'warning.main',
                color: 'white'
              }}
            />
          )}
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { sm: 'none' },
              color: 'primary.main'
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              color: 'primary.main',
              fontWeight: 600
            }}
          >
            ERP-CRM
          </Typography>
          
          {/* Bouton IA dans l'AppBar (visible sur desktop) */}
          {!isMobile && (
            <Tooltip title="Assistant IA">
              <Button
                variant="outlined"
                startIcon={<AIIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={handleIaMenuOpen}
                sx={{
                  mr: 2,
                  borderColor: '#7C3AED',
                  color: '#7C3AED',
                  '&:hover': {
                    borderColor: '#6D28D9',
                    bgcolor: '#F3F0FF'
                  }
                }}
              >
                IA
                {iaStats.intents > 0 && (
                  <Chip 
                    label={iaStats.intents} 
                    size="small" 
                    sx={{ 
                      ml: 1,
                      height: 20,
                      fontSize: '0.7rem',
                      bgcolor: 'warning.main',
                      color: 'white'
                    }}
                  />
                )}
              </Button>
            </Tooltip>
          )}
          
          {/* Bouton Notifications */}
          <Tooltip title="Notifications">
            <IconButton color="inherit" sx={{ mr: 1 }}>
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          
          {/* Menu utilisateur */}
          <Tooltip title="Menu utilisateur">
            <IconButton 
              onClick={handleMenuOpen}
              sx={{ 
                p: 0.5,
                border: 2,
                borderColor: iaStats.intents > 0 ? 'warning.main' : 'transparent',
                '&:hover': {
                  borderColor: 'primary.main'
                }
              }}
            >
              <Avatar 
                sx={{ 
                  width: 36, 
                  height: 36, 
                  bgcolor: 'primary.main',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              sx: {
                mt: 1.5,
                minWidth: 200
              }
            }}
          >
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {user?.name || user?.username}
                </Typography>
                <Typography 
                  variant="caption" 
                  color="textSecondary"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  {user?.email || 'Utilisateur'}
                </Typography>
                {iaStats.intents > 0 && (
                  <Chip 
                    label={`${iaStats.intents} opportunités`} 
                    size="small" 
                    sx={{ 
                      mt: 0.5,
                      height: 16,
                      fontSize: '0.55rem',
                      bgcolor: 'warning.light'
                    }}
                  />
                )}
              </Box>
            </MenuItem>
            <Divider />
            
            {/* Option IA dans le menu utilisateur */}
            <MenuItem onClick={() => { 
              handleMenuClose(); 
              handleIaMenuOpen({ currentTarget: document.querySelector('[aria-label="Assistant IA"]') }); 
            }}>
              <ListItemIcon>
                <AIIcon fontSize="small" sx={{ color: '#7C3AED' }} />
              </ListItemIcon>
              Assistant IA
              {iaStats.intents > 0 && (
                <Chip 
                  label={iaStats.intents} 
                  size="small" 
                  sx={{ 
                    ml: 'auto',
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: 'warning.main',
                    color: 'white'
                  }}
                />
              )}
            </MenuItem>
            
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Mon Profil
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Paramètres
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Déconnexion
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer (Sidebar) */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                bgcolor: 'background.paper'
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                borderRight: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper'
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Contenu principal */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'grey.50'
        }}
      >
        <Toolbar /> {/* Espace pour l'AppBar */}
        
        {/* Outlet affiche les pages enfant */}
        <Outlet />
        
        {/* Bouton IA flottant pour mobile */}
        {isMobile && (
          <Fab
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              bgcolor: '#7C3AED',
              '&:hover': { bgcolor: '#6D28D9' }
            }}
            onClick={handleIaMenuOpen}
          >
            <AIIcon />
            {iaStats.intents > 0 && (
              <Badge 
                badgeContent={iaStats.intents} 
                color="error"
                sx={{
                  position: 'absolute',
                  top: -5,
                  right: -5
                }}
              />
            )}
          </Fab>
        )}
      </Box>

      {/* Menu IA dans l'AppBar (pour desktop) */}
      <Menu
        anchorEl={iaMenuAnchorEl}
        open={Boolean(iaMenuAnchorEl) && !isMobile}
        onClose={handleIaMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            maxHeight: 400,
            overflow: 'auto'
          }
        }}
      >
        <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight="bold" color="primary">
            🤖 INTELLIGENCE ARTIFICIELLE
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Assistant CRM intelligent
          </Typography>
        </Box>
        
        {iaMenuItems.map((item) => (
          <MenuItem
            key={item.text}
            onClick={() => {
              handleIaMenuClose();
              navigate(item.path);
            }}
            sx={{
              py: 1.5,
              borderLeft: 3,
              borderLeftColor: 'transparent',
              '&:hover': {
                borderLeftColor: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2">
                {item.text}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {item.description}
              </Typography>
            </Box>
            {item.badge && (
              <Chip 
                label={item.badge} 
                size="small" 
                sx={{ 
                  ml: 1,
                  height: 18,
                  fontSize: '0.6rem',
                  bgcolor: item.badge.includes('nouvelles') ? 'warning.main' : 'primary.light',
                  color: 'white'
                }}
              />
            )}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}