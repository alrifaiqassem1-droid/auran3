-- ============================================================
-- AURAN — Security Tables & Rate Limiting
-- Apply AFTER 0001_init.sql
-- ============================================================

-- Rate limiting: store each attempt by identifier (email or IP)
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier  text        NOT NULL,
  action      text        NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rla_lookup
  ON rate_limit_attempts (identifier, action, created_at DESC);

-- Auth audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at     timestamptz DEFAULT now() NOT NULL,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  email          text,
  ip_address     text,
  user_agent     text,
  action         text        NOT NULL,
  success        boolean     NOT NULL,
  is_suspicious  boolean     DEFAULT false,
  metadata       jsonb       DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_aal_email   ON auth_audit_log (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_ip      ON auth_audit_log (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_uid     ON auth_audit_log (user_id, created_at DESC);

-- RLS
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log      ENABLE ROW LEVEL SECURITY;

-- App can write; service_role bypasses RLS automatically
CREATE POLICY "app_insert_rla" ON rate_limit_attempts
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "app_insert_aal" ON auth_audit_log
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ─────────────────────────────────────────────
-- RPC: check rate limit (SECURITY DEFINER reads past RLS)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action     text,
  p_max        int  DEFAULT 5,
  p_window_min int  DEFAULT 15
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM rate_limit_attempts
  WHERE identifier = p_identifier
    AND action     = p_action
    AND created_at > now() - make_interval(mins => p_window_min);

  RETURN jsonb_build_object(
    'blocked',         v_count >= p_max,
    'attempts',        v_count,
    'retry_after_min', p_window_min
  );
END;
$$;

-- ─────────────────────────────────────────────
-- RPC: check if IP is suspicious (many failures in recent hours)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_suspicious_ip(
  p_ip    text,
  p_hours int DEFAULT 1,
  p_max   int DEFAULT 10
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM auth_audit_log
  WHERE ip_address = p_ip
    AND success    = false
    AND created_at > now() - make_interval(hours => p_hours);
  RETURN v_count >= p_max;
END;
$$;

-- ─────────────────────────────────────────────
-- Maintenance: cleanup old data (call periodically)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_security_tables() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limit_attempts WHERE created_at < now() - interval '24 hours';
  DELETE FROM auth_audit_log      WHERE created_at < now() - interval '90 days';
$$;
