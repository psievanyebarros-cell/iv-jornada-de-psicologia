import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CategoriaBadge, SiteHeader } from "@/components/SiteHeader";
import {
  CATEGORIAS,
  CRITERIOS,
  consolidar,
  csvConsolidado,
  csvDetalhado,
  desempacotarAvaliacao,
  formatarData,
  formatarNota,
  localPadrao,
  mediaAvaliacao,
  type Avaliacao,
  type Trabalho,
} from "@/lib/avaliacao";
import {
  adicionarAvaliador,
  adicionarTrabalho,
  atualizarAvaliacaoAdmin,
  dadosAdmin,
  entrarAdmin,
  removerRegistro,
} from "@/lib/jornada.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração · IV Jornada de Psicologia" },
      {
        name: "description",
        content: "Resumo das notas consolidadas e exportação das avaliações da IV Jornada de Psicologia.",
      },
      { property: "og:title", content: "Administração · IV Jornada de Psicologia" },
      { property: "og:description", content: "Resumo das notas consolidadas e exportação das avaliações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const CHAVE = "jornada:admin";

function baixar(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function Admin() {
  const [senha, setSenha] = useState<string | null>(null);
  useEffect(() => {
    setSenha(sessionStorage.getItem(CHAVE));
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader>
        {senha && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={() => {
              sessionStorage.removeItem(CHAVE);
              setSenha(null);
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        )}
      </SiteHeader>
      {senha ? (
        <Painel
          senha={senha}
          onInvalida={() => {
            sessionStorage.removeItem(CHAVE);
            setSenha(null);
          }}
        />
      ) : (
        <Login
          onOk={(s) => {
            sessionStorage.setItem(CHAVE, s);
            setSenha(s);
          }}
        />
      )}
    </div>
  );
}

function Login({ onOk }: { onOk: (s: string) => void }) {
  const entrar = useServerFn(entrarAdmin);
  const [valor, setValor] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!valor) return;
    setCarregando(true);
    setErro("");
    try {
      await entrar({ data: { senha: valor } });
      onOk(valor);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <form onSubmit={submeter} className="rounded-3xl border bg-card p-8 shadow-lift">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Lock className="size-5" />
        </div>
        <h1 className="mt-4 font-display text-2xl">Área administrativa</h1>
        <p className="text-sm text-muted-foreground">Acesso restrito à comissão organizadora e monitores.</p>

        <label htmlFor="senha" className="mt-6 block text-sm font-medium">
          Senha de acesso
        </label>
        <Input
          id="senha"
          type="password"
          value={valor}
          placeholder="Digite a senha de acesso"
          onChange={(e) => setValor(e.target.value)}
          className="mt-2 h-11 rounded-xl"
          autoFocus
        />
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="mt-6 h-11 w-full rounded-xl" disabled={carregando || !valor}>
          {carregando && <Loader2 className="size-4 animate-spin" />} Entrar
        </Button>
      </form>
    </main>
  );
}

function Painel({ senha, onInvalida }: { senha: string; onInvalida: () => void }) {
  const buscar = useServerFn(dadosAdmin);
  const q = useQuery({ queryKey: ["admin", senha], queryFn: () => buscar({ data: { senha } }), retry: false });

  useEffect(() => {
    if (q.error) {
      toast.error(q.error.message);
      if (/senha/i.test(q.error.message)) onInvalida();
    }
  }, [q.error, onInvalida]);

  if (q.isPending) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (!q.data) return null;
  return <Conteudo senha={senha} dados={q.data} recarregar={() => q.refetch()} carregando={q.isFetching} />;
}

type Dados = Awaited<ReturnType<typeof dadosAdmin>>;

function Conteudo({
  senha,
  dados,
  recarregar,
  carregando,
}: {
  senha: string;
  dados: Dados;
  recarregar: () => void;
  carregando: boolean;
}) {
  const { avaliadores, trabalhos, avaliacoes } = dados;
  const [tabAtiva, setTabAtiva] = useState<string>("resumo");
  const [cat, setCat] = useState<string>("Todas");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "avaliados" | "pendentes">("todos");
  const [buscaResumo, setBuscaResumo] = useState("");
  const [buscaAvaliacao, setBuscaAvaliacao] = useState("");
  const [filtroTrabalhoId, setFiltroTrabalhoId] = useState<string>("todos");
  const [avaliacaoParaEditar, setAvaliacaoParaEditar] = useState<Avaliacao | null>(null);

  const resumo = useMemo(() => consolidar(trabalhos, avaliacoes), [trabalhos, avaliacoes]);
  const avaliadosCount = resumo.filter((r) => r.total_avaliacoes > 0).length;
  const pendentesCount = resumo.length - avaliadosCount;

  const resumoFiltrado = useMemo(() => {
    return resumo
      .filter((r) => cat === "Todas" || r.categoria === cat)
      .filter((r) => {
        if (filtroStatus === "avaliados") return r.total_avaliacoes > 0;
        if (filtroStatus === "pendentes") return r.total_avaliacoes === 0;
        return true;
      })
      .filter((r) => {
        if (!buscaResumo.trim()) return true;
        const q = buscaResumo.toLowerCase();
        return (
          r.codigo_trabalho.toLowerCase().includes(q) ||
          r.titulo.toLowerCase().includes(q) ||
          r.autor_principal.toLowerCase().includes(q) ||
          (r.grupo_tema && r.grupo_tema.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (b.media_final ?? -1) - (a.media_final ?? -1));
  }, [resumo, cat, filtroStatus, buscaResumo]);

  const nomes = useMemo(() => new Map(avaliadores.map((a) => [a.id, a.nome])), [avaliadores]);
  const trabs = useMemo(() => new Map(trabalhos.map((t) => [t.id, t])), [trabalhos]);

  const mediaGeral = avaliacoes.length
    ? avaliacoes.reduce((s, a) => s + mediaAvaliacao(a), 0) / avaliacoes.length
    : null;

  const hoje = new Date().toISOString().slice(0, 10);

  const avaliacoesFiltradas = useMemo(() => {
    return avaliacoes.filter((a) => {
      if (filtroTrabalhoId !== "todos" && a.trabalho_id !== filtroTrabalhoId) {
        return false;
      }
      if (!buscaAvaliacao.trim()) return true;
      const q = buscaAvaliacao.toLowerCase();
      const t = trabs.get(a.trabalho_id);
      const { nomeAvaliador, parecer } = desempacotarAvaliacao(a);
      const nomeAv = nomeAvaliador || nomes.get(a.avaliador_id) || "";
      return (
        (t?.codigo_trabalho && t.codigo_trabalho.toLowerCase().includes(q)) ||
        (t?.titulo && t.titulo.toLowerCase().includes(q)) ||
        nomeAv.toLowerCase().includes(q) ||
        parecer.toLowerCase().includes(q)
      );
    });
  }, [avaliacoes, filtroTrabalhoId, buscaAvaliacao, trabs, nomes]);

  const trabalhoFiltroInfo = filtroTrabalhoId !== "todos" ? trabs.get(filtroTrabalhoId) : null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Painel de Gestão e Monitoria</p>
          <h1 className="font-display text-3xl sm:text-4xl">Resultados das avaliações</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={recarregar} disabled={carregando}>
            <RefreshCw className={`size-4 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button className="rounded-xl" onClick={() => baixar(`jornada-notas-consolidadas-${hoje}.csv`, csvConsolidado(resumo))}>
            <FileSpreadsheet className="size-4" /> CSV consolidado
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={() => baixar(`jornada-avaliacoes-detalhadas-${hoje}.csv`, csvDetalhado(avaliacoes, trabalhos, avaliadores))}
          >
            <Download className="size-4" /> CSV detalhado
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<ClipboardList className="size-4" />} label="Avaliações recebidas" valor={String(avaliacoes.length)} />
        <Stat icon={<BarChart3 className="size-4" />} label="Trabalhos avaliados" valor={`${avaliadosCount}/${trabalhos.length}`} />
        <Stat icon={<Users className="size-4" />} label="Avaliadores" valor={String(avaliadores.length)} />
        <Stat icon={<BarChart3 className="size-4" />} label="Média geral" valor={formatarNota(mediaGeral)} />
      </div>

      <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="resumo">Resumo dos Trabalhos</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações ({avaliacoes.length})</TabsTrigger>
          <TabsTrigger value="cadastros">Cadastros</TabsTrigger>
        </TabsList>

        {/* ABA: RESUMO DOS TRABALHOS */}
        <TabsContent value="resumo" className="mt-4 space-y-4">
          {/* Controles de Filtros */}
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            {/* Status (Avaliados vs Pendentes) */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFiltroStatus("todos")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filtroStatus === "todos"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                Todos ({resumo.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("avaliados")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filtroStatus === "avaliados"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                }`}
              >
                <CheckCircle2 className="size-3" /> Avaliados ({avaliadosCount})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("pendentes")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filtroStatus === "pendentes"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                }`}
              >
                <Clock className="size-3" /> Pendentes ({pendentesCount})
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative min-w-[240px] max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaResumo}
                onChange={(e) => setBuscaResumo(e.target.value)}
                placeholder="Buscar por código, título ou autor..."
                className="h-9 rounded-xl pl-9 text-xs"
              />
            </div>
          </div>

          {/* Categorias */}
          <div className="flex flex-wrap gap-2">
            {["Todas", ...CATEGORIAS].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  cat === c ? "border-primary bg-primary text-primary-foreground font-semibold" : "bg-card hover:bg-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Tabela de Trabalhos */}
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Trabalho</th>
                  <th className="px-4 py-3">Categoria / Local</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">C1 (Cont.)</th>
                  <th className="px-3 py-3 text-center">C2 (Dom.)</th>
                  <th className="px-3 py-3 text-center">C3/C4 (Apres.)</th>
                  <th className="px-4 py-3 text-center">Média final</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {resumoFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      Nenhum trabalho encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  resumoFiltrado.map((r) => (
                    <tr key={r.id} className="border-t align-middle hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-primary">{r.codigo_trabalho}</span>
                        <p className="line-clamp-2 max-w-sm font-medium">{r.titulo}</p>
                        <p className="text-xs text-muted-foreground">{r.autor_principal}</p>
                      </td>
                      <td className="px-4 py-3">
                        <CategoriaBadge categoria={r.categoria} />
                        <p className="mt-1 text-xs text-muted-foreground">{r.local_apresentacao}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.total_avaliacoes > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            {r.total_avaliacoes} aval.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <Clock className="size-3" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">{formatarNota(r.media_conteudo)}</td>
                      <td className="px-3 py-3 text-center">{formatarNota(r.media_dominio)}</td>
                      <td className="px-3 py-3 text-center">{formatarNota(r.media_apresentacao)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block min-w-14 rounded-full px-3 py-1 font-semibold ${
                            r.media_final === null ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"
                          }`}
                        >
                          {formatarNota(r.media_final)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.total_avaliacoes > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 rounded-lg text-xs hover:bg-primary-soft hover:text-primary"
                            onClick={() => {
                              setFiltroTrabalhoId(r.id);
                              setTabAtiva("avaliacoes");
                            }}
                          >
                            <Eye className="size-3.5" /> Ver / Editar ({r.total_avaliacoes})
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem avaliações</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ABA: AVALIAÇÕES DETALHADAS */}
        <TabsContent value="avaliacoes" className="mt-4 space-y-4">
          {/* Alerta de filtro ativo por trabalho */}
          {trabalhoFiltroInfo && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary-soft/60 p-3 text-xs text-primary">
              <div>
                Filtrando avaliações de: <strong>{trabalhoFiltroInfo.codigo_trabalho}</strong> · {trabalhoFiltroInfo.titulo}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-lg text-xs hover:bg-background/80"
                onClick={() => setFiltroTrabalhoId("todos")}
              >
                <X className="mr-1 size-3" /> Mostrar todas
              </Button>
            </div>
          )}

          {/* Barra de Busca de Avaliações */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[260px] max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaAvaliacao}
                onChange={(e) => setBuscaAvaliacao(e.target.value)}
                placeholder="Buscar por avaliador, código, título ou parecer..."
                className="h-10 rounded-xl pl-9 text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mostrando {avaliacoesFiltradas.length} de {avaliacoes.length} avaliações
            </p>
          </div>

          {/* Grid de Cards de Avaliação */}
          <div className="grid gap-3">
            {avaliacoesFiltradas.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                Nenhuma avaliação encontrada com os filtros atuais.
              </p>
            ) : (
              avaliacoesFiltradas.map((a) => {
                const t = trabs.get(a.trabalho_id);
                const desempacotado = desempacotarAvaliacao(a);
                const nomeAvaliadorFinal =
                  desempacotado.nomeAvaliador || nomes.get(a.avaliador_id) || "Avaliador Convidado";

                return (
                  <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-card transition hover:border-primary/30">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm">
                          <span className="font-semibold text-primary">{t?.codigo_trabalho}</span> · {t?.titulo}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Avaliador(a): <strong className="text-foreground">{nomeAvaliadorFinal}</strong> · {formatarData(a.data_envio)}
                        </p>
                      </div>

                      {/* Ações e Média */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                          Média: {formatarNota(mediaAvaliacao(a))}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1 rounded-lg text-xs font-medium"
                          onClick={() => setAvaliacaoParaEditar(a)}
                        >
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                        <Remover senha={senha} tabela="avaliacoes" id={a.id} rotulo="esta avaliação" />
                      </div>
                    </div>

                    {/* Notas dos 4 Critérios */}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border bg-muted/40 p-2 text-xs">
                        <span className="font-bold text-primary">C1</span> · Técnico-científica
                        <p className="mt-0.5 text-base font-bold">{desempacotado.c1 || formatarNota(a.nota_conteudo)}</p>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-2 text-xs">
                        <span className="font-bold text-primary">C2</span> · Domínio & Postura
                        <p className="mt-0.5 text-base font-bold">{desempacotado.c2 || formatarNota(a.nota_dominio)}</p>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-2 text-xs">
                        <span className="font-bold text-primary">C3</span> · Qualidade Visual
                        <p className="mt-0.5 text-base font-bold">{desempacotado.c3 || formatarNota(a.nota_apresentacao)}</p>
                      </div>
                      <div className="rounded-xl border bg-muted/40 p-2 text-xs">
                        <span className="font-bold text-primary">C4</span> · Uso do Tempo
                        <p className="mt-0.5 text-base font-bold">{desempacotado.c4 || formatarNota(a.nota_apresentacao)}</p>
                      </div>
                    </div>

                    {/* Parecer textual */}
                    {desempacotado.parecer && (
                      <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed">
                        <span className="font-semibold text-muted-foreground block mb-0.5">Parecer:</span>
                        <p className="whitespace-pre-line text-foreground">{desempacotado.parecer}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ABA: CADASTROS */}
        <TabsContent value="cadastros" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <NovoAvaliador senha={senha} />
            <NovoTrabalho senha={senha} />
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="font-display text-lg">Avaliadores cadastrados ({avaliadores.length})</h3>
              <ul className="mt-3 divide-y">
                {avaliadores.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    {a.nome}
                    <Remover senha={senha} tabela="avaliadores" id={a.id} rotulo={`${a.nome} e suas avaliações`} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="font-display text-lg">Trabalhos no sistema ({trabalhos.length})</h3>
              <ul className="mt-3 divide-y">
                {trabalhos.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-primary">{t.codigo_trabalho}</span>{" "}
                      <span className="line-clamp-1">{t.titulo}</span>
                    </span>
                    <Remover senha={senha} tabela="trabalhos" id={t.id} rotulo={`${t.codigo_trabalho} e suas avaliações`} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Edição de Avaliação */}
      <EditarAvaliacaoModal
        senha={senha}
        avaliacao={avaliacaoParaEditar}
        trabalho={avaliacaoParaEditar ? trabs.get(avaliacaoParaEditar.trabalho_id) : undefined}
        nomeAvaliadorOriginal={avaliacaoParaEditar ? nomes.get(avaliacaoParaEditar.avaliador_id) : undefined}
        aberto={!!avaliacaoParaEditar}
        onFechar={() => setAvaliacaoParaEditar(null)}
        onSalvo={() => recarregar()}
      />
    </main>
  );
}

function EditarAvaliacaoModal({
  senha,
  avaliacao,
  trabalho,
  nomeAvaliadorOriginal,
  aberto,
  onFechar,
  onSalvo,
}: {
  senha: string;
  avaliacao: Avaliacao | null;
  trabalho?: Trabalho | undefined;
  nomeAvaliadorOriginal?: string | undefined;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const atualizar = useServerFn(atualizarAvaliacaoAdmin);
  const [salvando, setSalvando] = useState(false);

  const [c1, setC1] = useState(0);
  const [c2, setC2] = useState(0);
  const [c3, setC3] = useState(0);
  const [c4, setC4] = useState(0);
  const [parecer, setParecer] = useState("");
  const [nomeAvaliador, setNomeAvaliador] = useState("");

  useEffect(() => {
    if (avaliacao) {
      const d = desempacotarAvaliacao(avaliacao);
      setC1(Number(d.c1) || Number(avaliacao.nota_conteudo) || 0);
      setC2(Number(d.c2) || Number(avaliacao.nota_dominio) || 0);
      setC3(Number(d.c3) || Number(avaliacao.nota_apresentacao) || 0);
      setC4(Number(d.c4) || Number(avaliacao.nota_apresentacao) || 0);
      setParecer(d.parecer || "");
      setNomeAvaliador(d.nomeAvaliador || nomeAvaliadorOriginal || "");
    }
  }, [avaliacao, nomeAvaliadorOriginal]);

  if (!avaliacao) return null;

  const mediaCalculada = (c1 + c2 + c3 + c4) / 4;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!avaliacao) return;
    setSalvando(true);
    try {
      await atualizar({
        data: {
          senha,
          avaliacaoId: avaliacao.id,
          nota_c1: c1,
          nota_c2: c2,
          nota_c3: c3,
          nota_c4: c4,
          nomeAvaliador: nomeAvaliador.trim() || undefined,
          observacoes_parecer: parecer,
        },
      });
      toast.success("Avaliação atualizada com sucesso!");
      onSalvo();
      onFechar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar avaliação.");
    } finally {
      setSalvando(false);
    }
  }

  const criterios = [
    { ...CRITERIOS[0], val: c1, set: setC1 },
    { ...CRITERIOS[1], val: c2, set: setC2 },
    { ...CRITERIOS[2], val: c3, set: setC3 },
    { ...CRITERIOS[3], val: c4, set: setC4 },
  ];

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Editar Avaliação</DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-semibold text-primary">{trabalho?.codigo_trabalho}</span> · {trabalho?.titulo}
            {nomeAvaliador && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Avaliador(a): <strong className="text-foreground">{nomeAvaliador}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="space-y-4 pt-1">
          {/* Média em tempo real */}
          <div className="flex items-center justify-between rounded-2xl bg-primary-soft p-3.5 text-primary">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">Nova Média das Notas</p>
              <p className="text-xs opacity-80">Média aritmética dos 4 critérios regulamentares</p>
            </div>
            <div className="font-display text-2xl font-bold">{formatarNota(mediaCalculada)}</div>
          </div>

          {/* 4 Critérios */}
          <div className="space-y-3">
            {criterios.map((c) => (
              <div key={c.codigo} className="rounded-2xl border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-primary text-xs">{c.codigo}</span> ·{" "}
                    <span className="text-xs font-semibold">{c.tituloCurto}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={c.val}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0 && v <= 10) c.set(Math.round(v * 10) / 10);
                      }}
                      className="h-8 w-16 text-center text-xs font-semibold rounded-lg"
                    />
                    <span className="text-xs text-muted-foreground">/ 10</span>
                  </div>
                </div>
                <div className="mt-2.5">
                  <Slider
                    value={[c.val]}
                    min={0}
                    max={10}
                    step={0.1}
                    onValueChange={(val) => c.set(val[0] ?? 0)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Observações / Parecer */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Parecer / Justificativas
            </label>
            <Textarea
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Comentários sobre o trabalho..."
              rows={3}
              className="rounded-xl text-xs resize-none"
            />
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl text-xs" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-xl text-xs" disabled={salvando}>
              {salvando && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-display text-3xl">{valor}</p>
    </div>
  );
}

function useRecarregar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["avaliadores"] });
    qc.invalidateQueries({ queryKey: ["painel"] });
  };
}

function Remover({
  senha,
  tabela,
  id,
  rotulo,
}: {
  senha: string;
  tabela: "avaliadores" | "trabalhos" | "avaliacoes";
  id: string;
  rotulo: string;
}) {
  const remover = useServerFn(removerRegistro);
  const recarregar = useRecarregar();
  return (
    <button
      type="button"
      title="Remover"
      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      onClick={async () => {
        if (!confirm(`Remover ${rotulo}? Esta ação não pode ser desfeita.`)) return;
        try {
          await remover({ data: { senha, tabela, id } });
          toast.success("Removido.");
          recarregar();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao remover.");
        }
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function NovoAvaliador({ senha }: { senha: string }) {
  const add = useServerFn(adicionarAvaliador);
  const recarregar = useRecarregar();
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="rounded-2xl border bg-card p-5 shadow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (nome.trim().length < 3) {
          toast.error("Informe o nome completo.");
          return;
        }
        setSalvando(true);
        try {
          await add({ data: { senha, nome } });
          toast.success("Avaliador cadastrado.");
          setNome("");
          recarregar();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erro ao cadastrar.");
        } finally {
          setSalvando(false);
        }
      }}
    >
      <h3 className="font-display text-lg">Novo avaliador</h3>
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome completo"
        maxLength={150}
        className="mt-3 rounded-xl"
      />
      <Button type="submit" className="mt-3 rounded-xl" disabled={salvando}>
        <Plus className="size-4" /> Adicionar
      </Button>
    </form>
  );
}

function NovoTrabalho({ senha }: { senha: string }) {
  const add = useServerFn(adicionarTrabalho);
  const recarregar = useRecarregar();
  const vazio = {
    codigo_trabalho: "",
    titulo: "",
    autor_principal: "",
    categoria: CATEGORIAS[0] as string,
    local_apresentacao: "Hall de Entrada",
  };
  const [f, setF] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="rounded-2xl border bg-card p-5 shadow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          !f.codigo_trabalho.trim() ||
          f.titulo.trim().length < 3 ||
          f.autor_principal.trim().length < 3 ||
          f.local_apresentacao.trim().length < 2
        ) {
          toast.error("Preencha todos os campos.");
          return;
        }
        setSalvando(true);
        try {
          await add({ data: { senha, ...f, categoria: f.categoria as (typeof CATEGORIAS)[number] } });
          toast.success("Trabalho cadastrado.");
          setF(vazio);
          recarregar();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erro ao cadastrar.");
        } finally {
          setSalvando(false);
        }
      }}
    >
      <h3 className="font-display text-lg">Novo trabalho</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Input
          value={f.codigo_trabalho}
          onChange={(e) => setF({ ...f, codigo_trabalho: e.target.value })}
          placeholder="Código (ex: TS-05)"
          maxLength={20}
          className="rounded-xl"
        />
        <Input
          value={f.autor_principal}
          onChange={(e) => setF({ ...f, autor_principal: e.target.value })}
          placeholder="Autor principal"
          maxLength={150}
          className="rounded-xl sm:col-span-2"
        />
        <Input
          value={f.titulo}
          onChange={(e) => setF({ ...f, titulo: e.target.value })}
          placeholder="Título do trabalho"
          maxLength={300}
          className="rounded-xl sm:col-span-3"
        />
        <Select
          value={f.categoria}
          onValueChange={(v) => setF({ ...f, categoria: v, local_apresentacao: localPadrao(v) })}
        >
          <SelectTrigger className="rounded-xl sm:col-span-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={f.local_apresentacao}
          onChange={(e) => setF({ ...f, local_apresentacao: e.target.value })}
          placeholder="Local"
          maxLength={100}
          className="rounded-xl"
        />
      </div>
      <Button type="submit" className="mt-3 rounded-xl" disabled={salvando}>
        <Plus className="size-4" /> Adicionar
      </Button>
    </form>
  );
}
