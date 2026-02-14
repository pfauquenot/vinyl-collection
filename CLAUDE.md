# Ma Collection Vinyles

Application web de gestion de collection de disques vinyles. Permet de cataloguer, noter, filtrer et rechercher ses vinyles, avec récupération automatique des pochettes via l'API Deezer.

## Stack technique

| Élément         | Technologie                                              |
| --------------- | -------------------------------------------------------- |
| Langage         | HTML5, CSS3, JavaScript (vanilla ES2020+)                |
| Framework       | Aucun (zéro dépendance, zéro `node_modules`)             |
| Base de données | `localStorage` du navigateur (persistance côté client)   |
| API externe     | Deezer (JSONP, sans clé d'API, sans CORS)                |
| Police          | Google Fonts — Inter (300, 400, 500, 600, 700)           |
| Hébergement     | Firebase Hosting (fichiers statiques)                    |

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

## Structure du projet

```
vinyl-collection/
├── index.html   # Page unique — structure HTML, formulaire modal, filtres, tableau, galerie
├── app.js       # Logique complète — CRUD, rendu, filtres, tri, import/export, recherche pochettes
├── style.css    # Styles — variables CSS, responsive mobile/desktop, animations
└── CLAUDE.md    # Ce fichier
```

Trois fichiers, zéro dossier imbriqué. Toute l'application tient dans ces fichiers.

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
- Architecture data-driven : le tableau `vinyls` est la source de vérité, `render()` rafraîchit l'affichage
- IDs des enregistrements : `crypto.randomUUID()`
- Échappement HTML : via la fonction utilitaire `esc()` (crée un `div` temporaire avec `textContent`)
- Pas de classes, pas de modules ES — tout est dans le scope global de `app.js`

### CSS

- **Variables CSS** (custom properties) définies dans `:root` pour les couleurs et rayons
- Couleur d'accent : `--accent: #c4792a` (brun/orangé)
- Nommage des classes : `kebab-case` (ex : `gallery-card`, `btn-primary`, `cover-result-item`)
- Préfixe par contexte : `gallery-`, `cover-`, `form-`, `btn-`, `cell-`, `col-`, `badge-`, `tag-`
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
  categorie: ["Jazz", "Pop / Rock"],   // tableau de strings
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
  acheté: "Discogs",
  commentaire: "Texte libre",
  coverUrl: "https://..."
}
```

Les valeurs numériques (`goût`, `audio`, `energie`, `nb`, `prix`) sont stockées en tant que **strings**, pas en tant que numbers.
