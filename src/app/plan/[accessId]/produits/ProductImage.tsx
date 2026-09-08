"use client";

import Image from "next/image";
import { useState } from "react";
import { productImageUrl } from "@/format/produit";

const PLACEHOLDER = "/ref.webp";

/**
 * La photo d'un produit. Tant qu'elle n'est pas encore dans Vercel Blob,
 * l'échec de chargement retombe sur le visuel commun à tout le catalogue.
 *
 * `unoptimized` : Blob sert déjà du webp pré-dimensionné, et passer par
 * l'optimiseur d'images de Next expose sa vérification SSRF, qui rejette à
 * tort les hôtes résolus en NAT64 (une des deux IP renvoyées n'est jamais
 * `unicast`, seulement `rfc6052`).
 */
export function ProductImage({
  codeSeed,
  sizes,
  className,
}: {
  codeSeed: string;
  sizes: string;
  className?: string;
}) {
  const [src, setSrc] = useState(() => productImageUrl(codeSeed));

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
