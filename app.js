import { SUPABASE_URL, SUPABASE_KEY, EVENT } from './config.js';
import { SEED } from './seed.js';

/* ---------- Cômodos ---------- */
const ICON = {
  eletro: '<path d="M9 2v5M15 2v5M6 7h12v3a6 6 0 0 1-12 0zM12 16v6"/>',
  sala: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 11h18v6H3zM5 17v2M19 17v2"/>',
  cozinha: '<path d="M4 10h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 12h4M8 7c0-1.2 1-1.2 1-2.4M12 7c0-1.2 1-1.2 1-2.4"/>',
  loucas: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
  organizacao: '<path d="M8 3h8v3H8zM6.5 6h11l.5 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8zM6 12h12"/>',
  banheiro: '<path d="M12 3c3.2 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.8-6.8 6-11z"/>',
  lavanderia: '<path d="M5 9h14l-1.6 11H6.6zM7.5 9a4.5 4.5 0 0 1 9 0"/>',
  gerais: '<path d="M14.5 3.5l6 6-2.5 2.5-6-6zM12 6l-8.5 8.5 3 3L15 9"/>'
};
const ROOMS = [
  { id: 'eletro',      label: 'Eletrodomésticos',          c: '#D79A1B' },
  { id: 'sala',        label: 'Sala',                      c: '#4E9A7E' },
  { id: 'cozinha',     label: 'Cozinha',                   c: '#2F55A4' },
  { id: 'loucas',      label: 'Louças e mesa',             c: '#6E9BD0' },
  { id: 'organizacao', label: 'Organização',               c: '#8C8A2E' },
  { id: 'banheiro',    label: 'Banheiro',                  c: '#2E9C9E' },
  { id: 'lavanderia',  label: 'Lavanderia e limpeza',      c: '#C9677D' },
  { id: 'gerais',      label: 'Itens gerais',              c: '#6E7178' }
];
const ROOM = Object.fromEntries(ROOMS.map(r => [r.id, r]));
const roomOf = it => ROOM[it.cat] || ROOMS[ROOMS.length - 1];
const icon = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[id] || ICON.gerais}</svg>`;

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;            // só usado com ícones internos
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
}
const validHex = x => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
const safeUrl = u => typeof u === 'string' && /^(https?:|blob:)/i.test(u) ? u : null;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const tokens = {
  get: id => store.get('cha-tokens', {})[id],
  set(id, t) { const a = store.get('cha-tokens', {}); if (t) a[id] = t; else delete a[id]; store.set('cha-tokens', a); }
};
function newToken() { const b = new Uint8Array(18); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : newToken(); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4200); }
const plural = (n, a, b) => n === 1 ? a : b;

/* ---------- Dados ---------- */
const DEMO = !/^https:\/\/[^/]+\.supabase\.(co|in)\/?$/.test(SUPABASE_URL.trim()) || SUPABASE_KEY.startsWith('COLE_');

function demoApi() {
  let items = SEED.map(x => ({ ...x, id: uuid() }));
  let claims = [];
  const secrets = {};
  let listener = () => {};
  const emit = what => setTimeout(() => listener(what), 60);
  return {
    demo: true,
    async items() { return items.map(x => ({ ...x })); },
    async claims() { return claims.map(x => ({ ...x })); },
    subscribe(onChange, onStatus) { listener = onChange; setTimeout(() => onStatus('SUBSCRIBED'), 300); },
    async claim(id, name, color, size, token) {
      const it = items.find(i => i.id === id);
      if (!it || !name.trim()) return 'invalid';
      if (claims.some(c => c.item_id === id)) return 'taken';
      const col = it.colors.find(c => c.n === color) || null;
      claims.push({ item_id: id, name: name.trim(), color: it.colors.length ? col : null, size: it.sizes.length ? size : null });
      secrets[id] = token; emit('claims'); return 'ok';
    },
    async release(id, token) { if (secrets[id] !== token) return false; claims = claims.filter(c => c.item_id !== id); emit('claims'); return true; },
    async adminRelease(id) { claims = claims.filter(c => c.item_id !== id); emit('claims'); },
    async saveItem(it) {
      if (it.id) items = items.map(x => x.id === it.id ? { ...x, ...it } : x);
      else items.push({ ...it, id: uuid() });
      emit('items');
    },
    async deleteItem(id) { items = items.filter(x => x.id !== id); claims = claims.filter(c => c.item_id !== id); emit('items'); emit('claims'); },
    async upload(blob) { return URL.createObjectURL(blob); },
    async session() { return store.get('cha-demo-admin', false) ? {} : null; },
    async signIn() { store.set('cha-demo-admin', true); },
    async signOut() { store.set('cha-demo-admin', false); },
    async isAdmin() { return store.get('cha-demo-admin', false); }
  };
}

async function supabaseApi() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const sb = createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  return {
    demo: false,
    async items() { return ok(await sb.from('items').select('*').order('position').order('name')); },
    async claims() { return ok(await sb.from('claims').select('*')); },
    subscribe(onChange, onStatus) {
      sb.channel('lista-ao-vivo')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => onChange('items'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => onChange('claims'))
        .subscribe(st => onStatus(st));
    },
    async claim(id, name, color, size, token) {
      return ok(await sb.rpc('claim_item', { p_item: id, p_name: name, p_color: color, p_size: size, p_token: token }));
    },
    async release(id, token) { return ok(await sb.rpc('release_claim', { p_item: id, p_token: token })); },
    async adminRelease(id) { ok(await sb.from('claims').delete().eq('item_id', id)); },
    async saveItem(it) {
      const row = { cat: it.cat, name: it.name, note: it.note, optional: it.optional, image_url: it.image_url, colors: it.colors, sizes: it.sizes, position: it.position };
      ok(it.id ? await sb.from('items').update(row).eq('id', it.id) : await sb.from('items').insert(row));
    },
    async deleteItem(id) { ok(await sb.from('items').delete().eq('id', id)); },
    async upload(blob) {
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `itens/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      ok(await sb.storage.from('fotos').upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' }));
      return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
    },
    async session() { return (await sb.auth.getSession()).data.session; },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async isAdmin() { const { data, error } = await sb.rpc('is_admin'); return !error && data === true; }
  };
}

