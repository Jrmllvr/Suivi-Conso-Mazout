# suivi-consommation-app

Version avec suivi des relevés de cuve et des livraisons.

## Fonctionnement
- Le solde de la citerne est toujours calculé à partir du dernier relevé en cm, converti avec le facteur défini (par défaut 16 L/cm).
- Un relevé normal calcule la consommation entre le relevé précédent et celui-ci :
  `(relevé précédent - relevé actuel) × conversion ÷ nombre de jours`.
- La première mesure affiche `0 L/j`.
- Une livraison comporte une date, une hauteur en cm après livraison et la quantité livrée en litres. Elle apparaît simplement comme `Livraison` dans la colonne Consommation.
- La livraison devient le nouveau point de départ pour la consommation du relevé suivant.
- Les totaux annuels additionnent les litres réellement consommés, pas les livraisons.
- La conversion reste modifiable en bas de page et recalcule automatiquement les consommations et totaux.
- Import/export Excel sont conservés. L'export contient les informations nécessaires pour restaurer les livraisons.
