const entryInput = document.querySelector('#entry');
const titleInput = document.querySelector('#title');
const wordCount = document.querySelector('#word-count');
const status = document.querySelector('#entry-status');
const insightPanel = document.querySelector('#insight-panel');
const DB_NAME = 'innerly-local';
const STORE_NAME = 'entries';
let selectedMood = 'steady';
let activeEntryId = null;
let entries = [];
let storageReady = false;

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
}
function openLocalDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function localEntries() {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.sort((left, right) => new Date(right.created_at) - new Date(left.created_at)));
    request.onerror = () => reject(request.error);
  });
}
async function saveLocalEntry(entry) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
async function removeLocalEntry(id) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
async function prepareLocalStorage() {
  if (storageReady) return;
  let local = await localEntries();
  if (!local.length) {
    try {
      const response = await fetch('/api/entries');
      if (response.ok) {
        const serverEntries = await response.json();
        await Promise.all(serverEntries.map(saveLocalEntry));
        local = serverEntries;
      }
    } catch (error) {
      status.textContent = 'Your device storage is ready for a new note.';
    }
  }
  storageReady = true;
  entries = local;
}
function updateCount() {
  const count = entryInput.value.trim() ? entryInput.value.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${count} word${count === 1 ? '' : 's'}`;
}
function showEntry(entry) {
  activeEntryId = entry.id;
  titleInput.value = entry.title;
  entryInput.value = entry.content;
  selectedMood = entry.mood;
  document.querySelectorAll('.mood').forEach((item) => item.classList.toggle('selected', item.dataset.mood === selectedMood));
  document.querySelector('#editor-kicker').textContent = `${new Date(entry.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} · EDITING`;
  renderInsight(entry);
  updateCount();
  window.scrollTo({top: 0, behavior: 'smooth'});
}
function renderInsight(entry) {
  document.querySelector('#insight-title').textContent = entry.title;
  document.querySelector('#insight').textContent = entry.insight || '';
  document.querySelector('#reflection').textContent = entry.reflection || '';
  document.querySelector('#goal').textContent = entry.goal || '';
  document.querySelector('#tags').innerHTML = entry.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  insightPanel.hidden = false;
}
function prepareNextNote() {
  activeEntryId = null; titleInput.value = ''; entryInput.value = ''; selectedMood = 'steady';
  document.querySelectorAll('.mood').forEach((item) => item.classList.toggle('selected', item.dataset.mood === selectedMood));
  document.querySelector('#editor-kicker').textContent = 'TODAY · NEW NOTE';
  updateCount();
}
function clearEditor() {
  prepareNextNote();
  insightPanel.hidden = true; status.textContent = ''; updateCount(); entryInput.focus();
}
entryInput.addEventListener('input', updateCount);
document.querySelectorAll('.mood').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.mood').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected'); selectedMood = button.dataset.mood;
}));
document.querySelector('#new-entry').addEventListener('click', clearEditor);
document.querySelector('#save-entry').addEventListener('click', async () => {
  const content = entryInput.value.trim();
  if (!content) { status.textContent = 'Give the page a thought to work with.'; return; }
  status.textContent = 'Sitting with your words...';
  const existing = entries.find((entry) => entry.id === activeEntryId);
  const response = await fetch('/api/analyze', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({content})});
  if (!response.ok) { status.textContent = 'Something interrupted the reflection. Try again.'; return; }
  const analysis = await response.json();
  const now = new Date().toISOString();
  const entry = {...analysis, id: activeEntryId || crypto.randomUUID(), content, mood: selectedMood, created_at: existing?.created_at || now, updated_at: now};
  await saveLocalEntry(entry);
  entries = await localEntries();
  renderInsight(entry); prepareNextNote(); status.textContent = 'Saved privately on this device. Your note is in the journal list.'; await renderHistory();
});
document.querySelector('#chat-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const input = document.querySelector('#chat-input'); const message = input.value.trim(); if (!message) return;
  addMessage(message, 'user'); input.value = '';
  const current = entries.find((entry) => entry.id === activeEntryId);
  const response = await fetch('/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message, context: current?.content || ''})});
  const result = await response.json(); addMessage(result.reply, 'assistant');
});
function addMessage(text, role) { const message = document.createElement('div'); message.className = `chat-message ${role}`; message.textContent = text; document.querySelector('#chat-log').appendChild(message); }
async function renderHistory() {
  await prepareLocalStorage(); entries = await localEntries();
  const list = document.querySelector('#history-list');
  list.innerHTML = entries.length ? entries.map((item) => `<article class="history-item ${item.id === activeEntryId ? 'selected' : ''}" data-id="${escapeHtml(String(item.id))}"><div class="history-date">${new Date(item.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})} · ${new Date(item.created_at).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})}<button class="delete-entry" data-id="${escapeHtml(String(item.id))}" title="Delete note" aria-label="Delete note">×</button></div><div class="history-title">${escapeHtml(item.title)}</div><div class="history-preview">${escapeHtml(item.content.slice(0, 72))}${item.content.length > 72 ? '...' : ''}</div><div class="history-mood">${escapeHtml(item.mood)}</div></article>`).join('') : '<p class="empty-state">Your reflections will gather here.</p>';
  document.querySelectorAll('.history-item').forEach((item) => item.addEventListener('click', () => showEntry(entries.find((entry) => String(entry.id) === item.dataset.id))));
  document.querySelectorAll('.delete-entry').forEach((button) => button.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!window.confirm('Delete this note permanently from this device?')) return;
    const entryId = button.dataset.id;
    await removeLocalEntry(entryId);
    if (activeEntryId === entryId) clearEditor();
    status.textContent = 'Note deleted from this device.';
    await renderHistory();
  }));
}
async function loadDailyContext() {
  const response = await fetch('/api/daily-context'); if (!response.ok) return; const context = await response.json();
  document.querySelector('#assessment').textContent = context.assessment; document.querySelector('#quote').textContent = context.quote; document.querySelector('#quote-source').textContent = context.quote_source;
}
renderHistory(); loadDailyContext(); updateCount();
