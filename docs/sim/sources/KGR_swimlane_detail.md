# Swimlane KGR — detail lengkap

Sumber: database produksi `personal-os` (tabel `os_process_*`, `entity_code = 'KGR'`), dibaca 7 Oktober 2026. Hanya dibaca, tidak ada yang diubah.

> Salinan repositori: setiap blok **Catatan** (teks bebas) dihapus oleh `scripts/kgr-swimlane.ts redact`; isi lain sama dengan ekspor pemilik.

## Ringkasan

- **48 step** di **9 lane**, **15 fase** (10 ribbon default + 5 ribbon khusus Trading), **42 gate** (TBC-xx), **135 kebutuhan data**.
- Jalur: RPA 25 step · TRADING 10 step · BERSAMA (KEDUANYA) 13 step. Filter **RPA** menampilkan 38 step, filter **Trading** 23 step.
- Form (sub-filter RPA): OLAHAN = step 14, 15, 21 · KARKAS = step 17.
- Status kebutuhan data: **ADA 9** · **SEBAGIAN 34** · **BELUM 92** (68% belum). Belum ada satu pun yang diisi `requested_on`.
- 13 kebutuhan tanpa owner dan tanpa sumber — semuanya di jalur Trading (T2, T3, T5–T10). Step T1–T10 juga belum punya dokumen, driver, maupun gate.
- 16 dari 42 gate tidak dirujuk step mana pun: TBC-02, TBC-04, TBC-05, TBC-08, TBC-12, TBC-17, TBC-18, TBC-19, TBC-21, TBC-29, TBC-30, TBC-31, TBC-32, TBC-38, TBC-39, TBC-VOL.
- Tabel jembatan ke Finish line (`os_process_step_items`) untuk KGR: **0 baris** — belum ada step KGR yang dipetakan ke baris Finish line.

## Lane

| # | Lane | Deskripsi | Eksternal | Jumlah step |
|---|---|---|---|---|
| 1 | PEMASOK | Pemasok live bird — pihak ketiga | ya | 2 |
| 2 | PURCHASING | Rencana & order live bird |  | 5 |
| 3 | OPERASIONAL | Jadwal, keputusan, dan otorisasi operasional |  | 3 |
| 4 | GUDANG | Terima, timbang, simpan, pick, kirim |  | 9 |
| 5 | VETERINER | Gate kesmavet — dokter hewan berwenang | ya | 3 |
| 6 | PRODUKSI | Lini potong, halal, chilling, cut-up |  | 5 |
| 7 | QC | Pemeriksaan mutu & sanitasi |  | 2 |
| 8 | SALES | Order, pengiriman, penagihan awal |  | 2 |
| 9 | ACCOUNTING | Costing, AP/AR, pelaporan |  | 17 |

## Fase (ribbon)

| Ribbon | Fase | Slot |
|---|---|---|
| TRADING | PENGADAAN & PENERIMAAN | 1–18 |
| TRADING | PENJUALAN | 25–28 |
| TRADING | PENAGIHAN | 32–33 |
| TRADING | PEMBAYARAN | 34–35 |
| TRADING | PELAPORAN | 36–38 |
| Default (RPA / semua) | PENGADAAN LIVE BIRD | 1–6 |
| Default (RPA / semua) | PRODUKSI SAMPAI SPLIT-OFF | 7–12 |
| Default (RPA / semua) | PEMROSESAN LANJUT | 13–15 |
| Default (RPA / semua) | DISPOSISI & YIELD | 16–18 |
| Default (RPA / semua) | COSTING BATCH | 19–24 |
| Default (RPA / semua) | PENJUALAN | 25–28 |
| Default (RPA / semua) | EOD SETTLEMENT | 29–31 |
| Default (RPA / semua) | PENAGIHAN | 32–33 |
| Default (RPA / semua) | PEMBAYARAN | 34–35 |
| Default (RPA / semua) | PELAPORAN | 36–38 |

## Urutan alur

**Jalur RPA (38 step):** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38

**Jalur Trading (23 step):** T1 → T2 → T3 → T4 → T5 → T6 → 6 → T7 → T8 → T9 → T10 → 18 → 25 → 26 → 27 → 28 → 32 → 33 → 34 → 35 → 36 → 37 → 38

Catatan: label bukan urutan — `slot` yang menentukan kolom. Step dengan slot sama di jalur berbeda berjalan paralel (mis. 4 dan T4).

## Ikhtisar step

| Slot | Label | Lane | Jalur | Form | Step | PIC (co) | Gate | Kebutuhan (ADA/SEB/BELUM) |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | PURCHASING | RPA |  | Rencana Potong |  | TBC-37 | 0/2/2 |
| 1 | T1 | PURCHASING | TRADING |  | Permintaan & rencana beli |  |  | 0/0/0 |
| 2 | 2 | PURCHASING | RPA |  | Batch ID, review anggaran | Staff Purchasing | TBC-13 | 0/1/3 |
| 2 | T2 | PURCHASING | TRADING |  | Keputusan buy & pemilihan pemasok |  |  | 0/0/2 |
| 3 | 3 | PEMASOK | RPA |  | Kirim live bird | Pemasok live bird |  | 1/1/0 |
| 3 | T3 | PURCHASING | TRADING |  | Terbitkan PO barang jadi |  |  | 0/0/2 |
| 4 | T4 | PEMASOK | TRADING |  | Kirim barang jadi |  |  | 0/0/0 |
| 4 | 4 | GUDANG | RPA |  | Terima & timbang live bird | Staff Gudang |  | 1/1/1 |
| 5 | T5 | GUDANG | TRADING |  | Terima & timbang barang jadi |  |  | 0/0/2 |
| 5 | 5 | QC | RPA |  | Quality check & verifikasi DOA | Staff QC / Operasional | TBC-22 | 0/2/1 |
| 6 | T6 | QC | TRADING |  | QC penerimaan — suhu, kemasan, shelf life, kesesuaian SKU |  |  | 0/0/2 |
| 6 | 6 | ACCOUNTING | BERSAMA |  | Catat utang usaha atau accrual | Staff Accounting |  | 1/1/1 |
| 7 | T7 | VETERINER | TRADING |  | Verifikasi NKV, halal & sertifikat kesehatan pemasok |  |  | 0/0/1 |
| 7 | 7 | PRODUKSI | RPA |  | Pemuasaan & sanitasi pra-operasi | Supervisor Produksi | TBC-20 | 0/2/1 |
| 8 | 8 | VETERINER | RPA |  | Inspeksi antemortem — gate kesmavet 1 | Dokter hewan berwenang | TBC-33 | 0/0/2 |
| 8 | T8 | ACCOUNTING | TRADING |  | Hitung landed cost — harga beli, freight, handling |  |  | 0/0/2 |
| 9 | 9 | GUDANG | RPA |  | Timbang masuk lini | Staff Gudang | TBC-36 | 1/1/1 |
| 9 | T9 | ACCOUNTING | TRADING |  | Nilai persediaan masuk pada landed cost |  |  | 0/0/1 |
| 10 | T10 | GUDANG | TRADING |  | Putaway ke pool per stream, tandai asal beli |  |  | 0/0/1 |
| 10 | 10 | PRODUKSI | RPA |  | Pemotongan halal, bleeding, scalding, plucking, eviscerasi | Juleha + Penyelia Halal |  | 0/2/2 |
| 11 | 11 | VETERINER | RPA |  | Inspeksi post-mortem & kondemnasi — gate kesmavet 2 | Petugas veteriner | TBC-35 | 0/0/3 |
| 12 | 12 | PRODUKSI | RPA |  | Chilling & grading ke kategori yield — TITIK SPLIT-OFF | Supervisor Produksi | TBC-03 | 1/1/2 |
| 13 | 13 | OPERASIONAL | RPA |  | Disposisi karkas — barang jadi atau WIP | Manajer Operasional |  | 0/1/2 |
| 14 | 14 | PRODUKSI | RPA | OLAHAN | Pemrosesan lanjut karkas → SKU hasil cut-up | Supervisor Produksi | TBC-41 | 0/0/4 |
| 15 | 15 | PRODUKSI | RPA | OLAHAN | Pemrosesan MDM | Supervisor Produksi | TBC-40 | 0/0/3 |
| 16 | 16 | OPERASIONAL | RPA |  | Verifikasi yield terhadap benchmark | Manajer Operasional | TBC-34 | 0/0/4 |
| 17 | 17 | GUDANG | RPA | KARKAS | Inventory receipt ke pool Fresh | Staff Gudang |  | 1/1/0 |
| 18 | 18 | GUDANG | BERSAMA |  | Daily stock movement & FIFO per stream | Staff Gudang | TBC-24 | 0/2/1 |
| 19 | 19 | ACCOUNTING | RPA |  | Buka batch costing sheet & akumulasi biaya | Cost Accounting | TBC-15 | 0/0/4 |
| 20 | 20 | ACCOUNTING | RPA |  | NRV-based joint costing — 7 langkah | Cost Accounting | TBC-07 | 1/0/4 |
| 21 | 21 | ACCOUNTING | RPA | OLAHAN | Tambahkan separable cost per SKU setelah alokasi | Cost Accounting |  | 0/0/2 |
| 22 | 22 | ACCOUNTING | RPA |  | Disposisi selisih overhead Pool A dan Pool B | Manajer Accounting | TBC-15 | 1/1/2 |
| 23 | 23 | ACCOUNTING | RPA |  | Review kewajaran & finalisasi batch | Manajer Accounting | TBC-23 | 0/1/2 |
| 24 | 24 | ACCOUNTING | RPA |  | Update nilai persediaan ke aktual & true-up COGS | Staff Accounting |  | 0/2/0 |
| 25 | 25 | SALES | BERSAMA |  | Order masuk & stock availability check per stream | Admin Sales | TBC-26 | 0/1/2 |
| 26 | 26 | GUDANG | BERSAMA |  | Picking FIFO per stream, packing & surat jalan | Staff Gudang | TBC-27 | 0/2/1 |
| 27 | 27 | SALES | BERSAMA |  | Pengiriman & Bukti Serah Terima | Driver / Pengirim | TBC-25 | 0/1/4 |
| 28 | 28 | ACCOUNTING | BERSAMA |  | Terbit invoice | Staff Billing | TBC-28 | 0/1/1 |
| 29 | 29 | GUDANG | RPA |  | EOD stock count sisa fresh | Staff Gudang | TBC-01 | 0/1/2 |
| 30 | 30 | OPERASIONAL | RPA |  | Keputusan disposisi — blast freeze, repricing, atau write-off | Manajer Operasional | TBC-06 | 0/0/4 |
| 31 | 31 | GUDANG | RPA |  | Eksekusi blast freeze & applied overhead Pool B | Staff Gudang | TBC-16 | 0/0/3 |
| 32 | 32 | ACCOUNTING | BERSAMA |  | Catat piutang & AR aging | Staff Accounting | TBC-11 | 0/1/2 |
| 33 | 33 | ACCOUNTING | BERSAMA |  | Follow-up, eskalasi & collection | Staff Accounting | TBC-10 | 0/0/3 |
| 34 | 34 | ACCOUNTING | BERSAMA |  | Three-way matching & catat utang usaha | Staff Accounting |  | 0/1/2 |
| 35 | 35 | ACCOUNTING | BERSAMA |  | Payment proposal & eksekusi dual authorization | Manajer Accounting | TBC-13 | 1/1/1 |
| 36 | 36 | ACCOUNTING | BERSAMA |  | Cut-off penjualan & pembelian | Staff Accounting | TBC-14 | 0/2/1 |
| 37 | 37 | ACCOUNTING | BERSAMA |  | Rekonsiliasi & uji LCNRV frozen | Manajer Accounting | TBC-09 | 0/0/4 |
| 38 | 38 | ACCOUNTING | BERSAMA |  | P&L segmental Fresh vs Frozen & submission | Manajer Accounting | TBC-14 | 0/1/2 |

