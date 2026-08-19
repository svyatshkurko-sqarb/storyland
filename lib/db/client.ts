/**
 * Supabase-клієнт для серверного коду (API routes). Потребує реальних
 * ключів у .env.local (локально) і у Vercel project settings (прод) —
 * див. .env.example. Без них створення клієнта відпрацює без помилки,
 * але перший реальний запит впаде з auth-помилкою — тому виклики БД
 * в route.ts обгорнуті в try/catch і не блокують генерацію казки
 * (persistence — додаткова цінність, не критичний шлях для дитини).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Відсутні NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Скопіюйте .env.example у .env.local і заповніть реальними значеннями з Supabase Dashboard → Project Settings → API.",
    );
  }

  cachedClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
