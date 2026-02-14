#!/usr/bin/env bash
# ==============================================================================
# Crée les issues GitHub pour le projet vinyl-collection.
#
# Prérequis :
#   - gh (GitHub CLI) installé et authentifié : gh auth login
#   - Être dans le dépôt vinyl-collection (ou ajuster REPO ci-dessous)
#
# Usage :
#   chmod +x create-issues.sh
#   ./create-issues.sh
# ==============================================================================

set -euo pipefail

REPO="pfauquenot/vinyl-collection"

# Vérifie que gh est dispo et authentifié
if ! command -v gh &>/dev/null; then
  echo "❌ gh (GitHub CLI) non trouvé. Installez-le : https://cli.github.com"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "❌ Non authentifié. Lancez : gh auth login"
  exit 1
fi

# Crée les labels s'ils n'existent pas encore
echo "🏷  Création des labels…"
gh label create "bug"         --repo "$REPO" --color "d73a4a" --description "Quelque chose ne fonctionne pas"       2>/dev/null || true
gh label create "enhancement" --repo "$REPO" --color "a2eeef" --description "Amélioration d'une fonctionnalité"     2>/dev/null || true
gh label create "feature"     --repo "$REPO" --color "0e8a16" --description "Nouvelle fonctionnalité"               2>/dev/null || true

created=0

# ---------- 1) BUGS ----------

echo ""
echo "🐛 Création des issues « bug »…"

gh issue create --repo "$REPO" --label "bug" \
  --title "Bug tri : parseInt() ?? -1 retourne NaN au lieu de -1" \
  --body "$(cat <<'EOF'
## Description

Dans `app.js` (lignes 319-321), le tri par **Goût**, **Audio** et **Énergie** utilise :

```javascript
case 'goût': va = parseInt(a.goût) ?? -1;
```

`parseInt("")` retourne `NaN`, et `NaN ?? -1` retourne **`NaN`** car `??` ne détecte que `null`/`undefined`.
Résultat : le tri est incorrect pour les vinyles sans valeur renseignée.

## Correction proposée

Remplacer `??` par `||`, ou utiliser une vérification explicite :

```javascript
case 'goût': va = parseInt(a.goût) || -1;
```

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "bug" \
  --title "selectedIds persiste au-delà des changements de filtres" \
  --body "$(cat <<'EOF'
## Description

Quand on coche des lignes en vue tableau, puis qu'on change de filtre, les IDs restent dans `selectedIds`. Le bouton « Supprimer la sélection » peut alors supprimer des vinyles **qui ne sont plus visibles** à l'écran.

## Correction proposée

Vider `selectedIds` (et mettre à jour l'affichage du bouton) à chaque changement de filtre ou de recherche.

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "bug" \
  --title "Aucune protection contre le dépassement du localStorage (~5 Mo)" \
  --body "$(cat <<'EOF'
## Description

`localStorage` a une limite de ~5 Mo. Avec beaucoup de vinyles et des URLs de pochettes longues, on peut atteindre cette limite. L'appel `localStorage.setItem()` lève alors une exception, et les données ne sont pas sauvegardées — **sans aucun avertissement** pour l'utilisateur.

## Correction proposée

Entourer `saveVinyls()` d'un try/catch et afficher un message d'erreur clair à l'utilisateur si la sauvegarde échoue, avec une suggestion d'exporter en JSON.

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "bug" \
  --title "Import CSV : aucune détection de doublons" \
  --body "$(cat <<'EOF'
## Description

Importer deux fois le même fichier CSV crée des doublons car chaque ligne reçoit un nouvel UUID via `crypto.randomUUID()`. Contrairement à l'import JSON qui fusionne par `id`.

## Correction proposée

Détecter les doublons par combinaison `artiste + album` (ou `artiste + album + année`) et proposer à l'utilisateur de les ignorer ou de les mettre à jour.

## Difficulté
Moyen
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "bug" \
  --title "Position sticky de la barre de filtres hardcodée (top: 106px)" \
  --body "$(cat <<'EOF'
## Description

Dans `style.css` (ligne 168), la barre de filtres utilise `top: 106px` en dur. Si le header change de taille (contenu, zoom, mode mobile), la barre de filtres ne colle plus correctement sous le header.

## Correction proposée

Calculer dynamiquement la position via JavaScript (`header.offsetHeight`) ou utiliser une structure CSS qui ne dépend pas d'une valeur fixe (ex : un conteneur flex/sticky imbriqué).

## Difficulté
Facile
EOF
)" && ((created++))

