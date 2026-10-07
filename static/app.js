const entryInput = document.querySelector('#entry');
const titleInput = document.querySelector('#title');
const wordCount = document.querySelector('#word-count');
const status = document.querySelector('#entry-status');
const insightPanel = document.querySelector('#insight-panel');
let selectedMood = 'steady';
let activeEntryId = null;
let entries = [];

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
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
  const method = activeEntryId ? 'PUT' : 'POST';
  const endpoint = activeEntryId ? `/api/entries/${activeEntryId}` : '/api/entries';
  const response = await fetch(endpoint, {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({content, mood: selectedMood, title: titleInput.value.trim() || null})});
  if (!response.ok) { status.textContent = 'Something interrupted the reflection. Try again.'; return; }
  const entry = await response.json(); renderInsight(entry); prepareNextNote(); status.textContent = 'Saved privately. Your note is in the journal list.'; await renderHistory();
});
document.querySelector('#chat-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const input = document.querySelector('#chat-input'); const message = input.value.trim(); if (!message) return;
  addMessage(message, 'user'); input.value = '';
  const response = await fetch('/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message, entry_id: activeEntryId})});
  const result = await response.json(); addMessage(result.reply, 'assistant');
});
function addMessage(text, role) { const message = document.createElement('div'); message.className = `chat-message ${role}`; message.textContent = text; document.querySelector('#chat-log').appendChild(message); }
async function renderHistory() {
  const response = await fetch('/api/entries'); entries = await response.json();
  const list = document.querySelector('#history-list');
  list.innerHTML = entries.length ? entries.map((item) => `<article class="history-item ${item.id === activeEntryId ? 'selected' : ''}" data-id="${item.id}"><div class="history-date">${new Date(item.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})} · ${new Date(item.created_at).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})}<button class="delete-entry" data-id="${item.id}" title="Delete note" aria-label="Delete note">×</button></div><div class="history-title">${escapeHtml(item.title)}</div><div class="history-preview">${escapeHtml(item.content.slice(0, 72))}${item.content.length > 72 ? '...' : ''}</div><div class="history-mood">${escapeHtml(item.mood)}</div></article>`).join('') : '<p class="empty-state">Your reflections will gather here.</p>';
  document.querySelectorAll('.history-item').forEach((item) => item.addEventListener('click', () => showEntry(entries.find((entry) => entry.id === Number(item.dataset.id)))));
  document.querySelectorAll('.delete-entry').forEach((button) => button.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!window.confirm('Delete this note permanently?')) return;
    const entryId = Number(button.dataset.id);
    const deleteResponse = await fetch(`/api/entries/${entryId}`, {method: 'DELETE'});
    if (!deleteResponse.ok) { status.textContent = 'The note could not be deleted.'; return; }
    if (activeEntryId === entryId) clearEditor();
    status.textContent = 'Note deleted.';
    await renderHistory();
  }));
}
async function loadDailyContext() {
  const response = await fetch('/api/daily-context'); if (!response.ok) return; const context = await response.json();
  document.querySelector('#assessment').textContent = context.assessment; document.querySelector('#quote').textContent = context.quote; document.querySelector('#quote-source').textContent = context.quote_source;
}
renderHistory(); loadDailyContext(); updateCount();