/* ---------- Estado ---------- */
const S = { items: [], claims: {}, loaded: false, live: 'wait', filter: 'all', admin: false, edit: false, failed: false };
let api = null;
let prevTaken = null;

const claimOf = it => S.claims[it.id];
const mine = it => !!(claimOf(it) && tokens.get(it.id));

const refreshT = {};
function refresh(what) {
  clearTimeout(refreshT[what]);
  refreshT[what] = setTimeout(async () => {
    try {
      if (what === 'items') S.items = await api.items();
      else S.claims = Object.fromEntries((await api.claims()).map(c => [c.item_id, c]));
      render();
    } catch (e) { console.warn(e); }
  }, 120);
}

/* ---------- Janelas ---------- */
let lastFocus = null;
function openModal(node) {
  const ov = $('#overlay');
  lastFocus = document.activeElement;
  ov.replaceChildren(node); ov.hidden = false;
  document.body.style.overflow = 'hidden';
  const f = node.querySelector('input:checked') || node.querySelector('input:not([type=file]):not([type=color]):not([type=radio]):not([type=checkbox]), select, textarea, button');
  if (f) f.focus({ preventScroll: true });
}
function closeModal() {
  const ov = $('#overlay'); ov.hidden = true; ov.replaceChildren();
  document.body.style.overflow = '';
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
$('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#overlay').hidden) closeModal(); });

function openPhoto(it) {
  openModal(h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': it.name },
    h('img', { src: safeUrl(it.image_url), alt: it.name }),
    h('p', { text: it.name }),
    h('button', { type: 'button', class: 'btn', onclick: closeModal, text: 'Fechar' })));
}

