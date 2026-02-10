// src/pages/Unauthorized.js
import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Warning as WarningIcon } from '@mui/icons-material';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      textAlign="center"
      p={3}
    >
      <WarningIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom>
        Accès non autorisé
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Vous n'avez pas les permissions nécessaires pour accéder à cette page.
      </Typography>
      <Button 
        variant="contained" 
        onClick={() => navigate('/dashboard')}
        sx={{ mt: 2 }}
      >
        Retour au tableau de bord
      </Button>
    </Box>
  );
};

export default Unauthorized;