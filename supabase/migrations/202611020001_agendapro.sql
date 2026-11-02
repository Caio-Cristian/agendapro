create extension if not exists btree_gist with schema extensions;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  address text,
  phone text,
  timezone text not null default 'America/Sao_Paulo',
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 720),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone text,
  role text not null default 'client' check (role in ('admin', 'professional', 'client')),
  business_id uuid references public.businesses(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'professional')),
  created_at timestamptz not null default now(),
  primary key (business_id, profile_id),
  unique (profile_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text check (description is null or char_length(description) <= 500),
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  constraint services_business_name_key unique (business_id, name),
  constraint services_business_id_id_key unique (business_id, id),
  created_at timestamptz not null default now()
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  active boolean not null default true,
  unique (profile_id),
  unique (business_id, id)
);

create table public.professional_services (
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  foreign key (business_id, professional_id) references public.professionals(business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade,
  primary key (professional_id, service_id)
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null,
  break_start time,
  break_end time,
  check (open_time < close_time),
  check ((break_start is null and break_end is null) or (break_start > open_time and break_end > break_start and break_end < close_time)),
  unique (professional_id, weekday)
);

create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 240),
  check (starts_at < ends_at),
  exclude using gist (professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'canceled')),
  notes text check (notes is null or char_length(notes) <= 280),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at),
  foreign key (business_id, professional_id) references public.professionals(business_id, id),
  foreign key (business_id, service_id) references public.services(business_id, id),
  exclude using gist (professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status <> 'canceled')
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index appointments_business_starts_idx on public.appointments (business_id, starts_at);
create index appointments_customer_starts_idx on public.appointments (customer_id, starts_at desc);
create index appointments_professional_starts_idx on public.appointments (professional_id, starts_at);
create index services_business_active_idx on public.services (business_id, active, name);
create index professionals_business_active_idx on public.professionals (business_id, active);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

create or replace function public.prevent_blocked_time_appointment_conflict()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text, 0));
  if exists (
    select 1 from public.appointments a
    where a.professional_id = new.professional_id and a.status <> 'canceled'
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then raise exception 'blocked_time_conflicts_with_appointment'; end if;
  return new;
end;
$$;

create trigger blocked_times_prevent_appointment_conflict
  before insert or update on public.blocked_times
  for each row execute function public.prevent_blocked_time_appointment_conflict();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_name text;
  business_name text;
  business_slug text;
  new_business_id uuid;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, new.phone, 'cliente'), '@', 1), ''),
    'Cliente'
  );
  if char_length(profile_name) < 2 then profile_name := 'Cliente'; end if;
  business_name := nullif(trim(new.raw_user_meta_data ->> 'business_name'), '');
  if business_name is not null then
    if char_length(business_name) not between 2 and 100 then raise exception 'invalid_business_name'; end if;
    business_slug := trim(both '-' from regexp_replace(lower(business_name), '[^a-z0-9]+', '-', 'g'));
    if business_slug = '' then business_slug := 'estabelecimento'; end if;
    business_slug := business_slug || '-' || left(new.id::text, 8);
    insert into public.businesses (name, slug) values (business_name, business_slug) returning id into new_business_id;
    insert into public.profiles (id, full_name, role, business_id) values (new.id, profile_name, 'admin', new_business_id);
    insert into public.business_members (business_id, profile_id, role) values (new_business_id, new.id, 'admin');
    insert into public.professionals (business_id, profile_id) values (new_business_id, new.id);
  else
    insert into public.profiles (id, full_name, role) values (new.id, profile_name, 'client');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.guard_profile_membership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.business_id is distinct from old.business_id)
    and current_setting('app.allow_profile_membership_update', true) is distinct from 'on' then
    raise exception 'profile_membership_is_managed_by_server';
  end if;
  return new;
end;
$$;

create trigger guard_profile_membership_update
  before update on public.profiles
  for each row execute function public.guard_profile_membership();

