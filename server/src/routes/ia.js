// Fichier: src/routes/ia.js
const express = require('express');
const router = express.Router();
const IACRMMotor = require('../ia/ia-engine');

// Middleware pour initialiser le moteur IA
router.use(async (req, res, next) => {
    if (!req.iaMotor && req.userSchema) {
        req.iaMotor = new IACRMMotor(
            req.app.locals.pool, 
            req.userSchema, 
            req.user.id
        );
    }
    next();
});

// ==================== CHAT ET CONVERSATION ====================

// POST /api/ia/chat - Chat avec l'IA
router.post('/chat', async (req, res) => {
    try {
        const { contactId, message } = req.body;
        
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message requis'
            });
        }
        
        const response = await req.iaMotor.processMessage(contactId || 'new', message);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erreur chat IA:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur traitement IA',
            message: error.message
        });
    }
});

// GET /api/ia/conversations/:contactId - Historique des conversations
router.get('/conversations/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        
        const result = await req.app.locals.pool.query(
            `SELECT * FROM "${req.userSchema}".conversation_history 
             WHERE contact_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
            [contactId, limit]
        );
        
        res.json({
            success: true,
            conversations: result.rows,
            count: result.rows.length
        });
        
    } catch (error) {
        console.error('❌ Erreur historique conversations:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération historique'
        });
    }
});

// ==================== RÈGLES MÉTIER ====================

// GET /api/ia/rules - Lister les règles
router.get('/rules', async (req, res) => {
    try {
        const result = await req.app.locals.pool.query(
            `SELECT * FROM "${req.userSchema}".business_rules 
             ORDER BY priority DESC, created_at DESC`
        );
        
        res.json({
            success: true,
            rules: result.rows,
            count: result.rows.length
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération règles:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération règles'
        });
    }
});

// POST /api/ia/rules - Créer une règle
router.post('/rules', async (req, res) => {
    try {
        const { rule_name, conditions, actions, priority = 50, scope = 'global', target } = req.body;
        
        if (!rule_name || !conditions || !actions) {
            return res.status(400).json({
                success: false,
                error: 'rule_name, conditions et actions sont requis'
            });
        }
        
        const result = await req.app.locals.pool.query(
            `INSERT INTO "${req.userSchema}".business_rules 
             (rule_name, conditions, actions, priority, scope, 
              target_contact_id, target_category, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
             RETURNING *`,
            [
                rule_name,
                JSON.stringify(conditions),
                JSON.stringify(actions),
                priority,
                scope,
                scope === 'contact' ? target : null,
                scope === 'category' ? target : null,
                req.user.id
            ]
        );
        
        res.json({
            success: true,
            rule: result.rows[0],
            message: 'Règle créée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Erreur création règle:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur création règle'
        });
    }
});

// PUT /api/ia/rules/:id - Mettre à jour une règle
router.put('/rules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        Object.keys(updates).forEach(key => {
            if (['conditions', 'actions'].includes(key)) {
                updateFields.push(`${key} = $${paramIndex}`);
                updateValues.push(JSON.stringify(updates[key]));
            } else {
                updateFields.push(`${key} = $${paramIndex}`);
                updateValues.push(updates[key]);
            }
            paramIndex++;
        });
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);
        
        const query = `
            UPDATE "${req.userSchema}".business_rules 
            SET ${updateFields.join(', ')} 
            WHERE id = $${paramIndex} 
            RETURNING *
        `;
        
        const result = await req.app.locals.pool.query(query, updateValues);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Règle non trouvée'
            });
        }
        
        res.json({
            success: true,
            rule: result.rows[0],
            message: 'Règle mise à jour'
        });
        
    } catch (error) {
        console.error('❌ Erreur mise à jour règle:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur mise à jour règle'
        });
    }
});

// DELETE /api/ia/rules/:id - Désactiver une règle
router.delete('/rules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await req.app.locals.pool.query(
            `UPDATE "${req.userSchema}".business_rules 
             SET is_active = false, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 
             RETURNING id, rule_name`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Règle non trouvée'
            });
        }
        
        res.json({
            success: true,
            message: 'Règle désactivée',
            rule: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Erreur désactivation règle:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur désactivation règle'
        });
    }
});

// ==================== PROFILS CLIENTS ====================

// GET /api/ia/profiles/:contactId - Obtenir un profil client
router.get('/profiles/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        
        const result = await req.app.locals.pool.query(
            `SELECT cp.*, c.nom, c.prenom, c.email, c.telephone, c.entreprise
             FROM "${req.userSchema}".client_profiles cp
             LEFT JOIN "${req.userSchema}".contacts c ON cp.contact_id = c.id
             WHERE cp.contact_id = $1`,
            [contactId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Profil non trouvé'
            });
        }
        
        res.json({
            success: true,
            profile: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération profil:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération profil'
        });
    }
});

// PUT /api/ia/profiles/:contactId - Mettre à jour un profil
router.put('/profiles/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        const updates = req.body;
        
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        Object.keys(updates).forEach(key => {
            if (['language_preferences', 'behavioral_patterns', 'interaction_stats'].includes(key)) {
                updateFields.push(`${key} = $${paramIndex}`);
                updateValues.push(JSON.stringify(updates[key]));
            } else {
                updateFields.push(`${key} = $${paramIndex}`);
                updateValues.push(updates[key]);
            }
            paramIndex++;
        });
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(contactId);
        
        const query = `
            UPDATE "${req.userSchema}".client_profiles 
            SET ${updateFields.join(', ')} 
            WHERE contact_id = $${paramIndex} 
            RETURNING *
        `;
        
        const result = await req.app.locals.pool.query(query, updateValues);
        
        if (result.rows.length === 0) {
            // Créer le profil s'il n'existe pas
            await req.app.locals.pool.query(
                `INSERT INTO "${req.userSchema}".client_profiles (contact_id, created_at)
                 VALUES ($1, CURRENT_TIMESTAMP)`,
                [contactId]
            );
            
            return res.json({
                success: true,
                message: 'Profil créé',
                profile: { contact_id: contactId }
            });
        }
        
        res.json({
            success: true,
            profile: result.rows[0],
            message: 'Profil mis à jour'
        });
        
    } catch (error) {
        console.error('❌ Erreur mise à jour profil:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur mise à jour profil'
        });
    }
});

// ==================== INTENTIONS D'ACHAT ====================

// GET /api/ia/intents - Lister les intentions d'achat
router.get('/intents', async (req, res) => {
    try {
        const { status, limit = 20 } = req.query;
        
        let query = `
            SELECT pi.*, c.nom, c.prenom, c.email
            FROM "${req.userSchema}".purchase_intents pi
            LEFT JOIN "${req.userSchema}".contacts c ON pi.contact_id = c.id
        `;
        
        const params = [];
        if (status) {
            query += ` WHERE pi.status = $1`;
            params.push(status);
        }
        
        query += ` ORDER BY pi.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));
        
        const result = await req.app.locals.pool.query(query, params);
        
        res.json({
            success: true,
            intents: result.rows,
            count: result.rows.length
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération intentions:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération intentions'
        });
    }
});

