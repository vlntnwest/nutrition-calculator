"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toNumber } from "@/format/number";
import { Button } from "@/ui/Button";
import { ToggleChip } from "@/ui/Chip";
import { MeasureField, TextField } from "@/ui/Field";
import { PlusIcon } from "@/ui/icons";
import { ErrorNote } from "@/ui/Notice";
import { Select } from "@/ui/Select";
import { addProduct } from "./actions";

const VIDE = {
  brandName: "",
  formatLabel: "",
  name: "",
  codeSeed: "",
  weightG: "",
  energyKcal: "",
  carbsG: "",
  sodiumMg: "",
  fluidMl: "0",
  caffeineMg: "0",
  proteinG: "",
  fiberG: "",
  sugarG: "",
  fatG: "",
  purchaseUrl: "",
};

/**
 * Saisie directe en base : marque et format viennent de ce qui existe déjà,
 * le reste se tape. Pas de brouillon ni d'édition — une saisie ratée se
 * corrige en la rejouant, l'identifiant fera l'erreur d'unicité sinon.
 */
export function NewProductForm({
  marques,
  formats,
}: {
  marques: string[];
  formats: string[];
}) {
  const router = useRouter();
  const [champs, setChamps] = useState(VIDE);
  const [casse, setCasse] = useState(false);
  const [transportable, setTransportable] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoute, setAjoute] = useState(false);
  const [pending, start] = useTransition();

  function poser<K extends keyof typeof VIDE>(cle: K, valeur: string) {
    setChamps((c) => ({ ...c, [cle]: valeur }));
    setAjoute(false);
  }

  function soumettre(event: FormEvent) {
    event.preventDefault();

    const weightG = arrondi(toNumber(champs.weightG));
    const energyKcal = arrondi(toNumber(champs.energyKcal));
    const carbsG = toNumber(champs.carbsG);
    const sodiumMg = arrondi(toNumber(champs.sodiumMg));
    const fluidMl = arrondi(toNumber(champs.fluidMl)) ?? 0;
    const caffeineMg = arrondi(toNumber(champs.caffeineMg)) ?? 0;
    const proteinG = toNumber(champs.proteinG);
    const fiberG = toNumber(champs.fiberG);
    const sugarG = toNumber(champs.sugarG);
    const fatG = toNumber(champs.fatG);
    const purchaseUrl = champs.purchaseUrl.trim() || undefined;

    if (
      !champs.brandName ||
      !champs.formatLabel ||
      !champs.name.trim() ||
      !champs.codeSeed.trim() ||
      weightG === undefined ||
      energyKcal === undefined ||
      carbsG === undefined ||
      sodiumMg === undefined
    ) {
      setErreur("Il manque au moins un champ.");

      return;
    }

    setErreur(null);
    start(async () => {
      const result = await addProduct({
        codeSeed: champs.codeSeed.trim(),
        brandName: champs.brandName,
        formatLabel: champs.formatLabel,
        name: champs.name.trim(),
        weightG,
        energyKcal,
        carbsG,
        sodiumMg,
        fluidMl,
        caffeineMg,
        proteinG,
        fiberG,
        sugarG,
        fatG,
        purchaseUrl,
        divisibleBy: casse ? 2 : 1,
        multiTransportable: transportable,
      });

      if (!result.ok) {
        setErreur(result.error);

        return;
      }

      setChamps(VIDE);
      setCasse(false);
      setTransportable(false);
      setAjoute(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={soumettre}
      className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-line bg-paper p-4 sm:p-5"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-soft text-xs">Marque</span>
          <Select
            taille="md"
            value={champs.brandName}
            onChange={(event) => poser("brandName", event.target.value)}
          >
            <option value="">—</option>
            {marques.map((marque) => (
              <option key={marque} value={marque}>
                {marque}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-ink-soft text-xs">Format</span>
          <Select
            taille="md"
            value={champs.formatLabel}
            onChange={(event) => poser("formatLabel", event.target.value)}
          >
            <option value="">—</option>
            {formats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <TextField
        label="Nom"
        placeholder="Ultra Energy Gel"
        value={champs.name}
        onChange={(event) => poser("name", event.target.value)}
      />

      <TextField
        label="Identifiant"
        placeholder="naak-gel-ultra"
        hint="marque-format-distinctif, en minuscules et tirets"
        value={champs.codeSeed}
        onChange={(event) => poser("codeSeed", event.target.value)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MeasureField
          label="Poids"
          unite="g"
          value={champs.weightG}
          onChange={(event) => poser("weightG", event.target.value)}
        />
        <MeasureField
          label="Énergie"
          unite="kcal"
          value={champs.energyKcal}
          onChange={(event) => poser("energyKcal", event.target.value)}
        />
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
          label="Liquide"
          unite="mL"
          value={champs.fluidMl}
          onChange={(event) => poser("fluidMl", event.target.value)}
        />
        <MeasureField
          label="Caféine"
          unite="mg"
          value={champs.caffeineMg}
          onChange={(event) => poser("caffeineMg", event.target.value)}
        />
        <MeasureField
          label="Protéines"
          unite="g"
          placeholder="—"
          value={champs.proteinG}
          onChange={(event) => poser("proteinG", event.target.value)}
        />
        <MeasureField
          label="Fibres"
          unite="g"
          placeholder="—"
          value={champs.fiberG}
          onChange={(event) => poser("fiberG", event.target.value)}
        />
        <MeasureField
          label="Sucre"
          unite="g"
          placeholder="—"
          value={champs.sugarG}
          onChange={(event) => poser("sugarG", event.target.value)}
        />
        <MeasureField
          label="Lipides"
          unite="g"
          placeholder="—"
          value={champs.fatG}
          onChange={(event) => poser("fatG", event.target.value)}
        />
      </div>

      <TextField
        label="Lien d'achat"
        placeholder="https://…"
        type="url"
        value={champs.purchaseUrl}
        onChange={(event) => poser("purchaseUrl", event.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <ToggleChip actif={casse} onChange={setCasse}>
          se casse en deux
        </ToggleChip>
        <ToggleChip actif={transportable} onChange={setTransportable}>
          glucose:fructose
        </ToggleChip>
      </div>

      {erreur && <ErrorNote>{erreur}</ErrorNote>}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          ton="encre"
          disabled={pending}
          icone={<PlusIcon className="size-4" />}
        >
          {pending ? "Ajout…" : "Ajouter"}
        </Button>
        {ajoute && <span className="text-[13px] text-ink-soft">Ajouté.</span>}
      </div>
    </form>
  );
}

/** Poids, énergie, sodium, caféine et liquide sont des entiers en base : une
 * virgule tapée s'arrondit plutôt que de faire échouer l'insertion. */
function arrondi(valeur: number | undefined): number | undefined {
  return valeur === undefined ? undefined : Math.round(valeur);
}
