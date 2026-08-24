create table if not exists public.admin_grants (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  amount_cents integer,
  days integer,
  xp integer,
  code text,
  reason text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on public.admin_grants to authenticated;
grant all on public.admin_grants to service_role;

alter table public.admin_grants enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_grants' and policyname='admin_grants_staff_read') then
    create policy "admin_grants_staff_read" on public.admin_grants
      for select to authenticated
      using (public.has_any_role(auth.uid(), array['admin','super_admin','auditor']::app_role[]));
  end if;
end $$;

create index if not exists admin_grants_target_idx on public.admin_grants(target_user_id, created_at desc);
create index if not exists admin_grants_created_idx on public.admin_grants(created_at desc);

create or replace function public.admin_grant_perk(
  _target uuid,
  _kind text,
  _reason text,
  _days integer default null,
  _amount_cents integer default null,
  _xp integer default null,
  _code text default null,
  _invoice_id uuid default null,
  _percent numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := auth.uid();
  _grant_id uuid;
  _result jsonb := '{}'::jsonb;
  _new_end timestamptz;
  _inv record;
  _sub_minor integer;
  _vat_minor integer;
  _total_minor integer;
begin
  if _actor is null or not public.is_admin_or_above(_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if _target is null then
    raise exception 'target_required' using errcode = '22023';
  end if;
  if _reason is null or length(btrim(_reason)) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  if _kind = 'premium_days' then
    if coalesce(_days, 0) <= 0 or _days > 3650 then
      raise exception 'invalid_days' using errcode = '22023';
    end if;
    select greatest(coalesce(max(expires_at), now()), now()) + make_interval(days => _days)
      into _new_end
    from public.subscriptions
    where user_id = _target and status = 'active';

    _new_end := coalesce(_new_end, now() + make_interval(days => _days));

    if exists (select 1 from public.subscriptions where user_id = _target and platform = 'comp') then
      update public.subscriptions
        set status = 'active',
            expires_at = _new_end,
            auto_renew = false,
            updated_at = now()
      where user_id = _target and platform = 'comp';
    else
      insert into public.subscriptions (user_id, platform, product_id, status, started_at, expires_at, auto_renew, raw)
      values (_target, 'comp', 'comp_premium', 'active', now(), _new_end, false,
              jsonb_build_object('granted_by', _actor, 'reason', _reason));
    end if;
    _result := jsonb_build_object('expires_at', _new_end);

  elsif _kind = 'wallet_credit' then
    if coalesce(_amount_cents, 0) <= 0 or _amount_cents > 100000 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    perform public.wallet_credit(_target, _amount_cents, 'admin_grant', 'available', null, _reason);
    _result := jsonb_build_object('amount_cents', _amount_cents);

  elsif _kind = 'xp' then
    if coalesce(_xp, 0) <= 0 or _xp > 100000 then
      raise exception 'invalid_xp' using errcode = '22023';
    end if;
    perform public.award_xp(_target, 'admin_grant', _xp, jsonb_build_object('reason', _reason, 'actor', _actor));
    _result := jsonb_build_object('xp', _xp);

  elsif _kind = 'badge' then
    if _code is null then
      raise exception 'code_required' using errcode = '22023';
    end if;
    perform public.admin_grant_badge(_target, _code,
      case when coalesce(_days, 0) > 0 then now() + make_interval(days => _days) else null end,
      _reason);
    _result := jsonb_build_object('badge', _code);

  elsif _kind = 'boost_days' then
    if coalesce(_days, 0) <= 0 or _days > 365 then
      raise exception 'invalid_days' using errcode = '22023';
    end if;
    update public.profiles
      set boost_until = greatest(coalesce(boost_until, now()), now()) + make_interval(days => _days)
    where id = _target
    returning boost_until into _new_end;
    _result := jsonb_build_object('boost_until', _new_end);

  elsif _kind = 'boosts_balance' then
    if coalesce(_amount_cents, 0) <= 0 or _amount_cents > 1000 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    update public.profiles
      set boosts_balance = coalesce(boosts_balance, 0) + _amount_cents
    where id = _target;
    _result := jsonb_build_object('boosts_added', _amount_cents);

  elsif _kind = 'partner_plan_days' then
    if _code is null then
      raise exception 'code_required' using errcode = '22023';
    end if;
    if coalesce(_days, 0) <= 0 or _days > 3650 then
      raise exception 'invalid_days' using errcode = '22023';
    end if;
    if not exists (select 1 from public.partner_plans where code = _code and active) then
      raise exception 'unknown_plan' using errcode = '22023';
    end if;
    select greatest(coalesce(current_period_end, now()), now()) + make_interval(days => _days)
      into _new_end
    from public.partner_subscriptions where owner_id = _target;
    _new_end := coalesce(_new_end, now() + make_interval(days => _days));

    if exists (select 1 from public.partner_subscriptions where owner_id = _target) then
      update public.partner_subscriptions
        set plan_code = _code,
            status = 'active',
            current_period_end = _new_end,
            grace_until = null,
            auto_invoice = false,
            updated_at = now()
      where owner_id = _target;
    else
      insert into public.partner_subscriptions (owner_id, plan_code, status, current_period_start, current_period_end, auto_invoice)
      values (_target, _code, 'active', now(), _new_end, false);
    end if;
    _result := jsonb_build_object('plan_code', _code, 'period_end', _new_end);

  elsif _kind = 'invoice_discount' then
    if _invoice_id is null or coalesce(_percent, 0) <= 0 or _percent > 100 then
      raise exception 'invalid_discount' using errcode = '22023';
    end if;
    select * into _inv from public.partner_invoices where id = _invoice_id for update;
    if _inv.id is null then
      raise exception 'invoice_not_found' using errcode = '22023';
    end if;
    if _inv.status = 'paid' then
      raise exception 'invoice_already_paid' using errcode = '22023';
    end if;
    _sub_minor := round(_inv.subtotal_minor * (1 - _percent / 100.0));
    _vat_minor := round(_sub_minor * coalesce(_inv.vat_rate, 0));
    _total_minor := _sub_minor + _vat_minor;
    update public.partner_invoices
      set subtotal_minor = _sub_minor,
          vat_minor = _vat_minor,
          total_minor = _total_minor,
          notes = coalesce(notes || E'\n', '') || format('Discount %s%% acordat de staff: %s', _percent, _reason),
          updated_at = now()
    where id = _invoice_id;
    _target := coalesce(_inv.owner_id, _target);
    _result := jsonb_build_object('invoice_id', _invoice_id, 'percent', _percent, 'total_minor', _total_minor);

  else
    raise exception 'unknown_kind' using errcode = '22023';
  end if;

  insert into public.admin_grants (actor_id, target_user_id, kind, amount_cents, days, xp, code, reason, meta)
  values (_actor, _target, _kind, _amount_cents, _days, _xp, _code, _reason,
          _result || jsonb_build_object('invoice_id', _invoice_id, 'percent', _percent))
  returning id into _grant_id;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, after, severity)
  values (_actor, 'admin_grant_perk', 'user', _target,
          jsonb_build_object('kind', _kind, 'reason', _reason, 'result', _result), 'info');

  return jsonb_build_object('ok', true, 'grant_id', _grant_id, 'kind', _kind, 'detail', _result);
end $$;

revoke all on function public.admin_grant_perk(uuid, text, text, integer, integer, integer, text, uuid, numeric) from public;
revoke all on function public.admin_grant_perk(uuid, text, text, integer, integer, integer, text, uuid, numeric) from anon;
grant execute on function public.admin_grant_perk(uuid, text, text, integer, integer, integer, text, uuid, numeric) to service_role;

create or replace function public.admin_list_grants(_target uuid default null, _limit integer default 50)
returns table (
  id uuid,
  actor_id uuid,
  actor_name text,
  target_user_id uuid,
  target_name text,
  kind text,
  amount_cents integer,
  days integer,
  xp integer,
  code text,
  reason text,
  meta jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select g.id, g.actor_id, ap.display_name, g.target_user_id, tp.display_name,
         g.kind, g.amount_cents, g.days, g.xp, g.code, g.reason, g.meta, g.created_at
  from public.admin_grants g
  left join public.profiles ap on ap.id = g.actor_id
  left join public.profiles tp on tp.id = g.target_user_id
  where _target is null or g.target_user_id = _target
  order by g.created_at desc
  limit least(coalesce(_limit, 50), 200);
end $$;

revoke all on function public.admin_list_grants(uuid, integer) from public;
revoke all on function public.admin_list_grants(uuid, integer) from anon;
grant execute on function public.admin_list_grants(uuid, integer) to authenticated, service_role;