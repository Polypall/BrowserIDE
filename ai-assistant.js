// ============================================================
// AI-ASSISTANT.JS — Anthropic API integration (non-coder friendly)
// ============================================================

const AIAssistant = (() => {
    const API_URL = 'https://api.anthropic.com/v1/messages';
    const MODEL = 'claude-sonnet-4-6';
    const STORAGE_KEY = 'anthropic_api_key';

    let messageHistory = [];
    let onInsertCode = null;
    let onReplaceCode = null;
    let onSpriteCode = null;
    let getEditorCode = null;

    let messagesEl = null;
    let inputEl = null;
    let sendBtn = null;
    let apiKeyInput = null;

    // Quick-action prompt buttons shown in the UI
    const QUICK_ACTIONS = [
        { label: '🎮 Make a platformer', prompt: 'Build me a complete platformer game with a player that can jump on platforms and collect coins. Make it fun and visually nice using colored shapes — no images needed.' },
        { label: '🚀 Space shooter', prompt: 'Build me a top-down space shooter. The player ship moves with arrow keys, shoots with spacebar, and there are enemies that move toward the player.' },
        { label: '🧩 Add an enemy', prompt: 'Add an enemy character to my current game that patrols back and forth. When the player touches it, they lose a life.' },
        { label: '⭐ Add score & lives', prompt: 'Add a score system and 3 lives to my game. Show them in the top-left corner. When lives reach 0, show a Game Over screen with a restart button.' },
        { label: '🎵 Add sound effects', prompt: 'Add sound effects to my game using Phaser\'s built-in audio synthesis (no audio files needed). Add a jump sound, coin collect sound, and game over sound.' },
        { label: '📱 Make it mobile friendly', prompt: 'Update my game to work on mobile phones — add on-screen touch buttons for movement and jumping.' },
        { label: '🌈 Improve the graphics', prompt: 'Make the graphics in my game look much better using Phaser\'s graphics drawing tools. Use nice colors, gradients, and shapes. Keep everything drawn in code — no image files needed.' },
        { label: '🔄 Add more levels', prompt: 'Add 3 levels to my game that get progressively harder. Each level should have a different layout and the game should automatically advance to the next level when complete.' },
        { label: '💥 Add particle effects', prompt: 'Add particle effects to my game — explosions when enemies die, sparkles when collecting items, using Phaser\'s built-in particle system.' },
        { label: '🏆 Add a high score', prompt: 'Add a high score system that saves to localStorage. Show the high score on screen and display a special message when the player beats it.' },
        { label: '🗺️ Explain my code', prompt: 'Look at my current game code and explain what each part does in plain English, like I\'m a beginner. Point out any bugs you see.' },
        { label: '🐛 Fix bugs', prompt: 'Review my current game code for bugs or errors. List any problems you find and provide the fixed code.' },
    ];

    const SYSTEM_PROMPT = `You are a friendly game development assistant inside a browser-based game IDE. Your job is to help people who may have NEVER coded before build games using Phaser 3.

IMPORTANT RULES:
1. Always provide COMPLETE, RUNNABLE game code — not fragments. When you add a feature, give the full updated game file.
2. Use simple language. Avoid jargon. If you use a technical term, explain it in plain English immediately after.
3. Every game must use only Phaser 3 (loaded from CDN). No other libraries.
4. Never use external image files unless the user uploaded them. Draw everything with Phaser Graphics objects.
5. Always structure games with the standard Phaser config + preload/create/update pattern.
6. After every code block, write a short "How to test it:" section telling the user what to click or press to see the new feature.
7. If the user asks a non-coding question about game design, answer it warmly and give suggestions.

PHASER 3 TEMPLATE TO ALWAYS START FROM:
\`\`\`javascript
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 450,
    backgroundColor: '#1a1a2e',
    parent: 'game-container',
    physics: { default: 'arcade', arcade: { gravity: { y: 400 }, debug: false } },
    scene: { preload, create, update }
};
const game = new Phaser.Game(config);

function preload() { }
function create() { }
function update() { }
\`\`\`

Current game code in the editor:
\`\`\`javascript
{{CODE}}
\`\`\``;

    function getApiKey() { return localStorage.getItem(STORAGE_KEY) || ''; }
    function setApiKey(key) { localStorage.setItem(STORAGE_KEY, key.trim()); }

    function init(config) {
        messagesEl = config.messagesEl;
        inputEl = config.inputEl;
        sendBtn = config.sendBtn;
        apiKeyInput = config.apiKeyInput;
        onInsertCode = config.onInsertCode;
        onReplaceCode = config.onReplaceCode || config.onInsertCode;
        onSpriteCode = config.onSpriteCode;
        getEditorCode = config.getEditorCode;

        if (apiKeyInput) {
            apiKeyInput.value = getApiKey();
            apiKeyInput.addEventListener('change', () => setApiKey(apiKeyInput.value));
            apiKeyInput.addEventListener('blur', () => setApiKey(apiKeyInput.value));
        }

        if (inputEl) {
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            });
        }
        if (sendBtn) sendBtn.addEventListener('click', () => sendMessage());

        renderQuickActions();
        addMessage('assistant', `👋 **Welcome to the Game Builder AI!**

I can build games for you even if you've never coded before. Just tell me what you want in plain English!

**Try saying things like:**
- *"Make me a platformer with a cat character"*
- *"Add an enemy that shoots back"*
- *"Make it look more colorful"*

Or click one of the quick-action buttons below. When I give you code, hit **▶ Run Game** to see it immediately!

${getApiKey() ? '✅ API key detected — ready to go!' : '⚠️ Enter your Anthropic API key above to enable AI features.'}`);
    }

    function renderQuickActions() {
        const container = document.getElementById('ai-quick-actions');
        if (!container) return;
        container.innerHTML = '';
        QUICK_ACTIONS.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'quick-action-btn';
            btn.textContent = action.label;
            btn.title = action.prompt;
            btn.addEventListener('click', () => {
                if (inputEl) inputEl.value = action.prompt;
                sendMessage();
            });
            container.appendChild(btn);
        });
    }

    function addMessage(role, content, isThinking = false) {
        if (!messagesEl) return null;
        const div = document.createElement('div');
        div.className = `ai-message ${role}`;

        if (isThinking) {
            div.className = 'ai-thinking';
            div.innerHTML = `<span>Building your game</span>
                <span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span>`;
        } else {
            div.innerHTML = formatMessage(content);

            if (role === 'assistant') {
                div.querySelectorAll('pre code').forEach(block => {
                    const code = block.textContent;
                    const btnRow = document.createElement('div');
                    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;';

                    const replaceBtn = document.createElement('button');
                    replaceBtn.className = 'ai-apply-btn';
                    replaceBtn.textContent = '⬆ Replace Game Code';
                    replaceBtn.title = 'Replaces everything in the editor with this code';
                    replaceBtn.addEventListener('click', () => { if (onReplaceCode) onReplaceCode(code, true); });

                    const insertBtn = document.createElement('button');
                    insertBtn.className = 'ai-apply-btn secondary';
                    insertBtn.textContent = '+ Insert at Cursor';
                    insertBtn.title = 'Inserts this code at the cursor position';
                    insertBtn.addEventListener('click', () => { if (onInsertCode) onInsertCode(code, false); });

                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'sprite-tool-btn';
                    copyBtn.textContent = '📋 Copy';
                    copyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(code).then(() => {
                            copyBtn.textContent = '✓ Copied!';
                            setTimeout(() => copyBtn.textContent = '📋 Copy', 1500);
                        });
                    });

                    btnRow.appendChild(replaceBtn);
                    btnRow.appendChild(insertBtn);
                    btnRow.appendChild(copyBtn);
                    block.parentElement.insertAdjacentElement('afterend', btnRow);
                });
            }
        }

        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return div;
    }

    function formatMessage(content) {
        let html = escapeHtml(content);
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="padding-left:16px;margin:4px 0">$1</ul>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    async function sendMessage(userText) {
        const key = getApiKey();
        if (!key) {
            addMessage('system', '⚠ Please enter your Anthropic API key in the field above first.');
            return;
        }

        const text = userText || (inputEl ? inputEl.value.trim() : '');
        if (!text) return;
        if (inputEl) inputEl.value = '';
        if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

        addMessage('user', text);
        messageHistory.push({ role: 'user', content: text });

        const gameCode = getEditorCode ? getEditorCode() : '';
        const codeContext = gameCode.length > 3000 ? gameCode.slice(0, 3000) + '\n// ...(truncated)' : gameCode;
        const systemPrompt = SYSTEM_PROMPT.replace('{{CODE}}', codeContext);

        const thinkingEl = addMessage('assistant', '', true);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-calls': 'true',
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: messageHistory.slice(-12),
                }),
            });

            if (thinkingEl) thinkingEl.remove();

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                addMessage('system', `⚠ API Error (${response.status}): ${err.error?.message || response.statusText}`);
                messageHistory.pop();
            } else {
                const data = await response.json();
                const reply = data.content?.[0]?.text || 'No response';
                messageHistory.push({ role: 'assistant', content: reply });
                addMessage('assistant', reply);
            }
        } catch (e) {
            if (thinkingEl) thinkingEl.remove();
            addMessage('system', `⚠ Network error: ${e.message}`);
            messageHistory.pop();
        } finally {
            if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '➤ Send'; }
        }
    }

    async function generateSprite(description) {
        const key = getApiKey();
        if (!key) { addMessage('system', '⚠ Please enter your Anthropic API key first.'); return null; }

        addMessage('user', `🎨 Generate sprite: ${description}`);
        const thinkingEl = addMessage('assistant', '', true);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-calls': 'true',
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: 1500,
                    system: `You generate pixel art by writing HTML5 Canvas drawing code. Output ONLY a javascript code block.
Variables available: ctx (CanvasRenderingContext2D), width, height (canvas size in pixels).
Use only ctx.fillRect, ctx.fillStyle, ctx.arc, ctx.beginPath, ctx.fill. No external resources. No functions — just direct drawing statements.`,
                    messages: [{ role: 'user', content: `Draw pixel art of: ${description}` }],
                }),
            });

            if (thinkingEl) thinkingEl.remove();
            if (!response.ok) { addMessage('system', '⚠ Sprite generation failed.'); return null; }

            const data = await response.json();
            const text = data.content?.[0]?.text || '';
            const match = text.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
            const code = match ? match[1].trim() : text.trim();

            addMessage('assistant', `Here's your "${description}" sprite! It will appear in the Sprite Editor.\n\n\`\`\`javascript\n${code}\n\`\`\``);
            if (onSpriteCode) onSpriteCode(code);
            return code;
        } catch (e) {
            if (thinkingEl) thinkingEl.remove();
            addMessage('system', `⚠ Error: ${e.message}`);
            return null;
        }
    }

    function clearHistory() {
        messageHistory = [];
        if (messagesEl) messagesEl.innerHTML = '';
        addMessage('assistant', '🔄 Chat cleared. What would you like to build?');
    }

    return { init, sendMessage, generateSprite, clearHistory, getApiKey, setApiKey };
})();
