import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import {
  SmartToy as AIIcon,
  TrendingUp,
  Psychology,
  Bolt,
  Analytics,
  RocketLaunch,
  Chat as ChatIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import iaService from '../../services/api-ia';

export default function IADashboard() {
  const [stats, setStats] = useState({
    total_conversations: 0,
    orders_converted: 0,
    active_rules: 0,
    avg_intent_confidence: 0,
    clients_profiled: 0,
    recent_activity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchIaStats();
  }, []);

  const fetchIaStats = async () => {
    try {
      const response = await iaService.getStats();
      if (response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Erreur stats IA:', error);
      setError('Impossible de charger les statistiques IA');
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
        <Typography variant="h4" gutterBottom color="error">
          Erreur
        </Typography>
        <Typography>{error}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          🤖 Dashboard IA
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Tableau de bord de l'intelligence artificielle CRM
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardHeader
              avatar={<ChatIcon sx={{ color: '#7C3AED' }} />}
              title="Conversations"
              subheader="Total analysées"
            />
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {stats.total_conversations}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Dialogues traités par l'IA
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardHeader
              avatar={<Psychology sx={{ color: '#F59E0B' }} />}
              title="Ventes générées"
              subheader="Par l'IA"
            />
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {stats.orders_converted}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Intentions converties en commandes
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardHeader
              avatar={<Bolt sx={{ color: '#EC4899' }} />}
              title="Règles actives"
              subheader="En fonctionnement"
            />
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {stats.active_rules}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Règles métier appliquées
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardHeader
              avatar={<TrendingUp sx={{ color: '#10B981' }} />}
              title="Confiance moyenne"
              subheader="Précision IA"
            />
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {Math.round(stats.avg_intent_confidence * 100)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={stats.avg_intent_confidence * 100} 
                sx={{ height: 8, borderRadius: 4, mt: 1 }}
                color="success"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardHeader
              avatar={<PeopleIcon sx={{ color: '#3B82F6' }} />}
              title="Clients profilés"
              subheader="Analysés par l'IA"
            />
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {stats.clients_profiled}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Profils comportementaux créés
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardHeader
              avatar={<RocketLaunch sx={{ color: '#8B5CF6' }} />}
              title="Performance IA"
              subheader="Score global"
            />
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {Math.round((stats.orders_converted / Math.max(stats.total_conversations, 1)) * 100)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Taux de conversion conversation → vente
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {stats.recent_activity && stats.recent_activity.length > 0 && (
        <Card sx={{ mt: 4 }}>
          <CardHeader
            title="Activité récente"
            subheader="7 derniers jours"
          />
          <CardContent>
            <Grid container spacing={2}>
              {stats.recent_activity.map((day, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2">{day.date}</Typography>
                    <Typography variant="body2">
                      {day.conversations} conversations
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {day.rule_based_responses} réponses automatisées
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}