## Detail per step

### PENGADAAN LIVE BIRD

#### 1 · Rencana Potong

- Lane **PURCHASING** · jalur **RPA** · slot 1
- **Gate TBC-37** (DECISION): Interval review kebutuhan harian — owner Manajer Operasional
- **Risiko:** Kebutuhan diidentifikasi tanpa interval tetap sehingga bergantung ingatan orang; proyeksi penjualan tidak dikonfirmasi Sales sehingga volume beli tidak berdasar.
- **Kontrol:** Review harian terjadwal atas laporan stok dan proyeksi terkini; rencana pembelian dikonfirmasi Manajer Operasional pada hari yang sama.
- **Dokumen:** Laporan stok harian; Sales Forecast Mingguan; Rencana pembelian
- **Driver:** Proyeksi kebutuhan kg berat hidup H-3; Volume normal bulanan → denominator tarif overhead
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Interval review kebutuhan harian | PARAMETER | Kebijakan internal | Manajer Operasional | BELUM |
  | Proyeksi penjualan per SKU per stream | TRANSAKSI | Sales Forecast Mingguan | Tim Sales | SEBAGIAN |
  | Stok live bird dan kapasitas RPA harian | TRANSAKSI | Laporan stok harian | Staff Gudang | SEBAGIAN |
  | Volume normal/budgeted bulanan kg berat hidup | PARAMETER | Demand plan — belum ada | Manajer Operasional + PF | BELUM |

#### 2 · Batch ID, review anggaran

- Lane **PURCHASING** · jalur **RPA** · slot 2 · PIC: Staff Purchasing
- **Gate TBC-13** (DECISION): Matriks otorisasi PO dan pembayaran — owner Direktur
- **Risiko:** PO di luar batas otorisasi; Batch ID duplikat atau dipakai ulang sehingga costing dua batch tercampur.
- **Kontrol:** PO disetujui sesuai matriks otorisasi; review anggaran Manajer Accounting tertulis pada lembar PO; sistem mencegah pemakaian ulang Batch ID yang sudah close.
- **Dokumen:** Purchase Order (memuat Batch ID); Daftar Pemasok Aktif; Lembar Review PO Manajer Accounting
- **Driver:** Nilai PO → matriks otorisasi; Batch ID → pengikat seluruh siklus
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Daftar Pemasok Aktif yang disetujui | MASTER | Seleksi pemasok | Staff Purchasing | SEBAGIAN |
  | Format Batch ID | PARAMETER | Kebijakan internal | Manajer Accounting + IT | BELUM |
  | Matriks Otorisasi PO | PARAMETER | Kebijakan internal | Direktur | BELUM |
  | Nilai PO yang wajib co-approval Manajer Accounting | PARAMETER | Kebijakan internal | Direktur | BELUM |

#### 3 · Kirim live bird

- Lane **PEMASOK** · jalur **RPA** · slot 3 · PIC: Pemasok live bird
- **Risiko:** Kiriman datang di luar jadwal yang disepakati sehingga live bird menunggu di kendaraan dan mortalitas naik sebelum penerimaan.
- **Kontrol:** Konfirmasi tertulis H-1 memuat jumlah ekor, estimasi berat, waktu tiba, dan Batch ID.
- **Dokumen:** Surat Jalan Pemasok; Konfirmasi pengiriman tertulis
- **Driver:** Jumlah ekor & estimasi berat kiriman
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Konfirmasi pengiriman tertulis H-1 | TRANSAKSI | WhatsApp / email / surat | Staff Purchasing | SEBAGIAN |
  | Surat jalan pemasok dengan berat kiriman | TRANSAKSI | Dokumen pemasok | Pemasok | ADA |

#### 4 · Terima & timbang live bird

- Lane **GUDANG** · jalur **RPA** · slot 4 · PIC: Staff Gudang
- **Risiko:** Selisih berat aktual vs surat jalan tidak terdeteksi sehingga tagihan melebihi barang yang benar-benar diterima.
- **Kontrol:** Toleransi timbang ≤ 2%; selisih di atas 2% dieskalasi ke Manajer Operasional dan dikonfirmasi ke pemasok pada hari yang sama untuk keputusan pengurangan tagihan.
- **Dokumen:** Berita Acara Penerimaan Live Bird; Surat Jalan Pemasok; Catatan timbangan terkalibrasi
- **Akun (COA):** Persediaan — Persediaan Live Bird / WIP per Batch
- **Driver:** Berat aktual diterima → dasar nilai persediaan; Selisih timbang vs surat jalan
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Berat aktual diterima per Batch ID | TRANSAKSI | Timbangan terkalibrasi | Staff Gudang | ADA |
  | Jam kerja tenaga bongkar & terima | TRANSAKSI | Absensi | Staff Gudang + HR | BELUM |
  | Sertifikat kalibrasi timbangan | MASTER | Vendor kalibrasi | Staff Gudang | SEBAGIAN |

#### 5 · Quality check & verifikasi DOA

- Lane **QC** · jalur **RPA** · slot 5 · PIC: Staff QC / Operasional
- **Gate TBC-22** (DECISION): Ambang DOA saat penerimaan yang wajib klaim — owner Manajer Operasional
- **Risiko:** DOA dicatat tanpa ambang sehingga klaim ke pemasok bergantung inisiatif; live bird tidak layak lolos ke holding dan mati sebelum potong.
- **Kontrol:** Quality check wajib sebelum penerimaan final; penolakan disertai berita acara dua pihak; DOA di atas ambang dilaporkan hari yang sama untuk keputusan klaim.
- **Dokumen:** Form Quality Check Live Bird; Berita Acara Retur atau Penolakan
- **Akun (COA):** Beban — Beban Kerugian Persediaan — DOA
- **Driver:** Tingkat DOA → klaim ke pemasok; Berat/ekor ditolak
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang DOA yang wajib klaim | PARAMETER | Kebijakan internal | Manajer Operasional | BELUM |
  | Spesifikasi mutu live bird yang disepakati | REFERENSI | Kontrak pemasok | Staff Purchasing | SEBAGIAN |
  | Tingkat DOA per penerimaan | TRANSAKSI | Form Quality Check | Staff QC | SEBAGIAN |

#### 6 · Catat utang usaha atau accrual

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 6 · PIC: Staff Accounting
- **Risiko:** Utang dicatat melebihi penerimaan aktual; accrual tidak diselesaikan saat invoice datang sehingga dobel tercatat.
- **Kontrol:** Finance hanya mencatat berdasarkan BA Penerimaan bertandatangan; clearing accrual mengikuti pola akun asal (Dr Akrual / Cr Utang Usaha) di SOP 7; accrual belum selesai masuk AP reconciliation bulanan.
- **Dokumen:** Invoice Pemasok; Faktur Pajak; BA Penerimaan bertandatangan
- **Akun (COA):** Persediaan — Persediaan Live Bird / WIP per Batch; Neraca — Utang Usaha Pemasok Live Bird; Neraca — Akrual Biaya Pembelian Live Bird — bila invoice belum diterima
- **Driver:** Nilai aktual diterima setelah koreksi berat, retur, dan klaim
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | BA Penerimaan bertandatangan | TRANSAKSI | Dokumen gudang | Staff Gudang | ADA |
  | Daftar accrual belum selesai | TRANSAKSI | AP reconciliation | Staff Accounting | BELUM |
  | Invoice pemasok | TRANSAKSI | Pemasok | Pemasok | SEBAGIAN |

### PRODUKSI SAMPAI SPLIT-OFF

#### 7 · Pemuasaan & sanitasi pra-operasi

- Lane **PRODUKSI** · jalur **RPA** · slot 7 · PIC: Supervisor Produksi
- **Gate TBC-20** (DECISION): Parameter teknis lini — pemuasaan, scalding, chilling — owner Supervisor Produksi + QC
- **Risiko:** Lini jalan sebelum sanitasi lulus; pemuasaan tidak terjadwal sehingga isi saluran cerna menaikkan risiko kontaminasi saat eviscerasi dan yield bergerak tanpa sebab yang bisa dilacak.
- **Kontrol:** Lini tidak boleh jalan sebelum sanitasi pra-operasi lulus dan terdokumentasi; jadwal pemuasaan dicatat per batch.
- **Dokumen:** Catatan Holding per Batch; Checklist sanitasi pra-operasi; Catatan kalibrasi alat
- **Akun (COA):** Overhead — Overhead Produksi — Pool A
- **Driver:** Jam pemuasaan → stabilitas yield
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Checklist sanitasi lulus sebelum lini jalan | TRANSAKSI | Form sanitasi | Staff QC / Sanitasi | SEBAGIAN |
  | Jadwal pemuasaan 8–12 jam per batch | PARAMETER | Kebijakan operasional | Supervisor Produksi | BELUM |
  | Mortalitas selama holding per batch | TRANSAKSI | Catatan Holding | Staff Gudang | SEBAGIAN |

