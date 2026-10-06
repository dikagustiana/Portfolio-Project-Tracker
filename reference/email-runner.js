/*
 * SAMB Project Board — penyusun email harian.
 *
 * Menjalankan halaman app yang sama (index.html) di dalam jsdom, mengisi datanya
 * dari salinan database, lalu memanggil GPM.digestAll() milik app. Dengan begitu
 * isi email selalu memakai aturan yang persis sama dengan halaman "Minggu ini".
 *
 * Pakai:
 *   npm install jsdom@24
 *   TZ=Asia/Jakarta node email-runner.js <halaman.html> <folder-data> <hasil.json> [YYYY-MM-DD]
 *
 * <folder-data> berisi satu subfolder per koleksi (projects, tasks, members, ...),
 * masing-masing berisi <id>.json — persis format ekspor ArtifactData `list` dengan `out_dir`.
 * Hasil: JSON { date, workday, paused, reason?, emails:[{memberId,name,to,subject,text,html,count}], skipped:[...],
 *   reminders:[{id,taskId,memberId,name,to,subject,text,html}], reminderSkips:[{id,taskId,reason}] }.
 * Email harian hanya dikirim di hari kerja; pengingat manual ikut dikirim kapan pun mesin dijalankan (kecuali dijeda).
 * Script ini tidak mengirim apa pun.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const [pagePath, dataDir, outPath, dateArg] = process.argv.slice(2);
if (!pagePath || !dataDir || !outPath) {
  console.error('Pakai: node email-runner.js <halaman.html> <folder-data> <hasil.json> [YYYY-MM-DD]');
  process.exit(2);
}
if (process.env.TZ !== 'Asia/Jakarta') console.warn('Peringatan: jalankan dengan TZ=Asia/Jakarta supaya "hari ini" mengikuti WIB.');

let html = fs.readFileSync(pagePath, 'utf8');
if (!/<body[\s>]/i.test(html)) html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>';

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://samb.local/', pretendToBeVisual: false });
const w = dom.window;
w.scrollTo = () => {};
const errors = [];
w.addEventListener('error', e => errors.push(e.message));

function readCollection(col) {
  const dir = path.join(dataDir, col);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const body = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !raw.name ? raw.data : raw;
    return { ...body, id: f.replace(/\.json$/, '') };
  });
}

setTimeout(() => {
  try {
    if (!w.GPM) throw new Error('Halaman tidak memuat GPM. Pastikan file yang dipakai adalah halaman SAMB Project Board terbaru.');
    const cols = w.GPM.COLS;
    const data = {};
    cols.forEach(c => { data[c] = readCollection(c); });
    w.__DATA = data;
    w.eval('GPM.COLS.forEach(c=>{S[c]=__DATA[c]||[];loaded.add(c)})');
    const result = w.GPM.digestAll(dateArg || undefined);
    result.counts = Object.fromEntries(cols.map(c => [c, data[c].length]));
    if (errors.length) result.pageErrors = errors;
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`Tanggal ${result.date} · hari kerja: ${result.workday} · dijeda: ${result.paused} · email harian: ${result.emails.length} · dilewati: ${result.skipped.length} · pengingat: ${(result.reminders||[]).length} · pengingat dibatalkan: ${(result.reminderSkips||[]).length}${result.reason ? ' · ' + result.reason : ''}`);
    process.exit(errors.length ? 1 : 0);
  } catch (e) {
    console.error('Gagal menyusun email:', e.message, errors);
    process.exit(1);
  }
}, 400);
