import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  avaliacaoSchema,
  CATEGORIAS,
  arredonda,
  empacotarParecer,
  type Avaliacao,
  type Avaliador,
  type Trabalho,
} from "./avaliacao";
import { adminClient, verificarSenhaAdmin } from "./jornada.server";
import { TRABALHOS_OFICIAIS, type TrabalhoOficial } from "./dados-oficiais";

const TRAB_COLS = "id, codigo_trabalho, titulo, autor_principal, categoria, local_apresentacao";
const AVAL_COLS =
  "id, avaliador_id, trabalho_id, nota_conteudo, nota_apresentacao, nota_dominio, observacoes_parecer, data_envio";

function falha(msg: string, error: unknown): never {
  console.error(msg, error);
  throw new Error(msg);
}

export function gerarIdAvaliador(nome: string): string {
  // Gera hash hexadecimal de 32 caracteres a partir do nome
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const str = nome.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
  const part4 = ((h1 + h2) >>> 0).toString(16).padStart(8, "0");
  const hex = (part1 + part2 + part3 + part4).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function mesclarTrabalhos(trabalhosDoBanco: Trabalho[]): Trabalho[] {
  const mapa = new Map<string, Trabalho>();

  for (const t of TRABALHOS_OFICIAIS) {
    mapa.set(t.codigo_trabalho.toUpperCase(), {
      id: t.id,
      codigo_trabalho: t.codigo_trabalho,
      titulo: t.titulo,
      autor_principal: t.autor_principal,
      categoria: t.categoria,
      local_apresentacao: t.local_apresentacao,
      grupo_numero: t.grupo_numero,
      grupo_tema: t.grupo_tema,
      data_sessao: t.data_sessao,
      sala: t.sala,
      horario: t.horario,
      autores_completos: t.autores_completos,
    });
  }

  for (const b of trabalhosDoBanco) {
    const cod = b.codigo_trabalho?.toUpperCase();
    if (cod && mapa.has(cod)) {
      const exist = mapa.get(cod)!;
      mapa.set(cod, {
        ...exist,
        id: b.id, // vincula com o ID do banco quando disponível
      });
    } else {
      mapa.set(b.id, b);
    }
  }

  return Array.from(mapa.values());
}

export const listarAvaliadores = createServerFn({ method: "GET" }).handler(
  async (): Promise<Avaliador[]> => {
    try {
      const { data } = await (
        await adminClient()
      )
        .from("avaliadores")
        .select("id, nome")
        .order("nome");
      return data ?? [];
    } catch {
      return [];
    }
  },
);

export const identificarAvaliador = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ nome: z.string().trim().min(2, "Digite seu nome completo") }).parse(d),
  )
  .handler(async ({ data }): Promise<Avaliador> => {
    const nomeLimpo = data.nome.trim();
    const pub = await adminClient();

    try {
      const { data: existente } = await pub
        .from("avaliadores")
        .select("id, nome")
        .ilike("nome", nomeLimpo)
        .maybeSingle();

      if (existente) return existente as Avaliador;
    } catch {
      // continua
    }

    try {
      const admin = await adminClient();
      const ins = await admin
        .from("avaliadores")
        .insert({ nome: nomeLimpo })
        .select("id, nome")
        .maybeSingle();
      if (ins?.data) return ins.data as Avaliador;
    } catch {
      // Ignora erro de permissão RLS local
    }

    return {
      id: gerarIdAvaliador(nomeLimpo),
      nome: nomeLimpo,
    };
  });

export const carregarPainel = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ avaliadorId: z.string().min(1), nome: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const pub = await adminClient();
    let avaliador: Avaliador | null = null;

    try {
      const av = await pub
        .from("avaliadores")
        .select("id, nome")
        .eq("id", data.avaliadorId)
        .maybeSingle();
      if (av.data) avaliador = av.data as Avaliador;
    } catch {
      // continua
    }

    if (!avaliador) {
      avaliador = {
        id: data.avaliadorId,
        nome: data.nome || "Avaliador",
      };
    }

    let trabalhosDb: Trabalho[] = [];
    try {
      const tr = await pub.from("trabalhos").select(TRAB_COLS).order("codigo_trabalho");
      trabalhosDb = (tr.data ?? []) as Trabalho[];
    } catch {
      // continua
    }

    const todosTrabalhos = mesclarTrabalhos(trabalhosDb);

    let avaliadosPorMim: string[] = [];
    const contagemPorTrabalho: Record<string, number> = {};

    try {
      const admin = await adminClient();
      const [feitas, todas] = await Promise.all([
        admin.from("avaliacoes").select("trabalho_id").eq("avaliador_id", data.avaliadorId),
        admin.from("avaliacoes").select("trabalho_id, avaliador_id"),
      ]);

      if (feitas.data) {
        avaliadosPorMim = feitas.data.map((r) => r.trabalho_id);
      }
      if (todas.data) {
        for (const a of todas.data) {
          contagemPorTrabalho[a.trabalho_id] = (contagemPorTrabalho[a.trabalho_id] ?? 0) + 1;
        }
      }
    } catch {
      // fallback
    }

    return {
      avaliador,
      trabalhos: todosTrabalhos,
      avaliados: avaliadosPorMim,
      contagemAvaliacoes: contagemPorTrabalho,
    };
  });

