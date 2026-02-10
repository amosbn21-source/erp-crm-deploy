// src/components/Feedback.js
// Composants réutilisables pour notifications (Snackbar) et Loader (CircularProgress).

import React from 'react';
import { Snackbar, Alert, CircularProgress, Box } from '@mui/material';

export function Notif({ open, message, type = 'success', onClose }) {
  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={onClose}>
      <Alert severity={type} onClose={onClose}>
        {message}
      </Alert>
    </Snackbar>
  );
}

export function Loader({ show }) {
  if (!show) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
      <CircularProgress />
    </Box>
  );
}
