// Supabase settings. On Vercel set the environment variables VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY (Project Settings -> Environment Variables); locally you can use a .env file.
// Without them the app runs in demo mode (everything stays in the browser).
// The anon key is public by design; Row Level Security protects the data.
export const config = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || 'YOUR-ANON-KEY',
};
