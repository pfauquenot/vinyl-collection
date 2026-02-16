# Vinylthèque

Application web de gestion de collection de disques vinyles. Permet de cataloguer, noter, filtrer et rechercher ses vinyles, avec récupération automatique des pochettes via l'API Deezer.

## Stack technique

| Élément         | Technologie                                              |
| --------------- | -------------------------------------------------------- |
| Langage         | HTML5, CSS3, JavaScript (vanilla ES2020+)                |
| Framework       | Aucun (zéro dépendance, zéro `node_modules`)             |
| Base de données | Cloud Firestore (persistance offline activée)            |
| Authentification| Firebase Auth (Google sign-in, rôles admin/user/guest)   |
| API externes    | Deezer (JSONP), Discogs (token personnel), Google Drive  |
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
├── firebase.json                       # Configuration Firebase Hosting + Firestore
├── firestore.rules                     # Règles de sécurité Firestore (users, vinyls, snapshots)
├── .firebaserc                         # Projet Firebase par défaut (vinyl-pfa)
├── .github/workflows/firebase-deploy.yml  # CI/CD — déploiement automatique sur push main
├── CLAUDE.md                           # Ce fichier — conventions et instructions pour agents IA
└── README.md                           # Documentation utilisateur
```

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
- Couleur d'accent : `--accent: #c4792a` (brun/orangé)
- Nommage des classes : `kebab-case` (ex : `gallery-card`, `btn-primary`, `cover-result-item`)
- Préfixe par contexte : `gallery-`, `g-` (raccourci galerie), `cover-`, `form-`, `btn-`, `cell-`, `col-`, `badge-`, `tag-`
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
  goût: "0" à "6",                     // string numérique
  audio: "3" à "10",                   // string numérique
  energie: "1" à "6",                  // string numérique
  nb: "12",                            // nombre d'écoutes, string
  prix: "29.99",                       // string
  acheté: "Discogs",                   // affiché "Acheté ou" dans l'UI
  lieu: "PFA",                         // "PFA" | "En livraison" | "A acheter" | "A vendre" | "Vendu" | ""
  avisIA: "Texte libre",              // avis généré par IA
  commentaire: "Texte libre",
  coverUrl: "https://..."             // affiché "URL cover" dans le CSV
}
```

Les valeurs numériques (`goût`, `audio`, `energie`, `nb`, `prix`) sont stockées en tant que **strings**, pas en tant que numbers.