#### 8 · Inspeksi antemortem — gate kesmavet 1

- Lane **VETERINER** · jalur **RPA** · slot 8 · PIC: Dokter hewan berwenang
- **Gate TBC-33** (DECISION): Sumber dokter hewan berwenang — Dinas via kontrak sewa atau rekrut sendiri — owner Direktur + Manajer Operasional
- **Risiko:** Gate dijalankan tanpa petugas berwenang sehingga status halal dan kesmavet tidak punya dasar; ternak tidak layak masuk lini.
- **Kontrol:** Ternak tidak layak dipisahkan sebelum lini; hasil inspeksi dicatat per batch dan ditandatangani petugas berwenang.
- **Dokumen:** Form Antemortem per Batch
- **Driver:** Ekor layak potong vs ditunda vs ditolak
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Form Antemortem per Batch | TRANSAKSI | Dokumen veteriner | Dokter hewan | BELUM |
  | Petugas veteriner berwenang yang tersedia | MASTER | Dinas via kontrak sewa atau rekrut sendiri | Direktur + Manajer Operasional | BELUM |

#### 9 · Timbang masuk lini

- Lane **GUDANG** · jalur **RPA** · slot 9 · PIC: Staff Gudang
- **Gate TBC-36** (DECISION): Ambang susut berat holding yang normal — owner Manajer Operasional
- **Risiko:** Berat masuk lini tidak ditimbang terpisah sehingga yield dihitung dari berat terima — susut holding tersembunyi di dalam yield dan terlihat seperti masalah proses.
- **Kontrol:** Timbang masuk lini pada timbangan terkalibrasi per Batch ID; selisih terhadap berat terima dicatat sebagai susut holding; di atas ambang wajib berita acara.
- **Dokumen:** Catatan Timbang Masuk Lini per Batch
- **Driver:** Kg berat hidup masuk lini → BASIS YIELD dan denominator Pool A
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang susut holding normal | PARAMETER | Kebijakan internal | Manajer Operasional | BELUM |
  | Berat masuk lini per Batch ID | TRANSAKSI | Timbangan terkalibrasi | Staff Gudang | ADA |
  | Susut berat holding per batch | TRANSAKSI | Selisih terima vs masuk lini | Staff Gudang | SEBAGIAN |

#### 10 · Pemotongan halal, bleeding, scalding, plucking, eviscerasi

- Lane **PRODUKSI** · jalur **RPA** · slot 10 · PIC: Juleha + Penyelia Halal
- **Risiko:** Karkas masuk tahap berikutnya sebelum kematian sempurna diverifikasi sehingga status halal gugur; kontaminasi silang antara area kotor dan bersih.
- **Kontrol:** Karkas tidak boleh lanjut sebelum kematian sempurna diverifikasi dan dicatat per shift oleh Penyelia Halal; pemisahan alur, alat, dan personel antara area kotor dan area bersih.
- **Dokumen:** Catatan verifikasi kematian sempurna per shift; Catatan downtime lini; Log suhu proses
- **Akun (COA):** Overhead — Overhead Produksi — Pool A; WIP — Tenaga Kerja Langsung per Batch
- **Driver:** Jam kerja langsung per shift → TKL per batch
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Catatan verifikasi kematian sempurna per shift | TRANSAKSI | Penyelia Halal | Penyelia Halal | SEBAGIAN |
  | Jam kerja langsung dan output per shift | TRANSAKSI | Catatan shift | Supervisor Produksi | BELUM |
  | Parameter suhu & durasi scalding | PARAMETER | Kebijakan teknis | Supervisor Produksi + QC | BELUM |
  | Sertifikat Juleha dan Penyelia Halal aktif | MASTER | Lembaga sertifikasi | Manajer Operasional | SEBAGIAN |

#### 11 · Inspeksi post-mortem & kondemnasi — gate kesmavet 2

- Lane **VETERINER** · jalur **RPA** · slot 11 · PIC: Petugas veteriner
- **Gate TBC-35** (DECISION): Ambang kondemnasi normal — owner Manajer Operasional + Veteriner
- **Risiko:** Kondemnasi dilebur ke bucket Waste sehingga hilang sebagai informasi dan tidak bisa dibedakan dari susut proses; pemusnahan tanpa berita acara veteriner.
- **Kontrol:** Kondemnasi dipisahkan ke wadah khusus berlabel dan dicatat per Batch ID; pemusnahan dengan berita acara ditandatangani petugas veteriner dan Supervisor Produksi.
- **Dokumen:** Form Post-mortem & Kondemnasi per Batch; Berita Acara Pemusnahan; Manifest Limbah
- **Akun (COA):** Beban — Beban Kondemnasi di atas batas normal — beban periode
- **Driver:** Kg kondemnasi → bucket tersendiri, bukan Waste
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang kondemnasi normal | PARAMETER | Kebijakan internal | Manajer Operasional + Veteriner | BELUM |
  | Izin pengelola limbah dan izin lingkungan | MASTER | Instansi berwenang | Manajer Operasional | BELUM |
  | Kg kondemnasi per Batch ID | TRANSAKSI | Form Post-mortem | Petugas veteriner | BELUM |

#### 12 · Chilling & grading ke kategori yield — TITIK SPLIT-OFF

- Lane **PRODUKSI** · jalur **RPA** · slot 12 · PIC: Supervisor Produksi
- **Gate TBC-03** (DECISION): Shelf life fresh (jam) dan ambang aging frozen (hari) — owner Manajer Operasional + QC
- **Risiko:** Suhu inti tidak mencapai target dalam jendela waktu sehingga shelf life fresh berkurang tanpa tercatat; berat output per SKU ditimbang tidak independen.
- **Kontrol:** Penimbangan output per SKU oleh penimbang fisik independen pada timbangan terkalibrasi; suhu inti dan jendela waktu chilling dipantau dan dicatat.
- **Dokumen:** Catatan suhu inti karkas; Timbangan output per SKU; Label tanggal produksi & kedaluwarsa
- **Akun (COA):** Overhead — Overhead Produksi — Pool A
- **Driver:** Kg aktual per kategori yield → basis 7 langkah NRV; Shelf life per pool → label kedaluwarsa
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Berat aktual per SKU per Batch ID | TRANSAKSI | Timbangan terkalibrasi | Staff Operasional + Staff Gudang | ADA |
  | Jendela waktu chilling dan target suhu ruang | PARAMETER | Standar kesmavet | Supervisor Produksi | BELUM |
  | Shelf life fresh dalam jam | PARAMETER | Kebijakan mutu | Manajer Operasional + QC | BELUM |
  | Suhu inti karkas ≤ 4°C dalam jendela waktu | TRANSAKSI | Log suhu | Staff QC | SEBAGIAN |

### PEMROSESAN LANJUT

#### 13 · Disposisi karkas — barang jadi atau WIP

- Lane **OPERASIONAL** · jalur **RPA** · slot 13 · PIC: Manajer Operasional
- **Risiko:** Disposisi diputuskan di lapangan tanpa instruksi tertulis sehingga karkas masuk WIP padahal pesanannya utuh — dan biaya pemrosesan lanjut terjadi tanpa pesanan yang menampungnya.
- **Kontrol:** Disposisi ditetapkan tertulis per batch berdasarkan komposisi pesanan hari itu sebelum karkas meninggalkan area chilling.
- **Dokumen:** Sales Order harian; Instruksi disposisi karkas; Kartu batch
- **Akun (COA):** Persediaan — Barang Jadi — karkas utuh; WIP — WIP — karkas untuk pemrosesan lanjut
- **Driver:** Kg karkas ke FG vs ke WIP → menentukan jalur biaya di hilir
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Instruksi disposisi tertulis per batch | TRANSAKSI | Belum ada form | Manajer Operasional | BELUM |
  | Kapasitas pemrosesan lanjut harian | PARAMETER | Kapasitas lini | Supervisor Produksi | BELUM |
  | Komposisi disposisi karkas aktual per batch dalam kg — FG utuh, WIP cut-up, input MDM | TRANSAKSI | Sales Order + Instruksi disposisi tertulis per batch | Admin Sales | SEBAGIAN |

#### 14 · Pemrosesan lanjut karkas → SKU hasil cut-up

- Lane **PRODUKSI** · jalur **RPA** · slot 14 · form **OLAHAN** · PIC: Supervisor Produksi
- **Gate TBC-41** (DECISION): Basis pengukuran upah borongan tenaga potong — owner Manajer Operasional + Manajer Accounting
- **Risiko:** Biaya pemrosesan lanjut dilebur ke joint cost sehingga Ceker, Usus, dan Kepala menanggung biaya proses yang tidak pernah mereka lewati — dan cost per kg SKU olahan understated.
- **Kontrol:** Input dan output pemrosesan lanjut ditimbang terpisah per batch; biayanya dikumpulkan sebagai separable cost, bukan masuk pool joint.
- **Dokumen:** Instruksi kerja pemrosesan lanjut; Timbangan output per SKU; Label SKU
- **Akun (COA):** WIP — Separable Cost — Cut-up; Overhead — Overhead Produksi — Pool A porsi pemrosesan lanjut
- **Driver:** Kg input karkas WIP → kg output per SKU; Yield pemrosesan lanjut per SKU
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Basis pengukuran borongan — per kilo, ekor, atau shift | PARAMETER | Kebijakan pengupahan | Manajer Operasional + Manajer Accounting | BELUM |
  | Berat input karkas dan output per SKU hasil cut-up | TRANSAKSI | Timbangan terkalibrasi | Staff Operasional | BELUM |
  | Biaya borongan cut-up per batch | TRANSAKSI | Catatan borongan | Supervisor Produksi | BELUM |
  | Yield pemrosesan lanjut per SKU | PARAMETER | Belum ada benchmark | Manajer Operasional | BELUM |

