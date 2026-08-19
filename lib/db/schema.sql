-- Storyland — схема БД (Supabase Postgres), Крок 2-3 міграції (Варіант А).
--
-- Це НЕ повна схема з архітектурного документа (story_state 19 полів,
-- acceptance_checks 27 полів) — та розрахована на повну 8-кроквеу pipeline,
-- яка ще не підключена (наступний інкремент Кроку 3). Тут — мінімум, що дає
-- реальну persistence поверх наявного простого 2-кроквого циклу
-- генерація+верифікація.
--
-- Крок 3, інкремент 1 (totalScenes/choice_type за фреймворком): додано
-- scene_kind ('choice'|'transition'|'final') і розширено choice_type до
-- 3 значень фреймворку. Старі значення 'сюжетний'/'тематичний' лишені у
-- CHECK для сумісності з рядками, записаними до цієї міграції.
--
-- Дизайн-рішення: історія записується в БД ОДНИМ разом, коли генерується
-- фінальна сцена (route.ts має на той момент повний sceneContextHistory
-- від клієнта). Це свідомо просто: не намагаємось персистити кожну сцену
-- окремо, бо клієнт pregenerate-ить ОБИДВА варіанти наступної сцени (A і B)
-- ще до вибору дитини — якби писали в БД одразу при генерації, довелося б
-- або дублювати записи для недо-обраної гілки, або городити логіку
-- "скасувати" непотрібний запис. Ціна цього спрощення: якщо дитина не
-- дійшла до фіналу (закрила вкладку), ця сесія в БД не зʼявиться взагалі.
-- Прийнятно для MVP; повноцінний per-scene запис (включно з незавершеними
-- сесіями) — можливе покращення в Кроці 3 разом з acceptance_checks.
--
-- Виконати: Supabase Dashboard → SQL Editor → вставити весь файл → Run.

create extension if not exists "pgcrypto";

create table if not exists stories (
  story_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  skill text not null check (skill in ('self_regulation', 'relationships')),
  skill_subtopic text not null,
  character text not null check (character in ('explorer', 'observer')),
  character_name text not null,
  location text not null check (location in ('forest', 'space', 'city', 'home')),
  age_band text not null check (age_band in ('3-5', '6-8')),
  total_scenes int not null default 4,
  status text not null default 'completed' check (status in ('completed', 'error'))
);

create table if not exists scenes (
  scene_id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(story_id) on delete cascade,
  scene_number int not null,
  created_at timestamptz not null default now(),
  is_final boolean not null default false,
  scene_kind text not null default 'choice' check (scene_kind in ('choice', 'transition', 'final')),
  scene_text text,
  choice_type text check (choice_type in ('пригодницький', 'тематично-контрастний', 'інтеграційний', 'сюжетний', 'тематичний', null)),
  chosen_option text check (chosen_option in ('A', 'B', null)),
  chosen_choice_text text,
  unchosen_choice_text text,
  used_maybe_phrase boolean default false,
  used_etiquette boolean default false,
  unique (story_id, scene_number)
);

create table if not exists caregiver_summaries (
  summary_id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(story_id) on delete cascade,
  created_at timestamptz not null default now(),
  skill_name text,
  skill_in_plain_language text,
  why_it_matters text,
  try_today text,
  caregiver_phrase text,
  optional_extra_idea text,
  childhood_memory_prompt text,
  alternative text, -- збережено з попередньої версії, понад специфікацію фреймворку
  parent_prompt text -- збережено з попередньої версії, понад специфікацію фреймворку
);

create index if not exists idx_scenes_story on scenes(story_id);
create index if not exists idx_summaries_story on caregiver_summaries(story_id);
create index if not exists idx_stories_skill_char_loc on stories(skill, character, location);
