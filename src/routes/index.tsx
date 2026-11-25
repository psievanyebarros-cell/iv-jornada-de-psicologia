import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ClipboardCheck, Loader2, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { identificarAvaliador } from "@/lib/jornada.functions";
import { toast } from "sonner";
import { lerPreferencia, salvarPreferencia } from "@/lib/browser-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avaliação de Trabalhos · IV Jornada de Psicologia" },
      {
        name: "description",
        content:
          "Digite seu nome completo e avalie os trabalhos da IV Jornada Acadêmica de Psicologia — 17 a 19 de novembro.",
      },
      { property: "og:title", content: "Avaliação de Trabalhos · IV Jornada de Psicologia" },
      {
        property: "og:description",
        content: "Digite seu nome e avalie os trabalhos da IV Jornada Acadêmica de Psicologia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inicio,
});

const KEY_NOME = "jornada:avaliador-nome";
const KEY_ID = "jornada:avaliador-id";

function Inicio() {
  const nomeInput = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();
  const identificar = useServerFn(identificarAvaliador);

  useEffect(() => {
    const salvo = lerPreferencia("localStorage", KEY_NOME);
    if (salvo && nomeInput.current && !nomeInput.current.value) nomeInput.current.value = salvo;
  }, []);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    const nomeLimpo = String(new FormData(e.currentTarget).get("nome") ?? "").trim();
    if (nomeLimpo.length < 3) {
      toast.error("Por favor, digite o seu nome completo para continuar.");
      return;
    }

    setCarregando(true);
    try {
      const res = await identificar({ data: { nome: nomeLimpo } });
      salvarPreferencia("localStorage", KEY_NOME, nomeLimpo);
      salvarPreferencia("localStorage", KEY_ID, res.id);

      navigate({
        to: "/avaliador/$avaliadorId",
        params: { avaliadorId: res.id },
      });
    } catch (err) {
      setCarregando(false);
      toast.error("Erro ao iniciar. Tente novamente.");
    }
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
          <img
            src="/logo-jornada.png"
            alt="Logo da IV Jornada de Psicologia"
            className="h-16 w-16 sm:h-20 sm:w-20 object-contain mix-blend-screen opacity-95"
          />
          <h1 className="mt-6 font-display leading-none">
            <span className="block text-4xl tracking-wide sm:text-6xl">IV JORNADA DE</span>
            <span className="-mt-1 block text-6xl italic sm:text-8xl">psicologia</span>
          </h1>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="pill-navy">Mostra de Painéis</span>
            <span className="pill-sky">Resumos Expandidos</span>
            <span className="pill-navy">Ciência & Prática</span>
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
              <p className="text-sm text-muted-foreground">Identificação do professor ou avaliador convidado</p>
            </div>
          </div>

          <form onSubmit={entrar} className="mt-7 space-y-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium">
                Digite seu Nome Completo
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Seu nome será registrado como o avaliador responsável pelas notas atribuídas.
              </p>
              <div className="relative mt-2">
                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="nome"
                  name="nome"
                  ref={nomeInput}
                  type="text"
                  required
                  minLength={3}
                  autoComplete="name"
                  placeholder="Ex.: Profa. Dra. Maria Silva ou Prof. João Pedro"
                  className="h-12 rounded-xl pl-10 text-base"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-6 h-12 w-full rounded-xl text-base"
              disabled={carregando}
            >
              {carregando ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Entrando no sistema…
                </>
              ) : (
                <>
                  Acessar Painel de Avaliações <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dúvidas sobre a escala de avaliação? Procure a comissão organizadora da jornada.
        </p>
      </main>
    </div>
  );
}
