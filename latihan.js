// Mode latihan panel admin: server palsu di memori, data palsu (NIM 9999...), foto digambar di kanvas, dan daftar tugas.
// Dimuat admin.html hanya saat tombol "Coba mode latihan" ditekan. Selama latihan, panggil() di admin.html
// meneruskan semua permintaan ke sini, jadi tidak ada yang terkirim ke server atau Sheet asli.
// Diuji di tests/latihan.test.js.
(() => {
  const ANGKA = ['SATU', 'DUA', 'TIGA', 'EMPAT', 'LIMA', 'ENAM', 'TUJUH', 'DELAPAN', 'SEMBILAN', 'SEPULUH', 'SEBELAS', 'DUA BELAS'];
  const KOTA = ['SEMARANG', 'KUDUS', 'TEGAL', 'PATI'];
  const KELAS = 'LATIHAN';
  const MHS = ANGKA.map((a, i) => ({ kelas: KELAS, nim: '9999' + String(i + 1).padStart(10, '0'), nama: 'LATIHAN ' + a, asal: KOTA[i % 4] }));
  const SALAH = 4; // LATIHAN LIMA: foto Pagi tanpa kartu identitas, untuk dilatih ditolak

  const TUGAS = [
    ['foto', 'Ketuk salah satu foto untuk melihatnya besar.'],
    ['sah', 'Tandai satu presensi yang fotonya lengkap dengan <b>Sah</b>.'],
    ['tolak', '<b>Tolak</b> presensi LATIHAN LIMA: kartu identitasnya tidak terlihat di foto.'],
    ['batal', 'Tekan <b>Batalkan</b> pada pemberitahuan di bawah untuk mengurungkan satu perubahan.'],
    ['tidak-ttd', 'Anggap LATIHAN TUJUH (sesi Pagi) tidak tanda tangan di kertas: tekan <b>Tidak TTD</b> di barisnya.'],
    ['ttd', 'Lalu tekan <b>Sisanya sudah TTD</b> untuk mahasiswa lain yang sudah tanda tangan.'],
    ['izin-ok', 'Buka tab <b>Izin</b>, lalu tandai <b>Sah</b> izin LATIHAN SEBELAS yang buktinya lengkap.'],
    ['izin-tolak', 'Tolak izin LATIHAN DUA BELAS: tulis dulu catatan alasannya, lalu tekan <b>Tolak</b>.'],
    ['rekap', 'Tekan <b>Unduh rekap</b> dan buka berkasnya.'],
  ];

  // Server palsu. lukis(id, besar) menggambar foto dan mengembalikan base64 JPEG (diganti di uji).
  function buatServer(lukis, tugasSelesai = () => {}) {
    let st;
    const foto = new Map(); // id -> { jenis, i, jam, sesi }
    const ulang = () => {
      foto.clear();
      const hadir = [];
      const kirim = (i, sesi, status, jam, jenis = 'benar') => {
        const id = `latihan-${sesi}-${i}`;
        foto.set(id, { jenis, i, jam, sesi });
        hadir.push({ foto: id, sesi, kelas: KELAS, nim: MHS[i].nim, nama: MHS[i].nama, status, jam, verifikasi: 'BELUM', oleh: '', ttd: '' });
      };
      [0, 1, 2, 3].forEach(i => kirim(i, 'PAGI', 'HADIR', `07:${40 + i * 4}`));
      kirim(SALAH, 'PAGI', 'HADIR', '07:58', 'salah');
      kirim(5, 'PAGI', 'TERLAMBAT', '08:12');
      kirim(6, 'PAGI', 'TERLAMBAT', '08:19');
      [0, 1, 2].forEach(i => kirim(i, 'SORE', 'HADIR', `13:0${i * 3}`));
      const izin = (n, i, jenis, alasan, bukti) => {
        const ids = bukti.map((b, k) => { const id = `latihan-bukti-${n}-${k}`; foto.set(id, { jenis: b, i }); return id; });
        return { id: 'latihan-izin-' + n, kelas: KELAS, nim: MHS[i].nim, nama: MHS[i].nama, jenis, cakupan: 'SEHARI', alasan, bukti: ids,
          status: 'BELUM', catatan: '', oleh: '' };
      };
      st = {
        hadir,
        izin: [
          izin(1, 10, 'Sakit', 'Demam sejak semalam, sudah berobat ke klinik dan diminta istirahat.', ['surat', 'kuitansi', 'surat']),
          izin(2, 11, 'Keperluan keluarga', 'Ada acara keluarga di kampung.', ['pemandangan']),
        ],
        tugas: new Set(),
      };
    };
    ulang();
    const tandai = t => { if (!st.tugas.has(t)) { st.tugas.add(t); tugasSelesai(t); } };

    // Status tiap mahasiswa per sesi dihitung seperti server asli: presensi sah, lalu izin yang tidak ditolak, sisanya alfa.
    function dataHari(tanggal) {
      const sesi = ['PAGI', 'SORE'];
      const rekap = MHS.map(m => ({ ...m, tiap: sesi.map(s => {
        const x = st.hadir.find(h => h.nim === m.nim && h.sesi === s && h.verifikasi !== 'TOLAK');
        if (x) return x.status;
        return st.izin.some(z => z.nim === m.nim && z.status !== 'TOLAK') ? 'IZIN' : 'ALFA';
      }) }));
      const menurut = status => rekap.flatMap(m => sesi.flatMap((s, i) => (m.tiap[i] === status ? [{ sesi: s, kelas: m.kelas, nim: m.nim, nama: m.nama }] : [])));
      return {
        tanggal, sesi, hadir: st.hadir, angkatan: 'LATIHAN', rekap, izin: menurut('IZIN'), belum: menurut('ALFA'),
        pengajuan: st.izin.map(z => ({ ...z, mulai: tanggal, selesai: tanggal, diajukan: tanggal + ' 06:30' })),
      };
    }

    const jawab = {
      dataHari: a => dataHari(a.tanggal),
      ubahVerifikasi: a => {
        const h = st.hadir.find(x => x.foto === a.foto);
        h.verifikasi = a.nilai;
        h.oleh = a.nilai === 'BELUM' ? '' : 'LATIHAN';
        if (a.nilai === 'OK') tandai('sah');
        if (a.nilai === 'TOLAK' && foto.get(a.foto).jenis === 'salah') tandai('tolak');
        return {};
      },
      ubahTtd: a => {
        for (const h of st.hadir) if (a.foto.includes(h.foto)) h.ttd = a.nilai;
        if (a.nilai === 'TIDAK' && a.foto.includes('latihan-PAGI-6')) tandai('tidak-ttd');
        if (a.foto.length > 1 && a.nilai === 'YA') tandai('ttd');
        return {};
      },
      ubahIzin: a => {
        const z = st.izin.find(x => x.id === a.id);
        Object.assign(z, { status: a.nilai, catatan: a.catatan || '', oleh: a.nilai === 'BELUM' ? '' : 'LATIHAN' });
        if (a.nilai === 'OK' && z.id === 'latihan-izin-1') tandai('izin-ok');
        if (a.nilai === 'TOLAK' && z.id === 'latihan-izin-2' && z.catatan) tandai('izin-tolak');
        return {};
      },
      fotoAdmin: a => {
        if (a.besar) tandai('foto');
        return { tipe: 'image/jpeg', data: lukis(foto.get(a.foto), a.besar) };
      },
      keluarAdmin: () => ({}),
    };
    return {
      async panggil(fn, a = {}) {
        await new Promise(ok => setTimeout(ok, 120 + Math.random() * 180)); // terasa seperti server sungguhan
        const f = jawab[fn];
        // Salinan, supaya panel tidak mengubah data server palsu tanpa lewat permintaan (sama seperti server asli).
        return JSON.parse(JSON.stringify(f ? f(a) : { tolak: 'Menu ini tidak tersedia dalam mode latihan.' }));
      },
      tandai, ulang,
      tugas: () => new Set(st.tugas),
    };
  }

  // Foto palsu di kanvas: presensi (siluet, kartu identitas, cap jam Timemark) dan bukti izin (dokumen tiruan).
  function lukis(f, besar) {
    const dok = f.jenis !== 'benar' && f.jenis !== 'salah';
    const n = besar ? 720 : 240;
    const k = document.createElement('canvas');
    k.width = n;
    k.height = dok ? Math.round(n * 4 / 3) : n;
    const c = k.getContext('2d');
    c.scale(n / 240, n / 240);
    const teks = (t, x, y, ukuran, warna = '#222', tebal = '') => { c.font = `${tebal} ${ukuran}px sans-serif`; c.fillStyle = warna; c.fillText(t, x, y); };
    const garis = (y0, banyak) => { c.fillStyle = '#c9ccd2'; for (let j = 0; j < banyak; j++) c.fillRect(24, y0 + j * 14, j % 3 === 2 ? 120 : 192, 5); };
    if (!dok) {
      const hue = (f.i * 47) % 360;
      c.fillStyle = `hsl(${hue} 30% 82%)`;
      c.fillRect(0, 0, 240, 240);
      c.fillStyle = `hsl(${hue} 18% 38%)`;
      c.beginPath(); c.arc(96, 92, 34, 0, 7); c.fill();
      c.beginPath(); c.ellipse(96, 220, 66, 76, 0, Math.PI, 0); c.fill();
      if (f.jenis === 'benar') {
        c.fillStyle = '#fff'; c.fillRect(146, 118, 74, 48);
        c.fillStyle = '#3b6fd8'; c.fillRect(146, 118, 74, 11);
        c.fillStyle = '#c9ccd2'; c.fillRect(176, 136, 36, 5); c.fillRect(176, 148, 28, 5);
        c.fillStyle = '#9aa3b2'; c.fillRect(152, 135, 18, 24);
      }
      c.fillStyle = 'rgb(0 0 0 / 0.6)'; c.fillRect(0, 196, 240, 44);
      teks(f.jam, 10, 230, 28, '#fff', 'bold');
      teks('Timemark', 104, 215, 12, '#fff');
      teks('Sesi ' + (f.sesi === 'PAGI' ? 'Pagi' : 'Sore'), 104, 231, 12, '#fff');
      teks('DATA LATIHAN', 8, 16, 11, 'rgb(0 0 0 / 0.55)', 'bold');
    } else if (f.jenis === 'pemandangan') {
      const langit = c.createLinearGradient(0, 0, 0, 320);
      langit.addColorStop(0, '#8ec5f0'); langit.addColorStop(1, '#e8f4fb');
      c.fillStyle = langit; c.fillRect(0, 0, 240, 320);
      c.fillStyle = '#f6c945'; c.beginPath(); c.arc(180, 70, 26, 0, 7); c.fill();
      c.fillStyle = '#5b8c5a'; c.beginPath(); c.moveTo(0, 320); c.lineTo(80, 170); c.lineTo(150, 260); c.lineTo(200, 200); c.lineTo(240, 250); c.lineTo(240, 320); c.fill();
      teks('DATA LATIHAN', 8, 16, 11, 'rgb(0 0 0 / 0.55)', 'bold');
    } else {
      c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, 240, 320);
      const surat = f.jenis === 'surat';
      teks(surat ? 'KLINIK LATIHAN' : 'APOTEK LATIHAN', 24, 34, 12, '#3b6fd8', 'bold');
      c.fillStyle = '#3b6fd8'; c.fillRect(24, 42, 192, 2);
      teks(surat ? 'SURAT KETERANGAN SAKIT' : 'KUITANSI PEMBELIAN OBAT', 24, 70, 12, '#222', 'bold');
      garis(86, 7);
      teks('Nama: LATIHAN ' + ANGKA[f.i], 24, 202, 11);
      teks(surat ? 'Istirahat: 1 hari' : 'Jumlah: Rp35.000', 24, 220, 11);
      c.strokeStyle = 'rgb(59 111 216 / 0.7)'; c.lineWidth = 3;
      c.beginPath(); c.arc(176, 268, 28, 0, 7); c.stroke();
      teks('CAP', 164, 273, 12, 'rgb(59 111 216 / 0.7)', 'bold');
      teks('DATA LATIHAN, BUKAN SURAT ASLI', 24, 306, 10, '#9a2c2c', 'bold');
    }
    return k.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  const GAYA = `
.latihan-pita { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-xs);
  padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-md); border-radius: var(--radius-stock); background: var(--color-accent); color: var(--color-accent-ink); font-weight: 600; }
.latihan-tugas summary { cursor: pointer; font-weight: 600; min-height: 44px; display: flex; align-items: center; }
.latihan-tugas ol { margin: var(--space-xs) 0 0; padding: 0; list-style: none; display: grid; gap: var(--space-xs); }
.latihan-tugas li { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr); gap: var(--space-xs); align-items: start; }
.latihan-tugas li::before { content: ""; width: 1.25rem; height: 1.25rem; margin-top: 0.15rem; border: 2px solid var(--color-edge); border-radius: 6px; }
.latihan-tugas li[data-selesai] { color: var(--color-muted); }
.latihan-tugas li[data-selesai]::before { content: "✓"; display: grid; place-items: center; border-color: transparent; background: var(--color-mint); color: var(--color-ink); font-size: 0.8rem; font-weight: 700; }
.latihan-selesai { display: grid; gap: var(--space-xs); margin-top: var(--space-sm); }
.latihan-selesai p { margin: 0; font-weight: 600; }
.latihan-selesai div { display: flex; flex-wrap: wrap; gap: var(--space-xs); }`;

  // Mulai latihan: pasang pita, daftar tugas, dan server palsu. muatUlang(): admin.html memuat ulang daftar.
  function mulai({ muatUlang, keluar }) {
    const gaya = Object.assign(document.createElement('style'), { textContent: GAYA });
    const pita = document.createElement('div');
    pita.className = 'latihan-pita';
    pita.innerHTML = '<span>Mode latihan: data palsu, tidak ada yang tersimpan ke Sheet.</span><button type="button" class="btn-tipis">Keluar latihan</button>';
    const kotak = document.createElement('details');
    kotak.className = 'kartu latihan-tugas';
    kotak.open = true;
    kotak.innerHTML = '<summary>Tugas latihan&nbsp;<span aria-live="polite"></span></summary><ol>' +
      TUGAS.map(([id, teks]) => `<li data-tugas="${id}"><span>${teks}</span></li>`).join('') + '</ol>' +
      '<div class="latihan-selesai" hidden><p>Latihan selesai. Anda siap memakai panel.</p><div>' +
      '<button type="button" class="btn-tipis" data-aksi="ulangi">Ulangi latihan</button>' +
      '<button type="button" class="btn-tipis" data-aksi="keluar">Keluar dan masuk dengan akun</button></div></div>';
    const hitung = () => {
      const n = kotak.querySelectorAll('li[data-selesai]').length;
      kotak.querySelector('summary span').textContent = `${n}/${TUGAS.length}`;
      kotak.querySelector('.latihan-selesai').hidden = n < TUGAS.length;
    };
    const server = buatServer(lukis, t => { kotak.querySelector(`li[data-tugas="${t}"]`).dataset.selesai = ''; hitung(); });
    // Batalkan dan Unduh rekap tidak memanggil fungsi khusus di server, jadi dicatat dari tombolnya.
    const klik = e => {
      if (e.target.closest('#toast-batal')) server.tandai('batal');
      if (e.target.closest('#unduh-rekap')) server.tandai('rekap');
    };
    document.addEventListener('click', klik, true);
    pita.querySelector('button').addEventListener('click', keluar);
    kotak.querySelector('[data-aksi="keluar"]').addEventListener('click', keluar);
    kotak.querySelector('[data-aksi="ulangi"]').addEventListener('click', () => {
      server.ulang();
      for (const li of kotak.querySelectorAll('li')) delete li.dataset.selesai;
      hitung();
      muatUlang();
    });
    hitung();
    const kepala = document.querySelector('#layar-panel .kepala');
    document.head.append(gaya);
    kepala.after(pita, kotak);
    return {
      panggil: server.panggil,
      berhenti() { document.removeEventListener('click', klik, true); gaya.remove(); pita.remove(); kotak.remove(); },
    };
  }

  window.Latihan = { mulai, buatServer, TUGAS };
})();
