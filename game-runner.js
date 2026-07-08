// ============================================================
// GAME-RUNNER.JS — iframe game runner
// ============================================================

const GameRunner = (() => {
    let iframe = null;
    let placeholder = null;
    let running = false;
    let consoleCallback = null;

    function init(iframeEl, placeholderEl) {
        iframe = iframeEl;
        placeholder = placeholderEl;

        // Listen for messages from the iframe (console output)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'GAME_CONSOLE') {
                if (consoleCallback) {
                    consoleCallback(event.data.level, event.data.args);
                }
            }
            if (event.data && event.data.type === 'GAME_ERROR') {
                if (consoleCallback) {
                    consoleCallback('error', [event.data.message]);
                }
            }
        });
    }

    function buildIframeHTML(userCode, assets) {
        // Build asset injection
        let assetLoaderCode = '';
        if (assets && assets.length > 0) {
            const assetMap = {};
            assets.forEach(a => { assetMap[a.name] = a.dataUrl; });
            assetLoaderCode = `
// === INJECTED ASSETS ===
// Phaser 3 rejects raw base64 data URIs ("Local data URIs are not supported"),
// so convert each uploaded asset to a Blob URL, which the loader accepts.
window.__ASSETS_RAW__ = ${JSON.stringify(assetMap)};
window.__ASSETS__ = {};
(function() {
    function dataURItoBlobURL(dataURI) {
        const comma = dataURI.indexOf(',');
        const meta = dataURI.slice(0, comma);
        const b64 = dataURI.slice(comma + 1);
        const mime = (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
    }
    for (const k in window.__ASSETS_RAW__) {
        try { window.__ASSETS__[k] = dataURItoBlobURL(window.__ASSETS_RAW__[k]); }
        catch (e) { window.__ASSETS__[k] = window.__ASSETS_RAW__[k]; }
    }
})();

// Convenience: if code calls load.image(key) / load.audio(key) with an asset
// name but no URL, resolve it from the injected assets automatically.
const _origLoadImage = Phaser.Loader.LoaderPlugin.prototype.image;
Phaser.Loader.LoaderPlugin.prototype.image = function(key, url, ...args) {
    if (window.__ASSETS__ && window.__ASSETS__[key] && (url === undefined || url === null)) {
        return _origLoadImage.call(this, key, window.__ASSETS__[key], ...args);
    }
    if (window.__ASSETS__ && window.__ASSETS__[url]) {
        return _origLoadImage.call(this, key, window.__ASSETS__[url], ...args);
    }
    return _origLoadImage.call(this, key, url, ...args);
};
const _origLoadAudio = Phaser.Loader.LoaderPlugin.prototype.audio;
Phaser.Loader.LoaderPlugin.prototype.audio = function(key, url, ...args) {
    if (window.__ASSETS__ && window.__ASSETS__[key] && (url === undefined || url === null)) {
        return _origLoadAudio.call(this, key, window.__ASSETS__[key], ...args);
    }
    if (window.__ASSETS__ && typeof url === 'string' && window.__ASSETS__[url]) {
        return _origLoadAudio.call(this, key, window.__ASSETS__[url], ...args);
    }
    return _origLoadAudio.call(this, key, url, ...args);
};
`;
        }

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Game Preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #000;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
  }
  canvas { display: block; }
  #game-container { display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
<div id="game-container"></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"><\/script>
<script>
// === CONSOLE BRIDGE ===
(function() {
    const _log = console.log.bind(console);
    const _warn = console.warn.bind(console);
    const _error = console.error.bind(console);
    const _info = console.info.bind(console);

    function sendMsg(level, args) {
        try {
            const serialized = args.map(a => {
                try {
                    if (typeof a === 'object') return JSON.stringify(a, null, 2);
                    return String(a);
                } catch(e) { return String(a); }
            });
            window.parent.postMessage({ type: 'GAME_CONSOLE', level, args: serialized }, '*');
        } catch(e) {}
    }

    console.log = function(...args) { _log(...args); sendMsg('log', args); };
    console.warn = function(...args) { _warn(...args); sendMsg('warn', args); };
    console.error = function(...args) { _error(...args); sendMsg('error', args); };
    console.info = function(...args) { _info(...args); sendMsg('info', args); };

    window.addEventListener('error', function(e) {
        window.parent.postMessage({
            type: 'GAME_ERROR',
            message: e.message + ' (line ' + e.lineno + ')'
        }, '*');
    });

    window.addEventListener('unhandledrejection', function(e) {
        window.parent.postMessage({
            type: 'GAME_ERROR',
            message: 'Unhandled Promise rejection: ' + (e.reason ? e.reason.toString() : 'unknown')
        }, '*');
    });
})();

${assetLoaderCode}

// === USER GAME CODE ===
try {
${userCode}
} catch(e) {
    window.parent.postMessage({ type: 'GAME_ERROR', message: e.message }, '*');
    document.body.innerHTML = '<div style="color:#f48771;padding:20px;font-family:monospace;font-size:14px;">' +
        '<h3>&#x26A0; Game Error</h3><pre>' + e.message + '</pre></div>';
}
<\/script>
</body>
</html>`;
    }

    function runGame(code, assets) {
        if (!iframe) return;

        running = true;
        const html = buildIframeHTML(code, assets);

        // Show iframe, hide placeholder
        if (placeholder) placeholder.classList.add('hidden');
        iframe.classList.remove('hidden');

        // Set srcdoc to run the game
        iframe.srcdoc = html;

        if (consoleCallback) {
            consoleCallback('info', ['▶ Game started']);
        }
    }

    function stopGame() {
        if (!iframe) return;

        running = false;
        iframe.srcdoc = '';

        // Show placeholder
        if (placeholder) placeholder.classList.remove('hidden');
        iframe.classList.add('hidden');

        if (consoleCallback) {
            consoleCallback('info', ['⏹ Game stopped']);
        }
    }

    function isRunning() { return running; }

    function onConsole(callback) {
        consoleCallback = callback;
    }

    return { init, runGame, stopGame, isRunning, onConsole };
})();
