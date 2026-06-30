"""
Token Slim — Chat with real-time LLM optimization toggles.
LLMLingua prompt compression + Semantic caching.
"""

import os
import time
import hashlib
import numpy as np
from flask import Flask, render_template, request, jsonify, redirect
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "token-slim-default-secret-key-12345")

# ============================================================
# Configuration
# ============================================================
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "demo")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
COMPRESSION_RATE = float(os.getenv("COMPRESSION_RATE", "0.5"))
CACHE_SIMILARITY_THRESHOLD = float(os.getenv("CACHE_SIMILARITY_THRESHOLD", "0.82"))

# ============================================================
# Global State
# ============================================================
_compressor = None
_cache = None
_openai_client = None

stats = {
    "total_requests": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "total_original_tokens": 0,
    "total_compressed_tokens": 0,
    "total_tokens_saved": 0,
    "estimated_cost_saved": 0.0,
}


# ============================================================
# LLMLingua Compressor (lazy-loaded)
# ============================================================
def get_compressor():
    """Lazy-load the LLMLingua compressor to avoid slow startup."""
    global _compressor
    if _compressor is None:
        from llmlingua import PromptCompressor
        _compressor = PromptCompressor(
            model_name="microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
            use_llmlingua2=True,
        )
    return _compressor


def compress_prompt(text, rate=0.5):
    """Compress a prompt using LLMLingua-2."""
    c = get_compressor()
    result = c.compress_prompt(
        text,
        rate=rate,
        force_tokens=["\n", "?", "!", "."],
    )
    return {
        "compressed_text": result["compressed_prompt"],
        "original_tokens": result["origin_tokens"],
        "compressed_tokens": result["compressed_tokens"],
        "ratio": round(result["ratio"], 2),
    }


# ============================================================
# Semantic Cache (lightweight, in-memory)
# ============================================================
class SemanticCache:
    """Simple cosine-similarity cache using ONNX embeddings."""

    def __init__(self):
        self.entries = []
        self._onnx = None
        self._ready = False

    def init(self):
        if self._ready:
            return
        try:
            from gptcache.embedding import Onnx
            self._onnx = Onnx()
            self._ready = True
        except Exception as e:
            print(f"[cache] init failed: {e}")

    def search(self, query, threshold=0.82):
        if not self._ready or not self.entries:
            return None
        q_emb = np.array(self._onnx.to_embeddings(query))
        best_score, best_resp = -1, None
        for entry in self.entries:
            score = float(
                np.dot(q_emb, entry["emb"])
                / (np.linalg.norm(q_emb) * np.linalg.norm(entry["emb"]) + 1e-8)
            )
            if score > best_score:
                best_score, best_resp = score, entry["response"]
        if best_score >= threshold:
            return {"response": best_resp, "similarity": round(best_score, 3)}
        return None

    def store(self, query, response):
        if not self._ready:
            return
        emb = np.array(self._onnx.to_embeddings(query))
        self.entries.append({"query": query, "emb": emb, "response": response})

    def clear(self):
        self.entries.clear()

    @property
    def size(self):
        return len(self.entries)


def get_cache():
    global _cache
    if _cache is None:
        _cache = SemanticCache()
        _cache.init()
    return _cache


# ============================================================
# LLM Provider
# ============================================================
def get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        base_url = OPENAI_BASE_URL
        if LLM_PROVIDER == "gemini" and (not base_url or "api.openai.com" in base_url):
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
        _openai_client = OpenAI(
            api_key=OPENAI_API_KEY or "demo",
            base_url=base_url or "https://api.openai.com/v1",
        )
    return _openai_client