export const carregarFicha = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z
      .object({
        avaliadorId: z.string().min(1),
        trabalhoId: z.string().min(1),
        nome: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const pub = await adminClient();

    let avaliador: Avaliador = {
      id: data.avaliadorId,
      nome: data.nome || "Avaliador",
    };

    try {
      const av = await pub
        .from("avaliadores")
        .select("id, nome")
        .eq("id", data.avaliadorId)
        .maybeSingle();
      if (av.data) avaliador = av.data as Avaliador;
    } catch {
      // continua
    }

    let trabalho: Trabalho | undefined;
    try {
      const tr = await pub
        .from("trabalhos")
        .select(TRAB_COLS)
        .eq("id", data.trabalhoId)
        .maybeSingle();
      if (tr.data) {
        const codigo = tr.data.codigo_trabalho;
        const oficial = TRABALHOS_OFICIAIS.find((t) => t.codigo_trabalho === codigo);
        trabalho = {
          ...(tr.data as Trabalho),
          grupo_numero: oficial?.grupo_numero,
          grupo_tema: oficial?.grupo_tema,
          data_sessao: oficial?.data_sessao,
          sala: oficial?.sala,
          horario: oficial?.horario,
          autores_completos: oficial?.autores_completos,
        };
      }
    } catch {
      // continua
    }

    if (!trabalho) {
      const of = TRABALHOS_OFICIAIS.find(
        (t) =>
          t.id === data.trabalhoId ||
          t.codigo_trabalho.toLowerCase() === data.trabalhoId.toLowerCase(),
      );
      if (of) {
        trabalho = {
          id: of.id,
          codigo_trabalho: of.codigo_trabalho,
          titulo: of.titulo,
          autor_principal: of.autor_principal,
          categoria: of.categoria,
          local_apresentacao: of.local_apresentacao,
          grupo_numero: of.grupo_numero,
          grupo_tema: of.grupo_tema,
          data_sessao: of.data_sessao,
          sala: of.sala,
          horario: of.horario,
          autores_completos: of.autores_completos,
        };
      }
    }

    if (!trabalho) {
      trabalho = {
        id: data.trabalhoId,
        codigo_trabalho: data.trabalhoId.toUpperCase(),
        titulo: "Trabalho em Avaliação",
        autor_principal: "Autor",
        categoria: "Resumo Simples",
        local_apresentacao: "Hall de Entrada",
      };
    }

    let existente: Avaliacao | null = null;
    try {
      const admin = await adminClient();
      const ex = await admin
        .from("avaliacoes")
        .select(AVAL_COLS)
        .eq("avaliador_id", data.avaliadorId)
        .eq("trabalho_id", data.trabalhoId)
        .maybeSingle();

      if (ex.data) existente = ex.data as Avaliacao;
    } catch {
      // fallback
    }

    return {
      avaliador,
      trabalho,
      existente,
    };
  });

export const enviarAvaliacao = createServerFn({ method: "POST" })
  .validator((d: unknown) => avaliacaoSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await adminClient();

    const c1 = data.nota_c1 ?? data.nota_conteudo ?? 0;
    const c2 = data.nota_c2 ?? data.nota_dominio ?? 0;
    const c3 = data.nota_c3 ?? data.nota_apresentacao ?? 0;
    const c4 = data.nota_c4 ?? c3;

    const nota_apresentacao = arredonda((c3 + c4) / 2, 1);

    const observacoes = empacotarParecer(
      { c1, c2, c3, c4 },
      data.nomeAvaliador,
      data.observacoes_parecer,
    );

    let targetTrabalhoId = data.trabalhoId;
    const trOficial = TRABALHOS_OFICIAIS.find(
      (t) =>
        t.id === data.trabalhoId ||
        t.codigo_trabalho.toLowerCase() === data.trabalhoId.toLowerCase(),
    );

    if (trOficial) {
      try {
        const { data: trDb } = await admin
          .from("trabalhos")
          .select("id")
          .eq("codigo_trabalho", trOficial.codigo_trabalho)
          .maybeSingle();

        if (trDb?.id) {
          targetTrabalhoId = trDb.id;
        } else {
          const ins = await admin
            .from("trabalhos")
            .insert({
              codigo_trabalho: trOficial.codigo_trabalho,
              titulo: trOficial.titulo,
              autor_principal: trOficial.autor_principal,
              categoria: trOficial.categoria,
              local_apresentacao: trOficial.local_apresentacao,
            })
            .select("id")
            .maybeSingle();
          if (ins?.data?.id) targetTrabalhoId = ins.data.id;
        }
      } catch {
        // segue
      }
    }

    let targetAvaliadorId = data.avaliadorId;
    if (data.nomeAvaliador) {
      try {
        const { data: avDb } = await admin
          .from("avaliadores")
          .select("id")
          .ilike("nome", data.nomeAvaliador.trim())
          .maybeSingle();

        if (avDb?.id) {
          targetAvaliadorId = avDb.id;
        } else {
          const insAv = await admin
            .from("avaliadores")
            .insert({ nome: data.nomeAvaliador.trim() })
            .select("id")
            .maybeSingle();
          if (insAv?.data?.id) targetAvaliadorId = insAv.data.id;
        }
      } catch {
        // segue
      }
    }

    const { error } = await admin.from("avaliacoes").upsert(
      {
        avaliador_id: targetAvaliadorId,
        trabalho_id: targetTrabalhoId,
        nota_conteudo: c1,
        nota_apresentacao: nota_apresentacao,
        nota_dominio: c2,
        observacoes_parecer: observacoes,
        data_envio: new Date().toISOString(),
      },
      { onConflict: "avaliador_id,trabalho_id" },
    );

    // Nunca confirmar sucesso sem a nota gravada: o avaliador precisa saber para tentar de novo.
    if (error) falha("Não foi possível salvar a avaliação. Tente enviar novamente.", error);

    return { ok: true, avaliadorId: targetAvaliadorId, trabalhoId: targetTrabalhoId };
  });