function pickGroup(name, options, label) {
  return h('div', { class: 'field' },
    h('span', { class: 'lbl', id: 'lbl-' + name, text: label }),
    h('div', { class: 'pick', role: 'radiogroup', 'aria-labelledby': 'lbl-' + name },
      options.map(o => h('label', null,
        h('input', { type: 'radio', name, value: o.value }),
        h('span', null, o.hex ? h('i', { class: 'dot', style: 'background:' + o.hex }) : null, o.label)))));
}

/* ---------- Reservar ---------- */
function openClaim(it) {
  const colors = (it.colors || []).filter(c => c && c.n);
  const sizes = (it.sizes || []).filter(Boolean);
  const nameI = h('input', { type: 'text', id: 'cName', maxlength: '60', autocomplete: 'name', value: store.get('cha-nome', ''), placeholder: 'Como você quer aparecer na lista' });
  const err = h('p', { class: 'err', role: 'alert' });
  const ok = h('button', { type: 'submit', class: 'btn primary', text: 'Confirmar' });
  const form = h('form', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cTitle', novalidate: true },
    h('h2', { id: 'cTitle', text: 'Você leva: ' + it.name }),
    it.note ? h('p', { class: 'note', text: it.note }) : null,
    h('div', { class: 'field' }, h('label', { for: 'cName', text: 'Seu nome' }), nameI),
    colors.length ? pickGroup('cor', colors.map(c => ({ value: c.n, label: c.n, hex: validHex(c.h) ? c.h : '#ccc' })), 'Qual cor?') : null,
    sizes.length ? pickGroup('tam', sizes.map(s => ({ value: s, label: s })), 'Qual tamanho?') : null,
    err,
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: closeModal, text: 'Cancelar' }), ok));

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const name = nameI.value.trim();
    const color = form.querySelector('input[name=cor]:checked')?.value || null;
    const size = form.querySelector('input[name=tam]:checked')?.value || null;
    if (!name) { err.textContent = 'Escreva seu nome para os anfitriões saberem quem leva.'; nameI.focus(); return; }
    if (colors.length && !color) { err.textContent = 'Escolha uma cor.'; return; }
    if (sizes.length && !size) { err.textContent = 'Escolha um tamanho.'; return; }
    err.textContent = ''; ok.disabled = true; ok.textContent = 'Reservando…';
    store.set('cha-nome', name);
    const token = newToken();
    try {
      const r = await api.claim(it.id, name, color, size, token);
      if (r === 'ok') {
        tokens.set(it.id, token);
        closeModal(); toast(`Reservado. ${it.name} está no seu nome.`); refresh('claims');
      } else if (r === 'taken') {
        closeModal(); toast('Outra pessoa acabou de reservar este item.'); refresh('claims');
      } else {
        ok.disabled = false; ok.textContent = 'Confirmar';
        err.textContent = 'As opções deste item mudaram. Feche e abra de novo.'; refresh('items');
      }
    } catch (e) {
      console.warn(e);
      ok.disabled = false; ok.textContent = 'Confirmar';
      err.textContent = 'Não deu para reservar. Confira a internet e tente de novo.';
    }
  });
  openModal(form);
}

function releaseBtn(it, asAdmin) {
  const b = h('button', { type: 'button', class: 'btn small', text: asAdmin && !mine(it) ? 'Liberar reserva' : 'Desistir deste item' });
  let armed = false, t;
  b.addEventListener('click', async () => {
    if (!armed) { armed = true; b.textContent = 'Toque de novo para liberar'; t = setTimeout(() => { armed = false; b.textContent = asAdmin && !mine(it) ? 'Liberar reserva' : 'Desistir deste item'; }, 4000); return; }
    clearTimeout(t); b.disabled = true;
    try {
      if (mine(it)) { const ok = await api.release(it.id, tokens.get(it.id)); if (!ok && asAdmin) await api.adminRelease(it.id); else if (!ok) throw new Error('token'); }
      else await api.adminRelease(it.id);
      tokens.set(it.id, null); toast(`${it.name} voltou para a lista.`); refresh('claims');
    } catch (e) { console.warn(e); b.disabled = false; toast('Não deu para liberar agora. Tente de novo.'); }
  });
  return b;
}