create or replace function public.create_business(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  new_business_id uuid;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 100 then raise exception 'invalid_business_name'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'invalid_business_slug'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and role = 'client' and business_id is null) then
    raise exception 'business_owner_already_configured';
  end if;

  insert into public.businesses (name, slug) values (trim(p_name), p_slug) returning id into new_business_id;
  perform set_config('app.allow_profile_membership_update', 'on', true);
  update public.profiles set role = 'admin', business_id = new_business_id where id = actor_id;
  insert into public.business_members (business_id, profile_id, role) values (new_business_id, actor_id, 'admin');
  insert into public.professionals (business_id, profile_id) values (new_business_id, actor_id);
  return new_business_id;
end;
$$;

create or replace view public.professional_directory
with (security_barrier = true)
as
select p.id as profile_id, p.full_name, pr.business_id
from public.professionals pr
join public.profiles p on p.id = pr.profile_id
where pr.active;

create or replace function public.get_available_slots(
  p_professional_id uuid,
  p_service_id uuid,
  p_date date
)
returns table(slot_start timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  professional_row public.professionals%rowtype;
  service_row public.services%rowtype;
  hours_row public.working_hours%rowtype;
  business_timezone text;
  opens_at timestamptz;
  closes_at timestamptz;
  pause_starts_at timestamptz;
  pause_ends_at timestamptz;
begin
  select * into professional_row from public.professionals where id = p_professional_id and active;
  select * into service_row from public.services where id = p_service_id and active;
  if professional_row.id is null or service_row.id is null or professional_row.business_id <> service_row.business_id then
    raise exception 'invalid_professional_or_service';
  end if;
  if exists (select 1 from public.professional_services where professional_id = p_professional_id)
    and not exists (select 1 from public.professional_services where professional_id = p_professional_id and service_id = p_service_id) then
    return;
  end if;

  select b.timezone into business_timezone from public.businesses b where b.id = professional_row.business_id;
  select * into hours_row from public.working_hours
    where professional_id = p_professional_id and weekday = extract(dow from p_date)::smallint;
  if hours_row.id is null then return; end if;
  if p_date < (now() at time zone business_timezone)::date then return; end if;

  opens_at := (p_date + hours_row.open_time) at time zone business_timezone;
  closes_at := (p_date + hours_row.close_time) at time zone business_timezone;
  if hours_row.break_start is not null then
    pause_starts_at := (p_date + hours_row.break_start) at time zone business_timezone;
    pause_ends_at := (p_date + hours_row.break_end) at time zone business_timezone;
  end if;

  return query
    select candidates.slot_start
    from generate_series(opens_at, closes_at - make_interval(mins => service_row.duration_minutes), interval '15 minutes') as candidates(slot_start)
    where candidates.slot_start >= now()
      and (pause_starts_at is null or not tstzrange(candidates.slot_start, candidates.slot_start + make_interval(mins => service_row.duration_minutes), '[)') && tstzrange(pause_starts_at, pause_ends_at, '[)'))
      and not exists (
        select 1 from public.appointments a
        where a.professional_id = p_professional_id and a.status <> 'canceled'
          and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(candidates.slot_start, candidates.slot_start + make_interval(mins => service_row.duration_minutes), '[)')
      )
      and not exists (
        select 1 from public.blocked_times b
        where b.professional_id = p_professional_id
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(candidates.slot_start, candidates.slot_start + make_interval(mins => service_row.duration_minutes), '[)')
      )
    order by candidates.slot_start;
end;
$$;

create or replace function public.book_appointment(
  p_professional_id uuid,
  p_service_id uuid,
  p_start_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  pro_row public.professionals%rowtype;
  service_row public.services%rowtype;
  appointment_id uuid;
  timezone_name text;
begin
  if actor_id is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and role = 'client') then raise exception 'client_account_required'; end if;
  if p_notes is not null and char_length(p_notes) > 280 then raise exception 'notes_too_long'; end if;
  select * into pro_row from public.professionals where id = p_professional_id and active;
  select * into service_row from public.services where id = p_service_id and active;
  if pro_row.id is null or service_row.id is null or pro_row.business_id <> service_row.business_id then raise exception 'invalid_professional_or_service'; end if;
  if exists (select 1 from public.professional_services where professional_id = p_professional_id)
    and not exists (select 1 from public.professional_services where professional_id = p_professional_id and service_id = p_service_id) then
    raise exception 'service_not_offered_by_professional';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text, 0));
  select timezone into timezone_name from public.businesses where id = pro_row.business_id;
  if not exists (
    select 1 from public.get_available_slots(p_professional_id, p_service_id, (p_start_at at time zone timezone_name)::date) available
    where available.slot_start = p_start_at
  ) then raise exception 'slot_unavailable'; end if;

  insert into public.appointments (business_id, customer_id, professional_id, service_id, starts_at, ends_at, notes)
  values (pro_row.business_id, actor_id, p_professional_id, p_service_id, p_start_at, p_start_at + make_interval(mins => service_row.duration_minutes), nullif(trim(p_notes), ''))
  returning id into appointment_id;
  return appointment_id;
