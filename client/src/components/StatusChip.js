// src/components/StatusChip.js
// Affiche un Chip coloré selon le statut.

import React from 'react';
import { Chip } from '@mui/material';

export default function StatusChip({ status }) {
  const map = {
    'Livrée': { color: 'success', label: 'Livrée' },
    'En cours': { color: 'warning', label: 'En cours' },
    'Annulée': { color: 'error', label: 'Annulée' },
  };
  const conf = map[status] || { color: 'default', label: status || 'Inconnu' };
  return <Chip label={conf.label} color={conf.color} />;
}
