-- Target PostgreSQL schema for the portal's staged move away from Sheets.
-- Sheets remain the live source until imports are verified and each module is cut over.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workbook text NOT NULL,
  source_sheet text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  source_rows integer,
  imported_rows integer,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'needs_review')),
  error_summary text
);

-- Exact source snapshots preserve every current sheet column during staged import.
-- The unique key makes a retry overwrite the same source row instead of duplicating it.
CREATE TABLE IF NOT EXISTS sheet_records (
  source_workbook text NOT NULL,
  source_sheet text NOT NULL,
  source_row_number integer NOT NULL CHECK (source_row_number >= 2),
  source_updated_at timestamptz,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_workbook, source_sheet, source_row_number)
);
CREATE INDEX IF NOT EXISTS sheet_records_payload_gin ON sheet_records USING gin (payload);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workbook text NOT NULL,
  source_sheet text NOT NULL DEFAULT 'Data',
  source_row_number integer NOT NULL,
  roll_number text,
  student_name text NOT NULL,
  branch text,
  course text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_workbook, source_sheet, source_row_number)
);
CREATE INDEX IF NOT EXISTS students_roll_number_idx ON students (lower(roll_number));
CREATE INDEX IF NOT EXISTS students_branch_course_idx ON students (lower(branch), lower(course));

CREATE TABLE IF NOT EXISTS openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE,
  company text,
  position text,
  owner_email text,
  owner_name text,
  last_date date,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workbook text NOT NULL,
  source_sheet text NOT NULL DEFAULT 'Opening_Applied',
  source_row_number integer NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  job_id text,
  status text,
  placement_owner text,
  applied_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_workbook, source_sheet, source_row_number)
);
CREATE INDEX IF NOT EXISTS applications_job_id_idx ON applications (job_id);
CREATE INDEX IF NOT EXISTS applications_owner_status_idx ON applications (lower(placement_owner), lower(status));

-- One record per TPO_Log row. The portal's Placed measure is status = 'Placed'
-- after trim/case normalization; joining status and offer state remain distinct.
CREATE TABLE IF NOT EXISTS placement_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workbook text NOT NULL,
  source_sheet text NOT NULL DEFAULT 'TPO_Log',
  source_row_number integer NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  job_id text,
  company text,
  position text,
  placement_owner text,
  status text,
  joining_status text,
  date_placed date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_workbook, source_sheet, source_row_number)
);
CREATE INDEX IF NOT EXISTS placement_records_status_date_idx ON placement_records (lower(status), date_placed);
CREATE INDEX IF NOT EXISTS placement_records_owner_date_idx ON placement_records (lower(placement_owner), date_placed);

CREATE OR REPLACE VIEW placed_placement_records AS
SELECT * FROM placement_records WHERE lower(trim(coalesce(status, ''))) = 'placed';

CREATE TABLE IF NOT EXISTS placement_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  actor_name text,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  previous_status text,
  new_status text,
  student_roll text,
  job_id text,
  company text,
  position text,
  entry_source text,
  details text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS placement_audit_occurred_at_idx ON placement_audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS placement_audit_student_idx ON placement_audit_log (student_roll, occurred_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workbook text NOT NULL,
  source_sheet text NOT NULL DEFAULT 'Event',
  source_row_number integer NOT NULL,
  event_id text,
  title text,
  branch text,
  event_date timestamptz,
  created_by text,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_workbook, source_sheet, source_row_number)
);

CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workbook text NOT NULL,
  source_sheet text NOT NULL DEFAULT 'Issues',
  source_row_number integer NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  branch text,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_workbook, source_sheet, source_row_number)
);

CREATE TABLE IF NOT EXISTS talentino_sessions (
  session_id text PRIMARY KEY,
  source_workbook text NOT NULL,
  source_sheet text NOT NULL DEFAULT 'Talentino_Schedule',
  source_row_number integer NOT NULL,
  branch text NOT NULL,
  course text,
  session_at timestamptz,
  placement_owner text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_workbook, source_sheet, source_row_number)
);

CREATE TABLE IF NOT EXISTS talentino_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workbook text NOT NULL,
  source_sheet text NOT NULL DEFAULT 'Talentino_Attendance',
  source_row_number integer NOT NULL,
  session_id text REFERENCES talentino_sessions(session_id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  branch text,
  attended_at timestamptz,
  rating numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_workbook, source_sheet, source_row_number)
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE,
  category text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'review')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_error text,
  payload_ref text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_outbox_due_idx ON email_outbox (next_attempt_at, created_at) WHERE status = 'queued';
