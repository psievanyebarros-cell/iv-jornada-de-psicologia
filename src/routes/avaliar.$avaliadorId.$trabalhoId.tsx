import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CategoriaBadge, SiteHeader } from "@/components/SiteHeader";
import { Cronometro } from "@/components/Cronometro";
import {
  avaliacaoSchema,
  CRITERIOS,
  desempacotarAvaliacao,
  formatarData,
  formatarNota,
  mediaAvaliacao,
  type CriterioKey,
} from "@/lib/avaliacao";
import { enviarAvaliacao } from "@/lib/jornada.functions";
import { fichaQuery } from "@/lib/queries";

export const Route = createFileRoute("/avaliar/$avaliadorId/$trabalhoId")({
  head: () => ({
    meta: [
      { title: "Ficha de Avaliação · IV Jornada de Psicologia" },
      {
        name: "description",
        content: "Ficha de avaliação com critérios e cronômetro para a IV Jornada Acadêmica de Psicologia.",
      },
      { property: "og:title", content: "Ficha de Avaliação · IV Jornada de Psicologia" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      fichaQuery(params.avaliadorId, params.trabalhoId)
    );
  },
  component: Ficha,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-destructive">
      {error instanceof Error ? error.message : "Erro ao carregar a ficha de avaliação."}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>Trabalho ou avaliador não encontrado.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Voltar ao início
      </Link>
    </div>
  ),
});

type NotasForm = Record<CriterioKey, string>;

function Ficha() {
  const { avaliadorId, trabalhoId } = Route.useParams();
  const [nomeSalvo, setNomeSalvo] = useState<string>("");

  useEffect(() => {
    const salvo = localStorage.getItem("jornada:avaliador-nome");
    if (salvo) setNomeSalvo(salvo);
  }, []);

  const { data } = useSuspenseQuery(fichaQuery(avaliadorId, trabalhoId, nomeSalvo || undefined));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enviar = useServerFn(enviarAvaliacao);

  const ex = data?.existente;
  const dec = desempacotarAvaliacao(ex);

  const [notas, setNotas] = useState<NotasForm>({
    nota_c1: dec.c1,
    nota_c2: dec.c2,
    nota_c3: dec.c3,
    nota_c4: dec.c4,
  });
  const [parecer, setParecer] = useState(dec.parecer);
  const [erros, setErros] = useState<Partial<Record<string, string>>>({});
  const [estado, setEstado] = useState<"idle" | "enviando" | "sucesso">("idle");

  if (!data) return null;
  const { trabalho, avaliador } = data;
  const nomeAvaliadorEfetivo = nomeSalvo || dec.nomeAvaliador || avaliador.nome || "Avaliador(a)";

  const numC1 = Number(notas.nota_c1.replace(",", "."));
  const numC2 = Number(notas.nota_c2.replace(",", "."));
  const numC3 = Number(notas.nota_c3.replace(",", "."));
  const numC4 = Number(notas.nota_c4.replace(",", "."));

  const completas =
    notas.nota_c1 !== "" && notas.nota_c2 !== "" && notas.nota_c3 !== "" && notas.nota_c4 !== "";

  const media = completas
    ? mediaAvaliacao({
        nota_c1: numC1,
        nota_c2: numC2,
        nota_c3: numC3,
        nota_c4: numC4,
      })
    : null;

  function setNota(k: CriterioKey, v: string) {
    setNotas((n) => ({ ...n, [k]: v }));
    setErros((e) => ({ ...e, [k]: undefined }));
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      avaliadorId,
      trabalhoId: trabalho.id || trabalhoId,
      nomeAvaliador: nomeAvaliadorEfetivo,
      nota_c1: notas.nota_c1 === "" ? undefined : notas.nota_c1.replace(",", "."),
      nota_c2: notas.nota_c2 === "" ? undefined : notas.nota_c2.replace(",", "."),
      nota_c3: notas.nota_c3 === "" ? undefined : notas.nota_c3.replace(",", "."),
      nota_c4: notas.nota_c4 === "" ? undefined : notas.nota_c4.replace(",", "."),
      nota_conteudo: notas.nota_c1 === "" ? undefined : notas.nota_c1.replace(",", "."),
      nota_dominio: notas.nota_c2 === "" ? undefined : notas.nota_c2.replace(",", "."),
      nota_apresentacao: notas.nota_c3 === "" ? undefined : notas.nota_c3.replace(",", "."),
      observacoes_parecer: parecer,
    };

    const r = avaliacaoSchema.safeParse(payload);
    if (!r.success) {
      const map: Record<string, string> = {};
      for (const i of r.error.issues) {
        map[String(i.path[0])] ??= i.message === "Required" ? "Informe uma nota válida" : i.message;
      }
      setErros(map);
      toast.error("Por favor, preencha as notas de todos os critérios de 0 a 10.");
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

      setTimeout(() => {
        navigate({ to: "/avaliador/$avaliadorId", params: { avaliadorId } });
      }, 1200);
    } catch (err) {
      setEstado("idle");
      toast.error(err instanceof Error ? err.message : "Erro ao salvar a avaliação.");
    }
  }

  const tempoSugerido = trabalho.categoria === "Resumo Expandido" ? 15 : 10;

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <Link
          to="/avaliador/$avaliadorId"
          params={{ avaliadorId }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" /> Voltar ao painel de trabalhos
        </Link>

        {/* Cabeçalho do Trabalho */}
        <section className="mt-4 overflow-hidden rounded-3xl border bg-card shadow-card">
          <div className="brand-band px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill-navy font-bold tracking-wide">{trabalho.codigo_trabalho}</span>
              <span className="pill-sky font-medium">{trabalho.categoria}</span>
              {trabalho.grupo_numero && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                  Grupo {trabalho.grupo_numero}
                </span>
              )}
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold leading-tight sm:text-3xl text-white">
              {trabalho.titulo}
            </h1>

            <p className="mt-3 text-sm text-primary-foreground/90 font-medium">
              <span className="opacity-75">Autores:</span>{" "}
              {trabalho.autores_completos || trabalho.autor_principal}
            </p>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 sm:px-8 bg-card/60">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary shrink-0">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  Local / Sessão
                </p>
                <p className="font-semibold text-sm text-foreground">{trabalho.local_apresentacao}</p>
                {trabalho.horario && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="size-3" /> Horário: {trabalho.horario}
                  </p>
                )}
                {trabalho.data_sessao && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" /> Data: {trabalho.data_sessao}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary shrink-0">
                <User className="size-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  Avaliador(a) Responsável
                </p>
                <p className="font-semibold text-sm text-foreground">{nomeAvaliadorEfetivo}</p>
                {ex ? (
                  <p className="text-xs text-success font-medium mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Já avaliado em {formatarData(ex.data_envio)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Avaliação em andamento</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Cronômetro para o Avaliador Acompanhar */}
        <section className="mt-6">
          <Cronometro tempoSugeridoMinutos={tempoSugerido} />
        </section>

        {/* Formulário com os 4 Critérios */}
        <form onSubmit={submeter} className="mt-6 grid gap-5" noValidate>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Critérios de Avaliação</h2>
              <p className="text-xs text-muted-foreground">
                Atribua notas de 0 a 10 com precisão decimal usando o controle deslizante ou digitando
              </p>
            </div>
            <CategoriaBadge categoria={trabalho.categoria} />
          </div>

          {CRITERIOS.map((c, i) => {
            const valorStr = notas[c.key];
            const numVal = Number(valorStr.replace(",", "."));
            const err = erros[c.key];

            return (
              <div
                key={c.key}
                className={`rounded-3xl border bg-card p-6 shadow-card transition-all ${
                  err ? "border-destructive/60 bg-destructive/5" : "hover:border-primary/30"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                        {c.codigo}
                      </span>
                      <label htmlFor={c.key} className="font-bold text-base text-foreground cursor-pointer">
                        {c.tituloCurto}
                      </label>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.descricao}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                    <Input
                      id={c.key}
                      inputMode="decimal"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={notas[c.key]}
                      onChange={(e) => setNota(c.key, e.target.value)}
                      placeholder="0.0"
                      aria-invalid={!!err}
                      className="h-12 w-24 rounded-2xl text-center text-xl font-bold tracking-tight shadow-inner"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">/ 10</span>
                  </div>
                </div>

                {/* Slider com Suavidade Aprimorada */}
                <div className="mt-6 px-1">
                  <Slider
                    min={0}
                    max={10}
                    step={0.1}
                    value={[Number.isFinite(numVal) && valorStr !== "" ? Math.min(10, Math.max(0, numVal)) : 0]}
                    onValueChange={([v]) => {
                      const arred = Math.round((v ?? 0) * 10) / 10;
                      setNota(c.key, String(arred));
                    }}
                    aria-label={c.label}
                  />

                  <div className="mt-2.5 flex justify-between text-xs font-medium text-muted-foreground">
                    <span className="hover:text-foreground cursor-pointer" onClick={() => setNota(c.key, "0")}>
                      0 (Insuficiente)
                    </span>
                    <span className="hover:text-foreground cursor-pointer" onClick={() => setNota(c.key, "5")}>
                      5 (Regular)
                    </span>
                    <span className="hover:text-foreground cursor-pointer" onClick={() => setNota(c.key, "8")}>
                      8 (Bom)
                    </span>
                    <span className="hover:text-foreground cursor-pointer" onClick={() => setNota(c.key, "10")}>
                      10 (Excelente)
                    </span>
                  </div>
                </div>

                {err && <p className="mt-3 text-xs font-semibold text-destructive">{err}</p>}
              </div>
            );
          })}

          {/* Campo Parecer Qualitativo */}
          <div className="rounded-3xl border bg-card p-6 shadow-card">
            <label htmlFor="parecer" className="font-bold text-base text-foreground block">
              Observações / Parecer Qualitativo
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Comentários construtivos, pontos fortes e recomendações para os autores (opcional).
            </p>
            <Textarea
              id="parecer"
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              maxLength={3000}
              rows={4}
              placeholder="Descreva observações sobre a pesquisa, metodologia, postura do apresentador, etc."
              className="mt-3 rounded-2xl resize-y"
            />
            <p className="mt-1.5 text-right text-xs text-muted-foreground">{parecer.length}/3000</p>
          </div>

          {/* Barra Fixa Inferior de Envio */}
          <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-3xl border bg-card/95 p-4 shadow-lift backdrop-blur">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Média Geral dos 4 Critérios
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-primary">
                  {formatarNota(media)}
                </span>
                <span className="text-xs text-muted-foreground">/ 10.0</span>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-12 rounded-2xl px-7 text-base font-semibold shadow-md"
              disabled={estado !== "idle"}
            >
              {estado === "enviando" ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Salvando…
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" />
                  {ex ? "Atualizar Avaliação" : "Finalizar Avaliação"}
                </>
              )}
            </Button>
          </div>
        </form>
      </main>

      {/* Modal / Feedback de Sucesso */}
      {estado === "sucesso" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 backdrop-blur-sm" role="status">
          <div className="mx-5 flex max-w-sm flex-col items-center rounded-3xl bg-card p-8 text-center shadow-lift animate-rise">
            <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="size-9" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">Avaliação Gravada!</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A avaliação de <strong>{trabalho.codigo_trabalho}</strong> foi registrada com sucesso sob o avaliador{" "}
              <strong>{nomeAvaliadorEfetivo}</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