/* ---------- Edição (anfitriões) ---------- */
function prepImage(file) {
  return createImageBitmap(file).then(bmp => {
    const max = 1400, r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', 0.85));
  }).catch(() => file);
}

function openEdit(item, presetCat) {
  const isNew = !item;
  const d = item ? JSON.parse(JSON.stringify(item)) : { name: '', cat: presetCat || ROOMS[0].id, note: '', optional: false, image_url: null, colors: [], sizes: [] };
  d.colors = d.colors || []; d.sizes = d.sizes || [];
  const err = h('p', { class: 'err', role: 'alert' });

  const nameI = h('input', { type: 'text', id: 'eName', maxlength: '80', value: d.name, placeholder: 'Ex.: Jogo de toalhas de banho' });
  const catS = h('select', { id: 'eCat' }, ROOMS.map(r => h('option', { value: r.id, text: r.label }))); catS.value = d.cat;
  const noteI = h('textarea', { id: 'eNote', rows: '2', maxlength: '200', placeholder: 'Ex.: modelo, material, marca que combina' }); noteI.value = d.note || '';
  const optC = h('input', { type: 'checkbox', id: 'eOpt' }); optC.checked = !!d.optional;

  // Foto
  const photoBox = h('div', { class: 'field' });
  const urlI = h('input', { type: 'url', id: 'eUrl', placeholder: 'https://…', 'aria-label': 'Link da imagem' });
  function drawPhoto(status) {
    const room = ROOM[catS.value] || ROOMS[0];
    const fileI = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Escolher foto' });
    fileI.addEventListener('change', async () => {
      const f = fileI.files && fileI.files[0]; if (!f) return;
      drawPhoto('Enviando foto…'); err.textContent = '';
      try { d.image_url = await api.upload(await prepImage(f)); drawPhoto(); }
      catch (e) { console.warn(e); drawPhoto(); err.textContent = 'Não deu para enviar a foto. Tente outra imagem ou confira se você entrou como anfitrião.'; }
    });
    const prev = h('div', { class: 'thumb', style: '--room:' + room.c, html: d.image_url ? '' : icon(room.id) });
    if (d.image_url) prev.append(h('img', { src: safeUrl(d.image_url), alt: 'Foto atual' }));
    photoBox.replaceChildren(
      h('span', { class: 'lbl', text: 'Foto' }),
      h('div', { class: 'photo-row' }, prev,
        h('div', { class: 'photo-btns' },
          h('span', { class: 'btn small file-btn' }, d.image_url ? 'Trocar foto' : 'Enviar foto', fileI),
          d.image_url ? h('button', { type: 'button', class: 'btn small', onclick: () => { d.image_url = null; drawPhoto(); }, text: 'Remover foto' }) : null,
          status ? h('p', { class: 'hint', text: status }) : null)),
      h('div', { class: 'field' },
        h('label', { for: 'eUrl', class: 'hint', text: 'Ou cole o link de uma imagem (clique com o botão direito na foto do site da loja e copie o endereço da imagem):' }),
        h('div', { style: 'display:flex;gap:8px' }, urlI,
          h('button', { type: 'button', class: 'btn small', onclick: () => {
            const u = urlI.value.trim();
            if (!/^https:\/\//i.test(u)) { err.textContent = 'O link precisa começar com https://'; return; }
            err.textContent = ''; d.image_url = u; urlI.value = ''; drawPhoto();
          }, text: 'Usar' }))));
  }
  catS.addEventListener('change', () => drawPhoto());
  drawPhoto();

  // Cores
  const colorRows = h('div', { style: 'display:grid;gap:8px' });
  function drawColors(focusLast) {
    colorRows.replaceChildren(...d.colors.map((c, i) => h('div', { class: 'colorrow' },
      h('input', { type: 'color', value: validHex(c.h) ? c.h : '#ffffff', 'aria-label': 'Cor ' + (i + 1), oninput(e) { c.h = e.target.value; } }),
      h('input', { type: 'text', value: c.n || '', maxlength: '30', placeholder: 'Ex.: Cinza chumbo', 'aria-label': 'Nome da cor ' + (i + 1), oninput(e) { c.n = e.target.value; } }),
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remover cor ' + (i + 1), onclick: () => { d.colors.splice(i, 1); drawColors(); }, text: 'Remover' }))));
    if (focusLast) { const all = colorRows.querySelectorAll('input[type=text]'); all[all.length - 1]?.focus(); }
  }
  drawColors();

  const sizesI = h('input', { type: 'text', id: 'eSizes', maxlength: '120', value: d.sizes.join(', '), placeholder: 'Ex.: P, M, G ou 1,5 m, 2 m' });

  const save = h('button', { type: 'submit', class: 'btn primary', text: 'Salvar item' });
  let del = null;
  if (!isNew) {
    del = h('button', { type: 'button', class: 'btn danger left', text: 'Excluir item' });
    let armed = false;
    del.addEventListener('click', async () => {
      if (!armed) { armed = true; del.textContent = 'Toque de novo para excluir'; setTimeout(() => { armed = false; del.textContent = 'Excluir item'; }, 4000); return; }
      del.disabled = true;
      try { await api.deleteItem(item.id); closeModal(); toast('Item excluído.'); refresh('items'); refresh('claims'); }
      catch (e) { console.warn(e); del.disabled = false; err.textContent = 'Não deu para excluir agora.'; }
    });
  }

  const form = h('form', { class: 'modal wide', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'eTitle', novalidate: true },
    h('h2', { id: 'eTitle', text: isNew ? 'Novo item' : 'Editar item' }),
    h('div', { class: 'field' }, h('label', { for: 'eName', text: 'Nome' }), nameI),
    h('div', { class: 'field' }, h('label', { for: 'eCat', text: 'Cômodo' }), catS),
    h('div', { class: 'field' }, h('label', { for: 'eNote', text: 'Observação' }), noteI),
    h('label', { class: 'check', for: 'eOpt' }, optC, 'Marcar como opcional'),
    photoBox,
    h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Cores aceitas' }), colorRows,
      h('div', null, h('button', { type: 'button', class: 'btn small', onclick: () => { d.colors.push({ n: '', h: '#cccccc' }); drawColors(true); }, text: 'Adicionar cor' })),
      h('p', { class: 'hint', text: 'Com cores, o convidado escolhe uma ao reservar. Sem cores, só reserva.' })),
    h('div', { class: 'field' }, h('label', { for: 'eSizes', text: 'Tamanhos aceitos' }), sizesI,
      h('p', { class: 'hint', text: 'Separe por vírgula. Deixe em branco se não tiver tamanho.' })),
    err,
    h('div', { class: 'actions' }, del, h('button', { type: 'button', class: 'btn', onclick: closeModal, text: 'Cancelar' }), save));

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const name = nameI.value.trim();
    if (!name) { err.textContent = 'Escreva o nome do item.'; nameI.focus(); return; }
    const colors = d.colors.map(c => ({ n: (c.n || '').trim(), h: validHex(c.h) ? c.h : '#cccccc' })).filter(c => c.n);
    const sizes = [...new Set(sizesI.value.split(/[,;]+/).map(s => s.trim()).filter(Boolean))];
    const position = item ? item.position : S.items.reduce((m, i) => Math.max(m, i.position || 0), 0) + 10;
    save.disabled = true; save.textContent = 'Salvando…';
    try {
      await api.saveItem({ id: item?.id, name, cat: catS.value, note: noteI.value.trim(), optional: optC.checked, image_url: d.image_url || null, colors, sizes, position });
      closeModal(); toast('Item salvo.'); refresh('items');
    } catch (e) { console.warn(e); save.disabled = false; save.textContent = 'Salvar item'; err.textContent = 'Não deu para salvar. Confira se você entrou como anfitrião e tente de novo.'; }
  });
  openModal(form);
}

/* ---------- Entrar (anfitriões) ---------- */
function openLogin() {
  const email = h('input', { type: 'email', id: 'lEmail', autocomplete: 'username', required: true });
  const pw = h('input', { type: 'password', id: 'lPw', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'err', role: 'alert' });
  const go = h('button', { type: 'submit', class: 'btn primary', text: 'Entrar' });
  const form = h('form', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lTitle', novalidate: true },
    h('h2', { id: 'lTitle', text: 'Área dos anfitriões' }),
    api.demo ? h('p', { class: 'hint', text: 'Modo demonstração: qualquer e-mail e senha entram.' }) : h('p', { class: 'hint', text: 'Use o e-mail e a senha criados no Supabase.' }),
    h('div', { class: 'field' }, h('label', { for: 'lEmail', text: 'E-mail' }), email),
    h('div', { class: 'field' }, h('label', { for: 'lPw', text: 'Senha' }), pw),
    err,
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: closeModal, text: 'Cancelar' }), go));
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!email.value.trim() || !pw.value) { err.textContent = 'Preencha e-mail e senha.'; return; }
    go.disabled = true; go.textContent = 'Entrando…'; err.textContent = '';
    try {
      await api.signIn(email.value.trim(), pw.value);
      if (await api.isAdmin()) { S.admin = true; S.edit = true; closeModal(); toast('Você entrou. A edição está ligada.'); render(); }
      else { await api.signOut(); err.textContent = 'Este e-mail não está na lista de anfitriões do banco.'; go.disabled = false; go.textContent = 'Entrar'; }
    } catch (e) { console.warn(e); err.textContent = 'E-mail ou senha incorretos.'; go.disabled = false; go.textContent = 'Entrar'; }
  });
  openModal(form);
}

