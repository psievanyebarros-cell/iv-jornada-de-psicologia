import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Filter,
  Layers,
  LogOut,
  MapPin,
  Search,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { CategoriaBadge, SiteHeader } from "@/components/SiteHeader";
import { painelQuery } from "@/lib/queries";
import { lerPreferencia } from "@/lib/browser-storage";
import { GRUPOS_TEMATICOS, SALAS_EXPANDIDOS, DATAS_EXPANDIDOS } from "@/lib/dados-oficiais";

export const Route = createFileRoute("/avaliador/$avaliadorId")({
  head: () => ({
    meta: [
      { title: "Painel de Avaliação · IV Jornada de Psicologia" },
      {
        name: "description",
        content: "Painel de seleção de trabalhos e grupos temáticos para avaliação.",
      },
      { property: "og:title", content: "Painel de Avaliação · IV Jornada de Psicologia" },
      { property: "og:description", content: "Painel de seleção de trabalhos e grupos temáticos da IV Jornada de Psicologia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(painelQuery(params.avaliadorId));
  },
  component: Painel,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-destructive">
      {error instanceof Error ? error.message : "Erro ao carregar o painel."}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>Avaliador não encontrado.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Voltar ao início
      </Link>
    </div>
  ),
});

type AbaModalidade = "simples" | "expandido" | "todos";

function Painel() {
  const { avaliadorId } = Route.useParams();
  const [nomeSalvo, setNomeSalvo] = useState<string>("");

  useEffect(() => {
    const salvo = lerPreferencia("localStorage", "jornada:avaliador-nome");
    if (salvo) setNomeSalvo(salvo);
  }, []);

  const { data } = useSuspenseQuery(painelQuery(avaliadorId, nomeSalvo || undefined));

  // Estados de navegação
  const [aba, setAba] = useState<AbaModalidade>("simples");
  const [grupoSelecionado, setGrupoSelecionado] = useState<number | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState<string>("18/11");
  const [salaSelecionada, setSalaSelecionada] = useState<string>("Todas");
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);

  const avaliadorNome = nomeSalvo || data?.avaliador?.nome || "Avaliador(a)";
  const avaliados = useMemo(() => new Set(data?.avaliados ?? []), [data]);
  const contagemGeral = data?.contagemAvaliacoes ?? {};
  const trabalhos = data?.trabalhos ?? [];

  const totalGeral = trabalhos.length;
  const feitosGeral = trabalhos.filter((t) => avaliados.has(t.id)).length;

  // Filtra trabalhos de Resumo Simples
  const trabalhosSimples = useMemo(
    () => trabalhos.filter((t) => t.categoria === "Resumo Simples"),
    [trabalhos]
  );

  // Filtra trabalhos de Resumo Expandido
  const trabalhosExpandidos = useMemo(
    () => trabalhos.filter((t) => t.categoria === "Resumo Expandido"),
    [trabalhos]
  );

  // Trabalhos visíveis no contexto atual
  const listaExibida = useMemo(() => {
    let base = trabalhos;

    if (aba === "simples") {
      base = trabalhosSimples;
      if (grupoSelecionado !== null) {
        base = base.filter((t) => t.grupo_numero === grupoSelecionado);
      }
    } else if (aba === "expandido") {
      base = trabalhosExpandidos;
      if (dataSelecionada) {
        base = base.filter((t) => t.data_sessao === dataSelecionada);
      }
      if (salaSelecionada && salaSelecionada !== "Todas") {
        base = base.filter((t) => t.sala === salaSelecionada);
      }
    }

    if (soPendentes) {
      base = base.filter((t) => !avaliados.has(t.id));
    }

    const q = busca.trim().toLowerCase();
    if (q) {
      base = base.filter(
        (t) =>
          t.codigo_trabalho.toLowerCase().includes(q) ||
          t.titulo.toLowerCase().includes(q) ||
          t.autor_principal.toLowerCase().includes(q) ||
          (t.autores_completos && t.autores_completos.toLowerCase().includes(q))
      );
    }

    return base;
  }, [
    trabalhos,
    trabalhosSimples,
    trabalhosExpandidos,
    aba,
    grupoSelecionado,
    dataSelecionada,
    salaSelecionada,
    soPendentes,
    busca,
    avaliados,
  ]);

  if (!data) return null;

  return (
    <div className="min-h-screen pb-16">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {/* Card do Avaliador e Progresso */}
        <section className="flex flex-col gap-5 rounded-3xl border bg-card p-6 shadow-card md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary shadow-sm">
              <User className="size-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Avaliador(a) Convidado(a)
              </p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl text-foreground">
                {avaliadorNome}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suas avaliações são registradas diretamente com o seu nome
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-full md:w-64">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                  Seu Progresso
                </span>
                <span className="font-semibold text-primary">
                  {feitosGeral} avaliados por você
                </span>
              </div>
              <Progress
                value={totalGeral ? (feitosGeral / totalGeral) * 100 : 0}
                className="mt-2 h-2.5"
              />
            </div>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-dashed"
              title="Trocar avaliador / Sair"
            >
              <Link to="/">
                <LogOut className="size-4 mr-1.5" /> Sair
              </Link>
            </Button>
          </div>
        </section>

        {/* Abas Principais de Modalidade */}
        <section className="mt-8">
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => {
                setAba("simples");
                setBusca("");
              }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                aba === "simples"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Layers className="size-4" />
              Mostra de Painéis (Resumos Simples)
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  aba === "simples" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-card text-muted-foreground"
                }`}
              >
                {trabalhosSimples.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAba("expandido");
                setGrupoSelecionado(null);
                setBusca("");
              }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                aba === "expandido"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <BookOpen className="size-4" />
              Apresentações Orais (Resumos Expandidos)
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  aba === "expandido"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-card text-muted-foreground"
                }`}
              >
                {trabalhosExpandidos.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAba("todos");
                setGrupoSelecionado(null);
              }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                aba === "todos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Todos ({totalGeral})
            </button>
          </div>
        </section>

        {/* ======================================================== */}
        {/* MODALIDADE 1: RESUMOS SIMPLES POR GRUPOS TEMÁTICOS */}
        {/* ======================================================== */}
        {aba === "simples" && (
          <section className="mt-6">
            {grupoSelecionado === null ? (
              // Visão de Seleção Obrigatória do Grupo Temático (1 ao 8)
              <div className="space-y-4">
                <div className="rounded-2xl border bg-primary-soft/40 p-5">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <Sparkles className="size-4" />
                    <span>Selecione um Grupo Temático para iniciar as avaliações</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Conforme a programação da Mostra de Painéis, os trabalhos estão divididos em 8 grupos.
                    Você pode entrar em qualquer grupo e avaliar quantos trabalhos conseguir; as notas são
                    gravadas individualmente por trabalho.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                  {GRUPOS_TEMATICOS.map((g) => {
                    const trabsDoGrupo = trabalhosSimples.filter((t) => t.grupo_numero === g.numero);
                    const feitosDoGrupo = trabsDoGrupo.filter((t) => avaliados.has(t.id)).length;
                    const totalDoGrupo = trabsDoGrupo.length;
                    const concluido = totalDoGrupo > 0 && feitosDoGrupo === totalDoGrupo;

                    return (
                      <div
                        key={g.numero}
                        onClick={() => setGrupoSelecionado(g.numero)}
                        className={`group relative flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-card transition-all cursor-pointer hover:-translate-y-1 hover:border-primary hover:shadow-lift ${
                          concluido ? "border-success/40 bg-success-soft/10" : ""
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                              Grupo {g.numero}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {totalDoGrupo} trabalhos
                            </span>
                          </div>

                          <h3 className="mt-3 font-display text-lg font-semibold leading-snug group-hover:text-primary transition-colors">
                            {g.tema}
                          </h3>
                        </div>

                        <div className="mt-5 border-t pt-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {feitosDoGrupo} de {totalDoGrupo} avaliados por você
                            </span>
                            {feitosDoGrupo > 0 && (
                              <span className="font-semibold text-primary">
                                {Math.round((feitosDoGrupo / totalDoGrupo) * 100)}%
                              </span>
                            )}
                          </div>
                          <Progress
                            value={totalDoGrupo ? (feitosDoGrupo / totalDoGrupo) * 100 : 0}
                            className="mt-2 h-1.5"
                          />

                          <div className="mt-4 flex items-center justify-end text-sm font-semibold text-primary group-hover:translate-x-1 transition-transform">
                            Acessar Grupo {g.numero} <ArrowRight className="size-4 ml-1" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Visão do Grupo Selecionado
              <div className="space-y-6">
                <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <button
                      type="button"
                      onClick={() => setGrupoSelecionado(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mb-1"
                    >
                      <ArrowLeft className="size-3.5" /> Voltar à lista de Grupos Temáticos
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                        Grupo {grupoSelecionado}
                      </span>
                      <h2 className="font-display text-xl font-bold">
                        {GRUPOS_TEMATICOS.find((g) => g.numero === grupoSelecionado)?.tema}
                      </h2>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGrupoSelecionado(null)}
                    className="rounded-xl whitespace-nowrap"
                  >
                    Trocar de Grupo
                  </Button>
                </div>

                <div className="rounded-xl bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <span>
                    Avalie quantos trabalhos você puder deste grupo. Outros avaliadores também podem avaliar
                    concomitantemente ou dar continuidade aos demais trabalhos.
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* MODALIDADE 2: RESUMOS EXPANDIDOS POR DATA E SALA */}
        {/* ======================================================== */}
        {aba === "expandido" && (
          <section className="mt-6 space-y-4">
            <div className="rounded-3xl border bg-card p-5 shadow-card">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Filtro de Data */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                    Data da Sessão Oficial
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {DATAS_EXPANDIDOS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDataSelecionada(d)}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          dataSelecionada === d
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        <Calendar className="size-3.5" />
                        {d === "18/11" ? "18/11 · Quarta-Feira (8:30 - 09:30)" : "19/11 · Quinta-Feira (10:15 - 11:15)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro de Sala */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                    Sala de Apresentação
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSalaSelecionada("Todas")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        salaSelecionada === "Todas"
                          ? "bg-navy text-navy-foreground font-semibold"
                          : "border bg-card hover:bg-accent"
                      }`}
                    >
                      Todas as Salas
                    </button>
                    {SALAS_EXPANDIDOS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSalaSelecionada(s)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          salaSelecionada === s
                            ? "bg-navy text-navy-foreground font-semibold"
                            : "border bg-card hover:bg-accent"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Barra de Filtros e Busca de Trabalhos */}
        {(aba !== "simples" || grupoSelecionado !== null) && (
          <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
                <Switch checked={soPendentes} onCheckedChange={setSoPendentes} />
                Só pendentes de avaliação por você
              </label>
              <span className="text-xs text-muted-foreground border-l pl-3">
                {listaExibida.length} {listaExibida.length === 1 ? "trabalho listado" : "trabalhos listados"}
              </span>
            </div>

            <div className="relative sm:w-80">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar código, título ou autor…"
                className="h-10 rounded-xl bg-card pl-10 text-sm"
              />
            </div>
          </section>
        )}

        {/* Listagem de Trabalhos */}
        {(aba !== "simples" || grupoSelecionado !== null) && (
          <ul className="mt-4 grid gap-3">
            {listaExibida.map((t) => {
              const avaliadoPorMim = avaliados.has(t.id);
              const qtdAvaliacoes = contagemGeral[t.id] ?? 0;

              return (
                <li key={t.id}>
                  <Link
                    to="/avaliar/$avaliadorId/$trabalhoId"
                    params={{ avaliadorId, trabalhoId: t.id }}
                    className={`group flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift sm:p-5 ${
                      avaliadoPorMim ? "border-success/40 bg-success-soft/5" : ""
                    }`}
                  >
                    <div
                      className={`grid size-14 shrink-0 place-items-center rounded-xl font-display text-sm font-bold tracking-tight ${
                        avaliadoPorMim
                          ? "bg-success-soft text-success"
                          : "bg-primary-soft text-primary"
                      }`}
                    >
                      {t.codigo_trabalho}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoriaBadge categoria={t.categoria} />
                        {t.grupo_numero && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Grupo {t.grupo_numero}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {t.local_apresentacao}
                        </span>
                        {t.horario && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" /> {t.horario}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-1.5 font-semibold text-base leading-snug text-foreground group-hover:text-primary transition-colors">
                        {t.titulo}
                      </h3>

                      <p className="mt-1 text-xs text-muted-foreground">
                        <strong className="font-medium text-foreground/80">Autores:</strong>{" "}
                        {t.autores_completos || t.autor_principal}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {avaliadoPorMim ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground shadow-sm">
                          <CheckCircle2 className="size-3.5" /> Avaliado por você
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground font-medium">
                          <Circle className="size-3" /> Pendente
                        </span>
                      )}

                      {qtdAvaliacoes > 0 && !avaliadoPorMim && (
                        <span className="text-[11px] text-muted-foreground">
                          {qtdAvaliacoes} {qtdAvaliacoes === 1 ? "avaliação registrada" : "avaliações registradas"}
                        </span>
                      )}

                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Avaliar <ChevronRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}

            {listaExibida.length === 0 && (
              <li className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground">
                <p className="font-medium text-base">Nenhum trabalho encontrado com os filtros selecionados.</p>
                <p className="mt-1 text-xs">Tente desmarcar "Só pendentes" ou alterar a busca.</p>
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
