-- 1) Admin'in tüm profilleri güncelleyebilmesi için RLS politikası
create policy "profiles: admins can update all"
  on public.profiles for update
  using (public.is_admin());

-- 2) Trigger'ı güncelle: email, apartment_no ve status da eklensin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email, apartment_no, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'resident'),
    new.email,
    new.raw_user_meta_data->>'apartment_no',
    'pending'
  );
  return new;
end;
$$;