// POST /api/ia/intents/:id/convert - Convertir en commande
router.post('/intents/:id/convert', async (req, res) => {
    try {
        const { id } = req.params;
        const { productId, quantity } = req.body;
        
        // Récupérer l'intention
        const intentResult = await req.app.locals.pool.query(
            `SELECT * FROM "${req.userSchema}".purchase_intents WHERE id = $1`,
            [id]
        );
        
        if (intentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Intention non trouvée'
            });
        }
        
        const intent = intentResult.rows[0];
        const actualProductId = productId || intent.product_details?.id;
        const actualQuantity = quantity || intent.quantity || 1;
        
        if (!actualProductId) {
            return res.status(400).json({
                success: false,
                error: 'Produit non spécifié'
            });
        }
        
        // Créer la commande
        const order = await req.iaMotor.createOrder(
            intent.contact_id, 
            actualProductId, 
            actualQuantity
        );
        
        // Mettre à jour l'intention
        await req.app.locals.pool.query(
            `UPDATE "${req.userSchema}".purchase_intents 
             SET status = 'converted', converted_to_order_id = $1 
             WHERE id = $2`,
            [order.id, id]
        );
        
        res.json({
            success: true,
            message: 'Commande créée avec succès',
            order,
            intent_id: id
        });
        
    } catch (error) {
        console.error('❌ Erreur conversion intention:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur conversion intention'
        });
    }
});