#### 15 · Pemrosesan MDM

- Lane **PRODUKSI** · jalur **RPA** · slot 15 · form **OLAHAN** · PIC: Supervisor Produksi
- **Gate TBC-40** (DATA): Arti singkatan KRK pada tahap potong kaki dan KRK — owner Supervisor Produksi + Manajer Operasional
- **Risiko:** Bahan baku MDM tetap masuk bucket Waste sehingga output MDM tidak pernah muncul sebagai produk, dan mesinnya berjalan tanpa biaya yang terbebankan ke SKU mana pun.
- **Kontrol:** Kerangka yang masuk MDM dikeluarkan dari bucket Waste dan dicatat sebagai input MDM; biaya proses MDM dibebankan langsung ke SKU MDM.
- **Dokumen:** Catatan input kerangka ke MDM; Timbangan output MDM; Log jam mesin MDM
- **Akun (COA):** WIP — Separable Cost — MDM; Overhead — Depresiasi mesin MDM, TKL MDM, listrik MDM
- **Driver:** Kg kerangka masuk MDM → kg output MDM
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Harga jual referensi SKU MDM | PARAMETER | Daftar harga referensi | Manajer Operasional + Manajer Accounting | BELUM |
  | Jam mesin dan listrik MDM | TRANSAKSI | Log mesin | Teknik | BELUM |
  | Kg kerangka masuk dan output MDM per batch | TRANSAKSI | Timbangan | Staff Operasional | BELUM |

### DISPOSISI & YIELD

#### 16 · Verifikasi yield terhadap benchmark

- Lane **OPERASIONAL** · jalur **RPA** · slot 16 · PIC: Manajer Operasional
- **Gate TBC-34** (DECISION): Basis Yield Daging — karkas utuh / parting / boneless, sebelum atau sesudah chilling — owner Manajer Operasional + Manajer Accounting
- **Risiko:** Benchmark dipakai sebagai target dan bukan pembanding sehingga deviasi ditutup di lapangan; costing difinalisasi di atas yield yang belum diinvestigasi.
- **Kontrol:** Deviasi di atas ambang wajib Berita Acara Deviasi Yield dan investigasi internal sebelum costing difinalisasi; Yield Report final ditandatangani Manajer Operasional dan direview analitis Finance.
- **Dokumen:** Yield Report final bertandatangan; Berita Acara Deviasi Yield
- **Driver:** % aktual per kategori vs Yield Benchmark; Deviasi relatif per kategori
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang deviasi yield yang wajib berita acara | PARAMETER | Kebijakan internal | Manajer Operasional | BELUM |
  | Basis Yield Daging — karkas utuh / parting / boneless, sebelum atau sesudah chilling | PARAMETER | Keputusan manajemen | Manajer Operasional + Manajer Accounting | BELUM |
  | Data yield 5 batch pertama untuk validasi benchmark | TRANSAKSI | Yield Report | Supervisor Produksi | BELUM |
  | Mekanisme review benchmark berkala | PARAMETER | Kebijakan internal | Manajer Operasional + Manajer Accounting | BELUM |

#### 17 · Inventory receipt ke pool Fresh

- Lane **GUDANG** · jalur **RPA** · slot 17 · form **KARKAS** · PIC: Staff Gudang
- **Risiko:** Receipt dicatat tanpa Batch ID sehingga traceability ke batch dan ke costing terputus; estimated cost tidak pernah di-true-up.
- **Kontrol:** Batch ID wajib pada setiap inventory receipt; nilai memakai estimated cost sampai costing SOP 3 final, lalu di-true-up.
- **Dokumen:** Inventory receipt per SKU per Batch ID
- **Akun (COA):** Persediaan — Persediaan Barang Jadi — pool Fresh, estimated cost
- **Driver:** Kg per SKU masuk pool fresh
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Estimated cost per SKU sebelum costing final | PARAMETER | Turunan | Staff Accounting | SEBAGIAN |
  | Inventory receipt per SKU per Batch ID | TRANSAKSI | Sistem gudang | Staff Gudang | ADA |

#### 18 · Daily stock movement & FIFO per stream

- Lane **GUDANG** · jalur **BERSAMA** · slot 18 · PIC: Staff Gudang
- **Gate TBC-24** (DECISION): Ambang discrepancy stok fisik vs sistem — owner Kepala Gudang
- **Risiko:** Mutasi tidak dicatat per stream sehingga fresh dan frozen bercampur dan FIFO tidak bisa ditegakkan; discrepancy harian tanpa ambang mengendap sampai opname bulanan.
- **Kontrol:** Mutasi dicatat real-time per transaksi dengan Batch ID, SKU, dan stream; FIFO per stream; discrepancy di atas ambang dilaporkan ke Kepala Gudang hari yang sama.
- **Dokumen:** Daily Stock Movement Report; Kartu stok per Batch ID
- **Driver:** Mutasi harian per stream; FIFO per stream
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang discrepancy fisik vs sistem | PARAMETER | Kebijakan internal | Kepala Gudang | BELUM |
  | Hasil opname bulanan dengan counter independen | TRANSAKSI | Berita acara opname | Staff Gudang + Finance/IA | SEBAGIAN |
  | Mutasi harian per Batch ID per SKU per stream | TRANSAKSI | Sistem gudang | Staff Gudang | SEBAGIAN |

### COSTING BATCH

#### 19 · Buka batch costing sheet & akumulasi biaya

- Lane **ACCOUNTING** · jalur **RPA** · slot 19 · PIC: Cost Accounting
- **Gate TBC-15** (DATA): Volume normal bulanan (kg berat hidup) — denominator tarif overhead — owner Manajer Operasional + PF
- **Risiko:** Tarif overhead dihitung atas kapasitas terpasang dan bukan volume normal sehingga cost per kg tercemar di seluruh SKU; overhead aktual dibebankan langsung ke batch tanpa akun kontrol.
- **Kontrol:** Denominator wajib volume normal/budgeted bulanan, bukan kapasitas terpasang; overhead aktual dikumpulkan di akun kontrol dan direkonsiliasi terpisah, tidak dibebankan langsung ke batch.
- **Dokumen:** Batch Costing Sheet; Rekap Biaya Konversi; Catatan jam kerja / output shift
- **Akun (COA):** WIP — WIP per Batch — live bird cost; WIP — WIP per Batch — TKL; Overhead — Applied Overhead Pool A = tarif × kg masuk lini
- **Driver:** Tarif Pool A × kg berat hidup masuk lini; TKL dari catatan shift
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Jam kerja langsung dan output per shift | TRANSAKSI | Catatan shift | Supervisor Produksi | BELUM |
  | Porsi refrigerasi yang dipisah ke Pool B | PARAMETER | Estimasi teknik | Manajer Accounting + teknik | BELUM |
  | Tarif overhead Pool A | PARAMETER | Volume normal bulanan ÷ overhead anggaran | PF + Manajer Accounting | BELUM |
  | Volume normal bulanan sebagai denominator | PARAMETER | Demand plan — belum ada | Manajer Operasional + PF | BELUM |

#### 20 · NRV-based joint costing — 7 langkah

- Lane **ACCOUNTING** · jalur **RPA** · slot 20 · PIC: Cost Accounting
- **Gate TBC-07** (DECISION): Harga Jual Referensi NRV per SKU, terpisah fresh dan frozen — owner Manajer Operasional + Manajer Accounting
- **Risiko:** Harga referensi tidak diperbarui sehingga Allocation Ratio menyimpang dari nilai jual sebenarnya dan cost per kg salah di seluruh SKU sekaligus; by-product diberi nilai nol tanpa dasar.
- **Kontrol:** Harga referensi diperbarui minimal bulanan sebelum closing, bertanggal efektif, disetujui bersama Manajer Operasional dan Manajer Accounting, terpisah fresh dan frozen; nilai nol wajib dokumentasi alasan dan persetujuan formal.
- **Dokumen:** Batch Costing Sheet; Daftar Harga Jual Referensi NRV per SKU; Yield Report final
- **Akun (COA):** WIP — Allocated Joint Cost per SKU
- **Driver:** Allocation Ratio = NRV SKU ÷ Total NRV Batch; Cost per Kg per SKU = Allocated Joint Cost ÷ berat aktual SKU; Bauran aktual FG vs WIP dari step 13 → himpunan SKU yang masuk denominator
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang penyimpangan harga referensi vs terealisasi yang wajib revisi | PARAMETER | Kebijakan internal | Manajer Accounting + Manajer Operasional | BELUM |
  | Back-test harga referensi terhadap harga jual terealisasi per SKU per periode | TRANSAKSI | Sub-ledger penjualan vs Daftar Harga Jual Referensi NRV | Manajer Accounting | BELUM |
  | Berat aktual per SKU dari Yield Report final | TRANSAKSI | Yield Report | Manajer Operasional | ADA |
  | Dasar dan persetujuan harga referensi nol untuk by-product | PARAMETER | Memo persetujuan | Manajer Accounting | BELUM |
  | Harga Jual Referensi NRV per SKU, terpisah fresh dan frozen | PARAMETER | Daftar harga referensi | Manajer Operasional + Manajer Accounting | BELUM |

#### 21 · Tambahkan separable cost per SKU setelah alokasi

- Lane **ACCOUNTING** · jalur **RPA** · slot 21 · form **OLAHAN** · PIC: Cost Accounting
- **Risiko:** Separable cost ikut dilebur ke joint pool sehingga cost per kg seluruh kategori bergeser — kategori yang tidak diproses menanggung biaya, dan yang diproses terlihat lebih murah dari sebenarnya.
- **Kontrol:** Separable cost dibebankan hanya ke SKU yang benar-benar melewati prosesnya, setelah alokasi joint selesai dan sebelum batch difinalisasi.
- **Dokumen:** Batch Costing Sheet — bagian separable; Rekap biaya pemrosesan lanjut dan MDM
- **Akun (COA):** WIP — Separable Cost — Cut-up ke SKU terkait; WIP — Separable Cost — MDM ke SKU MDM; Overhead — Applied Overhead Pool B ke SKU frozen
- **Driver:** Separable cost ÷ kg output SKU terkait; Cost per kg SKU = allocated joint + separable
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Pemetaan proses lanjut ke SKU yang menerimanya | MASTER | Belum ada | Manajer Accounting | BELUM |
  | Separable cost per jenis proses per batch | TRANSAKSI | Rekap biaya konversi | Staff Accounting | BELUM |

