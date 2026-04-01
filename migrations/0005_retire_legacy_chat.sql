-- Migration: 0005_retire_legacy_chat
--
-- Ensures the team conversation exists in the conversations model.
-- This is a one-time bootstrap that:
--   1. Creates the team conversation row if none exists (type = 'team').
--   2. Adds all existing users as members.
--
-- The legacy tables (chat_messages, chat_reads) are NOT dropped here.
-- They are retained as dormant read-only history. A future migration may
-- archive or drop them once confirmed safe.
--
-- Idempotent: all inserts use ON CONFLICT DO NOTHING.

DO $$
DECLARE
  team_conv_id INTEGER;
BEGIN
  -- Find existing team conversation
  SELECT id INTO team_conv_id
  FROM conversations
  WHERE type = 'team'
  LIMIT 1;

  -- Create one if none exists
  IF team_conv_id IS NULL THEN
    INSERT INTO conversations (type, name, created_at)
    VALUES ('team', 'Team Chat', NOW())
    RETURNING id INTO team_conv_id;
  END IF;

  -- Ensure all current users are members of the team conversation
  INSERT INTO conversation_members (conversation_id, user_id, last_read_id, joined_at)
  SELECT team_conv_id, id, 0, NOW()
  FROM users
  ON CONFLICT DO NOTHING;
END;
$$;
