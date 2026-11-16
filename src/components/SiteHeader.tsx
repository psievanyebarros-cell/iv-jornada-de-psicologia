import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import ornamento from "@/assets/ornamento-jornada.png.asset.json";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="brand-band">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src={ornamento.url} alt="" className="h-9 w-auto opacity-95" />
          <span className="leading-tight">
            <span className="block font-display text-lg tracking-wide">IV Jornada de</span>
            <span className="-mt-1 block font-display text-xl italic">psicologia</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {children}
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/30 px-3 py-1.5 text-xs font-medium text-primary-foreground/90 transition hover:bg-primary-foreground/10"
          >
            <ShieldCheck className="size-3.5" />
            Administração
          </Link>
        </div>
      </div>
    </header>
  );
}

export function CategoriaBadge({ categoria }: { categoria: string }) {
  const cls =
    categoria === "Resumo Simples"
      ? "bg-primary-soft text-primary"
      : categoria === "Resumo Expandido"
        ? "bg-navy text-navy-foreground"
        : "bg-sky/30 text-navy";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{categoria}</span>;
}
