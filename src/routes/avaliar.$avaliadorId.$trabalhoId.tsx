import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Send, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CategoriaBadge, SiteHeader } from "@/components/SiteHeader";
import { avaliacaoSchema, CRITERIOS, formatarData, formatarNota, mediaAvaliacao, type CriterioKey } from "@/lib/avaliacao";
import { enviarAvaliacao } from "@/lib/jornada.functions";
import { fichaQuery } from "@/lib/queries";

export const Route = createFileRoute("/avaliar/$avaliadorId/$trabalhoId")({
  head: () => ({
    meta: [
      { title: "Ficha de avaliação · IV Jornada de Psicologia" },
      { name: "description", content: "Ficha de avaliação de trabalho da IV Jornada Acadêmica de Psicologia." },
      { property: "og:title", content: "Ficha de avaliação · IV Jornada de Psicologia" },
      { property: "og:description", content: "Ficha de avaliação de trabalho da IV Jornada Acadêmica de Psicologia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(fichaQuery(params.avaliadorId, params.trabalhoId));
    if (!d) throw notFound();
  },
  component: Ficha,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>Trabalho ou avaliador não encontrado.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">Voltar ao início</Link>
    </div>
  ),
});

type Notas = Record<CriterioKey, string>;

function Ficha() {
  const { avaliadorId, trabalhoId } = Route.useParams();
  const { data } = useSuspenseQuery(fichaQuery(avaliadorId, trabalhoId));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enviar = useServerFn(enviarAvaliacao);

  const ex = data?.existente;
  const [notas, setNotas] = useState<Notas>({
    nota_conteudo: ex ? String(ex.nota_conteudo) : "",
    nota_apresentacao: ex ? String(ex.nota_apresentacao) : "",
    nota_dominio: ex ? String(ex.nota_dominio) : "",
  });
  const [parecer, setParecer] = useState(ex?.observacoes_parecer ?? "");
  const [erros, setErros] = useState<Partial<Record<string, string>>>({});
  const [estado, setEstado] = useState<"idle" | "enviando" | "sucesso">("idle");

  if (!data) return null;
  const { trabalho, avaliador } = data;

  const numeros = CRITERIOS.map((c) => Number(notas[c.key].replace(",", ".")));
  const completas = CRITERIOS.every((c) => notas[c.key] !== "");
  const media = completas
    ? mediaAvaliacao({ nota_conteudo: numeros[0], nota_apresentacao: numeros[1], nota_dominio: numeros[2] })
    : null;

  function setNota(k: CriterioKey, v: string) {
    setNotas((n) => ({ ...n, [k]: v }));
    setErros((e) => ({ ...e, [k]: undefined }));
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      avaliadorId,
      trabalhoId,
      nota_conteudo: notas.nota_conteudo === "" ? undefined : notas.nota_conteudo.replace(",", "."),
      nota_apresentacao: notas.nota_apresentacao === "" ? undefined : notas.nota_apresentacao.replace(",", "."),
      nota_dominio: notas.nota_dominio === "" ? undefined : notas.nota_dominio.replace(",", "."),
      observacoes_parecer: parecer,
    };
    const r = avaliacaoSchema.safeParse(payload);
    if (!r.success) {
      const map: Record<string, string> = {};
      for (const i of r.error.issues) map[String(i.path[0])] ??= i.message === "Required" ? "Informe uma nota" : i.message;
      setErros(map);
      toast.error("Revise os campos destacados.");
      return;
    }
    setEstado("enviando");
    try {
      await enviar({ data: r.data });
      setEstado("sucesso");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["painel", avaliadorId] }),
        qc.invalidateQueries({ queryKey: ["ficha", avaliadorId, trabalhoId] }),
      ]);
      setTimeout(() => navigate({ to: "/avaliador/$avaliadorId", params: { avaliadorId } }), 1300);
    } catch (err) {
      setEstado("idle");
      toast.error(err instanceof Error ? err.message : "Erro ao enviar a avaliação.");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <Link
          to="/avaliador/$avaliadorId"
          params={{ avaliadorId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Voltar à lista de trabalhos
        </Link>

        <section className="mt-4 overflow-hidden rounded-3xl border bg-card shadow-card">
          <div className="brand-band px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill-navy font-semibold">{trabalho.codigo_trabalho}</span>
              <span className="pill-sky">{trabalho.categoria}</span>
            </div>
            <h1 className="mt-4 font-display text-2xl leading-tight sm:text-3xl">{trabalho.titulo}</h1>
            <p className="mt-2 text-sm text-primary-foreground/85">{trabalho.autor_principal}</p>
          </div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 sm:px-8">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Local de apresentação</p>
                <p className="font-medium">{trabalho.local_apresentacao}</p>
                <p className="text-xs text-muted-foreground">
                  {trabalho.categoria === "Resumo Simples"
                    ? "Apresentação em pôster no hall"
                    : trabalho.categoria === "Resumo Expandido"
                      ? "Apresentação oral em sala"
                      : "Atividade conduzida em sala"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <User className="size-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Avaliador(a)</p>
                <p className="font-medium">{avaliador.nome}</p>
                {ex && (
                  <p className="text-xs text-success">Já avaliado em {formatarData(ex.data_envio)} — você pode atualizar.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={submeter} className="mt-6 grid gap-4" noValidate>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Critérios de avaliação</h2>
            <CategoriaBadge categoria={trabalho.categoria} />
          </div>

          {CRITERIOS.map((c, i) => {
            const valor = numeros[i];
            const err = erros[c.key];
            return (
              <div
                key={c.key}
                className={`rounded-2xl border bg-card p-5 shadow-card ${err ? "border-destructive/60" : ""}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label htmlFor={c.key} className="font-medium">
                      {i + 1}. {c.label}
                    </label>
                    <p className="text-sm text-muted-foreground">{c.descricao}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id={c.key}
                      inputMode="decimal"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={notas[c.key]}
                      onChange={(e) => setNota(c.key, e.target.value)}
                      placeholder="0–10"
                      aria-invalid={!!err}
                      className="h-12 w-24 rounded-xl text-center text-lg font-semibold"
                    />
                    <span className="text-sm text-muted-foreground">/ 10</span>
                  </div>
                </div>
                <Slider
                  className="mt-5"
                  min={0}
                  max={10}
                  step={0.5}
                  value={[Number.isFinite(valor) && notas[c.key] !== "" ? Math.min(10, Math.max(0, valor)) : 0]}
                  onValueChange={([v]) => setNota(c.key, String(v))}
                  aria-label={`Nota de ${c.label}`}
                />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
                {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
              </div>
            );
          })}

          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <label htmlFor="parecer" className="font-medium">
              Observações / Parecer qualitativo
            </label>
            <p className="text-sm text-muted-foreground">Feedback construtivo para os autores (opcional).</p>
            <Textarea
              id="parecer"
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              maxLength={3000}
              rows={5}
              placeholder="Pontos fortes, sugestões de melhoria, comentários…"
              className="mt-3 rounded-xl"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{parecer.length}/3000</p>
          </div>

          <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl border bg-card/95 p-4 shadow-lift backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Média</p>
              <p className="font-display text-3xl text-primary">{formatarNota(media)}</p>
            </div>
            <Button type="submit" size="lg" className="h-12 rounded-xl px-6 text-base" disabled={estado !== "idle"}>
              {estado === "enviando" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {ex ? "Atualizar avaliação" : "Enviar avaliação"}
            </Button>
          </div>
        </form>
      </main>

      {estado === "sucesso" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 backdrop-blur-sm" role="status">
          <div className="mx-5 flex max-w-sm flex-col items-center rounded-3xl bg-card p-8 text-center shadow-lift animate-rise">
            <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="size-9" />
            </div>
            <h2 className="mt-4 font-display text-2xl">Avaliação enviada!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {trabalho.codigo_trabalho} registrado. Voltando para a lista…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
