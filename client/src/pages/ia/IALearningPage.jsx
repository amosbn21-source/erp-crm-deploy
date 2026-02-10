import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CardHeader,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  MenuItem
} from '@mui/material';
import { 
  RocketLaunch as RocketLaunchIcon,
  AutoAwesome as AutoAwesomeIcon,
  Psychology as PsychologyIcon,
  ThumbUp as ThumbUpIcon,
  Feedback as FeedbackIcon,
  Add as AddIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import iaService from '../../services/api-ia';

export default function IALearningPage() {
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    conversationId: '',
    correctedResponse: '',
    feedbackType: 'correction'
  });

  useEffect(() => {
    // Charger l'historique des feedbacks
    // Note: Cette route n'existe pas encore, vous devrez la créer
    // Pour l'instant, nous allons simuler des données
    setTimeout(() => {
      setFeedbackList([
        {
          id: 1,
          type: 'correction',
          original: "Le produit est disponible",
          corrected: "Le produit est disponible en stock, livraison sous 48h",
          date: '2024-01-15',
          learned: true
        },
        {
          id: 2,
          type: 'improvement',
          original: "Prix: 99€",
          corrected: "Prix: 99€ avec garantie 2 ans incluse",
          date: '2024-01-14',
          learned: false
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleSubmitFeedback = async () => {
    try {
      const response = await iaService.submitFeedback(
        newFeedback.conversationId,
        newFeedback.correctedResponse,
        newFeedback.feedbackType
      );
      
      if (response.success) {
        // Ajouter à la liste
        setFeedbackList(prev => [{
          id: prev.length + 1,
          type: newFeedback.feedbackType,
          original: "Message original...",
          corrected: newFeedback.correctedResponse,
          date: new Date().toISOString().split('T')[0],
          learned: response.rule_created
        }, ...prev]);
        
        setFeedbackDialogOpen(false);
        setNewFeedback({
          conversationId: '',
          correctedResponse: '',
          feedbackType: 'correction'
        });
      } else {
        setError(response.error || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Erreur feedback:', error);
      setError('Erreur lors de l\'envoi du feedback');
    }
  };

  const getIconByType = (type) => {
    switch (type) {
      case 'correction': return <AutoAwesomeIcon />;
      case 'improvement': return <PsychologyIcon />;
      case 'praise': return <ThumbUpIcon />;
      default: return <FeedbackIcon />;
    }
  };

  const getColorByType = (type) => {
    switch (type) {
      case 'correction': return '#7C3AED';
      case 'improvement': return '#10B981';
      case 'praise': return '#F59E0B';
      default: return '#6B7280';
    }
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
              🚀 Apprentissage IA
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Amélioration continue du système d'intelligence artificielle
            </Typography>
          </Box>
          <Button 
            startIcon={<AddIcon />}
            onClick={() => setFeedbackDialogOpen(true)}
            variant="contained"
          >
            Donner du feedback
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 4 }}>
        <CardHeader
          avatar={<RocketLaunchIcon sx={{ color: '#8B5CF6', fontSize: 40 }} />}
          title="Système d'apprentissage actif"
          subheader="Votre IA s'améliore automatiquement avec chaque interaction"
        />
        <CardContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            L'IA analyse les feedbacks, les corrections et les patterns pour améliorer ses réponses.
            Chaque correction que vous fournissez permet à l'IA d'apprendre et de s'adapter.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <Chip 
              label={`${feedbackList.filter(f => f.learned).length} règles apprises`}
              color="success"
              variant="outlined"
            />
            <Chip 
              label={`${feedbackList.length} feedbacks donnés`}
              color="primary"
              variant="outlined"
            />
            <Chip 
              label="Apprentissage continu"
              color="warning"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom>
        Historique des feedbacks
      </Typography>
      
      {feedbackList.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">
            Aucun feedback donné pour le moment. Soyez le premier à aider l'IA à s'améliorer !
          </Typography>
        </Card>
      ) : (
        <List sx={{ bgcolor: 'background.paper' }}>
          {feedbackList.map((feedback, index) => (
            <React.Fragment key={feedback.id}>
              <ListItem alignItems="flex-start">
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: getColorByType(feedback.type) }}>
                    {getIconByType(feedback.type)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography component="span" variant="subtitle2">
                        {feedback.type === 'correction' ? 'Correction' : 
                         feedback.type === 'improvement' ? 'Amélioration' : 'Éloge'}
                      </Typography>
                      {feedback.learned && (
                        <Chip 
                          label="Règle apprise" 
                          size="small" 
                          color="success"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <React.Fragment>
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          <strong>Original:</strong> {feedback.original}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          <strong>Corrigé:</strong> {feedback.corrected}
                        </Typography>
                      </Box>
                      <Typography 
                        component="span" 
                        variant="caption" 
                        color="textSecondary"
                        sx={{ display: 'block', mt: 1 }}
                      >
                        {feedback.date}
                      </Typography>
                    </React.Fragment>
                  }
                />
              </ListItem>
              {index < feedbackList.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Dialog pour donner du feedback */}
      <Dialog open={feedbackDialogOpen} onClose={() => setFeedbackDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Donner du feedback à l'IA</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="ID de conversation"
            fullWidth
            value={newFeedback.conversationId}
            onChange={(e) => setNewFeedback({...newFeedback, conversationId: e.target.value})}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Type de feedback"
            select
            fullWidth
            value={newFeedback.feedbackType}
            onChange={(e) => setNewFeedback({...newFeedback, feedbackType: e.target.value})}
            sx={{ mb: 2 }}
          >
            <MenuItem value="correction">Correction</MenuItem>
            <MenuItem value="improvement">Amélioration</MenuItem>
            <MenuItem value="praise">Éloge</MenuItem>
          </TextField>
          
          <TextField
            margin="dense"
            label="Réponse corrigée ou commentaire"
            fullWidth
            multiline
            rows={4}
            value={newFeedback.correctedResponse}
            onChange={(e) => setNewFeedback({...newFeedback, correctedResponse: e.target.value})}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackDialogOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleSubmitFeedback} 
            variant="contained"
            disabled={!newFeedback.conversationId || !newFeedback.correctedResponse}
          >
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}