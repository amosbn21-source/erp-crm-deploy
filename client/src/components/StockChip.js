// src/components/StockChip.js
import React from 'react';
import { Chip } from '@mui/material';
import {
  CheckCircle as InStockIcon,
  Warning as LowStockIcon,
  Error as NoStockIcon
} from '@mui/icons-material';

const StockChip = ({ stock }) => {
  const stockValue = parseInt(stock) || 0;
  
  if (stockValue > 10) {
    return (
      <Chip
        icon={<InStockIcon />}
        label={`${stockValue} en stock`}
        size="small"
        color="success"
        variant="outlined"
      />
    );
  } else if (stockValue > 0) {
    return (
      <Chip
        icon={<LowStockIcon />}
        label={`${stockValue} restants`}
        size="small"
        color="warning"
        variant="outlined"
      />
    );
  } else {
    return (
      <Chip
        icon={<NoStockIcon />}
        label="Rupture"
        size="small"
        color="error"
        variant="outlined"
      />
    );
  }
};

export default StockChip;
