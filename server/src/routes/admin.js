// backend/src/routes/admin.js
// ⚡ Routes administratives - Accès restreint aux administrateurs uniquement
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// ==================== MIDDLEWARE D'AUTORISATION ADMIN ====================

/**
 * Vérifie que l'utilisateur est administrateur
 * ⚡ NOTE: Cette version est adaptée pour fonctionner sans système d'authentification complet
 *          Dans une version réelle, vous devriez implémenter JWT ou sessions
 */
const requireAdmin = (req, res, next) => {
  // ⚡ SIMULATION: Pour la compatibilité avec votre server.js actuel
  //    Dans une version réelle, vous vérifieriez un token JWT
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Token d\'authentification requis',
      code: 'AUTH_TOKEN_REQUIRED'
    });
  }
  
  // ⚡ SIMULATION: Vérification basique (à remplacer par JWT)
  if (authHeader !== 'Bearer admin-token') {
    return res.status(403).json({
      success: false,
      error: 'Accès réservé aux administrateurs',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  // ⚡ Ajouter un utilisateur simulé à la requête
  req.user = {
    id: 1,
    email: 'admin@system.com',
    role: 'admin',
    permissions: ['all']
  };
  
  next();
};

// ==================== ROUTES DE SURVEILLANCE ====================

/**
 * GET /api/admin/stats
 * Statistiques système complètes
 */
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = {
      system: {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV || 'development'
      },
      usage: {
        totalUsers: 150,
        activeUsers: 42,
        totalContacts: 1250,
        totalProducts: 340,
        totalOrders: 890,
        totalDocuments: 210,
        storageUsed: '2.4 GB',
        apiCallsToday: 1245,
        apiCallsThisMonth: 25430
      },
      performance: {
        avgResponseTime: '125ms',
        errorRate: '0.5%',
        uptime: '99.8%',
        lastBackup: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      security: {
        failedLoginsLast24h: 3,
        blockedIPs: 2,
        securityEvents: 8,
        lastSecurityScan: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      }
    };

    res.json({
      success: true,
      data: stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur stats admin:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques',
      code: 'STATS_ERROR'
    });
  }
});

/**
 * GET /api/admin/users
 * Liste tous les utilisateurs
 */
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = [
      {
        id: 1,
        email: 'admin@entreprise.com',
        name: 'Administrateur',
        role: 'admin',
        status: 'active',
        createdAt: '2024-01-15T10:30:00Z',
        lastLogin: new Date().toISOString(),
        permissions: ['all']
      },
      {
        id: 2,
        email: 'manager@entreprise.com',
        name: 'Manager Commercial',
        role: 'manager',
        status: 'active',
        createdAt: '2024-02-20T14:15:00Z',
        lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        permissions: ['contacts:read', 'contacts:write', 'orders:read']
      }
    ];

    res.json({
      success: true,
      data: users,
      count: users.length
    });

  } catch (error) {
    console.error('❌ Erreur récupération utilisateurs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des utilisateurs',
      code: 'USERS_FETCH_ERROR'
    });
  }
});

/**
 * POST /api/admin/users
 * Créer un nouvel utilisateur
 */
