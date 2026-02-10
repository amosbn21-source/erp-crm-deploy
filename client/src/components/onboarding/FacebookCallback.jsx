import { useEffect } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';

export default function FacebookCallback() {
  useEffect(() => {
    const processToken = () => {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          // Envoyer le token au parent
          window.opener.postMessage({
            type: 'FACEBOOK_OAUTH_SUCCESS',
            access_token: accessToken,
            expires_in: params.get('expires_in')
          }, window.location.origin);
        } else {
          window.opener.postMessage({
            type: 'FACEBOOK_OAUTH_ERROR',
            error: 'Token non reçu'
          }, window.location.origin);
        }
      } catch (error) {
        window.opener.postMessage({
          type: 'FACEBOOK_OAUTH_ERROR',
          error: error.message
        }, window.location.origin);
      }
      
      // Fermer la fenêtre
      setTimeout(() => window.close(), 1000);
    };

    processToken();
  }, []);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      p: 3
    }}>
      <CircularProgress size={60} sx={{ mb: 3 }} />
      <Typography variant="h6" gutterBottom>
        Connexion à Facebook en cours...
      </Typography>
      <Typography color="text.secondary">
        Cette fenêtre se fermera automatiquement
      </Typography>
    </Box>
  );
}