#### 22 · Disposisi selisih overhead Pool A dan Pool B

- Lane **ACCOUNTING** · jalur **RPA** · slot 22 · PIC: Manajer Accounting
- **Gate TBC-15** (DATA): Volume normal bulanan (kg berat hidup) — denominator tarif overhead — owner Manajer Operasional + PF
- **Risiko:** Selisih overhead tidak pernah dihitung sehingga under-absorption terkubur di unit cost dan tarifnya tidak pernah teruji; tarif yang salah bertahan tanpa ada yang tahu.
- **Kontrol:** Overhead aktual dikumpulkan di akun kontrol dan direkonsiliasi terhadap applied setiap periode; selisih tidak terserap diakui sebagai beban periode, bukan dibebankan ulang ke batch.
- **Dokumen:** Rekonsiliasi overhead aktual vs applied; Jurnal disposisi selisih
- **Akun (COA):** Overhead — Overhead Aktual — Pool A; Overhead — Overhead Aktual — Pool B; Overhead — Selisih Overhead — Pool A; Overhead — Selisih Overhead — Pool B; Beban — Selisih tidak terserap — beban periode
- **Driver:** Overhead aktual − applied per pool; Volume aktual vs volume normal → penyebab selisih
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang selisih yang wajib dijelaskan | PARAMETER | Kebijakan internal | Manajer Accounting | BELUM |
  | Overhead aktual per pool per periode | TRANSAKSI | GL | Staff Accounting | SEBAGIAN |
  | Volume aktual kg masuk lini per periode | TRANSAKSI | Catatan timbang masuk lini | Staff Gudang | ADA |
  | Volume normal bulanan sebagai pembanding | PARAMETER | Demand plan — belum ada | Manajer Operasional + PF | BELUM |

#### 23 · Review kewajaran & finalisasi batch

- Lane **ACCOUNTING** · jalur **RPA** · slot 23 · PIC: Manajer Accounting
- **Gate TBC-23** (DECISION): Ambang penyimpangan cost per kg vs 3 batch terakhir — owner Manajer Accounting
- **Risiko:** Batch difinalisasi dengan cost per kg yang menyimpang tanpa investigasi; selisih rekonsiliasi dibiarkan tidak nol sehingga sub-ledger dan GL bercabang.
- **Kontrol:** Gate checklist wajib lengkap sebelum finalisasi: invoice atau accrual ada, Yield Report final bertandatangan termasuk bucket Kondemnasi, dan Rekap Biaya Konversi ada; selisih rekonsiliasi harus NOL sebelum batch dinyatakan closed.
- **Dokumen:** Gate checklist finalisasi; Rekonsiliasi costing sheet vs sub-ledger vs GL
- **Driver:** Cost per kg vs 3 batch terakhir; Margin penjualan aktual batch sebelumnya
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang penyimpangan cost per kg vs 3 batch terakhir | PARAMETER | Kebijakan internal | Manajer Accounting | BELUM |
  | Cost per kg batch sebelumnya periode sama | TRANSAKSI | Batch Costing Sheet | Staff Accounting | SEBAGIAN |
  | Materialitas selisih rekonsiliasi | PARAMETER | Kebijakan internal | Manajer Accounting | BELUM |

#### 24 · Update nilai persediaan ke aktual & true-up COGS

- Lane **ACCOUNTING** · jalur **RPA** · slot 24 · PIC: Staff Accounting
- **Risiko:** Nilai persediaan tertinggal di estimated cost sehingga neraca dan HPP dua-duanya salah; true-up tidak dilakukan atas unit yang sudah terjual sebelum costing final.
- **Kontrol:** Revaluasi dan true-up dijalankan segera setelah costing final; keduanya direkonsiliasi ke GL sebelum closing.
- **Dokumen:** Jurnal revaluasi persediaan; Jurnal true-up COGS
- **Akun (COA):** Persediaan — Persediaan Barang Jadi — dari estimated ke actual cost; HPP — True-up HPP unit yang sudah terjual
- **Driver:** Selisih estimated vs actual cost per SKU
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Cost per kg final per SKU dari SOP 3 | TRANSAKSI | Batch Costing Sheet | Staff Accounting | SEBAGIAN |
  | Daftar unit sudah terjual sebelum costing final | TRANSAKSI | Sub-ledger penjualan | Staff Accounting | SEBAGIAN |

### PENJUALAN

#### 25 · Order masuk & stock availability check per stream

- Lane **SALES** · jalur **BERSAMA** · slot 25 · PIC: Admin Sales
- **Gate TBC-26** (DECISION): Kanal resmi penerimaan pesanan pelanggan — owner Manajer Sales
- **Risiko:** Order diterima lewat kanal tidak resmi sehingga tidak punya jejak; order fresh dikonfirmasi tanpa memeriksa sisa shelf life sehingga tidak bisa dipenuhi.
- **Kontrol:** Stock availability check pada pool sesuai stream sebelum order dikonfirmasi: fresh terhadap produksi hari berjalan dan sisa shelf life jam, frozen terhadap stok cold storage dan aging.
- **Dokumen:** Sales Order; Stock Availability Check per stream
- **Driver:** Order per stream; Sisa shelf life fresh saat order
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Kanal resmi penerimaan pesanan | PARAMETER | Kebijakan internal | Manajer Sales | BELUM |
  | Payment terms per pelanggan | MASTER | Kontrak pelanggan | Sales + Manajer Accounting | BELUM |
  | Stok tersedia per stream real-time | TRANSAKSI | Sistem gudang | Staff Gudang | SEBAGIAN |

#### 26 · Picking FIFO per stream, packing & surat jalan

- Lane **GUDANG** · jalur **BERSAMA** · slot 26 · PIC: Staff Gudang
- **Gate TBC-27** (DECISION): Pejabat berwenang menyetujui surat jalan — owner Direktur
- **Risiko:** Barang keluar gudang tanpa otorisasi yang jelas; Batch ID tidak dicantumkan sehingga traceability dari pelanggan kembali ke batch terputus.
- **Kontrol:** Surat jalan disetujui pejabat berwenang sebelum barang keluar; Batch ID wajib tercantum; picking FIFO per stream — fresh dari batch produksi paling awal hari itu, frozen dari tanggal blast freeze paling awal.
- **Dokumen:** Surat Jalan (memuat Batch ID & stream); Packing list per stream
- **Driver:** Kg keluar per stream per SKU
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Batch ID pada setiap surat jalan | TRANSAKSI | Surat jalan | Staff Gudang | SEBAGIAN |
  | Pejabat berwenang menyetujui surat jalan | PARAMETER | Kebijakan internal | Direktur | BELUM |
  | Standar kemasan per stream | MASTER | Kebijakan mutu | QC + Manajer Operasional | SEBAGIAN |

#### 27 · Pengiriman & Bukti Serah Terima

- Lane **SALES** · jalur **BERSAMA** · slot 27 · PIC: Driver / Pengirim
- **Gate TBC-25** (DECISION): Frekuensi dan target suhu cold storage & kendaraan chilled — owner QC + Manajer Operasional
- **Risiko:** BST tidak diperoleh sebelum driver kembali sehingga penjualan tidak bisa diakui dan piutang tidak punya dasar; rantai dingin terputus dalam perjalanan tanpa tercatat.
- **Kontrol:** BST wajib diperoleh sebelum driver kembali; fresh dikirim dengan kendaraan berpendingin atau boks berinsulasi menjaga suhu chilled; frozen dijaga tetap beku.
- **Dokumen:** Bukti Serah Terima (BST); Catatan suhu kendaraan
- **Akun (COA):** Beban — Beban Angkut Keluar — biaya menjual, tidak pernah masuk nilai persediaan; Beban — Beban Jasa Ekspedisi — pihak ketiga atau entity grup; Neraca — Utang Jasa Angkut — pihak berelasi bila armada milik entity grup
- **Driver:** Kg terkirim per stream; Biaya angkut per pengiriman → komponen terbesar estimasi biaya menjual di step 37; Syarat penyerahan per pelanggan → menentukan apakah ongkos angkut ditanggung KGR
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Biaya angkut keluar per pengiriman — armada sendiri atau jasa pihak ketiga/entity grup | TRANSAKSI | Belum ada — sumbernya mengikuti keputusan armada | Manajer Accounting + Manajer Operasional | BELUM |
  | BST bertandatangan pelanggan | TRANSAKSI | Dokumen pengiriman | Driver | SEBAGIAN |
  | Catatan penolakan saat pengiriman | TRANSAKSI | Form penolakan | Driver | BELUM |
  | Syarat penyerahan per pelanggan — franco gudang pembeli atau ambil sendiri | MASTER | Kontrak pelanggan | Sales + Manajer Accounting | BELUM |
  | Target dan pemantauan suhu kendaraan chilled | PARAMETER | Standar mutu | QC + Manajer Operasional | BELUM |

#### 28 · Terbit invoice

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 28 · PIC: Staff Billing
- **Gate TBC-28** (DECISION): Batas waktu penerbitan invoice setelah BST — owner Manajer Accounting
- **Risiko:** Invoice terbit tanpa BST valid; stream tidak dicantumkan sehingga pendapatan dan HPP tidak bisa dipisah per stream di pelaporan segmental.
- **Kontrol:** Invoice hanya terbit dari BST yang sudah diterima; stream dan Batch ID wajib tercantum pada invoice.
- **Dokumen:** Invoice; Faktur Pajak bila berlaku
- **Akun (COA):** Pendapatan — Pendapatan Penjualan — per stream; HPP — HPP — per stream; Neraca — Piutang Usaha; Neraca — PPN keluaran bila berlaku
- **Driver:** Nilai invoice per stream per SKU
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Batas waktu penerbitan invoice setelah BST | PARAMETER | Kebijakan internal | Manajer Accounting | BELUM |
  | Matriks PPN per jenis produk | REFERENSI | Ketentuan pajak | Tax + Manajer Accounting | SEBAGIAN |

