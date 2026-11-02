do $$
declare
  target_business_id uuid;
begin
  select business_id into target_business_id
  from public.profiles
  where role = 'admin' and business_id is not null
  order by created_at
  limit 1;

  if target_business_id is null then
    raise notice 'Create an AgendaPro account and an establishment before running this optional seed.';
    return;
  end if;

  insert into public.services (business_id, name, description, duration_minutes, price_cents)
  values
    (target_business_id, 'Corte e finalização', 'Corte personalizado com finalização.', 45, 8500),
    (target_business_id, 'Design de sobrancelha', 'Design com acabamento delicado.', 30, 5500),
    (target_business_id, 'Limpeza de pele', 'Atendimento completo com avaliação inicial.', 60, 16000)
  on conflict (business_id, name) do update
    set description = excluded.description,
        duration_minutes = excluded.duration_minutes,
        price_cents = excluded.price_cents,
        active = true;

  insert into public.professional_services (business_id, professional_id, service_id)
  select target_business_id, p.id, s.id
  from public.professionals p
  join public.services s on s.business_id = target_business_id
  where p.business_id = target_business_id and p.active
  on conflict do nothing;

  insert into public.working_hours (professional_id, weekday, open_time, close_time, break_start, break_end)
  select p.id, day.weekday,
         case when day.weekday = 6 then time '10:00' else time '09:00' end,
         case when day.weekday = 6 then time '14:00' else time '18:00' end,
         case when day.weekday = 6 then null else time '12:00' end,
         case when day.weekday = 6 then null else time '13:00' end
  from public.professionals p
  cross join generate_series(1, 6) as day(weekday)
  where p.business_id = target_business_id and p.active
  on conflict (professional_id, weekday) do nothing;
end;
$$;
