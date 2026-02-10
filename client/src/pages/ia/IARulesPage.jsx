import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardHeader, 
  CardActions,
  Button,
  Switch,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import { 
  Bolt as BoltIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import iaService from '../../services/api-ia';

export default function IARulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    rule_name: '',
    conditions: [{ field: '', operator: '', value: '' }],
    actions: [{ type: '', value: '' }],
    priority: 50,
    scope: 'global',
    target: ''
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await iaService.getRules();
      if (response.success) {
        setRules(response.rules);
      } else {
        setError(response.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Erreur règles:', error);
      setError('Impossible de charger les règles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    try {
      const response = await iaService.createRule(formData);
      if (response.success) {
        fetchRules();
        setDialogOpen(false);
        resetForm();
      } else {
        setError(response.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur création règle:', error);
      setError('Erreur lors de la création');
    }
  };

  const handleUpdateRule = async (ruleId, updates) => {
    try {
      const response = await iaService.updateRule(ruleId, updates);
      if (response.success) {
        fetchRules();
      } else {
        setError(response.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur mise à jour règle:', error);
      setError('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) {
      try {
        const response = await iaService.deleteRule(ruleId);
        if (response.success) {
          fetchRules();
        } else {
          setError(response.error || 'Erreur lors de la suppression');
        }
      } catch (error) {
        console.error('Erreur suppression règle:', error);
        setError('Erreur lors de la suppression');
      }
    }
  };

  const handleToggleRule = (ruleId, isActive) => {
    handleUpdateRule(ruleId, { is_active: !isActive });
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      conditions: [{ field: '', operator: '', value: '' }],
      actions: [{ type: '', value: '' }],
      priority: 50,
      scope: 'global',
      target: ''
    });
    setEditingRule(null);
  };

  const handleOpenDialog = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        rule_name: rule.rule_name,
        conditions: rule.conditions,
        actions: rule.actions,
        priority: rule.priority,
        scope: rule.scope,
        target: rule.target_contact_id || rule.target_category || ''
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              ⚡ Règles métier
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Automatisations intelligentes ({rules.filter(r => r.is_active).length} actives)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              startIcon={<RefreshIcon />}
              onClick={fetchRules}
              variant="outlined"
            >
              Actualiser
            </Button>
            <Button 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              variant="contained"
            >
              Nouvelle règle
            </Button>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {rules.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="textSecondary">
                  Aucune règle configurée. Créez votre première règle !
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          rules.map((rule) => (
            <Grid item xs={12} md={6} key={rule.id}>
              <Card sx={{ 
                borderLeft: 4, 
                borderLeftColor: rule.is_active ? 'primary.main' : 'grey.400',
                height: '100%'
              }}>
                <CardHeader
                  avatar={<BoltIcon sx={{ color: rule.is_active ? '#EC4899' : 'grey.500' }} />}
                  title={rule.rule_name}
                  subheader={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip 
                        label={rule.is_active ? 'ACTIVE' : 'INACTIVE'} 
                        size="small"
                        color={rule.is_active ? 'success' : 'default'}
                      />
                      <Typography variant="caption">
                        Priorité: {rule.priority} | Scope: {rule.scope}
                      </Typography>
                    </Box>
                  }
                  action={
                    <Switch 
                      checked={rule.is_active} 
                      onChange={() => handleToggleRule(rule.id, rule.is_active)}
                    />
                  }
                />
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Conditions:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {JSON.stringify(rule.conditions, null, 2)}
                  </Typography>
                  
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Actions:
                  </Typography>
                  <Typography variant="body2">
                    {JSON.stringify(rule.actions, null, 2)}
                  </Typography>
                  
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={`Utilisée ${rule.usage_count || 0} fois`} 
                      size="small"
                      variant="outlined"
                    />
                    <Chip 
                      label={`Succès: ${rule.success_rate || 0}%`} 
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenDialog(rule)}
                  >
                    Modifier
                  </Button>
                  <Button 
                    size="small" 
                    startIcon={<DeleteIcon />} 
                    color="error"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    Supprimer
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog création/modification règle */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRule ? 'Modifier la règle' : 'Créer une nouvelle règle'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de la règle"
            fullWidth
            value={formData.rule_name}
            onChange={(e) => setFormData({...formData, rule_name: e.target.value})}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel>Scope</InputLabel>
            <Select
              value={formData.scope}
              onChange={(e) => setFormData({...formData, scope: e.target.value})}
              label="Scope"
            >
              <MenuItem value="global">Global</MenuItem>
              <MenuItem value="contact">Par contact</MenuItem>
              <MenuItem value="category">Par catégorie</MenuItem>
            </Select>
          </FormControl>
          
          {formData.scope !== 'global' && (
            <TextField
              margin="dense"
              label={formData.scope === 'contact' ? 'ID Contact' : 'Catégorie'}
              fullWidth
              value={formData.target}
              onChange={(e) => setFormData({...formData, target: e.target.value})}
              sx={{ mb: 2 }}
            />
          )}
          
          <TextField
            margin="dense"
            label="Priorité (1-100)"
            type="number"
            fullWidth
            value={formData.priority}
            onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
            inputProps={{ min: 1, max: 100 }}
            sx={{ mb: 3 }}
          />
          
          <Divider sx={{ my: 2 }}>Conditions</Divider>
          {/* Ici vous pourriez ajouter un éditeur JSON ou un formulaire pour les conditions */}
          
          <Divider sx={{ my: 2 }}>Actions</Divider>
          {/* Ici vous pourriez ajouter un éditeur JSON ou un formulaire pour les actions */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button onClick={editingRule ? () => handleUpdateRule(editingRule.id, formData) : handleCreateRule} variant="contained">
            {editingRule ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}