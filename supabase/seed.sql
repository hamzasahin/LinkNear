-- =============================================================================
-- LinkNear seed data (demo profiles)
-- =============================================================================
-- NOTE: These profiles won't have matching auth.users entries, so you can't
-- sign in as them. They're purely for populating the discover grid during
-- local development. Delete them before launching to real users.
--
-- Production applies CHECK constraints on skills/interests array length (<=20),
-- lat/lng bounds, and the `looking_for` enum. The rows below all satisfy them.
-- =============================================================================

-- Temporarily disable the FK to auth.users so we can insert without real users.
-- (Supabase SQL editor runs as the DB owner, which can bypass the FK.)
-- If this errors, drop the demo profiles by running: DELETE FROM profiles WHERE id IN (...);

INSERT INTO profiles (
  id, full_name, headline, bio, skills, interests, looking_for,
  latitude, longitude, location_name, is_online, last_seen,
  discovery_enabled, terms_accepted_at, onboarding_completed_at
) VALUES
(
  gen_random_uuid(),
  'Alex Chen',
  'ML Engineer at DeepMind',
  'Building neural nets by day, hiking by weekend. Passionate about responsible AI.',
  ARRAY['Python','PyTorch','MLOps','Kubernetes','TensorFlow'],
  ARRAY['AI Ethics','Hiking','Open Source','Photography'],
  'collaborator',
  37.338, -121.886, 'San Jose, CA',
  true, now(),
  true, now(), now()
),
(
  gen_random_uuid(),
  'Sara Kim',
  'UX Designer & Researcher',
  'Human-centered design advocate. Previously at Airbnb.',
  ARRAY['Figma','User Research','Prototyping','CSS','Design Systems'],
  ARRAY['Accessibility','Yoga','Travel','Startups'],
  'cofounder',
  37.336, -121.891, 'Downtown San Jose',
  true, now(),
  true, now(), now()
),
(
  gen_random_uuid(),
  'Marcus Johnson',
  'Full Stack Dev | React + Node',
  'Building products that matter. Open to side projects.',
  ARRAY['React','TypeScript','Node.js','PostgreSQL','GraphQL'],
  ARRAY['Startups','Gaming','Music Production','Fitness'],
  'networking',
  37.350, -121.910, 'Santa Clara',
  false, now() - interval '2 hours',
  true, now(), now()
),
(
  gen_random_uuid(),
  'Priya Patel',
  'Data Scientist @ Netflix',
  'Stats nerd, coffee lover. Looking to mentor juniors.',
  ARRAY['Python','R','SQL','Tableau','Statistics','Spark'],
  ARRAY['Data Viz','Reading','Cooking','AI Ethics'],
  'mentor',
  37.323, -121.920, 'Campbell, CA',
  true, now(),
  true, now(), now()
),
(
  gen_random_uuid(),
  'Jordan Lee',
  'CS Student at SJSU',
  'Sophomore looking for study buddies and internship tips!',
  ARRAY['Java','Python','React','Git','Algorithms'],
  ARRAY['Algorithms','Gaming','Anime','Hackathons'],
  'study-buddy',
  37.335, -121.881, 'SJSU Campus',
  true, now(),
  true, now(), now()
),
(
  gen_random_uuid(),
  'Emily Torres',
  'Product Manager | B2B SaaS',
  'Bridging tech and business. Love building 0-to-1.',
  ARRAY['Product Strategy','Agile','SQL','Analytics','Roadmapping'],
  ARRAY['Startups','Public Speaking','Running','Podcasts'],
  'networking',
  37.370, -121.922, 'Sunnyvale, CA',
  false, now() - interval '1 day',
  true, now(), now()
),
(
  gen_random_uuid(),
  'Raj Mehta',
  'Firmware Engineer | IoT',
  'Embedded systems and automation. Building smart devices.',
  ARRAY['C','C++','Python','Embedded Systems','IoT','RTOS'],
  ARRAY['Robotics','Open Source','Hiking','Climate Tech'],
  'collaborator',
  37.354, -121.955, 'Cupertino, CA',
  true, now(),
  true, now(), now()
),
(
  gen_random_uuid(),
  'Nadia Volkov',
  'DevRel & Open Source Advocate',
  'Making tech more accessible. Conference speaker.',
  ARRAY['JavaScript','TypeScript','Technical Writing','DevOps','Community'],
  ARRAY['Open Source','Public Speaking','Education','Travel'],
  'networking',
  37.387, -122.057, 'Mountain View, CA',
  false, now() - interval '15 minutes',
  true, now(), now()
);
