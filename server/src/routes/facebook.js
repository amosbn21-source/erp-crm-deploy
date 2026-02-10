const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/facebook/pages - Récupérer les pages Facebook
router.post('/facebook/pages', async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Access token requis'
      });
    }
    
    console.log('🔍 Récupération pages Facebook avec access_token');
    
    // Appel à l'API Graph Facebook
    const response = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        access_token,
        fields: 'id,name,access_token,permissions,category,picture{url}',
        limit: 50
      }
    });
    
    if (response.data && response.data.data) {
      const pages = response.data.data.map(page => ({
        id: page.id,
        name: page.name,
        access_token: page.access_token,
        category: page.category,
        permissions: page.permissions,
        picture: page.picture?.data?.url
      }));
      
      return res.json({
        success: true,
        pages,
        count: pages.length
      });
    } else {
      return res.json({
        success: false,
        error: 'Aucune page trouvée',
        pages: []
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur récupération pages Facebook:', error.response?.data || error.message);
    
    // Erreur spécifique Facebook
    if (error.response?.data?.error) {
      return res.status(400).json({
        success: false,
        error: `Facebook API: ${error.response.data.error.message}`,
        code: error.response.data.error.code
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des pages Facebook'
    });
  }
});

module.exports = router;