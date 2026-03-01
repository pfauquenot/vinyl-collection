# Vinylthèque

Application web de gestion de collection de disques vinyles. Permet de cataloguer, noter, filtrer et rechercher ses vinyles, avec récupération automatique des pochettes via l'API Deezer, recherche Discogs, analyse IA (Anthropic) et sauvegarde Google Drive.

## Stack technique

| Élément         | Technologie                                              |
| --------------- | -------------------------------------------------------- |
| Langage         | HTML5, CSS3, JavaScript (vanilla ES2020+)                |
| Framework       | Aucun (zéro dépendance, zéro `node_modules`)             |
| Base de données | Cloud Firestore (persistance offline activée)            |
| Authentification| Firebase Auth (Google sign-in, rôles admin/user/guest)   |
| API externes    | Deezer (JSONP), Discogs (token personnel), Anthropic (Claude), Google Drive |
| Police          | Google Fonts — Inter (300, 400, 500, 600, 700)           |
| Hébergement     | Firebase Hosting (CI/CD via GitHub Actions)               |
| Projet Firebase | `vinyl-pfa`                                              |

## Lancer le projet en local

Aucun build, aucune installation requise. Le projet fonctionne en ouvrant directement le fichier HTML :

```bash
# Option 1 — Ouverture directe dans le navigateur
open index.html            # macOS
xdg-open index.html        # Linux
start index.html           # Windows

# Option 2 — Serveur local (recommandé pour éviter certaines restrictions file://)
npx serve .                # Port 3000 par défaut
# ou
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déploiement sur Firebase Hosting

### Première mise en place

```bash
# 1. Installer Firebase CLI
npm install -g firebase-tools

# 2. Se connecter à Firebase
firebase login

