import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  status?: "Ativo" | "Em Construção" | "Não Permitido" | "Aguarde";
  href?: string;
  icon?: ReactNode;
  cta?: string;
  disabled?: boolean;
};

const pill: Record<NonNullable<Props["status"]>, string> = {
  "Ativo": "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Em Construção": "bg-amber-50 text-amber-700 border border-amber-200",
  "Não Permitido": "bg-rose-50 text-rose-700 border border-rose-200",
  "Aguarde": "bg-neutral-100 text-neutral-600 border border-neutral-200",
};

export default function ModuleCard({ title, subtitle, status="Aguarde", href, icon, cta="ENTRAR", disabled }: Props) {
  const card = (
    <div className="rounded-2xl bg-white shadow-sm border p-6 flex flex-col justify-between h-56">
      <div className="flex flex-col gap-4">
        <div className="h-12 w-12 text-neutral-400">{icon}</div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-neutral-500">{subtitle}</p>
        </div>
        <span className={`w-fit text-xs px-2 py-1 rounded-full ${pill[status]}`}>{status}</span>
      </div>
      <button
        className={`w-full rounded-xl py-2 text-sm font-medium
        ${disabled || !href ? "bg-neutral-200 text-neutral-600 cursor-not-allowed" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
        disabled={disabled || !href}
      >
        {cta}
      </button>
    </div>
  );

  if (href && !disabled) return <Link href={href}>{card}</Link>;
  return card;
}