exception
  when exclusion_violation then raise exception 'slot_unavailable';
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  appointment_row public.appointments%rowtype;
  cancellation_limit integer;
begin
  select * into appointment_row from public.appointments where id = p_appointment_id for update;
  if appointment_row.id is null then raise exception 'appointment_not_found'; end if;
  if appointment_row.status in ('completed', 'canceled') then raise exception 'appointment_cannot_be_canceled'; end if;
  if appointment_row.customer_id = actor_id then
    select cancellation_hours into cancellation_limit from public.businesses where id = appointment_row.business_id;
    if appointment_row.starts_at <= now() + make_interval(hours => cancellation_limit) then raise exception 'cancellation_deadline_passed'; end if;
  elsif not exists (
    select 1 from public.profiles p
    where p.id = actor_id and p.business_id = appointment_row.business_id
      and (p.role = 'admin' or (p.role = 'professional' and exists (
        select 1 from public.professionals pr where pr.id = appointment_row.professional_id and pr.profile_id = actor_id
      )))
  ) then
    raise exception 'not_authorized_to_cancel';
  end if;
  update public.appointments set status = 'canceled' where id = p_appointment_id;
end;
$$;

create or replace function public.reschedule_appointment(p_appointment_id uuid, p_new_start_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  appointment_row public.appointments%rowtype;
  service_row public.services%rowtype;
  pro_row public.professionals%rowtype;
  hours_row public.working_hours%rowtype;
  timezone_name text;
  cancellation_limit integer;
  local_start timestamp;
  local_date date;
  new_end timestamptz;
begin
  select * into appointment_row from public.appointments where id = p_appointment_id for update;
  if appointment_row.id is null then raise exception 'appointment_not_found'; end if;
  if appointment_row.customer_id <> actor_id then raise exception 'not_authorized_to_reschedule'; end if;
  if appointment_row.status not in ('pending', 'confirmed') then raise exception 'appointment_cannot_be_rescheduled'; end if;
  select cancellation_hours, timezone into cancellation_limit, timezone_name from public.businesses where id = appointment_row.business_id;
  if appointment_row.starts_at <= now() + make_interval(hours => cancellation_limit) then raise exception 'cancellation_deadline_passed'; end if;
  select * into pro_row from public.professionals where id = appointment_row.professional_id and active;
  select * into service_row from public.services where id = appointment_row.service_id and active;
  local_start := p_new_start_at at time zone timezone_name;
  local_date := local_start::date;
  if p_new_start_at <= now() or local_start <> date_trunc('minute', local_start) or extract(minute from local_start)::integer % 15 <> 0 then raise exception 'slot_unavailable'; end if;
  select * into hours_row from public.working_hours where professional_id = pro_row.id and weekday = extract(dow from local_date)::smallint;
  if hours_row.id is null or local_start::time < hours_row.open_time or (local_start + make_interval(mins => service_row.duration_minutes))::time > hours_row.close_time then raise exception 'slot_unavailable'; end if;
  new_end := p_new_start_at + make_interval(mins => service_row.duration_minutes);
  if hours_row.break_start is not null and tstzrange(p_new_start_at, new_end, '[)') && tstzrange((local_date + hours_row.break_start) at time zone timezone_name, (local_date + hours_row.break_end) at time zone timezone_name, '[)') then raise exception 'slot_unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(appointment_row.professional_id::text, 0));
  if exists (
    select 1 from public.appointments a
    where a.professional_id = appointment_row.professional_id and a.id <> p_appointment_id and a.status <> 'canceled'
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_new_start_at, new_end, '[)')
  ) or exists (
    select 1 from public.blocked_times b
    where b.professional_id = appointment_row.professional_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_new_start_at, new_end, '[)')
  ) then raise exception 'slot_unavailable'; end if;
  update public.appointments set starts_at = p_new_start_at, ends_at = new_end where id = p_appointment_id;