// ==================== FEEDBACK ET APPRENTISSAGE ====================

// POST /api/ia/feedback - Donner du feedback
router.post('/feedback', async (req, res) => {
    try {
        const { conversationId, correctedResponse, feedbackType = 'correction' } = req.body;
        
        if (!conversationId || !correctedResponse) {
            return res.status(400).json({
                success: false,
                error: 'conversationId et correctedResponse requis'
            });
        }
        
        // Récupérer la conversation
        const convResult = await req.app.locals.pool.query(
            `SELECT * FROM "${req.userSchema}".conversation_history WHERE id = $1`,
            [conversationId]
        );
        
        if (convResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Conversation non trouvée'
            });
        }
        
        const conversation = convResult.rows[0];
        
        // Analyser la correction
        const learnedRule = req.iaMotor.analyzeCorrection(
            conversation.message_text,
            conversation.ai_response,
            correctedResponse
        );
        
        // Enregistrer le feedback
        await req.app.locals.pool.query(
            `INSERT INTO "${req.userSchema}".feedback_learning 
             (original_conversation_id, original_response, 
              corrected_response, correction_type, learned_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                conversationId,
                conversation.ai_response,
                correctedResponse,
                feedbackType,
                req.user.id
            ]
        );
        
        // Créer une règle si pertinent
        if (learnedRule && learnedRule.conditions) {
            await req.app.locals.pool.query(
                `INSERT INTO "${req.userSchema}".business_rules 
                 (rule_name, conditions, actions, priority, created_by)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    `Règle apprise ${new Date().toISOString()}`,
                    JSON.stringify(learnedRule.conditions),
                    JSON.stringify(learnedRule.actions),
                    80, // Haute priorité
                    req.user.id
                ]
            );
        }
        
        res.json({
            success: true,
            message: 'Feedback enregistré et appris',
            rule_created: !!learnedRule
        });
        
    } catch (error) {
        console.error('❌ Erreur feedback:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur traitement feedback'
        });
    }
});

// ==================== STATISTIQUES IA ====================

