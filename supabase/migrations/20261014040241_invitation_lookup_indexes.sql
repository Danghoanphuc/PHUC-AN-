create index approved_invites_user_idx on private.approved_invites(accepted_user);
create index approved_invites_creator_idx on private.approved_invites(created_by);
