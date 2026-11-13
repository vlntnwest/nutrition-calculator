"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import { createOwnProduct } from "@/app/plans/actions";
import { toNumber } from "@/format/number";
import { formatFr } from "@/format/produit";
import { Button, IconButton } from "@/ui/Button";
import { ToggleChip } from "@/ui/Chip";
import { FieldLabel, Hint, MeasureField, TextField } from "@/ui/Field";
import { CloseIcon, PlusIcon } from "@/ui/icons";
import { Modal, ModalFoot } from "@/ui/Modal";
import { ErrorNote } from "@/ui/Notice";
import { Rule } from "@/ui/Panel";
import { Select } from "@/ui/Select";

const VIDE = {
  name: "",
  brandName: "",
  formatLabel: "",
  carbsG: "",
  sodiumMg: "",
  weightG: "",
  fluidMl: "",
  energyKcal: "",
  caffeineMg: "",
};

/**
 * La saisie d'un produit qui n'est pas au catalogue. Il n'existe que pour
 * cette course : personne d'autre ne le voit, et il part avec le plan.
 *
 * Le seul écran du dossier qui garde un bouton d'engagement. Une fiche à
 * moitié remplie n'est pas un produit, il n'y a rien à écrire avant la fin.
 */
export function OwnProductSheet({
  accessId,
  formats,
  onCree,
  onFermer,
}: {
  accessId: string;
  /** Les libellés que la base connaît, `gel`, `drink`. */
  formats: string[];
  /** Le produit est écrit : son code, pour le poser au sac. */
  onCree: (codeSeed: string) => void;
  onFermer: () => void;
}) {
  const titreId = useId();
  const formatId = useId();
  const [champs, setChamps] = useState(VIDE);
  const [casse, setCasse] = useState(false);
  const [melange, setMelange] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const boisson = champs.formatLabel === "drink";

  function poser(cle: keyof typeof VIDE, valeur: string) {
    setChamps((c) => ({ ...c, [cle]: valeur }));
    // Le refus portait sur l'ancienne saisie : il ne reste pas sous la neuve.
    setErreur(null);
  }

  function soumettre(event: FormEvent) {
    event.preventDefault();

    const carbsG = toNumber(champs.carbsG);
    const sodiumMg = toNumber(champs.sodiumMg);
    const weightG = toNumber(champs.weightG);
    const fluidMl = toNumber(champs.fluidMl);

    // Le serveur refait ces contrôles. Ici ils évitent un aller-retour pour
    // dire qu'un champ est resté vide.
    if (champs.name.trim() === "") {
      return setErreur("Donnez un nom au produit.");
    }
    if (champs.formatLabel === "") {
      return setErreur("Choisissez un format dans la liste.");
    }
    if (
      carbsG === undefined ||
      sodiumMg === undefined ||
      weightG === undefined
    ) {
      return setErreur(
        "Indiquez les glucides, le sodium et le poids d'une dose. 0 de sodium s'il n'y en a pas.",
      );
    }
    if (boisson && fluidMl === undefined) {
      return setErreur(
        "Indiquez le volume d'eau dans lequel la dose se prépare, en millilitres.",
      );
    }

    setErreur(null);
    start(async () => {
      const result = await createOwnProduct(accessId, {
        name: champs.name,
        brandName: champs.brandName,
        formatLabel: champs.formatLabel,
        carbsG,
        sodiumMg,
        weightG,
        fluidMl: boisson ? fluidMl : undefined,
        energyKcal: toNumber(champs.energyKcal),
        caffeineMg: toNumber(champs.caffeineMg),
        divisibleBy: casse ? 2 : 1,
        multiTransportable: melange,
      });

      if (result.ok) onCree(result.value);
      else setErreur(result.error);
    });
  }

  return (
    <Modal labelledBy={titreId} onClose={onFermer} largeur="sm:max-w-lg">
      <form onSubmit={soumettre} noValidate>
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2
              id={titreId}
              className="font-semibold text-[18px] text-ink leading-tight"
            >
              Créer un produit
            </h2>
            <p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
              Pour ce qui manque au catalogue : une préparation maison, une
              marque absente. Il ne sert qu'à cette course.
            </p>
          </div>

          <IconButton libelle="Fermer la fiche" onClick={onFermer}>
            <CloseIcon className="size-4" />
          </IconButton>
        </div>

        <Rule />

        <div className="flex flex-col gap-4 p-4">
          <TextField
            label="Nom"
            placeholder="Gâteau de riz"
            maxLength={80}
            value={champs.name}
            onChange={(event) => poser("name", event.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={formatId}>Format</FieldLabel>
              <Select
                id={formatId}
                taille="md"
                value={champs.formatLabel}
                onChange={(event) => poser("formatLabel", event.target.value)}
              >
                <option value="">Choisir</option>
                {formats.map((format) => (
                  <option key={format} value={format}>
                    {formatFr(format)}
                  </option>
                ))}
              </Select>
            </div>

            <TextField
              label="Marque, si elle en a une"
              maxLength={80}
              value={champs.brandName}
              onChange={(event) => poser("brandName", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-3 gap-3">
              <MeasureField
                label="Glucides"
                unite="g"
                value={champs.carbsG}
                onChange={(event) => poser("carbsG", event.target.value)}
              />
              <MeasureField
                label="Sodium"
                unite="mg"
                value={champs.sodiumMg}
                onChange={(event) => poser("sodiumMg", event.target.value)}
              />
              <MeasureField
                label="Poids"
                unite="g"
                value={champs.weightG}
                onChange={(event) => poser("weightG", event.target.value)}
              />
            </div>
            <Hint>
              Par dose : l'unité pour un gel ou une barre, la mesurette pour une
              poudre. L'étiquette donne souvent le sel, dont 1 g vaut 400 mg de
              sodium.
            </Hint>
          </div>

          {boisson && (
            <MeasureField
              label="Volume d'eau pour une dose"
              unite="mL"
              value={champs.fluidMl}
              onChange={(event) => poser("fluidMl", event.target.value)}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <MeasureField
              label="Énergie"
              unite="kcal"
              placeholder="selon les glucides"
              value={champs.energyKcal}
              onChange={(event) => poser("energyKcal", event.target.value)}
            />
            <MeasureField
              label="Caféine"
              unite="mg"
              placeholder="0"
              value={champs.caffeineMg}
              onChange={(event) => poser("caffeineMg", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              <ToggleChip actif={casse} onChange={setCasse}>
                se coupe en deux
              </ToggleChip>
              <ToggleChip actif={melange} onChange={setMelange}>
                glucose et fructose
              </ToggleChip>
            </div>
            <Hint>
              Ce qui se coupe se compte par demi-dose au roadbook. Le mélange de
              sucres compte au-delà de 60 g/h.
            </Hint>
          </div>

          {erreur && <ErrorNote>{erreur}</ErrorNote>}
        </div>

        <ModalFoot>
          <Button ton="retrait" onClick={onFermer}>
            annuler
          </Button>
          <Button
            type="submit"
            ton="encre"
            disabled={pending}
            icone={<PlusIcon className="size-4" />}
          >
            {pending ? "Ajout au sac" : "Créer et mettre au sac"}
          </Button>
        </ModalFoot>
      </form>
    </Modal>
  );
}
