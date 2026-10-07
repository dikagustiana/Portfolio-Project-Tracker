// Beranda (spec §26–27, §38–40): a personal attention surface, not a management dashboard.
// Order: Perlu tindakan → Kerja saya → Menunggu orang lain → Minggu ini. Project admins and the
// super admin then get oversight (projects needing intervention, open Keputusan, function load);
// recent activity comes last. Every block is a product view (src/domain/views.ts).
import { Head, Icon } from '../app/bits.tsx'
import { useFlows } from '../app/flows.ts'
import { openProject } from '../app/nav.ts'
import { go } from '../app/ui.ts'
import { useBoard } from '../data/board-context.ts'
import { addDays, fmt, fmtLong, weekStartOf } from '../domain/index.ts'
import { ActionRows, ScheduleRows, WaitRows } from './lists.tsx'
import { ProgBar, RecordLine, Section, Tag, TaskLine, Timeline } from './record/parts.tsx'
import { CalIssues } from './Week.tsx'

export function Home() {
  const { d, board, viewer, today, extras } = useBoard()
  const flows = useFlows()
  const me = d.person(viewer.personId)
  const first = me?.name.split(/\s+/)[0] ?? ''
  const actions = d.actions('')
  const mine = d.myWork('')
  const fnWork = d.functionWork('')
  const waiting = d.waiting('')
  const ws = weekStartOf(today)
  const weekItems = d.week(ws, '').filter((x) => x.date >= today)
  const nextWeek = d.week(addDays(ws, 7), '').slice(0, 4)
  const admin = board.projects.filter((p) => d.roleIn(p.id) === 'project_admin')
  const oversee = viewer.isSuperAdmin ? board.projects : admin
  const rows = d.portfolio().filter((r) => oversee.some((p) => p.id === r.p.id))
  const attention = d.portfolioFilter(rows, 'attention')
  const openAsks = d.openAsks().filter((a) => oversee.some((p) => p.id === a.projectId))
  const load = d.functionLoad()
  const events = board.events.filter((e) => e.verb !== 'comment_added' && e.verb !== 'member_added').sort((a, b) => b.at - a.at)
  const noProjects = board.projects.length === 0
  const calCount = d.calIssues(extras.calendar).length

  const head = (
    <Head
      eyebrow={fmtLong(today)}
      title={first ? `Halo, ${first}` : 'Beranda'}
      actions={
        <>
          <button className="btn w wc" onClick={flows.startWizard}>
            <Icon name="plus" /> Project baru
          </button>
          {board.projects.some((p) => d.isAdminIn(p.id)) && (
            <button className="btn" onClick={() => flows.invite()}>
              Undang anggota
            </button>
          )}
        </>
      }
    />
  )

  if (noProjects)
    return (
      <>
        {head}
        <section className="sec">
          <h2 style={{ fontSize: 17, marginBottom: 6 }}>Belum ada project untukmu</h2>
          <p className="sub" style={{ margin: 0, fontSize: 14, maxWidth: '60ch' }}>
            {viewer.isSuperAdmin
              ? 'Mulai dengan membuat project pertama: tetapkan hasil akhirnya, susun milestone mundur, lalu pecah jadi task. Undang anggota dan beri akses per project.'
              : 'Kamu belum menjadi anggota project mana pun. Project hanya terlihat setelah admin project memberimu akses.'}
          </p>
          {viewer.isSuperAdmin && (
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={flows.startWizard}>
                <Icon name="plus" /> Buat project
              </button>
              <button className="btn" onClick={() => flows.invite()}>
                Undang anggota
              </button>
            </div>
          )}
        </section>
      </>
    )

  return (
    <>
      {head}
      <p className="lede">
        Kamu punya akses ke <b>{board.projects.length} project</b>.{' '}
        {actions.length + calCount ? (
          <>
            <b>{actions.length + calCount} hal</b> menunggu tindakanmu.
          </>
        ) : (
          'Tidak ada yang menunggu tindakanmu.'
        )}
        {mine.length ? ` ${mine.length} task aktif atas namamu.` : ''}
      </p>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="col">
          <CalIssues entries={extras.calendar} />
          <Section title="Perlu tindakan" n={actions.length} more="Minggu ini" onMore={() => go({ view: 'week' })}>
            <ActionRows items={actions} limit={7} />
          </Section>
          <Section title="Kerja saya" n={mine.length}>
            {mine.length ? (
              <div className="rows">
                {mine.slice(0, 8).map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <div className="empty-line">Tidak ada task aktif atas namamu.</div>
            )}
            {mine.length > 8 && (
              <button className="linkbtn" style={{ marginTop: 6 }} onClick={() => go({ view: 'week' })}>
                Lihat semua di Minggu ini
              </button>
            )}
          </Section>
          {fnWork.length > 0 && (
            <Section title={`Milik fungsi saya · ${d.fn(me?.functionId)?.name ?? ''}`} n={fnWork.length}>
              <div className="sub" style={{ marginBottom: 6 }}>Tanggung jawab fungsimu yang belum punya PIC bernama.</div>
              <div className="rows">
                {fnWork.slice(0, 6).map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </div>
            </Section>
          )}
        </div>
        <div className="col">
          <Section title="Menunggu orang lain" n={waiting.length}>
            <WaitRows items={waiting} limit={6} />
          </Section>
          <Section title="Minggu ini" n={weekItems.length} more="Buka jadwal" onMore={() => go({ view: 'week' })}>
            {weekItems.length ? <ScheduleRows items={weekItems} limit={8} /> : <div className="empty-line">Tidak ada jadwal lagi di minggu ini.</div>}
            {nextWeek.length > 0 && (
              <div className="sub" style={{ marginTop: 8 }}>
                Minggu depan: {nextWeek.map((x) => `${x.ref} ${x.label.toLowerCase()} ${fmt(x.date)}`).join(' · ')}
              </div>
            )}
          </Section>
        </div>
      </div>

      {oversee.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '28px 0 12px' }}>
            {viewer.isSuperAdmin ? 'Pengawasan portofolio' : 'Project yang kamu kelola'}
          </h2>
          <div className="grid2" style={{ alignItems: 'start' }}>
            <div className="col">
              <Section title="Perlu perhatian" n={attention.length} more="Portofolio" onMore={() => go({ view: 'portfolio', pf: 'attention' })}>
                {attention.length ? (
                  <div className="rows">
                    {attention.slice(0, 6).map((r) => (
                      <button key={r.p.id} className="li" onClick={() => openProject(d, r.p.id)}>
                        <span className="ref">{r.p.code}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="tt">{r.p.name}</div>
                          <div className="sub">{r.health?.items.slice(0, 2).join(' · ')}</div>
                        </div>
                        <div className="end" style={{ width: 120 }}>
                          <ProgBar p={r.prog.p} tone={r.health?.level === 'bad' ? 'red' : 'amber'} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-line">Semua project yang kamu kelola sehat.</div>
                )}
              </Section>
              <Section title="Keputusan terbuka" n={openAsks.length} more="Keputusan" onMore={() => go({ view: 'decisions' })}>
                {openAsks.length ? (
                  <div className="rows">
                    {openAsks.slice(0, 6).map((a) => (
                      <RecordLine
                        key={a.id}
                        target={{ kind: 'ask', id: a.id }}
                        r={a.ref}
                        title={a.question}
                        sub={`${d.project(a.projectId)?.name ?? ''} · pemutus ${d.mname(d.deciderOf(a)) || 'PM'}`}
                        tone={a.due && a.due < today ? 'red' : 'amber'}
                        label={a.due ? (a.due < today ? `Lewat ${fmt(a.due)}` : `Batas ${fmt(a.due)}`) : 'Terbuka'}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-line">Tidak ada keputusan yang terbuka.</div>
                )}
              </Section>
            </div>
            <div className="col">
              {load.length > 0 && (
                <Section title="Beban per fungsi" n={load.length} more="Orang" onMore={() => go({ view: 'team' })}>
                  <div className="rows">
                    {load.slice(0, 6).map((f) => (
                      <div key={f.functionId} className="li static">
                        <span className="ref">{f.open}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="tt">{f.name}</div>
                          <div className="sub">
                            {f.open} task terbuka{f.unstaffed ? ` · ${f.unstaffed} tanpa PIC` : ''}
                            {f.people ? ` · ${f.people} orang` : ' · belum ada orang'}
                          </div>
                        </div>
                        <div className="end">
                          {f.blocked > 0 && <Tag tone="red">{f.blocked} terhambat</Tag>}
                          {f.late > 0 && <Tag tone="red">{f.late} telat</Tag>}
                          {!f.blocked && !f.late && f.unstaffed > 0 && <Tag tone="amber">Perlu PIC</Tag>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              <Section title="Aktivitas terakhir" more="Tinjauan mingguan" onMore={() => go({ view: 'review' })}>
                <Timeline events={events} limit={6} empty="Belum ada aktivitas tercatat." />
              </Section>
            </div>
          </div>
        </>
      )}
      {oversee.length === 0 && events.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Section title="Aktivitas terakhir">
            <Timeline events={events} limit={5} />
          </Section>
        </div>
      )}
    </>
  )
}
