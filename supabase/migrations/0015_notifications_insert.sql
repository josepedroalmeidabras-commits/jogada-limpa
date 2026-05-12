-- =============================================================================
-- Permitir que qualquer authenticated user escreva na caixa de outro (push fan-out)
-- =============================================================================
-- Compromisso pragmático: o mesmo argumento usado para push_tokens.read.
-- A alternativa "limpa" seria um SECURITY DEFINER por cada tipo de evento;
-- para a Fase 1 com pool fechado de utilizadores, este é aceitável.

create policy "notif_insert_authenticated"
  on public.notifications for insert to authenticated
  with check (true);
