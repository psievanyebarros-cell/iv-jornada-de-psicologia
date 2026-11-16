import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { avaliadoresQuery } from "@/lib/queries";
import ornamento from "@/assets/ornamento-jornada.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avaliação de Trabalhos · IV Jornada de Psicologia" },
      { name: "description", content: "Selecione seu nome e avalie os trabalhos da IV Jornada Acadêmica de Psicologia — 17 a 19 de novembro." },
      { property: "og:title", content: "Avaliação de Trabalhos · IV Jornada de Psicologia" },
      { property: "og:description", content: "Selecione seu nome e avalie os trabalhos da IV Jornada Acadêmica de Psicologia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(avaliadoresQuery()),
  component: Inicio,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Nada encontrado.</div>,
});

const ULTIMO = "jornada:ultimo-avaliador";

function Inicio() {
  const { data: avaliadores } = useSuspenseQuery(avaliadoresQuery());
  const [selecionado, setSelecionado] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const salvo = localStorage.getItem(ULTIMO);
    if (salvo && avaliadores.some((a) => a.id === salvo)) setSelecionado(salvo);
  }, [avaliadores]);

  function comecar() {
    if (!selecionado) return;
    localStorage.setItem(ULTIMO, selecionado);
    navigate({ to: "/avaliador/$avaliadorId", params: { avaliadorId: selecionado } });
  }

  return (
    <div className="min-h-screen">
      <section className="brand-band relative overflow-hidden pb-40 pt-10">
        <div className="mx-auto flex max-w-6xl justify-end px-5 sm:px-8">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/30 px-3 py-1.5 text-xs font-medium text-primary-foreground/90 transition hover:bg-primary-foreground/10"
          >
            <ShieldCheck className="size-3.5" /> Administração
          </Link>
        </div>
        <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center px-5 text-center animate-rise">
          <img src={ornamento.url} alt="Ornamento da IV Jornada de Psicologia" className="w-64 sm:w-80" />
          <h1 className="mt-8 font-display leading-none">
            <span className="block text-4xl tracking-wide sm:text-6xl">IV JORNADA DE</span>
            <span className="-mt-1 block text-6xl italic sm:text-8xl">psicologia</span>
          </h1>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="pill-navy">Submissões</span>
            <span className="pill-sky">Palestras</span>
            <span className="pill-navy">Ciência</span>
          </div>
          <p className="mt-5 text-sm tracking-wide text-primary-foreground/85">
            17 A 19 DE <strong className="font-semibold">NOVEMBRO</strong> · CEUMA Universidade
          </p>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-28 max-w-xl px-5 pb-16">
        <div className="rounded-3xl border bg-card p-6 shadow-lift sm:p-8 animate-rise">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl">Sistema de Avaliação</h2>
              <p className="text-sm text-muted-foreground">Trabalhos científicos e atividades do evento</p>
            </div>
          </div>

          <label htmlFor="avaliador" className="mt-7 block text-sm font-medium">
            Selecione o seu nome
          </label>
          <Select value={selecionado} onValueChange={setSelecionado}>
            <SelectTrigger id="avaliador" className="mt-2 h-12 rounded-xl text-base">
              <SelectValue placeholder="Escolha o avaliador…" />
            </SelectTrigger>
            <SelectContent>
              {avaliadores.map((a) => (
                <SelectItem key={a.id} value={a.id} className="py-2.5 text-base">
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {avaliadores.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum avaliador cadastrado ainda.</p>
          )}

          <Button size="lg" className="mt-6 h-12 w-full rounded-xl text-base" disabled={!selecionado} onClick={comecar}>
            Começar avaliações <ArrowRight className="size-4" />
          </Button>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Não encontrou seu nome? Procure a comissão organizadora.
        </p>
      </main>
    </div>
  );
}