def call_llm(message, history=None):
    """Call the configured LLM provider."""
    if LLM_PROVIDER == "demo":
        return _call_demo(message)

    if LLM_PROVIDER == "anthropic":
        import requests
        headers = {
            "x-api-key": OPENAI_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        data = {
            "model": OPENAI_MODEL or "claude-3-5-sonnet-20240620",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": message}]
        }
        resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=data)
        if resp.status_code != 200:
            raise Exception(f"Anthropic API Error ({resp.status_code}): {resp.text}")
        return resp.json()["content"][0]["text"]

    client = get_openai_client()
    messages = []
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    model = OPENAI_MODEL
    if LLM_PROVIDER == "gemini" and (not model or "gpt" in model):
        model = "gemini-1.5-flash"

    resp = client.chat.completions.create(
        model=model,
        messages=messages,
    )
    return resp.choices[0].message.content


def _call_demo(message):
    """Simulate an LLM response for demo/testing without an API key."""
    import random

    time.sleep(random.uniform(0.6, 1.8))
    m = message.lower()

    if "flask" in m:
        return (
            "**Flask** é um microframework web para Python criado por Armin Ronacher.\n\n"
            "### Características principais:\n"
            "- **Micro**: núcleo simples, extensível via extensions\n"
            "- **Jinja2**: engine de templates poderosa\n"
            "- **Werkzeug**: toolkit WSGI robusto\n\n"
            "```python\nfrom flask import Flask\n\napp = Flask(__name__)\n\n"
            "@app.route('/')\ndef hello():\n    return 'Hello, World!'\n```\n\n"
            "Para começar: `pip install flask && flask run`"
        )
    elif "python" in m:
        return (
            "**Python** é uma linguagem de programação de alto nível, interpretada e de propósito geral.\n\n"
            "### Por que Python?\n"
            "- Sintaxe limpa e legível\n"
            "- Ecossistema gigante (PyPI)\n"
            "- Excelente para IA/ML, web, automação\n"
            "- Comunidade ativa e acolhedora\n\n"
            "Versão atual: **Python 3.12+**"
        )
    elif "token" in m or "otimi" in m or "compress" in m:
        return (
            "### Otimização de Tokens para LLMs\n\n"
            "Existem duas abordagens principais:\n\n"
            "1. **Compressão de Prompts** (LLMLingua)\n"
            "   - Remove tokens redundantes antes de enviar\n"
            "   - Economia de até 20x no contexto\n\n"
            "2. **Cache Semântico** (GPTCache)\n"
            "   - Reutiliza respostas para perguntas similares\n"
            "   - Economia de 100% quando há cache hit\n\n"
            "> Combine ambos para máxima economia! 🚀"
        )
    else:
        return (
            f"Recebi sua pergunta sobre: *\"{message[:80]}\"*\n\n"
            "Esta é uma resposta simulada do **modo demo**. "
            "Para respostas reais, configure um provider no `.env`:\n\n"
            "```env\nLLM_PROVIDER=openai\nOPENAI_API_KEY=sk-...\n```\n\n"
            "Providers suportados: OpenAI, Ollama, OpenRouter, Groq, Together AI."
        )


