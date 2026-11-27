-- 0017-connectors
-- base: 9173ea7
-- Big Puffin's system connectors, which run in Big Puffin's connector Worker and nowhere in this project. This project
-- keeps each connected account's keys as ciphertext only the Worker opens, in okb_private.connector_secret, the log of
-- every call in okb_private.connector_call, each write's idempotency claim in okb_private.connector_claim, and VLS's
-- status posts in okb_private.vls_status, with no grant to a client role. The Worker writes them as the signed-in person
-- through okb_connector_secret_save, an administrator's alone, okb_connector_claim and okb_connector_log, and reads them
-- through okb_connector_secret_get, okb_connector_calls and okb_vls_status. okb_vls_status_save takes a status post with
-- the publishable key alone, and refuses one whose login's keyed hash is not the account's. The same text is in setup.sql.
-- Safe to run twice. Run as the postgres login.

-- ===================================================================
-- 8ae. Big Puffin's system connectors. Upgrade 0017-connectors.
-- ===================================================================
-- Big Puffin's connectors to the systems a business already runs, Shopify, Mintsoft, VLS, Farfill and Slack, run in Big
-- Puffin's connector Worker and nowhere in this project. The project keeps what is the business's own: each account's
-- keys, as ciphertext only the Worker can open, the log of every call, each write's idempotency claim, and the status
-- posts VLS sends. The Worker writes them as the signed-in person, through the functions below, and keeps nothing.
set role okb_owner;
-- One row for each account a connector acts in: its keys, sealed by the Worker with AES-256-GCM under a key only the
-- Worker can make, as base64, and the nonce it was sealed with. check_hash is, for an account that takes status posts,
-- the Worker's keyed hash of the login the posts sign in with, so okb_vls_status_save can check a post without the login.
create table if not exists okb_private.connector_secret (
 connector text not null check (connector ~ '^[a-z][a-z0-9-]{1,30}$'),
 account text not null check (account ~ '^[a-z0-9][a-z0-9_-]{0,30}$'),
 ciphertext text not null check (ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$' and length(ciphertext)<=16000),
 nonce text not null check (nonce ~ '^[A-Za-z0-9+/]{16}$'),
 check_hash text check (check_hash ~ '^[0-9a-f]{64}$'),
 set_by uuid not null references okb.actor(actor_id),
 set_at timestamptz not null default clock_timestamp(),
 primary key (connector, account)
);
alter table okb_private.connector_secret enable row level security;
revoke all on okb_private.connector_secret from public, anon, authenticated;

-- One row for each call of a connector. answer is the call's answer with every secret replaced. It never holds a key,
-- a password or a token.
create table if not exists okb_private.connector_call (
 call_id bigint generated always as identity primary key,
 at timestamptz not null default clock_timestamp(),
 connector text not null check (connector ~ '^[a-z][a-z0-9-]{1,30}$'),
 account text check (account ~ '^[a-z0-9][a-z0-9_-]{0,30}$'),
 action text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
 actor_id uuid references okb.actor(actor_id),
 record_id uuid,
 idempotency_key text check (length(idempotency_key) between 1 and 200),
 input_sha256 text check (input_sha256 ~ '^[0-9a-f]{64}$'),
 outcome text not null check (outcome in ('done','preview','refused','failed','uncertain')),
 system_status integer,
 answer jsonb check (length(answer::text)<=8000),
 problem text check (length(problem)<=2000)
);
create index if not exists connector_call_record_idx on okb_private.connector_call(record_id, at);
create index if not exists connector_call_actor_idx on okb_private.connector_call(actor_id);
alter table okb_private.connector_call enable row level security;
revoke all on okb_private.connector_call from public, anon, authenticated;

-- One row for each write's idempotency key: running while the Worker sends it, then done with its answer, or uncertain
-- when the system gave no answer. A refused or failed write frees its key. A key running for over five minutes is
-- uncertain, since a Worker's call to a system ends within that time.
create table if not exists okb_private.connector_claim (
 connector text not null check (connector ~ '^[a-z][a-z0-9-]{1,30}$'),
 account text not null check (account ~ '^[a-z0-9][a-z0-9_-]{0,30}$'),
 action text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
 idempotency_key text not null check (length(idempotency_key) between 1 and 200),
 input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
 actor_id uuid not null references okb.actor(actor_id),
 record_id uuid not null,
 state text not null check (state in ('running','done','uncertain')),
 answer jsonb check (length(answer::text)<=8000),
 system_status integer,
 claimed_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 primary key (connector, account, action, idempotency_key)
);
alter table okb_private.connector_claim enable row level security;
revoke all on okb_private.connector_claim from public, anon, authenticated;

-- Each status post VLS sends to the Worker, as it came, for the account its address names.
create table if not exists okb_private.vls_status (
 status_id bigint generated always as identity primary key,
 received_at timestamptz not null default clock_timestamp(),
 account text not null check (account ~ '^[a-z0-9][a-z0-9_-]{0,30}$'),
 order_id bigint not null check (order_id>0),
 order_no text not null check (btrim(order_no)<>'' and length(order_no)<=100),
 status text not null check (btrim(status)<>'' and length(status)<=40),
 status_timestamp text check (length(status_timestamp)<=40),
 lines jsonb not null check (jsonb_typeof(lines)='array'),
 post jsonb not null
);
create index if not exists vls_status_order_idx on okb_private.vls_status(account, order_id, received_at);
alter table okb_private.vls_status enable row level security;
revoke all on okb_private.vls_status from public, anon, authenticated;
grant select, insert, update on okb_private.connector_secret to okb_writer;
grant select on okb_private.connector_secret to okb_reader;
grant select, insert on okb_private.connector_call to okb_writer;
grant select on okb_private.connector_call to okb_reader;
grant select, insert, update, delete on okb_private.connector_claim to okb_writer;
grant select, insert on okb_private.vls_status to okb_writer;
grant select on okb_private.vls_status to okb_reader;
reset role;

drop policy if exists connector_secret_writer_all on okb_private.connector_secret;
create policy connector_secret_writer_all on okb_private.connector_secret for all to okb_writer using (true) with check (true);
drop policy if exists connector_secret_reader_read on okb_private.connector_secret;
create policy connector_secret_reader_read on okb_private.connector_secret for select to okb_reader using (true);
drop policy if exists connector_call_writer_all on okb_private.connector_call;
create policy connector_call_writer_all on okb_private.connector_call for all to okb_writer using (true) with check (true);
-- The reader sees a call only through okb_connector_calls, which checks the record first.
drop policy if exists connector_call_reader_read on okb_private.connector_call;
create policy connector_call_reader_read on okb_private.connector_call for select to okb_reader using (okb_private.can_read_record(record_id));
drop policy if exists connector_claim_writer_all on okb_private.connector_claim;
create policy connector_claim_writer_all on okb_private.connector_claim for all to okb_writer using (true) with check (true);
drop policy if exists vls_status_writer_all on okb_private.vls_status;
create policy vls_status_writer_all on okb_private.vls_status for all to okb_writer using (true) with check (true);
drop policy if exists vls_status_reader_read on okb_private.vls_status;
create policy vls_status_reader_read on okb_private.vls_status for select to okb_reader using (true);

-- The reads, as any enabled person of the business: an account's ciphertext, a record's calls, and the latest status
-- post VLS sent for an order.
grant create on schema okb to okb_reader;
set role okb_reader;
-- An account's sealed keys, for the Worker to open for one call, or null when the account is not connected. Only
-- ciphertext leaves the project: the Worker alone holds the key that opens it.
create or replace function okb.okb_connector_secret_get(p_connector text, p_account text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare a okb.actor;
begin
 a:=okb_private.read_actor();
 return (select jsonb_build_object('connector',s.connector,'account',s.account,'ciphertext',s.ciphertext,'nonce',s.nonce,
  'set_at',s.set_at,'set_by',okb_private.actor_name(s.set_by))
  from okb_private.connector_secret s where s.connector=lower(btrim(coalesce(p_connector,''))) and s.account=lower(btrim(coalesce(p_account,''))));
end $$;

-- The calls logged against a record, newest first, for a person who may read the record, and none for anyone else.
create or replace function okb.okb_connector_calls(p_record_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare a okb.actor;
begin
 a:=okb_private.read_actor();
 if p_record_id is null or not okb_private.can_read_record(p_record_id) then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('at',c.at,'connector',c.connector,'account',c.account,'action',c.action,
  'actor_id',c.actor_id,'actor_name',okb_private.actor_name(c.actor_id),'idempotency_key',c.idempotency_key,'outcome',c.outcome,
  'system_status',c.system_status,'answer',c.answer,'problem',c.problem) order by c.at desc,c.call_id desc)
  from okb_private.connector_call c where c.record_id=p_record_id),'[]'::jsonb);