// ---------------- Administração ----------------

const senha = z.string().min(1).max(200);

export const entrarAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ senha }).parse(d))
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    return { ok: true };
  });

export const dadosAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ senha }).parse(d))
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    const admin = await adminClient();
    const [av, tr, ac] = await Promise.all([
      admin.from("avaliadores").select("id, nome").order("nome"),
      admin.from("trabalhos").select(TRAB_COLS).order("codigo_trabalho"),
      admin
        .from("avaliacoes")
        .select(AVAL_COLS)
        .order("data_envio", { ascending: false })
        .limit(5000),
    ]);

    const trabalhosDb = (tr.data ?? []) as Trabalho[];
    const todosTrabalhos = mesclarTrabalhos(trabalhosDb);

    return {
      avaliadores: (av.data ?? []) as Avaliador[],
      trabalhos: todosTrabalhos,
      avaliacoes: (ac.data ?? []).map((a) => ({
        ...a,
        nota_conteudo: Number(a.nota_conteudo),
        nota_apresentacao: Number(a.nota_apresentacao),
        nota_dominio: Number(a.nota_dominio),
      })) as Avaliacao[],
    };
  });

export const adicionarAvaliador = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({ senha, nome: z.string().trim().min(3, "Informe o nome completo").max(150) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    const admin = await adminClient();
    const { error } = await admin.from("avaliadores").insert({ nome: data.nome });
    if (error)
      falha(
        error.code === "23505"
          ? "Esse avaliador já está cadastrado."
          : "Não foi possível cadastrar.",
        error,
      );
    return { ok: true };
  });

export const adicionarTrabalho = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        senha,
        codigo_trabalho: z.string().trim().min(1).max(20),
        titulo: z.string().trim().min(3).max(300),
        autor_principal: z.string().trim().min(3).max(150),
        categoria: z.enum(CATEGORIAS),
        local_apresentacao: z.string().trim().min(2).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    const { senha: _s, ...row } = data;
    const admin = await adminClient();
    const { error } = await admin
      .from("trabalhos")
      .insert({ ...row, codigo_trabalho: row.codigo_trabalho.toUpperCase() });
    if (error)
      falha(
        error.code === "23505"
          ? "Já existe um trabalho com esse código."
          : "Não foi possível cadastrar.",
        error,
      );
    return { ok: true };
  });

export const removerRegistro = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({ senha, tabela: z.enum(["avaliadores", "trabalhos", "avaliacoes"]), id: z.string() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    const admin = await adminClient();
    const { error } = await admin.from(data.tabela).delete().eq("id", data.id);
    if (error) falha("Não foi possível remover.", error);
    return { ok: true };
  });

export const atualizarAvaliacaoAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        senha,
        avaliacaoId: z.string().min(1),
        nota_c1: z.number().min(0).max(10),
        nota_c2: z.number().min(0).max(10),
        nota_c3: z.number().min(0).max(10),
        nota_c4: z.number().min(0).max(10),
        nomeAvaliador: z.string().optional(),
        observacoes_parecer: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    const admin = await adminClient();

    const c1 = data.nota_c1;
    const c2 = data.nota_c2;
    const c3 = data.nota_c3;
    const c4 = data.nota_c4;
    const nota_apresentacao = arredonda((c3 + c4) / 2, 1);

    const observacoes = empacotarParecer(
      { c1, c2, c3, c4 },
      data.nomeAvaliador,
      data.observacoes_parecer,
    );

    const { error } = await admin
      .from("avaliacoes")
      .update({
        nota_conteudo: c1,
        nota_dominio: c2,
        nota_apresentacao,
        observacoes_parecer: observacoes,
      })
      .eq("id", data.avaliacaoId);

    if (error) falha("Não foi possível atualizar a avaliação.", error);
    return { ok: true };
  });
