# Suivi consommation

Application web autonome de suivi d'un niveau exprimé en cm.

## Règles de calcul

- 1 cm = 16 L.
- La première mesure affiche 0 L/j.
- Pour chaque mesure suivante :
  - litres consommés = (valeur précédente - valeur actuelle) × 16
  - consommation moyenne = litres consommés / nombre de jours écoulés.
- La valeur affichée en haut correspond à la dernière mesure × 16.
- Les totaux annuels additionnent les litres consommés de chaque période dont la date de mesure finale appartient à l'année concernée.

## Fichiers

- `index.html`
- `style.css`
- `app.js`

## Données

Les mesures sont sauvegardées dans le `localStorage` du navigateur.

L'import/export Excel utilise SheetJS depuis jsDelivr. Une connexion internet est donc nécessaire pour les fonctions Excel lorsque la bibliothèque n'est pas déjà en cache.