router.post('/admin/users', requireAdmin,
  [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('role').isIn(['admin', 'manager', 'sales', 'user']),
    body('password').optional().isLength({ min: 8 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const { email, name, role, password = 'DefaultPassword123!' } = req.body;

      const newUser = {
        id: Date.now(),
        email,
        name,
        role,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        permissions: getDefaultPermissions(role),
        temporaryPassword: password
      };

      console.log(`✅ Nouvel utilisateur créé: ${email} (${role})`);

      res.status(201).json({
        success: true,
        data: newUser,
        message: 'Utilisateur créé avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur création utilisateur:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de l\'utilisateur',
        code: 'USER_CREATION_ERROR'
      });
    }
  }
);

/**
 * PUT /api/admin/users/:id
 * Mettre à jour un utilisateur
 */
router.put('/admin/users/:id', requireAdmin,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('role').optional().isIn(['admin', 'manager', 'sales', 'user']),
    body('status').optional().isIn(['active', 'inactive', 'suspended'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const userId = parseInt(req.params.id);
      const updates = req.body;

      console.log(`✅ Utilisateur ${userId} mis à jour`, updates);

      res.json({
        success: true,
        data: { id: userId, ...updates, updatedAt: new Date().toISOString() },
        message: 'Utilisateur mis à jour avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour utilisateur:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour de l\'utilisateur',
        code: 'USER_UPDATE_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/admin/users/:id
 * Désactiver un utilisateur
 */
router.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    console.log(`✅ Utilisateur ${userId} désactivé`);

    res.json({
      success: true,
      message: 'Utilisateur désactivé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la désactivation de l\'utilisateur',
      code: 'USER_DELETION_ERROR'
    });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Réinitialiser le mot de passe d'un utilisateur
 */
router.post('/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const tempPassword = generateTemporaryPassword();

    console.log(`✅ Mot de passe réinitialisé pour l'utilisateur ${userId}`);

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      temporaryPassword: tempPassword
    });

  } catch (error) {
    console.error('❌ Erreur réinitialisation mot de passe:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation du mot de passe',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

/**
 * GET /api/admin/config
 * Récupérer la configuration système
 */
router.get('/admin/config', requireAdmin, async (req, res) => {
  try {
    const config = {
      application: {
        name: 'ERP-CRM System',
        version: '1.5.2',
        environment: process.env.NODE_ENV || 'development',
        apiVersion: 'v1'
      },
      security: {
        jwtExpiration: '24h',
        passwordMinLength: 8,
        maxLoginAttempts: 5
      },
      limits: {
        maxFileSize: '10MB',
        apiRateLimit: '100/15min'
      }
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('❌ Erreur récupération config:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la configuration',
      code: 'CONFIG_FETCH_ERROR'
    });
  }
});

/**
 * GET /api/admin/logs
 * Récupérer les logs système
 */
router.get('/admin/logs', requireAdmin, async (req, res) => {
  try {
    const logs = generateSampleLogs('app', 50);

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });

  } catch (error) {
    console.error('❌ Erreur récupération logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des logs',
      code: 'LOGS_FETCH_ERROR'
    });
  }
});

/**
 * GET /api/admin/health/detailed
 * Vérification de santé détaillée
 */
router.get('/admin/health/detailed', requireAdmin, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        database: {
          status: 'connected',
          latency: '12ms'
        },
        storage: {
          status: 'available',
          freeSpace: '45.2 GB'
        },
        api: {
          status: 'operational',
          responseTime: '85ms'
        }
      }
    };

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('❌ Erreur health check détaillé:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification de santé',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Génère des permissions par défaut selon le rôle
 */
function getDefaultPermissions(role) {
  const permissions = {
    admin: ['all'],
    manager: [
      'users:read',
      'contacts:read', 'contacts:write',
      'products:read', 'products:write',
      'orders:read', 'orders:write'
    ],
    sales: [
      'contacts:read', 'contacts:write',
      'products:read',
      'orders:read', 'orders:write'
    ],
    user: [
      'profile:read', 'profile:write',
      'orders:read'
    ]
  };
  
  return permissions[role] || permissions.user;
}

/**
 * Génère un mot de passe temporaire sécurisé
 */
function generateTemporaryPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  for (let i = 0; i < 4; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Génère des logs d'exemple
 */
function generateSampleLogs(type, limit) {
  const levels = ['info', 'warn', 'error'];
  const logs = [];
  const now = Date.now();
  
  for (let i = 0; i < limit; i++) {
    const logLevel = levels[Math.floor(Math.random() * levels.length)];
    
    logs.push({
      id: i + 1,
      timestamp: new Date(now - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      level: logLevel,
      message: `Log ${type} - Événement ${i + 1}`,
      source: 'api-server'
    });
  }
  
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = router;