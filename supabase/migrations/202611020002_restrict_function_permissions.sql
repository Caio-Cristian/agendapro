-- Hosted Supabase may grant EXECUTE directly to anon through default privileges.
-- Revoking PUBLIC alone does not remove those direct grants.
revoke all on function public.create_business(text, text) from public, anon;
revoke all on function public.book_appointment(uuid, uuid, timestamptz, text) from public, anon;
revoke all on function public.cancel_appointment(uuid) from public, anon;
revoke all on function public.reschedule_appointment(uuid, timestamptz) from public, anon;
revoke all on function public.change_appointment_status(uuid, text) from public, anon;
revoke all on function public.assign_invited_professional(uuid, uuid) from public, anon;
revoke all on function public.save_weekly_availability(uuid, jsonb) from public, anon;

grant execute on function public.create_business(text, text) to authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.cancel_appointment(uuid) to authenticated;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;
grant execute on function public.change_appointment_status(uuid, text) to authenticated;
grant execute on function public.assign_invited_professional(uuid, uuid) to authenticated;
grant execute on function public.save_weekly_availability(uuid, jsonb) to authenticated;

-- Public slot discovery remains available to signed-out visitors.
grant execute on function public.get_available_slots(uuid, uuid, date) to anon, authenticated;
