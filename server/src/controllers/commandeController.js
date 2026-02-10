// Import des modèles nécessaires

const { Op, Sequelize } = require('sequelize');
const { Commande, Produit } = require('../models/index');


/**
 * GET : récupérer toutes les commandes avec leurs produits
 */
exports.getCommandes = async (req, res) => {
  try {
    // ⚡ Récupérer toutes les commandes avec les produits associés
    const commandes = await Commande.findAll({
      include: [
        {
          model: Produit,
          through: { attributes: ['quantite'] } // ⚡ Inclure la quantité depuis la table pivot
        }
      ]
    });
    return res.json(commandes); // ⚡ Toujours renvoyer une réponse
  } catch (error) {
    console.error('Erreur GET Commandes:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * POST : créer une nouvelle commande avec calcul du total et gestion du stock
 */
exports.createCommande = async (req, res) => {
  try {
    const { contactId, produits } = req.body;

    // ⚡ Vérifier que le contact existe
    const contact = await Contact.findByPk(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact non trouvé' });
    }

    // ⚡ Créer la commande
    const commande = await Commande.create({ contactId });

    let total = 0; // ⚡ Initialiser le total

    // ⚡ Vérifier et ajouter les produits
    if (produits && produits.length > 0) {
      await Promise.all(
        produits.map(async (p) => {
          // ⚡ Récupérer le produit par son ID
          const produit = await Produit.findByPk(p.produitId);
          if (!produit) {
            throw new Error(`Produit ID ${p.produitId} introuvable`);
          }

          // ⚡ Calculer le total
          total += produit.prix * (p.quantite || 1);

          // ⚡ Décrémenter le stock
          produit.stock -= p.quantite;
          await produit.save();

          // ⚡ Vérifier le stock avant d'ajouter un produit
          if (produit.stock < p.quantite) {
          throw new Error(`Stock insuffisant pour le produit ${produit.nom}. Stock actuel: ${produit.stock}`);
          }


          // ⚡ Ajouter le produit à la commande avec la quantité
          
          await commande.addProduit(produit, { through: { quantite: p.quantite || 1 } });
        })
      );
    }

    // ⚡ Mettre à jour le total de la commande
    await commande.update({ total });

    // ⚡ Recharger la commande avec ses produits
    const commandeComplete = await Commande.findByPk(commande.id, {
      include: [
        {
          model: Produit,
          through: { attributes: ['quantite'] } // ⚡ Afficher la quantité dans la réponse
        }
      ]
    });

    return res.status(201).json(commandeComplete);
  } catch (error) {
    console.error('Erreur POST Commande:', error.message);
    return res.status(500).json({ error: error.message });
  }
};


/**
 * PUT : mettre à jour le statut d'une commande
 */
exports.updateStatut = async (req, res) => {
  try {
    const commande = await Commande.findByPk(req.params.id);
    if (!commande) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // ⚡ Mettre à jour le statut
    commande.statut = req.body.statut;
    await commande.save();

    return res.json(commande);
  } catch (error) {
    console.error('Erreur PUT Statut:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET : commandes d’un contact avec filtre de période
 * Exemple: /commandes/contact/1?start=2025-01-01&end=2025-01-31
 */
exports.getCommandesByContact = async (req, res) => {
  try {
    const { start, end } = req.query;
    const where = { contactId: req.params.contactId };

    // ⚡ Vérifier si start et end sont fournis
    if (start && end) {
      where.date = { [Op.between]: [start, end] };
    }

    const commandes = await Commande.findAll({
      where,
      include: [
        {
          model: Produit,
          through: { attributes: ['quantite'] }
        }
      ]
    });

    return res.json(commandes);
  } catch (error) {
    console.error('Erreur GET Commandes par contact:', error);
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};


/**
 * GET : commandes par statut
 * Exemple: /commandes?statut=validée
 */
exports.getCommandes = async (req, res) => {
  try {
    const { statut } = req.query;
    const where = {};
    if (statut) where.statut = statut;

    const commandes = await Commande.findAll({
      where,
      include: [{ model: Produit, through: { attributes: ['quantite'] } }]
    });

    return res.json(commandes);
  } catch (error) {
    console.error('Erreur GET Commandes:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET : commandes d’un contact avec filtre de période
 * Exemple: /commandes/contact/1?start=2025-01-01&end=2025-01-31
 */
exports.getCommandesByContact = async (req, res) => {
  try {
    const { start, end } = req.query;
    const where = { contactId: req.params.contactId };
    if (start && end) {
      where.date = { [Sequelize.Op.between]: [start, end] };
    }

    const commandes = await Commande.findAll({
      where,
      include: [{ model: Produit, through: { attributes: ['quantite'] } }]
    });

    return res.json(commandes);
  } catch (error) {
    console.error('Erreur GET Commandes par contact:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

