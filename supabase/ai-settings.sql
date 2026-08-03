-- Safe to rerun after supabase/schema.sql.
-- API keys remain browser-local and are intentionally not stored here.
alter table public.user_settings add column if not exists ai_provider text not null default 'openrouter';
alter table public.user_settings add column if not exists ai_base_url text not null default 'https://openrouter.ai/api/v1';
alter table public.user_settings add column if not exists ai_model text not null default 'openrouter/auto';
alter table public.user_settings add column if not exists ai_test_ok boolean;
alter table public.user_settings add column if not exists ai_test_error text;
alter table public.user_settings add column if not exists ai_tested_at timestamptz;

comment on column public.user_settings.ai_base_url is 'User-selected OpenAI-compatible API base URL. No credentials are stored.';
comment on column public.user_settings.ai_model is 'Free-form model identifier selected or pasted by the user.';
comment on column public.user_settings.ai_test_ok is 'Result of the most recent explicit hello connectivity test.';