exception
  when exclusion_violation then raise exception 'slot_unavailable';
end;
$$;

create or replace function public.change_appointment_status(p_appointment_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  appointment_row public.appointments%rowtype;
  current_role text;
begin
  if p_status not in ('confirmed', 'completed') then raise exception 'invalid_status_transition'; end if;
  select * into appointment_row from public.appointments where id = p_appointment_id for update;
  if appointment_row.id is null then raise exception 'appointment_not_found'; end if;
  select role into current_role from public.profiles where id = actor_id and business_id = appointment_row.business_id;
  if current_role = 'professional' and not exists (select 1 from public.professionals where id = appointment_row.professional_id and profile_id = actor_id) then
    raise exception 'not_authorized_to_manage_appointment';
  end if;
  if current_role is null or current_role not in ('admin', 'professional') then raise exception 'not_authorized_to_manage_appointment'; end if;
  if (p_status = 'confirmed' and appointment_row.status <> 'pending') or (p_status = 'completed' and appointment_row.status <> 'confirmed') then
    raise exception 'invalid_status_transition';
  end if;
  update public.appointments set status = p_status where id = p_appointment_id;
end;
$$;

create or replace function public.notify_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  professional_profile_id uuid;
  notice_title text;
  notice_body text;
begin
  select profile_id into professional_profile_id from public.professionals where id = new.professional_id;
  if tg_op = 'INSERT' then
    notice_title := 'Novo agendamento';
    notice_body := 'Um novo horário foi reservado para ' || to_char(new.starts_at, 'DD/MM/YYYY às HH24:MI') || '.';
  elsif new.status is distinct from old.status then
    notice_title := case new.status when 'confirmed' then 'Agendamento confirmado' when 'completed' then 'Atendimento concluído' when 'canceled' then 'Agendamento cancelado' else 'Agendamento atualizado' end;
    notice_body := 'O horário de ' || to_char(new.starts_at, 'DD/MM/YYYY às HH24:MI') || ' foi atualizado.';
  elsif new.starts_at is distinct from old.starts_at then
    notice_title := 'Horário alterado';
    notice_body := 'O novo horário é ' || to_char(new.starts_at, 'DD/MM/YYYY às HH24:MI') || '.';
  else
    return new;
  end if;
  insert into public.notifications (recipient_id, appointment_id, title, body)
  values (new.customer_id, new.id, notice_title, notice_body);
  if professional_profile_id is not null and professional_profile_id <> new.customer_id then
    insert into public.notifications (recipient_id, appointment_id, title, body)
    values (professional_profile_id, new.id, notice_title, notice_body);
  end if;
  return new;
end;
$$;

create trigger appointments_notify_change
  after insert or update of status, starts_at on public.appointments
  for each row execute function public.notify_appointment_change();

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.blocked_times enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_business_admin(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and business_id = target_business_id
  );
$$;

create or replace function public.is_business_staff(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'professional') and business_id = target_business_id
  );
$$;

create or replace function public.is_assigned_professional(target_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.professionals pr
    join public.profiles p on p.id = pr.profile_id
    where pr.id = target_professional_id and pr.profile_id = auth.uid()
      and pr.active and p.role in ('admin', 'professional')
      and p.business_id = pr.business_id
  );
