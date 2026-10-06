import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * The single browser client, using the publishable key only. Access control lives in
 * Postgres (RLS + RPCs); nothing in the client is trusted. Null until the environment
 * is configured, so the empty app builds and runs without a backend.
 */
export const supabase = url && key ? createClient(url, key) : null

export const supabaseConfigured = supabase !== null
