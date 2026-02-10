// src/components/ValidatedTextField.js
import React, { useState, useEffect } from 'react';
import { TextField } from '@mui/material';
import { validateEmail, validatePhone, sanitizeInput } from '../utils/validation';

const ValidatedTextField = ({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  validationType = null, // 'email', 'phone', 'number', 'text'
  maxLength = null,
  min = null,
  max = null,
  disabled = false,
  fullWidth = true,
  ...props
}) => {
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched || value) {
      validateField(value);
    }
  }, [value, touched]);

  const validateField = (inputValue) => {
    if (!inputValue && !required) {
      setError('');
      return;
    }

    if (!inputValue && required) {
      setError('Ce champ est requis');
      return;
    }

    let validationResult;

    switch (validationType) {
      case 'email':
        validationResult = validateEmail(inputValue);
        break;
      case 'phone':
        validationResult = validatePhone(inputValue);
        break;
      case 'number':
        const num = parseFloat(inputValue);
        if (isNaN(num)) {
          validationResult = { isValid: false, error: 'Doit être un nombre' };
        } else if (min !== null && num < min) {
          validationResult = { isValid: false, error: `Minimum: ${min}` };
        } else if (max !== null && num > max) {
          validationResult = { isValid: false, error: `Maximum: ${max}` };
        } else {
          validationResult = { isValid: true };
        }
        break;
      case 'text':
        if (maxLength && inputValue.length > maxLength) {
          validationResult = { 
            isValid: false, 
            error: `Maximum ${maxLength} caractères` 
          };
        } else {
          validationResult = { isValid: true };
        }
        break;
      default:
        validationResult = { isValid: true };
    }

    if (!validationResult.isValid) {
      setError(validationResult.error);
    } else {
      setError('');
    }
  };

  const handleChange = (e) => {
    let newValue = e.target.value;
    
    // Nettoyer l'input selon le type
    switch (validationType) {
      case 'email':
        newValue = newValue.toLowerCase().trim();
        break;
      case 'phone':
        // Garder uniquement les chiffres et +
        newValue = newValue.replace(/[^\d+]/g, '');
        break;
      case 'number':
        // Garder uniquement les chiffres et un point décimal
        newValue = newValue.replace(/[^\d.]/g, '');
        // Un seul point décimal
        const parts = newValue.split('.');
        if (parts.length > 2) {
          newValue = parts[0] + '.' + parts.slice(1).join('');
        }
        break;
      default:
        newValue = sanitizeInput(newValue);
    }

    onChange(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  return (
    <TextField
      label={label}
      value={value || ''}
      onChange={handleChange}
      onBlur={handleBlur}
      type={type === 'number' ? 'text' : type} // Pour contrôler l'input
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      error={!!error}
      helperText={error}
      inputProps={{
        maxLength: maxLength,
        inputMode: type === 'number' ? 'decimal' : 'text'
      }}
      {...props}
    />
  );
};

export default ValidatedTextField;