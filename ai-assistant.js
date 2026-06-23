// ============================================================
// AI-ASSISTANT.JS — Anthropic API integration
// ============================================================

const AIAssistant = (() => {
    const API_URL = 'https://api.anthropic.com/v1/messages';
    const MODEL = 'claude-sonnet-4-6';
    const STORAGE_KEY = 'anthropic_api_key';

    let messageHistory = [];
    let onInsertCode = null;
    let onSpriteCode = null;
    let getEditorCode = null;

    // DOM elements
    let messagesEl = null;
    let inputEl = null;
    let sendBtn = null;
    let apiKeyInput = null;

    function getApiKey() {
        return localStorage.getItem(STORAGE_KEY) || '';
    }

    function setApiKey(key) {
        localStorage.setItem(STORAGE_KEY, key.trim());
    }

    function init(config) {
        messagesEl = config.messagesEl;
        inputEl = config.inputEl;
        sendBtn = config.sendBtn;
        apiKeyInput = config.apiKeyInput;
        onInsertCode = config.onInsertCode;
        onSpriteCode = config.onSpriteCode;
        getEditorCode = config.getEditorCode;

        // Restore API key
        if (apiKeyInput) {
            apiKeyInput.value = getApiKey();
            apiKeyInput.addEventListener('change', () => setApiKey(apiKeyInput.value));
            apiKeyInput.addEventListener('blur', () => setApiKey(apiKeyInput.value));
        }

        // Send on Enter (Shift+Enter for newline)
        if (inputEl) {
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
        }

        // Welcome message
        addMessage('assistant', `👋 Hi! I'm your Phaser.js game development assistant.

I can help you:
• Write and debug Phaser 3 game code
• Design game mechanics and systems
• Generate procedural sprite drawing code
• Explain Phaser APIs and concepts

Enter your **Anthropic API key** above to get started, then ask me anything!

*Example: "Add an enemy that follows the player"*`);
    }

    function addMessage(role, content, isThinking = false) {
        if (!messagesEl) return null;

        const div = document.createElement('div');
        div.className = `ai-message ${role}`;

        if (isThinking) {
            div.className = 'ai-thinking';
            div.innerHTML = `<span>Thinking</span>
                <span class="ai-thinking-dot"></span>
                <span class="ai-thinking-dot"></span>
                <span class="ai-thinking-dot"></span>`;
        } else {
            div.innerHTML = formatMessage(content);

            // Add "Insert Code" buttons for code blocks
            if (role === 'assistant') {
                const codeBlocks = div.querySelectorAll('pre code');
                codeBlocks.forEach(block => {
                    const code = block.textContent;
                    const btnRow = document.createElement('div');
                    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:4px;';

                    const insertBtn = document.createElement('button');
                    insertBtn.className = 'ai-apply-btn';
                    insertBtn.textContent = '⬆ Insert Code';
                    insertBtn.style.fontSize = '11px';
                    insertBtn.addEventListener('click', () => {
                        if (onInsertCode) onInsertCode(code);
                    });

                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'sprite-tool-btn';
                    copyBtn.textContent = '📋 Copy';
                    copyBtn.style.fontSize = '11px';
                    copyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(code).then(() => {
                            copyBtn.textContent = '✓ Copied!';
                            setTimeout(() => copyBtn.textContent = '📋 Copy', 1500);
                        });
                    });

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
        // Simple markdown-like formatting
        let html = escapeHtml(content);

        // Code blocks ```lang\n...\n```
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code `...`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold **...**
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic *...*
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Bullet points
        html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul style="padding-left:16px;margin:4px 0">$1</ul>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function sendMessage(userText) {
        const key = getApiKey();
        if (!key) {
            addMessage('system', '⚠ Please enter your Anthropic API key above first.');
            return;
        }

        const text = userText || (inputEl ? inputEl.value.trim() : '');
        if (!text) return;

        if (inputEl) inputEl.value = '';
        if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

        addMessage('user', text);

        // Get current game code as context
        const gameCode = getEditorCode ? getEditorCode() : '';
        const contextSnippet = gameCode.length > 2000
            ? gameCode.slice(0, 2000) + '\n... (truncated)'
            : gameCode;

        messageHistory.push({ role: 'user', content: text });

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
                    max_tokens: 2048,
                    system: `You are an expert Phaser.js 3 game development assistant embedded in a browser-based game IDE.

The user is writing JavaScript game code using Phaser 3 (loaded from CDN). When providing code examples:
- Always use Phaser 3 syntax (not Phaser 2)
- Use the scene-based approach with preload/create/update functions or class-based scenes
- Wrap code in proper scene config structures when needed
- Keep examples concise and runnable
- Use arcade physics for simple games

Current game code context:
\`\`\`javascript
${contextSnippet}
\`\`\`

When asked to modify the game, provide the complete updated code or clear instructions for what to change.`,
                    messages: messageHistory.slice(-10), // last 10 for context
                }),
            });

            if (thinkingEl) thinkingEl.remove();

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
                const errMsg = err.error?.message || response.statusText;
                addMessage('system', `⚠ API Error (${response.status}): ${errMsg}`);
                messageHistory.pop(); // remove failed message
            } else {
                const data = await response.json();
                const assistantText = data.content?.[0]?.text || 'No response';
                messageHistory.push({ role: 'assistant', content: assistantText });
                addMessage('assistant', assistantText);
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
        if (!key) {
            addMessage('system', '⚠ Please enter your Anthropic API key first.');
            return null;
        }

        addMessage('user', `Generate sprite: ${description}`);
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
                    system: `You are a pixel art code generator. When asked to generate a sprite, respond with ONLY a JavaScript code block that draws on an HTML5 Canvas context.

The function receives these variables:
- canvas: the HTMLCanvasElement (already sized)
- ctx: the 2D canvas context
- width: canvas pixel width (usually 16 or 32)
- height: canvas pixel height (usually 16 or 32)

Rules:
- Use only ctx drawing commands (fillRect, arc, etc.)
- Work in pixel coordinates (0 to width-1)
- No external images or resources
- No function declarations — just direct drawing code
- Keep it compact and focused on the sprite description
- Use realistic pixel art colors

Example output format:
\`\`\`javascript
// Simple red character
ctx.fillStyle = '#e94560';
ctx.fillRect(6, 4, 4, 8);  // body
ctx.fillStyle = '#ffeaa7';
ctx.fillRect(6, 1, 4, 4);  // head
ctx.fillStyle = '#2d3436';
ctx.fillRect(7, 2, 1, 1);  // left eye
ctx.fillRect(9, 2, 1, 1);  // right eye
\`\`\`

Respond with ONLY the code block, no explanation.`,
                    messages: [{ role: 'user', content: `Generate a pixel art sprite of: ${description}` }],
                }),
            });

            if (thinkingEl) thinkingEl.remove();

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                addMessage('system', `⚠ API Error: ${err.error?.message || response.statusText}`);
                return null;
            }

            const data = await response.json();
            const text = data.content?.[0]?.text || '';

            // Extract code block
            const match = text.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
            const code = match ? match[1].trim() : text.trim();

            addMessage('assistant', `Here's the sprite drawing code for "${description}":\n\n\`\`\`javascript\n${code}\n\`\`\`\n\nClick "Insert Code" to apply it, or use "Apply to Sprite Editor" to draw it.`);

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
        addMessage('assistant', 'Chat cleared. How can I help with your game?');
    }

    return {
        init,
        sendMessage,
        generateSprite,
        clearHistory,
        getApiKey,
        setApiKey,
    };
})();
