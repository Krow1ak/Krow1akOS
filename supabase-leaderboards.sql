-- KrowOS leaderboards: paste all of this into Supabase > SQL Editor and press Run (once).
-- One row per player per board (their best). Anyone can read; scores only go in through
-- submit_score(), which keeps the better of the old and new score and checks the sizes.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  board text not null check (char_length(board) between 1 and 160),
  player text not null check (char_length(player) between 8 and 40),
  name text not null check (char_length(name) between 1 and 24),
  score double precision not null check (score > -1e12 and score < 1e12),
  detail text check (char_length(detail) <= 80),
  created_at timestamptz not null default now(),
  unique (board, player)
);
create index if not exists scores_board_score on public.scores (board, score);

alter table public.scores enable row level security;
drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores" on public.scores for select using (true);
-- no insert/update/delete policies: the page can only write through the function below

create or replace function public.submit_score(p_board text, p_player text, p_name text, p_score double precision, p_detail text, p_lower boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_board !~ '^[a-z0-9:._ -]{1,160}$' or p_player !~ '^[a-z0-9]{8,40}$' then raise exception 'bad board or player'; end if;
  insert into scores (board, player, name, score, detail)
  values (p_board, p_player, left(coalesce(nullif(trim(p_name), ''), 'Guest'), 24), p_score, left(p_detail, 80))
  on conflict (board, player) do update
    set name = excluded.name, score = excluded.score, detail = excluded.detail, created_at = now()
    where case when p_lower then excluded.score < scores.score else excluded.score > scores.score end;
end $$;
revoke all on function public.submit_score from public;
grant execute on function public.submit_score to anon, authenticated;
