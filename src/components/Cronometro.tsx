import { useEffect, useState } from "react";
import { Clock, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CronometroProps {
  tempoSugeridoMinutos?: number;
}

export function Cronometro({ tempoSugeridoMinutos = 10 }: CronometroProps) {
  const [segundos, setSegundos] = useState(0);
  const [ativo, setAtivo] = useState(false);
  const [modoRegressivo, setModoRegressivo] = useState(false);
  const [tempoTotalSegundos, setTempoTotalSegundos] = useState(tempoSugeridoMinutos * 60);

  useEffect(() => {
    let intervalo: NodeJS.Timeout | null = null;
    if (ativo) {
      intervalo = setInterval(() => {
        setSegundos((s) => {
          if (modoRegressivo) {
            if (s <= 1) {
              setAtivo(false);
              return 0;
            }
            return s - 1;
          }
          return s + 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalo) clearInterval(intervalo);
    };
  }, [ativo, modoRegressivo]);

  function alternar() {
    if (!ativo && modoRegressivo && segundos === 0) {
      setSegundos(tempoTotalSegundos);
    }
    setAtivo(!ativo);
  }

  function zerar() {
    setAtivo(false);
    setSegundos(modoRegressivo ? tempoTotalSegundos : 0);
  }

  function selecionarModo(regressivo: boolean, minutos: number) {
    setAtivo(false);
    setModoRegressivo(regressivo);
    const secs = minutos * 60;
    setTempoTotalSegundos(secs);
    setSegundos(regressivo ? secs : 0);
  }

  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  const formatado = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const estourado = modoRegressivo ? segundos === 0 && !ativo : segundos > tempoTotalSegundos;
  const aviso = modoRegressivo ? segundos > 0 && segundos <= 120 : segundos >= tempoTotalSegundos - 120;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`grid size-11 place-items-center rounded-xl transition-colors ${
            estourado
              ? "bg-destructive/15 text-destructive"
              : aviso
                ? "bg-amber-500/15 text-amber-600"
                : ativo
                  ? "bg-primary-soft text-primary animate-pulse"
                  : "bg-muted text-muted-foreground"
          }`}
        >
          <Clock className="size-5" />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-3xl font-bold tracking-tight transition-colors ${
                estourado ? "text-destructive" : aviso ? "text-amber-600" : "text-foreground"
              }`}
            >
              {formatado}
            </span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {modoRegressivo ? "Regressivo" : "Decorrido"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {estourado
              ? "Tempo regulamentar esgotado!"
              : aviso
                ? "Restam menos de 2 minutos!"
                : `Tempo sugerido: ${tempoSugeridoMinutos} min`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => selecionarModo(false, tempoSugeridoMinutos)}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              !modoRegressivo ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Livre
          </button>
          <button
            type="button"
            onClick={() => selecionarModo(true, 10)}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              modoRegressivo && tempoTotalSegundos === 600
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            10 min
          </button>
          <button
            type="button"
            onClick={() => selecionarModo(true, 15)}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              modoRegressivo && tempoTotalSegundos === 900
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            15 min
          </button>
        </div>

        <Button
          type="button"
          size="sm"
          variant={ativo ? "secondary" : "default"}
          onClick={alternar}
          className="gap-1.5 rounded-xl font-medium"
        >
          {ativo ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {ativo ? "Pausar" : "Iniciar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={zerar}
          className="rounded-xl px-2.5 text-muted-foreground hover:text-foreground"
          title="Zerar cronômetro"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

