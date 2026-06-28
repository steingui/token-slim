/**
 * Token Slim — Frontend Logic
 * Handles chat, toggles, stats, and markdown rendering.
 */

// ── VSCode API Bridge ───────────────────────────────────
let vscode = null;
try {
  vscode = acquireVsCodeApi();
} catch (e) {
  // Not running inside VSCode
}

// ── State ──────────────────────────────────────────────
const state = {
  compression: false,
  cache: false,
  compressionRate: 0.5,
  sending: false,
  connected: false,
  showConfig: false,
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

// Status & Onboarding DOM
const $statusBadge   = document.getElementById('status-badge');
const $providerInfo  = document.getElementById('sidebar-provider-info');
const $configCard    = document.getElementById('config-form-card');
const $providerSelect = document.getElementById('provider-select');
const $apiKeyInput   = document.getElementById('api-key-input');
const $apiKeyField   = document.getElementById('api-key-field');
const $baseUrlInput  = document.getElementById('base-url-input');
const $baseUrlField  = document.getElementById('base-url-field');
const $modelInput    = document.getElementById('model-input');
const $modelField    = document.getElementById('model-field');
const $saveConfigBtn = document.getElementById('save-config-btn');

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $compToggle.addEventListener('change',  onCompressionToggle);
  $cacheToggle.addEventListener('change', onCacheToggle);
  $rateSlider.addEventListener('input',   onRateChange);
  $sendBtn.addEventListener('click',      sendMessage);
  $input.addEventListener('keydown',      onInputKey);

  // Configuration form events
  $providerSelect.addEventListener('change', (e) => updateFormVisibility(e.target.value));
  $saveConfigBtn.addEventListener('click', saveConfiguration);
  if ($providerInfo) {
    $providerInfo.addEventListener('click', () => {
      state.showConfig = !state.showConfig;
      $configCard.style.display = state.showConfig ? 'block' : 'none';
    });
  }

  // Tip clicks
  document.querySelectorAll('.tip').forEach(tip => {
    tip.addEventListener('click', () => {
      if (state.connected) {
        $input.value = tip.dataset.prompt;
        $input.focus();
      }
    });
  });

  // Load configuration from VSCode settings
  if (vscode) {
    vscode.postMessage({ command: 'getConfig' });
  }

  // Listen for config data back from VSCode
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'configData') {
      $providerSelect.value = message.provider;
      $apiKeyInput.value = message.openaiApiKey;
      $baseUrlInput.value = message.openaiBaseUrl;
      $modelInput.value = message.openaiModel;
      updateFormVisibility(message.provider);
      
      // Auto-open config if API key is blank and provider isn't 'demo'
      if (!message.openaiApiKey && message.provider !== 'demo') {
        state.showConfig = true;
        $configCard.style.display = 'block';
      }
    }
  });

  // Start ping loop to check if Flask server is online
  checkBackendConnection();
  setInterval(checkBackendConnection, 2000);

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

// ── Onboarding / Config & Connection Helpers ─────────────
function updateFormVisibility(provider) {
  if (provider === 'demo') {
    $apiKeyField.style.display = 'none';
    $baseUrlField.style.display = 'none';
    $modelField.style.display = 'none';
  } else if (provider === 'ollama') {
    $apiKeyField.style.display = 'none';
    $baseUrlField.style.display = 'block';
    $modelField.style.display = 'block';
    if (!$baseUrlInput.value || $baseUrlInput.value.includes('api.openai.com')) {
      $baseUrlInput.value = 'http://localhost:11434';
    }
    if (!$modelInput.value || $modelInput.value.includes('gpt-')) {
      $modelInput.value = 'llama2';
    }
  } else {
    // openai / custom
    $apiKeyField.style.display = 'block';
    $baseUrlField.style.display = 'block';
    $modelField.style.display = 'block';
    if ($baseUrlInput.value.includes('11434')) {
      $baseUrlInput.value = 'https://api.openai.com/v1';
    }
    if ($modelInput.value === 'llama2') {
      $modelInput.value = 'gpt-3.5-turbo';
    }
  }
}

function saveConfiguration() {
  const data = {
    provider: $providerSelect.value,
    openaiApiKey: $apiKeyInput.value.trim(),
    openaiBaseUrl: $baseUrlInput.value.trim(),
    openaiModel: $modelInput.value.trim()
  };

  if (data.provider === 'openai' && !data.openaiApiKey) {
    alert('Por favor, insira a chave de API para o provider selecionado.');
    return;
  }

  if (vscode) {
    vscode.postMessage({
      command: 'updateConfig',
      data: data
    });
  } else {
    alert('Configuração simulada com sucesso!');
  }

  state.showConfig = false;
  $configCard.style.display = 'none';

  // Request new config display info update
  setTimeout(() => {
    if (vscode) {
      vscode.postMessage({ command: 'getConfig' });
    }
  }, 1000);
}

async function checkBackendConnection() {
  try {
    const res = await fetch('http://localhost:5000/api/stats');
    if (res.ok) {
      if (!state.connected) {
        state.connected = true;
        $statusBadge.textContent = '🟢 Conectado';
        $statusBadge.className = 'status-indicator connected';
        $input.removeAttribute('disabled');
        $sendBtn.removeAttribute('disabled');
        $input.placeholder = 'Digite sua mensagem...';
        updateStats();
      }
    } else {
      throw new Error();
    }
  } catch (e) {
    state.connected = false;
    $statusBadge.textContent = '⏳ Iniciando...';
    $statusBadge.className = 'status-indicator loading';
    $input.setAttribute('disabled', 'true');
    $sendBtn.setAttribute('disabled', 'true');
    $input.placeholder = 'Iniciando otimizador. Por favor, aguarde...';
  }
}
