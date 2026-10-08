// SAMB Project Board domain: the prototype's rules as pure TypeScript (BRIEF §5, §9).
//
//   const d = createDomain(board, { today: '2026-10-07', appUrl, viewer })
//   d.taskFlags(t, d.project(t.projectId)); d.inbox(''); d.digestAll()
//
// Pure by construction: no I/O, no clock (today comes from ctx), no DOM, no globals. The same files
// are imported by the Deno Edge Function (M6), hence the explicit .ts import extensions.
import { makeCalendarLinks } from './cal.ts'
import type { CalendarLinks } from './cal.ts'
import { makeChecks } from './checks.ts'
import type { Checks } from './checks.ts'
import { makeDigest } from './digest.ts'
import type { DigestApi } from './digest.ts'
import { makeCalendar } from './holidays.ts'
import type { HolidayCalendar } from './holidays.ts'
import { makeInbox } from './inbox.ts'
import type { Inbox } from './inbox.ts'
import { makeIndex } from './lookup.ts'
import type { BoardIndex } from './lookup.ts'
import { makePermissions } from './permissions.ts'
import type { Permissions } from './permissions.ts'
import { makeRules } from './rules.ts'
import { makeAddressing } from './search.ts'
import type { Addressing } from './search.ts'
import type { Rules } from './rules.ts'
import type { Board, DateStr, DomainContext, Id } from './types.ts'
import { makeValueChain } from './valuechain.ts'
import type { ValueChain } from './valuechain.ts'
import { makeViews } from './views.ts'
import type { Views } from './views.ts'
import { makeWzTaskDefaults } from './wizard.ts'
import type { WzTaskDefaults } from './wizard.ts'

export interface Domain
  extends HolidayCalendar, Permissions, Rules, Checks, ValueChain, DigestApi, CalendarLinks, Views, Addressing {
  readonly board: Board
  readonly today: DateStr
  readonly appUrl: string
  person: BoardIndex['person']
  project: BoardIndex['project']
  task: BoardIndex['task']
  /** Milestone by id (prototype `mstone`). */
  mstone: BoardIndex['milestone']
  ptasks: BoardIndex['ptasks']
  pms: BoardIndex['pms']
  mtasks: BoardIndex['mtasks']
  ask: BoardIndex['ask']
  fn: BoardIndex['fn']
  children: BoardIndex['children']
  pasks: BoardIndex['pasks']
  roleOf: BoardIndex['roleOf']
  openBlocker: BoardIndex['openBlocker']
  blockersOf: BoardIndex['blockersOf']
  reviewsOf: BoardIndex['reviewsOf']
  commitmentsOf: BoardIndex['commitmentsOf']
  commentsOf: BoardIndex['commentsOf']
  projectEvents: BoardIndex['projectEvents']
  recordEvents: BoardIndex['recordEvents']
  /** '' = the viewer, '*' = everyone, a person id = as that person. */
  inbox: (who?: Id) => Inbox
  wzTaskDefaults: WzTaskDefaults
}

export function createDomain(board: Board, ctx: DomainContext): Domain {
  const ix = makeIndex(board)
  const cal = makeCalendar(board.holidays, board.settings)
  const perms = makePermissions(ix, ctx.viewer)
  const rules = makeRules(ix, ctx.today, perms)
  const checks = makeChecks(ix, cal, perms, rules, ctx.viewer !== null)
  const vc = makeValueChain(ix, rules)
  const inbox = makeInbox(ix, perms, rules, ctx.viewer)
  const views = makeViews({ ix, perms, rules, inbox, today: ctx.today, viewer: ctx.viewer })
  const addressing = makeAddressing(ix, rules, ctx.appUrl, (pid) => views.involved(pid))
  const digest = makeDigest({ ix, cal, rules, inbox, views, urlOf: addressing.urlOf, today: ctx.today, appUrl: ctx.appUrl })
  const links = makeCalendarLinks(ix, perms, rules, addressing.urlOf)
  return {
    board,
    today: ctx.today,
    appUrl: ctx.appUrl,
    person: ix.person,
    project: ix.project,
    task: ix.task,
    mstone: ix.milestone,
    ptasks: ix.ptasks,
    pms: ix.pms,
    mtasks: ix.mtasks,
    ask: ix.ask,
    fn: ix.fn,
    children: ix.children,
    pasks: ix.pasks,
    roleOf: ix.roleOf,
    openBlocker: ix.openBlocker,
    blockersOf: ix.blockersOf,
    reviewsOf: ix.reviewsOf,
    commitmentsOf: ix.commitmentsOf,
    commentsOf: ix.commentsOf,
    projectEvents: ix.projectEvents,
    recordEvents: ix.recordEvents,
    ...cal,
    ...perms,
    ...rules,
    ...checks,
    ...vc,
    inbox,
    ...views,
    ...addressing,
    ...digest,
    ...links,
    wzTaskDefaults: makeWzTaskDefaults(cal, ctx.today),
  }
}

// Context-free utilities.
export {
  addDays,
  DAY_NAMES,
  dn,
  dow,
  ds,
  fmt,
  fmtLong,
  fmtTs,
  isoWeek,
  isWeekend,
  pad,
  range,
  tsToDate,
  weekStartOf,
} from './dates.ts'
export { escapeHtml, hash, initials, linkify } from './format.ts'
export type { LinkSegment } from './format.ts'
export { AVC, EMAIL_RE, GRADS, MATURITY, MS_LABEL, P_LABEL, STAGES, stageName } from './constants.ts'
export type { StageInfo } from './constants.ts'
export { CAL_PROV } from './cal.ts'
export { DB_COMMIT_RULE } from './rules.ts'
export { makeCalendar } from './holidays.ts'

export type { CalendarLinks, CalIssue, CalProvider } from './cal.ts'
export type { Checks, Flag, FlagLevel, NextStep, NextStepAction } from './checks.ts'
export type {
  Digest,
  DigestApi,
  DigestEmail,
  DigestItem,
  DigestRun,
  DigestSection,
  DigestSkip,
  Email,
  ReminderOut,
  ReminderSkip,
} from './digest.ts'
export type { HolidayCalendar } from './holidays.ts'
export type { Inbox } from './inbox.ts'
export type { BoardIndex } from './lookup.ts'
export type { Permissions } from './permissions.ts'
export type {
  Chip,
  ChipKind,
  CommitIntent,
  CommitResult,
  Health,
  HealthLevel,
  Progress,
  Readiness,
  Rules,
  SeqConflict,
  Slip,
} from './rules.ts'
export type { ValueChain, VcModule, VcStat, VcState, VcSteps } from './valuechain.ts'
export { VIEWS, daysSince } from './views.ts'
export type {
  ActionItem,
  ActionKind,
  FunctionLoad,
  PortfolioFilter,
  PortfolioRow,
  RecordKind,
  RecordTarget,
  ReviewSections,
  ScheduleItem,
  Tone,
  ViewId,
  ViewSpec,
  Views,
  WaitItem,
} from './views.ts'
export { bareTitle, projectPath, recordPath } from './search.ts'
export type { Addressing, HitKind, SearchHit } from './search.ts'
export type { TaskDates, WzTaskDefaults } from './wizard.ts'
export type * from './types.ts'
