# suivi-consommation-app

Application web de suivi du niveau de mazout, des livraisons et de la consommation.

## Fonctionnement
- Le solde de la citerne est calculé à partir du dernier relevé en cm, converti avec le facteur défini (16 L/cm par défaut).
- Un relevé calcule la consommation entre l'entrée précédente et ce relevé : `(relevé précédent - relevé actuel) × conversion`. La consommation journalière affichée est ensuite divisée par le nombre exact de jours écoulés.
- La première mesure affiche `0 L/j`.
- Une livraison comporte une date, une hauteur après livraison et la quantité livrée. Elle apparaît comme `Livraison` dans la colonne Consommation et devient le nouveau point de départ pour le relevé suivant. La quantité livrée n'est pas ajoutée à la consommation.
- Les totaux sont regroupés par saison de chauffe, du 1er octobre au 30 avril de l'année suivante (ex. 2025–2026). Seuls les intervalles dont les deux entrées se trouvent dans la même saison sont additionnés ; l’intervalle avril–octobre n’est pas attribué artificiellement à une saison.
- La moyenne journalière globale est calculée sur tout l'historique : somme des litres consommés divisée par la somme des jours couverts par les intervalles valides. Il n'y a pas de moyenne par saison ou par année civile.
- Le coefficient de conversion est modifiable en bas de page et les calculs sont automatiquement actualisés.
- Import/export Excel sont conservés. L'export contient les informations nécessaires pour restaurer les livraisons.
- Les données sont conservées dans le stockage local du navigateur.