end $$;

-- The latest status post VLS sent for one receiving order of one account, or null.
create or replace function okb.okb_vls_status(p_account text, p_order_id bigint) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare a okb.actor;
begin
 a:=okb_private.read_actor();
 return (select jsonb_build_object('status',v.status,'order_no',v.order_no,'status_timestamp',v.status_timestamp,'lines',v.lines,'received_at',v.received_at)
  from okb_private.vls_status v where v.account=lower(btrim(coalesce(p_account,''))) and v.order_id=p_order_id
  order by v.received_at desc,v.status_id desc limit 1);
end $$;
reset role;
revoke create on schema okb from okb_reader;
revoke all on function okb.okb_connector_secret_get(text,text), okb.okb_connector_calls(uuid), okb.okb_vls_status(text,bigint) from public, anon;
grant execute on function okb.okb_connector_secret_get(text,text), okb.okb_connector_calls(uuid), okb.okb_vls_status(text,bigint) to authenticated;

-- The writes. Each is the Worker's, made as the signed-in person.
grant create on schema okb to okb_writer;
set role okb_writer;
-- Keeps an account's sealed keys, replacing any it held, and its login hash when one is given. Only a person who is an
-- administrator connects an account.
create or replace function okb.okb_connector_secret_save(p_connector text, p_account text, p_ciphertext text, p_nonce text,
 p_check_hash text default null) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a okb.actor; c text:=lower(btrim(coalesce(p_connector,''))); n text:=lower(btrim(coalesce(p_account,''))); at timestamptz;
