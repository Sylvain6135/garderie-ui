import React, { useState, useEffect } from "react";
import {
  Users, ClipboardCheck, Euro, CalendarDays,
  LayoutDashboard, LogIn, LogOut, Clock, ChevronDown,
  Plus, Pencil, Trash2, Check, X, History,
  BarChart3, AlertTriangle, FileDown, UserPlus, Settings, Shield, Search
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from "recharts";

/* =====================================================================
   Couche API — communication avec le back-end
   ---------------------------------------------------------------------
   Toutes les requêtes vers le serveur passent par ici.
   * API_BASE : adresse du back-end. Par défaut, on suppose qu'il est servi
     derrière le même domaine, sous /api (via le reverse proxy). En
     développement, on peut pointer vers http://IP_DU_NAS:3000.
   * Le jeton de connexion est conservé en mémoire (variable module) et
     ajouté automatiquement à chaque requête protégée.
   ===================================================================== */
const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "/api";

// Clés de stockage navigateur (pour "rester connecté").
const CLE_JETON = "garderie_jeton";
const CLE_SESSION = "garderie_session";

let _jeton = null;
export function definirJeton(j) { _jeton = j; }

// Récupère un éventuel jeton mémorisé au démarrage (session persistante).
function lireStockage(cle) {
  try { return typeof window !== "undefined" ? window.localStorage.getItem(cle) : null; }
  catch { return null; } // stockage indisponible (mode privé, artefact bridé…)
}
function ecrireStockage(cle, valeur) {
  try {
    if (typeof window === "undefined") return;
    if (valeur === null) window.localStorage.removeItem(cle);
    else window.localStorage.setItem(cle, valeur);
  } catch { /* stockage indisponible : on ignore silencieusement */ }
}

// Mémorise (ou efface) la session pour "rester connecté".
export function memoriserSession(jeton, utilisateur) {
  ecrireStockage(CLE_JETON, jeton);
  ecrireStockage(CLE_SESSION, utilisateur ? JSON.stringify(utilisateur) : null);
}
export function effacerSessionMemorisee() {
  ecrireStockage(CLE_JETON, null);
  ecrireStockage(CLE_SESSION, null);
}
// Lit une session mémorisée au démarrage : { jeton, utilisateur } ou null.
export function lireSessionMemorisee() {
  const jeton = lireStockage(CLE_JETON);
  const brut = lireStockage(CLE_SESSION);
  if (!jeton || !brut) return null;
  try { return { jeton, utilisateur: JSON.parse(brut) }; }
  catch { return null; }
}

async function apiFetch(chemin, options = {}) {
  const enTetes = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (_jeton) enTetes.Authorization = `Bearer ${_jeton}`;

  let reponse;
  try {
    reponse = await fetch(`${API_BASE}${chemin}`, { ...options, headers: enTetes });
  } catch (e) {
    // Erreur réseau (serveur injoignable, coupure…)
    throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion.");
  }

  let donnees = null;
  try { donnees = await reponse.json(); } catch { /* réponse sans corps JSON */ }

  if (!reponse.ok) {
    const message = donnees?.erreur || `Erreur ${reponse.status}`;
    // Jeton invalide ou expiré : on nettoie la session mémorisée pour forcer
    // une reconnexion propre (utile quand "rester connecté" a expiré).
    if (reponse.status === 401) {
      _jeton = null;
      effacerSessionMemorisee();
    }
    throw new Error(message);
  }
  return donnees;
}

/* Fonctions d'API par domaine — on les étoffera écran par écran. */
const api = {
  // Authentification
  async connexion(login, motDePasse, resterConnecte) {
    const d = await apiFetch("/auth/connexion", {
      method: "POST",
      body: JSON.stringify({ login, mot_de_passe: motDePasse, rester_connecte: !!resterConnecte }),
    });
    if (d?.jeton) definirJeton(d.jeton);
    return d; // { succes, jeton, utilisateur }
  },

  // Enfants
  async listerEnfants() {
    const d = await apiFetch("/enfants");
    return d.enfants || [];
  },
  async creerEnfant(donnees) {
    return apiFetch("/enfants", { method: "POST", body: JSON.stringify(donnees) });
  },
  async modifierEnfant(id, donnees) {
    return apiFetch(`/enfants/${id}`, { method: "PUT", body: JSON.stringify(donnees) });
  },
  async supprimerEnfant(id) {
    return apiFetch(`/enfants/${id}`, { method: "DELETE" });
  },
  async changerFormule(id, formule) {
    return apiFetch(`/enfants/${id}/formule`, {
      method: "PUT",
      body: JSON.stringify({ formule }),
    });
  },

  // Pointage
  async listerPresents() {
    const d = await apiFetch("/pointage/presents");
    return d.presents || [];
  },
  async pointerArrivee(enfantId) {
    return apiFetch("/pointage/arrivee", {
      method: "POST",
      body: JSON.stringify({ enfant_id: enfantId }),
    });
  },
  async pointerDepart(enfantId) {
    return apiFetch("/pointage/depart", {
      method: "POST",
      body: JSON.stringify({ enfant_id: enfantId }),
    });
  },

  // Facturation (réservée admin)
  async recapFacturation(trimestre, annee) {
    const d = await apiFetch(`/facturation?trimestre=${trimestre}&annee=${encodeURIComponent(annee)}`);
    return d; // { lignes, total_eur, impayes_eur, ... }
  },
  async changerStatutPaiement(enfantId, trimestre, annee, statut) {
    return apiFetch("/facturation/statut", {
      method: "PUT",
      body: JSON.stringify({ enfant_id: enfantId, trimestre, annee, statut }),
    });
  },
  async detailFacture(enfantId, trimestre, annee) {
    return apiFetch(`/facturation/detail?enfant_id=${enfantId}&trimestre=${trimestre}&annee=${encodeURIComponent(annee)}`);
  },
  async factureFamille(familleId, trimestre, annee) {
    return apiFetch(`/facturation/famille?famille_id=${familleId}&trimestre=${trimestre}&annee=${encodeURIComponent(annee)}`);
  },
  // Report de facturation (seuil 15 €)
  async recapAvecReport(trimestre, annee) {
    return apiFetch(`/facturation/avec-report?trimestre=${trimestre}&annee=${encodeURIComponent(annee)}`);
  },
  async listerReports(trimestre, annee) {
    const d = await apiFetch(`/facturation/reports?trimestre=${trimestre}&annee=${encodeURIComponent(annee)}`);
    return d.reports || [];
  },
  async enregistrerReport(familleId, trimestre, annee, montant) {
    return apiFetch(`/facturation/reports`, {
      method: "PUT",
      body: JSON.stringify({ famille_id: familleId, trimestre, annee, montant }),
    });
  },

  // Administration (réservée admin) : forfait et créneaux
  async lireForfait() {
    const d = await apiFetch("/admin/forfait");
    return d.forfait; // { montant_eur, ... } ou null
  },
  async changerForfait(montant) {
    return apiFetch("/admin/forfait", {
      method: "PUT",
      body: JSON.stringify({ montant_eur: montant }),
    });
  },
  async listerCreneaux() {
    const d = await apiFetch("/admin/creneaux");
    return d.creneaux || [];
  },
  async creerCreneau(donnees) {
    return apiFetch("/admin/creneaux", { method: "POST", body: JSON.stringify(donnees) });
  },
  async modifierCreneau(id, donnees) {
    return apiFetch(`/admin/creneaux/${id}`, { method: "PUT", body: JSON.stringify(donnees) });
  },
  async supprimerCreneau(id) {
    return apiFetch(`/admin/creneaux/${id}`, { method: "DELETE" });
  },
  async lireCoordonnees() {
    const d = await apiFetch("/admin/coordonnees");
    return d.coordonnees || {};
  },
  async enregistrerCoordonnees(coord) {
    return apiFetch("/admin/coordonnees", { method: "PUT", body: JSON.stringify(coord) });
  },
  async lireLogo() {
    const d = await apiFetch("/admin/logo");
    return d.logo || "";
  },
  async enregistrerLogo(logo) {
    return apiFetch("/admin/logo", { method: "PUT", body: JSON.stringify({ logo }) });
  },

  // Dates de trimestre configurables (réservé admin pour l'écriture)
  async lireTrimestres() {
    return apiFetch("/admin/trimestres"); // { fin_t1, fin_t2, fin_t3 }
  },
  async enregistrerTrimestres(fin_t1, fin_t2, fin_t3) {
    return apiFetch("/admin/trimestres", {
      method: "PUT",
      body: JSON.stringify({ fin_t1, fin_t2, fin_t3 }),
    });
  },
  async recalculerTrimestres() {
    return apiFetch("/admin/trimestres/recalculer", { method: "POST" });
  },

  // Gestion des comptes utilisateurs (réservé admin)
  async listerUtilisateurs() {
    const d = await apiFetch("/utilisateurs");
    return d.utilisateurs || [];
  },
  async creerUtilisateur(donnees) {
    return apiFetch("/utilisateurs", { method: "POST", body: JSON.stringify(donnees) });
  },
  async modifierUtilisateur(id, donnees) {
    return apiFetch(`/utilisateurs/${id}`, { method: "PUT", body: JSON.stringify(donnees) });
  },
  async reinitialiserMotDePasse(id, motDePasse) {
    return apiFetch(`/utilisateurs/${id}/motdepasse`, {
      method: "PUT", body: JSON.stringify({ mot_de_passe: motDePasse }),
    });
  },
  async changerActivationUtilisateur(id, actif) {
    return apiFetch(`/utilisateurs/${id}/actif`, {
      method: "PUT", body: JSON.stringify({ actif }),
    });
  },
  async supprimerUtilisateur(id) {
    return apiFetch(`/utilisateurs/${id}`, { method: "DELETE" });
  },

  // Statistiques
  async frequentation(debut, fin) {
    const d = await apiFetch(`/stats/frequentation?debut=${debut}&fin=${fin}`);
    return d; // { jours, moyenne_par_jour, maximum, ... }
  },
  async historique(debut, fin) {
    const d = await apiFetch(`/stats/historique?debut=${debut}&fin=${fin}`);
    return d.jours || [];
  },

  // Corrections de pointage (admin)
  async listerPointagesCorrection(debut, fin) {
    const d = await apiFetch(`/corrections?debut=${debut}&fin=${fin}`);
    return d.pointages || [];
  },
  async ajouterPointageManuel(enfantId, jour, heureArrivee, heureDepart) {
    return apiFetch(`/corrections`, {
      method: "POST",
      body: JSON.stringify({
        enfant_id: enfantId, jour,
        heure_arrivee: heureArrivee, heure_depart: heureDepart,
      }),
    });
  },
  async modifierPointage(id, heureArrivee, heureDepart) {
    return apiFetch(`/corrections/${id}`, {
      method: "PUT",
      body: JSON.stringify({ heure_arrivee: heureArrivee, heure_depart: heureDepart }),
    });
  },
  async supprimerPointage(id) {
    return apiFetch(`/corrections/${id}`, { method: "DELETE" });
  },
};

/* ---------------------------------------------------------------------
   Adaptation entre la forme "API" et la forme "interface".
   L'API sépare prenom/nom et nomme contact_urgence ; l'interface utilise
   un "nom" complet et "urgence". Ces deux fonctions font le pont, pour ne
   pas avoir à réécrire tout l'affichage.
   --------------------------------------------------------------------- */
function enfantDepuisAPI(e) {
  return {
    id: e.id,
    nom: `${e.prenom || ""} ${e.nom || ""}`.trim(),
    prenom: e.prenom || "",
    nomFamille: e.nom || "",
    classe: e.classe || "",
    parent: e.parent || "",
    allergies: e.allergies || "",
    urgence: e.contact_urgence || "",
    autorises: e.personnes_autorisees || "",
    // Champs d'affichage non fournis par cette route : valeurs par défaut,
    // ils seront alimentés plus tard par le pointage / la facturation.
    formule: e.formule || "forfait",
    statut: "absent", arrivee: null, depart: null, passages: [],
    paiement: "attente",
  };
}

// Sépare un "nom complet" en prénom + nom pour l'envoi à l'API.
function decouperNom(nomComplet) {
  const parts = (nomComplet || "").trim().split(/\s+/);
  if (parts.length === 0) return { prenom: "", nom: "" };
  if (parts.length === 1) return { prenom: parts[0], nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

// Pont créneau : l'API utilise heure_debut/heure_fin/mode_facturation/montant_eur,
// l'interface utilise debut/fin/mode/montant.
function creneauDepuisAPI(c) {
  return {
    id: c.id,
    nom: c.nom,
    debut: (c.heure_debut || "").slice(0, 5),
    fin: (c.heure_fin || "").slice(0, 5),
    mode: c.mode_facturation,
    montant: Number(c.montant_eur) || 0,
  };
}
function creneauVersAPI(c) {
  return {
    nom: c.nom,
    heure_debut: c.debut,
    heure_fin: c.fin,
    mode_facturation: c.mode,
    montant_eur: Math.max(0, parseFloat(c.montant) || 0),
  };
}


/* ---------- Palette « craie & ardoise » ---------- */
const C = {
  ink: "#22304A",       // ardoise foncée
  paper: "#F7F6F2",     // papier
  card: "#FFFFFF",
  yellow: "#F5B82E",    // craie jaune (accent)
  green: "#2E9E6B",     // présent
  red: "#D96A5B",       // parti
  grey: "#8A94A6",
  line: "#E6E4DC",
};

const today = new Date().toLocaleDateString("fr-FR", {
  weekday: "long", day: "numeric", month: "long",
});

const PRIX_FORFAIT_DEFAUT = 130;  // €/trimestre — forfait unique
const FERMETURE = "18:30";        // heure de fermeture : les compteurs s'arrêtent ici

/* ---------- Créneaux horaires (formule à la carte) ---------- */
// mode "forfait" : montant fixe dès l'entrée dans le créneau
// mode "heure"   : tarif horaire × temps réellement passé (au prorata de la minute)
const initCreneaux = [
  { id: 1, nom: "Accueil du matin", debut: "07:30", fin: "08:30", mode: "forfait", montant: 2.5 },
  { id: 2, nom: "Étude du soir", debut: "16:30", fin: "18:00", mode: "heure", montant: 3 },
  { id: 3, nom: "Garde tardive", debut: "18:00", fin: "19:00", mode: "heure", montant: 4 },
];

/* ---------- Trimestres scolaires ---------- */
// Bornes indicatives des trimestres scolaires français
const TRIMESTRES = [
  { id: "t1", label: "1er trimestre", periode: "sept. – déc.", debutMois: 9, finMois: 12 },
  { id: "t2", label: "2e trimestre", periode: "janv. – mars", debutMois: 1, finMois: 3 },
  { id: "t3", label: "3e trimestre", periode: "avr. – juil.", debutMois: 4, finMois: 7 },
];

// Libellé de période d'un trimestre, calculé depuis les dates configurées
// (ex. "1 sept. – 30 nov."). Retombe sur le libellé figé si pas de dates.
const fmtDateCourte = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const periodeTrimestre = (id, dates) => {
  const fige = (TRIMESTRES.find((t) => t.id === id) || {}).periode || "";
  if (!dates || !dates.fin_t1 || !dates.fin_t2 || !dates.fin_t3) return fige;
  // Début de chaque trimestre = lendemain de la fin du précédent.
  const lendemain = (iso) => {
    const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  if (id === "t1") return `jusqu'au ${fmtDateCourte(dates.fin_t1)}`;
  if (id === "t2") return `${fmtDateCourte(lendemain(dates.fin_t1))} – ${fmtDateCourte(dates.fin_t2)}`;
  if (id === "t3") return `${fmtDateCourte(lendemain(dates.fin_t2))} – ${fmtDateCourte(dates.fin_t3)}`;
  return fige;
};
const trimestreCourant = () => {
  const m = new Date().getMonth() + 1;
  if (m >= 9 && m <= 12) return "t1";
  if (m >= 1 && m <= 3) return "t2";
  return "t3";
};

// Année scolaire au format "2025-2026" (bascule en septembre).
const anneeScolaireCourante = () => {
  const d = new Date();
  const annee = d.getFullYear();
  const mois = d.getMonth() + 1;
  // De septembre à décembre : année N à N+1. De janvier à août : N-1 à N.
  return mois >= 9 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
};

/* ---------- Comptes utilisateurs (démonstration) ---------- */
const initUsers = [
  { id: 1, nom: "Sophie Renard", identifiant: "sophie", email: "sophie@garderie-hesloup.fr", mdp: "admin123", role: "admin" },
  { id: 2, nom: "Karim Benali", identifiant: "karim", email: "karim@garderie-hesloup.fr", mdp: "karim123", role: "membre" },
];

/* ---------- Données de démonstration ---------- */
const initChildren = [
  { id: 1, nom: "Léa Martin", classe: "CP", formule: "forfait", parent: "Mme Martin", statut: "absent", arrivee: null, depart: null, passages: [], allergies: "Arachides", urgence: "Mme Martin · 06 12 34 56 78", autorises: "Mme Martin, M. Martin", paiement: "paye" },
  { id: 2, nom: "Hugo Bernard", classe: "CE1", formule: "carte", parent: "M. Bernard", statut: "absent", arrivee: null, depart: null, passages: [{ creneauId: 2, minutes: 90, cout: 4.5, trimestre: "t1" }, { creneauId: 2, minutes: 80, cout: 4, trimestre: "t1" }, { creneauId: 1, minutes: 60, cout: 2.5, trimestre: "t2" }], allergies: "", urgence: "M. Bernard · 06 23 45 67 89", autorises: "M. Bernard, Mme Rousseau (tante)", paiement: "attente" },
  { id: 3, nom: "Chloé Dubois", classe: "CM1", formule: "forfait", parent: "Mme Dubois", statut: "present", arrivee: "16:30", depart: null, passages: [], allergies: "Gluten", urgence: "Mme Dubois · 06 34 56 78 90", autorises: "Mme Dubois", paiement: "paye" },
  { id: 4, nom: "Nathan Petit", classe: "CE2", formule: "carte", parent: "M. Petit", statut: "present", arrivee: "16:32", depart: null, passages: [{ creneauId: 2, minutes: 75, cout: 3.75, trimestre: "t1" }, { creneauId: 3, minutes: 45, cout: 3, trimestre: "t2" }], allergies: "", urgence: "M. Petit · 06 45 67 89 01", autorises: "M. Petit, Mme Petit (grand-mère)", paiement: "relance" },
  { id: 5, nom: "Emma Leroy", classe: "CP", formule: "forfait", parent: "Mme Leroy", statut: "absent", arrivee: null, depart: null, passages: [], allergies: "", urgence: "Mme Leroy · 06 56 78 90 12", autorises: "Mme Leroy, M. Leroy", paiement: "attente" },
  { id: 6, nom: "Louis Moreau", classe: "CM2", formule: "carte", parent: "Mme Moreau", statut: "parti", arrivee: "16:28", depart: "17:45", passages: [{ creneauId: 2, minutes: 77, cout: 3.85, trimestre: "t2" }], allergies: "Piqûres d'abeille (EpiPen dans le sac)", urgence: "Mme Moreau · 06 67 89 01 23", autorises: "Mme Moreau", paiement: "paye" },
  { id: 7, nom: "Jade Fournier", classe: "CE1", formule: "forfait", parent: "M. Fournier", statut: "present", arrivee: "16:35", depart: null, passages: [], allergies: "", urgence: "M. Fournier · 06 78 90 12 34", autorises: "M. Fournier, Mme Blanc (voisine)", paiement: "paye" },
  { id: 8, nom: "Tom Girard", classe: "CE2", formule: "carte", parent: "Mme Girard", statut: "absent", arrivee: null, depart: null, passages: [{ creneauId: 1, minutes: 55, cout: 2.5, trimestre: "t3" }], allergies: "Lactose", urgence: "Mme Girard · 06 89 01 23 45", autorises: "Mme Girard", paiement: "attente" },
];


/* ---------- Historique des présences ---------- */
const duree = (a, d) => {
  if (!a || !d) return null;
  const [h1, m1] = a.split(":").map(Number);
  const [h2, m2] = d.split(":").map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
};

// Minutes écoulées entre deux heures "HH:MM" (0 si invalide)
const minutesEntre = (a, d) => {
  if (!a || !d) return 0;
  const [h1, m1] = a.split(":").map(Number);
  const [h2, m2] = d.split(":").map(Number);
  return Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
};

// Convertit une heure en minutes depuis minuit. Robuste : accepte "HH:MM",
// "HH:MM:SS", et même des formats à la française comme "12 h 15" en extrayant
// les deux premiers nombres présents. Renvoie 0 si rien d'exploitable.
const enMinutes = (t) => {
  if (!t) return 0;
  const nombres = String(t).match(/\d+/g);
  if (!nombres || nombres.length < 1) return 0;
  const h = Number(nombres[0]) || 0;
  const m = nombres.length > 1 ? Number(nombres[1]) || 0 : 0;
  return h * 60 + m;
};

// Plafonne une heure "HH:MM" à l'heure de fermeture (jamais au-delà de 18h30)
const plafonneFermeture = (heureStr) => {
  if (!heureStr) return FERMETURE;
  return enMinutes(heureStr) > enMinutes(FERMETURE) ? FERMETURE : heureStr;
};

// Trouve le créneau correspondant à une heure d'arrivée (le premier qui contient l'heure)
const creneauPourHeure = (creneaux, heureStr) => {
  const t = enMinutes(heureStr);
  return creneaux.find((c) => t >= enMinutes(c.debut) && t < enMinutes(c.fin)) || null;
};

// Minutes de chevauchement entre [arrivée, départ] et un créneau [début, fin]
const chevauchement = (arrivee, depart, creneau) => {
  const a = Math.max(enMinutes(arrivee), enMinutes(creneau.debut));
  const b = Math.min(enMinutes(depart), enMinutes(creneau.fin));
  return Math.max(0, b - a);
};

// Coût d'un nombre de minutes dans un créneau donné (toute heure commencée est due)
const coutMinutesCreneau = (creneau, minutes) => {
  if (!creneau || minutes <= 0) return 0;
  if (creneau.mode === "forfait") return creneau.montant;       // montant fixe dès l'entrée
  const heuresDues = Math.ceil(minutes / 60);                   // heure commencée = heure due
  return +(heuresDues * creneau.montant).toFixed(2);
};

// Décompose une présence [arrivée → départ] en lignes facturées, une par créneau traversé
const passagesDepuisPresence = (creneaux, arrivee, depart) => {
  const lignes = [];
  creneaux.forEach((c) => {
    const min = chevauchement(arrivee, depart, c);
    if (min > 0) lignes.push({ creneauId: c.id, minutes: min, cout: coutMinutesCreneau(c, min) });
  });
  return lignes;
};

// Formate un total de minutes en "Xh YYmin"
const fmtMinutes = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
};

// Libellés des formules d'inscription
const LABEL_FORMULE = { forfait: "Forfait trimestriel", carte: "À la carte" };
const LABEL_FORMULE_COURT = { forfait: "Forfait", carte: "À la carte" };
const estForfait = (f) => f === "forfait";

// Génère les n derniers jours ouvrés (hors week-end) avant aujourd'hui
const derniersJoursOuvres = (n) => {
  const dates = [];
  const d = new Date();
  while (dates.length < n) {
    d.setDate(d.getDate() - 1);
    const j = d.getDay();
    if (j !== 0 && j !== 6) dates.push(new Date(d));
  }
  return dates;
};
const fmtDate = (d) =>
  d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const modelesJournees = [
  [
    { nom: "Léa Martin", arrivee: "16:30", depart: "18:05" },
    { nom: "Hugo Bernard", arrivee: "16:28", depart: "17:30" },
    { nom: "Chloé Dubois", arrivee: "16:31", depart: "18:20" },
    { nom: "Jade Fournier", arrivee: "16:35", depart: "18:00" },
    { nom: "Louis Moreau", arrivee: "16:27", depart: "17:45" },
  ],
  [
    { nom: "Léa Martin", arrivee: "16:29", depart: "17:50" },
    { nom: "Nathan Petit", arrivee: "16:33", depart: "18:15" },
    { nom: "Emma Leroy", arrivee: "16:30", depart: "18:25" },
    { nom: "Jade Fournier", arrivee: "16:36", depart: "17:40" },
  ],
  [
    { nom: "Chloé Dubois", arrivee: "16:32", depart: "18:10" },
    { nom: "Tom Girard", arrivee: "16:29", depart: "17:35" },
    { nom: "Emma Leroy", arrivee: "16:31", depart: "18:00" },
    { nom: "Hugo Bernard", arrivee: "16:30", depart: "18:28" },
    { nom: "Louis Moreau", arrivee: "16:34", depart: "17:55" },
    { nom: "Léa Martin", arrivee: "16:28", depart: "18:12" },
  ],
];
const initHistorique = derniersJoursOuvres(3).map((d, i) => ({
  id: i + 1,
  date: fmtDate(d),
  entrees: modelesJournees[i],
}));

/* ---------- Présences de la semaine (vue calendrier) ---------- */
// jour : 0 = lundi ... 4 = vendredi. Données de démonstration cohérentes avec les créneaux.
const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const presencesSemaine = [
  { jour: 0, nom: "Léa Martin", arrivee: "16:30", depart: "18:05", formule: "forfait" },
  { jour: 0, nom: "Chloé Dubois", arrivee: "16:30", depart: "18:20", formule: "forfait" },
  { jour: 0, nom: "Hugo Bernard", arrivee: "16:32", depart: "18:00", formule: "carte" },
  { jour: 0, nom: "Tom Girard", arrivee: "07:35", depart: "08:25", formule: "carte" },
  { jour: 1, nom: "Léa Martin", arrivee: "16:30", depart: "17:50", formule: "forfait" },
  { jour: 1, nom: "Jade Fournier", arrivee: "16:35", depart: "18:25", formule: "forfait" },
  { jour: 1, nom: "Nathan Petit", arrivee: "16:32", depart: "18:15", formule: "carte" },
  { jour: 2, nom: "Chloé Dubois", arrivee: "16:30", depart: "18:10", formule: "forfait" },
  { jour: 2, nom: "Emma Leroy", arrivee: "16:30", depart: "18:00", formule: "forfait" },
  { jour: 2, nom: "Hugo Bernard", arrivee: "07:40", depart: "08:30", formule: "carte" },
  { jour: 2, nom: "Louis Moreau", arrivee: "16:28", depart: "18:30", formule: "carte" },
  { jour: 3, nom: "Léa Martin", arrivee: "16:30", depart: "18:15", formule: "forfait" },
  { jour: 3, nom: "Jade Fournier", arrivee: "16:35", depart: "18:20", formule: "forfait" },
  { jour: 3, nom: "Nathan Petit", arrivee: "16:40", depart: "18:30", formule: "carte" },
  { jour: 4, nom: "Chloé Dubois", arrivee: "16:30", depart: "17:55", formule: "forfait" },
  { jour: 4, nom: "Emma Leroy", arrivee: "16:30", depart: "18:10", formule: "forfait" },
  { jour: 4, nom: "Jade Fournier", arrivee: "16:35", depart: "18:00", formule: "forfait" },
  { jour: 4, nom: "Tom Girard", arrivee: "16:33", depart: "18:05", formule: "carte" },
];

/* ---------- Petits composants ---------- */
const Badge = ({ children, color, bg }) => (
  <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color, backgroundColor: bg }}>
    {children}
  </span>
);

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-2xl p-4 flex items-center gap-3 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
    <div className="rounded-xl p-2" style={{ backgroundColor: accent + "22" }}>
      <Icon size={22} style={{ color: accent }} />
    </div>
    <div>
      <div className="text-2xl font-bold" style={{ color: C.ink }}>{value}</div>
      <div className="text-xs" style={{ color: C.grey }}>{label}</div>
    </div>
  </div>
);

