create or replace function private.post_pos_sale(p jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member();id uuid;v_order_id uuid;o public.customer_orders%rowtype;
 item public.customer_order_items%rowtype;l jsonb;qty numeric;take numeric;remaining numeric;
 delivery jsonb:='[]';cash_id uuid;amount numeric:=0;day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 id:=private.request_start(p_key,'post_pos_sale',p);if id is not null then return id;end if;
 if p ? 'discount_pct' or p ? 'collected_amount' or p ? 'account_id' or p ? 'credit_approval_reason' then raise exception 'POS fields are server controlled' using errcode='42501';end if;
 perform private.require_lines(p);
 -- Follow the same customer -> order -> items order as delivery and collections.
 perform 1 from public.customers where customers.id=(p->>'customer_id')::uuid and is_active for update;
 if not found then raise exception 'Active customer required';end if;
 if not private.can_customer((p->>'customer_id')::uuid) then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if exists(select 1 from jsonb_array_elements(p->'lines') x group by x->>'product_id' having count(*)>1) then raise exception 'Duplicate POS product';end if;
 if nullif(p->>'order_id','') is null then
  v_order_id:=private.save_customer_order(jsonb_build_object('customer_id',p->>'customer_id','delivery_date',day,'note',p->>'note','lines',p->'lines'),p_key||':order');
  if exists(select 1 from public.customer_order_items where customer_order_items.order_id=v_order_id and product_id is null) then raise exception 'Resolve every POS line';end if;
  update public.customer_orders set status='confirmed',version=version+1,updated_at=now() where customer_orders.id=v_order_id;
 else
  v_order_id:=(p->>'order_id')::uuid;
 end if;
 select * into o from public.customer_orders where customer_orders.id=v_order_id for update;
 if not found or o.customer_id<>(p->>'customer_id')::uuid or o.status not in ('confirmed','partial') then raise exception 'Confirmed order required';end if;
 if p ? 'order_id' and (p->>'version')::integer is distinct from o.version then raise exception 'Version conflict' using errcode='40001';end if;
 for l in select value from jsonb_array_elements(p->'lines') order by value->>'product_id' loop
  qty:=(l->>'order_qty')::numeric*10;
  if qty is null or qty<=0 or qty<>trunc(qty) or qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid POS quantity';end if;
  remaining:=qty;
  for item in select * from public.customer_order_items where customer_order_items.order_id=v_order_id and product_id=(l->>'product_id')::uuid order by customer_order_items.id for update loop
   take:=least(remaining,item.pieces_qty-item.delivered_pieces);
   if take>0 then
    delivery:=delivery||jsonb_build_array(jsonb_build_object('order_item_id',item.id,'delivered_pieces',take));
    amount:=amount+round(take/item.pieces_per_price_unit*item.unit_price_snapshot*(1-o.discount_pct/100),2);
    remaining:=remaining-take;
   end if;
  end loop;
  if remaining>0 then raise exception 'POS quantity exceeds remaining order';end if;
 end loop;
 if amount<=0 or (p->>'expected_total')::numeric is distinct from amount then raise exception 'POS total changed; refresh prices and order';end if;
 -- Serialize wallet creation and collections for one operator.
 perform pg_advisory_xact_lock(hashtextextended('pos-wallet:'||actor::text,0));
 select account_id into cash_id from private.pos_wallets where user_id=actor;
 if cash_id is null then
  insert into public.cash_accounts(code,name,account_type) values('POS-'||actor::text,'POS · '||coalesce((select nullif(full_name,'') from public.member_profiles where user_id=actor),actor::text),'cash') returning cash_accounts.id into cash_id;
  insert into private.pos_wallets(user_id,account_id) values(actor,cash_id);
 end if;
 id:=private.post_delivery_as(jsonb_build_object('order_id',o.id,'version',o.version,'sale_date',day,'note',p->>'note','collected_amount',amount,'account_id',cash_id,'lines',delivery),p_key||':delivery',true);
 perform private.audit('pos.sale_posted',id,jsonb_build_object('order_id',o.id,'cash_account_id',cash_id));
 return private.request_finish(p_key,'post_pos_sale',p,id);
end $$;
