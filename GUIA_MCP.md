# 📖 Guia Prático — MCP Servers no Token Slim

> Aprenda a usar cada MCP server instalado no projeto com exemplos reais.

---

## O que é MCP?

MCP (Model Context Protocol) é o "USB-C da IA" — um padrão que conecta agentes AI a ferramentas externas. Em vez de cada AI precisar de integrações customizadas, qualquer agente MCP-compatível (Copilot, Claude, Cursor) pode usar os mesmos servers.

**No Token Slim**, os MCPs servem para duas coisas:
1. **Acelerar seu desenvolvimento** (Context7, Sequential Thinking, Playwright, etc.)
2. **Expor o Token Slim como plataforma** (Token Slim MCP Server customizado)

---

## 📋 Servers Instalados

| # | Server | Tipo | Para quê |
|---|--------|------|----------|
| 1 | Context7 | Documentação | Docs atualizadas de qualquer lib |
| 2 | Sequential Thinking | Raciocínio | Análise step-by-step de problemas complexos |
| 3 | Filesystem | Arquivos | Ler/escrever arquivos do projeto |
| 4 | Playwright | Browser | Automação e testes de UI |
| 5 | Sentry | Monitoramento | Tracking de erros em produção |
| 6 | Token Slim MCP | Customizado | Suas ferramentas de compressão via MCP |
| 7 | GitHub | Código | Issues, PRs, branches (já estava ativo) |

---

## 1. 🔍 Context7 — Documentação Atualizada

### O que resolve
Quando você pergunta ao AI sobre Flask, LLMLingua ou OpenAI SDK, ele pode sugerir código com APIs velhas. Context7 injeta a documentação atual da lib direto no contexto.

### Como usar
Adicione `use context7` no final do seu prompt:

```
Como usar LLMLingua-2 compress_prompt com rate dinâmico? use context7
```

```
Qual a forma correta de fazer error handling no OpenAI SDK v2? use context7
```

```
Como configurar Flask-Migrate com Application Factory pattern? use context7
```

### Quando usar
- Sempre que perguntar sobre **APIs de bibliotecas** específicas
- Quando receber código que **parece deprecated**
- Para confirmar a **sintaxe correta** de uma lib que atualizou recentemente

### Quando NÃO usar
- Perguntas genéricas de lógica ou arquitetura
- Discussões que não envolvem bibliotecas específicas

---

## 2. 🧠 Sequential Thinking — Raciocínio Estruturado

### O que resolve
Problemas complexos onde o AI precisa pensar em etapas, considerar tradeoffs, e possivelmente voltar atrás em decisões.

### Como usar
Peça explicitamente para usar o tool:

```
Use sequential thinking para analisar: devo migrar o cache 
in-memory do Token Slim para Redis ou SQLite? Considere que 
estamos em MVP e rodamos como extensão VSCode.
```

```
Use sequential thinking para planejar a refatoração do app.py 
em módulos separados seguindo o Application Factory pattern.
```

```
Use sequential thinking para debugar por que o cache semântico 
está retornando falsos positivos com threshold 0.82.
```

### Quando usar
- **Decisões arquiteturais** com tradeoffs
- **Debugging** de problemas com múltiplas causas possíveis
- **Planejamento** de features com muitas dependências
- Quando a primeira resposta do AI **não te convenceu**

### Quando NÃO usar
- Perguntas simples com resposta direta
- Tarefas mecânicas (gerar boilerplate, formatar código)

---

## 3. 📁 Filesystem — Acesso a Arquivos

### O que resolve
Permite ao AI ler e escrever nos arquivos do projeto diretamente, útil para refatorações multi-arquivo.

### Como usar
O AI usa automaticamente quando precisa acessar arquivos. Você pode pedir:

```
Leia o arquivo app.py e me diga quantas rotas Flask existem.
```

```
Liste todos os arquivos .html no diretório templates/
```

### Escopo de segurança
Está configurado para acessar **apenas** `/home/gui/token-slim`. Não acessa outros diretórios.

---

## 4. 🎭 Playwright — Automação de Browser

### O que resolve
Testes e automação da interface web do Token Slim sem precisar fazer manualmente.

### Como usar

```
Abra http://localhost:5000 e me descreva a interface do chat.
```

```
Navegue até http://localhost:5000/login e tire um screenshot.
```

```
Teste o fluxo: abra o chat, ative o toggle de compressão, 
envie a mensagem "O que é Flask?" e me mostre o resultado.
```

### Pré-requisito
O Flask server precisa estar rodando (`python3 app.py`) antes de usar o Playwright.

### Quando usar
- **Testes de UI** rápidos sem escrever código de teste
- **Validação visual** de mudanças no frontend
- **Screenshots** para documentação
- **Debugging** de problemas visuais

---

## 5. 🛡️ Sentry — Monitoramento de Erros

