-- ============================================================
-- หารกัน (HanGun) — settlements
-- records "I've paid X back to Y" so the outstanding amount clears
-- ============================================================

create table public.settlements (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  from_member uuid not null references public.members(id) on delete cascade,  -- payer
  to_member   uuid not null references public.members(id) on delete cascade,  -- receiver
  amount      numeric(12,2) not null check (amount > 0),
  slip_url    text,        -- uploaded transfer-slip image
  slip_ref    text,        -- reference decoded from the slip's QR code
  note        text,
  created_at  timestamptz not null default now()
);
create index settlements_project_idx on public.settlements(project_id);

alter table public.settlements enable row level security;
