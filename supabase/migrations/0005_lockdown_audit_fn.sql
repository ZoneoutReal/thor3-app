-- THOR3 hardening: stop the audit trigger function from being callable via the
-- public API.
--
-- log_progress_change() (migration 0003) is a SECURITY DEFINER trigger function.
-- Because it lives in the public schema, PostgREST also exposes it as an RPC that
-- the anon / authenticated roles can invoke directly
-- (/rest/v1/rpc/log_progress_change) — a security-advisor WARN. It is only ever
-- meant to fire from the `progress_audit` trigger, which runs as the table owner
-- regardless of EXECUTE grants. Revoking direct execute closes the exposed RPC
-- without touching the audit trail.
--
-- Reversible: re-grant to restore.

revoke execute on function public.log_progress_change() from public, anon, authenticated;
