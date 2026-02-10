// Import du modèle Produit
const Produit = require('../models/Produit');

/**
 * GET : récupérer tous les produits
 */
exports.getProduits = async (req, res) => {
  try {
    const produits = await Produit.findAll(); // Récupère tous les produits
    res.json(produits); // Retourne en JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST : ajouter un nouveau produit
 */
exports.createProduit = async (req, res) => {
  try {
    const { nom, description, prix, stock, image, codeBarres } = req.body;
    const newProduit = await Produit.create({ nom, description, prix, stock, image, codeBarres });
    res.status(201).json(newProduit); // Retourne le produit créé
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};



// PUT : mettre à jour un produit existant
exports.updateProduit = async (req, res) => {
  try {
    const { id } = req.params; // Récupère l'ID dans l'URL
    const { nom, description, prix, stock, image, codeBarres } = req.body;

    // Recherche du produit par ID
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Mise à jour des champs
    await produit.update({ nom, description, prix, stock, image, codeBarres });

    // Retourne le produit mis à jour
    res.json(produit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};


/**
 * DELETE : supprimer un produit
 */
exports.deleteProduit = async (req, res) => {
  try {
    const { id } = req.params; // ID du produit à supprimer

    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    await produit.destroy(); // Suppression
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