### O que resolve
Captura erros automaticamente no Flask (500s, exceções de providers LLM, etc.) e envia para o dashboard do Sentry.

### Setup necessário
1. Crie uma conta em [sentry.io](https://sentry.io)
2. Crie um projeto Flask
3. Copie o DSN
4. Adicione ao `.env`:

```env
SENTRY_DSN=https://xxxxx@yyy.ingest.sentry.io/zzzzz
SENTRY_TRACES_RATE=0.3
```

### Como funciona
Já está integrado no `app.py`. Quando há um `SENTRY_DSN` no `.env`, ele ativa automaticamente. Sem o DSN, nada muda — zero impacto.

### O MCP Server do Sentry
O server em `.vscode/mcp.json` permite perguntar ao AI sobre erros:

```
Quais são os erros mais recentes no Sentry do Token Slim?
```

```
O que está causando o erro 500 na rota /api/chat?
```

> **Nota:** O MCP do Sentry vai pedir seu Auth Token na primeira vez que for ativado no VSCode.

---

## 6. 🗜️ Token Slim MCP — Seu Server Customizado

### O que resolve
Expõe a compressão de prompts do Token Slim como ferramenta MCP. Qualquer agente AI pode usar.

### Tools disponíveis

| Tool | O que faz |
|------|-----------|
| `compress_prompt` | Comprime texto usando LLMLingua-2 |
| `estimate_tokens` | Estima tokens sem comprimir |

### Como testar standalone

```bash
# Rodar o server
python3 mcp_server.py

# Testar com o Inspector (interface web)
npx @modelcontextprotocol/inspector python3 mcp_server.py
```

### Como usar via AI
O server já está no `mcp.json`. No chat do Copilot/Cursor:

```
Use o tool compress_prompt para comprimir este texto: 
"Flask é um microframework web para Python. Ele foi criado 
por Armin Ronacher e é baseado nas bibliotecas Werkzeug e 
Jinja2. Flask é chamado de microframework porque mantém o 
núcleo simples mas extensível..."
```

```
Estime quantos tokens tem o conteúdo do arquivo README.md
```

### Expandindo
Para adicionar novos tools, edite `mcp_server.py`:

```python
@mcp.tool()
def meu_novo_tool(parametro: str) -> dict:
    """Descrição do que faz."""
    # sua lógica
    return {"resultado": "..."}
```

---

## 7. 🐙 GitHub MCP — Gestão de Código

### O que resolve
Issues, PRs, branches, code review — tudo sem sair do editor.

### Como usar

```
Crie uma issue no repo token-slim: "Migrar cache in-memory 
para persistência com SQLite"
```

```
Liste os PRs abertos do token-slim
```

```
Faça review do PR #5 do token-slim
```

---

## 🎯 Cheatsheet Rápido

```
┌─────────────────────────────────────────────────────┐
│  PROMPT PATTERNS QUE ATIVAM MCPs                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  "... use context7"                                 │
│   → Busca docs atualizadas da lib mencionada        │
│                                                     │
│  "Use sequential thinking para..."                  │
│   → Raciocínio step-by-step com revisão             │
│                                                     │
│  "Abra/navegue/teste http://..."                    │
│   → Playwright controla o browser                   │
│                                                     │
│  "Comprima/estime tokens de..."                     │
│   → Token Slim MCP tools                            │
│                                                     │
│  "Crie issue/PR/branch no repo..."                  │
│   → GitHub MCP                                      │
│                                                     │
│  "Quais erros no Sentry..."                         │
│   → Sentry MCP (precisa SENTRY_DSN)                 │
│                                                     │
│  "Leia/liste/escreva arquivo..."                    │
│   → Filesystem MCP                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ Arquivos de Configuração

| Arquivo | O que contém |
|---------|-------------|
| `.vscode/mcp.json` | Configuração de todos os MCP servers |
| `.vscode/settings.json` | Habilita MCP discovery no VSCode |
| `mcp_server.py` | Server customizado do Token Slim |
| `requirements.txt` | Dependências Python (inclui sentry-sdk, fastmcp) |
| `.env` | Secrets (SENTRY_DSN, API keys) — não versionado |

---

## 🔧 Troubleshooting

### "Server não aparece no VSCode"
1. Reabra o VSCode na pasta do projeto
2. Verifique se `chat.mcp.enabled` está `true` em settings
3. Ctrl+Shift+P → "MCP: List Servers" para verificar

### "npx demora para iniciar"
Normal na primeira vez — ele baixa o pacote. Nas próximas vezes é instantâneo (já está cacheado).

### "Token Slim MCP não inicia"
```bash
# Testar manualmente
python3 mcp_server.py

# Se der erro de import, instale:
pip install --break-system-packages fastmcp
```

### "Sentry não captura erros"
Verifique se `SENTRY_DSN` está no `.env` e reinicie o Flask server.
