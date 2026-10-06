import { createClient } from '@supabase/supabase-js'
import type { Database } from '../data/database.types.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * The single browser client, using the publishable key only. Access control lives in
 * Postgres (RLS + RPCs); nothing in the client is trusted. Null until the environment
 * is configured, so the app still builds and shows a configuration notice without a backend.
 */
export const supabase =
  url && key
    ? createClient<Database>(url, key, {
        // Implicit flow: magic and invite links work even when opened in another browser
        // (phone mail app). supabase-js reads the token from the URL and clears it.
        auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true },
      })
    : null

export const supabaseConfigured = supabase !== null

export type Supa = NonNullable<typeof supabase>
