// Fichier: src/pages/IARulesPage.jsx
import React, { useState, useEffect } from 'react';
import {
    Container,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Grid,
    Card,
    CardContent,
    Alert,
    Switch,
    FormControlLabel,
    Tabs,
    Tab
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    PlayArrow as PlayIcon,
    Rule as RuleIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { iaService } from '../services/api-ia';
import { useSnackbar } from 'notistack';

const IARulesPage = () => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const { enqueueSnackbar } = useSnackbar();
    
    const [formData, setFormData] = useState({
        rule_name: '',
        conditions: {
            message_contains: '',
            intent_type: '',
            client_category: '',
            time_of_day: ''
        },
        actions: {
            respond_with: '',
            apply_discount: '',
            create_order: false,
            escalate: false
        },
        priority: 50,
        scope: 'global',
        target: '',
        is_active: true
    });

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            setLoading(true);
            const response = await iaService.getRules();
            if (response.success) {
                setRules(response.rules);
            }
        } catch (error) {
            console.error('Erreur chargement règles:', error);
            enqueueSnackbar('Erreur chargement règles', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (rule = null) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({
                rule_name: rule.rule_name,
                conditions: rule.conditions || {},
                actions: rule.actions || {},
                priority: rule.priority,
                scope: rule.scope,
                target: rule.target_contact_id || rule.target_category || '',
                is_active: rule.is_active
            });
        } else {
            setEditingRule(null);
            setFormData({
                rule_name: '',
                conditions: {
                    message_contains: '',
                    intent_type: '',
                    client_category: '',
                    time_of_day: ''
                },
                actions: {
                    respond_with: '',
                    apply_discount: '',
                    create_order: false,
                    escalate: false
                },
                priority: 50,
                scope: 'global',
                target: '',
                is_active: true
            });
        }
        setOpenDialog(true);
    };

    const handleSubmit = async () => {
        try {
            const ruleData = {
                rule_name: formData.rule_name,
                conditions: formData.conditions,
                actions: formData.actions,
                priority: formData.priority,
                scope: formData.scope,
                target: formData.target
            };

            if (editingRule) {
                await iaService.updateRule(editingRule.id, ruleData);
                enqueueSnackbar('Règle mise à jour', { variant: 'success' });
            } else {
                await iaService.createRule(ruleData);
                enqueueSnackbar('Règle créée', { variant: 'success' });
            }

            setOpenDialog(false);
            loadRules();
            
        } catch (error) {
            console.error('Erreur sauvegarde règle:', error);
            enqueueSnackbar('Erreur sauvegarde règle', { variant: 'error' });
        }
    };

    const handleDelete = async (ruleId) => {
        if (window.confirm('Supprimer cette règle ?')) {
            try {
                await iaService.deleteRule(ruleId);
                enqueueSnackbar('Règle supprimée', { variant: 'success' });
                loadRules();
            } catch (error) {
                console.error('Erreur suppression règle:', error);
                enqueueSnackbar('Erreur suppression règle', { variant: 'error' });
            }
        }
    };

    const toggleRuleStatus = async (ruleId, currentStatus) => {
        try {
            await iaService.updateRule(ruleId, { is_active: !currentStatus });
            enqueueSnackbar('Statut mis à jour', { variant: 'success' });
            loadRules();
        } catch (error) {
            console.error('Erreur changement statut:', error);
            enqueueSnackbar('Erreur changement statut', { variant: 'error' });
        }
    };

    const renderConditionChip = (condition) => {
        if (!condition) return null;
        
        return Object.entries(condition).map(([key, value]) => (
            <Chip
                key={key}
                label={`${key}: ${value}`}
                size="small"
                sx={{ mr: 1, mb: 1 }}
            />
        ));
    };

    const renderActionChip = (action) => {
        if (!action) return null;
        
        return Object.entries(action).map(([key, value]) => (
            <Chip
                key={key}
                label={`${key}: ${value}`}
                size="small"
                sx={{ mr: 1, mb: 1 }}
                color="primary"
                variant="outlined"
            />
        ));
    };

    const activeRules = rules.filter(r => r.is_active);
    const inactiveRules = rules.filter(r => !r.is_active);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    <RuleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Règles Métier IA
                </Typography>
                <Box>
                    <IconButton onClick={loadRules} sx={{ mr: 1 }}>
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog()}
                    >
                        Nouvelle Règle
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Comment fonctionnent les règles ?
                            </Typography>
                            <Typography variant="body2" paragraph>
                                Les règles permettent de personnaliser automatiquement les réponses de l'IA.
                                Exemple : "SI le message contient 'prix' ET le client est 'VIP' ALORS répondre avec une remise de 15%".
                            </Typography>
                            <Alert severity="info">
                                Les règles sont exécutées par ordre de priorité (plus haut = plus prioritaire)
                            </Alert>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Paper sx={{ mb: 2 }}>
                        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                            <Tab label={`Actives (${activeRules.length})`} />
                            <Tab label={`Inactives (${inactiveRules.length})`} />
                        </Tabs>
                    </Paper>
                    
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nom</TableCell>
                                    <TableCell>Conditions</TableCell>
                                    <TableCell>Actions</TableCell>
                                    <TableCell>Priorité</TableCell>
                                    <TableCell>Portée</TableCell>
                                    <TableCell>Statut</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(activeTab === 0 ? activeRules : inactiveRules).map((rule) => (
                                    <TableRow key={rule.id}>
                                        <TableCell>
                                            <Typography fontWeight="bold">
                                                {rule.rule_name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Utilisations: {rule.usage_count}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                                                {renderConditionChip(rule.conditions)}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                                                {renderActionChip(rule.actions)}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={rule.priority}
                                                color={
                                                    rule.priority >= 80 ? 'error' :
                                                    rule.priority >= 60 ? 'warning' : 'default'
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={rule.scope}
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={rule.is_active}
                                                        onChange={() => toggleRuleStatus(rule.id, rule.is_active)}
                                                    />
                                                }
                                                label={rule.is_active ? 'Actif' : 'Inactif'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleOpenDialog(rule)}
                                            >
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleDelete(rule.id)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
            </Grid>

            {/* Dialog création/édition */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {editingRule ? 'Modifier la règle' : 'Nouvelle règle'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Nom de la règle"
                                value={formData.rule_name}
                                onChange={(e) => setFormData({...formData, rule_name: e.target.value})}
                                required
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom>
                                Conditions
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Message contient"
                                        value={formData.conditions.message_contains}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            conditions: {
                                                ...formData.conditions,
                                                message_contains: e.target.value
                                            }
                                        })}
                                        placeholder="ex: prix, commande, urgent"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Type d'intention</InputLabel>
                                        <Select
                                            value={formData.conditions.intent_type}
                                            label="Type d'intention"
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                conditions: {
                                                    ...formData.conditions,
                                                    intent_type: e.target.value
                                                }
                                            })}
                                        >
                                            <MenuItem value="">Tous</MenuItem>
                                            <MenuItem value="purchase">Achat</MenuItem>
                                            <MenuItem value="product">Produit</MenuItem>
                                            <MenuItem value="price">Prix</MenuItem>
                                            <MenuItem value="document">Document</MenuItem>
                                            <MenuItem value="hours">Horaires</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Catégorie client"
                                        value={formData.conditions.client_category}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            conditions: {
                                                ...formData.conditions,
                                                client_category: e.target.value
                                            }
                                        })}
                                        placeholder="ex: VIP, standard, nouveau"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Heure de la journée"
                                        value={formData.conditions.time_of_day}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            conditions: {
                                                ...formData.conditions,
                                                time_of_day: e.target.value
                                            }
                                        })}
                                        placeholder="ex: business_hours, after_hours"
                                    />
                                </Grid>
                            </Grid>
                        </Grid>

                        <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom>
                                Actions
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        label="Réponse personnalisée"
                                        value={formData.actions.respond_with}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            actions: {
                                                ...formData.actions,
                                                respond_with: e.target.value
                                            }
                                        })}
                                        placeholder="Message de réponse spécifique"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Remise (%)"
                                        type="number"
                                        value={formData.actions.apply_discount}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            actions: {
                                                ...formData.actions,
                                                apply_discount: e.target.value
                                            }
                                        })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.actions.create_order}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    actions: {
                                                        ...formData.actions,
                                                        create_order: e.target.checked
                                                    }
                                                })}
                                            />
                                        }
                                        label="Créer commande auto"
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.actions.escalate}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    actions: {
                                                        ...formData.actions,
                                                        escalate: e.target.checked
                                                    }
                                                })}
                                            />
                                        }
                                        label="Escalade vers humain"
                                    />
                                </Grid>
                            </Grid>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Priorité (1-100)"
                                type="number"
                                value={formData.priority}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    priority: parseInt(e.target.value) || 50
                                })}
                                inputProps={{ min: 1, max: 100 }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Portée</InputLabel>
                                <Select
                                    value={formData.scope}
                                    label="Portée"
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        scope: e.target.value,
                                        target: ''
                                    })}
                                >
                                    <MenuItem value="global">Global</MenuItem>
                                    <MenuItem value="category">Par catégorie</MenuItem>
                                    <MenuItem value="contact">Par contact</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {formData.scope !== 'global' && (
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={
                                        formData.scope === 'category' ? 
                                        'Catégorie cible' : 
                                        'ID Contact cible'
                                    }
                                    value={formData.target}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        target: e.target.value
                                    })}
                                    required
                                />
                            </Grid>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Annuler</Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSubmit}
                        disabled={!formData.rule_name.trim()}
                    >
                        {editingRule ? 'Mettre à jour' : 'Créer'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default IARulesPage;