begin
 a:=okb_private.current_actor();
 if a.actor_kind<>'human' or a.authority_class<>'administrator' then
  raise exception 'Only a person who is an administrator connects an account' using errcode='42501'; end if;
 insert into okb_private.connector_secret(connector,account,ciphertext,nonce,check_hash,set_by)
 values(c,n,p_ciphertext,p_nonce,p_check_hash,a.actor_id)
 on conflict (connector,account) do update set ciphertext=excluded.ciphertext, nonce=excluded.nonce,
  check_hash=coalesce(excluded.check_hash,connector_secret.check_hash), set_by=excluded.set_by, set_at=clock_timestamp()
 returning set_at into at;
 return jsonb_build_object('connector',c,'account',n,'set_at',at);
exception when check_violation then
 raise exception 'A connector''s account is named in lower-case letters, numbers, - and _, and its keys are the Worker''s sealed text' using errcode='23514';
end $$;

-- Claims a write's idempotency key for the person, before the Worker sends the write. It gives claimed, or the key's
-- earlier call: done, with its answer, running, or uncertain, or other_input when the key was claimed for other input.
-- The write is for a record the person may read.
create or replace function okb.okb_connector_claim(p_connector text, p_account text, p_action text, p_idempotency_key text,
 p_input_sha256 text, p_record_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a okb.actor; c okb_private.connector_claim;
begin
 a:=okb_private.current_actor();
 if p_record_id is null or not okb_private.can_read_record(p_record_id) then
  raise exception 'No record with that record_id is readable with your sign-in' using errcode='42501'; end if;
 insert into okb_private.connector_claim(connector,account,action,idempotency_key,input_sha256,actor_id,record_id,state)
 values(p_connector,p_account,p_action,p_idempotency_key,p_input_sha256,a.actor_id,p_record_id,'running')
 on conflict do nothing;
 if found then return jsonb_build_object('claimed',true); end if;
 select * into c from okb_private.connector_claim where connector=p_connector and account=p_account and action=p_action
  and idempotency_key=p_idempotency_key for update;
 -- A key is the person's own, for one record: another person's, or one claimed for another record or input, never
 -- answers or blocks this write, and is refused as other input.
 if c.input_sha256<>p_input_sha256 or c.actor_id<>a.actor_id or c.record_id<>p_record_id then return jsonb_build_object('other_input',true); end if;
 if c.state='running' and c.claimed_at<clock_timestamp()-interval '5 minutes' then
  update okb_private.connector_claim set state='uncertain', finished_at=clock_timestamp()
  where connector=p_connector and account=p_account and action=p_action and idempotency_key=p_idempotency_key;
  c.state:='uncertain';
 end if;
 return jsonb_build_object('earlier',c.state,'answer',c.answer,'system_status',c.system_status);
exception when check_violation then
 raise exception 'An idempotency key holds 1 to 200 characters, and the input''s hash is a SHA-256' using errcode='23514';
end $$;

-- Writes one call's row to the log, as the person, and closes its key's claim: done keeps the answer for a repeat,
-- uncertain keeps the key from being sent again, and refused or failed frees it. Gives the row's id.
create or replace function okb.okb_connector_log(p_connector text, p_account text, p_action text, p_record_id uuid,
 p_idempotency_key text, p_input_sha256 text, p_outcome text, p_system_status integer, p_answer jsonb, p_problem text) returns bigint
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare a okb.actor; id bigint;
begin
 a:=okb_private.current_actor();
 if p_record_id is not null and not okb_private.can_read_record(p_record_id) then
  raise exception 'No record with that record_id is readable with your sign-in' using errcode='42501'; end if;
 insert into okb_private.connector_call(connector,account,action,actor_id,record_id,idempotency_key,input_sha256,outcome,system_status,answer,problem)
 values(p_connector,p_account,p_action,a.actor_id,p_record_id,p_idempotency_key,p_input_sha256,p_outcome,p_system_status,p_answer,left(p_problem,2000))
 returning call_id into id;
 if p_idempotency_key is not null then
  if p_outcome in ('done','uncertain') then
   update okb_private.connector_claim set state=p_outcome, answer=case when p_outcome='done' then p_answer end,
    system_status=p_system_status, finished_at=clock_timestamp()
   where connector=p_connector and account=p_account and action=p_action and idempotency_key=p_idempotency_key
    and state='running' and actor_id=a.actor_id;
  elsif p_outcome in ('refused','failed') then
   delete from okb_private.connector_claim where connector=p_connector and account=p_account and action=p_action
    and idempotency_key=p_idempotency_key and state='running' and actor_id=a.actor_id;
  end if;
 end if;
 return id;
exception when check_violation then
 raise exception 'A connector''s call names its connector, account and action in lower-case, and its answer holds up to 8,000 characters' using errcode='23514';
end $$;

-- Keeps one status post VLS sent for an account, once the Worker's keyed hash of the post's login matches the one the
-- account's connecting kept. VLS signs in with no person's sign-in, so this is the one connector function the
-- publishable key alone may call, and it refuses any other sender.
create or replace function okb.okb_vls_status_save(p_account text, p_login_hash text, p_post jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $$
declare n text:=lower(btrim(coalesce(p_account,''))); kept text; id bigint; order_id bigint; order_no text; status text;
begin
 select s.check_hash into kept from okb_private.connector_secret s where s.connector='vls' and s.account=n;
 if kept is null or p_login_hash is null or kept<>p_login_hash then
  raise exception 'Sign in with the webhook''s username and password' using errcode='42501'; end if;
 if jsonb_typeof(p_post)<>'object' or jsonb_typeof(p_post->'orderId')<>'number' or (p_post->>'orderId')!~'^[0-9]+$'
  or jsonb_typeof(p_post->'orderNo')<>'string' or jsonb_typeof(p_post->'status')<>'string' or jsonb_typeof(p_post->'lineItems')<>'array'
  or exists(select 1 from jsonb_array_elements(case jsonb_typeof(p_post->'lineItems') when 'array' then p_post->'lineItems' else '[]' end) l where jsonb_typeof(l)<>'object') then
  raise exception 'A status post has orderId, orderNo, status and lineItems, a list of line items' using errcode='22023'; end if;
 order_id:=(p_post->>'orderId')::bigint; order_no:=btrim(p_post->>'orderNo'); status:=btrim(p_post->>'status');
 insert into okb_private.vls_status(account,order_id,order_no,status,status_timestamp,lines,post)
 values(n,order_id,order_no,status,case jsonb_typeof(p_post->'statusTimestamp') when 'string' then left(p_post->>'statusTimestamp',40) end,p_post->'lineItems',p_post)
 returning status_id into id;
 return jsonb_build_object('status_id',id);
exception when check_violation or numeric_value_out_of_range then
 raise exception 'A status post''s orderId is above nought, its orderNo holds up to 100 characters and its status up to 40' using errcode='22023';
end $$;
reset role;
revoke create on schema okb from okb_writer;
revoke all on function okb.okb_connector_secret_save(text,text,text,text,text), okb.okb_connector_claim(text,text,text,text,text,uuid),
 okb.okb_connector_log(text,text,text,uuid,text,text,text,integer,jsonb,text), okb.okb_vls_status_save(text,text,jsonb) from public, anon;
grant execute on function okb.okb_connector_secret_save(text,text,text,text,text), okb.okb_connector_claim(text,text,text,text,text,uuid),
 okb.okb_connector_log(text,text,text,uuid,text,text,text,integer,jsonb,text) to authenticated;
-- The one function the publishable key alone reaches: anon may use the okb schema for it, and executes nothing else there.
grant usage on schema okb to anon;
grant execute on function okb.okb_vls_status_save(text,text,jsonb) to authenticated;
grant execute on function okb.okb_vls_status_save(text,text,jsonb) to anon;
notify pgrst, 'reload schema';

insert into okb_private.schema_upgrade(id) values ('0017-connectors') on conflict (id) do nothing;
