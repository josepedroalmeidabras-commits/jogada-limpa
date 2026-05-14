-- =============================================================================
-- 0085 — Re-aplicar fix_macroman_encoding() em registos que escaparam ao 0076
-- =============================================================================
-- Algumas linhas (provavelmente criadas DEPOIS de 0076 ter corrido, ou por
-- pipeline alternativo) ainda têm "Andr√© Sousa" em vez de "André Sousa".
-- Idempotente: linhas já limpas (sem "√") são saltadas pelo WHERE.
--
-- Usamos chr(8730) em vez de literal Unicode "√" porque o SQL Editor da
-- Supabase pode renderizar mal o caractere copiado, levando a queries
-- que falsamente não matcham. chr() é à prova de cliente.

-- chr(8730) = √
update public.profiles
set name = public.fix_macroman_encoding(name)
where name like '%' || chr(8730) || '%';

update public.profiles
set nickname = public.fix_macroman_encoding(nickname)
where nickname like '%' || chr(8730) || '%';

update public.profiles
set bio = public.fix_macroman_encoding(bio)
where bio like '%' || chr(8730) || '%';

update public.profiles
set city = public.fix_macroman_encoding(city)
where city like '%' || chr(8730) || '%';

update public.teams
set name = public.fix_macroman_encoding(name)
where name like '%' || chr(8730) || '%';

update public.teams
set city = public.fix_macroman_encoding(city)
where city like '%' || chr(8730) || '%';

update public.matches
set location_name = public.fix_macroman_encoding(location_name)
where location_name like '%' || chr(8730) || '%';

-- Sports table (nomes de modalidades)
update public.sports
set name = public.fix_macroman_encoding(name)
where name like '%' || chr(8730) || '%';
