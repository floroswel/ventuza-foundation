CREATE OR REPLACE FUNCTION public.trg_wallet_qualify_on_verify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.age_status = 'verified'::public.age_status
     and old.age_status is distinct from 'verified'::public.age_status then
    perform public.wallet_qualify_referral(new.id);
  end if;
  return new;
end $function$;