### EOD SETTLEMENT

#### 29 · EOD stock count sisa fresh

- Lane **GUDANG** · jalur **RPA** · slot 29 · PIC: Staff Gudang
- **Gate TBC-01** (DECISION): EOD Cutoff — batas akhir penjualan fresh harian — owner Direktur + Manajer Operasional
- **Risiko:** Tanpa jam cutoff yang pasti, penghitungan mulai kapan saja dan keputusan disposisi bergeser setiap hari; sisa fresh melewati shelf life sebelum diputuskan.
- **Kontrol:** EOD stock count dimulai pada EOD Cutoff yang ditetapkan; hasil diserahkan ke Manajer Operasional dalam tenggat, lengkap dengan catatan kondisi fisik.
- **Dokumen:** EOD Stock Count Sheet
- **Driver:** Kg sisa fresh per SKU pada EOD Cutoff
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | EOD Cutoff — jam batas akhir penjualan fresh | PARAMETER | Kebijakan internal | Direktur + Manajer Operasional | BELUM |
  | Kondisi fisik per SKU sisa | TRANSAKSI | EOD Stock Count Sheet | Staff Gudang | SEBAGIAN |
  | Tenggat serah stock count setelah cutoff | PARAMETER | Kebijakan internal | Manajer Operasional | BELUM |

#### 30 · Keputusan disposisi — blast freeze, repricing, atau write-off

- Lane **OPERASIONAL** · jalur **RPA** · slot 30 · PIC: Manajer Operasional
- **Gate TBC-06** (DECISION): Kriteria Layak Blast Freeze — ambang suhu produk — owner Manajer Operasional + QC
- **Risiko:** Keputusan disposisi jadi penilaian orang karena ambangnya belum ada; repricing menjual di bawah HPP tanpa terlihat; write-off diputuskan tanpa eskalasi.
- **Kontrol:** Setiap sisa stok ditetapkan satu dari tiga disposisi dengan dasar tertulis; repricing dalam batas diskon yang disetujui; write-off dengan berita acara dan eskalasi di atas ambang.
- **Dokumen:** Kriteria Layak Blast Freeze; Repricing Authorization Form; Berita Acara Write-off
- **Akun (COA):** Beban — Beban Kerugian Persediaan — write-off
- **Driver:** Kg per keputusan disposisi; Ekspektasi biaya simpan per jalur disposisi → pembanding beku vs repricing vs write-off
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang suhu produk pada Kriteria Layak Blast Freeze | PARAMETER | Kebijakan mutu | Manajer Operasional + QC | BELUM |
  | Ambang write-off yang wajib eskalasi Direktur | PARAMETER | Kebijakan internal | Direktur | BELUM |
  | Batas diskon minimum terhadap HPP | PARAMETER | Kebijakan internal | Direktur | BELUM |
  | Estimasi biaya simpan cold storage per satuan waktu — input keputusan disposisi, bukan biaya persediaan | PARAMETER | Estimasi teknik — pecahan cold storage dari TBC-17 | Teknik + Manajer Accounting | BELUM |

#### 31 · Eksekusi blast freeze & applied overhead Pool B

- Lane **GUDANG** · jalur **RPA** · slot 31 · PIC: Staff Gudang
- **Gate TBC-16** (DATA): Porsi biaya refrigerasi yang dipisah ke Pool B — owner Manajer Accounting + teknik
- **Risiko:** Overhead pembekuan dilebur ke joint cost sehingga SKU fresh menanggung biaya pembekuan yang tidak pernah dia pakai; tanggal pembekuan tidak dicatat sehingga aging frozen tidak punya titik mulai.
- **Kontrol:** Blast Freeze Transfer Record menjadi dasar jurnal transfer, applied overhead Pool B, tanggal mulai aging frozen, dan label kedaluwarsa baru; label dicetak ulang berbasis tanggal pembekuan.
- **Dokumen:** Blast Freeze Transfer Record; Label kedaluwarsa baru berbasis tanggal pembekuan
- **Akun (COA):** Persediaan — Transfer pool Fresh ke pool Frozen; Overhead — Applied Overhead Pool B — dibebankan langsung ke SKU frozen; Beban — Biaya Simpan Cold Storage — beban periode, di luar applied Pool B
- **Driver:** Kg aktual dibekukan → dasar applied Pool B; Tanggal pembekuan → mulai aging frozen
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Estimasi teknik listrik ABF dan cold storage | PARAMETER | Estimasi teknik | Teknik + Manajer Accounting | BELUM |
  | Kg aktual dibekukan per SKU per Batch ID | TRANSAKSI | Blast Freeze Transfer Record | Staff Gudang | BELUM |
  | Tarif Pool B per kg | PARAMETER | Overhead pembekuan ÷ volume dibekukan | Manajer Accounting + PF | BELUM |

### PENAGIHAN

#### 32 · Catat piutang & AR aging

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 32 · PIC: Staff Accounting
- **Gate TBC-11** (DECISION): Payment terms per pelanggan — owner Sales + Manajer Accounting
- **Risiko:** Piutang dicatat tanpa tanggal jatuh tempo yang berdasar sehingga aging tidak bisa dihitung; stream tidak dicatat sehingga piutang per stream tidak bisa dianalisis.
- **Kontrol:** Piutang dicatat pada hari invoice diterbitkan lengkap dengan tanggal jatuh tempo, nomor surat jalan, Batch ID, stream, dan nomor SO; AR Aging disusun mingguan dengan review terdokumentasi.
- **Dokumen:** AR Aging Report — enam bucket; Kartu piutang per pelanggan
- **Akun (COA):** Neraca — Piutang Usaha per pelanggan
- **Driver:** Umur piutang per bucket; Payment terms per pelanggan
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Jadwal review AR aging mingguan | PARAMETER | Kebijakan internal | Manajer Accounting | BELUM |
  | Payment terms per pelanggan | MASTER | Kontrak pelanggan | Sales + Manajer Accounting | BELUM |
  | Stream dan Batch ID pada catatan piutang | TRANSAKSI | Sistem akuntansi | Staff Accounting | SEBAGIAN |

#### 33 · Follow-up, eskalasi & collection

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 33 · PIC: Staff Accounting
- **Gate TBC-10** (DECISION): Kebijakan provisi piutang formal — owner Manajer Accounting + Direktur
- **Risiko:** Overdue tidak ditagih karena tidak ada pemilik dan tenggat; provisi memakai kebijakan sementara tanpa dasar formal sehingga penurunan nilai tidak bisa dipertahankan.
- **Kontrol:** Reminder 3 hari kerja sebelum jatuh tempo; follow-up berjenjang per bucket dengan tenggat; credit hold atas keputusan Manajer Accounting; eskalasi ke Direktur pada bucket 61–90 dengan memo berisi riwayat dan rekomendasi.
- **Dokumen:** Form Follow-up Collection; Memo eskalasi Direktur
- **Akun (COA):** Beban — Provisi Penurunan Nilai Piutang
- **Driver:** Umur overdue per bucket → tingkat provisi
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Ambang dan tenggat eskalasi per bucket | PARAMETER | Kebijakan internal | Direktur | BELUM |
  | Kebijakan provisi piutang formal | PARAMETER | Kebijakan akuntansi | Manajer Accounting + Direktur | BELUM |
  | Riwayat komunikasi penagihan per pelanggan | TRANSAKSI | Form Follow-up | Staff Accounting | BELUM |

### PEMBAYARAN

#### 34 · Three-way matching & catat utang usaha

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 34 · PIC: Staff Accounting
- **Risiko:** Akrual dikreditkan ke akun beban dan bukan ke akun asalnya sehingga beban tercatat dua kali; selisih dengan supplier statement mengendap tanpa tenggat.
- **Kontrol:** Three-way matching per jenis vendor sebelum AP dicatat; clearing akrual wajib mengikuti akun asal (Dr Akrual / Cr Utang Usaha), bukan dikreditkan ke beban; rekonsiliasi AP ledger vs supplier statement berkala.
- **Dokumen:** Invoice vendor; PO / kontrak; BA Penerimaan atau meter reading
- **Akun (COA):** Neraca — Utang Usaha Vendor; Neraca — Clearing Akrual — Dr Akrual / Cr Utang Usaha
- **Driver:** Nilai terverifikasi per vendor
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Daftar akrual terbuka dari SOP 1 dan SOP 8 | TRANSAKSI | Sub-ledger akrual | Staff Accounting | BELUM |
  | Kelengkapan dokumen per invoice vendor | TRANSAKSI | Checklist verifikasi | Staff Accounting | SEBAGIAN |
  | Tenggat penyelesaian selisih dengan supplier statement | PARAMETER | Kebijakan internal | Manajer Accounting | BELUM |

#### 35 · Payment proposal & eksekusi dual authorization

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 35 · PIC: Manajer Accounting
- **Gate TBC-13** (DECISION): Matriks otorisasi PO dan pembayaran — owner Direktur
- **Risiko:** Pembayaran dieksekusi tanpa dual authorization; urgent payment jadi jalur biasa karena tidak dicatat terpisah.
- **Kontrol:** Pembayaran melalui rekening perusahaan dengan dual authorization maker–releaser; bukti transfer disimpan; AP di-clear pada hari pembayaran; urgent payment dicatat pada payment register khusus di luar siklus mingguan.
- **Dokumen:** AP Aging; Payment Proposal; Bukti transfer; Payment register urgent
- **Akun (COA):** Neraca — Utang Usaha Vendor; Neraca — Bank
- **Driver:** Nilai jatuh tempo per vendor → prioritas pembayaran
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Daftar vendor prioritas dan urgensi | PARAMETER | Kebijakan internal | Manajer Accounting | SEBAGIAN |
  | Matriks otorisasi pembayaran | PARAMETER | Kebijakan internal | Direktur | BELUM |
  | Posisi kas harian | TRANSAKSI | Rekening bank | Staff Finance | ADA |

### PELAPORAN

