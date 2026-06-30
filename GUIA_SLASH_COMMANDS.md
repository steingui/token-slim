# ⚡ Antigravity Global Slash Commands Guide

Para acelerar o desenvolvimento do seu MVP e automatizar interações complexas com o Antigravity (eu), você pode usar os seguintes **Slash Commands** diretamente em suas mensagens de chat. Sempre que você digitar um desses comandos no início do prompt, eu adotarei o protocolo de ação correspondente.

---

## 1. `/c7` ou `/context7`
* **Intuito:** Executar uma auditoria profunda do código ou diretório usando a ferramenta Context7 MCP.
* **Comportamento do Agente:** 
  1. Localizará e lerá os arquivos chaves ou diretórios informados.
  2. Gerará um mapa de dependências, fluxo de dados e análise de pontos fracos/segurança.
* **Exemplo de uso:**
  > `/c7 app.py`

---

## 2. `/think` ou `/sequential`
* **Intuito:** Ativar o raciocínio sequencial passo a passo (Sequential Thinking) para problemas complexos ou depuração de bugs difíceis.
* **Comportamento do Agente:**
  1. Não escreverá código imediatamente.
  2. Criará uma linha de raciocínio contendo: *Problema*, *Hipóteses*, *Experimentos de Validação*, *Evidências Coletadas* e *Conclusão*.
  3. Só então proporá as alterações necessárias.
* **Exemplo de uso:**
  > `/think por que o callback do GitHub retorna 400?`

---

## 3. `/mvp`
* **Intuito:** Desenvolver funcionalidades sem *overengineering*, focando em pragmatismo, velocidade e código limpo sustentável.
* **Comportamento do Agente:**
  1. Evitará abstrações complexas, padrões de projeto pesados (como Repositories ou Factory) a menos que estritamente necessário.
  2. Implementará a menor quantidade de código possível para a funcionalidade rodar com segurança.
  3. Priorizará mocks inteligentes ou fallbacks para acelerar o feedback.
* **Exemplo de uso:**
  > `/mvp criar endpoint de histórico do chat`

---

## 4. `/parallel`
* **Intuito:** Paralelizar tarefas no Git de forma automática usando branches separadas com `git worktree`.
* **Comportamento do Agente:**
  1. Identificará as tarefas separadas por pipe `|`.
  2. Criará diretórios isolados de `git worktree` para cada branch paralela.
  3. Resolverá cada tarefa de forma atômica e independente.
  4. Mesclará as branches na `main` de forma limpa, removerá os worktrees e abrirá os Pull Requests usando a CLI `gh`.
* **Exemplo de uso:**
  > `/parallel ponto 1: refatorar rotas | ponto 2: configurar sqlite no cache`

---

## 💡 Como Usar Todos Juntos:
Você pode encadear os comandos na sua requisição para definir as diretrizes completas de desenvolvimento:
> `/think /mvp /parallel tarefa A | tarefa B`
