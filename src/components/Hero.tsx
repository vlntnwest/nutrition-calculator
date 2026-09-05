import { Header } from "@/components/chrome/Header";
import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Le bandeau plein cadre de l'écran d'import : photo de relief bornée à un
 * écran, fondue au papier en haut et à l'encre en bas. `children` porte le
 * panneau de dépôt et tout ce qui vit dessus.
 */
export function Hero({ children }: { children: ReactNode }) {
  return (
    <section className="relative min-h-dvh w-full overflow-hidden bg-white">
      {/* La photo est bornée à un écran (h-dvh) : au-delà, la section
          continue sur l'encre unie du dernier palier du dégradé, sans
          étirer l'image ni la recadrer davantage. */}
      <div className="absolute inset-x-0 top-0 h-dvh">
        <Image
          src="/hero-mountain-clouds.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover scale-130 -translate-y-50"
        />

        {/* Fondu haut → blanc (la photo se fond dans le fond de page),
            fondu bas → encre (profondeur, lisibilité du panneau vitré). */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, var(--paper) 0%, transparent 22%, transparent 60%, var(--paper) 90%)",
          }}
        />
      </div>

      <div className="relative flex min-h-dvh flex-col">
        <Header />

        {children}
      </div>
    </section>
  );
}
