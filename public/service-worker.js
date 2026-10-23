/*
 * Service worker minimal pour la Garderie École d'Hesloup.
 *
 * Rôle : rendre l'application "installable" (icône sur l'écran d'accueil,
 * ouverture en plein écran). Il NE met volontairement PAS les pages en cache,
 * pour éviter tout problème de version obsolète : chaque ouverture charge
 * la dernière version depuis le serveur, comme dans un navigateur classique.
 *
 * C'est un choix prudent : on gagne le côté "application installée" sans
 * les complications de la mise en cache hors-ligne.
 */

// Installation : on s'active immédiatement, sans rien mettre en cache.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activation : on prend le contrôle des onglets ouverts immédiatement.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Requêtes réseau : on laisse tout passer normalement vers le serveur.
// (Pas d'interception ni de cache : comportement identique au navigateur.)
self.addEventListener("fetch", (event) => {
  // On ne fait rien de spécial : le navigateur gère la requête comme d'habitude.
  return;
});