#### 36 · Cut-off penjualan & pembelian

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 36 · PIC: Staff Accounting
- **Gate TBC-14** (DECISION): Tanggal close bulanan dan tenggat submission — owner Group Project Finance
- **Risiko:** Penjualan dicatat tanpa BST sehingga pendapatan diakui sebelum penyerahan; pembelian akhir bulan tidak di-accrual sehingga persediaan dan utang dua-duanya understated.
- **Kontrol:** Penjualan dicatat di bulan berjalan hanya kalau BST diperoleh sebelum atau pada hari terakhir bulan; live bird diterima tanpa invoice wajib di-accrual pada bulan penerimaan.
- **Dokumen:** Monthly close checklist; Rekap cut-off penjualan dan pembelian
- **Driver:** BST sebelum akhir bulan → pengakuan penjualan; Live bird diterima sebelum akhir bulan → pengakuan pembelian
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Daftar BST yang diperoleh sebelum akhir bulan | TRANSAKSI | Dokumen pengiriman | Admin Sales | SEBAGIAN |
  | Daftar penerimaan live bird tanpa invoice pada akhir bulan | TRANSAKSI | BA Penerimaan | Staff Gudang | SEBAGIAN |
  | Tanggal close bulanan yang ditetapkan | PARAMETER | Group Project Finance | Group Project Finance | BELUM |

#### 37 · Rekonsiliasi & uji LCNRV frozen

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 37 · PIC: Manajer Accounting
- **Gate TBC-09** (DECISION): Materialitas selisih rekonsiliasi yang wajib dijelaskan — owner Manajer Accounting
- **Risiko:** Frozen dicatat di atas nilai realisasi bersihnya sehingga persediaan overstated; rekonsiliasi per stream tidak dilakukan sehingga selisih fresh dan frozen saling menutupi.
- **Kontrol:** Uji LCNRV wajib bulanan untuk setiap SKU frozen; rekonsiliasi inventory valuation, HPP, pendapatan, piutang, dan utang dilakukan per stream; selisih di atas materialitas wajib diinvestigasi dan dijelaskan.
- **Dokumen:** Rekonsiliasi inventory valuation per stream; Laporan Aging Frozen; Kertas kerja LCNRV
- **Akun (COA):** Beban — Penurunan Nilai Persediaan — LCNRV frozen
- **Driver:** Cost per kg tercatat vs NRV kini per SKU frozen
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Aging frozen per SKU per tanggal pembekuan | TRANSAKSI | Laporan Aging Frozen | Staff Gudang | BELUM |
  | Estimasi biaya menjual per SKU | PARAMETER | Turunan | Staff Accounting | BELUM |
  | Harga jual referensi frozen terkini | PARAMETER | Daftar harga referensi | Manajer Operasional + Manajer Accounting | BELUM |
  | Materialitas selisih rekonsiliasi | PARAMETER | Kebijakan internal | Manajer Accounting | BELUM |

#### 38 · P&L segmental Fresh vs Frozen & submission

- Lane **ACCOUNTING** · jalur **BERSAMA** · slot 38 · PIC: Manajer Accounting
- **Gate TBC-14** (DECISION): Tanggal close bulanan dan tenggat submission — owner Group Project Finance
- **Risiko:** Margin per stream tidak terpisah sehingga keputusan bauran fresh dan frozen diambil tanpa dasar; koreksi pasca-submission dilakukan tanpa mekanisme formal.
- **Kontrol:** P&L segmental Fresh vs Frozen wajib; Manajer Accounting mereview margin per SKU dan per stream; koreksi pasca-submission hanya via mekanisme adjustment formal yang disetujui Manajer Accounting dan Group Project Finance.
- **Dokumen:** Laporan laba rugi; Neraca; P&L segmental Fresh vs Frozen
- **Driver:** Pendapatan, HPP, dan margin per stream; Margin per SKU
- **Catatan:** _(tidak disalin ke repositori: catatan bebas)_

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Mekanisme adjustment formal pasca-submission | PARAMETER | Kebijakan internal | Manajer Accounting + GPF | BELUM |
  | Pendapatan dan HPP terpisah per stream | TRANSAKSI | Sub-ledger | Staff Accounting | SEBAGIAN |
  | Tenggat submission ke Group Project Finance | PARAMETER | Group Project Finance | Group Project Finance | BELUM |

### Jalur Trading — PENGADAAN & PENERIMAAN

#### T1 · Permintaan & rencana beli

- Lane **PURCHASING** · jalur **TRADING** · slot 1
- _Belum ada kebutuhan data tercatat._

#### T2 · Keputusan buy & pemilihan pemasok

- Lane **PURCHASING** · jalur **TRADING** · slot 2

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Daftar pemasok terverifikasi | MASTER |  |  | BELUM |
  | Price list pemasok per SKU | MASTER |  |  | BELUM |

#### T3 · Terbitkan PO barang jadi

- Lane **PURCHASING** · jalur **TRADING** · slot 3

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Format PO barang jadi | PARAMETER |  |  | BELUM |
  | Termin & lead time per pemasok | MASTER |  |  | BELUM |

#### T4 · Kirim barang jadi

- Lane **PEMASOK** · jalur **TRADING** · slot 4
- _Belum ada kebutuhan data tercatat._

#### T5 · Terima & timbang barang jadi

- Lane **GUDANG** · jalur **TRADING** · slot 5

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Berat sesuai surat jalan per SKU | TRANSAKSI |  |  | BELUM |
  | Timbangan terima terkalibrasi | MASTER |  |  | BELUM |

#### T6 · QC penerimaan — suhu, kemasan, shelf life, kesesuaian SKU

- Lane **QC** · jalur **TRADING** · slot 6

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Minimum sisa shelf life saat terima | PARAMETER |  |  | BELUM |
  | Standar suhu terima per stream | PARAMETER |  |  | BELUM |

#### T7 · Verifikasi NKV, halal & sertifikat kesehatan pemasok

- Lane **VETERINER** · jalur **TRADING** · slot 7

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Register NKV & sertifikat halal pemasok yang masih berlaku | MASTER |  |  | BELUM |

#### T8 · Hitung landed cost — harga beli, freight, handling

- Lane **ACCOUNTING** · jalur **TRADING** · slot 8

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Komponen landed cost yang boleh dikapitalisasi | PARAMETER |  |  | BELUM |
  | Tarif freight per rute | PARAMETER |  |  | BELUM |

#### T9 · Nilai persediaan masuk pada landed cost

- Lane **ACCOUNTING** · jalur **TRADING** · slot 9

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Kebijakan penilaian persediaan barang beli | PARAMETER |  |  | BELUM |

#### T10 · Putaway ke pool per stream, tandai asal beli

- Lane **GUDANG** · jalur **TRADING** · slot 10

  | Kebutuhan data | Jenis | Sumber | Owner | Status |
  |---|---|---|---|---|
  | Penanda asal (beli vs potong) di master stok | MASTER |  |  | BELUM |

## Register gate (TBC)

