import Link from "next/link";

export function OfficialPlansLink() {
  return (
    <Link
      href="/plans/officiels"
      className="flex min-w-[280px] flex-1 flex-col items-start justify-between gap-4 rounded-[20px] bg-paper px-6 py-5 text-left transition hover:bg-paper-dim"
    >
      <span className="font-mono text-[11px] text-ink-soft uppercase tracking-wide">
        Catalogue
      </span>
      <span className="whitespace-nowrap text-lg font-bold">
        Voir les plans officiels
      </span>
    </Link>
  );
}
