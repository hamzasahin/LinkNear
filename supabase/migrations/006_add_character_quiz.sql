-- =============================================================================
-- Migration 004: Add character quiz table + quiz_completed flag on profiles
-- =============================================================================

-- Add quiz_completed flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quiz_completed BOOLEAN DEFAULT false;

-- Character quiz table
CREATE TABLE IF NOT EXISTS character_quiz (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  core_values TEXT[] DEFAULT '{}',
  communication_style TEXT DEFAULT 'balanced',
  work_style TEXT DEFAULT 'flexible',
  raw_answers JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE character_quiz ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own quiz" ON character_quiz FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Read quiz basics" ON character_quiz FOR SELECT USING (true);