// GET /api/ia/stats - Statistiques IA
router.get('/stats', async (req, res) => {
    try {
        const stats = await req.app.locals.pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM "${req.userSchema}".conversation_history) as total_conversations,
                (SELECT COUNT(*) FROM "${req.userSchema}".purchase_intents WHERE status = 'converted') as orders_converted,
                (SELECT COUNT(*) FROM "${req.userSchema}".business_rules WHERE is_active = true) as active_rules,
                (SELECT AVG(confidence_score) FROM "${req.userSchema}".purchase_intents) as avg_intent_confidence,
                (SELECT COUNT(DISTINCT contact_id) FROM "${req.userSchema}".client_profiles) as clients_profiled
        `);
        
        const recentActivity = await req.app.locals.pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as conversations,
                COUNT(CASE WHEN response_type = 'rule_based' THEN 1 END) as rule_based_responses
            FROM "${req.userSchema}".conversation_history 
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        
        res.json({
            success: true,
            stats: stats.rows[0],
            recent_activity: recentActivity.rows
        });
        
    } catch (error) {
        console.error('❌ Erreur statistiques IA:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération statistiques'
        });
    }
});

// ==================== GESTION DES COMMANDES ====================

// POST /api/ia/orders - Créer une commande
router.post('/orders', async (req, res) => {
    try {
        const { contactId, items, shippingAddress, paymentMethod, notes } = req.body;
        
        if (!contactId || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'contactId et items requis'
            });
        }
        
        const orderData = {
            items,
            shippingAddress,
            paymentMethod,
            notes
        };
        
        const result = await req.iaMotor.createOrderAdvanced(contactId, orderData);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Erreur création commande:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur création commande',
            message: error.message
        });
    }
});

// PUT /api/ia/orders/:id/status - Mettre à jour le statut
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'status requis'
            });
        }
        
        const result = await req.iaMotor.updateOrderStatus(id, status);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur mise à jour statut',
            message: error.message
        });
    }
});

// POST /api/ia/orders/:id/items - Ajouter un produit
router.post('/orders/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        const { productId, quantity } = req.body;
        
        if (!productId || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'productId et quantity requis'
            });
        }
        
        const result = await req.iaMotor.addItemToOrder(id, productId, quantity);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Erreur ajout produit:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur ajout produit',
            message: error.message
        });
    }
});

// ==================== PRODUITS ====================

// GET /api/ia/products/:id - Détails produit
router.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await req.iaMotor.getProductDetails(id);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Erreur détails produit:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération produit',
            message: error.message
        });
    }
});

// GET /api/ia/products - Recherche produits
router.get('/products', async (req, res) => {
    try {
        const { search, categorie, minPrix, maxPrix, enStock, limit } = req.query;
        
        const filters = {
            searchTerm: search,
            categorie,
            minPrix: minPrix ? parseFloat(minPrix) : undefined,
            maxPrix: maxPrix ? parseFloat(maxPrix) : undefined,
            enStock: enStock ? enStock === 'true' : undefined,
            limit: limit ? parseInt(limit) : 50
        };
        
        const result = await req.iaMotor.searchProducts(filters.searchTerm, filters);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Erreur recherche produits:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur recherche produits',
            message: error.message
        });
    }
});

// ==================== DOCUMENTS ====================

// POST /api/ia/documents/invoice - Générer facture
router.post('/documents/invoice', async (req, res) => {
    try {
        const { orderId, contactId } = req.body;
        
        if (!orderId || !contactId) {
            return res.status(400).json({
                success: false,
                error: 'orderId et contactId requis'
            });
        }
        
        const result = await req.iaMotor.generateInvoice(orderId, contactId);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Erreur génération facture:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur génération facture',
            message: error.message
        });
    }
});

// ==================== COMMANDES CLIENTS ====================

// GET /api/ia/customer/:contactId/orders - Commandes d'un client
router.get('/customer/:contactId/orders', async (req, res) => {
    try {
        const { contactId } = req.params;
        const { status, limit = 10 } = req.query;
        
        let query = `
            SELECT 
                c.*,
                COUNT(lc.id) as items_count,
                STRING_AGG(p.nom, ', ') as produits
            FROM "${req.userSchema}".commandes c
            LEFT JOIN "${req.userSchema}".lignes_commande lc ON c.id = lc.commande_id
            LEFT JOIN "${req.userSchema}".produits p ON lc.produit_id = p.id
            WHERE c.contact_id = $1
        `;
        
        const params = [contactId];
        
        if (status) {
            query += ` AND c.statut = $2`;
            params.push(status);
        }
        
        query += ` 
            GROUP BY c.id
            ORDER BY c.date DESC 
            LIMIT $${params.length + 1}
        `;
        
        params.push(parseInt(limit));
        
        const result = await req.app.locals.pool.query(query, params);
        
        res.json({
            success: true,
            orders: result.rows,
            count: result.rows.length
        });
        
    } catch (error) {
        console.error('❌ Erreur commandes client:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération commandes',
            message: error.message
        });
    }
});

// ==================== ANALYSE D'INTENTION AMÉLIORÉE ====================

// POST /api/ia/analyze - Analyser une intention en détail
router.post('/analyze', async (req, res) => {
    try {
        const { message, contactId } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'message requis'
            });
        }
        
        // Analyse approfondie
        const intent = await req.iaMotor.analyzeIntent(message, contactId);
        
        // Informations supplémentaires selon l'intention
        let additionalData = {};
        
        if (intent.type === 'purchase' && intent.entities.products.length > 0) {
            const product = intent.entities.products[0];
            const details = await req.iaMotor.getProductDetails(product.id);
            additionalData.productDetails = details.success ? details.product : null;
        }
        
        if (intent.type === 'order_management' && contactId) {
            const orders = await req.app.locals.pool.query(
                `SELECT numero_commande, statut 
                 FROM "${req.userSchema}".commandes 
                 WHERE contact_id = $1 AND statut != 'livrée' 
                 LIMIT 3`,
                [contactId]
            );
            additionalData.pendingOrders = orders.rows;
        }
        
        res.json({
            success: true,
            intent,
            additionalData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erreur analyse:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur analyse intention',
            message: error.message
        });
    }
});

// ==================== PARAMÈTRES IA ====================

// GET /api/ia/settings - Récupérer les paramètres IA
router.get('/settings', async (req, res) => {
    try {
        console.log('📋 Récupération paramètres IA pour user:', req.user?.id);
        
        // Vérifier si la table ia_settings existe
        const tableCheck = await req.app.locals.pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = $1 
                AND table_name = 'ia_settings'
            )
        `, [req.userSchema]);
        
        if (tableCheck.rows[0].exists) {
            // Récupérer les paramètres depuis la base de données
            const result = await req.app.locals.pool.query(`
                SELECT * FROM "${req.userSchema}".ia_settings 
                WHERE user_id = $1
                LIMIT 1
            `, [req.user.id]);
            
            if (result.rows.length > 0 && result.rows[0].settings) {
                const settings = result.rows[0].settings;
                res.json({
                    success: true,
                    enabled: settings.enabled !== false,
                    confidence_threshold: settings.confidence_threshold || 0.7,
                    max_context_length: settings.max_context_length || 10,
                    learning_enabled: settings.learning_enabled !== false,
                    rule_based_responses: settings.rule_based_responses !== false,
                    product_recommendations: settings.product_recommendations !== false,
                    sentiment_analysis: settings.sentiment_analysis !== false,
                    language: settings.language || 'fr',
                    created_at: result.rows[0].created_at
                });
                return;
            }
        }
        
        // Si pas de table ou pas de données, retourner des valeurs par défaut
        res.json({
            success: true,
            enabled: true,
            confidence_threshold: 0.7,
            max_context_length: 10,
            learning_enabled: true,
            rule_based_responses: true,
            product_recommendations: true,
            sentiment_analysis: true,
            language: 'fr',
            created_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération paramètres IA:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur récupération paramètres IA',
            message: error.message
        });
    }
});

