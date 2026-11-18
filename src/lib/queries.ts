import { queryOptions } from "@tanstack/react-query";
import { carregarFicha, carregarPainel, listarAvaliadores } from "./jornada.functions";

export const avaliadoresQuery = () =>
  queryOptions({ queryKey: ["avaliadores"], queryFn: () => listarAvaliadores() });

export const painelQuery = (avaliadorId: string, nome?: string) =>
  queryOptions({
    queryKey: ["painel", avaliadorId, nome],
    queryFn: () => carregarPainel({ data: { avaliadorId, nome } }),
  });

export const fichaQuery = (avaliadorId: string, trabalhoId: string, nome?: string) =>
  queryOptions({
    queryKey: ["ficha", avaliadorId, trabalhoId, nome],
    queryFn: () => carregarFicha({ data: { avaliadorId, trabalhoId, nome } }),
  });