# ============================================================
# Routes
# ============================================================
@app.route("/")
def index():
    return render_template(
        "index.html",
        provider=LLM_PROVIDER,
        model=OPENAI_MODEL,
    )


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = (data.get("message") or "").strip()
    use_compression = data.get("compression", False)
    use_cache = data.get("cache", False)
    rate = data.get("compression_rate", COMPRESSION_RATE)

    if not message:
        return jsonify({"error": "Mensagem vazia"}), 400

    # Rough token estimate (1 token ≈ 4 chars)
    est_tokens = max(len(message) // 4, len(message.split()))

    result = {
        "original_message": message,
        "compressed_message": message,
        "original_tokens": est_tokens,
        "compressed_tokens": est_tokens,
        "compression_ratio": "1.0x",
        "compression_time_ms": 0,
        "response": "",
        "response_time_ms": 0,
        "cache_hit": False,
        "cache_similarity": 0,
        "source": LLM_PROVIDER,
    }

    t_start = time.time()

    # STEP 1 — Compress if enabled and message is long enough
    final_prompt = message
    if use_compression and est_tokens > 10:
        try:
            t_comp = time.time()
            comp = compress_prompt(message, rate=rate)
            final_prompt = comp["compressed_text"]
            result["compressed_message"] = final_prompt
            result["original_tokens"] = comp["original_tokens"]
            result["compressed_tokens"] = comp["compressed_tokens"]
            result["compression_ratio"] = f"{comp['ratio']}x"
            result["compression_time_ms"] = round((time.time() - t_comp) * 1000)

            stats["total_original_tokens"] += comp["original_tokens"]
            stats["total_compressed_tokens"] += comp["compressed_tokens"]
            stats["total_tokens_saved"] += comp["original_tokens"] - comp["compressed_tokens"]
        except Exception as e:
            result["compression_error"] = str(e)

    # STEP 2 — Check cache if enabled
    cached = None
    if use_cache:
        try:
            cached = get_cache().search(final_prompt, threshold=CACHE_SIMILARITY_THRESHOLD)
        except Exception:
            pass

    if cached:
        result["response"] = cached["response"]
        result["cache_hit"] = True
        result["cache_similarity"] = cached["similarity"]
        result["source"] = "cache"
        stats["cache_hits"] += 1
    else:
        # STEP 3 — Call LLM
        try:
            result["response"] = call_llm(final_prompt)
        except Exception as e:
            result["response"] = f"Erro ao chamar LLM: {e}"
            result["source"] = "error"

        # STEP 4 — Store in cache
        if use_cache and result["source"] != "error":
            try:
                get_cache().store(final_prompt, result["response"])
            except Exception:
                pass

        stats["cache_misses"] += 1

    result["response_time_ms"] = round((time.time() - t_start) * 1000)
    stats["total_requests"] += 1

    # Cost estimate (GPT-4: ~$0.03/1K input tokens)
    if result["cache_hit"]:
        stats["estimated_cost_saved"] += result["original_tokens"] * 0.00003
    elif use_compression and result.get("original_tokens", 0) > result.get("compressed_tokens", 0):
        saved = result["original_tokens"] - result["compressed_tokens"]
        stats["estimated_cost_saved"] += saved * 0.00003

    return jsonify(result)


@app.route("/api/stats")
def get_stats():
    s = dict(stats)
    s["cache_size"] = get_cache().size if _cache else 0
    s["estimated_cost_saved"] = round(s["estimated_cost_saved"], 4)
    return jsonify(s)


@app.route("/api/clear-cache", methods=["POST"])
def clear_cache():
    if _cache:
        _cache.clear()
    stats["cache_hits"] = 0
    stats["cache_misses"] = 0
    return jsonify({"status": "ok", "message": "Cache limpo"})


@app.route("/api/update-config", methods=["POST"])
def update_config():
    global LLM_PROVIDER, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, _openai_client
    data = request.get_json()
    LLM_PROVIDER = data.get("provider", LLM_PROVIDER)
    OPENAI_API_KEY = data.get("openaiApiKey", OPENAI_API_KEY)
    OPENAI_BASE_URL = data.get("openaiBaseUrl", OPENAI_BASE_URL)
    OPENAI_MODEL = data.get("openaiModel", OPENAI_MODEL)
    
    # Reset client so it gets re-initialized on next call
    _openai_client = None
    
    print(f"[config] Updated dynamically: Provider={LLM_PROVIDER}, Model={OPENAI_MODEL}, BaseURL={OPENAI_BASE_URL}")
    return jsonify({
        "status": "success",
        "provider": LLM_PROVIDER,
        "model": OPENAI_MODEL,
        "base_url": OPENAI_BASE_URL
    })


@app.route("/api/test-connection", methods=["POST"])
def test_connection():
    data = request.get_json()
    provider = data.get("provider", "demo")
    api_key = data.get("openaiApiKey", "")
    base_url = data.get("openaiBaseUrl", "")
    model = data.get("openaiModel", "")

    if provider == "demo":
        return jsonify({"success": True, "message": "Modo de demonstração funcionando!"})

    if provider == "anthropic":
        try:
            import requests
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": model or "claude-3-5-sonnet-20240620",
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "ping"}]
            }
            resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            if resp.status_code == 200:
                return jsonify({"success": True, "message": "Conexão com Anthropic estabelecida!"})
            else:
                return jsonify({"success": False, "error": f"Erro {resp.status_code}: {resp.text}"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)})

    try:
        from openai import OpenAI
        if provider == "gemini" and (not base_url or "api.openai.com" in base_url):
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
        if provider == "gemini" and (not model or "gpt" in model):
            model = "gemini-1.5-flash"
        if not base_url:
            base_url = "https://api.openai.com/v1"
        if not model:
            model = "gpt-3.5-turbo"

        client = OpenAI(
            api_key=api_key or "demo",
            base_url=base_url,
        )
        if provider == "ollama":
            # For Ollama, we can list models to check if the Ollama service is running/responsive
            client.models.list()
        else:
            # For OpenAI/OpenRouter/Custom/Gemini, try a quick 1-token request
            client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1
            )
        return jsonify({"success": True, "message": "Conexão estabelecida com sucesso!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/openrouter/auth-init")
def openrouter_auth_init():
    callback = "http://127.0.0.1:5000/api/openrouter/callback"
    auth_url = f"https://openrouter.ai/auth?callback_url={callback}"
    return redirect(auth_url)


@app.route("/api/openrouter/callback")
def openrouter_callback():
    code = request.args.get("code")
    if not code:
        return "Erro: Código de autorização não fornecido.", 400
    
    try:
        import requests
        resp = requests.post(
            "https://openrouter.ai/api/v1/auth/keys",
            json={"code": code}
        )
        resp_data = resp.json()
        api_key = resp_data.get("key")
        if not api_key:
            return f"Erro ao gerar chave: {resp_data}", 400
        
        redirect_url = f"vscode://steingui.token-slim/auth?provider=openrouter&token={api_key}&baseUrl=https://openrouter.ai/api/v1&model=meta-llama/llama-3-8b-instruct:free"
        
        return f"""
        <html>
            <head>
                <title>Conexão Concluída</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    body {{
                        font-family: 'Outfit', sans-serif;
                        text-align: center;
                        padding: 50px;
                        background: #0b0f19;
                        color: #f3f4f6;
                    }}
                    .card {{
                        background: #111827;
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 12px;
                        padding: 40px;
                        max-width: 480px;
                        margin: 0 auto;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    }}
                    .icon {{
                        font-size: 48px;
                        margin-bottom: 20px;
                    }}
                    h1 {{
                        font-size: 24px;
                        color: #6366f1;
                        margin-bottom: 10px;
                    }}
                    p {{
                        color: #9ca3af;
                        margin-bottom: 30px;
                    }}
                    .btn {{
                        display: inline-block;
                        padding: 12px 24px;
                        background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                        color: white;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        transition: all 0.25s;
                    }}
                    .btn:hover {{
                        transform: translateY(-2px);
                        box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                    }}
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">🔐</div>
                    <h1>Conexão Concluída!</h1>
                    <p>O OpenRouter gerou sua chave e ela foi enviada para o VSCode.</p>
                    <a href="{redirect_url}" class="btn">Abrir VSCode e Sincronizar</a>
                </div>
                <script>
                    window.location.href = "{redirect_url}";
                </script>
            </body>
        </html>
        """
    except Exception as e:
        return f"Erro na requisição: {str(e)}", 500



# ============================================================
# Entry point
# ============================================================
if __name__ == "__main__":
    print(f"\n🗜️  Token Slim")
    print(f"   Provider: {LLM_PROVIDER}")
    print(f"   Model:    {OPENAI_MODEL}")
    print(f"   URL:      http://127.0.0.1:5000\n")
    app.run(debug=True, host='127.0.0.1', port=5000)