# 3. Initialiser le projet Firebase (depuis la racine du repo)
firebase init hosting
#    - Répertoire public : . (point = racine, car index.html est à la racine)
#    - Single-page app : Non
#    - Écraser index.html : Non
```

### Déployer

```bash
firebase deploy
```

### Prévisualiser avant de déployer

```bash
firebase hosting:channel:deploy preview
```

## Sécurité — Clé API Firebase

La clé API Firebase (`AIzaSy...`) présente dans `app.js` est **publique par design** : elle identifie le projet Firebase côté client mais ne donne pas accès aux données (protégées par les Security Rules Firestore et Firebase Auth).

Pour éviter tout abus, la clé doit être **restreinte** dans la [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=vinyl-pfa) :

1. **Restrictions par référents HTTP** : autoriser uniquement `vinyl-pfa.web.app/*`, `vinyl-pfa.firebaseapp.com/*` et `localhost/*`
2. **Restrictions par API** : autoriser uniquement Cloud Firestore API, Identity Toolkit API, Token Service API et Google Drive API

## Structure du projet

```
vinyl-collection/
├── index.html                          # Page unique — structure HTML, formulaire modal, filtres, tableau, galerie
├── app.js                              # Logique complète — CRUD, rendu, filtres, tri, import/export, Firebase Auth, Firestore
├── style.css                           # Styles — variables CSS, responsive mobile/desktop, animations
├── firebase.json                       # Configuration Firebase Hosting
├── .firebaserc                         # Projet Firebase par défaut (vinyl-pfa)
├── .github/workflows/firebase-deploy.yml  # CI/CD — déploiement automatique sur push main
├── CLAUDE.md                           # Ce fichier — conventions et instructions pour agents IA
└── README.md                           # Documentation utilisateur
```

## Fonctionnalités principales

### Analyse IA (Anthropic API)

- Bouton « Analyse IA » dans le formulaire de détail d'un vinyle
- Appel à l'API Anthropic (`claude-sonnet-4-20250514`) avec un system prompt de critique musical expert
- Résultat affiché en markdown dans la fiche, stocké dans le champ `avisIA`
- La clé API est stockée dans Firestore (`config/anthropic`), configurable par l'admin via le menu ☰ > Clé API Anthropic
- Lecture de la clé au login via `loadAnthropicApiKey()`, mise en cache dans `cachedAnthropicApiKey`

### Recherche Discogs

- Recherche par artiste + album avec fallback sans année/label/référence
- Recherche en lot (`bulkSearchDiscogs`) : récupère genre, pochette et lien Discogs pour toute la collection
- Token personnel stocké dans Firestore (champ `discogsToken` dans le document utilisateur)
- Gestion du rate limiting (429) et validation du token

### Sauvegarde et restauration

- **Snapshots Firestore** : sous-collection par utilisateur, limite de 100 snapshots, types `auto` et `manual`
- **Google Drive** : upload/download de fichiers JSON, dossier dédié « Vinylthèque Backup », max 30 fichiers
- **Scheduling** : fréquence configurable (`manual`, `daily`, `weekly`), vérification toutes les 30 minutes
- Persistance des réglages dans Firestore (`backupSettings` dans le document utilisateur)
- Restauration depuis n'importe quel snapshot ou fichier Drive

### Gestion des genres/styles

- Modale dédiée accessible via le menu ☰ > Gestion des genres
- Affichage de tous les genres avec comptage d'albums
- Filtrage, suppression et fusion de genres
- Migration automatique de l'ancien champ `styles` vers `genre` (`migrateStylesToGenre`)

### Rôles et permissions

| Rôle    | Accès                                                    |
| ------- | -------------------------------------------------------- |
| `admin` | Toutes les fonctions + gestion utilisateurs, clé API, vider la base |
| `user`  | CRUD complet, export/import, backup, gestion genres      |
| `guest` | Lecture seule, navigation et filtres uniquement           |

- Admin par défaut : `pfauquenot@infortive.com` (constante `ADMIN_EMAIL`)
- Rôles stockés dans Firestore (collection `users`, champ `role`)
- UI adaptée via `applyRoleUI()` : classes `.admin-only` et `.guest-hidden`
- Badge de rôle affiché dans le header

### Fonctionnalités admin (menu ☰)

- **Utilisateurs** : voir tous les utilisateurs, changer leurs rôles
- **Clé API Anthropic** : configurer la clé partagée pour l'analyse IA
- **Vider la base** : suppression complète avec double confirmation

### Raccourcis clavier

- **Escape** : ferme la modale active (fiche, genres, admin, API key, backup, token)

## Collections Firestore

| Collection / Document      | Contenu                                           |
| -------------------------- | ------------------------------------------------- |
| `vinyls/{id}`              | Données d'un vinyle (voir structure ci-dessous)   |
| `users/{uid}`              | Profil utilisateur : rôle, discogsToken, backupSettings |
| `users/{uid}/snapshots/{id}` | Snapshots de sauvegarde (type, timestamp, données) |
| `config/anthropic`         | Clé API Anthropic partagée (`apiKey`)              |

## Conventions de code

### Langue

- Interface utilisateur et textes : **français** exclusivement
- Noms de variables et clés d'objets : **français** (ex : `artiste`, `goût`, `année`, `classé`, `référence`, `acheté`)
- Commentaires dans le code : **français** ou **anglais** court accepté

### JavaScript

- **Vanilla JS uniquement** — pas de framework, pas de librairie externe
- Variables : `camelCase` (ex : `editingId`, `currentSort`, `sortAsc`, `selectedIds`)
- Constantes globales : `UPPER_SNAKE_CASE` (ex : `GOUT_LABELS`, `AUDIO_LABELS`, `ENERGIE_LABELS`)
- Fonctions : `camelCase` descriptif (ex : `loadVinyls`, `saveVinyls`, `getFilteredAndSorted`, `openEdit`)
- Identifiants DOM : `camelCase` (ex : `searchInput`, `vinylBody`, `coverSearchBtn`)
- Architecture data-driven : le tableau `vinyls` (chargé depuis Firestore) est la source de vérité, `render()` rafraîchit l'affichage
- Persistance : Firestore pour les données, `localStorage` uniquement pour les préférences UI (filtres, vue active, driveBackupEnabled)
- IDs des enregistrements : `crypto.randomUUID()`
- Échappement HTML : via la fonction utilitaire `esc()` (crée un `div` temporaire avec `textContent`)
- Pas de classes, pas de modules ES — tout est dans le scope global de `app.js`

### CSS

- **Variables CSS** (custom properties) définies dans `:root` pour les couleurs et rayons
- Palette active : **« Nuit Vinyle »** — accent `--accent: #FF6533` (orange), secondaire `--secondary: #0A505C` (bleu océan), header `--bg-header: #051740` (bleu nuit)
- Nommage des classes : `kebab-case` (ex : `gallery-card`, `btn-primary`, `cover-result-item`)
- Préfixe par contexte : `gallery-`, `cover-`, `form-`, `btn-`, `cell-`, `col-`, `badge-`, `tag-`, `admin-`, `ia-`
- Responsive : mobile-first, breakpoint principal à `768px`
- Utilitaire `.hidden` : `display: none !important`

### HTML

- Structure sémantique : `header`, `form`, `table`, `select`
- IDs en `camelCase` (ex : `vinylForm`, `galleryView`, `filterCategorie`)
- Attributs `data-*` pour le tri des colonnes (ex : `data-sort="artiste"`)
- Un seul fichier HTML, pas de templates ni de composants séparés

### Données (structure d'un vinyle)

```javascript
{
  id: "uuid",
  dateAjout: "ISO 8601",
  categorie: ["Jazz", "Pop / Rock"],   // tableau de strings — affiché "Rangement" dans l'UI
  classé: "Oui" | "Non",
  artiste: "Nom de l'artiste",
  album: "Titre de l'album",
  année: "2024",
  label: "Nom du label",
  référence: "REF-123",
  genre: ["Jazz", "Fusion"],           // tableau de strings — genres musicaux (ex-Discogs)
  goût: "0" à "6",                     // string numérique
  audio: "3" à "10",                   // string numérique
  energie: "1" à "6",                  // string numérique
  nb: "12",                            // nombre d'écoutes, string
  prix: "29.99",                       // string
  acheté: "Discogs",                   // affiché "Acheté ou" dans l'UI
  lieu: "PFA",                         // "PFA" | "En livraison" | "A acheter" | "A vendre" | "Vendu" | ""
  avisIA: "Texte libre",              // avis généré par IA (Anthropic)
  commentaire: "Texte libre",
  coverUrl: "https://...",             // affiché "URL cover" dans le CSV
  discogsUrl: "https://..."            // lien vers la page Discogs de l'album
}
```

Les valeurs numériques (`goût`, `audio`, `energie`, `nb`, `prix`) sont stockées en tant que **strings**, pas en tant que numbers.
