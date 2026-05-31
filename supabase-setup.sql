-- ════════════════════════════════════════════════════════
--  StudyLog — Supabase Database Setup
--  Run this in your Supabase project:
--  Dashboard → SQL Editor → New Query → Paste & Run
-- ════════════════════════════════════════════════════════

-- 1. PROFILES
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  daily_goal integer default 240,
  theme text default 'dark',
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- 2. SUBJECTS
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
alter table subjects enable row level security;
create policy "Users manage own subjects" on subjects for all using (auth.uid() = user_id);

-- 3. SESSIONS
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  subject text not null,
  start_time time not null,
  end_time time not null,
  duration integer not null,  -- in minutes
  category text default 'study',
  notes text,
  created_at timestamptz default now()
);
alter table sessions enable row level security;
create policy "Users manage own sessions" on sessions for all using (auth.uid() = user_id);

-- 4. ACHIEVEMENTS
create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_id text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, badge_id)
);
alter table achievements enable row level security;
create policy "Users manage own achievements" on achievements for all using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════
--  Done! Now:
--  1. Go to Authentication → Settings
--  2. Set "Site URL" to http://127.0.0.1:5500 (for local dev)
--     or your deployed Vercel URL
--  3. Open supabase-config.js and paste your URL + anon key
-- ════════════════════════════════════════════════════════

-- 5. TASKS (run this if not yet added)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  type text not null default 'daily',
  priority text not null default 'medium',
  category text,
  subject text,
  start_datetime timestamptz,
  end_datetime timestamptz,
  notes text,
  done boolean default false,
  created_at timestamptz default now()
);
alter table tasks enable row level security;
create policy "Users manage own tasks" on tasks for all using (auth.uid() = user_id);

-- 6. TASK SUBJECTS (separate from session subjects)
create table if not exists task_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
alter table task_subjects enable row level security;
create policy "Users manage own task subjects" on task_subjects for all using (auth.uid() = user_id);
