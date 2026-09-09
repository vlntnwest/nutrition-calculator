-- Les roadbooks en base sortent du modèle d'avant, où l'effort en montée valait
-- 0,5 sur une échelle qui annulait la pente. Rien ne les marque périmés : on les
-- jette, `generated_at` à null renvoie chaque plan sur son bouton Calculer.
--
-- Les avertissements d'abord : les globaux portent `leg_rank` à null, aucune
-- cascade ne les emporte. `servings` et `fill` suivent les secteurs.
-- `leg_overrides` reste : les consignes posées à la main sont une entrée du
-- calcul, pas son résultat.
DELETE FROM "warnings";--> statement-breakpoint
DELETE FROM "legs";--> statement-breakpoint
UPDATE "plans" SET "generated_at" = NULL, "edited_at" = NULL;