# ---------- 2) ENHANCEMENTS ----------

echo ""
echo "✨ Création des issues « enhancement »…"

gh issue create --repo "$REPO" --label "enhancement" \
  --title "Ajouter un bouton « Réinitialiser les filtres »" \
  --body "$(cat <<'EOF'
## Description

Il n'y a aucun moyen de remettre tous les filtres à zéro en un clic. Quand on a filtré par catégorie + goût + énergie, il faut tout remettre manuellement.

## Proposition

Ajouter un bouton « ✕ Réinitialiser » dans la barre de filtres qui remet tous les `<select>` à leur valeur par défaut et vide la recherche.

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "enhancement" \
  --title "Indicateur visuel de la colonne triée dans le tableau" \
  --body "$(cat <<'EOF'
## Description

Les en-têtes de colonnes sont cliquables pour trier, mais rien n'indique visuellement **quelle colonne est active** ni la **direction du tri** (ascendant/descendant).

## Proposition

Ajouter une flèche (↑/↓) dans le `<th>` de la colonne actuellement triée, et éventuellement un style distinct (couleur accent, gras).

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "enhancement" \
  --title "Persister la vue active (galerie/tableau) dans localStorage" \
  --body "$(cat <<'EOF'
## Description

À chaque rechargement de page, la vue revient en galerie (valeur par défaut de `currentView`). Le choix de l'utilisateur devrait être mémorisé.

## Proposition

Sauvegarder `currentView` dans `localStorage` et le restaurer au chargement.

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "enhancement" \
  --title "Persister les filtres et le tri dans localStorage" \
  --body "$(cat <<'EOF'
## Description

Les filtres actifs et le tri sélectionné sont perdus au rechargement de la page. L'utilisateur doit reconfigurer sa vue à chaque visite.

## Proposition

Sauvegarder les valeurs des filtres (`filterCategorie`, `filterGoût`, `filterEnergie`, `filterClassé`), le tri (`currentSort`, `sortAsc`) dans `localStorage` et les restaurer au chargement.

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "enhancement" \
  --title "Ajouter loading=\"lazy\" sur les images de la galerie" \
  --body "$(cat <<'EOF'
## Description

Dans `renderGallery()`, toutes les pochettes chargent simultanément, ce qui peut être lent avec une grande collection.

## Proposition

Ajouter l'attribut `loading="lazy"` aux balises `<img>` générées dans la galerie pour un chargement progressif natif (supporté par tous les navigateurs modernes).

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "enhancement" \
  --title "Année max du formulaire hardcodée à 2030" \
  --body "$(cat <<'EOF'
## Description

Dans `index.html` (ligne 132), le champ année a `max="2030"`. Cette valeur deviendra obsolète dans quelques années.

## Proposition

Supprimer l'attribut `max` du HTML et le calculer dynamiquement en JS : `new Date().getFullYear() + 1`.

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "enhancement" \
  --title "Ajouter un debounce sur la recherche" \
  --body "$(cat <<'EOF'
## Description

Dans `app.js` (ligne 602), `searchInput` déclenche `render()` à **chaque frappe**. Avec une collection de plus de 500 vinyles, cela peut provoquer des ralentissements.

## Proposition

Ajouter un debounce de ~200 ms sur l'événement `input` du champ de recherche pour ne lancer le rendu qu'après que l'utilisateur a fini de taper.

```javascript
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(render, 200);
});
```

## Difficulté
Facile
EOF
)" && ((created++))

# ---------- 3) FEATURES ----------

echo ""
echo "🚀 Création des issues « feature »…"

gh issue create --repo "$REPO" --label "feature" \
  --title "Mode sombre (dark mode)" \
  --body "$(cat <<'EOF'
