# Token Slim 🗜️

Token Slim é uma extensão do VSCode e um chat de IA otimizado em tempo real. Ele integra técnicas de **compressão de prompts** (LLMLingua) e **cache semântico** (GPTCache), permitindo que você visualize a economia de tokens, latência e custos ao vivo através de toggles.

Inspirado em clientes open-source como o Alpaca (Jeffser), o Token Slim traz transparência financeira e de performance para fluxos com LLMs diretamente de dentro do seu editor de código.

---

## 🚀 Como Executar no VSCode (Modo de Desenvolvimento)

Para rodar e testar a extensão localmente:

### 1. Pré-requisitos
Certifique-se de ter o Python 3 e o Node.js instalados, além de ter as dependências Python configuradas:
```bash
# Na pasta da extensão
pip install -r requirements.txt
npm install
```

### 2. Rodar a extensão
1. Abra a pasta do projeto no seu VSCode:
   ```bash
   code .
   ```
2. Pressione a tecla **`F5`** (ou vá na aba *Run and Debug* e selecione **Run Extension**).
3. Uma nova janela do VSCode (Extension Development Host) será aberta contendo a extensão carregada.

---

## 🛠️ Como Utilizar a Extensão

### Acessar a Interface
*   **Sidebar (Barra Lateral):** Um ícone de circuito integrado (`circuit-board`) aparecerá no menu lateral esquerdo do VSCode. Clique nele para abrir o painel de chat.
*   **Editor Central (Tela Cheia):** Abra a paleta de comandos (`Ctrl+Shift+P` / `Cmd+Shift+P`) e digite:
    ```text
    Token Slim: Open Chat Panel
    ```
    Isso abrirá a interface do chat em uma nova aba completa de edição.

### Configurar Chaves de API e Providers
A extensão integra-se diretamente ao sistema de configurações do VSCode:
1. Abra as Configurações (`Ctrl+,` ou `Cmd+,`).
2. Pesquise por `Token Slim`.
3. Altere as seguintes opções:
    *   **Provider:** Escolha entre `demo`, `openai` ou `ollama`.
    *   **API Key:** Chave de API do respectivo provider.
    *   **Base URL:** Modifique para conectar a outros providers compatíveis (ex: OpenRouter, Groq, local Ollama).
    *   **Model:** Nome do modelo de linguagem.

> [!TIP]
> Qualquer alteração nas configurações reinicia automaticamente o servidor Flask sidecar em segundo plano para aplicar os novos valores instantaneamente.

---

## ⚡ Funcionalidades
*   **Toggles de Otimização:** Ligue e desligue a compressão (LLMLingua-2) ou cache semântico de forma independente na barra lateral.
*   **Métricas em Tempo Real:** Cada mensagem exibe tags contendo a latência (ms), o status do cache (HIT/MISS com similaridade em %) e a taxa de compressão exata.
*   **Dashboard de Sessão:** Acompanhe a quantidade total de tokens economizados e a estimativa monetária poupada na sessão.
*   **Modo Demo:** Funciona fora da caixa sem chaves de API, gerando respostas rápidas baseadas em tópicos simulados para testes ágeis de UI e fluxos.
