import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Chat as ChatIcon,
  Psychology as PsychologyIcon,
  Bolt as BoltIcon
} from '@mui/icons-material';
import iaService from '../../services/api-ia';

export default function IAAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await iaService.getStats();
      if (response.success) {
        setStats(response);
      } else {
        setError(response.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Erreur analytics:', error);
      setError('Impossible de charger les analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!stats) {
    return null;
  }

  const performanceScore = stats.stats.avg_intent_confidence * 100;
  const conversionRate = stats.stats.orders_converted / Math.max(stats.stats.total_conversations, 1) * 100;

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          📊 Analytics IA
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Statistiques et performances de votre IA
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance globale
              </Typography>
              
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Précision des réponses</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {performanceScore.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={performanceScore} 
                  sx={{ height: 10, borderRadius: 5, mb: 2 }}
                  color={performanceScore >= 80 ? "success" : performanceScore >= 60 ? "warning" : "error"}
                />
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Taux de conversion</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {conversionRate.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={conversionRate} 
                  sx={{ height: 10, borderRadius: 5, mb: 2 }}
                  color={conversionRate >= 20 ? "success" : conversionRate >= 10 ? "warning" : "error"}
                />
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Règles actives</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats.stats.active_rules} / {stats.stats.active_rules + 5}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(stats.stats.active_rules / (stats.stats.active_rules + 5)) * 100} 
                  sx={{ height: 10, borderRadius: 5 }}
                  color="primary"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Métriques clés
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <ChatIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${stats.stats.total_conversations} conversations analysées`}
                    secondary="Total depuis le début"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <PsychologyIcon color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${stats.stats.orders_converted} ventes générées`}
                    secondary="Par l'intelligence artificielle"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <BoltIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${stats.stats.active_rules} règles actives`}
                    secondary="Automatisations en fonctionnement"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="info" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${stats.stats.clients_profiled} clients profilés`}
                    secondary="Analysés comportementalement"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {stats.recent_activity && stats.recent_activity.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Activité récente (7 derniers jours)
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell><strong>Conversations</strong></TableCell>
                        <TableCell><strong>Réponses automatisées</strong></TableCell>
                        <TableCell><strong>Taux d'automatisation</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.recent_activity.map((day, index) => (
                        <TableRow key={index}>
                          <TableCell>{day.date}</TableCell>
                          <TableCell>{day.conversations}</TableCell>
                          <TableCell>{day.rule_based_responses}</TableCell>
                          <TableCell>
                            <LinearProgress 
                              variant="determinate" 
                              value={(day.rule_based_responses / Math.max(day.conversations, 1)) * 100}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="caption">
                              {Math.round((day.rule_based_responses / Math.max(day.conversations, 1)) * 100)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}