## Description

L'application n'a pas de mode sombre. Les variables CSS dans `:root` facilitent la mise en place.

## Proposition

- Ajouter un jeu de variables CSS alternatives (couleurs sombres) dans une classe `.dark` ou via `prefers-color-scheme: dark`.
- Ajouter un bouton toggle dans le header.
- Persister le choix dans `localStorage`.

## Difficulté
Moyen
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "feature" \
  --title "Tableau de bord avec statistiques visuelles" \
  --body "$(cat <<'EOF'
## Description

Il n'y a actuellement qu'une ligne de stats (nombre de vinyles, total prix, nombre affiché). Des statistiques plus riches seraient utiles.

## Proposition

Ajouter une vue « Dashboard » avec :
- Répartition par catégorie (barres ou camembert en pur CSS / `<canvas>`)
- Moyennes goût / audio / énergie
- Total dépensé par année
- Top artistes par nombre de vinyles

## Difficulté
Moyen
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "feature" \
  --title "Pagination ou scroll virtuel pour les grandes collections" \
  --body "$(cat <<'EOF'
## Description

Avec des centaines de vinyles, le DOM devient lourd (surtout en vue galerie avec toutes les images). Cela impacte les performances de rendu et de scroll.

## Proposition

- Option A : Pagination simple (50 vinyles par page) avec navigation « Précédent / Suivant ».
- Option B : Infinite scroll avec chargement progressif.
- Option C : Scroll virtuel (ne rendre que les éléments visibles).

L'option A est la plus simple et suffisante pour la plupart des cas.

## Difficulté
Moyen
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "feature" \
  --title "Raccourcis clavier pour les actions courantes" \
  --body "$(cat <<'EOF'
## Description

Toutes les actions nécessitent la souris. Des raccourcis clavier amélioreraient l'expérience.

## Proposition

- `N` : ouvrir le formulaire d'ajout
- `/` : focus sur le champ de recherche
- `Escape` : fermer le modal (déjà implémenté)
- `G` : basculer galerie/tableau
- Flèches : naviguer dans la galerie

## Difficulté
Facile
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "feature" \
  --title "Export / backup automatique périodique" \
  --body "$(cat <<'EOF'
## Description

Les données sont stockées uniquement dans `localStorage`, sans aucun mécanisme de sauvegarde. En cas de nettoyage du navigateur, tout est perdu.

## Proposition

- Afficher un rappel périodique (ex : tous les 30 jours) invitant à exporter en JSON.
- Optionnel : auto-download d'un backup JSON à intervalle configurable.
- Afficher la date du dernier export dans les stats.

## Difficulté
Moyen
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "feature" \
  --title "Vue détail lecture seule pour un vinyle" \
  --body "$(cat <<'EOF'
## Description

Actuellement, cliquer sur un vinyle ouvre directement le formulaire d'édition. Il n'y a pas de vue « lecture seule » pour consulter les détails sans risquer de modifier.

## Proposition

- Cliquer sur un vinyle ouvre une vue détail avec la pochette en grand, toutes les infos formatées, et un bouton « Modifier ».
- Le bouton « Modifier » bascule vers le formulaire d'édition existant.

## Difficulté
Moyen
EOF
)" && ((created++))

gh issue create --repo "$REPO" --label "feature" \
  --title "Filtres combinés multi-select (plusieurs catégories, plusieurs goûts)" \
  --body "$(cat <<'EOF'
## Description

Les filtres actuels ne permettent de sélectionner qu'une seule valeur par critère. Il est impossible de filtrer par « Jazz ET Brésil » ou par « Goût 5 ET 6 ».

## Proposition

Remplacer les `<select>` simples par des menus multi-select (checkboxes dans un dropdown) permettant de cocher plusieurs valeurs. Le filtre affiche les vinyles correspondant à **au moins une** des valeurs sélectionnées.

## Difficulté
Difficile
EOF
)" && ((created++))

echo ""
echo "============================================"
echo "✅ $created issues créées avec succès !"
echo "============================================"
echo ""
echo "Voir les issues : https://github.com/$REPO/issues"
