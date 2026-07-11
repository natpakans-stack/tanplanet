-- ============================================================
-- หารกัน (HanGun) — initial schema
-- multi-user trip bill-splitting; no-login, link/QR based access
-- ============================================================

-- ---- projects --------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,          -- public token embedded in the QR / join URL
  owner_token text not null,                 -- secret; the owner's browser keeps this
  created_at  timestamptz not null default now()
);

-- ---- members ---------------------------------------------------
create table public.members (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  name           text not null,
  photo_url      text,                       -- Supabase Storage public URL
  payment_qr_url text,                       -- uploaded PromptPay / bank QR image
  is_owner       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index members_project_idx on public.members(project_id);

-- ---- expenses --------------------------------------------------
-- kind='expense' : payer_id paid; expense_shares lists who consumed it
-- kind='debt'    : payer_id = lender, counter_id = borrower (no expense_shares)
create table public.expenses (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind       text not null default 'expense' check (kind in ('expense','debt')),
  category   text not null default 'other',
  title      text not null,
  amount     numeric(12,2) not null check (amount >= 0),
  payer_id   uuid references public.members(id) on delete set null,
  counter_id uuid references public.members(id) on delete set null,
  split_mode text not null default 'equal' check (split_mode in ('equal','custom')),
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_project_idx on public.expenses(project_id);

-- ---- expense_shares (resolved who-owes-what, expense kind only) -
create table public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  amount     numeric(12,2) not null check (amount >= 0),
  primary key (expense_id, member_id)
);
create index expense_shares_member_idx on public.expense_shares(member_id);

-- ---- updated_at trigger ----------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger expenses_touch_updated_at
  before update on public.expenses
  for each row execute function public.touch_updated_at();

-- ---- RLS: deny all direct anon access --------------------------
-- the app reaches the DB only through Next.js server actions using
-- the service_role key (which bypasses RLS). enabling RLS with no
-- policies blocks the public anon key as defense-in-depth.
alter table public.projects       enable row level security;
alter table public.members        enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_shares enable row level security;

-- ---- storage bucket for member photos + payment QR images ------
insert into storage.buckets (id, name, public)
values ('hangun', 'hangun', true)
on conflict (id) do nothing;
