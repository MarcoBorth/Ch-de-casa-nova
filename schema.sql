-- =====================================================================
-- Chá de Casa Nova — banco de dados (Supabase)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Antes, troque os e-mails dos anfitriões no final do arquivo.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Anfitriões: só quem está nesta lista consegue editar itens e fotos.
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Itens da lista
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  cat        text not null,
  name       text not null check (char_length(name) between 1 and 80),
  note       text not null default '' check (char_length(note) <= 200),
  optional   boolean not null default false,
  image_url  text,
  colors     jsonb not null default '[]'::jsonb,  -- [{"n":"Cinza","h":"#888888"}]
  sizes      jsonb not null default '[]'::jsonb,  -- ["P","M","G"]
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- Reservas: no máximo uma por item (a chave primária garante isso).
create table if not exists public.claims (
  item_id    uuid primary key references public.items(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  color      jsonb,
  size       text,
  created_at timestamptz not null default now()
);

-- Código secreto de cada reserva, para o convidado poder liberar a própria.
-- Ninguém lê esta tabela diretamente.
create table if not exists public.claim_secrets (
  item_id uuid primary key references public.claims(item_id) on delete cascade,
  token   text not null
);

alter table public.admins        enable row level security;
alter table public.items         enable row level security;
alter table public.claims        enable row level security;
alter table public.claim_secrets enable row level security;

drop policy if exists "itens: todos leem"          on public.items;
drop policy if exists "itens: anfitriões criam"    on public.items;
drop policy if exists "itens: anfitriões editam"   on public.items;
drop policy if exists "itens: anfitriões excluem"  on public.items;
drop policy if exists "reservas: todos leem"       on public.claims;
drop policy if exists "reservas: anfitriões liberam" on public.claims;

create policy "itens: todos leem"         on public.items for select to anon, authenticated using (true);
create policy "itens: anfitriões criam"   on public.items for insert to authenticated with check (public.is_admin());
create policy "itens: anfitriões editam"  on public.items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "itens: anfitriões excluem" on public.items for delete to authenticated using (public.is_admin());

create policy "reservas: todos leem"         on public.claims for select to anon, authenticated using (true);
create policy "reservas: anfitriões liberam" on public.claims for delete to authenticated using (public.is_admin());

-- Reservar um item. Responde 'ok', 'taken' (já tem dono) ou 'invalid'.
create or replace function public.claim_item(
  p_item uuid, p_name text, p_color text, p_size text, p_token text
) returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_item  public.items%rowtype;
  v_name  text := btrim(coalesce(p_name, ''));
  v_color jsonb;
  v_size  text;
begin
  if char_length(v_name) = 0 or char_length(v_name) > 60
     or p_token is null or char_length(p_token) < 16 then
    return 'invalid';
  end if;

  select * into v_item from public.items where id = p_item;
  if not found then return 'invalid'; end if;

  if jsonb_array_length(v_item.colors) > 0 then
    select e.value into v_color from jsonb_array_elements(v_item.colors) as e(value)
      where e.value ->> 'n' = p_color limit 1;
    if v_color is null then return 'invalid'; end if;
  end if;

  if jsonb_array_length(v_item.sizes) > 0 then
    if p_size is null or not (v_item.sizes ? p_size) then return 'invalid'; end if;
    v_size := p_size;
  end if;

  insert into public.claims (item_id, name, color, size)
  values (p_item, v_name, v_color, v_size)
  on conflict (item_id) do nothing;
  if not found then return 'taken'; end if;

  insert into public.claim_secrets (item_id, token)
  values (p_item, encode(digest(p_token, 'sha256'), 'hex'));
  return 'ok';
end;
$$;

-- Liberar a própria reserva (o navegador do convidado guarda o código).
create or replace function public.release_claim(p_item uuid, p_token text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
begin
  delete from public.claims c
  using public.claim_secrets s
  where c.item_id = p_item and s.item_id = p_item
    and s.token = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return found;
end;
$$;

grant execute on function public.is_admin()                              to anon, authenticated;
grant execute on function public.claim_item(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.release_claim(uuid, text)               to anon, authenticated;

-- Atualização em tempo real
do $$
begin
  begin alter publication supabase_realtime add table public.items;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.claims; exception when duplicate_object then null; end;
end $$;

-- Fotos dos itens (todos veem, só anfitriões enviam)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos: anfitriões enviam"  on storage.objects;
drop policy if exists "fotos: anfitriões trocam"  on storage.objects;
drop policy if exists "fotos: anfitriões apagam"  on storage.objects;
create policy "fotos: anfitriões enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());
create policy "fotos: anfitriões trocam" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
create policy "fotos: anfitriões apagam" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

-- Lista inicial (só entra se a tabela estiver vazia)
do $$
begin
  if exists (select 1 from public.items) then return; end if;
  insert into public.items (cat, name, optional, note, position) values
    ('eletro', 'Liquidificador', false, '', 10),
    ('eletro', 'Batedeira', true, '', 20),
    ('eletro', 'Torradeira', true, '', 30),
    ('eletro', 'Cafeteira', true, '', 40),
    ('eletro', 'Ferro de passar roupa', false, '', 50),
    ('eletro', 'Máquina de lavar roupa', false, '', 60),
    ('sala', 'Tapete', false, '', 70),
    ('sala', 'Mesa de jantar', false, '', 80),
    ('sala', 'Cadeiras', false, '', 90),
    ('sala', 'Almofadas', false, '', 100),
    ('sala', 'Sofá', false, '', 110),
    ('cozinha', 'Frigideira antiaderente', false, '', 120),
    ('cozinha', 'Panela de pressão', false, '', 130),
    ('cozinha', 'Jogo de panelas', false, '', 140),
    ('cozinha', 'Chaleira elétrica 2L', false, '', 150),
    ('cozinha', 'Escorredor de louça', false, '', 160),
    ('cozinha', 'Assadeira', false, '', 170),
    ('cozinha', 'Forma de bolo', false, '', 180),
    ('cozinha', 'Fruteira', false, '', 190),
    ('cozinha', 'Escorredor de macarrão', true, '', 200),
    ('cozinha', 'Tábua de corte', false, '', 210),
    ('cozinha', 'Jogo de facas', false, '', 220),
    ('cozinha', 'Kit churrasco', false, '', 230),
    ('cozinha', 'Utensílios básicos', false, 'Concha, espátula, colher, pegador e fouet.', 240),
    ('cozinha', 'Abridor de latas e garrafas', false, '', 250),
    ('cozinha', 'Abridor de vinho', false, '', 260),
    ('cozinha', 'Taças de vinho', false, '', 270),
    ('cozinha', 'Taças de cerveja', false, '', 280),
    ('cozinha', 'Descascador', false, '', 290),
    ('loucas', 'Jogo de pratos', false, 'Rasos, fundos e de sobremesa.', 300),
    ('loucas', 'Jogo de talheres', false, '', 310),
    ('loucas', 'Copos', false, '', 320),
    ('loucas', 'Canecas', false, '', 330),
    ('loucas', 'Bowls', false, '', 340),
    ('loucas', 'Jarra', true, '', 350),
    ('loucas', 'Travessas', true, 'De vidro ou cerâmica.', 360),
    ('loucas', 'Jogo americano', false, 'De tecido ou sisal.', 370),
    ('organizacao', 'Potes para guardar alimentos', false, '', 380),
    ('organizacao', 'Lixeira grande', false, '', 390),
    ('organizacao', 'Lixeira pequena', false, '', 400),
    ('organizacao', 'Porta-temperos', true, '', 410),
    ('organizacao', 'Panos de prato', false, '', 420),
    ('banheiro', 'Jogo de toalhas de banho', false, '', 430),
    ('banheiro', 'Toalhas de rosto', false, '', 440),
    ('banheiro', 'Tapete de banheiro', false, '', 450),
    ('banheiro', 'Lixeira de banheiro', false, '', 460),
    ('banheiro', 'Escova sanitária', false, '', 470),
    ('banheiro', 'Desentupidor', false, '', 480),
    ('banheiro', 'Porta-sabonete', false, '', 490),
    ('lavanderia', 'Varal', false, '', 500),
    ('lavanderia', 'Pregadores', false, '', 510),
    ('lavanderia', 'Cesto de roupas sujas', false, '', 520),
    ('lavanderia', 'Vassoura', false, '', 530),
    ('lavanderia', 'Rodo', false, '', 540),
    ('lavanderia', 'Pá de lixo', false, '', 550),
    ('lavanderia', 'Mop', false, '', 560),
    ('lavanderia', 'Balde', false, '', 570),
    ('lavanderia', 'Panos de chão', false, '', 580),
    ('lavanderia', 'Panos multiuso', false, '', 590),
    ('gerais', 'Kit de ferramentas básico', false, '', 600),
    ('gerais', 'Extensão elétrica', false, '', 610);
end $$;

-- =====================================================================
-- ANFITRIÕES: troque pelos e-mails de vocês (os mesmos que vão criar
-- em Authentication > Users). Pode deixar uma linha só.
-- =====================================================================
insert into public.admins (email) values
  ('SEU_EMAIL@exemplo.com'),
  ('EMAIL_DA_OUTRA_PESSOA@exemplo.com')
on conflict do nothing;
