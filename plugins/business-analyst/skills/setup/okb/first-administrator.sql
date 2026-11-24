-- OKB: the business's first administrator, the six scopes and Big Puffin's staff, from the Auth users the okb-setup
-- hosted function made at the owner's first sign-in, as okb_setup.person lists them. Run once, as postgres, through
-- okb-setup or the SQL Editor, after the owner has signed in. It holds no name, email or id of its own.
-- It does what bootstrap.sql's steps 1, 2, 3b, 3e and 3f do, filled in from okb_setup.person: the owner becomes
-- the first administrator, with their sessions scope; the six scopes are made in their name; and each of Big Puffin's
-- staff with an Auth user becomes an actor named "<name> (Big Puffin)", with their sessions scope and the kinetik
-- template's grants, each approved by the owner. Each of Big Puffin's staff okb-setup made a code for, in
-- okb_setup.staff_code, becomes the same actor with no sign-in yet, with okb_private.provision_invited_actor, and the
-- template's grants, and their code's SHA-256 becomes their open invitation in okb_private.invitation, which okb-join
-- spends; okb-join makes their sessions scope. Then each loose end okb-setup listed in okb_setup.open_task, such as
-- sending Big Puffin a code its website did not take, is saved as an open task in Administration, assigned to the
-- owner, as the owner, in position order, each due a week on. One transaction: a failure keeps nothing.
do $$
declare
 o record;
 p record;
 admin_id uuid;
 person_id uuid;
begin
 select * into o from okb_setup.person where role = 'owner';
 if o.auth_user_id is null then
  raise exception 'The owner has not signed in yet: okb_setup.person names no owner' using errcode = '22023';
 end if;
 if exists(select 1 from okb.actor) then
  raise exception 'OKB already has actors: the first administrator is made' using errcode = '23505';
 end if;

 -- Step 1. The first administrator.
 admin_id := okb_private.provision_first_administrator(o.auth_user_id, o.name);

 -- Step 2. The six scopes, as bootstrap.sql's step 2 makes them.
 insert into okb.scope(code, display_name, description, created_by)
 select x.code, x.display_name, x.description, admin_id
 from (values
   ('general', 'General', 'The business''s day-to-day records and files.'),
   ('routines', 'Routines', 'The business''s routines, as its interviews write them down, and their designs.'),
   ('reference', 'Reference', 'The glossary of the business''s words, and the data dictionary of where each fact is kept.'),
   ('plugins', 'Plugins', 'Each release of the business''s plugins, which each person''s okb sync installs.'),
   ('administration', 'Administration', 'The setup record and each access record: who set the project up, each actor made, each grant given and why. Read only by the business''s administrators and Big Puffin.'),
   ('guides', 'Guides', 'Big Puffin''s guides to installing, updating, printing, support and leaving, which everyone reads and only Big Puffin changes.')
 ) as x(code, display_name, description)
 where not exists(select 1 from okb.scope s where s.code = x.code);

 -- Step 3b for each of Big Puffin's staff, then step 3e for every person, then step 3f for Big Puffin's staff.
 for p in select * from okb_setup.person order by role = 'kinetik', name loop
  if p.role = 'owner' then
   person_id := admin_id;
  else
   person_id := okb_private.provision_actor(admin_id, p.auth_user_id, p.name || ' (Big Puffin)', 'human', null, 'restricted', false);
  end if;
  insert into okb.scope(code, display_name, description, created_by)
  values ('sessions_' || replace(p.auth_user_id::text, '-', ''),
   case when p.role = 'owner' then p.name else p.name || ' (Big Puffin)' end || '''s sessions',
   'The text of each session ' || case when p.role = 'owner' then p.name else p.name || ' (Big Puffin)' end || ' has had with their agent.',
   admin_id);
  perform okb_private.provision_grant(
   admin_id,
   gen_random_uuid(),
   person_id,
   (select s.scope_id from okb.scope s where s.code = 'sessions_' || replace(p.auth_user_id::text, '-', '')),
   array['evidence'],
   null::uuid,
   array['read','create','edit','delete'],
   null::timestamptz,
   'Their agent keeps the text of each session with them here.');
  if p.role = 'kinetik' then
   perform okb_private.apply_access_template(admin_id, person_id, 'kinetik');
  end if;
 end loop;

 -- Big Puffin's staff with a one-time code: the actor, the template's grants and the open invitation.
 for p in select * from okb_setup.staff_code order by name, email loop
  person_id := okb_private.provision_invited_actor(admin_id, p.name || ' (Big Puffin)', 'restricted');
  perform okb_private.apply_access_template(admin_id, person_id, 'kinetik');
  insert into okb_private.invitation(actor_id, email, code_sha256, invited_by_actor_id, expires_at)
  values (person_id, p.email, p.code_sha256, admin_id, p.expires_at);
 end loop;
end $$;

-- The open tasks, saved as the owner, as their own sign-in would save them.
do $$
declare
 o record;
 t jsonb;
 tasks jsonb;
 saved jsonb;
begin
 select p.auth_user_id, a.actor_id into o from okb_setup.person p join okb.actor a using (auth_user_id) where p.role = 'owner';
 -- Read before the switch to authenticated, which cannot reach okb_setup.
 select coalesce(jsonb_agg(to_jsonb(x) order by x.position), '[]'::jsonb) into tasks from okb_setup.open_task x;
 perform set_config('request.jwt.claims', jsonb_build_object('sub', o.auth_user_id, 'role', 'authenticated')::text, true);
 execute 'set local role authenticated';
 for t in select x from jsonb_array_elements(tasks) x loop
  saved := okb.okb_add_record('administration', 'activity', t->>'title', 'An open task setup left for the administrator.',
   jsonb_build_object('activity_kind', 'task', 'description', t->>'description', 'completion_requirements', t->>'completion_requirements',
    'assignee_actor_id', o.actor_id,
    'baseline_finish_at', to_char((date_trunc('minute', now()) + interval '7 days' + (t->>'position')::int * interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  if saved->>'record_id' is null then
   raise exception 'The open task "%" was not saved: %', t->>'title', coalesce(saved->>'problem', saved::text) using errcode = '22023';
  end if;
 end loop;
 execute 'reset role';
 perform set_config('request.jwt.claims', '', true);
end $$;