function summaryText() {
  const lines = [`${EVENT.title} — quem leva o quê`, ''];
  let open = 0;
  for (const r of ROOMS) {
    const its = S.items.filter(i => roomOf(i).id === r.id);
    if (!its.length) continue;
    lines.push(r.label);
    for (const i of its) {
      const c = claimOf(i);
      if (!c) { open++; lines.push(`- ${i.name}: (ainda ninguém)`); continue; }
      const extra = [c.color?.n && 'cor ' + c.color.n, c.size && 'tamanho ' + c.size].filter(Boolean).join(', ');
      lines.push(`- ${i.name}: ${c.name}${extra ? ' (' + extra + ')' : ''}`);
    }
    lines.push('');
  }
  lines.push(`Faltam ${open} ${plural(open, 'item', 'itens')}.`);
  return lines.join('\n');
}

/* ---------- Desenho da página ---------- */
function row(it) {
  const room = roomOf(it);
  const c = claimOf(it);
  const img = safeUrl(it.image_url);
  const thumb = img
    ? h('button', { type: 'button', class: 'thumb', style: '--room:' + room.c, 'aria-label': 'Ver foto de ' + it.name, onclick: () => openPhoto(it) },
        h('img', { src: img, alt: '', loading: 'lazy', decoding: 'async' }))
    : h('div', { class: 'thumb', style: '--room:' + room.c, 'aria-hidden': 'true', html: icon(room.id) });

  const colors = (it.colors || []).filter(x => x && x.n);
  const sizes = (it.sizes || []).filter(Boolean);
  const opts = (colors.length || sizes.length) && !c ? h('div', { class: 'choices-view' },
    colors.map(x => h('span', { class: 'pill' }, h('i', { class: 'dot', style: 'background:' + (validHex(x.h) ? x.h : '#ccc') }), x.n)),
    sizes.map(s => h('span', { class: 'pill', text: s }))) : null;

  const act = h('div', { class: 'act' });
  let tape = null;
  if (c) {
    const extra = [c.color?.n, c.size].filter(Boolean).join(', ');
    tape = h('span', { class: 'tape' }, (mine(it) ? 'Você leva' : c.name + ' leva'), extra ? h('small', { text: extra }) : null);
    if (mine(it) || (S.admin && S.edit)) act.append(releaseBtn(it, S.admin));
  } else {
    act.append(h('button', { type: 'button', class: 'btn primary', disabled: !S.loaded, 'aria-label': 'Eu levo: ' + it.name, onclick: () => openClaim(it), text: 'Eu levo' }));
  }
  if (S.admin && S.edit) act.append(h('button', { type: 'button', class: 'btn small', onclick: () => openEdit(it), text: 'Editar' }));

  return h('li', { class: 'item' + (c ? ' taken' : ''), style: '--room:' + room.c },
    thumb,
    h('div', { class: 'info' },
      h('h3', null, it.name, it.optional ? h('span', { class: 'opt', text: 'opcional' }) : null),
      it.note ? h('p', { class: 'note', text: it.note }) : null,
      opts, tape, act.childNodes.length ? act : null));
}

