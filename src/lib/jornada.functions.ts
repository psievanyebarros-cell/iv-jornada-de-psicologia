import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { avaliacaoSchema, CATEGORIAS, type Avaliacao, type Avaliador, type Trabalho } from "./avaliacao";
import { adminClient, publicClient, verificarSenhaAdmin } from "./jornada.server";

const uuid = z.string().uuid();
const TRAB_COLS = "id, codigo_trabalho, titulo, autor_principal, categoria, local_apresentacao";
const AVAL_COLS =
  "id, avaliador_id, trabalho_id, nota_conteudo, nota_apresentacao, nota_dominio, observacoes_parecer, data_envio";

function falha(msg: string, error: unknown): never {
  console.error(msg, error);
  throw new Error(msg);
}

export const listarAvaliadores = createServerFn({ method: "GET" }).handler(async (): Promise<Avaliador[]> => {
  const { data, error } = await publicClient().from("avaliadores").select("id, nome").order("nome");
  if (error) falha("Não foi possível carregar os avaliadores.", error);
  return data ?? [];
});

export const carregarPainel = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ avaliadorId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const pub = publicClient();
    const [av, tr] = await Promise.all([
      pub.from("avaliadores").select("id, nome").eq("id", data.avaliadorId).maybeSingle(),
      pub.from("trabalhos").select(TRAB_COLS).order("codigo_trabalho"),
    ]);
    if (av.error || tr.error) falha("Não foi possível carregar o painel.", av.error ?? tr.error);
    if (!av.data) return null;
    const admin = await adminClient();
    const feitas = await admin
      .from("avaliacoes")
      .select("trabalho_id")
      .eq("avaliador_id", data.avaliadorId);
    if (feitas.error) falha("Não foi possível carregar suas avaliações.", feitas.error);
    return {
      avaliador: av.data as Avaliador,
      trabalhos: (tr.data ?? []) as Trabalho[],
      avaliados: (feitas.data ?? []).map((r) => r.trabalho_id),
    };
  });

export const carregarFicha = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ avaliadorId: uuid, trabalhoId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const pub = publicClient();
    const [av, tr] = await Promise.all([
      pub.from("avaliadores").select("id, nome").eq("id", data.avaliadorId).maybeSingle(),
      pub.from("trabalhos").select(TRAB_COLS).eq("id", data.trabalhoId).maybeSingle(),
    ]);
    if (av.error || tr.error) falha("Não foi possível carregar a ficha.", av.error ?? tr.error);
    if (!av.data || !tr.data) return null;
    const admin = await adminClient();
    const ex = await admin
      .from("avaliacoes")
      .select(AVAL_COLS)
      .eq("avaliador_id", data.avaliadorId)
      .eq("trabalho_id", data.trabalhoId)
      .maybeSingle();
    if (ex.error) falha("Não foi possível carregar a avaliação.", ex.error);
    return {
      avaliador: av.data as Avaliador,
      trabalho: tr.data as Trabalho,
      existente: (ex.data as Avaliacao | null) ?? null,
    };
  });

export const enviarAvaliacao = createServerFn({ method: "POST" })
  .validator((d: unknown) => avaliacaoSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await adminClient();
    const { error } = await admin.from("avaliacoes").upsert(
      {
        avaliador_id: data.avaliadorId,
        trabalho_id: data.trabalhoId,
        nota_conteudo: data.nota_conteudo,
        nota_apresentacao: data.nota_apresentacao,
        nota_dominio: data.nota_dominio,
        observacoes_parecer: data.observacoes_parecer || null,
        data_envio: new Date().toISOString(),
      },
      { onConflict: "avaliador_id,trabalho_id" },
    );
    if (error) falha("Não foi possível salvar a avaliação. Tente novamente.", error);
    return { ok: true };
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
      admin.from("avaliacoes").select(AVAL_COLS).order("data_envio", { ascending: false }).limit(5000),
    ]);
    if (av.error || tr.error || ac.error) falha("Não foi possível carregar os dados.", av.error ?? tr.error ?? ac.error);
    return {
      avaliadores: (av.data ?? []) as Avaliador[],
      trabalhos: (tr.data ?? []) as Trabalho[],
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
    z.object({ senha, nome: z.string().trim().min(3, "Informe o nome completo").max(150) }).parse(d),
  )
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    const admin = await adminClient();
    const { error } = await admin.from("avaliadores").insert({ nome: data.nome });
    if (error) falha(error.code === "23505" ? "Esse avaliador já está cadastrado." : "Não foi possível cadastrar.", error);
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
    const { error } = await admin.from("trabalhos").insert({ ...row, codigo_trabalho: row.codigo_trabalho.toUpperCase() });
    if (error) falha(error.code === "23505" ? "Já existe um trabalho com esse código." : "Não foi possível cadastrar.", error);
    return { ok: true };
  });

export const removerRegistro = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ senha, tabela: z.enum(["avaliadores", "trabalhos", "avaliacoes"]), id: uuid }).parse(d),
  )
  .handler(async ({ data }) => {
    verificarSenhaAdmin(data.senha);
    const admin = await adminClient();
    const { error } = await admin.from(data.tabela).delete().eq("id", data.id);
    if (error) falha("Não foi possível remover.", error);
    return { ok: true };
  });
