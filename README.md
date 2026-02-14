# Vinylthèque

Application web de gestion de collection de disques vinyles. Cataloguez, notez, filtrez et recherchez vos vinyles, avec récupération automatique des pochettes via l'API Deezer.

Zéro dépendance, zéro build, zéro `node_modules` — trois fichiers suffisent.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)

---

## Apercu

L'application propose deux modes d'affichage :

| Vue galerie | Vue tableau |
|:-----------:|:-----------:|
| Pochettes en grille avec artiste, album et annee | Tableau complet avec toutes les colonnes triables |

> *Ajoutez vos propres captures d'ecran dans un dossier `screenshots/` et remplacez ce bloc par des images :*
> ```md
> ![Vue galerie](screenshots/gallery.png)
> ![Vue tableau](screenshots/table.png)
> ```

---

## Fonctionnalites

### Gestion de la collection
- **Ajout / modification / suppression** de vinyles via un formulaire modal
- **Champs detailles** : artiste, album, annee, label, reference, categorie(s), commentaire
- **Notation sur 3 axes** : Gout (0-6), Qualite audio (3-10), Energie (1-6) — chacun avec des labels descriptifs
- **Suivi des ecoutes** : nombre d'ecoutes par vinyle
- **Prix et lieu d'achat** : pour suivre ses depenses et sources

### Pochettes d'albums
- **Recherche automatique** des pochettes via l'API Deezer (JSONP, sans cle d'API)
- **Recherche en lot** : un clic pour recuperer toutes les pochettes manquantes
- **Saisie manuelle d'URL** pour les pochettes introuvables
- **Selection visuelle** parmi plusieurs resultats quand la recherche est ambigue

### Affichage et navigation
- **Vue galerie** : grille de pochettes avec artiste, album et annee
- **Vue tableau** : colonnes detaillees avec tri par clic sur les en-tetes
- **Tri** sur 9 criteres : artiste, album, annee, gout, audio, energie, prix, nb ecoutes, date d'ajout
- **Ordre ascendant / descendant** d'un clic

### Filtres et recherche
- **Recherche textuelle** : filtre en temps reel sur artiste, album, label, reference, commentaire
- **Filtre par categorie** : Jazz, Pop/Rock, Afrique, Bresil, Electronique, Classique, etc.
- **Filtre par gout** : selection directe par niveau de notation
- **Filtre par energie** : de "Tres doux" a "Explosif"
- **Filtre par classement** : vinyles classes ou non

### Import / Export
- **Import CSV** : supporte virgule, point-virgule et tabulation comme separateurs, avec reconnaissance automatique des en-tetes (alias multiples)
- **Export CSV** : fichier avec BOM UTF-8 et separateur point-virgule, compatible Excel
- **Export JSON** : sauvegarde complete de la collection
- **Import JSON** : fusion intelligente (ajout des nouveaux, mise a jour des existants par ID)

### Selection et actions groupees
- **Selection multiple** via cases a cocher en vue tableau
- **Tout selectionner / deselectionner** d'un clic
- **Suppression groupee** des vinyles selectionnes

### Statistiques
- **Barre de stats** en temps reel : nombre total de vinyles, valeur totale en euros, nombre affiche apres filtrage

---

## Stack technique

| Element          | Technologie                                            |
| ---------------- | ------------------------------------------------------ |
| Langage          | HTML5, CSS3, JavaScript vanilla (ES2020+)              |
| Framework        | Aucun (zero dependance, zero `node_modules`)           |
| Base de donnees  | Cloud Firestore (persistance offline activee)          |
| Authentification | Firebase Auth (Google sign-in, roles admin/user/guest) |
| API externes     | Deezer (JSONP), Discogs (token personnel), Google Drive|
| Police           | Google Fonts — Inter (300, 400, 500, 600, 700)         |
| Hebergement      | Firebase Hosting (CI/CD via GitHub Actions)             |

---

## Installation

Aucune installation requise. Clonez le depot et c'est pret :

```bash
git clone https://github.com/pfauquenot/vinyl-collection.git
cd vinyl-collection
```

Pas de `npm install`, pas de build, pas de configuration.

---

## Lancer en local

### Option 1 — Ouverture directe

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

### Option 2 — Serveur local (recommande)

Un serveur local evite les restrictions du protocole `file://` :

```bash
# Avec npx (Node.js)
npx serve .
# → http://localhost:3000

# Avec Python
python3 -m http.server 8000
# → http://localhost:8000
```

---

## Deploiement sur Firebase Hosting

### Premiere mise en place

```bash
# 1. Installer Firebase CLI
npm install -g firebase-tools

# 2. Se connecter
firebase login

# 3. Initialiser (depuis la racine du repo)
firebase init hosting
#    Repertoire public : .  (la racine, car index.html est ici)
#    Single-page app : Non
#    Ecraser index.html : Non
```

### Deployer en production

```bash
firebase deploy
```

### Previsualiser avant de deployer

```bash
firebase hosting:channel:deploy preview
```

---

## Structure du projet

```
vinyl-collection/
├── index.html                          # Page unique — structure HTML, formulaire modal, filtres, tableau, galerie
├── app.js                              # Logique complete — CRUD, Firebase Auth, Firestore, filtres, tri, import/export
├── style.css                           # Styles — variables CSS, responsive mobile/desktop, animations
├── firebase.json                       # Configuration Firebase Hosting
├── .firebaserc                         # Projet Firebase par defaut (vinyl-pfa)
├── .github/workflows/firebase-deploy.yml  # CI/CD — deploiement automatique sur push main
├── CLAUDE.md                           # Instructions et conventions pour les agents IA
└── README.md                           # Ce fichier
```

---

## Securite — Cle API Firebase

La cle API Firebase presente dans `app.js` est **publique par design** : elle identifie le projet Firebase cote client mais ne donne pas acces aux donnees (protegees par les Security Rules Firestore et Firebase Auth).

Pour eviter tout abus, la cle doit etre **restreinte** dans la Google Cloud Console (projet `vinyl-pfa`) :

1. **Restrictions par referents HTTP** : autoriser uniquement `vinyl-pfa.web.app/*`, `vinyl-pfa.firebaseapp.com/*` et `localhost/*`
2. **Restrictions par API** : autoriser uniquement Cloud Firestore API, Identity Toolkit API, Token Service API et Google Drive API

---

## Donnees

Les vinyles sont stockes dans **Cloud Firestore** (base de donnees Firebase), avec persistance offline activee. Chaque utilisateur dispose de sa propre collection, isolee par Firebase Auth. Les preferences d'interface (filtres, vue) sont stockees dans le `localStorage` du navigateur.

Pour sauvegarder ou transferer votre collection, utilisez les boutons **Export JSON** / **Import JSON**.

Structure d'un enregistrement :

```javascript
{
  id: "uuid",
  dateAjout: "2024-01-15T10:30:00.000Z",
  categorie: ["Jazz", "Pop / Rock"],
  classe: "Oui",
  artiste: "Miles Davis",
  album: "Kind of Blue",
  annee: "1959",
  label: "Columbia",
  reference: "CS 8163",
  gout: "6",        // 0 (Deteste) a 6 (Vibre)
  audio: "9",       // 3 (Moyen) a 10 (Exceptionnel)
  energie: "2",     // 1 (Tres doux) a 6 (Explosif)
  nb: "42",
  prix: "35.00",
  achete: "Discogs",
  commentaire: "Pressage original mono",
  coverUrl: "https://..."
}
```

---

## Licence

Projet personnel. Tous droits reserves.