function renderFloor(items) {
  const tiles = $('#tiles');
  const taken = new Set(items.filter(claimOf).map(i => i.id));
  const cols = Math.max(6, Math.min(12, Math.ceil(Math.sqrt(items.length * 1.4))));
  tiles.style.setProperty('--cols', cols);
  const frag = document.createDocumentFragment();
  for (const it of items) {
    const on = taken.has(it.id);
    const t = h('span', { class: 'tile' + (on ? ' on' : '') + (on && prevTaken && !prevTaken.has(it.id) ? ' new' : ''), style: '--room:' + roomOf(it).c });
    frag.append(t);
  }
  const rest = (cols - (items.length % cols)) % cols;
  for (let i = 0; i < rest; i++) frag.append(h('span', { class: 'tile' }));
  tiles.replaceChildren(frag);
  if (S.loaded) prevTaken = taken;

  const cap = $('#floorCap');
  if (!S.loaded) { cap.textContent = S.failed ? 'Não deu para carregar a lista.' : 'Carregando a lista…'; return; }
  const n = taken.size, total = items.length;
  cap.replaceChildren(h('b', { text: String(n) }),
    n === total ? 'Todos os presentes já têm quem leve. A casa está pronta.'
      : `de ${total} presentes já têm quem leve. Cada um assenta um azulejo da casa nova.`);
}