$$;

create or replace function public.is_professional_for_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.appointments a
    join public.professionals pr on pr.id = a.professional_id
    where a.customer_id = target_customer_id and a.status <> 'canceled' and pr.profile_id = auth.uid()
  );
$$;

create or replace function public.assign_invited_professional(p_business_id uuid, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  professional_id uuid;
begin
  if not public.is_business_admin(p_business_id) then raise exception 'not_authorized_to_manage_business'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'client' and business_id is null) then
    raise exception 'profile_is_not_eligible_for_invitation';
  end if;

  perform set_config('app.allow_profile_membership_update', 'on', true);
  update public.profiles set role = 'professional', business_id = p_business_id where id = p_profile_id;
  insert into public.business_members (business_id, profile_id, role) values (p_business_id, p_profile_id, 'professional');
  insert into public.professionals (business_id, profile_id) values (p_business_id, p_profile_id) returning id into professional_id;
  return professional_id;
end;
$$;

create or replace function public.save_weekly_availability(p_professional_id uuid, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  professional_row public.professionals%rowtype;
  timezone_name text;
  weekday_count integer;
  unique_weekdays integer;
begin
  select * into professional_row from public.professionals where id = p_professional_id and active;
  if professional_row.id is null then raise exception 'professional_not_found'; end if;
  if not public.is_business_admin(professional_row.business_id) and not public.is_assigned_professional(p_professional_id) then
    raise exception 'not_authorized_to_manage_availability';
  end if;
  if p_hours is null or jsonb_typeof(p_hours) <> 'array' then raise exception 'invalid_availability'; end if;
  select count(*), count(distinct h.weekday) into weekday_count, unique_weekdays
  from jsonb_to_recordset(p_hours) as h(weekday smallint, open_time time, close_time time, break_start time, break_end time);
  if weekday_count > 7 or weekday_count <> unique_weekdays then raise exception 'invalid_availability'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_hours) as h(weekday smallint, open_time time, close_time time, break_start time, break_end time)
    where h.weekday not between 0 and 6 or h.open_time is null or h.close_time is null or h.open_time >= h.close_time
      or ((h.break_start is null) <> (h.break_end is null))
      or (h.break_start is not null and (h.break_start <= h.open_time or h.break_end <= h.break_start or h.break_end >= h.close_time))
  ) then raise exception 'invalid_availability'; end if;

  select timezone into timezone_name from public.businesses where id = professional_row.business_id;
  if exists (
    select 1 from public.appointments a
    where a.professional_id = p_professional_id and a.status <> 'canceled' and a.starts_at > now()
      and not exists (
        select 1 from jsonb_to_recordset(p_hours) as h(weekday smallint, open_time time, close_time time, break_start time, break_end time)
        where h.weekday = extract(dow from (a.starts_at at time zone timezone_name))::smallint
          and (a.starts_at at time zone timezone_name)::time >= h.open_time
          and (a.ends_at at time zone timezone_name)::time <= h.close_time
          and (h.break_start is null or not tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(
            (((a.starts_at at time zone timezone_name)::date + h.break_start) at time zone timezone_name),
            (((a.starts_at at time zone timezone_name)::date + h.break_end) at time zone timezone_name),
            '[)'
          ))
      )
  ) then raise exception 'working_hours_conflict_with_appointment'; end if;

  delete from public.working_hours w
  where w.professional_id = p_professional_id
    and not exists (
      select 1 from jsonb_to_recordset(p_hours) as h(weekday smallint, open_time time, close_time time, break_start time, break_end time)
      where h.weekday = w.weekday
    );
  insert into public.working_hours (professional_id, weekday, open_time, close_time, break_start, break_end)
  select p_professional_id, h.weekday, h.open_time, h.close_time, h.break_start, h.break_end
  from jsonb_to_recordset(p_hours) as h(weekday smallint, open_time time, close_time time, break_start time, break_end time)
  on conflict (professional_id, weekday) do update
    set open_time = excluded.open_time, close_time = excluded.close_time,
        break_start = excluded.break_start, break_end = excluded.break_end;
