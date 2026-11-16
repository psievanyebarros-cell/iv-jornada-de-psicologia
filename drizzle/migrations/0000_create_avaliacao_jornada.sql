CREATE TABLE public.avaliadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.avaliadores TO anon, authenticated;
GRANT ALL ON public.avaliadores TO service_role;
ALTER TABLE public.avaliadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avaliadores visíveis publicamente" ON public.avaliadores FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.trabalhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_trabalho TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  autor_principal TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Resumo Simples', 'Resumo Expandido', 'Oficina / Minicurso / Roda de Conversa')),
  local_apresentacao TEXT NOT NULL DEFAULT 'Hall de Entrada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trabalhos TO anon, authenticated;
GRANT ALL ON public.trabalhos TO service_role;
ALTER TABLE public.trabalhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trabalhos visíveis publicamente" ON public.trabalhos FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliador_id UUID NOT NULL REFERENCES public.avaliadores(id) ON DELETE CASCADE,
  trabalho_id UUID NOT NULL REFERENCES public.trabalhos(id) ON DELETE CASCADE,
  nota_conteudo NUMERIC(3,1) NOT NULL CHECK (nota_conteudo BETWEEN 0 AND 10),
  nota_apresentacao NUMERIC(3,1) NOT NULL CHECK (nota_apresentacao BETWEEN 0 AND 10),
  nota_dominio NUMERIC(3,1) NOT NULL CHECK (nota_dominio BETWEEN 0 AND 10),
  observacoes_parecer TEXT,
  data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (avaliador_id, trabalho_id)
);
CREATE INDEX avaliacoes_trabalho_idx ON public.avaliacoes(trabalho_id);
GRANT ALL ON public.avaliacoes TO service_role;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

INSERT INTO public.avaliadores (nome) VALUES
  ('Profa. Dra. Ana Beatriz Moura'),
  ('Prof. Dr. Carlos Eduardo Lima'),
  ('Profa. Ma. Fernanda Ribeiro Costa'),
  ('Prof. Me. João Pedro Albuquerque'),
  ('Profa. Dra. Larissa Mendes Sousa');

INSERT INTO public.trabalhos (codigo_trabalho, titulo, autor_principal, categoria, local_apresentacao) VALUES
  ('TS-01', 'Ansiedade em estudantes universitários durante o período de provas', 'Mariana Silva Rocha', 'Resumo Simples', 'Hall de Entrada'),
  ('TS-02', 'Uso de redes sociais e autoestima na adolescência', 'Lucas Andrade Pereira', 'Resumo Simples', 'Hall de Entrada'),
  ('TS-03', 'Práticas de mindfulness na atenção primária à saúde', 'Beatriz Nogueira Santos', 'Resumo Simples', 'Hall de Entrada'),
  ('TS-04', 'Vínculo terapêutico em atendimentos on-line', 'Rafael Costa Martins', 'Resumo Simples', 'Hall de Entrada'),
  ('TE-01', 'Saúde mental de profissionais de enfermagem pós-pandemia', 'Juliana Freitas Araújo', 'Resumo Expandido', 'Sala 101'),
  ('TE-02', 'Psicologia escolar e inclusão de estudantes com TEA', 'Gabriel Souza Lima', 'Resumo Expandido', 'Sala 102'),
  ('TE-03', 'Luto e resiliência em famílias maranhenses', 'Camila Duarte Vieira', 'Resumo Expandido', 'Sala 101'),
  ('OF-01', 'Oficina: Arteterapia como recurso de expressão emocional', 'Priscila Monteiro Alves', 'Oficina / Minicurso / Roda de Conversa', 'Sala 201'),
  ('OF-02', 'Roda de conversa: Psicologia, raça e território', 'Thiago Ramos Ferreira', 'Oficina / Minicurso / Roda de Conversa', 'Auditório');