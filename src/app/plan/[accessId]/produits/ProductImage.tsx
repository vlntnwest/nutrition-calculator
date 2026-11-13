"use client";

import Image from "next/image";
import { useState } from "react";
import { productImageUrl } from "@/format/produit";

const PLACEHOLDER = "/ref.webp";

/**
 * La photo d'un produit. Tant qu'elle n'est pas encore dans Vercel Blob,
 * l'échec de chargement retombe sur le visuel commun à tout le catalogue.
 *
 * Un produit saisi par le coureur n'en aura jamais : `sansPhoto` pose le
 * visuel commun d'emblée, sans demander à Blob un fichier qui n'existe pas.
 *
 * `unoptimized` : Blob sert déjà du webp pré-dimensionné, et passer par
 * l'optimiseur d'images de Next expose sa vérification SSRF, qui rejette à
 * tort les hôtes résolus en NAT64 (une des deux IP renvoyées n'est jamais
 * `unicast`, seulement `rfc6052`).
 */
export function ProductImage({
  codeSeed,
  sansPhoto = false,
  sizes,
  className,
}: {
  codeSeed: string;
  sansPhoto?: boolean;
  sizes: string;
  className?: string;
}) {
  const [src, setSrc] = useState(() =>
    sansPhoto ? PLACEHOLDER : productImageUrl(codeSeed),
  );

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      className={className}
      unoptimized
      onError={() => setSrc(PLACEHOLDER)}
    />
  );
}
