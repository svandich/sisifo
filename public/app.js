const API_BASE = '/api';
const TOKEN_KEY = 'sisifo_admin_token';

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || '',
  guilds: [],
  guildId: '',
  telegramChats: [],
  categories: [],
  subscriptions: [],
  tags: [],
  templates: [],
  announcements: [],
  editingTemplate: false,
  scheduleContest: null,
  schedules: [],
  expandedSchedule: null,
  scheduleAddContest: null,
};

// ---------- helpers ----------

function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emptyRow(cols) {
  return `<tr class="empty-row"><td colspan="${cols}">Nada por aquí todavía.</td></tr>`;
}

function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    logout();
    throw new Error('Sesión expirada. Vuelve a ingresar el token.');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) throw new Error((data && data.message) || `Error ${res.status}`);
  return data;
}

function categoryBySlug(slug) {
  return state.categories.find((c) => c.slug === slug);
}

function categoryName(id) {
  const c = state.categories.find((c) => c.id === id);
  return c ? c.displayName : `#${id}`;
}

function guildById(id) {
  return state.guilds.find((g) => g.id === id);
}

function telegramChatById(chatId) {
  return state.telegramChats.find((c) => c.chatId === chatId);
}

// ---------- auth ----------

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function showLogin(message) {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  const err = document.getElementById('login-error');
  if (message) {
    err.textContent = message;
    err.classList.remove('hidden');
  } else {
    err.classList.add('hidden');
  }
}

function logout() {
  state.token = '';
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin();
}

