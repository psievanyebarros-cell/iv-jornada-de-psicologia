import { describe, expect, it } from "vitest";
import { avaliacaoSchema, consolidar, csvConsolidado, mediaAvaliacao, toCsv } from "./avaliacao";

const ids = {
  avaliadorId: "11111111-1111-4111-8111-111111111111",
  trabalhoId: "22222222-2222-4222-8222-222222222222",
};

describe("notas de 0 a 10", () => {
  it("aceita 0 e 10", () => {
    const r = avaliacaoSchema.safeParse({ ...ids, nota_conteudo: 0, nota_apresentacao: 10, nota_dominio: 7.5 });
    expect(r.success).toBe(true);
  });
  it("rejeita nota acima de 10", () => {
    const r = avaliacaoSchema.safeParse({ ...ids, nota_conteudo: 10.5, nota_apresentacao: 8, nota_dominio: 8 });
    expect(r.success).toBe(false);
  });
  it("rejeita nota negativa", () => {
    const r = avaliacaoSchema.safeParse({ ...ids, nota_conteudo: -1, nota_apresentacao: 8, nota_dominio: 8 });
    expect(r.success).toBe(false);
  });
});

describe("média", () => {
  it("é a média simples dos três critérios", () => {
    expect(mediaAvaliacao({ nota_conteudo: 9, nota_apresentacao: 8, nota_dominio: 7 })).toBe(8);
  });
  it("consolida a média final entre avaliadores", () => {
    const t = { id: "t1", codigo_trabalho: "TS-01", titulo: "x", autor_principal: "y", categoria: "Resumo Simples", local_apresentacao: "Hall de Entrada" };
    const base = { avaliador_id: "a", trabalho_id: "t1", observacoes_parecer: null, data_envio: "2026-11-17T12:00:00Z" };
    const [r] = consolidar([t], [
      { ...base, id: "1", nota_conteudo: 10, nota_apresentacao: 10, nota_dominio: 10 },
      { ...base, id: "2", nota_conteudo: 6, nota_apresentacao: 6, nota_dominio: 6 },
    ]);
    expect(r.total_avaliacoes).toBe(2);
    expect(r.media_final).toBe(8);
  });
});

describe("CSV", () => {
  it("usa ponto e vírgula, vírgula decimal e escapa aspas", () => {
    const csv = toCsv(["a", "b"], [[7.5, 'diz "oi"; tchau']]);
    expect(csv).toBe('\uFEFFa;b\r\n7,5;"diz ""oi""; tchau"');
  });
  it("traz cabeçalho do consolidado", () => {
    expect(csvConsolidado([]).startsWith("\uFEFFCódigo;Título")).toBe(true);
  });
});
