"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Le Roadbook porte-t-il des retouches non enregistrées ?
 *
 * Le PDF ne rend que l'état enregistré, et ses deux déclencheurs doivent donc
 * refuser de partir tant qu'il en reste. L'un vit dans le Roadbook, qui le
 * sait ; l'autre dans la barre du haut, qui est une **sœur** de la page et
 * non sa descendante, et ne peut donc pas le recevoir en propriété.
 *
 * D'où ce contexte, posé par la coquille au-dessus des deux. Il ne porte rien
 * d'autre : ce n'est pas un magasin d'état, c'est un fil entre deux points que
 * l'arbre sépare.
 */
const Contexte = createContext<{
  sale: boolean;
  declarer: (sale: boolean) => void;
}>({ sale: false, declarer: () => {} });

export function RetouchesEnCours({ children }: { children: ReactNode }) {
  const [sale, declarer] = useState(false);

  return (
    <Contexte.Provider value={{ sale, declarer }}>{children}</Contexte.Provider>
  );
}

/** Ce que lisent les déclencheurs du PDF. */
export function useRetouches(): boolean {
  return useContext(Contexte).sale;
}

/**
 * Ce qu'appelle le Roadbook à chaque changement de son état.
 *
 * Le nettoyage remet à propre en quittant l'écran : sans lui, revenir sur
 * Cibles après une retouche laisserait la barre du haut croire qu'il reste
 * quelque chose à enregistrer, alors que plus rien ne le dit.
 */
export function useDeclarerRetouches(sale: boolean): void {
  const { declarer } = useContext(Contexte);

  useEffect(() => {
    declarer(sale);

    return () => declarer(false);
  }, [sale, declarer]);
}
