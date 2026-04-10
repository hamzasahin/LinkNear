-- =============================================================================
-- Migration 004: Add daily challenges + streak system
-- =============================================================================

-- Add streak/growth fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_points INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenges_completed INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_challenge_date DATE;

-- Challenge library
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('kindness', 'knowledge', 'community', 'self', 'generosity', 'gratitude')),
  source TEXT,
  source_text TEXT,
  difficulty TEXT DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points INT DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  reflection TEXT,
  shared_to_feed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, assigned_date)
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY challenges_select ON challenges FOR SELECT USING (true);
CREATE POLICY user_challenges_all ON user_challenges FOR ALL USING (auth.uid() = user_id);

-- Seed 32 challenges
INSERT INTO challenges (title, description, category, source, source_text, difficulty, points) VALUES
('Give a genuine compliment', 'Find someone — a colleague, a barista, a stranger — and tell them something specific you appreciate about them. Mean it.', 'kindness', 'Sahih al-Bukhari', 'A good word is charity.', 'easy', 10),
('Hold space for someone', 'Ask someone how they''re really doing today. Listen without trying to fix anything. Just be present.', 'kindness', 'Epictetus — Discourses', 'We have two ears and one mouth so that we can listen twice as much as we speak.', 'easy', 10),
('Reconnect with someone', 'Message someone you haven''t spoken to in over a month. No agenda — just check in.', 'kindness', 'Quran 4:1', 'Be mindful of the bonds between you.', 'medium', 15),
('Surprise kindness', 'Buy coffee, hold a door, carry someone''s groceries, leave a kind note. Do something small and unexpected for a stranger.', 'kindness', 'Sahih Muslim', 'Every act of kindness is charity.', 'easy', 10),
('Write a thank-you', 'Send a handwritten or thoughtful digital note to someone who helped you recently. Be specific about what they did.', 'kindness', 'Sunan Abu Dawud', 'Whoever does you a favor, reciprocate.', 'medium', 15),
('Forgive silently', 'Think of someone who wronged you — however small — and consciously let it go. No announcement needed. Just release it.', 'kindness', 'Quran 42:43', 'Whoever is patient and forgives — that is a matter of resolve.', 'hard', 25),
('Teach one thing', 'Share something you know with someone who could benefit — a shortcut, a concept, a skill. Teaching reinforces your own understanding.', 'knowledge', 'Sahih al-Bukhari', 'The best of you are those who learn and teach.', 'easy', 10),
('Read outside your lane', 'Spend 20 minutes reading about a field completely different from yours. Notice what it shares with your own work.', 'knowledge', 'Islamic tradition', 'Seek knowledge from the cradle to the grave.', 'easy', 10),
('Ask a deep question', 'Find someone with different expertise and ask them to explain what they find most fascinating about their work. Be genuinely curious.', 'knowledge', 'Sunan al-Tirmidhi', 'Wisdom is the lost property of the believer — take it wherever you find it.', 'medium', 15),
('Share a resource', 'Post or send a useful article, tool, or book to someone in your network who would benefit from it. Add a sentence about why you found it valuable.', 'knowledge', 'Sahih Muslim', 'When a person dies, their deeds end except for three: ongoing charity, beneficial knowledge, or a righteous child who prays for them.', 'easy', 10),
('Document what you learned today', 'Write down one thing you learned today — however small. The act of writing makes it stick.', 'knowledge', 'Ali ibn Abi Talib', 'Bind knowledge by writing it down.', 'easy', 10),
('Introduce two people', 'Think of two people in your life who don''t know each other but should. Make the introduction today.', 'community', 'Sahih Muslim', 'The believers are like one body.', 'medium', 20),
('Show up', 'Attend a community event, meetup, prayer, or gathering this week. Being present is half the contribution.', 'community', 'Sunan al-Tirmidhi', 'The hand of Allah is with the community.', 'medium', 15),
('Clean a shared space', 'The office kitchen. A park bench area. Your apartment hallway. Clean something that isn''t yours.', 'community', 'Sahih al-Bukhari', 'Removing harm from the road is charity.', 'easy', 10),
('Offer your skills for free', 'Find someone working on a project and offer to help with your specific expertise. One hour. No strings.', 'community', 'Sahih Muslim', 'Allah is in the aid of His servant as long as the servant is in the aid of his brother.', 'hard', 25),
('Amplify someone''s voice', 'In your next meeting or conversation, credit someone else''s idea. "I thought what [name] said about X was really insightful."', 'community', 'Seneca — Letters', 'We are waves of the same sea.', 'easy', 10),
('Start the day with intention', 'Before checking your phone, sit for 2 minutes and set one clear intention for the day. Write it down.', 'self', 'Sunan al-Hakim', 'Take advantage of five before five: your youth before old age, your health before sickness, your wealth before poverty, your free time before becoming busy, and your life before death.', 'easy', 10),
('Three gratitudes', 'Before bed tonight, write down three specific things that went well today. Not generic — specific moments.', 'self', 'Quran 14:7', 'If you are grateful, I will surely increase you in favor.', 'easy', 10),
('No complaints today', 'Go the entire day without complaining — out loud or in your head. When you catch yourself, reframe it.', 'self', 'Sahih al-Bukhari', 'A strong person is not one who can wrestle, but one who controls himself in anger.', 'hard', 25),
('Do the thing you''re avoiding', 'You know the task. The email. The conversation. The errand. Do it first thing today.', 'self', 'Marcus Aurelius — Meditations', 'Begin each day by telling yourself: today I shall meet with interference, ingratitude, insolence. But I shall not be disturbed.', 'medium', 20),
('Digital sabbatical', 'No social media for 24 hours. Notice what you do with the reclaimed time and attention.', 'self', 'Sahih al-Bukhari', 'Fasting is a shield.', 'hard', 25),
('Move your body', '30 minutes of intentional physical activity. Walk, stretch, workout — whatever feels right. Your body is a trust.', 'self', 'Sahih al-Bukhari', 'Your body has a right over you.', 'easy', 10),
('Give without being asked', 'Donate to a cause today — any amount. Or give your time. The point is to initiate generosity, not respond to a request.', 'generosity', 'Sahih al-Bukhari', 'Protect yourself from the Fire even by giving half a date in charity.', 'easy', 10),
('Tip generously', 'Next time you pay for a service today, tip 25% or more. Make someone''s day measurably better.', 'generosity', 'Sunan al-Tirmidhi', 'The generous person is near to Allah, near to people, near to Paradise.', 'easy', 10),
('Share your access', 'Share a job posting, a connection, an opportunity, or a resource with someone who needs it more than you do.', 'generosity', 'Sunan al-Daraqutni', 'The best of people are those most beneficial to people.', 'medium', 15),
('Mentor someone', 'Reach out to someone more junior in your field and offer 30 minutes of your time. No agenda — just "how can I help?"', 'generosity', 'Sahih al-Bukhari', 'The upper hand is better than the lower hand.', 'medium', 20),
('Call someone you love', 'Call — not text — a family member or close friend. Tell them something specific you appreciate about them.', 'gratitude', 'Quran 17:24', 'Lower to them the wing of humility out of mercy.', 'easy', 10),
('Public appreciation', 'Thank someone publicly for their work — in a meeting, on Slack, in a LinkedIn post. Specific, genuine, named.', 'gratitude', 'Sunan Abu Dawud', 'He who does not thank people does not thank Allah.', 'medium', 15),
('Gratitude for difficulty', 'Think of a hardship you''ve been through. Write down one way it made you stronger or taught you something valuable.', 'gratitude', 'Quran 94:5-6', 'Indeed, with hardship comes ease. Indeed, with hardship comes ease.', 'hard', 25),
('Notice abundance', 'Spend 5 minutes noticing everything you have that you take for granted — running water, eyesight, safety, food, people who care.', 'gratitude', 'Quran 55:13', 'Which of the favors of your Lord would you deny?', 'easy', 10);
