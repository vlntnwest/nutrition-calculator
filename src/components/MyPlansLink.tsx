"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { storedPlans } from "@/app/plans/stored";

export function MyPlansLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(storedPlans().length);
  }, []);

  return (
    <Link
      href="/plans/mes-plans"
      className="flex min-w-[280px] flex-1 flex-col items-start justify-between gap-4 rounded-[20px] bg-paper px-6 py-5 text-left transition hover:bg-paper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <span className="font-mono text-[11px] text-ink-soft uppercase tracking-wide">
        Sur cet appareil
      </span>
      <span className="whitespace-nowrap text-lg font-bold">
        Mes plans{" "}
        <span className="font-mono text-base text-ink-soft">{count}</span>
      </span>
    </Link>
  );
}
