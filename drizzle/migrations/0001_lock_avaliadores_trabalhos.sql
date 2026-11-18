DROP POLICY IF EXISTS "Avaliadores visíveis publicamente" ON public.avaliadores;
DROP POLICY IF EXISTS "Trabalhos visíveis publicamente" ON public.trabalhos;
REVOKE ALL ON public.avaliadores FROM anon, authenticated;
REVOKE ALL ON public.trabalhos FROM anon, authenticated;
GRANT ALL ON public.avaliadores TO service_role;
GRANT ALL ON public.trabalhos TO service_role;