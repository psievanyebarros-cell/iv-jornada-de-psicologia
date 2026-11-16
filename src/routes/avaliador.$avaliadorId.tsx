import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, Circle, LogOut, MapPin, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { CategoriaBadge, SiteHeader } from "@/components/SiteHeader";
import { CATEGORIAS } from "@/lib/avaliacao";
import { painelQuery } from "@/lib/queries";

export const Route = createFileRoute("/avaliador/$avaliadorId")({
  head: () => ({
    meta: [
      { title: "Trabalhos para avaliar · IV Jornada de Psicologia" },
      { name: "description", content: "Lista de trabalhos da IV Jornada Acadêmica de Psicologia para o avaliador." },
      { property: "og:title", content: "Trabalhos para avaliar · IV Jornada de Psicologia" },
      { property: "og:description", content: "Lista de trabalhos da IV Jornada Acadêmica de Psicologia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(painelQuery(params.avaliadorId));
    if (!d) throw notFound();
  },
  component: Painel,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>Avaliador não encontrado.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">Voltar ao início</Link>
    </div>
  ),
});

const FILTROS = ["Todos", ...CATEGORIAS] as const;

function Painel() {
  const { avaliadorId } = Route.useParams();
  const { data } = useSuspenseQuery(painelQuery(avaliadorId));
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);

  const avaliados = useMemo(() => new Set(data?.avaliados ?? []), [data]);
  const trabalhos = data?.trabalhos ?? [];
  const total = trabalhos.length;
  const feitos = trabalhos.filter((t) => avaliados.has(t.id)).length;
  const proximo = trabalhos.find((t) => !avaliados.has(t.id));

  const lista = trabalhos.filter((t) => {
    if (filtro !== "Todos" && t.categoria !== filtro) return false;
    if (soPendentes && avaliados.has(t.id)) return false;
    const q = busca.trim().toLowerCase();
    if (q && ![t.codigo_trabalho, t.titulo, t.autor_principal].some((s) => s.toLowerCase().includes(q))) return false;
    return true;
  });

  if (!data) return null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="flex flex-col gap-5 rounded-3xl border bg-card p-6 shadow-card md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <User className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Avaliador(a)</p>
              <h1 className="font-display text-2xl sm:text-3xl">{data.avaliador.nome}</h1>
            </div>
          </div>
          <div className="w-full md:w-80">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-semibold">
                {feitos} de {total} avaliados
              </span>
            </div>
            <Progress value={total ? (feitos / total) * 100 : 0} className="mt-2 h-2.5" />
            <div className="mt-4 flex gap-2">
              {proximo ? (
                <Button asChild className="flex-1 rounded-xl">
                  <Link to="/avaliar/$avaliadorId/$trabalhoId" params={{ avaliadorId, trabalhoId: proximo.id }}>
                    Próximo pendente <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" /> Tudo avaliado!
                </div>
              )}
              <Button asChild variant="outline" className="rounded-xl" title="Trocar avaliador">
                <Link to="/">
                  <LogOut className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => {
              const n = f === "Todos" ? total : trabalhos.filter((t) => t.categoria === f).length;
              const ativo = filtro === f;
              return (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    ativo ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  {f === "Oficina / Minicurso / Roda de Conversa" ? "Oficinas e rodas" : f}
                  <span className={`ml-2 text-xs ${ativo ? "opacity-80" : "text-muted-foreground"}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={soPendentes} onCheckedChange={setSoPendentes} /> Só pendentes
            </label>
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar código, título ou autor"
                className="h-10 rounded-xl bg-card pl-9"
              />
            </div>
          </div>
        </section>

        <ul className="mt-6 grid gap-3">
          {lista.map((t) => {
            const ok = avaliados.has(t.id);
            return (
              <li key={t.id}>
                <Link
                  to="/avaliar/$avaliadorId/$trabalhoId"
                  params={{ avaliadorId, trabalhoId: t.id }}
                  className={`group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift sm:p-5 ${
                    ok ? "border-success/30" : ""
                  }`}
                >
                  <div
                    className={`grid size-14 shrink-0 place-items-center rounded-xl font-display text-lg font-semibold ${
                      ok ? "bg-success-soft text-success" : "bg-primary-soft text-primary"
                    }`}
                  >
                    {t.codigo_trabalho}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoriaBadge categoria={t.categoria} />
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3.5" /> {t.local_apresentacao}
                      </span>
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 font-medium leading-snug">{t.titulo}</h3>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.autor_principal}</p>
                  </div>
                  {ok ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
                      <CheckCircle2 className="size-3.5" /> Avaliado
                    </span>
                  ) : (
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
                      <Circle className="size-3" /> Pendente
                    </span>
                  )}
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
          {lista.length === 0 && (
            <li className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              Nenhum trabalho encontrado com esses filtros.
            </li>
          )}
        </ul>
      </main>
    </div>
  );
}
