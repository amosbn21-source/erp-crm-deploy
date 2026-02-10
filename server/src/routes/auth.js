// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Route de login
router.post('/login', 
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
  ],
  async (req, res) => {
    try {
      // Validation des données
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const { email, password } = req.body;
      
      // Ici, vous devriez récupérer l'utilisateur depuis la base de données
      // Pour l'exemple, on utilise des utilisateurs en mémoire
      const users = [
        {
          id: 1,
          email: 'admin@entreprise.com',
          // Mot de passe hashé: 'password123'
          passwordHash: '$2a$12$K8gWqC7pPcFh7bJ5wRk4Y.z7M8N9vQ1wX2yZ3a4b5c6d7e8f9g0h1i2j',
          name: 'Administrateur',
          role: 'admin',
          permissions: ['all']
        },
        {
          id: 2,
          email: 'user@entreprise.com',
          passwordHash: '$2a$12$K8gWqC7pPcFh7bJ5wRk4Y.z7M8N9vQ1wX2yZ3a4b5c6d7e8f9g0h1i2j',
          name: 'Utilisateur Standard',
          role: 'user',
          permissions: ['read']
        }
      ];

      // Chercher l'utilisateur
      const user = users.find(u => u.email === email);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Email ou mot de passe incorrect',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Vérifier le mot de passe (en production, utiliser bcrypt.compare)
      // Pour l'exemple, on utilise un mot de passe simple
      const isValidPassword = password === 'password123';
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Email ou mot de passe incorrect',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Créer le token JWT
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          permissions: user.permissions
        },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '24h' }
      );

      // Créer le refresh token
      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production',
        { expiresIn: '7d' }
      );

      // Réponse
      res.json({
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions
        },
        expiresIn: 24 * 60 * 60 // 24 heures en secondes
      });

    } catch (error) {
      console.error('❌ Erreur login:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// Route pour rafraîchir le token
router.post('/refresh', 
  [
    body('refreshToken').notEmpty()
  ],
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token requis',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }

      // Vérifier le refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production'
      );

      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          error: 'Token invalide',
          code: 'INVALID_TOKEN_TYPE'
        });
      }

      // Récupérer l'utilisateur (simulé)
      const user = {
        id: decoded.userId,
        email: 'admin@entreprise.com',
        name: 'Administrateur',
        role: 'admin',
        permissions: ['all']
      };

      // Générer un nouveau token
      const newToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          permissions: user.permissions
        },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });

    } catch (error) {
      console.error('❌ Erreur refresh token:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Refresh token expiré',
          code: 'REFRESH_TOKEN_EXPIRED'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Refresh token invalide',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// Route pour vérifier le token
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token manquant',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    );

    res.json({
      success: true,
      valid: true,
      user: decoded
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur de vérification',
      code: 'VERIFICATION_ERROR'
    });
  }
});

// Route de logout
router.post('/logout', (req, res) => {
  // En production, vous pourriez ajouter le token à une liste noire
  // ou supprimer le refresh token de la base de données
  
  res.json({
    success: true,
    message: 'Déconnecté avec succès'
  });
});

// Route pour récupérer le profil utilisateur
router.get('/profile', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token manquant',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change-in-production'
    );

    res.json({
      success: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        permissions: decoded.permissions || []
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Token invalide',
      code: 'INVALID_TOKEN'
    });
  }
});

// Route pour changer le mot de passe
router.post('/change-password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
  ],
  (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;
      
      // Vérifier le token
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Non autorisé'
        });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'dev-secret-change-in-production'
      );

      // Ici, vous devriez:
      // 1. Vérifier l'ancien mot de passe dans la base de données
      // 2. Hasher le nouveau mot de passe
      // 3. Mettre à jour dans la base de données
      
      res.json({
        success: true,
        message: 'Mot de passe changé avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne'
      });
    }
  }
);

module.exports = router;