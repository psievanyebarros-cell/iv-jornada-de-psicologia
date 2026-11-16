import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriaBadge, SiteHeader } from "@/components/SiteHeader";
import {
  CATEGORIAS,
  consolidar,
  csvConsolidado,
  csvDetalhado,
  formatarData,
  formatarNota,
  localPadrao,
  mediaAvaliacao,
} from "@/lib/avaliacao";
import { adicionarAvaliador, adicionarTrabalho, dadosAdmin, entrarAdmin, removerRegistro } from "@/lib/jornada.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração · IV Jornada de Psicologia" },
      { name: "description", content: "Resumo das notas consolidadas e exportação das avaliações da IV Jornada de Psicologia." },
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
        <Painel senha={senha} onInvalida={() => { sessionStorage.removeItem(CHAVE); setSenha(null); }} />
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
        <p className="text-sm text-muted-foreground">Acesso restrito à comissão organizadora.</p>
        <label htmlFor="senha" className="mt-6 block text-sm font-medium">Senha</label>
        <Input
          id="senha"
          type="password"
          value={valor}
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
  const [cat, setCat] = useState<string>("Todas");
  const resumo = useMemo(() => consolidar(trabalhos, avaliacoes), [trabalhos, avaliacoes]);
  const resumoFiltrado = resumo
    .filter((r) => cat === "Todas" || r.categoria === cat)
    .sort((a, b) => (b.media_final ?? -1) - (a.media_final ?? -1));
  const nomes = useMemo(() => new Map(avaliadores.map((a) => [a.id, a.nome])), [avaliadores]);
  const trabs = useMemo(() => new Map(trabalhos.map((t) => [t.id, t])), [trabalhos]);
  const avaliadosCount = resumo.filter((r) => r.total_avaliacoes > 0).length;
  const mediaGeral = avaliacoes.length
    ? avaliacoes.reduce((s, a) => s + mediaAvaliacao(a), 0) / avaliacoes.length
    : null;

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Painel administrativo</p>
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

      <Tabs defaultValue="resumo" className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
          <TabsTrigger value="cadastros">Cadastros</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {["Todas", ...CATEGORIAS].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Trabalho</th>
                  <th className="px-4 py-3">Categoria / Local</th>
                  <th className="px-3 py-3 text-center">Aval.</th>
                  <th className="px-3 py-3 text-center">Conteúdo</th>
                  <th className="px-3 py-3 text-center">Apresent.</th>
                  <th className="px-3 py-3 text-center">Domínio</th>
                  <th className="px-4 py-3 text-center">Média final</th>
                </tr>
              </thead>
              <tbody>
                {resumoFiltrado.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary">{r.codigo_trabalho}</span>
                      <p className="line-clamp-2 max-w-sm">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground">{r.autor_principal}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CategoriaBadge categoria={r.categoria} />
                      <p className="mt-1 text-xs text-muted-foreground">{r.local_apresentacao}</p>
                    </td>
                    <td className="px-3 py-3 text-center">{r.total_avaliacoes}</td>
                    <td className="px-3 py-3 text-center">{formatarNota(r.media_conteudo)}</td>
                    <td className="px-3 py-3 text-center">{formatarNota(r.media_apresentacao)}</td>
                    <td className="px-3 py-3 text-center">{formatarNota(r.media_dominio)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block min-w-14 rounded-full px-3 py-1 font-semibold ${
                          r.media_final === null ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"
                        }`}
                      >
                        {formatarNota(r.media_final)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="avaliacoes" className="mt-4">
          <div className="grid gap-3">
            {avaliacoes.length === 0 && (
              <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                Nenhuma avaliação enviada ainda.
              </p>
            )}
            {avaliacoes.map((a) => {
              const t = trabs.get(a.trabalho_id);
              return (
                <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold text-primary">{t?.codigo_trabalho}</span> · {t?.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nomes.get(a.avaliador_id)} · {formatarData(a.data_envio)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2 py-1">Cont. {formatarNota(a.nota_conteudo)}</span>
                      <span className="rounded-full bg-muted px-2 py-1">Apres. {formatarNota(a.nota_apresentacao)}</span>
                      <span className="rounded-full bg-muted px-2 py-1">Dom. {formatarNota(a.nota_dominio)}</span>
                      <span className="rounded-full bg-primary-soft px-2 py-1 font-semibold text-primary">
                        {formatarNota(mediaAvaliacao(a))}
                      </span>
                      <Remover senha={senha} tabela="avaliacoes" id={a.id} rotulo="esta avaliação" />
                    </div>
                  </div>
                  {a.observacoes_parecer && (
                    <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/60 p-3 text-sm">{a.observacoes_parecer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="cadastros" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <NovoAvaliador senha={senha} />
            <NovoTrabalho senha={senha} />
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <h3 className="font-display text-lg">Avaliadores ({avaliadores.length})</h3>
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
              <h3 className="font-display text-lg">Trabalhos ({trabalhos.length})</h3>
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
    </main>
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
        if (nome.trim().length < 3) return toast.error("Informe o nome completo.");
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
      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" maxLength={150} className="mt-3 rounded-xl" />
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
        if (!f.codigo_trabalho.trim() || f.titulo.trim().length < 3 || f.autor_principal.trim().length < 3 || f.local_apresentacao.trim().length < 2) {
          return toast.error("Preencha todos os campos.");
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
        <Input value={f.codigo_trabalho} onChange={(e) => setF({ ...f, codigo_trabalho: e.target.value })} placeholder="Código (ex: TS-05)" maxLength={20} className="rounded-xl" />
        <Input value={f.autor_principal} onChange={(e) => setF({ ...f, autor_principal: e.target.value })} placeholder="Autor principal" maxLength={150} className="rounded-xl sm:col-span-2" />
        <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Título do trabalho" maxLength={300} className="rounded-xl sm:col-span-3" />
        <Select
          value={f.categoria}
          onValueChange={(v) => setF({ ...f, categoria: v, local_apresentacao: localPadrao(v) })}
        >
          <SelectTrigger className="rounded-xl sm:col-span-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={f.local_apresentacao} onChange={(e) => setF({ ...f, local_apresentacao: e.target.value })} placeholder="Local" maxLength={100} className="rounded-xl" />
      </div>
      <Button type="submit" className="mt-3 rounded-xl" disabled={salvando}>
        <Plus className="size-4" /> Adicionar
      </Button>
    </form>
  );
}