end;
$$;

create policy "Businesses are publicly discoverable" on public.businesses for select using (true);
create policy "Business admins can update their business" on public.businesses for update to authenticated
  using (public.is_business_admin(id))
  with check (public.is_business_admin(id));

create policy "Profiles can be read by their owner and authorized team" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_business_admin(business_id)
    or public.is_professional_for_customer(id)
  );
create policy "Profiles can update their own contact details" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read their own membership" on public.business_members for select to authenticated
  using (profile_id = auth.uid() or public.is_business_admin(business_id));

create policy "Active services are public and team can read all" on public.services for select
  using (active or public.is_business_staff(business_id));
create policy "Admins can create services in their business" on public.services for insert to authenticated
  with check (public.is_business_admin(business_id));
create policy "Admins can update services in their business" on public.services for update to authenticated
  using (public.is_business_admin(business_id))
  with check (public.is_business_admin(business_id));

create policy "Active professionals can be listed" on public.professionals for select using (active);

grant select (profile_id, full_name, business_id) on public.professional_directory to anon, authenticated;
grant select on public.professional_directory to anon, authenticated;

create policy "Team can read service assignments" on public.professional_services for select to authenticated
  using (public.is_business_staff(business_id));
create policy "Admins can assign services" on public.professional_services for all to authenticated
  using (public.is_business_admin(business_id))
  with check (public.is_business_admin(business_id));

create policy "Working hours can be queried for availability" on public.working_hours for select using (true);
create policy "Admins can manage their team hours" on public.working_hours for all to authenticated
  using (exists (select 1 from public.professionals pr where pr.id = professional_id and public.is_business_admin(pr.business_id)))
  with check (exists (select 1 from public.professionals pr where pr.id = professional_id and public.is_business_admin(pr.business_id)));
create policy "Professionals can manage their own hours" on public.working_hours for all to authenticated
  using (public.is_assigned_professional(professional_id))
  with check (public.is_assigned_professional(professional_id));

create policy "Team can read their own blocked times" on public.blocked_times for select to authenticated
  using (public.is_assigned_professional(professional_id) or exists (select 1 from public.professionals pr where pr.id = professional_id and public.is_business_admin(pr.business_id)));
create policy "Team can manage their own blocked times" on public.blocked_times for all to authenticated
  using (public.is_assigned_professional(professional_id) or exists (select 1 from public.professionals pr where pr.id = professional_id and public.is_business_admin(pr.business_id)))
  with check (public.is_assigned_professional(professional_id) or exists (select 1 from public.professionals pr where pr.id = professional_id and public.is_business_admin(pr.business_id)));

create policy "Clients can read their own bookings" on public.appointments for select to authenticated
  using (customer_id = auth.uid());
create policy "Admins can read bookings for their business" on public.appointments for select to authenticated
  using (public.is_business_admin(business_id));
create policy "Professionals can read their own bookings" on public.appointments for select to authenticated
  using (public.is_assigned_professional(professional_id));

create policy "Users can read their own notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "Users can mark their own notifications as read" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on function public.create_business(text, text) from public;
revoke all on function public.get_available_slots(uuid, uuid, date) from public;
revoke all on function public.book_appointment(uuid, uuid, timestamptz, text) from public;
revoke all on function public.cancel_appointment(uuid) from public;
revoke all on function public.reschedule_appointment(uuid, timestamptz) from public;
revoke all on function public.change_appointment_status(uuid, text) from public;
revoke all on function public.assign_invited_professional(uuid, uuid) from public;
revoke all on function public.save_weekly_availability(uuid, jsonb) from public;
grant execute on function public.create_business(text, text) to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.cancel_appointment(uuid) to authenticated;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;
grant execute on function public.change_appointment_status(uuid, text) to authenticated;
grant execute on function public.assign_invited_professional(uuid, uuid) to authenticated;
grant execute on function public.save_weekly_availability(uuid, jsonb) to authenticated;