async function tryLogin(token) {
  state.token = token;
  await api('/auth/verify', { method: 'POST' });
  sessionStorage.setItem(TOKEN_KEY, token);
  showApp();
  await initApp();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = document.getElementById('login-token').value.trim();
  if (!token) return;
  try {
    await tryLogin(token);
  } catch (err) {
    state.token = '';
    document.getElementById('login-error').textContent = 'Token inválido.';
    document.getElementById('login-error').classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

// ---------- tabs ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- guilds ----------

async function loadGuilds() {
  state.guilds = await api('/discord/guilds');
  const sel = document.getElementById('guild-select');
  sel.innerHTML = state.guilds.length
    ? state.guilds.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')
    : '<option value="">Sin servidores</option>';
  state.guildId = state.guilds[0]?.id || '';
  sel.value = state.guildId;
}

document.getElementById('guild-select').addEventListener('change', async (e) => {
  state.guildId = e.target.value;
  fillSubscriptionChannels();
  fillTagRoles();
  clearTemplateForm();
  await loadTemplates();
});

// ---------- categories ----------

async function loadCategories() {
  state.categories = await api('/categories');
  renderCategories();
  fillCategorySelects();
}

function renderCategories() {
  const body = document.getElementById('categories-body');
  body.innerHTML = state.categories.length
    ? state.categories
        .map(
          (c) => `
      <tr>
        <td>${escapeHtml(c.displayName)}</td>
        <td><code>${c.slug}</code></td>
        <td>${c.type === 'simulacion' ? 'Simulación' : 'Concurso próximo'}</td>
        <td><button class="secondary danger" data-delete-category="${c.slug}">Eliminar</button></td>
      </tr>`,
        )
        .join('')
    : emptyRow(4);
}

function fillCategorySelects() {
  const options = state.categories.map((c) => `<option value="${c.slug}">${escapeHtml(c.displayName)}</option>`).join('');
  for (const id of ['subscription-category', 'tag-category', 'schedule-category']) {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = options || '<option value="">Sin categorías</option>';
    if (prev) sel.value = prev;
  }

  const normalOptions = state.categories
    .filter((c) => c.type === 'normal')
    .map((c) => `<option value="${c.slug}">${escapeHtml(c.displayName)}</option>`)
    .join('');
  const recurringSel = document.getElementById('schedule-recurring-category');
  const prevRecurring = recurringSel.value;
  recurringSel.innerHTML = normalOptions || '<option value="">Sin categorías de tipo "concurso próximo"</option>';
  if (prevRecurring) recurringSel.value = prevRecurring;
}

document.getElementById('category-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const displayName = document.getElementById('category-name').value.trim();
  const type = document.getElementById('category-type').value;
  try {
    await api('/categories', { method: 'POST', body: { displayName, type } });
    document.getElementById('category-name').value = '';
    await loadCategories();
    toast('Categoría creada.');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('categories-body').addEventListener('click', async (e) => {
  const slug = e.target.dataset.deleteCategory;
  if (!slug) return;
  if (!confirm(`¿Eliminar la categoría "${slug}"?`)) return;
  try {
    await api(`/categories/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    await loadCategories();
    toast('Categoría eliminada.');
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- subscriptions ----------

async function loadTelegramChats() {
  state.telegramChats = await api('/telegram/chats');
  fillTelegramChatSelect();
}

function fillSubscriptionChannels() {
  const guild = guildById(state.guildId);
  const sel = document.getElementById('subscription-channel');
  sel.innerHTML = guild?.channels.length
    ? guild.channels.map((c) => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join('')
    : '<option value="">Sin canales</option>';
}

function fillTelegramChatSelect() {
  const sel = document.getElementById('subscription-telegram-chat');
  sel.innerHTML = state.telegramChats.length
    ? state.telegramChats.map((c) => `<option value="${c.chatId}">${escapeHtml(c.title)}</option>`).join('')
    : '<option value="">Sin chats conocidos</option>';
  fillTelegramTopicSelect();
}

function fillTelegramTopicSelect() {
  const chat = telegramChatById(document.getElementById('subscription-telegram-chat').value);
  const sel = document.getElementById('subscription-telegram-topic');
  const options = '<option value="">Sin tema (chat completo)</option>';
  sel.innerHTML = options + (chat?.topics || []).map((t) => `<option value="${t.threadId}">${escapeHtml(t.title || `Tema ${t.threadId}`)}</option>`).join('');
}

function setSubscriptionPlatformFields() {
  const platform = document.getElementById('subscription-platform').value;
  document.getElementById('subscription-channel').classList.toggle('hidden', platform !== 'discord');
  document.getElementById('subscription-telegram-chat').classList.toggle('hidden', platform !== 'telegram');
  document.getElementById('subscription-telegram-topic').classList.toggle('hidden', platform !== 'telegram');
}

document.getElementById('subscription-platform').addEventListener('change', setSubscriptionPlatformFields);
document.getElementById('subscription-telegram-chat').addEventListener('change', fillTelegramTopicSelect);

function chatLabel(sub) {
  if (sub.platform === 'discord') {
    const guild = guildById(sub.guildId);
    const channel = guild?.channels.find((c) => c.id === sub.chatId);
    return `${escapeHtml(guild?.name || sub.guildId || '?')} / #${escapeHtml(channel?.name || sub.chatId)}`;
  }
  const chat = telegramChatById(sub.chatId);
  const topic = sub.threadId ? chat?.topics.find((t) => t.threadId === sub.threadId) : null;
  const label = chat ? escapeHtml(chat.title) : `Telegram · ${escapeHtml(sub.chatId)}`;
  return topic ? `${label} / ${escapeHtml(topic.title || `Tema ${topic.threadId}`)}` : sub.threadId ? `${label} (tema ${sub.threadId})` : label;
}

async function loadSubscriptions() {
  state.subscriptions = await api('/subscriptions');
  renderSubscriptions();
}

function renderSubscriptions() {
  const body = document.getElementById('subscriptions-body');
  body.innerHTML = state.subscriptions.length
    ? state.subscriptions
        .map(
          (s) => `
      <tr>
        <td>${s.platform}</td>
        <td>${chatLabel(s)}</td>
        <td>${escapeHtml(categoryName(s.categoryId))}</td>
        <td>${s.adminOnly ? '<span class="badge admin">admin</span>' : ''}</td>
        <td><button class="secondary danger" data-delete-sub="${s.id}">Eliminar</button></td>
      </tr>`,
        )
        .join('')
    : emptyRow(5);
}

document.getElementById('subscription-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const platform = document.getElementById('subscription-platform').value;
  const categorySlug = document.getElementById('subscription-category').value;
  const adminOnly = document.getElementById('subscription-admin').checked;

  try {
    if (platform === 'discord') {
      const channelId = document.getElementById('subscription-channel').value;
      if (!state.guildId || !channelId || !categorySlug) return toast('Selecciona servidor, canal y categoría.', true);
      await api('/subscriptions/discord', { method: 'POST', body: { guildId: state.guildId, channelId, categorySlug, adminOnly } });
    } else {
      const chatId = document.getElementById('subscription-telegram-chat').value;
      const threadId = document.getElementById('subscription-telegram-topic').value || undefined;
      if (!chatId || !categorySlug) return toast('Selecciona chat y categoría.', true);
      await api('/subscriptions/telegram', { method: 'POST', body: { chatId, threadId, categorySlug, adminOnly } });
    }
    document.getElementById('subscription-admin').checked = false;
    await loadSubscriptions();
    toast('Suscripción creada.');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('subscriptions-body').addEventListener('click', async (e) => {
  const id = e.target.dataset.deleteSub;
  if (!id) return;
  if (!confirm('¿Eliminar esta suscripción?')) return;
  try {
    await api(`/subscriptions/${id}`, { method: 'DELETE' });
    await loadSubscriptions();
    toast('Suscripción eliminada.');
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- tags ----------

function fillTagRoles() {
  const guild = guildById(state.guildId);
  const sel = document.getElementById('tag-role');
  sel.innerHTML = guild?.roles.length
    ? guild.roles.map((r) => `<option value="${r.id}">@${escapeHtml(r.name)}</option>`).join('')
    : '<option value="">Sin roles</option>';
}

function tagTarget(tag) {
  if (tag.type === 'role') {
    const guild = guildById(tag.scopeId);
    const role = guild?.roles.find((r) => r.id === tag.targetId);
    return `@${escapeHtml(role?.name || tag.targetId)}`;
  }
  return escapeHtml(tag.displayName || tag.targetId);
}

async function loadTags() {
  state.tags = await api('/tags');
  renderTags();
}

function renderTags() {
  const body = document.getElementById('tags-body');
  body.innerHTML = state.tags.length
    ? state.tags
        .map(
          (t) => `
      <tr>
        <td>${escapeHtml(categoryName(t.categoryId))}</td>
        <td>${t.type === 'role' ? 'Rol' : 'Usuario'} · ${t.platform}</td>
        <td>${tagTarget(t)}</td>
        <td><button class="secondary danger" data-delete-tag="${t.id}">Eliminar</button></td>
      </tr>`,
        )
        .join('')
    : emptyRow(4);
}

document.getElementById('tag-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const roleId = document.getElementById('tag-role').value;
  const categorySlug = document.getElementById('tag-category').value;
  if (!state.guildId || !roleId || !categorySlug) return toast('Selecciona servidor, rol y categoría.', true);
  try {
    await api('/tags/discord/role', { method: 'POST', body: { guildId: state.guildId, roleId, categorySlug } });
    await loadTags();
    toast('Rol agregado a las menciones.');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('tags-body').addEventListener('click', async (e) => {
  const id = e.target.dataset.deleteTag;
  if (!id) return;
  if (!confirm('¿Quitar esta mención?')) return;
  try {
    await api(`/tags/${id}`, { method: 'DELETE' });
    await loadTags();
    toast('Mención eliminada.');
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- templates ----------

function clearTemplateForm() {
  state.editingTemplate = false;
  document.getElementById('template-name').value = '';
  document.getElementById('template-name').disabled = false;
  document.getElementById('template-content').value = '';
}

async function loadTemplates() {
  const guild = guildById(state.guildId);
  document.getElementById('templates-guild-name').textContent = guild ? guild.name : 'selecciona un servidor';
  if (!state.guildId) {
    state.templates = [];
    renderTemplates();
    return;
  }
  state.templates = await api(`/templates?guildId=${encodeURIComponent(state.guildId)}`);
  renderTemplates();
}

function renderTemplates() {
  const body = document.getElementById('templates-body');
  body.innerHTML = state.templates.length
    ? state.templates
        .map(
          (t) => `
      <tr>
        <td>${escapeHtml(t.name)}</td>
        <td><pre>${escapeHtml(t.content)}</pre></td>
        <td>
          <button class="secondary" data-edit-template="${escapeHtml(t.name)}">Editar</button>
          <button class="secondary danger" data-delete-template="${escapeHtml(t.name)}">Eliminar</button>
        </td>
      </tr>`,
        )
        .join('')
    : emptyRow(3);
}

document.getElementById('template-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('template-name').value.trim();
  const content = document.getElementById('template-content').value;
  if (!state.guildId) return toast('Selecciona un servidor primero.', true);
  try {
    if (state.editingTemplate) {
      await api(`/templates/${encodeURIComponent(state.guildId)}/${encodeURIComponent(name)}`, { method: 'PUT', body: { content } });
    } else {
      await api('/templates', { method: 'POST', body: { guildId: state.guildId, name, content } });
    }
    clearTemplateForm();
    await loadTemplates();
    toast('Plantilla guardada.');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('template-clear').addEventListener('click', clearTemplateForm);

document.getElementById('templates-body').addEventListener('click', async (e) => {
  const editName = e.target.dataset.editTemplate;
  const deleteName = e.target.dataset.deleteTemplate;
  if (editName) {
    const t = state.templates.find((t) => t.name === editName);
    if (!t) return;
    state.editingTemplate = true;
    document.getElementById('template-name').value = t.name;
    document.getElementById('template-name').disabled = true;
    document.getElementById('template-content').value = t.content;
    document.getElementById('template-content').focus();
  } else if (deleteName) {
    if (!confirm(`¿Eliminar la plantilla "${deleteName}"?`)) return;
    try {
      await api(`/templates/${encodeURIComponent(state.guildId)}/${encodeURIComponent(deleteName)}`, { method: 'DELETE' });
      await loadTemplates();
      toast('Plantilla eliminada.');
    } catch (err) {
      toast(err.message, true);
    }
  }
});

// ---------- contests + announcements ----------

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatDurationSeconds(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

document.getElementById('contest-search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const platform = document.getElementById('contest-platform').value;
  const query = document.getElementById('contest-query').value.trim();
  try {
    const contests = await api(`/contests/${platform}${query ? `?query=${encodeURIComponent(query)}` : ''}`);
    renderContests(contests, platform);
  } catch (err) {
    toast(err.message, true);
  }
});

function renderContests(contests, platform) {
  const body = document.getElementById('contests-body');
  body.innerHTML = contests.length
    ? contests
        .slice(0, 15)
        .map(
          (c) => `
      <tr>
        <td><a href="${c.url}" target="_blank" rel="noopener">${escapeHtml(c.name)}</a></td>
        <td>${formatDateTime(c.startTime)}</td>
        <td>${formatDurationSeconds(c.durationSeconds)}</td>
        <td><button data-schedule='${escapeHtml(JSON.stringify({ platform, id: c.externalId, name: c.name }))}'>Programar</button></td>
      </tr>`,
        )
        .join('')
    : emptyRow(4);
}

document.getElementById('contests-body').addEventListener('click', (e) => {
  const payload = e.target.dataset.schedule;
  if (!payload) return;
  state.scheduleContest = JSON.parse(payload);
  document.getElementById('schedule-contest-name').textContent = state.scheduleContest.name;
  document.getElementById('schedule-cuando').value = '';
  document.getElementById('schedule-template').value = '';
  document.getElementById('schedule-error').classList.add('hidden');
  document.getElementById('schedule-modal').classList.remove('hidden');
});

document.getElementById('schedule-cancel').addEventListener('click', () => {
  document.getElementById('schedule-modal').classList.add('hidden');
});

document.getElementById('schedule-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const categorySlug = document.getElementById('schedule-category').value;
  const cuando = document.getElementById('schedule-cuando').value.trim() || undefined;
  const templateName = document.getElementById('schedule-template').value.trim() || undefined;
  const errEl = document.getElementById('schedule-error');
  errEl.classList.add('hidden');
  try {
    await api('/announcements', {
      method: 'POST',
      body: {
        platform: state.scheduleContest.platform,
        contestId: state.scheduleContest.id,
        categorySlug,
        cuando,
        templateName,
        guildId: state.guildId || undefined,
      },
    });
    document.getElementById('schedule-modal').classList.add('hidden');
    await loadAnnouncements();
    toast('Anuncio programado.');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

async function loadAnnouncements() {
  state.announcements = await api('/announcements');
  renderAnnouncements();
}

function renderAnnouncements() {
  const body = document.getElementById('announcements-body');
  body.innerHTML = state.announcements.length
    ? state.announcements
        .map(
          (a) => `
      <tr>
        <td>#${a.id}</td>
        <td>${escapeHtml(a.contestName || `${a.contestPlatform}/${a.contestExternalId}`)}</td>
        <td>${escapeHtml(categoryName(a.categoryId))}</td>
        <td>${formatDateTime(a.scheduledFor)}</td>
        <td>${a.templateName ? escapeHtml(a.templateName) : '—'}</td>
        <td><button class="secondary danger" data-cancel-announcement="${a.id}">Cancelar</button></td>
      </tr>`,
        )
        .join('')
    : emptyRow(6);
}

document.getElementById('announcements-body').addEventListener('click', async (e) => {
  const id = e.target.dataset.cancelAnnouncement;
  if (!id) return;
  if (!confirm(`¿Cancelar el anuncio #${id}?`)) return;
  try {
    await api(`/announcements/${id}`, { method: 'DELETE' });
    await loadAnnouncements();
    toast('Anuncio cancelado.');
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- recurring schedules ----------

function pad2(n) {
  return String(n).padStart(2, '0');
}

function scheduleLabel(s) {
  return `${escapeHtml(categoryName(s.categoryId))} · cada ${s.intervalDays}d @ ${pad2(s.hour)}:${pad2(s.minute)} (#${s.id})`;
}

async function loadSchedules() {
  state.schedules = await api('/schedules');
  renderSchedules();
}

function nextContestCell(s) {
  const pick = s.contests.find((c) => c.id === s.nextContestId);
  return pick ? escapeHtml(pick.contestName) : '<span class="muted">—</span>';
}

function renderPoolRow(s) {
  if (state.expandedSchedule !== s.id) return '';
  // Pools get long (hundreds of entries), so surface what's actionable: the committed pick first,
  // then the rest of the pool, then everything already sent.
  const rank = (c) => (c.id === s.nextContestId ? 0 : c.used ? 2 : 1);
  const rows = s.contests.length
    ? [...s.contests]
        .sort((a, b) => rank(a) - rank(b) || a.contestName.localeCompare(b.contestName))
        .map((c) => {
          const isNext = c.id === s.nextContestId;
          const status = c.used
            ? `<span class="badge">enviado ${formatDateTime(c.usedAt)}</span>`
            : isNext
              ? '<span class="badge admin">próximo</span>'
              : '<span class="badge">en lista</span>';
          return `
        <tr>
          <td><a href="${escapeHtml(c.contestUrl)}" target="_blank" rel="noopener">${escapeHtml(c.contestName)}</a></td>
          <td>${escapeHtml(c.contestPlatform)}</td>
          <td>${formatDateTime(c.contestStartTime)}</td>
          <td>${status}</td>
          <td>
            ${c.used || isNext ? '' : `<button class="secondary" data-set-next="${s.id}:${c.id}">Usar este</button>`}
            ${c.used ? '' : `<button class="secondary danger" data-remove-pool="${s.id}:${c.id}">Quitar</button>`}
          </td>
        </tr>`;
        })
        .join('')
    : '<tr class="empty-row"><td colspan="5">Lista vacía. Busca concursos abajo para agregarlos.</td></tr>';
  return `
      <tr>
        <td colspan="8">
          <table class="data-table nested">
            <thead><tr><th>Concurso</th><th>Plataforma</th><th>Inicio</th><th>Estado</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </td>
      </tr>`;
}

function renderSchedules() {
  const body = document.getElementById('schedules-body');
  body.innerHTML = state.schedules.length
    ? state.schedules
        .map((s) => {
          const total = s.contests.length;
          const used = s.contests.filter((c) => c.used).length;
          return `
      <tr>
        <td>${escapeHtml(categoryName(s.categoryId))}</td>
        <td>${s.intervalDays}d</td>
        <td><input class="cell-input" type="time" value="${pad2(s.hour)}:${pad2(s.minute)}" data-schedule-time="${s.id}" /></td>
        <td>${formatDateTime(s.nextRunAt)}</td>
        <td>${nextContestCell(s)}</td>
        <td>${used}/${total}</td>
        <td>${s.active ? '<span class="badge admin">activo</span>' : '<span class="badge">detenido</span>'}</td>
        <td>
          <button class="secondary" data-toggle-pool="${s.id}">${state.expandedSchedule === s.id ? 'Ocultar lista' : 'Ver lista'}</button>
          <button class="secondary" data-save-time="${s.id}">Guardar hora</button>
          <button class="secondary" data-toggle-schedule="${s.id}" data-active="${s.active}">${s.active ? 'Pausar' : 'Reanudar'}</button>
          <button class="secondary danger" data-delete-schedule="${s.id}">Eliminar</button>
        </td>
      </tr>${renderPoolRow(s)}`;
        })
        .join('')
    : emptyRow(8);
}

document.getElementById('schedule-recurring-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const categorySlug = document.getElementById('schedule-recurring-category').value;
  const intervalDays = Number(document.getElementById('schedule-recurring-interval').value);
  const time = document.getElementById('schedule-recurring-time').value;
  const templateName = document.getElementById('schedule-recurring-template').value.trim() || undefined;
  if (!categorySlug || !intervalDays || !time) return toast('Selecciona categoría, intervalo y hora.', true);
  const [hour, minute] = time.split(':').map(Number);
  try {
    await api('/schedules', {
      method: 'POST',
      body: { categorySlug, intervalDays, hour, minute, templateName, guildId: state.guildId || undefined },
    });
    document.getElementById('schedule-recurring-interval').value = '';
    document.getElementById('schedule-recurring-time').value = '';
    document.getElementById('schedule-recurring-template').value = '';
    await loadSchedules();
    toast('Programación creada.');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('schedules-body').addEventListener('click', async (e) => {
  const toggleId = e.target.dataset.toggleSchedule;
  const deleteId = e.target.dataset.deleteSchedule;
  const saveTimeId = e.target.dataset.saveTime;
  const togglePoolId = e.target.dataset.togglePool;
  const setNext = e.target.dataset.setNext;
  const removePool = e.target.dataset.removePool;
  if (togglePoolId) {
    state.expandedSchedule = state.expandedSchedule === Number(togglePoolId) ? null : Number(togglePoolId);
    renderSchedules();
  } else if (setNext) {
    const [scheduleId, contestId] = setNext.split(':');
    try {
      await api(`/schedules/${scheduleId}`, { method: 'PATCH', body: { nextContestId: Number(contestId) } });
      await loadSchedules();
      toast('Se actualizó el concurso del próximo envío.');
    } catch (err) {
      toast(err.message, true);
    }
  } else if (removePool) {
    const [scheduleId, contestId] = removePool.split(':');
    if (!confirm('¿Quitar este concurso de la lista?')) return;
    try {
      await api(`/schedules/${scheduleId}/contests/${contestId}`, { method: 'DELETE' });
      await loadSchedules();
      toast('Concurso quitado de la lista.');
    } catch (err) {
      toast(err.message, true);
    }
  } else if (saveTimeId) {
    const time = document.querySelector(`[data-schedule-time="${saveTimeId}"]`).value;
    if (!time) return toast('Ingresa una hora válida.', true);
    const [hour, minute] = time.split(':').map(Number);
    try {
      const updated = await api(`/schedules/${saveTimeId}`, { method: 'PATCH', body: { hour, minute } });
      await loadSchedules();
      toast(`Hora actualizada. Próximo envío: ${formatDateTime(updated.nextRunAt)}.`);
    } catch (err) {
      toast(err.message, true);
    }
  } else if (toggleId) {
    const active = e.target.dataset.active === 'true';
    try {
      await api(`/schedules/${toggleId}`, { method: 'PATCH', body: { active: !active } });
      await loadSchedules();
      toast(active ? 'Programación pausada.' : 'Programación reanudada.');
    } catch (err) {
      toast(err.message, true);
    }
  } else if (deleteId) {
    if (!confirm('¿Eliminar esta programación y su lista de concursos?')) return;
    try {
      await api(`/schedules/${deleteId}`, { method: 'DELETE' });
      await loadSchedules();
      toast('Programación eliminada.');
    } catch (err) {
      toast(err.message, true);
    }
  }
});

document.getElementById('schedule-contest-search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const platform = document.getElementById('schedule-contest-platform').value;
  const query = document.getElementById('schedule-contest-query').value.trim();
  try {
    const contests = await api(`/contests/${platform}${query ? `?query=${encodeURIComponent(query)}` : ''}`);
    renderScheduleContests(contests, platform);
  } catch (err) {
    toast(err.message, true);
  }
});

function renderScheduleContests(contests, platform) {
  const body = document.getElementById('schedule-contests-body');
  body.innerHTML = contests.length
    ? contests
        .slice(0, 15)
        .map(
          (c) => `
      <tr>
        <td><a href="${c.url}" target="_blank" rel="noopener">${escapeHtml(c.name)}</a></td>
        <td>${formatDateTime(c.startTime)}</td>
        <td>${formatDurationSeconds(c.durationSeconds)}</td>
        <td><button data-add-to-schedule='${escapeHtml(JSON.stringify({ platform, id: c.externalId, name: c.name }))}'>Agregar a lista</button></td>
      </tr>`,
        )
        .join('')
    : emptyRow(4);
}

document.getElementById('schedule-contests-body').addEventListener('click', (e) => {
  const payload = e.target.dataset.addToSchedule;
  if (!payload) return;
  if (!state.schedules.length) return toast('Crea una programación primero.', true);
  state.scheduleAddContest = JSON.parse(payload);
  document.getElementById('schedule-add-contest-name').textContent = state.scheduleAddContest.name;
  document.getElementById('schedule-add-contest-target').innerHTML = state.schedules.map((s) => `<option value="${s.id}">${scheduleLabel(s)}</option>`).join('');
  document.getElementById('schedule-add-contest-error').classList.add('hidden');
  document.getElementById('schedule-add-contest-modal').classList.remove('hidden');
});

document.getElementById('schedule-add-contest-cancel').addEventListener('click', () => {
  document.getElementById('schedule-add-contest-modal').classList.add('hidden');
});

document.getElementById('schedule-add-contest-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const scheduleId = document.getElementById('schedule-add-contest-target').value;
  const errEl = document.getElementById('schedule-add-contest-error');
  errEl.classList.add('hidden');
  try {
    await api(`/schedules/${scheduleId}/contests`, {
      method: 'POST',
      body: { platform: state.scheduleAddContest.platform, externalId: state.scheduleAddContest.id },
    });
    document.getElementById('schedule-add-contest-modal').classList.add('hidden');
    await loadSchedules();
    toast('Concurso agregado a la lista.');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

// ---------- boot ----------

async function initApp() {
  await Promise.all([loadGuilds(), loadCategories(), loadTelegramChats()]);
  fillSubscriptionChannels();
  fillTagRoles();
  setSubscriptionPlatformFields();
  await Promise.all([loadSubscriptions(), loadTags(), loadAnnouncements(), loadTemplates(), loadSchedules()]);
}

(async function boot() {
  if (!state.token) {
    showLogin();
    return;
  }
  try {
    await api('/auth/verify', { method: 'POST' });
    showApp();
    await initApp();
  } catch {
    logout();
  }
})();