// POST /api/ia/settings - Sauvegarder les paramètres IA
router.post('/settings', async (req, res) => {
    try {
        const settings = req.body;
        console.log('💾 Sauvegarde paramètres IA:', settings);
        
        // Vérifier/créer la table si nécessaire
        await req.app.locals.pool.query(`
            CREATE TABLE IF NOT EXISTS "${req.userSchema}".ia_settings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                settings JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            )
        `);
        
        // Vérifier si des paramètres existent déjà
        const checkResult = await req.app.locals.pool.query(`
            SELECT id FROM "${req.userSchema}".ia_settings 
            WHERE user_id = $1
            LIMIT 1
        `, [req.user.id]);
        
        let result;
        
        if (checkResult.rows.length > 0) {
            // Mettre à jour
            result = await req.app.locals.pool.query(`
                UPDATE "${req.userSchema}".ia_settings 
                SET settings = $1, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = $2 
                RETURNING *
            `, [JSON.stringify(settings), req.user.id]);
        } else {
            // Créer
            result = await req.app.locals.pool.query(`
                INSERT INTO "${req.userSchema}".ia_settings 
                (user_id, settings, created_at, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `, [req.user.id, JSON.stringify(settings)]);
        }
        
        res.json({
            success: true,
            message: 'Paramètres IA sauvegardés',
            settings: settings,
            id: result.rows[0].id
        });
        
    } catch (error) {
        console.error('❌ Erreur sauvegarde paramètres IA:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur sauvegarde paramètres IA',
            message: error.message
        });
    }
});

module.exports = router;