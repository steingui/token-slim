/**
 * Token Slim — Frontend Logic
 * Handles chat, toggles, stats, and markdown rendering.
 */

// ── State ──────────────────────────────────────────────
const state = {
  compression: false,
  cache: false,
  compressionRate: 0.5,
  sending: false,
};

// ── DOM refs ───────────────────────────────────────────
const $messages    = document.getElementById('chat-messages');
const $input       = document.getElementById('chat-input');
const $sendBtn     = document.getElementById('send-btn');
const $welcome     = document.getElementById('welcome');
const $compToggle  = document.getElementById('toggle-compression');
const $cacheToggle = document.getElementById('toggle-cache');
const $rateSlider  = document.getElementById('compression-rate');
const $rateValue   = document.getElementById('rate-value');
const $rateGroup   = document.getElementById('rate-group');
const $compCard    = document.getElementById('card-compression');
const $cacheCard   = document.getElementById('card-cache');

// Stats DOM
const $statTokens  = document.getElementById('stat-tokens');
const $statCache   = document.getElementById('stat-cache');
const $statCost    = document.getElementById('stat-cost');

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $compToggle.addEventListener('change',  onCompressionToggle);
  $cacheToggle.addEventListener('change', onCacheToggle);
  $rateSlider.addEventListener('input',   onRateChange);
  $sendBtn.addEventListener('click',      sendMessage);
  $input.addEventListener('keydown',      onInputKey);

  // Tip clicks
  document.querySelectorAll('.tip').forEach(tip => {
    tip.addEventListener('click', () => {
      $input.value = tip.dataset.prompt;
      $input.focus();
    });
  });

  $input.focus();
});

// ── Toggle handlers ────────────────────────────────────
function onCompressionToggle() {
  state.compression = $compToggle.checked;
  $compCard.classList.toggle('active', state.compression);
  $rateGroup.classList.toggle('visible', state.compression);
}

function onCacheToggle() {
  state.cache = $cacheToggle.checked;
  $cacheCard.classList.toggle('active', state.cache);
}

function onRateChange() {
  state.compressionRate = parseFloat($rateSlider.value);
  $rateValue.textContent = `${Math.round(state.compressionRate * 100)}%`;
}

// ── Input handling ─────────────────────────────────────
function onInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Auto-resize textarea
  setTimeout(() => {
    $input.style.height = 'auto';
    $input.style.height = Math.min($input.scrollHeight, 120) + 'px';
  }, 0);
}

// ── Send message ───────────────────────────────────────
async function sendMessage() {
  const text = $input.value.trim();
  if (!text || state.sending) return;

  state.sending = true;
  $sendBtn.disabled = true;

  // Hide welcome
  if ($welcome) $welcome.style.display = 'none';

  // Add user message
  addMessage('user', text);
  $input.value = '';
  $input.style.height = 'auto';

  // Show typing indicator
  const typingEl = addTypingIndicator();

  try {
    const resp = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        compression: state.compression,
        cache: state.cache,
        compression_rate: state.compressionRate,
      }),
    });

    const data = await resp.json();
    typingEl.remove();

    if (data.error) {
      addMessage('assistant', `⚠️ ${data.error}`);
    } else {
      addMessage('assistant', data.response, buildMeta(data));
    }

    // Update stats
    updateStats();
  } catch (err) {
    typingEl.remove();
    addMessage('assistant', `❌ Erro de conexão: ${err.message}`);
  } finally {
    state.sending = false;
    $sendBtn.disabled = false;
    $input.focus();
  }
}

// ── Build meta tags ────────────────────────────────────
function buildMeta(data) {
  const tags = [];

  if (data.original_tokens !== data.compressed_tokens && data.compressed_tokens > 0) {
    tags.push({
      cls: 'compression',
      text: `🗜️ ${data.original_tokens} → ${data.compressed_tokens} tokens (${data.compression_ratio})`,
    });
  }

  if (data.cache_hit) {
    tags.push({
      cls: 'cache-hit',
      text: `⚡ CACHE (${Math.round(data.cache_similarity * 100)}% similar)`,
    });
  } else if (data.source !== 'error') {
    tags.push({
      cls: 'cache-miss',
      text: `🌐 ${data.source.toUpperCase()}`,
    });
  }

  tags.push({
    cls: 'time',
    text: `⏱️ ${data.response_time_ms}ms`,
  });

  return tags;
}

// ── Render messages ────────────────────────────────────
function addMessage(role, content, metaTags = []) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;

  const avatar = role === 'user' ? '👤' : '🤖';
  const rendered = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content);

  msg.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-body">
      <div class="message-content">${rendered}</div>
      ${metaTags.length ? `
        <div class="message-meta">
          ${metaTags.map(t => `<span class="meta-tag ${t.cls}">${t.text}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  $messages.appendChild(msg);
  $messages.scrollTop = $messages.scrollHeight;
  return msg;
}

function addTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-body">
      <div class="message-content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  $messages.appendChild(el);
  $messages.scrollTop = $messages.scrollHeight;
  return el;
}

// ── Stats ──────────────────────────────────────────────
async function updateStats() {
  try {
    const resp = await fetch('http://localhost:5000/api/stats');
    const s = await resp.json();

    $statTokens.textContent = s.total_tokens_saved.toLocaleString();
    const totalCache = s.cache_hits + s.cache_misses;
    const hitRate = totalCache > 0 ? Math.round((s.cache_hits / totalCache) * 100) : 0;
    $statCache.textContent = `${s.cache_hits}/${totalCache} (${hitRate}%)`;
    $statCost.textContent = `$${s.estimated_cost_saved.toFixed(4)}`;
  } catch (_) { /* ignore */ }
}

// ── Clear cache ────────────────────────────────────────
async function clearCache() {
  try {
    await fetch('http://localhost:5000/api/clear-cache', { method: 'POST' });
    updateStats();
  } catch (_) { /* ignore */ }
}

// ── Simple Markdown renderer ───────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Code blocks (```lang\ncode\n```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // H3
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered list
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  // Clean up
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h3>)/g, '$1');
  html = html.replace(/(<\/h3>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

  return html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