function render() {
  const items = S.items.slice();
  renderFloor(items);

  const lv = $('#live'); lv.dataset.s = S.live;
  $('#liveText').textContent = S.live === 'on' ? 'Ao vivo' : S.live === 'off' ? 'Sem atualização ao vivo' : 'Conectando';
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === S.filter)));
  $('#hostTools').hidden = !S.admin;
  $('#editToggle').setAttribute('aria-pressed', String(S.edit));
  $('#loginBtn').hidden = S.admin;

  const bn = $('#banner'); bn.replaceChildren();
  if (api?.demo) bn.append(h('div', { class: 'notice warn', text: 'Modo demonstração: as reservas ficam só neste navegador. Preencha o arquivo js/config.js com os dados do Supabase para a lista ficar ao vivo para todo mundo.' }));
  if (S.failed) bn.append(h('div', { class: 'notice warn', text: 'Não deu para carregar a lista. Confira a internet e recarregue a página.' }));
  else if (S.live === 'off' && S.loaded) bn.append(h('div', { class: 'notice', text: 'A atualização ao vivo caiu. As reservas continuam funcionando; recarregue a página para ver as mais recentes.' }));
  if (S.admin && S.edit) bn.append(h('div', { class: 'notice', text: 'Edição ligada. Toque em “Editar” em qualquer item para trocar foto, cores e tamanhos. Os convidados não veem estes botões.' }));

  const nav = $('#roomsNav'); nav.replaceChildren();
  for (const r of ROOMS) {
    if (!items.some(i => roomOf(i).id === r.id) && !(S.admin && S.edit)) continue;
    nav.append(h('button', { type: 'button', class: 'room-link', onclick: () => document.getElementById('room-' + r.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) },
      h('span', { class: 'mini', style: '--room:' + r.c }), r.label));
  }

  const list = $('#list'); list.replaceChildren();
  if (!S.loaded) return;
  let shown = 0;
  for (const r of ROOMS) {
    const all = items.filter(i => roomOf(i).id === r.id);
    const vis = all.filter(i => S.filter === 'all' || (S.filter === 'open') === !claimOf(i));
    if (!vis.length && !(S.admin && S.edit && S.filter === 'all')) continue;
    shown += vis.length;
    const t = all.filter(claimOf).length;
    const head = h('div', { class: 'room-head' },
      h('span', { class: 'mini', style: '--room:' + r.c, 'aria-hidden': 'true' }),
      h('h2', { text: r.label }),
      h('span', { class: 'room-count', text: all.length ? `${t} de ${all.length} ${plural(all.length, 'item', 'itens')} com alguém` : 'Nenhum item ainda' }),
      S.admin && S.edit ? h('button', { type: 'button', class: 'btn small', onclick: () => openEdit(null, r.id), text: 'Novo item aqui' }) : null);
    list.append(h('section', { class: 'room', id: 'room-' + r.id, 'aria-labelledby': 'h-' + r.id, style: '--room:' + r.c },
      head, h('ul', { class: 'items' }, vis.map(row))));
    head.querySelector('h2').id = 'h-' + r.id;
  }
  if (!shown) {
    list.append(h('div', { class: 'empty' },
      h('strong', { text: S.filter === 'open' ? 'Tudo reservado' : 'Nenhum item reservado ainda' }),
      S.filter === 'open' ? 'Todos os presentes já têm quem leve.' : 'Quando alguém tocar em “Eu levo”, o item aparece aqui.'));
  }
}

