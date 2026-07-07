-- Migration to create the analyzed_resumes table for history tracking
-- Run this block directly in the Supabase SQL Editor (https://supabase.com/dashboard)

create table if not exists public.analyzed_resumes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  resume_name text not null,
  job_description text not null,
  resume_text text not null,
  analysis_result jsonb not null,
  tailored_summary text,
  tailored_skills text,
  tailored_experience text,
  created_at timestamptz default now() not null
);

-- Enable Row Level Security (RLS)
alter table public.analyzed_resumes enable row level security;

-- Drop existing policies if they exist (to avoid duplication errors on re-run)
drop policy if exists "Users can view their own analyzed resumes" on public.analyzed_resumes;
drop policy if exists "Users can insert their own analyzed resumes" on public.analyzed_resumes;
drop policy if exists "Users can update their own analyzed resumes" on public.analyzed_resumes;
drop policy if exists "Users can delete their own analyzed resumes" on public.analyzed_resumes;

-- Create CRUD policies matching user_id with active auth.uid()
create policy "Users can view their own analyzed resumes" 
  on public.analyzed_resumes for select 
  using (auth.uid() = user_id);

create policy "Users can insert their own analyzed resumes" 
  on public.analyzed_resumes for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own analyzed resumes" 
  on public.analyzed_resumes for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own analyzed resumes" 
  on public.analyzed_resumes for delete 
  using (auth.uid() = user_id);

-- Create index on user_id for optimal querying
create index if not exists analyzed_resumes_user_id_idx on public.analyzed_resumes (user_id);
