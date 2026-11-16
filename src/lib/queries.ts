import { queryOptions } from "@tanstack/react-query";
import { carregarFicha, carregarPainel, listarAvaliadores } from "./jornada.functions";

export const avaliadoresQuery = () =>
  queryOptions({ queryKey: ["avaliadores"], queryFn: () => listarAvaliadores() });

export const painelQuery = (avaliadorId: string) =>
  queryOptions({
    queryKey: ["painel", avaliadorId],
    queryFn: () => carregarPainel({ data: { avaliadorId } }),
  });

export const fichaQuery = (avaliadorId: string, trabalhoId: string) =>
  queryOptions({
    queryKey: ["ficha", avaliadorId, trabalhoId],
    queryFn: () => carregarFicha({ data: { avaliadorId, trabalhoId } }),
  });
