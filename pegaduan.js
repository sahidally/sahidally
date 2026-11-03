/* Bagian Pengaduan Warga - Medan Smart City
   Pasang: <script src="/pengaduan.js"></script> sebelum </body> di index.html
   Efek: menu "Pengaduan" di sidebar (jika ada) + bagian #pengaduan di halaman.
   Klik menu -> halaman menggulung halus ke bagian pengaduan. */
(() => {
  if (window.__pengaduanLoaded) return;
  window.__pengaduanLoaded = true;

  const KEY = 'pengaduan_v1';
  const KATEGORI = ['Lalu lintas', 'Banjir / genangan', 'Sampah', 'Kualitas udara', 'Lainnya'];
  const WILAYAH = ['Pusat Kota', 'Medan Sunggal', 'Medan Johor', 'Medan Tembung', 'Medan Denai', 'Lainnya'];

  const css = `
  #pengaduan{scroll-margin-top:16px;margin:28px 0 40px;padding:22px;background:#0c1d33;border:1px solid #2b5276;border-radius:16px;color:#edf6ff;font-family:"DM Sans",sans-serif;max-width:1100px}
  #pengaduan .pgd-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px}
  #pengaduan h2{font:600 20px "Space Grotesk",sans-serif;margin:0 0 4px}
  #pengaduan p.sub{margin:0;font-size:12px;color:#8ca7c4}
  .pgd-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:820px){.pgd-grid{grid-template-columns:1fr}}
  .pgd-card{background:#081829;border:1px solid #1b3857;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:340px}
  .pgd-card h3{font:600 13px "Space Grotesk",sans-serif;margin:0;color:#36d9ff}
  #pengaduan label{font-size:11px;color:#8ca7c4;display:block;margin-bottom:4px}
  #pengaduan input,#pengaduan select,#pengaduan textarea{width:100%;background:#0c1d33;border:1px solid #2b5276;border-radius:9px;padding:9px 11px;color:#fff;font:12px "DM Sans",sans-serif;outline:none;box-sizing:border-box}
  #pengaduan textarea{resize:vertical;min-height:90px}
  #pengaduan input:focus,#pengaduan select:focus,#pengaduan textarea:focus{border-color:#36d9ff}
  .pgd-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .pgd-btn{border:0;border-radius:9px;padding:10px 14px;font:700 12px "DM Sans",sans-serif;color:#031426;background:linear-gradient(120deg,#25c9ee,#3984ff);cursor:pointer}
  .pgd-btn:disabled{opacity:.6;cursor:wait}
  .pgd-btn.ghost{background:#102944;color:#e9f7ff;border:1px solid #2b5276}
  .pgd-note{font-size:10px;color:#8ca7c4;line-height:1.5}
  .pgd-err{font-size:11px;color:#ff8da0;min-height:14px}
  .pgd-chat{flex:1;overflow-y:auto;max-height:340px;display:flex;flex-direction:column;gap:10px;padding:2px}
  .pgd-empty{margin:auto;text-align:center;color:#8ca7c4;font-size:12px;line-height:1.6;padding:20px}
  .pgd-msg{max-width:86%;padding:9px 12px;border-radius:12px;font-size:12px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}
  .pgd-msg.warga{align-self:flex-end;background:linear-gradient(135deg,#a855f7,#4388ff);color:#fff}
  .pgd-msg.admin{align-self:flex-start;background:#102641;border:1px solid #36d9ff40}
  .pgd-msg time{display:block;font-size:9px;opacity:.65;margin-top:3px}
  .pgd-status{font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;background:#33290d;color:#ffd166;display:inline-block}
  .pgd-status.selesai{background:#0d2b20;color:#4ce0a1}.pgd-status.baru{background:#33121a;color:#ff8da0}
  .pgd-reply{display:flex;gap:8px}
  .pgd-bar{display:flex;justify-content:space-between;align-items:center;gap:8px}
  #pgdFab{position:fixed;right:20px;bottom:20px;z-index:900;border:0;border-radius:999px;padding:12px 16px;font:700 12px "DM Sans",sans-serif;color:#fff;background:linear-gradient(120deg,#a855f7,#ec4899);box-shadow:0 10px 30px #0009;cursor:pointer;display:none;align-items:center;gap:8px}
  #pgdFab.show{display:flex}
  .pgd-dot{display:none;min-width:18px;height:18px;border-radius:9px;background:#ff647c;color:#fff;font-size:10px;font-weight:700;align-items:center;justify-content:center;padding:0 5px;margin-left:auto}
  .pgd-dot.has{display:inline-flex}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const el = (tag, props, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    kids.forEach(k => n.append(k));
    return n;
  };
  const fmtTime = t => new Date(t).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });

  // ===== Bagian halaman =====
  const section = el('section', { id: 'pengaduan', 'aria-label': 'Pengaduan warga' });
  const formCard = el('div', { className: 'pgd-card' });
  const chatCard = el('div', { className: 'pgd-card' });
  section.append(
    el('div', { className: 'pgd-title' },
      el('div', {}, el('h2', {}, '📢 Pengaduan Warga'),
        el('p', { className: 'sub' }, 'Sampaikan masalah lalu lintas, banjir, sampah, atau udara di sekitar Anda. Pengelola membalas langsung di sini.'))),
    el('div', { className: 'pgd-grid' }, formCard, chatCard));

  // Letakkan bagian di area konten utama; urutan: sebelum footer jika ada
  const host = document.querySelector('main') || document.querySelector('.main, .content, #content, .page') || document.body;
  const footer = host.querySelector(':scope > footer');
  if (footer) host.insertBefore(section, footer); else host.appendChild(section);

  // ===== Menu sidebar =====
  let navLink = null, navDot = null;
  function addNav() {
    const links = [...document.querySelectorAll('aside a, nav a, .sidebar a, .menu a, aside button, nav button, .sidebar button, .menu button')]
      .filter(a => a.offsetParent !== null);
    if (!links.length) return;
    const last = links[links.length - 1];
    const clone = last.cloneNode(true);
    clone.removeAttribute('id'); clone.classList.remove('active', 'on', 'selected', 'current');
    if (clone.tagName === 'A') clone.setAttribute('href', '#pengaduan');
    // ganti teks label tanpa merusak ikon: cari simpul teks terakhir yang tidak kosong
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let t, lastText = null;
    while ((t = walker.nextNode())) if (t.nodeValue.trim()) lastText = t;
    if (lastText) lastText.nodeValue = 'Pengaduan'; else clone.textContent = '📢 Pengaduan';
    navDot = el('span', { className: 'pgd-dot' });
    clone.append(navDot);
    clone.addEventListener('click', e => { e.preventDefault(); goto(); });
    last.after(clone);
    navLink = clone;
  }

  function goto() {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', '#pengaduan');
    markSeen();
  }
  // Pintasan melayang: dipakai bila sidebar tidak ditemukan
  const fab = el('button', { id: 'pgdFab', type: 'button' }, '📢 Pengaduan');
  const fabDot = el('span', { className: 'pgd-dot' }); fab.append(fabDot);
  fab.onclick = goto;
  document.body.append(fab);

  addNav();
  if (!navLink) fab.classList.add('show');
  document.querySelectorAll('a[href="#pengaduan"]').forEach(a => {
    if (a !== navLink) a.addEventListener('click', e => { e.preventDefault(); goto(); });
  });
  if (location.hash === '#pengaduan') setTimeout(goto, 400);

  // ===== Sesi warga =====
  let session = load(), timer = null, chatBox, statusEl, input, sendBtn;
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
  function store(s) { session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch {} }
  const getSeen = () => { try { return +(localStorage.getItem(KEY + '_seen') || 0); } catch { return 0; } };
  const setSeen = n => { try { localStorage.setItem(KEY + '_seen', n); } catch {} };

  let adminCount = 0;
  function setBadge(n) {
    [navDot, fabDot].forEach(d => { if (d) { d.textContent = n; d.classList.toggle('has', n > 0); } });
  }
  function markSeen() { setSeen(adminCount); setBadge(0); }
  const visible = () => {
    const r = section.getBoundingClientRect();
    return r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.3;
  };

  // ===== Form =====
  function showForm() {
    const nama = el('input', { maxLength: 60, placeholder: 'Nama (boleh dikosongkan)' });
    const kontak = el('input', { maxLength: 80, placeholder: 'No. HP / email (opsional)' });
    const wil = el('select'); WILAYAH.forEach(w => wil.append(el('option', { value: w, textContent: w })));
    const kat = el('select'); KATEGORI.forEach(k => kat.append(el('option', { value: k, textContent: k })));
    const pesan = el('textarea', { maxLength: 1000, placeholder: 'Jelaskan masalahnya: lokasi, kejadian, sejak kapan…' });
    const err = el('div', { className: 'pgd-err' });
    const send = el('button', { className: 'pgd-btn', type: 'button' }, 'Kirim pengaduan');
    const field = (l, n) => el('div', {}, el('label', {}, l), n);
    formCard.replaceChildren(
      el('h3', {}, 'Pengaduan baru'),
      field('Nama', nama), field('Kontak', kontak),
      el('div', { className: 'pgd-row' }, field('Wilayah', wil), field('Kategori', kat)),
      field('Isi pengaduan', pesan), err, send,
      el('div', { className: 'pgd-note' }, 'Setelah dikirim, Anda bisa lanjut chat dengan pengelola di kotak sebelah. Jangan tulis data sensitif.'));
    send.onclick = async () => {
      err.textContent = '';
      if (pesan.value.trim().length < 5) { err.textContent = 'Isi pengaduan minimal 5 karakter.'; return; }
      send.disabled = true; send.textContent = 'Mengirim…';
      try {
        const r = await fetch('/api/pengaduan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama: nama.value, kontak: kontak.value, wilayah: wil.value, kategori: kat.value, pesan: pesan.value })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal mengirim');
        store({ id: d.id, token: d.token });
        showChat(); poll();
      } catch (e) {
        err.textContent = e.message;
        send.disabled = false; send.textContent = 'Kirim pengaduan';
      }
    };
  }

  // ===== Chat =====
  function showChat() {
    if (!session) {
      chatCard.replaceChildren(el('h3', {}, 'Chat dengan pengelola'),
        el('div', { className: 'pgd-empty' }, 'Belum ada pengaduan.\nKirim pengaduan di sebelah, lalu balasan pengelola akan tampil di sini.'));
      return;
    }
    statusEl = el('span', { className: 'pgd-status baru' }, 'baru');
    chatBox = el('div', { className: 'pgd-chat' });
    input = el('input', { maxLength: 1000, placeholder: 'Tulis pesan…' });
    sendBtn = el('button', { className: 'pgd-btn', type: 'button' }, 'Kirim');
    const baru = el('button', { className: 'pgd-btn ghost', type: 'button', onclick: () => { store(null); setSeen(0); adminCount = 0; setBadge(0); showForm(); showChat(); } }, '+ Pengaduan baru');
    chatCard.replaceChildren(
      el('div', { className: 'pgd-bar' }, el('h3', {}, 'Chat dengan pengelola · #' + session.id), statusEl),
      chatBox,
      el('div', { className: 'pgd-reply' }, input, sendBtn),
      el('div', { className: 'pgd-bar' }, el('span', { className: 'pgd-note' }, 'Tersimpan di perangkat ini.'), baru));
    sendBtn.onclick = sendMsg;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
  }

  function render(c) {
    if (!chatBox) return;
    statusEl.textContent = c.status; statusEl.className = 'pgd-status ' + c.status;
    const atBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 60;
    chatBox.replaceChildren(...c.messages.map(m =>
      el('div', { className: 'pgd-msg ' + m.from }, m.text, el('time', {}, (m.from === 'admin' ? 'Pengelola · ' : 'Anda · ') + fmtTime(m.at)))));
    if (!c.messages.some(m => m.from === 'admin')) {
      chatBox.append(el('div', { className: 'pgd-note' }, 'Pengaduan terkirim. Balasan pengelola akan muncul di sini.'));
    }
    if (atBottom) chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function poll() {
    if (!session) return;
    try {
      const r = await fetch(`/api/pengaduan/${session.id}?token=${encodeURIComponent(session.token)}`);
      if (r.status === 404) { store(null); showForm(); showChat(); return; }
      const c = await r.json();
      render(c);
      adminCount = c.messages.filter(m => m.from === 'admin').length;
      if (visible() || adminCount <= getSeen()) markSeen();
      else setBadge(adminCount - getSeen());
    } catch {}
  }

  async function sendMsg() {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      const r = await fetch(`/api/pengaduan/${session.id}/pesan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token, text })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal');
      input.value = ''; render(d); chatBox.scrollTop = chatBox.scrollHeight;
    } catch (e) {
      chatBox.append(el('div', { className: 'pgd-err' }, e.message));
    }
    sendBtn.disabled = false; input.focus();
  }

  showForm(); showChat();
  if (session) poll();
  timer = setInterval(poll, 5000);
})();
