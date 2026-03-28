#!/usr/bin/env bash

# Supabase Postgres connection URL
CONN='postgresql://postgres:ShannonColleen12345!@db.uorumuuafzlqnmeosagd.supabase.co:5432/postgres'

# Target user UUID
UUID='9190b762-d102-4195-8a31-3cc4c9f2f658'

# Insert 9–12 modules into dashboard, avoiding duplicates
psql "$CONN" <<EOSQL
INSERT INTO dashboard (
  user_id,
  name,
  title,
  category,
  "sub-category",
  grade_level,
  school_name,
  progress,
  evaluation_score,
  evaluation_evidence
)
SELECT
  p.id,
  COALESCE(lm.name, lm.title) AS name,
  lm.title                    AS title,
  lm.category                 AS category,
  lm."sub-category"           AS "sub-category",
  p.grade_level               AS grade_level,
  p.school_name               AS school_name,
  'not started'               AS progress,
  NULL                        AS evaluation_score,
  NULL                        AS evaluation_evidence
FROM learning_modules lm
JOIN (
  SELECT id, grade_level, school_name
  FROM profiles
  WHERE id = '$UUID'
) p ON TRUE
WHERE
  lm.grade_level = '9-12'
  AND NOT EXISTS (
    SELECT 1
    FROM dashboard d
    WHERE d.user_id = p.id
      AND d.title = lm.title
  );
EOSQL
