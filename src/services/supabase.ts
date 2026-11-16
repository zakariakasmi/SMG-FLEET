import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { createMockSupabaseClient } from './mockSupabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasValidConfig =
  typeof supabaseUrl === 'string' &&
  /^https?:\/\//i.test(supabaseUrl.trim()) &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.trim().length > 0

export const isMockSupabase = !hasValidConfig

if (isMockSupabase) {
  console.info('[SMG Fleet] Supabase env vars not configured — running with in-memory demo database.')
}

export const supabase: SupabaseClient<Database> = hasValidConfig
  ? createClient<Database>(supabaseUrl.trim(), supabaseAnonKey.trim(), { auth: { persistSession: true } })
  : (createMockSupabaseClient() as unknown as SupabaseClient<Database>)