/* ---------- Application ---------- */
export default function GarderieApp() {
  const [tab, setTab] = useState("pointage");
  const [enfants, setEnfants] = useState([]);            // chargés depuis l'API après connexion
  const [enfantsCharges, setEnfantsCharges] = useState(false);
  const [erreurEnfants, setErreurEnfants] = useState("");
  const [recapFacturation, setRecapFacturation] = useState(null);  // récap du trimestre depuis l'API
  const [erreurFacturation, setErreurFacturation] = useState("");
  const [chargementFacturation, setChargementFacturation] = useState(false);
  // Report de facturation (seuil 15 €)
  const [recapReport, setRecapReport] = useState(null);       // récap par famille avec report
  const [reportOuvert, setReportOuvert] = useState(false);    // panneau report déplié
  const [reportSaisie, setReportSaisie] = useState({});       // { famille_id: montant } en cours de saisie
  const [reportMessage, setReportMessage] = useState("");
  const [rechercheReport, setRechercheReport] = useState(""); // recherche d'une famille dans le report
  const [familleReportSel, setFamilleReportSel] = useState(null); // famille sélectionnée pour saisie
  const [prixForfait, setPrixForfait] = useState(PRIX_FORFAIT_DEFAUT);
  const [creneaux, setCreneaux] = useState([]);           // chargés depuis l'API
  const [erreurAdmin, setErreurAdmin] = useState("");
  const [coordEnregistrees, setCoordEnregistrees] = useState(false);
  const [logo, setLogo] = useState("");           // logo de l'organisme (base64)
  const [logoMessage, setLogoMessage] = useState("");
  // Correction des pointages (admin)
  const [corrections, setCorrections] = useState([]);
  const [corrChargement, setCorrChargement] = useState(false);
  const [corrErreur, setCorrErreur] = useState("");
  const [corrMessage, setCorrMessage] = useState("");
  const [corrEnEdition, setCorrEnEdition] = useState(null); // id du pointage en cours d'édition
  const [corrArrivee, setCorrArrivee] = useState("");
  const [corrDepart, setCorrDepart] = useState("");
  // Formulaire d'ajout manuel de pointage
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [ajoutEnfant, setAjoutEnfant] = useState("");
  const [ajoutJour, setAjoutJour] = useState(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  const [ajoutArrivee, setAjoutArrivee] = useState("");
  const [ajoutDepart, setAjoutDepart] = useState("");
  const [corrDebut, setCorrDebut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  const [corrFin, setCorrFin] = useState(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  const [formCreneau, setFormCreneau] = useState(null);   // création / édition d'un créneau
  const [users, setUsers] = useState([]);
  const [erreurUsers, setErreurUsers] = useState("");
  const [session, setSession] = useState(null);        // utilisateur connecté
  const [formUser, setFormUser] = useState(null);      // création / édition d'un compte
  const [loginData, setLoginData] = useState({ identifiant: "", mdp: "" });
  const [resterConnecte, setResterConnecte] = useState(true);  // coché par défaut (confort)
  const [loginErreur, setLoginErreur] = useState("");
  const [formEnfant, setFormEnfant] = useState(null);   // fiche enfant en cours d'édition
  const [historique, setHistorique] = useState([]);   // chargé depuis l'API
  const [histoDebut, setHistoDebut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  const [histoFin, setHistoFin] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); // hier (aujourd'hui est affiché à part)
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  const [histoChargement, setHistoChargement] = useState(false);
  const [histoErreur, setHistoErreur] = useState("");
  const [jourOuvert, setJourOuvert] = useState(null);
  const [inscritsJour, setInscritsJour] = useState([]); // enfants à la carte inscrits aujourd'hui (local)
  const [ficheOuverte, setFicheOuverte] = useState(null);   // fiche détaillée dépliée (Familles)
  const [triEnfants, setTriEnfants] = useState({ champ: "nom", sens: "asc" }); // tri de la liste
  const [rechercheEnfant, setRechercheEnfant] = useState(""); // recherche par nom/prénom
  const [filtreClasseFamilles, setFiltreClasseFamilles] = useState(""); // filtre classe dans Familles
  const [filtreClassePointage, setFiltreClassePointage] = useState(""); // filtre classe au pointage
  const [recherchePointage, setRecherchePointage] = useState(""); // recherche nom/prénom au pointage
  const [listePointageVisible, setListePointageVisible] = useState(true); // afficher/masquer la liste
  const [periodePresence, setPeriodePresence] = useState("mois"); // jour | semaine | mois
  const [trimestre, setTrimestre] = useState(trimestreCourant());
  // Fréquentation réelle (statistiques)
  const dateISO = (d) => {
    const x = new Date(d);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  };
  const [statDebut, setStatDebut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return dateISO(d);
  });
  const [statFin, setStatFin] = useState(() => dateISO(new Date()));
  const [freqData, setFreqData] = useState(null);
  const [freqChargement, setFreqChargement] = useState(false);
  const [freqErreur, setFreqErreur] = useState("");
  const [coordFacturation, setCoordFacturation] = useState({
    organisme: "Garderie École d'Hesloup",
    adresse: "Le Bourg\n61250 Hesloup",
    siret: "",
    telephone: "02 33 00 00 00",
    email: "contact@garderie-hesloup.fr",
    iban: "",
    mentions: "Association loi 1901 — TVA non applicable, art. 293 B du CGI.",
  });
  const [confirmation, setConfirmation] = useState(null);   // { message, action } — demande de confirmation avant suppression
  // Dates de trimestre configurables
  const [datesTrimestres, setDatesTrimestres] = useState({ fin_t1: "", fin_t2: "", fin_t3: "" });
  const [trimestreMessage, setTrimestreMessage] = useState("");
  const [recalculEnCours, setRecalculEnCours] = useState(false);

  const demanderSuppression = (message, action) => setConfirmation({ message, action });

  /* --- Gestion des enfants (via l'API) --- */
  const enfantVide = { nom: "", classe: "", parent: "", formule: "carte", allergies: "", urgence: "", autorises: "" };

  // Ouvre le formulaire d'édition d'un enfant et remonte en haut de l'écran.
  const modifierEnfantUI = (e) => {
    setFormEnfant({
      id: e.id, nom: e.nom, classe: e.classe, parent: e.parent,
      formule: e.formule, allergies: e.allergies, urgence: e.urgence, autorises: e.autorises,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Clic sur une entête : trie par ce champ, ou inverse le sens si déjà actif.
  const trierPar = (champ) => {
    setTriEnfants((prev) =>
      prev.champ === champ
        ? { champ, sens: prev.sens === "asc" ? "desc" : "asc" }
        : { champ, sens: "asc" }
    );
  };

  // Liste des enfants filtrée par la recherche ET la classe, puis triée.
  const rechercheNorm = rechercheEnfant.trim().toLowerCase();
  const enfantsFiltres = enfants.filter((e) => {
    // Filtre par recherche (nom / prénom).
    const okRecherche = !rechercheNorm ||
      (e.nom || "").toLowerCase().includes(rechercheNorm) ||
      (e.prenom || "").toLowerCase().includes(rechercheNorm) ||
      (e.nomFamille || "").toLowerCase().includes(rechercheNorm);
    // Filtre par classe (n'affiche que la classe choisie, sans changer le tri).
    const okClasse = !filtreClasseFamilles || e.classe === filtreClasseFamilles;
    return okRecherche && okClasse;
  });

  const enfantsTries = [...enfantsFiltres].sort((a, b) => {
    const champ = triEnfants.champ;
    // Pour le nom, on trie sur le nom de famille puis le prénom si dispo.
    const valeur = (e) => {
      // Le nom est saisi "NOM Prénom" : trier sur la chaîne complète revient
      // à trier par nom de famille, sans avoir à la découper.
      if (champ === "nom") return (e.nom || "").toLowerCase();
      if (champ === "classe") return (e.classe || "").toLowerCase();
      if (champ === "parent") return (e.parent || "").toLowerCase();
      return "";
    };
    const va = valeur(a), vb = valeur(b);
    if (va < vb) return triEnfants.sens === "asc" ? -1 : 1;
    if (va > vb) return triEnfants.sens === "asc" ? 1 : -1;
    return 0;
  });

  // Rafraîchissement léger : met à jour uniquement les statuts de présence
  // (arrivées / départs) sans tout recharger. Utilisé par l'actualisation
  // automatique, pour que deux personnes qui pointent en même temps voient
  // rapidement l'état à jour.
  const rafraichirPresences = async () => {
    try {
      const presents = await api.listerPresents();
      const presentsParId = {};
      for (const p of presents) presentsParId[p.enfant_id] = (p.heure_arrivee || "").slice(0, 5);
      // Mettre à jour le statut de chaque enfant selon l'état réel du serveur.
      setEnfants((prev) => prev.map((e) => {
        const arrivee = presentsParId[e.id];
        if (arrivee) {
          // Présent selon le serveur.
          return e.statut === "present" && e.arrivee === arrivee
            ? e
            : { ...e, statut: "present", arrivee };
        } else {
          // Plus présent selon le serveur : s'il était marqué présent, il est parti.
          return e.statut === "present" ? { ...e, statut: "parti" } : e;
        }
      }));
      // Garder les enfants à la carte présents dans les inscrits du jour.
      const idsPresents = presents.map((p) => p.enfant_id);
      if (idsPresents.length > 0) {
        setInscritsJour((prev) => Array.from(new Set([...prev, ...idsPresents])));
      }
    } catch {
      // Silencieux : une actualisation ratée ne doit pas gêner l'utilisateur.
    }
  };

  // Charger les enfants depuis l'API dès qu'une session est ouverte.
  const chargerEnfants = async () => {
    try {
      setErreurEnfants("");
      const [liste, presents] = await Promise.all([
        api.listerEnfants(),
        api.listerPresents().catch(() => []), // si la route échoue, on n'empêche pas l'affichage
      ]);
      // Index des présents par enfant_id -> heure d'arrivée
      const presentsParId = {};
      for (const p of presents) presentsParId[p.enfant_id] = p.heure_arrivee;

      setEnfants(liste.map((e) => {
        const base = enfantDepuisAPI(e);
        const arrivee = presentsParId[e.id];
        if (arrivee) {
          return { ...base, statut: "present", arrivee: (arrivee || "").slice(0, 5) };
        }
        return base;
      }));

      // Les enfants à la carte actuellement présents sont considérés inscrits
      // aujourd'hui (pour rester cohérents avec l'état réel du serveur).
      const idsPresents = presents.map((p) => p.enfant_id);
      if (idsPresents.length > 0) {
        setInscritsJour((prev) => Array.from(new Set([...prev, ...idsPresents])));
      }

      setEnfantsCharges(true);
    } catch (e) {
      setErreurEnfants(e.message || "Impossible de charger les enfants.");
      setEnfantsCharges(true);
    }
  };

  useEffect(() => {
    if (session) chargerEnfants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Actualisation automatique des présences quand on est sur l'onglet Pointage.
  // Toutes les 10 secondes, on redemande l'état au serveur : ainsi, si une autre
  // personne pointe un enfant, l'écran se met à jour tout seul et on évite les
  // doubles pointages par inadvertance.
  useEffect(() => {
    if (!session || tab !== "pointage") return;
    const intervalle = setInterval(() => {
      rafraichirPresences();
    }, 10000);
    // Actualisation immédiate à l'arrivée sur l'onglet (pas d'attente de 10 s).
    rafraichirPresences();
    return () => clearInterval(intervalle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab]);

  const sauverEnfant = async () => {
    if (!formEnfant.nom.trim()) return;
    const { prenom, nom } = decouperNom(formEnfant.nom);
    const donnees = {
      prenom, nom,
      classe: formEnfant.classe || "",
      allergies: formEnfant.allergies || "",
      contact_urgence: formEnfant.urgence || "",
      personnes_autorisees: formEnfant.autorises || "",
      parent: formEnfant.parent || "",
    };
    try {
      if (formEnfant.id) {
        await api.modifierEnfant(formEnfant.id, donnees);
        // Mettre à jour la formule si elle a changé (historisé côté serveur).
        if (formEnfant.formule) {
          await api.changerFormule(formEnfant.id, formEnfant.formule);
        }
      } else {
        // À la création, on transmet la formule initiale choisie.
        await api.creerEnfant({ ...donnees, formule: formEnfant.formule || "forfait" });
      }
      setFormEnfant(null);
      await chargerEnfants();   // recharger pour refléter la base
    } catch (e) {
      setErreurEnfants(e.message || "Enregistrement impossible.");
    }
  };

  const supprimerEnfant = async (id) => {
    try {
      await api.supprimerEnfant(id);
      setInscritsJour((prev) => prev.filter((x) => x !== id));
      await chargerEnfants();
    } catch (e) {
      setErreurEnfants(e.message || "Suppression impossible.");
    }
  };

  /* --- Inscription du jour (enfants à la carte) --- */
  const ajouterAuJour = (id) => setInscritsJour((prev) => [...prev, id]);
  const retirerDuJour = (id) => setInscritsJour((prev) => prev.filter((x) => x !== id));

  /* --- Paiements & factures (via l'API, réservé admin) --- */

  // Charger le récapitulatif de facturation pour le trimestre sélectionné.
  const chargerFacturation = async () => {
    if (session?.role !== "admin") return; // réservé admin côté API
    setChargementFacturation(true);
    setErreurFacturation("");
    try {
      const d = await api.recapFacturation(trimestre, anneeScolaireCourante());
      setRecapFacturation(d);
    } catch (e) {
      setErreurFacturation(e.message || "Impossible de charger la facturation.");
      setRecapFacturation(null);
    } finally {
      setChargementFacturation(false);
    }
  };

  // Recharger quand on ouvre l'onglet facturation ou qu'on change de trimestre.
  useEffect(() => {
    if (session && tab === "facturation") chargerFacturation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab, trimestre]);

  // Charger le récapitulatif par famille avec report (seuil 15 €).
  const chargerRecapReport = async () => {
    if (session?.role !== "admin") return;
    setReportMessage("");
    try {
      const d = await api.recapAvecReport(trimestre, anneeScolaireCourante());
      setRecapReport(d);
      // Pré-remplir la saisie avec les reports entrants actuels.
      const saisie = {};
      for (const l of d.lignes || []) saisie[l.famille_id] = String(l.report_entrant || "");
      setReportSaisie(saisie);
    } catch (e) {
      setReportMessage(e.message || "Impossible de charger le report.");
      setRecapReport(null);
    }
  };

  // Enregistrer la saisie manuelle du report entrant d'une famille.
  const enregistrerReportFamille = async (familleId) => {
    const montant = Number(reportSaisie[familleId]);
    if (!Number.isFinite(montant) || montant < 0) {
      setReportMessage("Montant invalide.");
      return;
    }
    try {
      await api.enregistrerReport(familleId, trimestre, anneeScolaireCourante(), montant);
      setReportMessage("Report enregistré.");
      await chargerRecapReport();
      setTimeout(() => setReportMessage(""), 2500);
    } catch (e) {
      setReportMessage(e.message || "Enregistrement impossible.");
    }
  };

  const changerPaiement = async (id, val) => {
    try {
      await api.changerStatutPaiement(id, trimestre, anneeScolaireCourante(), val);
      await chargerFacturation(); // refléter le nouveau statut et recalculer les impayés
    } catch (e) {
      setErreurFacturation(e.message || "Changement de statut impossible.");
    }
  };

  // Génère les lignes HTML des passages, regroupées par jour.
  // Pour chaque jour : une ligne "présence de Xh à Yh" (heures réelles),
  // puis les créneaux facturés en dessous. Rend la facture claire pour les familles.
  const lignesPassagesParJour = (passages, esc, fmtJour) => {
    // Regrouper par pointage (un pointage = une présence d'un jour).
    const parPointage = {};
    const ordre = [];
    for (const p of passages) {
      const cle = p.pointage_id != null ? `p${p.pointage_id}` : `j${p.jour}`;
      if (!parPointage[cle]) { parPointage[cle] = []; ordre.push(cle); }
      parPointage[cle].push(p);
    }
    return ordre.map((cle) => {
      const lignes = parPointage[cle];
      const prem = lignes[0];
      // Ligne d'en-tête : jour + présence réelle.
      const presence = (prem.arrivee_reelle && prem.depart_reel)
        ? `présent de ${prem.arrivee_reelle.replace(":", "h")} à ${prem.depart_reel.replace(":", "h")}`
        : (prem.arrivee_reelle ? `arrivé à ${prem.arrivee_reelle.replace(":", "h")}` : "");
      const enTete = `<tr><td style="padding-top:8px;font-weight:bold">${fmtJour(prem.jour)}${presence ? ` — <span style="font-weight:normal;color:#555">${presence}</span>` : ""}</td><td></td></tr>`;
      // Lignes de créneaux facturés.
      const creneaux = lignes.map((p) => {
        const horaires = (p.heure_debut && p.heure_fin)
          ? ` (${p.heure_debut.replace(":", "h")}–${p.heure_fin.replace(":", "h")})`
          : "";
        return `<tr><td style="padding-left:20px;color:#333">${esc(p.creneau)}${horaires}</td><td>${Number(p.cout_eur).toFixed(2).replace(".", ",")} €</td></tr>`;
      }).join("");
      return enTete + creneaux;
    }).join("");
  };

  const exporterFacture = async (enfantId) => {
    const tri = TRIMESTRES.find((t) => t.id === trimestre);
    const cf = coordFacturation;
    const esc = (t) => (t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const nl2br = (t) => esc(t).replace(/\n/g, "<br>");
    const bloc = (label, val) => (val ? `<br><strong>${label} :</strong> ${esc(val)}` : "");

    let d;
    try {
      d = await api.detailFacture(enfantId, trimestre, anneeScolaireCourante());
    } catch (e) {
      setErreurFacturation(e.message || "Impossible de générer la facture.");
      return;
    }

    const nomEnfant = `${d.enfant.prenom} ${d.enfant.nom}`;
    const montant = Number(d.montant_eur).toFixed(2).replace(".", ",");
    const periode = `${tri.label} (${periodeTrimestre(tri.id, datesTrimestres)}) — ${d.annee_scolaire}`;
    const fmtJour = (j) => new Date(j).toLocaleDateString("fr-FR");

    // Lignes de prestation
    let lignes = "";
    if (d.formule === "forfait") {
      lignes = `<tr><td>Forfait trimestriel — accès illimité sur le trimestre</td><td>${montant} €</td></tr>`;
    } else if (d.passages.length > 0) {
      lignes = lignesPassagesParJour(d.passages, esc, fmtJour);
    } else {
      lignes = `<tr><td>Aucun passage facturé sur le trimestre</td><td>0,00 €</td></tr>`;
    }

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Facture — ${esc(d.enfant.parent)}</title>
<style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#22304A}
h1{border-bottom:3px solid #F5B82E;padding-bottom:8px}
.emetteur{font-size:13px;line-height:1.5;margin-bottom:24px}
.emetteur .nom{font-weight:bold;font-size:15px}
table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{border:1px solid #ddd;padding:10px;text-align:left}
tfoot td{font-weight:bold;background:#FBF3DC}
.mentions{color:#8A94A6;font-size:12px;margin-top:16px}
@media print{.noprint{display:none}}</style></head><body>
${logo ? `<img src="${logo}" alt="Logo" style="max-height:70px;max-width:220px;object-fit:contain;margin-bottom:12px">` : ""}
<h1>${esc(cf.organisme) || "Facture"} — Facture</h1>
<div class="emetteur">
<span class="nom">${esc(cf.organisme)}</span><br>
${nl2br(cf.adresse)}${bloc("Tél", cf.telephone)}${bloc("E-mail", cf.email)}${bloc("SIRET", cf.siret)}${bloc("IBAN", cf.iban)}
</div>
<p><strong>Famille :</strong> ${esc(d.enfant.parent)}<br>
<strong>Enfant :</strong> ${esc(nomEnfant)}${d.enfant.classe ? ` (${esc(d.enfant.classe)})` : ""}<br>
<strong>Période :</strong> ${periode}</p>
<table><thead><tr><th>Prestation</th><th>Montant</th></tr></thead>
<tbody>${lignes}</tbody>
<tfoot><tr><td>Total à régler</td><td>${montant} €</td></tr></tfoot></table>
${cf.mentions ? `<p class="mentions">${nl2br(cf.mentions)}</p>` : ""}
<p class="mentions">Facture générée le ${new Date().toLocaleDateString("fr-FR")}.</p>
<p class="noprint"><button onclick="window.print()" style="padding:10px 18px;background:#22304A;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer">Imprimer / Enregistrer en PDF</button></p>
</body></html>`;

    // Ouvrir dans une nouvelle fenêtre, prête à imprimer.
    const fenetre = window.open("", "_blank");
    if (fenetre) {
      fenetre.document.write(html);
      fenetre.document.close();
    } else {
      setErreurFacturation("Autorisez les fenêtres surgissantes pour imprimer la facture.");
    }
  };

  const exporterFactureFamille = async (familleId) => {
    const tri = TRIMESTRES.find((t) => t.id === trimestre);
    const cf = coordFacturation;
    const esc = (t) => (t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const nl2br = (t) => esc(t).replace(/\n/g, "<br>");
    const bloc = (label, val) => (val ? `<br><strong>${label} :</strong> ${esc(val)}` : "");

    let d;
    try {
      d = await api.factureFamille(familleId, trimestre, anneeScolaireCourante());
    } catch (e) {
      setErreurFacturation(e.message || "Impossible de générer la facture famille.");
      return;
    }

    const total = Number(d.total_eur).toFixed(2).replace(".", ",");
    const periode = `${tri.label} (${periodeTrimestre(tri.id, datesTrimestres)}) — ${d.annee_scolaire}`;
    const fmtJour = (j) => new Date(j).toLocaleDateString("fr-FR");
    const libelleStatut = { paye: "Payé", attente: "En attente", relance: "À relancer" }[d.statut_paiement] || d.statut_paiement;

    // Ligne de report éventuelle (report des trimestres précédents, seuil 15 €).
    const reportEntrant = Number(d.report_entrant_eur || 0);
    let ligneReport = "";
    if (reportEntrant > 0) {
      const triOrigine = TRIMESTRES.find((t) => t.id === d.report_trimestre_origine);
      const nomOrigine = triOrigine ? `${triOrigine.label} (${periodeTrimestre(triOrigine.id, datesTrimestres)})` : "trimestre précédent";
      ligneReport = `<tr class="enfant"><td><strong>Report du ${nomOrigine}</strong><br><span style="font-size:12px;color:#8A94A6">Montant inférieur au seuil de facturation, reporté sur ce trimestre</span></td><td>${reportEntrant.toFixed(2).replace(".", ",")} €</td></tr>`;
    }

    const blocsEnfants = d.enfants.map((enf) => {
      let detail = "";
      if (enf.formule === "forfait") {
        detail = `<tr><td>Forfait trimestriel — accès illimité</td><td>${Number(enf.montant_eur).toFixed(2).replace(".", ",")} €</td></tr>`;
      } else if (enf.passages.length > 0) {
        detail = lignesPassagesParJour(enf.passages, esc, fmtJour);
      }
      return `<tr class="enfant"><td colspan="2"><strong>${esc(enf.enfant)}</strong>${enf.classe ? ` (${esc(enf.classe)})` : ""} — ${enf.formule === "forfait" ? "Forfait" : "À la carte"} · sous-total ${Number(enf.montant_eur).toFixed(2).replace(".", ",")} €</td></tr>${detail}`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Facture — ${esc(d.famille.nom_referent)}</title>
<style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#22304A}
h1{border-bottom:3px solid #F5B82E;padding-bottom:8px}
.emetteur{font-size:13px;line-height:1.5;margin-bottom:24px}
.emetteur .nom{font-weight:bold;font-size:15px}
table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{border:1px solid #ddd;padding:10px;text-align:left}
tr.enfant td{background:#F7F6F2;font-size:14px}
tfoot td{font-weight:bold;background:#FBF3DC;font-size:15px}
.statut{display:inline-block;margin-top:12px;padding:4px 12px;border-radius:6px;font-weight:bold;font-size:13px;background:#eee}
.mentions{color:#8A94A6;font-size:12px;margin-top:16px}
@media print{.noprint{display:none}}</style></head><body>
${logo ? `<img src="${logo}" alt="Logo" style="max-height:70px;max-width:220px;object-fit:contain;margin-bottom:12px">` : ""}
<h1>${esc(cf.organisme) || "Facture"} — Facture de famille</h1>
<div class="emetteur">
<span class="nom">${esc(cf.organisme)}</span><br>
${nl2br(cf.adresse)}${bloc("Tél", cf.telephone)}${bloc("E-mail", cf.email)}${bloc("SIRET", cf.siret)}${bloc("IBAN", cf.iban)}
</div>
<p><strong>Famille :</strong> ${esc(d.famille.nom_referent)}${bloc("Tél", d.famille.telephone)}${bloc("E-mail", d.famille.email)}<br>
<strong>Période :</strong> ${periode}<br>
<strong>Enfants facturés :</strong> ${d.enfants.length}</p>
<table><thead><tr><th>Prestation</th><th>Montant</th></tr></thead>
<tbody>${blocsEnfants || '<tr><td colspan="2">Aucune facturation ce trimestre</td></tr>'}${ligneReport}</tbody>
<tfoot><tr><td>Total à régler pour la famille</td><td>${total} €</td></tr></tfoot></table>
<div class="statut">Statut : ${libelleStatut}</div>
${cf.mentions ? `<p class="mentions">${nl2br(cf.mentions)}</p>` : ""}
<p class="mentions">Facture générée le ${new Date().toLocaleDateString("fr-FR")}.</p>
<p class="noprint"><button onclick="window.print()" style="padding:10px 18px;background:#22304A;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer">Imprimer / Enregistrer en PDF</button></p>
</body></html>`;

    const fenetre = window.open("", "_blank");
    if (fenetre) { fenetre.document.write(html); fenetre.document.close(); }
    else setErreurFacturation("Autorisez les fenêtres surgissantes pour imprimer la facture.");
  };

  // Bordereau complet : toutes les familles du trimestre, une ligne par enfant,
  // regroupées par famille, avec sous-total par foyer et total général.
  // Construit à partir du récapitulatif déjà chargé (recapFacturation).
  const imprimerBordereau = () => {
    if (!recapFacturation || !recapFacturation.lignes) {
      setErreurFacturation("Aucune donnée de facturation à imprimer pour ce trimestre.");
      return;
    }
    const tri = TRIMESTRES.find((t) => t.id === trimestre);
    const cf = coordFacturation;
    const esc = (t) => (t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const eur = (n) => Number(n).toFixed(2).replace(".", ",") + " €";
    const libelleStatut = { paye: "Payé", attente: "En attente", relance: "À relancer" };

    // Regrouper les lignes par famille.
    const parFamille = {};
    for (const l of recapFacturation.lignes) {
      const cle = l.famille_id || `sans-${l.enfant_id}`;
      if (!parFamille[cle]) parFamille[cle] = { famille_id: l.famille_id, parent: l.parent, lignes: [], sousTotal: 0, statut: l.statut_paiement, facturable: l.famille_facturable !== false };
      parFamille[cle].lignes.push(l);
      parFamille[cle].sousTotal += Number(l.montant_eur);
    }

    // Reports par famille (à ajouter comme une ligne dans le bloc famille).
    const reportsParFamille = recapFacturation.reports_par_famille || {};
    for (const cle of Object.keys(parFamille)) {
      const fid = parFamille[cle].famille_id;
      const report = fid ? Number(reportsParFamille[fid] || 0) : 0;
      parFamille[cle].report = report;
      parFamille[cle].sousTotal += report;
    }

    // Trier les familles par nom de parent.
    const familles = Object.values(parFamille).sort((a, b) => (a.parent || "").localeCompare(b.parent || ""));

    // Construire les blocs HTML par famille.
    // Une famille non facturable (total dû < 15 €) est signalée en jaune et
    // son sous-total n'entre PAS dans le total général (règle de la Trésorerie).
    const blocs = familles.map((f) => {
      const nonFact = f.facturable === false;
      const styleLigne = nonFact ? ' style="background:#FDF6E3;color:#A87E12"' : "";
      const lignesHtml = f.lignes.map((l) =>
        `<tr${styleLigne}><td style="padding-left:24px">${esc(l.enfant)}</td>
         <td>${l.formule === "forfait" ? "Forfait" : "À la carte"}</td>
         <td style="text-align:right">${eur(l.montant_eur)}</td>
         <td>${libelleStatut[l.statut_paiement] || l.statut_paiement}</td></tr>`
      ).join("");
      // Ligne de report éventuelle pour cette famille.
      const ligneReport = f.report > 0
        ? `<tr${styleLigne}><td style="padding-left:24px;color:#A87E12">↳ Report des trimestres précédents</td>
           <td style="color:#8A94A6">Report</td>
           <td style="text-align:right;color:#A87E12">${eur(f.report)}</td>
           <td></td></tr>`
        : "";
      const enTeteFamille = nonFact
        ? `<tr class="famille" style="background:#FBEAB7"><td colspan="4"><strong>${esc(f.parent)}</strong> — ${f.lignes.length} enfant${f.lignes.length > 1 ? "s" : ""} · sous-total ${eur(f.sousTotal)} <span style="font-weight:normal;color:#A87E12">— non facturé (&lt; ${eur(recapFacturation.seuil_eur || 15)}), reporté</span></td></tr>`
        : `<tr class="famille"><td colspan="4"><strong>${esc(f.parent)}</strong> — ${f.lignes.length} enfant${f.lignes.length > 1 ? "s" : ""} · sous-total ${eur(f.sousTotal)}</td></tr>`;
      return `${enTeteFamille}${lignesHtml}${ligneReport}`;
    }).join("");

    const totalGeneral = recapFacturation.total_eur;
    const impayes = recapFacturation.impayes_eur;
    const periode = `${tri.label} (${periodeTrimestre(tri.id, datesTrimestres)}) — ${anneeScolaireCourante()}`;

    // Section séparée : familles avec report mais sans fréquentation ce trimestre.
    const sansActivite = recapFacturation.reports_sans_activite || [];
    let sectionReports = "";
    if (sansActivite.length > 0) {
      const lignesReports = sansActivite.map((r) =>
        `<tr><td>${esc(r.parent)}</td>
         <td style="text-align:right">${eur(r.report_eur)}</td>
         <td>${r.facturable ? "Facturable" : "En attente de seuil"}</td></tr>`
      ).join("");
      sectionReports = `
<h2 style="font-size:15px;margin-top:28px;border-bottom:2px solid #F5B82E;padding-bottom:6px">Familles sans fréquentation ce trimestre (report à recouvrer)</h2>
<p class="mentions">Ces familles n'ont pas fréquenté la garderie ce trimestre mais conservent un report des trimestres précédents.</p>
<table>
<thead><tr><th>Famille</th><th style="text-align:right">Report</th><th>Statut</th></tr></thead>
<tbody>${lignesReports}</tbody>
</table>`;
    }

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Bordereau — ${esc(periode)}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:32px auto;color:#22304A}
h1{border-bottom:3px solid #F5B82E;padding-bottom:8px}
.sous{color:#8A94A6;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
td,th{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#22304A;color:#fff;font-size:12px}
tr.famille td{background:#F7F6F2;font-weight:bold}
tfoot td{font-weight:bold;background:#FBF3DC;font-size:14px}
.mentions{color:#8A94A6;font-size:12px;margin-top:16px}
@media print{.noprint{display:none}}</style></head><body>
${logo ? `<img src="${logo}" alt="Logo" style="max-height:70px;max-width:220px;object-fit:contain;margin-bottom:12px">` : ""}
<h1>${esc(cf.organisme) || "Garderie"} — Bordereau de facturation</h1>
<div class="sous"><strong>Période :</strong> ${esc(periode)}<br><strong>Familles :</strong> ${familles.length} · <strong>Enfants facturés :</strong> ${recapFacturation.lignes.length}</div>
<table>
<thead><tr><th>Famille / Enfant</th><th>Formule</th><th style="text-align:right">Montant</th><th>Statut</th></tr></thead>
<tbody>${blocs || '<tr><td colspan="4">Aucune facturation ce trimestre</td></tr>'}</tbody>
<tfoot>
<tr><td colspan="2">Total général (familles facturables)</td><td style="text-align:right">${eur(totalGeneral)}</td><td>dont ${eur(impayes)} non encaissés</td></tr>
</tfoot>
</table>
<p class="mentions">Les familles en jaune n'atteignent pas le seuil de facturation de ${eur(recapFacturation.seuil_eur || 15)} : conformément à la règle de la Trésorerie, leur montant n'est pas facturé ce trimestre et n'entre pas dans le total général (il est reporté au trimestre suivant).</p>
${sectionReports}
<p class="mentions">Bordereau généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.</p>
<p class="noprint"><button onclick="window.print()" style="padding:10px 18px;background:#22304A;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer">Imprimer / Enregistrer en PDF</button></p>
</body></html>`;

    const fenetre = window.open("", "_blank");
    if (fenetre) { fenetre.document.write(html); fenetre.document.close(); }
    else setErreurFacturation("Autorisez les fenêtres surgissantes pour imprimer le bordereau.");
  };

  // Heure courante "HH:MM" construite manuellement, pour garantir le format
  // avec deux-points (":") quel que soit le navigateur. toLocaleTimeString("fr-FR")
  // peut renvoyer "12 h 15" selon l'environnement, ce qui cassait la détection
  // des créneaux (enMinutes attend "HH:MM").
  const heure = () => {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };

  /* --- Authentification (via l'API) --- */
  const [connexionEnCours, setConnexionEnCours] = useState(false);

  const seConnecter = async () => {
    const login = loginData.identifiant.trim();
    if (!login || !loginData.mdp) {
      setLoginErreur("Renseignez votre identifiant et votre mot de passe.");
      return;
    }
    setConnexionEnCours(true);
    setLoginErreur("");
    try {
      const d = await api.connexion(login, loginData.mdp, resterConnecte);
      setSession(d.utilisateur);
      // Mémoriser la session si "rester connecté", sinon s'assurer que rien ne traîne.
      if (resterConnecte) memoriserSession(d.jeton, d.utilisateur);
      else effacerSessionMemorisee();
      setLoginData({ identifiant: "", mdp: "" });
      setTab("pointage");
    } catch (e) {
      setLoginErreur(e.message || "Identifiant ou mot de passe incorrect.");
    } finally {
      setConnexionEnCours(false);
    }
  };
  const seDeconnecter = () => {
    definirJeton(null);
    effacerSessionMemorisee();  // efface la session persistante
    setSession(null);
    setTab("pointage");
  };

  // Reprise automatique de la session au démarrage (si "rester connecté").
  useEffect(() => {
    const memo = lireSessionMemorisee();
    if (memo) {
      definirJeton(memo.jeton);
      setSession(memo.utilisateur);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Gestion des comptes (admin, via l'API) --- */
  const userVide = { nom: "", identifiant: "", email: "", mdp: "", role: "membre" };

  // Charger les vrais utilisateurs depuis l'API (admin seulement).
  const chargerUtilisateurs = async () => {
    if (session?.role !== "admin") return;
    try {
      setErreurUsers("");
      const liste = await api.listerUtilisateurs();
      // Pont API -> interface : nom_complet -> nom, on garde actif.
      setUsers(liste.map((u) => ({
        id: u.id, nom: u.nom_complet, identifiant: u.identifiant,
        email: u.email, role: u.role, actif: u.actif,
      })));
    } catch (e) {
      setErreurUsers(e.message || "Impossible de charger les comptes.");
    }
  };

  useEffect(() => {
    if (session?.role === "admin") chargerUtilisateurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const sauverUser = async () => {
    if (!formUser.nom.trim() || !formUser.identifiant.trim()) return;
    // À la création, le mot de passe est requis ; à la modification, il est optionnel.
    if (!formUser.id && !formUser.mdp.trim()) {
      setErreurUsers("Le mot de passe est requis pour créer un compte.");
      return;
    }
    try {
      if (formUser.id) {
        // Modifier nom / identifiant / e-mail / rôle
        await api.modifierUtilisateur(formUser.id, {
          nom_complet: formUser.nom, identifiant: formUser.identifiant,
          email: formUser.email, role: formUser.role,
        });
        // Si un nouveau mot de passe a été saisi, le réinitialiser.
        if (formUser.mdp.trim()) {
          await api.reinitialiserMotDePasse(formUser.id, formUser.mdp);
        }
      } else {
        await api.creerUtilisateur({
          nom_complet: formUser.nom, identifiant: formUser.identifiant,
          email: formUser.email, mot_de_passe: formUser.mdp, role: formUser.role,
        });
      }
      setFormUser(null);
      setErreurUsers("");
      await chargerUtilisateurs();
    } catch (e) {
      setErreurUsers(e.message || "Enregistrement du compte impossible.");
    }
  };

  const supprimerUser = async (id) => {
    try {
      await api.supprimerUtilisateur(id);
      await chargerUtilisateurs();
    } catch (e) {
      setErreurUsers(e.message || "Suppression impossible.");
    }
  };

  const basculerActivationUser = async (id, actif) => {
    try {
      await api.changerActivationUtilisateur(id, actif);
      await chargerUtilisateurs();
    } catch (e) {
      setErreurUsers(e.message || "Changement d'état impossible.");
    }
  };

  /* --- Gestion des créneaux horaires et du forfait (admin, via l'API) --- */
  const creneauVide = { nom: "", debut: "", fin: "", mode: "heure", montant: 0 };

  // Charger les créneaux (et le forfait si admin) depuis l'API.
  const chargerAdmin = async () => {
    try {
      setErreurAdmin("");
      const liste = await api.listerCreneaux();
      setCreneaux(liste.map(creneauDepuisAPI));
      // Le logo s'affiche pour tout le monde (en-tête, factures) : on le charge
      // quel que soit le rôle.
      const l = await api.lireLogo().catch(() => "");
      if (l) setLogo(l);
      if (session?.role === "admin") {
        const f = await api.lireForfait().catch(() => null);
        if (f) setPrixForfait(Number(f.montant_eur));
        // Charger les coordonnées de facturation.
        const c = await api.lireCoordonnees().catch(() => null);
        if (c) {
          setCoordFacturation({
            organisme: c.org_nom || "",
            adresse: c.org_adresse || "",
            telephone: c.org_telephone || "",
            email: c.org_email || "",
            siret: c.org_siret || "",
            iban: c.org_iban || "",
            mentions: c.org_mentions || "",
          });
        }
        // Charger les dates de trimestre configurées.
        const t = await api.lireTrimestres().catch(() => null);
        if (t) setDatesTrimestres({ fin_t1: t.fin_t1 || "", fin_t2: t.fin_t2 || "", fin_t3: t.fin_t3 || "" });
      }
    } catch (e) {
      setErreurAdmin(e.message || "Impossible de charger les créneaux.");
    }
  };

  // Enregistrer les coordonnées de facturation (réservé admin).
  const enregistrerCoordonnees = async () => {
    try {
      await api.enregistrerCoordonnees({
        org_nom: coordFacturation.organisme,
        org_adresse: coordFacturation.adresse,
        org_telephone: coordFacturation.telephone,
        org_email: coordFacturation.email,
        org_siret: coordFacturation.siret,
        org_iban: coordFacturation.iban,
        org_mentions: coordFacturation.mentions,
      });
      setCoordEnregistrees(true);
      setTimeout(() => setCoordEnregistrees(false), 2500);
    } catch (e) {
      setErreurAdmin(e.message || "Enregistrement des coordonnées impossible.");
    }
  };

  // Enregistrer les dates de trimestre (réservé admin).
  const enregistrerDatesTrimestres = async () => {
    setTrimestreMessage("");
    const { fin_t1, fin_t2, fin_t3 } = datesTrimestres;
    if (!fin_t1 || !fin_t2 || !fin_t3) {
      setTrimestreMessage("Veuillez renseigner les trois dates de fin de trimestre.");
      return;
    }
    if (!(fin_t1 < fin_t2 && fin_t2 < fin_t3)) {
      setTrimestreMessage("Les dates doivent se suivre : fin du 1er < fin du 2e < fin du 3e.");
      return;
    }
    try {
      await api.enregistrerTrimestres(fin_t1, fin_t2, fin_t3);
      setTrimestreMessage("Dates de trimestre enregistrées.");
      setTimeout(() => setTrimestreMessage(""), 3000);
    } catch (e) {
      setTrimestreMessage(e.message || "Enregistrement impossible.");
    }
  };

  // Recalculer le trimestre de tous les pointages selon les nouvelles dates.
  const lancerRecalculTrimestres = async () => {
    if (!window.confirm(
      "Recalculer le trimestre de tous les pointages selon les dates configurées ?\n\n" +
      "Cette opération réattribue chaque passage au bon trimestre. Elle ne modifie " +
      "ni les montants, ni les heures. Pensez à avoir fait une sauvegarde au préalable."
    )) return;
    setRecalculEnCours(true);
    setTrimestreMessage("");
    try {
      const r = await api.recalculerTrimestres();
      setTrimestreMessage(
        `Recalcul terminé : ${r.passages_modifies} passage(s) réattribué(s) sur ${r.total_passages}.`
      );
    } catch (e) {
      setTrimestreMessage(e.message || "Recalcul impossible.");
    } finally {
      setRecalculEnCours(false);
    }
  };

  // Téléverser un logo : lit le fichier choisi, le convertit en base64,
  // vérifie la taille, puis l'enregistre côté serveur.
  const televerserLogo = (fichier) => {
    if (!fichier) return;
    setLogoMessage("");
    // Vérifier le type.
    if (!/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/.test(fichier.type)) {
      setLogoMessage("Format non reconnu. Utilisez PNG, JPG, GIF, WEBP ou SVG.");
      return;
    }
    // Vérifier la taille brute (~350 Ko max, car le base64 gonfle d'environ 33%).
    if (fichier.size > 350 * 1024) {
      setLogoMessage("Image trop lourde (350 Ko maximum). Réduisez sa taille avant de l'importer.");
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = async () => {
      const base64 = lecteur.result; // "data:image/...;base64,...."
      try {
        await api.enregistrerLogo(base64);
        setLogo(base64);
        setLogoMessage("Logo enregistré.");
        setTimeout(() => setLogoMessage(""), 2500);
      } catch (e) {
        setLogoMessage(e.message || "Enregistrement du logo impossible.");
      }
    };
    lecteur.onerror = () => setLogoMessage("Lecture du fichier impossible.");
    lecteur.readAsDataURL(fichier);
  };

  const retirerLogo = async () => {
    try {
      await api.enregistrerLogo("");
      setLogo("");
      setLogoMessage("Logo retiré.");
      setTimeout(() => setLogoMessage(""), 2500);
    } catch (e) {
      setLogoMessage(e.message || "Retrait du logo impossible.");
    }
  };

  // --- Correction des pointages (admin) ---
  // Formate une date "AAAA-MM-JJ" en "JJ/MM/AAAA" (format français).
  const fmtDateFr = (iso) => {
    if (!iso) return "";
    const [a, m, j] = iso.split("-");
    return `${j}/${m}/${a}`;
  };

  const chargerCorrections = async () => {
    setCorrChargement(true);
    setCorrErreur("");
    try {
      const liste = await api.listerPointagesCorrection(corrDebut, corrFin);
      setCorrections(liste);
    } catch (e) {
      setCorrErreur(e.message || "Impossible de charger les pointages.");
      setCorrections([]);
    } finally {
      setCorrChargement(false);
    }
  };

  // Démarrer l'édition d'une ligne.
  const ouvrirEditionPointage = (p) => {
    setCorrEnEdition(p.id);
    setCorrArrivee(p.heure_arrivee || "");
    setCorrDepart(p.heure_depart || "");
    setCorrMessage("");
  };

  const annulerEditionPointage = () => {
    setCorrEnEdition(null);
    setCorrArrivee("");
    setCorrDepart("");
  };

  // Enregistrer une modification (arrivée + départ éventuel).
  const enregistrerCorrection = async (id) => {
    setCorrMessage("");
    try {
      const r = await api.modifierPointage(id, corrArrivee, corrDepart || null);
      setCorrMessage(`Pointage corrigé (${r.passages_recalcules} créneau${r.passages_recalcules > 1 ? "x" : ""} recalculé${r.passages_recalcules > 1 ? "s" : ""}).`);
      setCorrEnEdition(null);
      await chargerCorrections();
      setTimeout(() => setCorrMessage(""), 3000);
    } catch (e) {
      setCorrMessage(e.message || "Correction impossible.");
    }
  };

  // Clôturer rapidement une présence ouverte (sans passer par l'édition complète).
  const cloturerPresence = async (p) => {
    const heure = window.prompt(
      `Clôturer la présence de ${p.enfant} (arrivée ${p.heure_arrivee}).\nHeure de départ (format HH:MM) :`,
      ""
    );
    if (!heure) return;
    setCorrMessage("");
    try {
      const r = await api.modifierPointage(p.id, p.heure_arrivee, heure);
      setCorrMessage(`Présence clôturée (${r.passages_recalcules} créneau${r.passages_recalcules > 1 ? "x" : ""} facturé${r.passages_recalcules > 1 ? "s" : ""}).`);
      await chargerCorrections();
      setTimeout(() => setCorrMessage(""), 3000);
    } catch (e) {
      setCorrMessage(e.message || "Clôture impossible.");
    }
  };

  const supprimerPointageCorr = async (p) => {
    if (!window.confirm(`Supprimer définitivement le pointage de ${p.enfant} du ${fmtDateFr(p.jour)} ? Cette action est irréversible et retirera la facturation associée.`)) return;
    setCorrMessage("");
    try {
      await api.supprimerPointage(p.id);
      setCorrMessage("Pointage supprimé.");
      await chargerCorrections();
      setTimeout(() => setCorrMessage(""), 3000);
    } catch (e) {
      setCorrMessage(e.message || "Suppression impossible.");
    }
  };

  // Ajouter un pointage manuellement (rattrapage d'un oubli complet).
  const ajouterPointageManuel = async () => {
    setCorrMessage("");
    if (!ajoutEnfant) { setCorrMessage("Veuillez choisir un enfant."); return; }
    if (!ajoutJour) { setCorrMessage("Veuillez indiquer la date."); return; }
    if (!ajoutArrivee || !ajoutDepart) { setCorrMessage("Les heures d'arrivée et de départ sont obligatoires."); return; }
    if (ajoutDepart < ajoutArrivee) { setCorrMessage("Le départ ne peut pas précéder l'arrivée."); return; }
    try {
      const r = await api.ajouterPointageManuel(Number(ajoutEnfant), ajoutJour, ajoutArrivee, ajoutDepart);
      setCorrMessage(`Pointage ajouté (${r.passages_recalcules} créneau${r.passages_recalcules > 1 ? "x" : ""} facturé${r.passages_recalcules > 1 ? "s" : ""}).`);
      // Réinitialiser le formulaire et rafraîchir la liste.
      setAjoutOuvert(false);
      setAjoutEnfant("");
      setAjoutArrivee("");
      setAjoutDepart("");
      // Si la période affichée couvre le jour ajouté, on recharge.
      if (ajoutJour >= corrDebut && ajoutJour <= corrFin) await chargerCorrections();
      setTimeout(() => setCorrMessage(""), 3000);
    } catch (e) {
      setCorrMessage(e.message || "Ajout impossible.");
    }
  };

  useEffect(() => {
    if (session) chargerAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Met à jour le favicon (icône de l'onglet du navigateur) avec le logo.
  useEffect(() => {
    if (!logo || typeof document === "undefined") return;
    // Cherche une balise <link rel="icon">, ou en crée une.
    let lien = document.querySelector("link[rel='icon']");
    if (!lien) {
      lien = document.createElement("link");
      lien.rel = "icon";
      document.head.appendChild(lien);
    }
    lien.href = logo;
  }, [logo]);

  // Charger la fréquentation réelle sur la période choisie.
  const chargerFrequentation = async () => {
    setFreqChargement(true);
    setFreqErreur("");
    try {
      const d = await api.frequentation(statDebut, statFin);
      setFreqData(d);
    } catch (e) {
      setFreqErreur(e.message || "Impossible de charger la fréquentation.");
      setFreqData(null);
    } finally {
      setFreqChargement(false);
    }
  };

  useEffect(() => {
    if (session && tab === "stats") chargerFrequentation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab, statDebut, statFin]);

  // Charger l'historique réel sur la période choisie.
  const chargerHistorique = async () => {
    setHistoChargement(true);
    setHistoErreur("");
    try {
      const jours = await api.historique(histoDebut, histoFin);
      // Adapter au format d'affichage attendu (date lisible + entrees).
      const joursFormates = jours.map((j) => ({
        id: j.jour,
        date: new Date(j.jour + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
        entrees: j.entrees.map((e) => ({ nom: e.enfant, arrivee: e.arrivee, depart: e.depart || "—" })),
      }));
      setHistorique(joursFormates);
    } catch (e) {
      setHistoErreur(e.message || "Impossible de charger l'historique.");
      setHistorique([]);
    } finally {
      setHistoChargement(false);
    }
  };

  useEffect(() => {
    if (session && tab === "historique") chargerHistorique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab, histoDebut, histoFin]);

  const sauverCreneau = async () => {
    if (!formCreneau.nom.trim() || !formCreneau.debut || !formCreneau.fin) return;
    try {
      const donnees = creneauVersAPI(formCreneau);
      if (formCreneau.id) {
        await api.modifierCreneau(formCreneau.id, donnees);
      } else {
        await api.creerCreneau(donnees);
      }
      setFormCreneau(null);
      await chargerAdmin();
    } catch (e) {
      setErreurAdmin(e.message || "Enregistrement du créneau impossible.");
    }
  };

  const supprimerCreneau = async (id) => {
    try {
      await api.supprimerCreneau(id);
      await chargerAdmin();
    } catch (e) {
      setErreurAdmin(e.message || "Suppression du créneau impossible.");
    }
  };

  // Enregistrer le tarif du forfait (historisé côté serveur).
  const enregistrerForfait = async (montant) => {
    try {
      await api.changerForfait(montant);
      await chargerAdmin();
    } catch (e) {
      setErreurAdmin(e.message || "Changement du forfait impossible.");
    }
  };

  const [pointageEnCours, setPointageEnCours] = useState(null); // id en cours de traitement

  const pointer = async (id, action) => {
    setPointageEnCours(id);
    try {
      if (action === "arrivee") {
        await api.pointerArrivee(id);
      } else {
        const r = await api.pointerDepart(id);
        // Le serveur peut annuler un pointage trop court (test / erreur).
        if (r && r.annule) {
          setErreurEnfants(r.message || "Pointage annulé (durée trop courte).");
          setTimeout(() => setErreurEnfants(""), 4000);
        }
      }
      await chargerEnfants(); // recharge l'état réel (présence, etc.)
    } catch (e) {
      // Cas d'un enfant déjà pointé par une autre personne entre-temps :
      // on informe clairement et on rafraîchit pour montrer l'état réel.
      const msg = (e.message || "").toLowerCase();
      if (msg.includes("déjà") || msg.includes("deja") || msg.includes("present")) {
        setErreurEnfants("Cet enfant vient d'être pointé par une autre personne. L'affichage a été mis à jour.");
        await rafraichirPresences();
      } else {
        setErreurEnfants(e.message || "Pointage impossible.");
      }
      setTimeout(() => setErreurEnfants(""), 4000);
    } finally {
      setPointageEnCours(null);
    }
  };

  const presents = enfants.filter((e) => e.statut === "present").length;
  const partis = enfants.filter((e) => e.statut === "parti").length;

  // Passages d'un enfant sur le trimestre sélectionné
  const passagesTrimestre = (e) => (e.passages || []).filter((p) => p.trimestre === trimestre);
  const totalPassages = (e) => passagesTrimestre(e).reduce((s, p) => s + p.cout, 0);
  const minutesPassages = (e) => passagesTrimestre(e).reduce((s, p) => s + p.minutes, 0);
  const facture = (e) => {
    if (estForfait(e.formule)) return prixForfait;
    return +totalPassages(e).toFixed(2);
  };
  // Familles à facturer sur le trimestre : forfaits toujours, à la carte seulement si passages ce trimestre
  const enfantsAFacturer = enfants.filter((e) => estForfait(e.formule) || passagesTrimestre(e).length > 0);
  const totalTrimestre = enfantsAFacturer.reduce((s, e) => s + facture(e), 0);
  const impayes = enfantsAFacturer.filter((e) => e.paiement !== "paye").reduce((s, e) => s + facture(e), 0);

  /* --- Pointage du jour : forfaits + enfants à la carte inscrits + TOUS les présents ---
     Règle importante : un enfant actuellement présent (pointé en base) doit
     toujours apparaître, même s'il n'est pas dans la liste des inscrits du jour.
     Sinon il "disparaîtrait" de l'écran tout en restant pointé (bug corrigé). */
  const enfantsPointage = enfants
    .filter((e) => estForfait(e.formule) || inscritsJour.includes(e.id) || e.statut === "present")
    // Tri alphabétique par nom (saisi "NOM Prénom", donc par nom de famille).
    .sort((a, b) => (a.nom || "").toLowerCase().localeCompare((b.nom || "").toLowerCase()));
  const carteNonInscrits = enfants
    .filter((e) => e.formule === "carte" && !inscritsJour.includes(e.id) && e.statut !== "present")
    .sort((a, b) => (a.nom || "").toLowerCase().localeCompare((b.nom || "").toLowerCase()));
  // Filtrée par la classe sélectionnée ET la recherche (pour le bloc inscription du jour).
  const recherchePointageNorm = recherchePointage.trim().toLowerCase();
  const carteNonInscritsFiltres = carteNonInscrits.filter((e) => {
    const okClasse = !filtreClassePointage || e.classe === filtreClassePointage;
    const okRecherche = !recherchePointageNorm ||
      (e.nom || "").toLowerCase().includes(recherchePointageNorm) ||
      (e.prenom || "").toLowerCase().includes(recherchePointageNorm) ||
      (e.nomFamille || "").toLowerCase().includes(recherchePointageNorm);
    return okClasse && okRecherche;
  });

  // Liste des classes présentes chez les enfants (pour le filtre du pointage).
  const classesDisponibles = Array.from(
    new Set(enfants.map((e) => e.classe).filter(Boolean))
  ).sort();

  /* --- Présence par période (pour l'onglet Familles) --- */
  // Minutes de présence aujourd'hui pour un enfant (terminées ou en cours)
  const minutesJour = (e) => {
    if (!e.arrivee) return 0;
    return minutesEntre(e.arrivee, e.depart || plafonneFermeture(heure()));
  };
  // Minutes cumulées cette semaine = jours de l'historique (par nom) + aujourd'hui
  const minutesSemaine = (e) => {
    const passe = historique.reduce((total, j) => {
      const entree = j.entrees.find((en) => en.nom === e.nom);
      return total + (entree ? minutesEntre(entree.arrivee, entree.depart) : 0);
    }, 0);
    return passe + minutesJour(e);
  };
  // Minutes du mois/trimestre = total des passages enregistrés
  const presenceParPeriode = (e, periode) => {
    if (periode === "jour") return minutesJour(e);
    if (periode === "semaine") return minutesSemaine(e);
    return minutesPassages(e); // cumul
  };
  const libellePeriode = { jour: "Aujourd'hui", semaine: "Cette semaine", mois: "Ce mois-ci" };

  /* --- Statistiques de fréquentation --- */
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // Données du graphique de fréquentation, à partir des vraies présences.
  // Format d'affichage du jour : "lun 12/01".
  const formatJourCourt = (iso) => {
    const d = new Date(iso + "T12:00:00");
    const jours = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
    return `${jours[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const statsJours = (freqData?.jours || []).map((j) => ({
    jour: formatJourCourt(j.jour),
    enfants: j.nb_enfants,
  }));
  const moyenneJour = freqData?.moyenne_par_jour || 0;
  const maxJour = freqData?.maximum || 0;

  const onglets = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "pointage", label: "Pointage", icon: ClipboardCheck },
    { id: "historique", label: "Historique", icon: History },
    { id: "familles", label: "Familles", icon: Users },
    ...(session?.role === "admin" ? [{ id: "facturation", label: "Facturation", icon: Euro }] : []),
    { id: "stats", label: "Statistiques", icon: BarChart3 },
    ...(session?.role === "admin" ? [{ id: "admin", label: "Administration", icon: Shield }] : []),
  ];

  const statutBadge = (e) => {
    if (e.statut === "present") return <Badge color="#fff" bg={C.green}>Présent · {e.arrivee}</Badge>;
    if (e.statut === "parti") return <Badge color="#fff" bg={C.red}>Parti{e.depart ? ` · ${e.depart}` : ""}</Badge>;
    return <Badge color={C.grey} bg={C.line}>Non pointé</Badge>;
  };

  /* ---------- Écran de connexion ---------- */
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans"
        style={{ backgroundColor: C.paper, color: C.ink }}>
        <div className="w-full max-w-sm rounded-2xl border p-6" style={{ backgroundColor: C.card, borderColor: C.line }}>
          <h1 className="text-2xl font-extrabold tracking-tight text-center leading-tight">
            Garderie École<br /><span style={{ color: C.yellow }}>d'Hesloup</span>
          </h1>
          <p className="text-sm text-center mb-6" style={{ color: C.grey }}>Espace personnel — connexion</p>

          <label className="text-sm block mb-3">
            <span className="block text-xs mb-1" style={{ color: C.grey }}>Identifiant</span>
            <input value={loginData.identifiant}
              onChange={(ev) => setLoginData({ ...loginData, identifiant: ev.target.value })}
              onKeyDown={(ev) => ev.key === "Enter" && seConnecter()}
              placeholder="Ex. : sophie"
              className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
          </label>
          <label className="text-sm block mb-4">
            <span className="block text-xs mb-1" style={{ color: C.grey }}>Mot de passe</span>
            <input type="password" value={loginData.mdp}
              onChange={(ev) => setLoginData({ ...loginData, mdp: ev.target.value })}
              onKeyDown={(ev) => ev.key === "Enter" && seConnecter()}
              placeholder="••••••••"
              className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
          </label>

          {loginErreur && (
            <p className="text-sm mb-3 flex items-center gap-1" style={{ color: C.red }}>
              <AlertTriangle size={14} /> {loginErreur}
            </p>
          )}

          <label className="flex items-center gap-2 mb-4 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={resterConnecte}
              onChange={(ev) => setResterConnecte(ev.target.checked)}
              className="w-4 h-4" style={{ accentColor: C.ink }} />
            <span style={{ color: C.ink }}>Rester connecté sur cet appareil</span>
          </label>

          <button onClick={seConnecter} disabled={connexionEnCours}
            className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: C.ink, color: "#fff" }}>
            <LogIn size={16} /> {connexionEnCours ? "Connexion…" : "Se connecter"}
          </button>

          <p className="mt-4 text-xs text-center" style={{ color: C.grey }}>
            Connectez-vous avec votre identifiant ou votre adresse e-mail.<br />
            Décochez « rester connecté » sur un ordinateur partagé.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.paper, color: C.ink }}>
      {/* En-tête */}
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {logo && (
              <img src={logo} alt="Logo" style={{ maxHeight: 48, maxWidth: 120, objectFit: "contain" }} />
            )}
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Garderie École <span style={{ color: C.yellow }}>d'Hesloup</span>
              </h1>
              <p className="text-sm capitalize" style={{ color: C.grey }}>{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold">{session.nom}</div>
              <div className="text-xs" style={{ color: C.grey }}>
                {session.role === "admin" ? "Administrateur" : "Membre de l'équipe"}
              </div>
            </div>
            <Badge color={C.ink} bg={C.yellow}>{presents} présent{presents > 1 ? "s" : ""}</Badge>
            <button onClick={seDeconnecter} title="Se déconnecter"
              className="p-2 rounded-xl" style={{ backgroundColor: C.line, color: C.ink }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 mt-4 overflow-x-auto pb-1">
          {onglets.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors"
              style={tab === id
                ? { backgroundColor: C.ink, color: "#fff" }
                : { color: C.grey }}
            >
              <Icon size={16} />
              {label}
              {badge > 0 && (
                <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ backgroundColor: C.yellow, color: C.ink }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="px-6 pb-10 max-w-5xl">
        {/* ---------- Tableau de bord ---------- */}
        {tab === "dashboard" && (
          <div className="space-y-4">
            <div className={`grid grid-cols-2 gap-3 ${session?.role === "admin" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
              <StatCard icon={ClipboardCheck} label="Présents maintenant" value={presents} accent={C.green} />
              <StatCard icon={LogOut} label="Départs aujourd'hui" value={partis} accent={C.red} />
              <StatCard icon={Users} label="Enfants inscrits" value={enfants.length} accent={C.yellow} />
              {session?.role === "admin" && (
                <StatCard icon={Euro} label="Facturation du trimestre" value={`${totalTrimestre.toFixed(0)} €`} accent={C.ink} />
              )}
            </div>
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <h2 className="font-bold mb-3">Encore présents à la garderie</h2>
              {presents === 0 && <p className="text-sm" style={{ color: C.grey }}>Aucun enfant présent pour le moment.</p>}
              <ul className="space-y-2">
                {enfants.filter((e) => e.statut === "present").map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{e.nom} <span style={{ color: C.grey }}>· {e.classe}</span></span>
                    <span className="flex items-center gap-1" style={{ color: C.green }}>
                      <Clock size={14} /> depuis {e.arrivee}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ---------- Pointage ---------- */}
        {tab === "pointage" && (
          <div className="space-y-4">
            {/* Inscription du jour pour les enfants à la carte */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <UserPlus size={16} style={{ color: C.yellow }} /> Enfants à la carte — inscription du jour
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={14} style={{ color: C.grey, position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      value={recherchePointage}
                      onChange={(ev) => setRecherchePointage(ev.target.value)}
                      placeholder="Rechercher…"
                      className="rounded-lg border pl-7 pr-7 py-1 text-xs outline-none"
                      style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink, width: "150px" }} />
                    {recherchePointage && (
                      <button onClick={() => setRecherchePointage("")}
                        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: C.grey }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {classesDisponibles.length > 0 && (
                    <select value={filtreClassePointage}
                      onChange={(ev) => setFiltreClassePointage(ev.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs font-semibold outline-none"
                      style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }}>
                      <option value="">Toutes les classes</option>
                      {classesDisponibles.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                    </select>
                  )}
                  <button onClick={() => setListePointageVisible((v) => !v)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }}>
                    <ChevronDown size={14} style={{ transform: listePointageVisible ? "none" : "rotate(-90deg)", transition: "transform .2s" }} />
                    {listePointageVisible ? "Masquer" : "Afficher"}
                  </button>
                </div>
              </div>
              {listePointageVisible && (
                carteNonInscritsFiltres.length === 0 ? (
                  <p className="text-sm" style={{ color: C.grey }}>
                    {recherchePointageNorm
                      ? "Aucun enfant à la carte ne correspond à la recherche."
                      : filtreClassePointage
                        ? "Aucun enfant à la carte à inscrire dans cette classe."
                        : "Tous les enfants à la carte sont inscrits pour aujourd'hui."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 overflow-y-auto pr-1" style={{ maxHeight: "22vh" }}>
                    {carteNonInscritsFiltres.map((e) => (
                      <button key={e.id} onClick={() => ajouterAuJour(e.id)}
                        className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium border"
                        style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }}>
                        <Plus size={14} style={{ color: C.green }} /> {e.nom} <span style={{ color: C.grey }}>· {e.classe}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
              <p className="text-xs mt-2" style={{ color: C.grey }}>
                Les enfants au forfait apparaissent automatiquement ci-dessous. Cliquez sur un nom pour ajouter un enfant à la carte au pointage du jour.
              </p>
            </div>

            {/* Cartes de pointage */}
            <div className="grid gap-3 md:grid-cols-2">
                {enfantsPointage.map((e) => (
                <div key={e.id} className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: e.statut === "present" ? C.green : C.line }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold">{e.nom}</div>
                      <div className="text-xs" style={{ color: C.grey }}>
                        {e.classe} · {LABEL_FORMULE[e.formule]}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {statutBadge(e)}
                      {e.formule === "carte" && e.statut === "absent" && (
                        <button title="Retirer du pointage du jour" onClick={() => retirerDuJour(e.id)}
                          className="p-1 rounded-lg" style={{ color: C.grey }}>
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  {e.allergies && (
                    <div className="flex items-center gap-1 mt-2 text-xs font-semibold" style={{ color: C.red }}>
                      <AlertTriangle size={13} /> Allergie : {e.allergies}
                    </div>
                  )}
                  {e.statut === "present" && enMinutes(heure()) > enMinutes(FERMETURE) && (
                    <div className="flex items-center gap-1 mt-2 text-xs font-semibold" style={{ color: C.red }}>
                      <AlertTriangle size={13} /> Après la fermeture ({FERMETURE.replace(":", "h")}) — pensez à pointer le départ
                    </div>
                  )}
                  {e.formule === "carte" && e.statut === "present" && (() => {
                    // Aperçu robuste : on montre le créneau où l'enfant se trouve
                    // à son heure d'arrivée. Ne pas se baser sur la durée écoulée
                    // (arrivée→maintenant), car juste après le pointage elle vaut 0
                    // et donnerait "hors créneau" à tort.
                    const creneauActuel = creneauPourHeure(creneaux, e.arrivee);
                    // Créneaux déjà traversés depuis l'arrivée (peut être vide au début).
                    const dejaTraverses = passagesDepuisPresence(creneaux, e.arrivee, plafonneFermeture(heure()));
                    // On rassemble les créneaux à signaler : le courant + les traversés.
                    const idsAffiches = new Set();
                    const aAfficher = [];
                    if (creneauActuel) { idsAffiches.add(creneauActuel.id); aAfficher.push(creneauActuel); }
                    dejaTraverses.forEach((p) => {
                      if (!idsAffiches.has(p.creneauId)) {
                        const cr = creneaux.find((c) => c.id === p.creneauId);
                        if (cr) { idsAffiches.add(cr.id); aAfficher.push(cr); }
                      }
                    });
                    return (
                      <div className="flex items-start gap-1 mt-2 text-xs" style={{ color: C.grey }}>
                        <Clock size={13} style={{ color: C.yellow, marginTop: 2 }} />
                        {aAfficher.length > 0
                          ? <span>À facturer : {aAfficher.map((cr) =>
                              `${cr.nom} (${cr.montant.toFixed(2).replace(".", ",")} €)`
                            ).join(" + ")}</span>
                          : <span>Présence hors créneau — non facturée pour l'instant</span>}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => pointer(e.id, "arrivee")}
                      disabled={e.statut === "present" || pointageEnCours === e.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                      style={{ backgroundColor: C.green + "1A", color: C.green }}>
                      <LogIn size={15} /> Arrivée
                    </button>
                    <button
                      onClick={() => pointer(e.id, "depart")}
                      disabled={e.statut !== "present" || pointageEnCours === e.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                      style={{ backgroundColor: C.red + "1A", color: C.red }}>
                      <LogOut size={15} /> Départ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Historique ---------- */}
        {tab === "historique" && (
          <div className="space-y-3 max-w-3xl">
            {/* Aujourd'hui */}
            <div className="rounded-2xl border" style={{ backgroundColor: C.card, borderColor: C.yellow }}>
              <div className="p-4 pb-2">
                <div className="font-bold capitalize">{today} <Badge color={C.ink} bg={C.yellow}>Aujourd'hui</Badge></div>
              </div>
              {enfants.filter((e) => e.arrivee).length === 0 ? (
                <p className="px-4 pb-4 text-sm" style={{ color: C.grey }}>
                  Aucun pointage pour le moment. Les arrivées apparaîtront ici en temps réel.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase" style={{ color: C.grey }}>
                      <th className="px-4 py-2">Enfant</th>
                      <th className="px-4 py-2">Arrivée</th>
                      <th className="px-4 py-2">Départ</th>
                      <th className="px-4 py-2">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enfants.filter((e) => e.arrivee).map((e) => (
                      <tr key={e.id} className="border-t" style={{ borderColor: C.line }}>
                        <td className="px-4 py-2 font-medium">{e.nom}</td>
                        <td className="px-4 py-2">{e.arrivee}</td>
                        <td className="px-4 py-2">
                          {e.depart || <span style={{ color: C.green }}>Encore présent</span>}
                        </td>
                        <td className="px-4 py-2">{duree(e.arrivee, e.depart) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Jours passés */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold flex items-center gap-2">
                  <History size={17} style={{ color: C.yellow }} /> Jours passés
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: C.grey }}>Du</span>
                    <input type="date" value={histoDebut} max={histoFin}
                      onChange={(ev) => setHistoDebut(ev.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: C.grey }}>au</span>
                    <input type="date" value={histoFin} min={histoDebut}
                      onChange={(ev) => setHistoFin(ev.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs outline-none" style={{ borderColor: C.line }} />
                  </label>
                </div>
              </div>
            </div>

            {histoErreur && (
              <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2"
                style={{ backgroundColor: "#FBEAE7", borderColor: C.red, color: C.red }}>
                <AlertTriangle size={16} /> {histoErreur}
              </div>
            )}
            {histoChargement && (
              <p className="text-sm" style={{ color: C.grey }}>Chargement de l'historique…</p>
            )}
            {!histoChargement && historique.length === 0 && !histoErreur && (
              <p className="text-sm" style={{ color: C.grey }}>
                Aucun pointage enregistré sur cette période.
              </p>
            )}

            {/* Liste des jours passés */}
            {historique.map((j) => (
              <div key={j.id} className="rounded-2xl border" style={{ backgroundColor: C.card, borderColor: C.line }}>
                <button
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setJourOuvert(jourOuvert === j.id ? null : j.id)}>
                  <div className="font-bold capitalize">
                    {j.date}{" "}
                    <span className="font-normal text-sm" style={{ color: C.grey }}>
                      · {j.entrees.length} enfant{j.entrees.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <ChevronDown size={18} style={{ color: C.grey, transform: jourOuvert === j.id ? "rotate(180deg)" : "none" }} />
                </button>
                {jourOuvert === j.id && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase" style={{ color: C.grey }}>
                        <th className="px-4 py-2">Enfant</th>
                        <th className="px-4 py-2">Arrivée</th>
                        <th className="px-4 py-2">Départ</th>
                        <th className="px-4 py-2">Durée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {j.entrees.map((en, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: C.line }}>
                          <td className="px-4 py-2 font-medium">{en.nom}</td>
                          <td className="px-4 py-2">{en.arrivee}</td>
                          <td className="px-4 py-2">{en.depart}</td>
                          <td className="px-4 py-2">{duree(en.arrivee, en.depart) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            <p className="text-xs" style={{ color: C.grey }}>
              L'historique reflète les pointages réellement enregistrés en base. La journée en cours apparaît en haut, sous « Aujourd'hui ».
            </p>
          </div>
        )}

        {/* ---------- Familles ---------- */}
        {tab === "familles" && (
          <div className="space-y-4">
            {erreurEnfants && (
              <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2"
                style={{ backgroundColor: "#FBEAE7", borderColor: C.red, color: C.red }}>
                <AlertTriangle size={16} /> {erreurEnfants}
              </div>
            )}
            {!enfantsCharges && (
              <p className="text-sm" style={{ color: C.grey }}>Chargement des enfants…</p>
            )}
            {!formEnfant && (
              <button onClick={() => setFormEnfant(enfantVide)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: C.ink, color: "#fff" }}>
                <Plus size={16} /> Ajouter un enfant
              </button>
            )}

            {formEnfant && (
              <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.yellow }}>
                <h2 className="font-bold mb-3">{formEnfant.id ? "Modifier la fiche" : "Nouvel enfant"}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="block text-xs mb-1" style={{ color: C.grey }}>Nom et prénom</span>
                    <input value={formEnfant.nom}
                      onChange={(ev) => setFormEnfant({ ...formEnfant, nom: ev.target.value })}
                      placeholder="Ex. : Zoé Lambert"
                      className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="text-sm">
                    <span className="block text-xs mb-1" style={{ color: C.grey }}>Classe</span>
                    <input value={formEnfant.classe}
                      onChange={(ev) => setFormEnfant({ ...formEnfant, classe: ev.target.value })}
                      placeholder="Ex. : CE1"
                      className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="text-sm">
                    <span className="block text-xs mb-1" style={{ color: C.grey }}>Parent référent</span>
                    <input value={formEnfant.parent}
                      onChange={(ev) => setFormEnfant({ ...formEnfant, parent: ev.target.value })}
                      placeholder="Ex. : Mme Lambert"
                      className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="text-sm">
                    <span className="block text-xs mb-1" style={{ color: C.grey }}>Formule</span>
                    <select value={formEnfant.formule}
                      onChange={(ev) => setFormEnfant({ ...formEnfant, formule: ev.target.value })}
                      className="w-full rounded-xl border px-3 py-2 outline-none bg-white" style={{ borderColor: C.line }}>
                      <option value="forfait">Forfait trimestriel</option>
                      <option value="carte">À la carte</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="block text-xs mb-1" style={{ color: C.grey }}>Allergies / consignes médicales</span>
                    <input value={formEnfant.allergies}
                      onChange={(ev) => setFormEnfant({ ...formEnfant, allergies: ev.target.value })}
                      placeholder="Ex. : Arachides — laisser vide si aucune"
                      className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="text-sm">
                    <span className="block text-xs mb-1" style={{ color: C.grey }}>Contact d'urgence</span>
                    <input value={formEnfant.urgence}
                      onChange={(ev) => setFormEnfant({ ...formEnfant, urgence: ev.target.value })}
                      placeholder="Ex. : Mme Lambert · 06 00 00 00 00"
                      className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="block text-xs mb-1" style={{ color: C.grey }}>Personnes autorisées à récupérer l'enfant</span>
                    <input value={formEnfant.autorises}
                      onChange={(ev) => setFormEnfant({ ...formEnfant, autorises: ev.target.value })}
                      placeholder="Ex. : Mme Lambert, M. Lambert, Mme Durand (grand-mère)"
                      className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                  </label>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={sauverEnfant}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: C.green, color: "#fff" }}>
                    <Check size={15} /> Enregistrer
                  </button>
                  <button onClick={() => setFormEnfant(null)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: C.line, color: C.ink }}>
                    <X size={15} /> Annuler
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1" style={{ minWidth: "200px" }}>
                <Search size={16} style={{ color: C.grey, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={rechercheEnfant}
                  onChange={(ev) => setRechercheEnfant(ev.target.value)}
                  placeholder="Rechercher un enfant par nom ou prénom…"
                  className="w-full rounded-xl border pl-9 pr-9 py-2 text-sm outline-none"
                  style={{ borderColor: C.line, backgroundColor: C.card }} />
                {rechercheEnfant && (
                  <button onClick={() => setRechercheEnfant("")}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.grey }}>
                    <X size={16} />
                  </button>
                )}
              </div>
              {classesDisponibles.length > 0 && (
                <select value={filtreClasseFamilles}
                  onChange={(ev) => setFiltreClasseFamilles(ev.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold outline-none"
                  style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }}>
                  <option value="">Toutes les classes</option>
                  {classesDisponibles.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                </select>
              )}
            </div>
            {(rechercheNorm || filtreClasseFamilles) && (
              <p className="text-xs" style={{ color: C.grey }}>
                {enfantsTries.length} enfant{enfantsTries.length > 1 ? "s" : ""}
                {filtreClasseFamilles ? ` en ${filtreClasseFamilles}` : ""}
                {rechercheNorm ? ` pour « ${rechercheEnfant} »` : ""}
              </p>
            )}

            {/* Tableau — écrans larges uniquement (tablette paysage, ordinateur) */}
            <div className="rounded-2xl border overflow-hidden hidden md:block" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase" style={{ color: C.grey }}>
                    <th className="p-3">
                      <button onClick={() => trierPar("nom")} className="flex items-center gap-1 uppercase font-semibold hover:opacity-70" style={{ color: triEnfants.champ === "nom" ? C.ink : C.grey }}>
                        Enfant {triEnfants.champ === "nom" && (triEnfants.sens === "asc" ? "▲" : "▼")}
                      </button>
                    </th>
                    <th className="p-3">
                      <button onClick={() => trierPar("classe")} className="flex items-center gap-1 uppercase font-semibold hover:opacity-70" style={{ color: triEnfants.champ === "classe" ? C.ink : C.grey }}>
                        Classe {triEnfants.champ === "classe" && (triEnfants.sens === "asc" ? "▲" : "▼")}
                      </button>
                    </th>
                    <th className="p-3">
                      <button onClick={() => trierPar("parent")} className="flex items-center gap-1 uppercase font-semibold hover:opacity-70" style={{ color: triEnfants.champ === "parent" ? C.ink : C.grey }}>
                        Parent {triEnfants.champ === "parent" && (triEnfants.sens === "asc" ? "▲" : "▼")}
                      </button>
                    </th>
                    <th className="p-3">Formule</th>
                    <th className="p-3">
                      <div className="flex items-center gap-2">
                        <span>Présence</span>
                        <select value={periodePresence}
                          onChange={(ev) => setPeriodePresence(ev.target.value)}
                          className="rounded-lg border px-2 py-1 text-xs font-semibold outline-none bg-white normal-case"
                          style={{ borderColor: C.line, color: C.ink }}
                          onClick={(ev) => ev.stopPropagation()}>
                          <option value="jour">Journalière</option>
                          <option value="semaine">Hebdomadaire</option>
                          <option value="mois">Mensuelle</option>
                        </select>
                      </div>
                    </th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enfantsTries.map((e) => (
                    <React.Fragment key={e.id}>
                      <tr className="border-t" style={{ borderColor: C.line }}>
                        <td className="p-3 font-medium">
                          <button
                            onClick={() => setFicheOuverte(ficheOuverte === e.id ? null : e.id)}
                            title="Voir la fiche détaillée"
                            className="flex items-center gap-1 hover:underline text-left"
                            style={{ color: C.ink }}>
                            {e.nom}
                            {e.allergies && <AlertTriangle size={13} style={{ color: C.red }} title={`Allergie : ${e.allergies}`} />}
                          </button>
                        </td>
                        <td className="p-3">{e.classe}</td>
                        <td className="p-3">{e.parent}</td>
                        <td className="p-3">
                          {e.formule === "carte"
                            ? <Badge color={C.ink} bg={C.line}>À la carte</Badge>
                            : <Badge color={C.ink} bg={C.yellow + "55"}>Forfait</Badge>}
                        </td>
                        <td className="p-3">
                          {(() => {
                            const min = presenceParPeriode(e, periodePresence);
                            return min > 0
                              ? fmtMinutes(min)
                              : <span style={{ color: C.grey }}>—</span>;
                          })()}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button title="Fiche détaillée"
                              onClick={() => setFicheOuverte(ficheOuverte === e.id ? null : e.id)}
                              className="p-2 rounded-lg" style={{ color: C.ink, backgroundColor: C.paper }}>
                              <ChevronDown size={15} style={{ transform: ficheOuverte === e.id ? "rotate(180deg)" : "none" }} />
                            </button>
                            <button title="Modifier"
                              onClick={() => modifierEnfantUI(e)}
                              className="p-2 rounded-lg" style={{ color: C.ink, backgroundColor: C.paper }}>
                              <Pencil size={15} />
                            </button>
                            {session?.role === "admin" && (
                              <button title="Supprimer"
                                onClick={() => demanderSuppression(
                                  `Supprimer la fiche de ${e.nom} ? L'historique de pointage et la facturation en cours seront perdus.`,
                                  () => supprimerEnfant(e.id)
                                )}
                                className="p-2 rounded-lg" style={{ color: C.red, backgroundColor: C.red + "15" }}>
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {ficheOuverte === e.id && (
                        <tr style={{ backgroundColor: C.paper }}>
                          <td className="px-3 pb-3 pt-1" colSpan={6}>
                            <div className="grid sm:grid-cols-3 gap-3 text-sm rounded-xl p-3" style={{ backgroundColor: C.paper }}>
                              <div>
                                <div className="text-xs font-semibold uppercase mb-1" style={{ color: C.grey }}>Allergies / consignes</div>
                                {e.allergies
                                  ? <span className="font-semibold" style={{ color: C.red }}>⚠ {e.allergies}</span>
                                  : <span style={{ color: C.grey }}>Aucune allergie connue</span>}
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase mb-1" style={{ color: C.grey }}>Contact d'urgence</div>
                                {e.urgence || <span style={{ color: C.grey }}>Non renseigné</span>}
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase mb-1" style={{ color: C.grey }}>Personnes autorisées</div>
                                {e.autorises || <span style={{ color: C.grey }}>Non renseigné</span>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {enfants.length === 0 && (
                    <tr><td className="p-4 text-sm" colSpan={6} style={{ color: C.grey }}>
                      Aucun enfant inscrit. Ajoutez une première fiche pour commencer.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cartes — petits écrans (tablette portrait, téléphone) */}
            <div className="md:hidden space-y-3">
              {enfantsTries.map((e) => (
                <div key={e.id} className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        onClick={() => setFicheOuverte(ficheOuverte === e.id ? null : e.id)}
                        className="font-bold flex items-center gap-1 flex-wrap text-left hover:underline"
                        style={{ color: C.ink }}>
                        {e.nom}
                        {e.allergies && <AlertTriangle size={14} style={{ color: C.red }} title={`Allergie : ${e.allergies}`} />}
                      </button>
                      <div className="text-sm mt-0.5" style={{ color: C.grey }}>
                        {e.classe && <span>{e.classe}</span>}
                        {e.classe && e.parent && <span> · </span>}
                        {e.parent && <span>{e.parent}</span>}
                      </div>
                      <div className="mt-2">
                        {e.formule === "carte"
                          ? <Badge color={C.ink} bg={C.line}>À la carte</Badge>
                          : <Badge color={C.ink} bg={C.yellow + "55"}>Forfait</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button title="Détails"
                        onClick={() => setFicheOuverte(ficheOuverte === e.id ? null : e.id)}
                        className="p-2 rounded-lg" style={{ color: C.ink, backgroundColor: C.paper }}>
                        <ChevronDown size={16} style={{ transform: ficheOuverte === e.id ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                      </button>
                      <button title="Modifier" onClick={() => modifierEnfantUI(e)}
                        className="p-2 rounded-lg" style={{ color: C.ink, backgroundColor: C.paper }}>
                        <Pencil size={16} />
                      </button>
                      {session?.role === "admin" && (
                        <button title="Supprimer"
                          onClick={() => demanderSuppression(
                            `Supprimer la fiche de ${e.nom} ? L'historique de pointage et la facturation en cours seront perdus.`,
                            () => supprimerEnfant(e.id)
                          )}
                          className="p-2 rounded-lg" style={{ color: C.red, backgroundColor: C.red + "15" }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Détails repliables : parent, urgence, autorisés (fermés par défaut) */}
                  {ficheOuverte === e.id && (
                    <div className="mt-3 pt-3 border-t space-y-2 text-sm" style={{ borderColor: C.line }}>
                      <div>
                        <span className="text-xs font-semibold uppercase" style={{ color: C.grey }}>Parent référent</span>
                        <div>{e.parent || <span style={{ color: C.grey }}>—</span>}</div>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase" style={{ color: C.grey }}>Contact d'urgence</span>
                        <div>{e.urgence || <span style={{ color: C.grey }}>—</span>}</div>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase" style={{ color: C.grey }}>Personnes autorisées</span>
                        <div>{e.autorises || <span style={{ color: C.grey }}>—</span>}</div>
                      </div>
                      {e.allergies && (
                        <div>
                          <span className="text-xs font-semibold uppercase" style={{ color: C.grey }}>Allergies / consignes</span>
                          <div className="font-semibold" style={{ color: C.red }}>⚠ {e.allergies}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {enfants.length === 0 && (
                <p className="text-sm p-4" style={{ color: C.grey }}>
                  Aucun enfant inscrit. Ajoutez une première fiche pour commencer.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ---------- Facturation ---------- */}
        {tab === "facturation" && session?.role !== "admin" && (
          <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2"
            style={{ backgroundColor: "#FFF6E5", borderColor: C.yellow, color: "#A87E12" }}>
            <Shield size={16} /> La facturation est réservée aux administrateurs.
          </div>
        )}
        {tab === "facturation" && session?.role === "admin" && (
          <div className="space-y-4">
            {erreurFacturation && (
              <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2"
                style={{ backgroundColor: "#FBEAE7", borderColor: C.red, color: C.red }}>
                <AlertTriangle size={16} /> {erreurFacturation}
              </div>
            )}
            {chargementFacturation && (
              <p className="text-sm" style={{ color: C.grey }}>Calcul de la facturation…</p>
            )}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} style={{ color: C.yellow }} />
                  <span className="text-sm font-semibold">Trimestre facturé</span>
                </div>
                <select value={trimestre}
                  onChange={(ev) => setTrimestre(ev.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none bg-white"
                  style={{ borderColor: C.line, color: C.ink }}>
                  {TRIMESTRES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} ({periodeTrimestre(t.id, datesTrimestres)})</option>
                  ))}
                </select>
                {trimestre === trimestreCourant() && (
                  <Badge color={C.ink} bg={C.yellow}>Trimestre en cours</Badge>
                )}
                <button onClick={imprimerBordereau}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: C.ink, color: "#fff" }}>
                  <FileDown size={16} /> Imprimer le bordereau
                </button>
              </div>
            </div>

            {/* Report de facturation (seuil 15 €) */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <button
                onClick={() => {
                  const ouvre = !reportOuvert;
                  setReportOuvert(ouvre);
                  if (ouvre && !recapReport) chargerRecapReport();
                }}
                className="w-full flex items-center justify-between gap-2">
                <span className="font-bold flex items-center gap-2">
                  <Euro size={17} style={{ color: C.yellow }} /> Report de facturation (seuil 15 €)
                </span>
                <ChevronDown size={18} style={{ color: C.grey, transform: reportOuvert ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>

              {reportOuvert && (
                <div className="mt-4">
                  <p className="text-xs mb-3" style={{ color: C.grey }}>
                    Une famille dont le total du trimestre est inférieur à 15 € n'est pas facturée : le montant
                    est reporté sur le trimestre suivant et cumulé jusqu'à atteindre le seuil. La colonne
                    « report entrant » peut être saisie manuellement (reprise de l'existant) ; elle est ensuite
                    calculée automatiquement d'un trimestre à l'autre.
                  </p>
                  {reportMessage && (
                    <p className="text-sm mb-2 font-semibold"
                      style={{ color: reportMessage.includes("invalide") || reportMessage.includes("impossible") ? C.red : C.green }}>
                      {reportMessage}
                    </p>
                  )}
                  {!recapReport ? (
                    <p className="text-sm py-3 text-center" style={{ color: C.grey }}>Chargement…</p>
                  ) : recapReport.lignes.length === 0 ? (
                    <p className="text-sm py-3 text-center" style={{ color: C.grey }}>
                      Aucune famille inscrite.
                    </p>
                  ) : (
                    <div>
                      {/* Recherche d'une famille */}
                      <div className="relative mb-3">
                        <Search size={16} style={{ color: C.grey, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          value={rechercheReport}
                          onChange={(ev) => { setRechercheReport(ev.target.value); setFamilleReportSel(null); }}
                          placeholder="Rechercher une famille par le nom du parent référent…"
                          className="w-full rounded-xl border pl-9 pr-9 py-2 text-sm outline-none"
                          style={{ borderColor: C.line, backgroundColor: C.paper }} />
                        {rechercheReport && (
                          <button onClick={() => { setRechercheReport(""); setFamilleReportSel(null); }}
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.grey }}>
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {(() => {
                        const q = rechercheReport.trim().toLowerCase();
                        // Tant qu'aucune recherche, on n'affiche rien (on évite la longue liste).
                        if (!q) {
                          return <p className="text-sm py-2 text-center" style={{ color: C.grey }}>
                            Tapez le nom d'une famille pour saisir ou vérifier son report.
                          </p>;
                        }
                        const resultats = recapReport.lignes.filter((l) =>
                          (l.parent || "").toLowerCase().includes(q));
                        if (resultats.length === 0) {
                          return <p className="text-sm py-2 text-center" style={{ color: C.grey }}>Aucune famille trouvée.</p>;
                        }
                        // Si une famille est sélectionnée, on n'affiche qu'elle (détail + saisie).
                        const aAfficher = familleReportSel
                          ? resultats.filter((l) => l.famille_id === familleReportSel)
                          : resultats.slice(0, 8); // liste courte de résultats à choisir

                        return (
                          <div className="space-y-2">
                            {!familleReportSel && resultats.length > 1 && (
                              <p className="text-xs" style={{ color: C.grey }}>
                                {resultats.length} familles — cliquez sur l'une d'elles pour la traiter.
                              </p>
                            )}
                            {aAfficher.map((l) => (
                              <div key={l.famille_id} className="rounded-xl border p-3"
                                style={{ borderColor: familleReportSel === l.famille_id ? C.yellow : C.line, backgroundColor: C.paper }}>
                                <button
                                  onClick={() => setFamilleReportSel(familleReportSel === l.famille_id ? null : l.famille_id)}
                                  className="w-full text-left">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm">
                                      <span className="font-semibold">{l.parent}</span>
                                      {l.prenoms && l.prenoms.length > 0 && (
                                        <span style={{ color: C.grey }}> ({l.prenoms.join(", ")})</span>
                                      )}
                                      <span style={{ color: C.grey }}> · trimestre {l.total_trimestre.toFixed(2).replace(".", ",")} €</span>
                                      {l.report_entrant > 0 && (
                                        <span style={{ color: C.grey }}> + report {l.report_entrant.toFixed(2).replace(".", ",")} €</span>
                                      )}
                                      <span> = <strong>{l.total_du.toFixed(2).replace(".", ",")} €</strong></span>
                                    </div>
                                    <div>
                                      {l.total_du === 0
                                        ? <Badge color={C.grey} bg={C.line}>Aucun montant</Badge>
                                        : l.facturable
                                          ? <Badge color="#fff" bg={C.green}>Facturable</Badge>
                                          : <Badge color={C.ink} bg={C.yellow}>Reporté ({l.report_sortant.toFixed(2).replace(".", ",")} €)</Badge>}
                                    </div>
                                  </div>
                                </button>
                                {/* Saisie visible seulement quand la famille est sélectionnée */}
                                {familleReportSel === l.famille_id && (
                                  <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: C.line }}>
                                    <label className="text-xs" style={{ color: C.grey }}>Report du trimestre précédent</label>
                                    <input type="number" step="0.01" min="0"
                                      value={reportSaisie[l.famille_id] ?? ""}
                                      onChange={(ev) => setReportSaisie((prev) => ({ ...prev, [l.famille_id]: ev.target.value }))}
                                      className="rounded-lg border px-2 py-1 text-sm outline-none" style={{ borderColor: C.line, width: "90px" }} />
                                    <span className="text-xs" style={{ color: C.grey }}>€</span>
                                    <button onClick={() => enregistrerReportFamille(l.famille_id)}
                                      className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: C.ink, color: "#fff" }}>
                                      Enregistrer
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-xl px-3 py-2 border" style={{ borderColor: C.line, backgroundColor: C.card }}>
                Forfait trimestriel : <strong>{prixForfait.toFixed(2).replace(".", ",")} € / trim.</strong>
              </div>
              <div className="rounded-xl px-3 py-2 border" style={{ borderColor: C.line, backgroundColor: C.card }}>
                À la carte : <strong>{creneaux.length} créneau{creneaux.length > 1 ? "x" : ""}</strong> <span style={{ color: C.grey }}>(tarif par créneau)</span>
              </div>
              {session?.role === "admin" && (
                <button onClick={() => setTab("admin")}
                  className="rounded-xl px-3 py-2 flex items-center gap-1 font-semibold"
                  style={{ backgroundColor: C.ink, color: "#fff" }}>
                  <Settings size={14} /> Modifier les tarifs
                </button>
              )}
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase" style={{ color: C.grey }}>
                    <th className="p-3">Famille</th>
                    <th className="p-3">Formule</th>
                    <th className="p-3">Détail</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3">Paiement</th>
                    <th className="p-3 text-right">Facture</th>
                  </tr>
                </thead>
                <tbody>
                  {(recapFacturation?.lignes || []).map((l, idx, arr) => {
                    // Détecte si c'est la dernière ligne de cette famille dans la liste
                    // (pour insérer la ligne "Report" juste après, une seule fois).
                    const reports = recapFacturation?.reports_par_famille || {};
                    const estDernierDeFamille =
                      l.famille_id &&
                      reports[l.famille_id] > 0 &&
                      !arr.slice(idx + 1).some((x) => x.famille_id === l.famille_id);
                    const nonFacturable = l.famille_facturable === false;
                    return (
                    <React.Fragment key={l.enfant_id}>
                    <tr className="border-t" style={{ borderColor: C.line, backgroundColor: nonFacturable ? "#FDF6E3" : undefined }}>
                      <td className="p-3 font-medium">
                        {l.parent} <span style={{ color: C.grey }}>({(l.enfant || "").split(" ")[0]})</span>
                        {nonFacturable && <span className="ml-2 text-xs font-semibold" style={{ color: "#A87E12" }}>· non facturé (&lt; {Number(recapFacturation.seuil_eur || 15)} €)</span>}
                      </td>
                      <td className="p-3">{LABEL_FORMULE_COURT[l.formule] || l.formule}</td>
                      <td className="p-3" style={{ color: C.grey }}>
                        {l.formule === "forfait" ? "Accès illimité" : "Passages du trimestre"}
                      </td>
                      <td className="p-3 text-right font-bold" style={{ color: nonFacturable ? "#A87E12" : undefined }}>{Number(l.montant_eur).toFixed(2).replace(".", ",")} €</td>
                      <td className="p-3">
                        <select value={l.statut_paiement}
                          onChange={(ev) => changerPaiement(l.enfant_id, ev.target.value)}
                          className="rounded-lg border px-2 py-1 text-xs font-semibold outline-none"
                          style={{
                            borderColor: l.statut_paiement === "paye" ? C.green : l.statut_paiement === "relance" ? C.red : C.yellow,
                            color: l.statut_paiement === "paye" ? C.green : l.statut_paiement === "relance" ? C.red : "#A87E12",
                            backgroundColor: "#fff",
                          }}>
                          <option value="paye">Payé</option>
                          <option value="attente">En attente</option>
                          <option value="relance">À relancer</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button title="Facture de l'enfant" onClick={() => exporterFacture(l.enfant_id)}
                            className="flex items-center gap-1 p-2 rounded-lg text-xs font-semibold"
                            style={{ color: C.ink, backgroundColor: C.paper }}>
                            <FileDown size={15} />
                          </button>
                          {l.famille_id && (
                            <button title="Facture groupée de la famille" onClick={() => exporterFactureFamille(l.famille_id)}
                              className="flex items-center gap-1 p-2 rounded-lg text-xs font-semibold"
                              style={{ color: C.green, backgroundColor: C.green + "15" }}>
                              <Users size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {estDernierDeFamille && (
                      <tr style={{ backgroundColor: C.yellow + "12" }}>
                        <td className="p-3 pl-6 text-sm" style={{ color: "#A87E12" }}>
                          ↳ Report des trimestres précédents ({l.parent})
                        </td>
                        <td className="p-3"></td>
                        <td className="p-3 text-sm" style={{ color: C.grey }}>Reliquat sous le seuil, reporté</td>
                        <td className="p-3 text-right font-bold" style={{ color: "#A87E12" }}>
                          {Number(reports[l.famille_id]).toFixed(2).replace(".", ",")} €
                        </td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                      </tr>
                    )}
                    </React.Fragment>
                    );
                  })}
                  {recapFacturation && recapFacturation.lignes.length === 0 && (
                    <tr><td className="p-4 text-sm" colSpan={6} style={{ color: C.grey }}>
                      Aucune facturation sur ce trimestre.
                    </td></tr>
                  )}
                  {recapFacturation && (
                    <tr className="border-t" style={{ borderColor: C.ink }}>
                      <td className="p-3 font-bold" colSpan={3}>Total du trimestre <span className="font-normal text-xs" style={{ color: C.grey }}>(familles facturables)</span></td>
                      <td className="p-3 text-right font-extrabold">{Number(recapFacturation.total_eur).toFixed(2).replace(".", ",")} €</td>
                      <td className="p-3 text-xs font-semibold" colSpan={2} style={{ color: C.red }}>
                        dont {Number(recapFacturation.impayes_eur).toFixed(2).replace(".", ",")} € non encaissés
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Familles avec report mais sans fréquentation ce trimestre */}
            {recapFacturation && recapFacturation.reports_sans_activite && recapFacturation.reports_sans_activite.length > 0 && (
              <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.yellow }}>
                <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <Euro size={15} style={{ color: C.yellow }} /> Familles sans fréquentation ce trimestre (report à recouvrer)
                </h3>
                <p className="text-xs mb-3" style={{ color: C.grey }}>
                  Ces familles n'ont pas fréquenté la garderie ce trimestre mais ont un report des trimestres précédents.
                </p>
                <div className="space-y-2">
                  {recapFacturation.reports_sans_activite.map((r) => (
                    <div key={r.famille_id} className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-xl border px-3 py-2"
                      style={{ borderColor: C.line, backgroundColor: C.paper }}>
                      <span className="font-semibold">{r.parent}</span>
                      <span className="flex items-center gap-2">
                        <span>report {r.report_eur.toFixed(2).replace(".", ",")} €</span>
                        {r.facturable
                          ? <Badge color="#fff" bg={C.green}>Facturable</Badge>
                          : <Badge color={C.ink} bg={C.yellow}>En attente de seuil</Badge>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs" style={{ color: C.grey }}>
              La liste s'ajuste au trimestre sélectionné. Les forfaits sont facturés au montant trimestriel fixé dans l'administration ; les enfants à la carte n'apparaissent que s'ils ont fréquenté la garderie sur ce trimestre, avec le total des passages facturés selon leurs créneaux.
            </p>
          </div>
        )}

        {/* ---------- Statistiques ---------- */}
        {tab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Moyenne d'enfants / jour" value={moyenneJour.toFixed(1).replace(".", ",")} accent={C.ink} />
              <StatCard icon={BarChart3} label="Maximum sur la période" value={maxJour} accent={C.green} />
              <StatCard icon={ClipboardCheck} label="Enfants au forfait" value={enfants.filter((e) => estForfait(e.formule)).length} accent={C.yellow} />
              <StatCard icon={Euro} label="Non encaissé" value={`${impayes.toFixed(0)} €`} accent={C.red} />
            </div>

            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <h2 className="font-bold">Fréquentation par jour</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: C.grey }}>Du</span>
                    <input type="date" value={statDebut} max={statFin}
                      onChange={(ev) => setStatDebut(ev.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: C.grey }}>au</span>
                    <input type="date" value={statFin} min={statDebut}
                      onChange={(ev) => setStatFin(ev.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs outline-none" style={{ borderColor: C.line }} />
                  </label>
                </div>
              </div>
              <p className="text-xs mb-4" style={{ color: C.grey }}>
                Nombre d'enfants présents chaque jour sur la période choisie.
              </p>
              {freqErreur && (
                <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2 mb-3"
                  style={{ backgroundColor: "#FBEAE7", borderColor: C.red, color: C.red }}>
                  <AlertTriangle size={16} /> {freqErreur}
                </div>
              )}
              {freqChargement ? (
                <p className="text-sm py-8 text-center" style={{ color: C.grey }}>Chargement de la fréquentation…</p>
              ) : statsJours.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: C.grey }}>
                  Aucune présence enregistrée sur cette période.
                </p>
              ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={statsJours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                    <XAxis dataKey="jour" tick={{ fill: C.grey, fontSize: 11 }} axisLine={{ stroke: C.line }} tickLine={false} />
                    <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fill: C.grey, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [`${v} enfant${v > 1 ? "s" : ""}`, "Présents"]}
                      contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, fontSize: 13 }}
                    />
                    <Bar dataKey="enfants" fill={C.yellow} radius={[8, 8, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>

            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <h2 className="font-bold mb-3">Répartition des formules</h2>
              {(() => {
                const n = enfants.length || 1;
                const nForfait = enfants.filter((e) => e.formule === "forfait").length;
                const nCarte = enfants.filter((e) => e.formule === "carte").length;
                const pct = (x) => Math.round((x / n) * 100);
                const segs = [
                  { label: "Forfait", val: nForfait, color: C.yellow },
                  { label: "À la carte", val: nCarte, color: C.ink },
                ];
                return (
                  <div>
                    <div className="flex h-6 rounded-full overflow-hidden border" style={{ borderColor: C.line }}>
                      {segs.map((s) => s.val > 0 && (
                        <div key={s.label} style={{ width: `${pct(s.val)}%`, backgroundColor: s.color }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2" style={{ color: C.grey }}>
                      {segs.map((s) => (
                        <span key={s.label} className="flex items-center gap-1">
                          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                          <strong style={{ color: C.ink }}>{s.val}</strong> {s.label} ({pct(s.val)} %)
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {/* ---------- Administration ---------- */}
        {tab === "admin" && session.role === "admin" && (
          <div className="space-y-4 max-w-3xl">
            {/* Tarifs */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <h2 className="font-bold mb-1 flex items-center gap-2">
                <Settings size={17} style={{ color: C.yellow }} /> Tarifs
              </h2>
              <p className="text-xs mb-4" style={{ color: C.grey }}>
                Réservé à l'administrateur. Le forfait est exprimé en montant par trimestre. Le tarif à la carte est défini par créneau juste en dessous.
              </p>
              {erreurAdmin && (
                <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2 mb-3"
                  style={{ backgroundColor: "#FBEAE7", borderColor: C.red, color: C.red }}>
                  <AlertTriangle size={16} /> {erreurAdmin}
                </div>
              )}
              <div className="flex flex-wrap gap-6">
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Forfait trimestriel (€ / trimestre)</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="0.5" value={prixForfait}
                      onChange={(ev) => setPrixForfait(Math.max(0, parseFloat(ev.target.value) || 0))}
                      className="w-28 rounded-xl border px-3 py-2 outline-none font-semibold" style={{ borderColor: C.line }} />
                    <span style={{ color: C.grey }}>€</span>
                    <button onClick={() => enregistrerForfait(prixForfait)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: C.green + "1A", color: C.green }}>
                      <Check size={15} /> Enregistrer
                    </button>
                  </div>
                  <span className="block text-xs mt-1" style={{ color: C.grey }}>
                    Le changement s'applique à partir d'aujourd'hui ; les factures passées gardent l'ancien tarif.
                  </span>
                </label>
              </div>
            </div>

            {/* Dates des trimestres */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <h2 className="font-bold mb-1 flex items-center gap-2">
                <CalendarDays size={17} style={{ color: C.yellow }} /> Dates des trimestres
              </h2>
              <p className="text-xs mb-3" style={{ color: C.grey }}>
                Indiquez la date de <strong>fin</strong> de chaque trimestre. Le trimestre suivant commence
                le lendemain. Chaque pointage est rattaché au trimestre correspondant à sa date.
              </p>
              {trimestreMessage && (
                <p className="text-sm mb-3 font-semibold"
                  style={{ color: trimestreMessage.includes("impossible") || trimestreMessage.includes("doivent") || trimestreMessage.includes("Veuillez") ? C.red : C.green }}>
                  {trimestreMessage}
                </p>
              )}
              <div className="flex flex-wrap gap-4">
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Fin du 1er trimestre</span>
                  <input type="date" value={datesTrimestres.fin_t1}
                    onChange={(ev) => setDatesTrimestres({ ...datesTrimestres, fin_t1: ev.target.value })}
                    className="rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Fin du 2e trimestre</span>
                  <input type="date" value={datesTrimestres.fin_t2}
                    onChange={(ev) => setDatesTrimestres({ ...datesTrimestres, fin_t2: ev.target.value })}
                    className="rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Fin du 3e trimestre</span>
                  <input type="date" value={datesTrimestres.fin_t3}
                    onChange={(ev) => setDatesTrimestres({ ...datesTrimestres, fin_t3: ev.target.value })}
                    className="rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button onClick={enregistrerDatesTrimestres}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: C.green + "1A", color: C.green }}>
                  <Check size={15} /> Enregistrer les dates
                </button>
                <button onClick={lancerRecalculTrimestres} disabled={recalculEnCours}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: C.yellow, color: "#A87E12", backgroundColor: "#FDF6E3", opacity: recalculEnCours ? 0.6 : 1 }}>
                  <History size={15} /> {recalculEnCours ? "Recalcul en cours…" : "Recalculer les trimestres"}
                </button>
              </div>
              <p className="text-xs mt-3" style={{ color: C.grey }}>
                Après avoir changé les dates, lancez le recalcul pour réattribuer les pointages déjà
                enregistrés au bon trimestre. Faites une sauvegarde au préalable. Le recalcul ne modifie
                ni les montants ni les heures, seulement le trimestre de rattachement.
              </p>
            </div>

            {/* Créneaux horaires (à la carte) */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold flex items-center gap-2">
                  <Clock size={17} style={{ color: C.yellow }} /> Créneaux horaires (à la carte)
                </h2>
                {!formCreneau && (
                  <button onClick={() => setFormCreneau(creneauVide)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: C.ink, color: "#fff" }}>
                    <Plus size={15} /> Nouveau créneau
                  </button>
                )}
              </div>
              <p className="text-xs mb-4" style={{ color: C.grey }}>
                Chaque créneau est facturé au forfait (montant fixe dès l'entrée) ou à l'heure (toute heure commencée est due). Si un enfant traverse plusieurs créneaux, seul le temps réellement passé dans chacun est facturé, selon son mode.
              </p>

              {formCreneau && (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: C.yellow, backgroundColor: C.paper }}>
                  <h3 className="font-bold text-sm mb-3">{formCreneau.id ? "Modifier le créneau" : "Nouveau créneau"}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm sm:col-span-2">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>Nom du créneau</span>
                      <input value={formCreneau.nom}
                        onChange={(ev) => setFormCreneau({ ...formCreneau, nom: ev.target.value })}
                        placeholder="Ex. : Accueil du matin"
                        className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>Début</span>
                      <input type="time" value={formCreneau.debut}
                        onChange={(ev) => setFormCreneau({ ...formCreneau, debut: ev.target.value })}
                        className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>Fin</span>
                      <input type="time" value={formCreneau.fin}
                        onChange={(ev) => setFormCreneau({ ...formCreneau, fin: ev.target.value })}
                        className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>Mode de facturation</span>
                      <select value={formCreneau.mode}
                        onChange={(ev) => setFormCreneau({ ...formCreneau, mode: ev.target.value })}
                        className="w-full rounded-xl border px-3 py-2 outline-none bg-white" style={{ borderColor: C.line }}>
                        <option value="forfait">Au forfait (montant fixe)</option>
                        <option value="heure">À l'heure (tarif horaire)</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>
                        {formCreneau.mode === "forfait" ? "Montant du forfait (€)" : "Tarif horaire (€ / h)"}
                      </span>
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" step="0.1" value={formCreneau.montant}
                          onChange={(ev) => setFormCreneau({ ...formCreneau, montant: ev.target.value })}
                          className="w-full rounded-xl border px-3 py-2 outline-none font-semibold" style={{ borderColor: C.line }} />
                        <span style={{ color: C.grey }}>{formCreneau.mode === "forfait" ? "€" : "€/h"}</span>
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={sauverCreneau}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: C.green, color: "#fff" }}>
                      <Check size={15} /> Enregistrer
                    </button>
                    <button onClick={() => setFormCreneau(null)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: C.line, color: C.ink }}>
                      <X size={15} /> Annuler
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.line }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase" style={{ color: C.grey }}>
                      <th className="p-3">Créneau</th>
                      <th className="p-3">Horaires</th>
                      <th className="p-3">Facturation</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creneaux.slice().sort((a, b) => enMinutes(a.debut) - enMinutes(b.debut)).map((c) => (
                      <tr key={c.id} className="border-t" style={{ borderColor: C.line }}>
                        <td className="p-3 font-medium">{c.nom}</td>
                        <td className="p-3">{c.debut} – {c.fin}</td>
                        <td className="p-3">
                          {c.mode === "forfait"
                            ? <Badge color={C.ink} bg={C.yellow + "55"}>Forfait {c.montant.toFixed(2).replace(".", ",")} €</Badge>
                            : <Badge color={C.ink} bg={C.line}>{c.montant.toFixed(2).replace(".", ",")} €/h</Badge>}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button title="Modifier"
                              onClick={() => setFormCreneau({ ...c, montant: c.montant })}
                              className="p-2 rounded-lg" style={{ color: C.ink, backgroundColor: C.paper }}>
                              <Pencil size={15} />
                            </button>
                            <button title="Supprimer"
                              onClick={() => demanderSuppression(
                                `Supprimer le créneau « ${c.nom} » ? Les passages déjà facturés ne seront pas modifiés.`,
                                () => supprimerCreneau(c.id)
                              )}
                              className="p-2 rounded-lg" style={{ color: C.red, backgroundColor: C.red + "15" }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {creneaux.length === 0 && (
                      <tr><td className="p-4 text-sm" colSpan={4} style={{ color: C.grey }}>
                        Aucun créneau défini. Ajoutez-en un pour permettre la facturation à la carte.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Coordonnées de facturation */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <h2 className="font-bold mb-1 flex items-center gap-2">
                <FileDown size={17} style={{ color: C.yellow }} /> Coordonnées de facturation
              </h2>
              <p className="text-xs mb-4" style={{ color: C.grey }}>
                Ces informations identifient l'organisme émetteur et apparaissent en en-tête de chaque facture exportée.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Nom de l'organisme</span>
                  <input value={coordFacturation.organisme}
                    onChange={(ev) => setCoordFacturation({ ...coordFacturation, organisme: ev.target.value })}
                    className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Adresse</span>
                  <textarea value={coordFacturation.adresse} rows={2}
                    onChange={(ev) => setCoordFacturation({ ...coordFacturation, adresse: ev.target.value })}
                    className="w-full rounded-xl border px-3 py-2 outline-none resize-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Téléphone</span>
                  <input value={coordFacturation.telephone}
                    onChange={(ev) => setCoordFacturation({ ...coordFacturation, telephone: ev.target.value })}
                    className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>E-mail</span>
                  <input type="email" value={coordFacturation.email}
                    onChange={(ev) => setCoordFacturation({ ...coordFacturation, email: ev.target.value })}
                    className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>SIRET</span>
                  <input value={coordFacturation.siret}
                    onChange={(ev) => setCoordFacturation({ ...coordFacturation, siret: ev.target.value })}
                    placeholder="Optionnel"
                    className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>IBAN</span>
                  <input value={coordFacturation.iban}
                    onChange={(ev) => setCoordFacturation({ ...coordFacturation, iban: ev.target.value })}
                    placeholder="Optionnel"
                    className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="block text-xs mb-1" style={{ color: C.grey }}>Mentions légales / bas de facture</span>
                  <textarea value={coordFacturation.mentions} rows={2}
                    onChange={(ev) => setCoordFacturation({ ...coordFacturation, mentions: ev.target.value })}
                    placeholder="Ex. : Association loi 1901 — TVA non applicable, art. 293 B du CGI."
                    className="w-full rounded-xl border px-3 py-2 outline-none resize-none" style={{ borderColor: C.line }} />
                </label>
              </div>
              <p className="text-xs mt-3" style={{ color: C.grey }}>
                Les champs SIRET et IBAN sont facultatifs et ne s'affichent sur la facture que s'ils sont renseignés.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button onClick={enregistrerCoordonnees}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: C.ink, color: "#fff" }}>
                  <Check size={16} /> Enregistrer les coordonnées
                </button>
                {coordEnregistrees && (
                  <span className="text-sm font-semibold flex items-center gap-1" style={{ color: C.green }}>
                    <Check size={15} /> Enregistré
                  </span>
                )}
              </div>
            </div>

            {/* Logo de l'organisme */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <h2 className="font-bold flex items-center gap-2 mb-3">
                <Settings size={17} style={{ color: C.yellow }} /> Logo de l'organisme
              </h2>
              <p className="text-xs mb-3" style={{ color: C.grey }}>
                Le logo apparaît en haut de l'application et sur les factures et bordereaux imprimés.
                Formats acceptés : PNG, JPG, GIF, WEBP, SVG. Taille maximale : 350 Ko.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                {logo ? (
                  <img src={logo} alt="Logo" style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain" }}
                    className="rounded-lg border p-1" />
                ) : (
                  <div className="rounded-lg border px-4 py-3 text-xs" style={{ borderColor: C.line, color: C.grey }}>
                    Aucun logo pour l'instant
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ backgroundColor: C.ink, color: "#fff" }}>
                  <Plus size={16} /> Choisir une image
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(ev) => televerserLogo(ev.target.files?.[0])} />
                </label>
                {logo && (
                  <button onClick={retirerLogo}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: C.red + "15", color: C.red }}>
                    <Trash2 size={15} /> Retirer
                  </button>
                )}
              </div>
              {logoMessage && (
                <p className="text-sm mt-3 font-semibold"
                  style={{ color: logoMessage.includes("enregistré") || logoMessage.includes("retiré") ? C.green : C.red }}>
                  {logoMessage}
                </p>
              )}
            </div>

            {/* Correction des pointages */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <h2 className="font-bold flex items-center gap-2">
                  <Clock size={17} style={{ color: C.yellow }} /> Correction des pointages
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: C.grey }}>Du</span>
                    <input type="date" value={corrDebut} max={corrFin}
                      onChange={(ev) => setCorrDebut(ev.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: C.grey }}>au</span>
                    <input type="date" value={corrFin} min={corrDebut}
                      onChange={(ev) => setCorrFin(ev.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs outline-none" style={{ borderColor: C.line }} />
                  </label>
                  <button onClick={chargerCorrections}
                    className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: C.ink, color: "#fff" }}>
                    Afficher
                  </button>
                </div>
              </div>
              <p className="text-xs mb-3" style={{ color: C.grey }}>
                Corrigez les heures, clôturez une présence oubliée ou supprimez un pointage erroné.
                La facturation est recalculée automatiquement à chaque correction.
              </p>

              {/* Bouton + formulaire d'ajout manuel */}
              {!ajoutOuvert ? (
                <button onClick={() => { setAjoutOuvert(true); setCorrMessage(""); }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold mb-3"
                  style={{ backgroundColor: C.green, color: "#fff" }}>
                  <Plus size={15} /> Ajouter un pointage manuellement
                </button>
              ) : (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: C.green, backgroundColor: C.paper }}>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Plus size={15} style={{ color: C.green }} /> Nouveau pointage
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="block mb-1" style={{ color: C.grey }}>Enfant</span>
                      <select value={ajoutEnfant} onChange={(ev) => setAjoutEnfant(ev.target.value)}
                        className="w-full rounded-lg border px-2 py-2 text-sm outline-none" style={{ borderColor: C.line }}>
                        <option value="">— Choisir un enfant —</option>
                        {[...enfants].sort((a, b) => (a.nom || "").localeCompare(b.nom || "")).map((e) => (
                          <option key={e.id} value={e.id}>{e.nom}{e.classe ? ` (${e.classe})` : ""}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="block mb-1" style={{ color: C.grey }}>Date</span>
                      <input type="date" value={ajoutJour} max={corrFin}
                        onChange={(ev) => setAjoutJour(ev.target.value)}
                        className="w-full rounded-lg border px-2 py-2 text-sm outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block mb-1" style={{ color: C.grey }}>Heure d'arrivée</span>
                      <input type="time" value={ajoutArrivee}
                        onChange={(ev) => setAjoutArrivee(ev.target.value)}
                        className="w-full rounded-lg border px-2 py-2 text-sm outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block mb-1" style={{ color: C.grey }}>Heure de départ</span>
                      <input type="time" value={ajoutDepart}
                        onChange={(ev) => setAjoutDepart(ev.target.value)}
                        className="w-full rounded-lg border px-2 py-2 text-sm outline-none" style={{ borderColor: C.line }} />
                    </label>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={ajouterPointageManuel}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: C.green, color: "#fff" }}>
                      <Check size={14} /> Ajouter
                    </button>
                    <button onClick={() => { setAjoutOuvert(false); setAjoutEnfant(""); setAjoutArrivee(""); setAjoutDepart(""); }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: C.line, color: C.ink }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {corrMessage && (
                <p className="text-sm mb-3 font-semibold"
                  style={{ color: corrMessage.includes("impossible") || corrMessage.includes("Impossible") ? C.red : C.green }}>
                  {corrMessage}
                </p>
              )}
              {corrErreur && (
                <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2 mb-3"
                  style={{ backgroundColor: "#FBEAE7", borderColor: C.red, color: C.red }}>
                  <AlertTriangle size={16} /> {corrErreur}
                </div>
              )}

              {corrChargement ? (
                <p className="text-sm py-4 text-center" style={{ color: C.grey }}>Chargement…</p>
              ) : corrections.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: C.grey }}>
                  Cliquez sur « Afficher » pour lister les pointages de la période, ou aucun pointage sur cette période.
                </p>
              ) : (
                <div className="space-y-2">
                  {corrections.map((p) => (
                    <div key={p.id} className="rounded-xl border p-3"
                      style={{ borderColor: p.non_cloture ? C.red : C.line, backgroundColor: C.paper }}>
                      {corrEnEdition === p.id ? (
                        // Mode édition
                        <div className="space-y-2">
                          <div className="font-semibold text-sm">{p.enfant} <span className="font-normal" style={{ color: C.grey }}>· {fmtDateFr(p.jour)}</span></div>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-1 text-sm">
                              <span style={{ color: C.grey }}>Arrivée</span>
                              <input type="time" value={corrArrivee}
                                onChange={(ev) => setCorrArrivee(ev.target.value)}
                                className="rounded-lg border px-2 py-1 text-sm outline-none" style={{ borderColor: C.line }} />
                            </label>
                            <label className="flex items-center gap-1 text-sm">
                              <span style={{ color: C.grey }}>Départ</span>
                              <input type="time" value={corrDepart}
                                onChange={(ev) => setCorrDepart(ev.target.value)}
                                className="rounded-lg border px-2 py-1 text-sm outline-none" style={{ borderColor: C.line }} />
                            </label>
                            <span className="text-xs" style={{ color: C.grey }}>(départ vide = présence ouverte)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => enregistrerCorrection(p.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: C.green, color: "#fff" }}>
                              <Check size={14} /> Enregistrer
                            </button>
                            <button onClick={annulerEditionPointage}
                              className="px-3 py-1.5 rounded-lg text-sm font-semibold border" style={{ borderColor: C.line, color: C.ink }}>
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Mode affichage
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-semibold">{p.enfant}</span>
                            <span style={{ color: C.grey }}> · {fmtDateFr(p.jour)} · </span>
                            <span>{p.heure_arrivee}</span>
                            <span style={{ color: C.grey }}> → </span>
                            {p.heure_depart
                              ? <span>{p.heure_depart}</span>
                              : <span className="font-semibold" style={{ color: C.red }}>présence non clôturée</span>}
                            {p.total_eur > 0 && (
                              <span style={{ color: C.grey }}> · {p.total_eur.toFixed(2).replace(".", ",")} €</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {p.non_cloture && (
                              <button onClick={() => cloturerPresence(p)}
                                className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: C.green + "18", color: C.green }}>
                                Clôturer
                              </button>
                            )}
                            <button onClick={() => ouvrirEditionPointage(p)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold border" style={{ borderColor: C.line, color: C.ink }}>
                              Modifier
                            </button>
                            <button onClick={() => supprimerPointageCorr(p)}
                              className="p-1.5 rounded-lg" style={{ backgroundColor: C.red + "15", color: C.red }}
                              title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comptes utilisateurs */}
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold flex items-center gap-2">
                  <Users size={17} style={{ color: C.yellow }} /> Comptes utilisateurs
                </h2>
                {!formUser && (
                  <button onClick={() => setFormUser(userVide)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: C.ink, color: "#fff" }}>
                    <Plus size={15} /> Nouveau compte
                  </button>
                )}
              </div>

              {formUser && (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: C.yellow, backgroundColor: C.paper }}>
                  <h3 className="font-bold text-sm mb-3">{formUser.id ? "Modifier le compte" : "Nouveau compte"}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>Nom complet</span>
                      <input value={formUser.nom}
                        onChange={(ev) => setFormUser({ ...formUser, nom: ev.target.value })}
                        className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>
                        Identifiant{formUser.id === session.id && " (non modifiable pour votre compte)"}
                      </span>
                      <input value={formUser.identifiant}
                        onChange={(ev) => setFormUser({ ...formUser, identifiant: ev.target.value })}
                        disabled={formUser.id === session.id}
                        className="w-full rounded-xl border px-3 py-2 outline-none disabled:opacity-50" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>E-mail</span>
                      <input type="email" value={formUser.email}
                        onChange={(ev) => setFormUser({ ...formUser, email: ev.target.value })}
                        className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>
                        Mot de passe{formUser.id && " (laisser vide pour conserver)"}
                      </span>
                      <input type="password" value={formUser.mdp}
                        onChange={(ev) => setFormUser({ ...formUser, mdp: ev.target.value })}
                        placeholder={formUser.id ? "•••••••• (inchangé)" : ""}
                        className="w-full rounded-xl border px-3 py-2 outline-none" style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: C.grey }}>Rôle</span>
                      <select value={formUser.role}
                        onChange={(ev) => setFormUser({ ...formUser, role: ev.target.value })}
                        className="w-full rounded-xl border px-3 py-2 outline-none bg-white" style={{ borderColor: C.line }}>
                        <option value="membre">Membre de l'équipe</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </label>
                  </div>
                  {users.some((x) => x.identifiant.toLowerCase() === formUser.identifiant.trim().toLowerCase() && x.id !== formUser.id) && (
                    <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}>
                      <AlertTriangle size={13} /> Cet identifiant est déjà utilisé.
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button onClick={sauverUser}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: C.green, color: "#fff" }}>
                      <Check size={15} /> Enregistrer
                    </button>
                    <button onClick={() => setFormUser(null)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: C.line, color: C.ink }}>
                      <X size={15} /> Annuler
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.line }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase" style={{ color: C.grey }}>
                      <th className="p-3">Nom</th>
                      <th className="p-3">Identifiant</th>
                      <th className="p-3">E-mail</th>
                      <th className="p-3">Rôle</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t" style={{ borderColor: C.line }}>
                        <td className="p-3 font-medium">
                          {u.nom}
                          {session.id === u.id && <span className="ml-1 text-xs" style={{ color: C.grey }}>(vous)</span>}
                          {u.actif === 0 && <span className="ml-2"><Badge color={C.red} bg={C.red + "15"}>Désactivé</Badge></span>}
                        </td>
                        <td className="p-3">{u.identifiant}</td>
                        <td className="p-3" style={{ color: C.grey }}>{u.email}</td>
                        <td className="p-3">
                          {u.role === "admin"
                            ? <Badge color={C.ink} bg={C.yellow + "55"}>Administrateur</Badge>
                            : <Badge color={C.ink} bg={C.line}>Membre</Badge>}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button title="Modifier"
                              onClick={() => setFormUser({ id: u.id, nom: u.nom, identifiant: u.identifiant, email: u.email, mdp: "", role: u.role })}
                              className="p-2 rounded-lg" style={{ color: C.ink, backgroundColor: C.paper }}>
                              <Pencil size={15} />
                            </button>
                            <button title={u.actif === 0 ? "Réactiver ce compte" : "Désactiver ce compte"}
                              disabled={session.id === u.id}
                              onClick={() => basculerActivationUser(u.id, u.actif === 0)}
                              className="p-2 rounded-lg disabled:opacity-30"
                              style={{ color: u.actif === 0 ? C.green : "#A87E12", backgroundColor: (u.actif === 0 ? C.green : C.yellow) + "15" }}>
                              {u.actif === 0 ? <LogIn size={15} /> : <LogOut size={15} />}
                            </button>
                            <button title={session.id === u.id ? "Impossible de supprimer votre propre compte" : "Supprimer"}
                              disabled={session.id === u.id}
                              onClick={() => demanderSuppression(
                                `Supprimer le compte de ${u.nom} ? Cette personne n'aura plus accès à l'application.`,
                                () => supprimerUser(u.id)
                              )}
                              className="p-2 rounded-lg disabled:opacity-30"
                              style={{ color: C.red, backgroundColor: C.red + "15" }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {erreurUsers && (
                <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2 mt-3"
                  style={{ backgroundColor: "#FBEAE7", borderColor: C.red, color: C.red }}>
                  <AlertTriangle size={16} /> {erreurUsers}
                </div>
              )}
              <p className="text-xs mt-3" style={{ color: C.grey }}>
                Vous ne pouvez pas supprimer ni désactiver votre propre compte, ni retirer le dernier administrateur. Les mots de passe sont chiffrés et ne sont jamais affichés. À la modification, laissez le champ mot de passe vide pour le conserver.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* ---------- Confirmation de suppression ---------- */}
      {confirmation && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(34, 48, 74, 0.45)", zIndex: 50 }}>
          <div className="rounded-2xl p-5 w-full max-w-sm shadow-xl" style={{ backgroundColor: C.card }}>
            <h2 className="font-bold mb-2 flex items-center gap-2" style={{ color: C.ink }}>
              <Trash2 size={18} style={{ color: C.red }} /> Confirmer la suppression
            </h2>
            <p className="text-sm mb-5" style={{ color: C.ink }}>{confirmation.message}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmation(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: C.line, color: C.ink }}>
                Annuler
              </button>
              <button onClick={() => { confirmation.action(); setConfirmation(null); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: C.red, color: "#fff" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
