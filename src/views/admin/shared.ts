// Owner admin helpers. Admin tables are written directly; RLS lets only the owner through.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useOverlay } from '../../app/overlay-context.ts'
import type { BoardTable } from '../../data/adapter.ts'
import { useBoard } from '../../data/board-context.ts'
import { supabase } from '../../lib/supabase.ts'
import type { Supa } from '../../lib/supabase.ts'

interface DbError {
  message: string
  code?: string
}

const FRIENDLY: Record<string, string> = {
  '23505': 'Data ini sudah ada (email, kode, atau tanggal dipakai lagi).',
  '23503': 'Data ini masih dipakai di tempat lain, jadi tidak bisa dihapus.',
  '23514': 'Isian tidak memenuhi aturan.',
  '42501': 'Hanya owner yang bisa mengubah ini.',
}

export const dbMessage = (e: DbError): string =>
  /^(new row violates|permission denied|duplicate key|update or delete on table|insert or update on table)/.test(e.message)
    ? (FRIENDLY[e.code ?? ''] ?? e.message)
    : e.message

export function supa(): Supa {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  return supabase
}

/** Run an admin write, toast the outcome, and refetch the touched tables. Returns success. */
export function useAdminWrite() {
  const { toast } = useOverlay()
  const { refreshTable } = useBoard()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const run = async (
    write: (s: Supa) => PromiseLike<{ error: DbError | null }>,
    ok: string,
    tables: (BoardTable | 'admin')[],
  ): Promise<boolean> => {
    setBusy(true)
    try {
      const { error } = await write(supa())
      if (error) {
        toast(dbMessage(error))
        return false
      }
      await Promise.all(
        tables.map((t) => (t === 'admin' ? qc.invalidateQueries({ queryKey: ['admin'] }) : refreshTable(t))),
      )
      if (ok) toast(ok)
      return true
    } finally {
      setBusy(false)
    }
  }
  return { run, busy }
}

export interface PersonStatus {
  person_id: string
  user_id: string | null
  email: string | null
  last_sign_in_at: string | null
  invited_at: string | null
}

/** Owner-only extras: login status, app roles, pending roles, holiday sources. */
export function useAdminData() {
  const status = useQuery({
    queryKey: ['admin', 'people_status'],
    queryFn: async () => {
      const { data, error } = await supa().rpc('admin_people_status')
      if (error) throw new Error(error.message)
      // Generated types mark the columns non-null; logins and contacts can be missing.
      const rows: PersonStatus[] = data ?? []
      return rows
    },
  })
  const roles = useQuery({
    queryKey: ['admin', 'app_roles'],
    queryFn: async () => {
      const [a, p] = await Promise.all([supa().from('app_roles').select('*'), supa().from('pending_app_roles').select('*')])
      if (a.error) throw new Error(a.error.message)
      if (p.error) throw new Error(p.error.message)
      return { active: a.data, pending: p.data }
    },
  })
  const holidays = useQuery({
    queryKey: ['admin', 'holidays'],
    queryFn: async () => {
      const { data, error } = await supa().from('holidays').select('*').order('date')
      if (error) throw new Error(error.message)
      return data
    },
  })
  return { status, roles, holidays }
}
