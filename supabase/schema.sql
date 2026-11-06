-- Run once in the Supabase SQL editor.
create extension if not exists vector;

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid,
  unique (id, user_id),
  -- composite FK: a folder's parent must belong to the same user
  foreign key (parent_id, user_id) references public.folders(id, user_id) on delete cascade
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null,
  folder_id uuid,
  ocr_text text not null default '',
  embedding vector(512),
  status text not null default 'pending' check (status in ('indexed','pending')),
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  -- the folder must belong to the same user; on folder delete only folder_id is nulled (PG15+)
  foreign key (folder_id, user_id) references public.folders(id, user_id) on delete set null (folder_id)
);

create index if not exists images_user_idx on public.images(user_id);
create index if not exists images_embedding_idx on public.images using hnsw (embedding vector_cosine_ops);
create index if not exists images_ocr_idx on public.images using gin (to_tsvector('simple', ocr_text));

alter table public.folders enable row level security;
alter table public.images enable row level security;

drop policy if exists "folders_own" on public.folders;
create policy "folders_own" on public.folders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "images_own" on public.images;
create policy "images_own" on public.images for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private storage bucket; each user may only touch files under "<user_id>/".
insert into storage.buckets (id, name, public) values ('images', 'images', false)
  on conflict (id) do nothing;

drop policy if exists "storage_own_select" on storage.objects;
create policy "storage_own_select" on storage.objects for select
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "storage_own_insert" on storage.objects;
create policy "storage_own_insert" on storage.objects for insert
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "storage_own_update" on storage.objects;
create policy "storage_own_update" on storage.objects for update
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "storage_own_delete" on storage.objects;
create policy "storage_own_delete" on storage.objects for delete
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Combined search: vector similarity (skipped when query_embedding is null) + literal text match
-- on OCR text. LIKE wildcards in the user's text are escaped. security invoker so RLS applies.
-- 0.15 is the minimum cosine similarity for a vector-only hit; tune it after trying real images.
create or replace function public.search_images(
  query_embedding vector(512),
  query_text text,
  match_count int default 40
) returns table (id uuid, score float)
language sql stable security invoker as $$
  with q as (
    select replace(replace(replace(coalesce(query_text, ''), '\', '\\'), '%', '\%'), '_', '\_') as pat,
           coalesce(query_text, '') <> '' as has_text
  ),
  scored as (
    select i.id,
           case when query_embedding is not null and i.embedding is not null
                then 1 - (i.embedding <=> query_embedding) else 0 end as sim,
           (select has_text from q) and i.ocr_text ilike '%' || (select pat from q) || '%' escape '\' as txt
    from public.images i
    where i.trashed_at is null
  )
  select scored.id, greatest(sim, case when txt then 1 else 0 end)::float as score
  from scored
  where txt or sim > 0.15
  order by score desc
  limit match_count;
$$;
