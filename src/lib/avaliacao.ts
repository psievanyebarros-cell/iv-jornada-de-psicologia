import { z } from "zod";

export const CATEGORIAS = [
  "Resumo Simples",
  "Resumo Expandido",
  "Oficina / Minicurso / Roda de Conversa",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const CRITERIOS = [
  {
    codigo: "C1",
    key: "nota_c1",
    label: "C1 · Qualidade técnico-científica do trabalho",
    tituloCurto: "Qualidade técnico-científica",
    descricao:
      "Avaliar a consistência científica e o rigor metodológico, considerando a coerência entre título, objetivos, métodos, resultados e conclusão.",
  },
  {
    codigo: "C2",
    key: "nota_c2",
    label: "C2 · Domínio de conteúdo, vocabulário e postura",
    tituloCurto: "Domínio de conteúdo, vocabulário e postura",
    descricao:
      "Avaliar o conhecimento demonstrado, uso de terminologia técnica e postura profissional durante a exposição e arguição.",
  },
  {
    codigo: "C3",
    key: "nota_c3",
    label: "C3 · Qualidade visual da apresentação",
    tituloCurto: "Qualidade visual da apresentação",
    descricao:
      "Avaliar a organização estética, legibilidade e capacidade de síntese dos materiais visuais.",
  },
  {
    codigo: "C4",
    key: "nota_c4",
    label: "C4 · Uso adequado do tempo",
    tituloCurto: "Uso adequado do tempo",
    descricao: "Avaliar se o apresentador utilizou o tempo regulamentar de forma adequada.",
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
  avaliadorId: z.string().min(1),
  trabalhoId: z.string().min(1),
  nomeAvaliador: z.string().trim().optional(),
  nota_c1: nota.optional(),
  nota_c2: nota.optional(),
  nota_c3: nota.optional(),
  nota_c4: nota.optional(),
  // Compatibilidade com colunas do banco original
  nota_conteudo: nota.optional(),
  nota_apresentacao: nota.optional(),
  nota_dominio: nota.optional(),
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
  grupo_numero?: number | undefined;
  grupo_tema?: string | undefined;
  data_sessao?: string | undefined;
  sala?: string | undefined;
  horario?: string | undefined;
  autores_completos?: string | undefined;
};

export type Avaliacao = {
  id: string;
  avaliador_id: string;
  trabalho_id: string;
  nome_avaliador?: string | undefined;
  nota_conteudo: number;
  nota_apresentacao: number;
  nota_dominio: number;
  nota_c1?: number;
  nota_c2?: number;
  nota_c3?: number;
  nota_c4?: number;
  observacoes_parecer: string | null;
  data_envio: string;
};

export function arredonda(n: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

export function mediaAvaliacao(a: {
  nota_c1?: number;
  nota_c2?: number;
  nota_c3?: number;
  nota_c4?: number;
  nota_conteudo?: number;
  nota_apresentacao?: number;
  nota_dominio?: number;
}): number {
  if (
    a.nota_c1 !== undefined &&
    a.nota_c2 !== undefined &&
    a.nota_c3 !== undefined &&
    a.nota_c4 !== undefined
  ) {
    return arredonda((Number(a.nota_c1) + Number(a.nota_c2) + Number(a.nota_c3) + Number(a.nota_c4)) / 4);
  }
  return arredonda(
    (Number(a.nota_conteudo ?? 0) + Number(a.nota_apresentacao ?? 0) + Number(a.nota_dominio ?? 0)) / 3
  );
}

export function empacotarParecer(
  notas: { c1: number; c2: number; c3: number; c4: number },
  nomeAvaliador?: string,
  parecerTexto?: string
): string {
  const tags: string[] = [];
  if (nomeAvaliador?.trim()) {
    tags.push(`[Avaliador: ${nomeAvaliador.trim()}]`);
  }
  tags.push(
    `[Critérios: C1: ${formatarNota(notas.c1)} | C2: ${formatarNota(notas.c2)} | C3: ${formatarNota(notas.c3)} | C4: ${formatarNota(notas.c4)}]`
  );
  const texto = (parecerTexto ?? "").trim();
  return tags.join(" ") + (texto ? `\n\n${texto}` : "");
}

export function desempacotarAvaliacao(av: Avaliacao | null | undefined): {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  parecer: string;
  nomeAvaliador?: string | undefined;
} {
  if (!av) return { c1: "", c2: "", c3: "", c4: "", parecer: "" };
  let parecer = av.observacoes_parecer ?? "";
  let c1 = av.nota_conteudo !== null && av.nota_conteudo !== undefined ? String(av.nota_conteudo) : "";
  let c2 = av.nota_dominio !== null && av.nota_dominio !== undefined ? String(av.nota_dominio) : "";
  let c3 = av.nota_apresentacao !== null && av.nota_apresentacao !== undefined ? String(av.nota_apresentacao) : "";
  let c4 = av.nota_apresentacao !== null && av.nota_apresentacao !== undefined ? String(av.nota_apresentacao) : "";
  let nomeAvaliador: string | undefined = av.nome_avaliador;

  const matchNome = parecer.match(/\[Avaliador:\s*([^\]]+)\]/);
  if (matchNome) {
    nomeAvaliador = (matchNome[1] ?? "").trim();
    parecer = parecer.replace(/\[Avaliador:\s*([^\]]+)\]/, "").trim();
  }

  const matchC = parecer.match(
    /\[Critérios:\s*C1:\s*([\d,\.]+)\s*\|\s*C2:\s*([\d,\.]+)\s*\|\s*C3:\s*([\d,\.]+)\s*\|\s*C4:\s*([\d,\.]+)\]/
  );
  if (matchC) {
    c1 = (matchC[1] ?? "").replace(",", ".");
    c2 = (matchC[2] ?? "").replace(",", ".");
    c3 = (matchC[3] ?? "").replace(",", ".");
    c4 = (matchC[4] ?? "").replace(",", ".");
    parecer = parecer.replace(/\[Critérios:[^\]]+\]/, "").trim();
  }

  return { c1, c2, c3, c4, parecer, nomeAvaliador };
}

