-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.stylix_users (
    username text PRIMARY KEY,
    password text NOT NULL,
    email text,
    mobile text,
    theme text DEFAULT 'classic',
    role text DEFAULT 'user',
    whatsapp_linked boolean DEFAULT false,
    telegram_linked boolean DEFAULT false
);

-- 2. Wardrobe Items Table
CREATE TABLE IF NOT EXISTS public.wardrobe_items (
    id text PRIMARY KEY,
    username text REFERENCES public.stylix_users(username) ON DELETE CASCADE,
    name text NOT NULL,
    category text NOT NULL,
    color text NOT NULL,
    fabric text,
    formality text,
    pattern text,
    style_tag text,
    is_clean boolean DEFAULT true,
    last_worn_date text,
    image_data text
);

-- 3. Style Profiles Table
CREATE TABLE IF NOT EXISTS public.style_profiles (
    username text PRIMARY KEY REFERENCES public.stylix_users(username) ON DELETE CASCADE,
    preferred_colors jsonb,
    avoided_colors jsonb,
    avoided_styles jsonb,
    formality_bias text,
    category_weights jsonb,
    color_weights jsonb,
    formality_weights jsonb,
    pattern_weights jsonb
);

-- 4. Routine Plans Table
CREATE TABLE IF NOT EXISTS public.routine_plans (
    id text PRIMARY KEY,
    username text REFERENCES public.stylix_users(username) ON DELETE CASCADE,
    day_index integer NOT NULL,
    day_name text NOT NULL,
    date_label text NOT NULL,
    occasion text,
    assigned_outfit jsonb,
    status text DEFAULT 'Empty',
    rating text
);

-- 5. Chat History Table
CREATE TABLE IF NOT EXISTS public.chat_history (
    id serial PRIMARY KEY,
    username text REFERENCES public.stylix_users(username) ON DELETE CASCADE,
    sender text NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security (RLS) for testing, or set policies to allow public reads/writes
ALTER TABLE public.stylix_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wardrobe_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history DISABLE ROW LEVEL SECURITY;

-- Pre-populate the super admin account
INSERT INTO public.stylix_users (username, password, role)
VALUES ('admin', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;
