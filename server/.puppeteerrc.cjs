const path = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Change le répertoire de cache pour qu'il soit dans le dossier du projet
  cacheDirectory: path.join(__dirname, 'node_modules', '.cache', 'puppeteer'),
};
