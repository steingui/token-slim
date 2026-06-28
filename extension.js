const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let flaskProcess = null;
let outputChannel = null;

function activate(context) {
    outputChannel = vscode.window.createOutputChannel("Token Slim");
    outputChannel.appendLine("Token Slim extension activating...");

    // Start local Flask server
    startFlaskServer(context);

    // Watch configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('token-slim')) {
                outputChannel.appendLine("Token Slim configuration changed, restarting server...");
                stopFlaskServer();
                startFlaskServer(context);
            }
        })
    );

    // Register Webview View Provider (Sidebar)
    const sidebarProvider = new TokenSlimWebviewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "token-slim.sidebarView",
            sidebarProvider
        )
    );

    // Register Open Chat Panel Command (Full Tab)
    context.subscriptions.push(
        vscode.commands.registerCommand('token-slim.openChat', () => {
            const panel = vscode.window.createWebviewPanel(
                'tokenSlimChat',
                'Token Slim Optimizer',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [context.extensionUri]
                }
            );
            panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
        })
    );
}

function startFlaskServer(context) {
    const extensionPath = context.extensionPath;
    const scriptPath = path.join(extensionPath, 'app.py');
    
    const config = vscode.workspace.getConfiguration('token-slim');
    const provider = config.get('provider') || 'demo';
    const apiKey = config.get('openaiApiKey') || '';
    const baseUrl = config.get('openaiBaseUrl') || 'https://api.openai.com/v1';
    const model = config.get('openaiModel') || 'gpt-3.5-turbo';

    outputChannel.appendLine(`Starting Flask server at: ${scriptPath}`);
    outputChannel.appendLine(`Config: Provider=${provider}, Model=${model}, BaseURL=${baseUrl}`);

    // Spawn Python process with VSCode configurations as env variables
    flaskProcess = cp.spawn('python3', [scriptPath], {
        cwd: extensionPath,
        env: { 
            ...process.env, 
            PYTHONUNBUFFERED: '1',
            LLM_PROVIDER: provider,
            OPENAI_API_KEY: apiKey,
            OPENAI_BASE_URL: baseUrl,
            OPENAI_MODEL: model
        }
    });

    flaskProcess.stdout.on('data', (data) => {
        outputChannel.append(`[Flask STDOUT] ${data.toString()}`);
    });

    flaskProcess.stderr.on('data', (data) => {
        outputChannel.append(`[Flask STDERR] ${data.toString()}`);
    });

    flaskProcess.on('close', (code) => {
        outputChannel.appendLine(`Flask process exited with code ${code}`);
    });
}

function stopFlaskServer() {
    if (flaskProcess) {
        outputChannel.appendLine("Stopping Flask server process...");
        flaskProcess.kill();
        flaskProcess = null;
    }
}

class TokenSlimWebviewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };
        webviewView.webview.html = getWebviewContent(webviewView.webview, this.extensionUri);
    }
}

function getWebviewContent(webview, extensionUri) {
    const htmlPath = path.join(extensionUri.fsPath, 'templates', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Convert CSS path
    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'static', 'css', 'style.css')));
    html = html.replace("{{ url_for('static', filename='css/style.css') }}", cssUri.toString());

    // Convert JS path
    const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'static', 'js', 'app.js')));
    html = html.replace("{{ url_for('static', filename='js/app.js') }}", jsUri.toString());

    // Replace provider and model
    const config = vscode.workspace.getConfiguration('token-slim');
    const provider = config.get('provider') || 'demo';
    const model = config.get('openaiModel') || 'gpt-3.5-turbo';
    
    html = html.replaceAll("{{ provider }}", provider);
    html = html.replaceAll("{{ model }}", model);

    return html;
}

function deactivate() {
    stopFlaskServer();
}

module.exports = {
    activate,
    deactivate
};
