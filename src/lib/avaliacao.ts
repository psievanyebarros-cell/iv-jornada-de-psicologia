import { z } from "zod";

export const CATEGORIAS = [
  "Resumo Simples",
  "Resumo Expandido",
  "Oficina / Minicurso / Roda de Conversa",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const CRITERIOS = [
  {
    key: "nota_conteudo",
    label: "Conteúdo",
    descricao: "Relevância, fundamentação teórica e rigor metodológico.",
  },
  {
    key: "nota_apresentacao",
    label: "Apresentação",
    descricao: "Clareza, organização, recursos visuais e uso do tempo.",
  },
  {
    key: "nota_dominio",
    label: "Domínio do tema",
    descricao: "Segurança na exposição e respostas às perguntas.",
  },
] as const;
export type CriterioKey = (typeof CRITERIOS)[number]["key"];

export const NOTA_MIN = 0;
export const NOTA_MAX = 10;

const nota = z.coerce
  .number({ invalid_type_error: "Informe uma nota" })
  .min(NOTA_MIN, "A nota mínima é 0")
  .max(NOTA_MAX, "A nota máxima é 10")
  .refine((n) => Math.round(n * 10) === n * 10, "Use no máximo uma casa decimal");

export const avaliacaoSchema = z.object({
  avaliadorId: z.string().uuid(),
  trabalhoId: z.string().uuid(),
  nota_conteudo: nota,
  nota_apresentacao: nota,
  nota_dominio: nota,
  observacoes_parecer: z.string().trim().max(3000, "Máximo de 3000 caracteres").optional().default(""),
});
export type AvaliacaoInput = z.infer<typeof avaliacaoSchema>;

export type Avaliador = { id: string; nome: string };
export type Trabalho = {
  id: string;
  codigo_trabalho: string;
  titulo: string;
  autor_principal: string;
  categoria: string;
  local_apresentacao: string;
};
export type Avaliacao = {
  id: string;
  avaliador_id: string;
  trabalho_id: string;
  nota_conteudo: number;
  nota_apresentacao: number;
  nota_dominio: number;
  observacoes_parecer: string | null;
  data_envio: string;
};

export function mediaAvaliacao(a: Pick<Avaliacao, CriterioKey>): number {
  return arredonda((Number(a.nota_conteudo) + Number(a.nota_apresentacao) + Number(a.nota_dominio)) / 3);
}

function arredonda(n: number, casas = 2) {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

export type ResumoTrabalho = Trabalho & {
  total_avaliacoes: number;
  media_conteudo: number | null;
  media_apresentacao: number | null;
  media_dominio: number | null;
  media_final: number | null;
};

export function consolidar(trabalhos: Trabalho[], avaliacoes: Avaliacao[]): ResumoTrabalho[] {
  return trabalhos.map((t) => {
    const lista = avaliacoes.filter((a) => a.trabalho_id === t.id);
    const n = lista.length;
    const med = (k: CriterioKey) =>
      n ? arredonda(lista.reduce((s, a) => s + Number(a[k]), 0) / n) : null;
    return {
      ...t,
      total_avaliacoes: n,
      media_conteudo: med("nota_conteudo"),
      media_apresentacao: med("nota_apresentacao"),
      media_dominio: med("nota_dominio"),
      media_final: n ? arredonda(lista.reduce((s, a) => s + mediaAvaliacao(a), 0) / n) : null,
    };
  });
}

/** Local padrão sugerido por categoria. */
export function localPadrao(categoria: string): string {
  return categoria === "Resumo Simples" ? "Hall de Entrada" : "Sala";
}

// ---------- CSV (Excel pt-BR e Google Planilhas) ----------

const SEP = ";";

function celula(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(cabecalho: string[], linhas: unknown[][]): string {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(celula).join(SEP)).join("\r\n");
  return "\uFEFF" + corpo; // BOM para acentuação correta no Excel
}

export function csvConsolidado(resumo: ResumoTrabalho[]): string {
  return toCsv(
    [
      "Código",
      "Título",
      "Autor principal",
      "Categoria",
      "Local",
      "Nº de avaliações",
      "Média conteúdo",
      "Média apresentação",
      "Média domínio",
      "Média final",
    ],
    resumo.map((r) => [
      r.codigo_trabalho,
      r.titulo,
      r.autor_principal,
      r.categoria,
      r.local_apresentacao,
      r.total_avaliacoes,
      r.media_conteudo,
      r.media_apresentacao,
      r.media_dominio,
      r.media_final,
    ]),
  );
}

export function csvDetalhado(
  avaliacoes: Avaliacao[],
  trabalhos: Trabalho[],
  avaliadores: Avaliador[],
): string {
  const t = new Map(trabalhos.map((x) => [x.id, x]));
  const p = new Map(avaliadores.map((x) => [x.id, x]));
  return toCsv(
    [
      "Data de envio",
      "Avaliador",
      "Código",
      "Título",
      "Categoria",
      "Local",
      "Nota conteúdo",
      "Nota apresentação",
      "Nota domínio",
      "Média",
      "Observações / Parecer",
    ],
    avaliacoes.map((a) => {
      const tr = t.get(a.trabalho_id);
      return [
        formatarData(a.data_envio),
        p.get(a.avaliador_id)?.nome ?? "",
        tr?.codigo_trabalho ?? "",
        tr?.titulo ?? "",
        tr?.categoria ?? "",
        tr?.local_apresentacao ?? "",
        Number(a.nota_conteudo),
        Number(a.nota_apresentacao),
        Number(a.nota_dominio),
        mediaAvaliacao(a),
        a.observacoes_parecer ?? "",
      ];
    }),
  );
}

export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(iso));
}

export function formatarNota(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