export type ResumoTrabalho = Trabalho & {
  total_avaliacoes: number;
  media_conteudo: number | null;
  media_apresentacao: number | null;
  media_dominio: number | null;
  media_c1?: number | null;
  media_c2?: number | null;
  media_c3?: number | null;
  media_c4?: number | null;
  media_final: number | null;
};

export function consolidar(trabalhos: Trabalho[], avaliacoes: Avaliacao[]): ResumoTrabalho[] {
  return trabalhos.map((t) => {
    const lista = avaliacoes.filter((a) => a.trabalho_id === t.id);
    const n = lista.length;
    const med = (k: "nota_conteudo" | "nota_apresentacao" | "nota_dominio") =>
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
      "Média C1 (Científico)",
      "Média C2 (Domínio)",
      "Média C3 (Visual/Apres)",
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
      r.media_dominio,
      r.media_apresentacao,
      r.media_final,
    ])
  );
}

export function csvDetalhado(
  avaliacoes: Avaliacao[],
  trabalhos: Trabalho[],
  avaliadores: Avaliador[]
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
      "Nota C1 (Científico)",
      "Nota C2 (Domínio)",
      "Nota C3 (Visual)",
      "Nota C4 (Tempo)",
      "Média",
      "Observações / Parecer",
    ],
    avaliacoes.map((a) => {
      const tr = t.get(a.trabalho_id);
      const dec = desempacotarAvaliacao(a);
      const nomeAv = dec.nomeAvaliador || p.get(a.avaliador_id)?.nome || "Avaliador";
      return [
        formatarData(a.data_envio),
        nomeAv,
        tr?.codigo_trabalho ?? "",
        tr?.titulo ?? "",
        tr?.categoria ?? "",
        tr?.local_apresentacao ?? "",
        dec.c1 || Number(a.nota_conteudo),
        dec.c2 || Number(a.nota_dominio),
        dec.c3 || Number(a.nota_apresentacao),
        dec.c4 || "",
        mediaAvaliacao(a),
        dec.parecer,
      ];
    })
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