| ID | Jenis | Judul | Sub | Owner | Dirujuk step | Kenapa penting (unblock) |
|---|---|---|---|---|---|---|
| TBC-01 | DECISION | EOD Cutoff — batas akhir penjualan fresh harian | Pemicu seluruh SOP 9 | Direktur + Manajer Operasional | 29 | Tanpa jam pasti, EOD stock count tidak punya titik mulai dan keputusan disposisi bergeser tiap hari. |
| TBC-02 | DECISION | Lead time pengadaan H-3 / H-2 | SOP 1.4 | Manajer Operasional | — | Tetapkan jarak hari yang mengikat antara identifikasi kebutuhan, penerbitan PO, dan jadwal potong. |
| TBC-03 | DECISION | Shelf life fresh (jam) dan ambang aging frozen (hari) | SOP 2.4, 4.4 | Manajer Operasional + QC | 12 | Menentukan kapan produk wajib keluar dari pool fresh dan kapan frozen masuk uji penurunan nilai. |
| TBC-04 | DECISION | Ambang deviasi yield yang wajib berita acara | default 5% relatif | Manajer Operasional | — | Di bawah ambang, deviasi lewat tanpa investigasi; di atas, costing tidak boleh difinalisasi. |
| TBC-05 | DECISION | Ambang write-off yang wajib eskalasi Direktur | SOP 9 | Direktur | — | Menentukan siapa yang menanggung keputusan kerugian sisa fresh. |
| TBC-06 | DECISION | Kriteria Layak Blast Freeze — ambang suhu produk | SOP 9.4 | Manajer Operasional + QC | 30 | Empat kriteria sudah ada; ambang suhunya belum. Tanpa itu keputusan blast freeze jadi penilaian orang. |
| TBC-07 | DECISION | Harga Jual Referensi NRV per SKU, terpisah fresh dan frozen | Basis alokasi joint cost | Manajer Operasional + Manajer Accounting | 20 | Ini penentu Allocation Ratio di 7 langkah. Salah di sini, seluruh cost per kg per SKU salah. |
| TBC-08 | DECISION | Format Batch ID | SOP 1.3 | Manajer Accounting + IT | — | Batch ID mengikat PO, timbang masuk lini, yield, costing, dan inventory. Format harus mencegah pemakaian ulang. |
| TBC-09 | DECISION | Materialitas selisih rekonsiliasi yang wajib dijelaskan | SOP 8.4 | Manajer Accounting | 37 | Tanpa ambang, setiap selisih setara — atau tidak ada yang ditelusuri. |
| TBC-10 | DECISION | Kebijakan provisi piutang formal | Sementara: 50% di 91–180 hari | Manajer Accounting + Direktur | 33 | Kebijakan sementara sudah jalan; yang formal belum ditetapkan. |
| TBC-11 | DECISION | Payment terms per pelanggan | SOP 6.4 | Sales + Manajer Accounting | 32 | Menentukan tanggal jatuh tempo, dan tanpa itu AR aging tidak punya dasar. |
| TBC-12 | DECISION | Batas diskon minimum terhadap HPP | SOP 9 repricing | Direktur | — | Repricing tanpa batas bawah bisa menjual di bawah biaya tanpa terlihat. |
| TBC-13 | DECISION | Matriks otorisasi PO dan pembayaran | SOP 1.4, 7.4 | Direktur | 2, 35 | Satu matriks untuk dua siklus; belum ditetapkan nilainya. |
| TBC-14 | DECISION | Tanggal close bulanan dan tenggat submission | SOP 8.4 | Group Project Finance | 36, 38 | Menentukan seluruh tenggat H+1 sampai H+5 di siklus pelaporan. |
| TBC-15 | DATA | Volume normal bulanan (kg berat hidup) — denominator tarif overhead | P2. Indikasi RAB C4.4 tidak konsisten dengan kapasitas terpasang | Manajer Operasional + PF | 19, 22 | Sumber yang benar adalah demand plan, bukan kapasitas terpasang. SOP 2.3 melarang pakai kapasitas terpasang. Tanpa ini seluruh cost per kg tercemar. |
| TBC-16 | DATA | Porsi biaya refrigerasi yang dipisah ke Pool B | P1 internal ABF | Manajer Accounting + teknik | 31 | Pool B dibebankan langsung ke SKU frozen; porsinya belum dipisah dari listrik total. |
| TBC-17 | DATA | Estimasi teknik listrik ABF dan cold storage | Lampiran C | Teknik + Manajer Accounting | — | Dua angka dengan dua nasib berbeda, dan memisahkannya adalah inti gate ini. Porsi ABF masuk tarif Pool B dan ikut ke nilai persediaan lewat step 31; porsi cold storage jadi beban periode dan hanya dipakai sebagai input keputusan disposisi di step 30. Selama keduanya menyatu, tarif Pool B kemasukan biaya simpan dan setiap SKU frozen menanggung penyimpanan yang belum tentu dia pakai. |
| TBC-18 | DECISION | Masa amortisasi perlengkapan di bawah threshold kapitalisasi | P3, maksimal 12 bulan sejalan masa sewa | Manajer Accounting | — | Seluruh item B2 tidak didepresiasi; masa amortisasinya belum dipatok. |
| TBC-19 | DECISION | Ambang mortalitas holding yang jadi write-off | SOP 1.7, 2.8 | Manajer Operasional | — | Memisahkan susut normal yang melebur ke cost dari kerugian yang jadi beban periode. |
| TBC-20 | DECISION | Parameter teknis lini — pemuasaan, scalding, chilling | SOP 2.4 | Supervisor Produksi + QC | 7 | Jadwal dan suhu belum dipatok, padahal keduanya menentukan yield dan risiko kontaminasi. |
| TBC-21 | DATA | Izin lingkungan dan pengelola limbah berizin | SOP 2.4 sub-prosedur limbah | Manajer Operasional | — | Manifest limbah dan IPAL harus terkait izin yang sah. |
| TBC-22 | DECISION | Ambang DOA saat penerimaan yang wajib klaim | SOP 1.4 | Manajer Operasional | 5 | Menentukan kapan klaim ke pemasok wajib diajukan. |
| TBC-23 | DECISION | Ambang penyimpangan cost per kg vs 3 batch terakhir | SOP 3.4 | Manajer Accounting | 23 | Pemicu investigasi sebelum batch difinalisasi. |
| TBC-24 | DECISION | Ambang discrepancy stok fisik vs sistem | SOP 4.7 | Kepala Gudang | 18 | Menentukan kapan selisih harian dieskalasi. |
| TBC-25 | DECISION | Frekuensi dan target suhu cold storage & kendaraan chilled | SOP 4.7, 5.4 | QC + Manajer Operasional | 27 | Pemantauan suhu tanpa target bukan pengendalian. |
| TBC-26 | DECISION | Kanal resmi penerimaan pesanan pelanggan | SOP 5.2 | Manajer Sales | 25 | Order dari kanal tidak resmi tidak punya jejak dan tidak bisa direkonsiliasi. |
| TBC-27 | DECISION | Pejabat berwenang menyetujui surat jalan | SOP 5.4 | Direktur | 26 | Barang keluar gudang tanpa otorisasi yang jelas. |
| TBC-28 | DECISION | Batas waktu penerbitan invoice setelah BST | SOP 5.4 | Manajer Accounting | 28 | Menentukan jarak antara barang diterima pelanggan dan piutang tercatat. |
| TBC-29 | DECISION | Tenggat penyelesaian selisih rekonsiliasi AP | SOP 7.4 | Manajer Accounting | — | Selisih dengan supplier statement tanpa tenggat mengendap. |
| TBC-30 | DECISION | Tenggat EOD — serah stock count dan rekonsiliasi kas | SOP 9.4 | Manajer Operasional | — | Menentukan apakah settlement selesai pada hari yang sama. |
| TBC-31 | DECISION | Mekanisme review Yield Benchmark | SOP 2.3 | Manajer Operasional + Manajer Accounting | — | Benchmark yang tidak pernah ditinjau berubah jadi target, bukan pembanding. |
| TBC-32 | DECISION | Ambang KPI dan mekanisme persetujuan perubahan SOP | tersebar di 1.9, 6.4, 7.4 | Direktur | — | Beberapa KPI dan jadwal mingguan memakai penanda yang sama; perlu dipecah dan dipatok. |
| TBC-33 | DECISION | Sumber dokter hewan berwenang — Dinas via kontrak sewa atau rekrut sendiri | P5. Payroll RAB belum memuat dokter hewan | Direktur + Manajer Operasional | 8 | Dua gate veteriner tidak bisa dijalankan tanpa petugas berwenang. Ini gap SDM, bukan administratif. |
| TBC-34 | DECISION | Basis Yield Daging — karkas utuh / parting / boneless, sebelum atau sesudah chilling | P4. Angka 57% hanya indikatif | Manajer Operasional + Manajer Accounting | 16 | Basis menentukan arti angka 57%. Benchmark hanya boleh dikunci setelah validasi 5 batch pertama. |
| TBC-35 | DECISION | Ambang kondemnasi normal | SOP 2.4 | Manajer Operasional + Veteriner | 11 | Di bawah ambang melebur ke joint cost; di atas jadi beban periode. Bucket tidak boleh dilebur ke Waste. |
| TBC-36 | DECISION | Ambang susut berat holding yang normal | SOP 2.4 | Manajer Operasional | 9 | Di bawah ambang melebur ke cost per kg; di atas wajib berita acara. |
| TBC-37 | DECISION | Interval review kebutuhan harian | SOP 1.2 | Manajer Operasional | 1 | Identifikasi kebutuhan tanpa interval tetap bergantung ingatan orang. |
| TBC-38 | DECISION | Nilai PO yang wajib co-approval Manajer Accounting | SOP 1.4 | Direktur | — | Live bird ±89% total biaya batch; ambang co-approval belum ditetapkan. |
| TBC-39 | DECISION | Prasyarat go-live keputusan parameter | Penutup | Direktur | — | Beberapa parameter ditandai prasyarat go-live tanpa daftar yang mengikat. |
| TBC-40 | DATA | Arti singkatan KRK pada tahap potong kaki dan KRK | Belum dikonfirmasi — jangan diasumsikan | Supervisor Produksi + Manajer Operasional | 15 | Tabel yield SOP memuat Ceker, Hati & Ampela, Usus, dan Kepala — KRK tidak ada di antaranya. Dugaan kerangka, dan itu penting karena kerangka adalah bahan baku MDM. Satu konfirmasi ke pemilik proses menutupnya. |
| TBC-41 | DECISION | Basis pengukuran upah borongan tenaga potong | Per kilo, per ekor, atau per shift | Manajer Operasional + Manajer Accounting | 14 | Ada tiga pool borongan — sembelih, potong kaki dan KRK, dan cut-up. Kalau upahnya per kilo atau per ekor, jam kerja bukan pembagi yang benar; yang dibutuhkan output per pekerja per batch. |
| TBC-VOL | DATA | Volume budgeted yang direkonsiliasi dengan RAB dan kapasitas | P2, kembar dengan TBC-15 | PF + Manajer Operasional | — | Indikasi kapasitas di RAB tidak konsisten dengan kapasitas terpasang dan wajib direkonsiliasi. |

## Kebutuhan data per owner (yang belum ADA)

| Owner | BELUM | SEBAGIAN |
|---|---|---|
| (belum ada owner) | 13 | 0 |
| Staff Accounting | 5 | 8 |
| Staff Gudang | 2 | 9 |
| Manajer Accounting | 10 | 1 |
| Manajer Operasional | 8 | 1 |
| Direktur | 7 | 0 |
| Supervisor Produksi | 7 | 0 |
| Manajer Operasional + Manajer Accounting | 6 | 0 |
| Manajer Operasional + PF | 3 | 0 |
| Staff Purchasing | 0 | 3 |
| Sales + Manajer Accounting | 3 | 0 |
| Staff QC | 0 | 2 |
| Direktur + Manajer Operasional | 2 | 0 |
| Manajer Operasional + QC | 2 | 0 |
| Admin Sales | 0 | 2 |
| Staff Operasional | 2 | 0 |
| Manajer Accounting + Manajer Operasional | 2 | 0 |
| QC + Manajer Operasional | 1 | 1 |
| Driver | 1 | 1 |
| Teknik + Manajer Accounting | 2 | 0 |
| Group Project Finance | 2 | 0 |
| Tim Sales | 0 | 1 |
| Manajer Accounting + IT | 1 | 0 |
| Staff Gudang + HR | 1 | 0 |
| Pemasok | 0 | 1 |
| Staff QC / Sanitasi | 0 | 1 |
| Dokter hewan | 1 | 0 |
| Penyelia Halal | 0 | 1 |
| Supervisor Produksi + QC | 1 | 0 |
| Manajer Operasional + Veteriner | 1 | 0 |
| Petugas veteriner | 1 | 0 |
| Teknik | 1 | 0 |
| Kepala Gudang | 1 | 0 |
| Staff Gudang + Finance/IA | 0 | 1 |
| Manajer Accounting + teknik | 1 | 0 |
| PF + Manajer Accounting | 1 | 0 |
| Manajer Sales | 1 | 0 |
| Tax + Manajer Accounting | 0 | 1 |
| Manajer Accounting + PF | 1 | 0 |
| Manajer Accounting + Direktur | 1 | 0 |
| Manajer Accounting + GPF | 1 | 0 |
