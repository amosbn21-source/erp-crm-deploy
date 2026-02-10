const express = require('express');
const router = express.Router();

// GET /api/webhook-logs - Logs des webhooks
router.get('/webhook-logs', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      platform,
      status,
      search,
      date_range = '24h'
    } = req.query;
    
    console.log(`📝 GET webhook-logs pour ${userSchema}`, {
      page, limit, platform, status, search, date_range
    });
    
    // Calculer l'offset
    const offset = (page - 1) * limit;
    
    // Construire la clause WHERE
    const whereConditions = ['user_id = $1'];
    const params = [userId];
    let paramIndex = 2;
    
    // Filtre par plateforme
    if (platform && platform !== 'all') {
      whereConditions.push(`platform = $${paramIndex}`);
      params.push(platform);
      paramIndex++;
    }
    
    // Filtre par statut
    if (status && status !== 'all') {
      if (status === 'success') {
        whereConditions.push(`status_code >= 200 AND status_code < 300`);
      } else if (status === 'client_error') {
        whereConditions.push(`status_code >= 400 AND status_code < 500`);
      } else if (status === 'server_error') {
        whereConditions.push(`status_code >= 500`);
      }
    }
    
    // Filtre par période
    if (date_range !== 'all') {
      let interval;
      switch (date_range) {
        case '1h':
          interval = "1 hour";
          break;
        case '24h':
          interval = "24 hours";
          break;
        case '7d':
          interval = "7 days";
          break;
        case '30d':
          interval = "30 days";
          break;
        default:
          interval = "24 hours";
      }
      whereConditions.push(`timestamp >= NOW() - INTERVAL '${interval}'`);
    }
    
    // Filtre par recherche
    if (search) {
      whereConditions.push(`(url ILIKE $${paramIndex} OR payload::text ILIKE $${paramIndex} OR error ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Vérifier si la table existe
    try {
      const tableCheck = await req.app.locals.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'webhook_logs'
        )`,
        [userSchema]
      );
      
      if (!tableCheck.rows[0].exists) {
        console.log('ℹ️ Table webhook_logs non trouvée');
        return res.json({
          success: true,
          data: {
            logs: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0
          }
        });
      }
    } catch (error) {
      console.log('ℹ️ Erreur vérification table:', error.message);
      return res.json({
        success: true,
        data: {
          logs: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }
      });
    }
    
    // Récupérer le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "${userSchema}".webhook_logs
      ${whereClause}
    `;
    
    const countResult = await req.app.locals.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total) || 0;
    
    // Récupérer les logs
    const logsQuery = `
      SELECT *
      FROM "${userSchema}".webhook_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const logsParams = [...params, parseInt(limit), offset];
    const logsResult = await req.app.locals.pool.query(logsQuery, logsParams);
    
    // Formater les logs pour le frontend
    const logs = logsResult.rows.map(log => {
      // Essayer de parser le payload JSON
      let parsedPayload = {};
      try {
        if (log.payload && typeof log.payload === 'string') {
          parsedPayload = JSON.parse(log.payload);
        } else if (log.payload && typeof log.payload === 'object') {
          parsedPayload = log.payload;
        }
      } catch (error) {
        parsedPayload = { raw: log.payload };
      }
      
      return {
        id: log.id,
        user_id: log.user_id,
        account_id: log.account_id,
        platform: log.platform,
        url: log.url,
        method: log.method || 'POST',
        status_code: log.status_code,
        headers: log.headers || {},
        payload: parsedPayload,
        response: log.response || {},
        error: log.error,
        processing_time: log.processing_time,
        timestamp: log.timestamp,
        created_at: log.created_at
      };
    });
    
    res.json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur GET /webhook-logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des logs webhook',
      data: {
        logs: [],
        total: 0,
        page: parseInt(req.query.page || 1),
        limit: parseInt(req.query.limit || 10),
        totalPages: 0
      }
    });
  }
});

// POST /api/webhook-logs/export - Exporter les logs
router.post('/webhook-logs/export', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    
    console.log(`📤 Export webhook-logs pour ${userSchema}`);
    
    // Vérifier si la table existe
    try {
      const tableCheck = await req.app.locals.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'webhook_logs'
        )`,
        [userSchema]
      );
      
      if (!tableCheck.rows[0].exists) {
        return res.json({
          success: false,
          error: 'Aucun log disponible pour l\'export'
        });
      }
    } catch (error) {
      return res.json({
        success: false,
        error: 'Erreur lors de la vérification des logs'
      });
    }
    
    // Récupérer tous les logs
    const logsQuery = `
      SELECT *
      FROM "${userSchema}".webhook_logs
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT 1000
    `;
    
    const logsResult = await req.app.locals.pool.query(logsQuery, [userId]);
    
    const exportData = logsResult.rows.map(log => ({
      id: log.id,
      platform: log.platform,
      url: log.url,
      method: log.method,
      status_code: log.status_code,
      timestamp: log.timestamp,
      processing_time: log.processing_time,
      error: log.error,
      created_at: log.created_at
    }));
    
    // Pour un vrai export CSV ou JSON
    res.json({
      success: true,
      data: exportData,
      message: `Export de ${exportData.length} logs`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur export webhook-logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'export des logs'
    });
  }
});

// DELETE /api/webhook-logs - Supprimer tous les logs
router.delete('/webhook-logs', async (req, res) => {
  try {
    const userSchema = req.userSchema;
    const userId = req.user.id;
    
    console.log(`🗑️ DELETE webhook-logs pour ${userSchema}`);
    
    // Vérifier si la table existe
    try {
      const tableCheck = await req.app.locals.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'webhook_logs'
        )`,
        [userSchema]
      );
      
      if (!tableCheck.rows[0].exists) {
        return res.json({
          success: true,
          message: 'Aucun log à supprimer'
        });
      }
    } catch (error) {
      return res.json({
        success: false,
        error: 'Erreur lors de la vérification des logs'
      });
    }
    
    // Supprimer les logs
    await req.app.locals.pool.query(
      `DELETE FROM "${userSchema}".webhook_logs WHERE user_id = $1`,
      [userId]
    );
    
    res.json({
      success: true,
      message: 'Tous les logs ont été supprimés'
    });
    
  } catch (error) {
    console.error('❌ Erreur DELETE webhook-logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression des logs'
    });
  }
});

module.exports = router;