/* ---------- Ligações ---------- */
$('#evTitle').textContent = EVENT.title;
$('#evDate').textContent = EVENT.date;
$('#evIntro').textContent = EVENT.intro;
document.title = EVENT.title;
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.f; render(); }));
$('#loginBtn').addEventListener('click', () => api && openLogin());
$('#editToggle').addEventListener('click', () => { S.edit = !S.edit; render(); });
$('#logoutBtn').addEventListener('click', async () => { await api.signOut(); S.admin = false; S.edit = false; toast('Você saiu da área dos anfitriões.'); render(); });
$('#summaryBtn').addEventListener('click', async () => {
  const txt = summaryText();
  try { await navigator.clipboard.writeText(txt); toast('Resumo copiado. É só colar no WhatsApp.'); }
  catch { openModal(h('div', { class: 'modal wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Resumo' },
    h('h2', { text: 'Resumo' }), h('textarea', { rows: '14', readonly: true, style: 'width:100%' }, txt),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: closeModal, text: 'Fechar' })))); }
});
$('#shareBtn').addEventListener('click', async () => {
  const data = { title: EVENT.title, text: 'Escolha o que você vai levar para a casa nova:', url: location.href };
  if (navigator.share) { try { await navigator.share(data); } catch {} return; }
  try { await navigator.clipboard.writeText(location.href); toast('Link copiado.'); } catch { toast(location.href); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && api) { refresh('items'); refresh('claims'); } });

async function boot() {
  render();
  try { api = DEMO ? demoApi() : await supabaseApi(); }
  catch (e) { console.warn(e); S.failed = true; S.live = 'off'; render(); return; }

  const timer = setTimeout(() => { if (!S.loaded) { S.failed = true; render(); } }, 10000);
  try {
    const [items, claims] = await Promise.all([api.items(), api.claims()]);
    S.items = items; S.claims = Object.fromEntries(claims.map(c => [c.item_id, c]));
    S.loaded = true; S.failed = false;
  } catch (e) { console.warn(e); S.failed = true; }
  clearTimeout(timer);
  render();

  api.subscribe(what => refresh(what), st => {
    S.live = st === 'SUBSCRIBED' ? 'on' : (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') ? 'off' : S.live;
    if (st === 'SUBSCRIBED') { refresh('claims'); }
    render();
  });

  try { if (await api.session() && await api.isAdmin()) { S.admin = true; render(); } } catch {}
}
boot();
