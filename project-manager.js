// ============================================================
// PROJECT-MANAGER.JS — Save, load, export projects
// ============================================================

const ProjectManager = (() => {
    const PROJECTS_KEY = 'indicolite_projects';
    let currentProjectName = 'My Game';

    function loadProjects() {
        try {
            const data = localStorage.getItem(PROJECTS_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    function saveProjects(projects) {
        try {
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
            return true;
        } catch (e) {
            console.warn('Storage error:', e.message);
            return false;
        }
    }

    function saveProject(name, code, assets) {
        const projects = loadProjects();
        projects[name] = {
            name,
            code,
            assets: assets || [],
            savedAt: new Date().toISOString(),
            version: 1,
        };
        const success = saveProjects(projects);
        if (success) currentProjectName = name;
        return success;
    }

    function loadProject(name) {
        const projects = loadProjects();
        const project = projects[name];
        if (project) currentProjectName = name;
        return project || null;
    }

    function deleteProject(name) {
        const projects = loadProjects();
        delete projects[name];
        saveProjects(projects);
    }

    function listProjects() {
        const projects = loadProjects();
        return Object.values(projects).map(p => ({
            name: p.name,
            savedAt: p.savedAt,
        })).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    }

    function getCurrentProjectName() {
        return currentProjectName;
    }

    function setCurrentProjectName(name) {
        currentProjectName = name;
    }

    // ============================================================
    // EXPORT: Single self-contained HTML
    // ============================================================
    function exportHTML(code, assets) {
        const assetMap = {};
        (assets || []).forEach(a => { assetMap[a.name] = a.dataUrl; });

        // Phaser rejects raw data URIs, so exported builds convert the embedded
        // base64 assets to Blob URLs at runtime (same as the in-app preview).
        const assetScript = Object.keys(assetMap).length > 0
            ? `<script>
window.__ASSETS_RAW__ = ${JSON.stringify(assetMap)};
window.__ASSETS__ = {};
(function(){
  function toBlobURL(d){
    var c=d.indexOf(','),m=d.slice(0,c),b=d.slice(c+1);
    var mime=(m.match(/:(.*?);/)||[])[1]||'application/octet-stream';
    var bin=atob(b),u=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u],{type:mime}));
  }
  for(var k in window.__ASSETS_RAW__){try{window.__ASSETS__[k]=toBlobURL(window.__ASSETS_RAW__[k]);}catch(e){window.__ASSETS__[k]=window.__ASSETS_RAW__[k];}}
})();
<\/script>`
            : '';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(currentProjectName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  #game-container { display: flex; align-items: center; justify-content: center; }
  canvas { display: block; }
</style>
</head>
<body>
<div id="game-container"></div>
<!-- Phaser 3 Game Framework -->
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"><\/script>
<!-- Embedded Assets -->
${assetScript}
<!-- Game Code -->
<script>
${code}
<\/script>
</body>
</html>`;
        return html;
    }

    // ============================================================
    // EXPORT: ZIP file
    // ============================================================
    async function exportZip(code, assets) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip not loaded');
        }

        const zip = new JSZip();

        // Main HTML file (references assets by filename)
        const assetRefs = {};
        const assetsFolder = zip.folder('assets');

        (assets || []).forEach(asset => {
            assetRefs[asset.name] = `assets/${asset.name}`;

            // Decode base64 and add to zip
            if (asset.dataUrl) {
                const base64Data = asset.dataUrl.split(',')[1];
                if (base64Data) {
                    assetsFolder.file(asset.name, base64Data, { base64: true });
                }
            }
        });

        // Build HTML that references local asset files
        const assetLoadScript = Object.keys(assetRefs).length > 0
            ? `// Assets are in the /assets/ folder\nwindow.__ASSET_PATHS__ = ${JSON.stringify(assetRefs)};`
            : '';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(currentProjectName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  canvas { display: block; }
</style>
</head>
<body>
<div id="game-container"></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"><\/script>
<script>
${assetLoadScript}
${code}
<\/script>
</body>
</html>`;

        zip.file('index.html', html);
        zip.file('game.js', code);

        // README
        zip.file('README.txt', `${currentProjectName}
${'='.repeat(currentProjectName.length)}

This game was created with Indicolite.

To run:
1. Open index.html in a web browser (requires internet for Phaser CDN)
2. Or serve with a local HTTP server: python3 -m http.server 8080

Files:
- index.html  : Main game file
- game.js     : Game source code
- assets/     : Game assets (images, sounds)

Built with Phaser 3 (https://phaser.io)
Created: ${new Date().toLocaleString()}
`);

        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        return blob;
    }

    function downloadFile(filename, content, mimeType) {
        const blob = content instanceof Blob
            ? content
            : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function downloadHTML(code, assets) {
        const html = exportHTML(code, assets);
        const safeName = currentProjectName.replace(/[^a-zA-Z0-9-_]/g, '_');
        downloadFile(`${safeName}.html`, html, 'text/html');
    }

    async function downloadZip(code, assets) {
        const blob = await exportZip(code, assets);
        const safeName = currentProjectName.replace(/[^a-zA-Z0-9-_]/g, '_');
        downloadFile(`${safeName}.zip`, blob, 'application/zip');
    }

    // ============================================================
    // EXPORT: GitHub-ready repository zip
    // ============================================================
    async function exportGitHub(code, assets) {
        if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');

        const zip = new JSZip();
        const safeName = currentProjectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

        // index.html — standalone playable game
        const html = exportHTML(code, assets);
        zip.file('index.html', html);
        zip.file('game.js', code);

        // Assets folder
        const assetsFolder = zip.folder('assets');
        (assets || []).forEach(asset => {
            if (asset.dataUrl) {
                const base64Data = asset.dataUrl.split(',')[1];
                if (base64Data) assetsFolder.file(asset.name, base64Data, { base64: true });
            }
        });

        // README.md — GitHub Pages instructions
        zip.file('README.md', `# ${currentProjectName}

A browser game built with [Indicolite](https://github.com/polypall/browseride) and [Phaser 3](https://phaser.io).

## 🎮 Play Online

This game is hosted on GitHub Pages: \`https://YOUR-USERNAME.github.io/${safeName}/\`

## 🚀 How to host on GitHub Pages (free)

1. Create a new GitHub repository named \`${safeName}\`
2. Upload all these files to the repository
3. Go to **Settings → Pages**
4. Under "Source" select **Deploy from branch → main → / (root)**
5. Click Save — your game will be live in ~1 minute!

## 📁 Files

- \`index.html\` — The playable game (open this in any browser)
- \`game.js\` — Game source code
- \`assets/\` — Images and sounds used by the game

## 🛠️ Built with

- [Phaser 3](https://phaser.io) — Game framework
- [Indicolite](https://github.com/polypall/browseride) — Created with

---
*Created: ${new Date().toLocaleString()}*
`);

        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        return blob;
    }

    async function downloadGitHubZip(code, assets) {
        const blob = await exportGitHub(code, assets);
        const safeName = currentProjectName.replace(/[^a-zA-Z0-9-_]/g, '_');
        downloadFile(`${safeName}-github.zip`, blob, 'application/zip');
    }

    // ============================================================
    // PUBLISH INSTRUCTIONS modal
    // ============================================================
    function showPublishModal() {
        const existing = document.getElementById('publish-modal');
        if (existing) { existing.style.display = 'flex'; return; }

        const modal = document.createElement('div');
        modal.id = 'publish-modal';
        modal.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;
            display:flex;align-items:center;justify-content:center;font-family:inherit;
        `;
        modal.innerHTML = `
        <div style="background:#252526;border:1px solid #3e3e42;border-radius:8px;padding:28px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto;color:#d4d4d4;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2 style="color:#4ec9b0;margin:0;">🌐 Publish Your Game</h2>
                <button onclick="document.getElementById('publish-modal').style.display='none'"
                    style="background:none;border:none;color:#858585;cursor:pointer;font-size:20px;">✕</button>
            </div>

            <p style="margin-bottom:20px;color:#9cdcfe;">Your game is a self-contained HTML file — it works anywhere that serves web pages. Here are your free options:</p>

            <div class="publish-option" style="background:#1e1e1e;border-radius:6px;padding:16px;margin-bottom:12px;border-left:3px solid #4ec9b0;">
                <h3 style="color:#4ec9b0;margin:0 0 6px">⭐ GitHub Pages (Recommended — Free Forever)</h3>
                <ol style="padding-left:18px;line-height:1.8;font-size:13px;">
                    <li>Click <strong>Export → GitHub Zip</strong> below to download your game</li>
                    <li>Go to <a href="https://github.com/new" target="_blank" style="color:#569cd6;">github.com/new</a> and create a free account + new repository</li>
                    <li>Upload the files from the zip to the repository</li>
                    <li>Go to <strong>Settings → Pages → Deploy from branch → main</strong></li>
                    <li>Your game is live at <code>https://your-username.github.io/your-game-name/</code></li>
                </ol>
            </div>

            <div class="publish-option" style="background:#1e1e1e;border-radius:6px;padding:16px;margin-bottom:12px;border-left:3px solid #569cd6;">
                <h3 style="color:#569cd6;margin:0 0 6px">⚡ Netlify Drop (Fastest — No Account Needed)</h3>
                <ol style="padding-left:18px;line-height:1.8;font-size:13px;">
                    <li>Click <strong>Export → Download HTML</strong> below</li>
                    <li>Go to <a href="https://app.netlify.com/drop" target="_blank" style="color:#569cd6;">app.netlify.com/drop</a></li>
                    <li>Drag your downloaded HTML file onto the page</li>
                    <li>Get an instant public link — done in 30 seconds!</li>
                </ol>
            </div>

            <div class="publish-option" style="background:#1e1e1e;border-radius:6px;padding:16px;margin-bottom:20px;border-left:3px solid #c586c0;">
                <h3 style="color:#c586c0;margin:0 0 6px">📁 Share the File Directly</h3>
                <p style="font-size:13px;line-height:1.6;">
                    Click <strong>Export → Download HTML</strong> to save a single <code>.html</code> file.
                    Anyone can open it in their browser — send it via email, Google Drive, Dropbox, or USB stick.
                    No internet required to play (except for the Phaser CDN load on first open).
                </p>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button onclick="AppController && AppController.exportActions('html')"
                    style="background:#007acc;color:#fff;border:none;padding:10px 18px;border-radius:5px;cursor:pointer;font-size:13px;">
                    📥 Download HTML
                </button>
                <button onclick="AppController && AppController.exportActions('github')"
                    style="background:#238636;color:#fff;border:none;padding:10px 18px;border-radius:5px;cursor:pointer;font-size:13px;">
                    📦 GitHub Zip
                </button>
                <button onclick="AppController && AppController.exportActions('zip')"
                    style="background:#3e3e42;color:#d4d4d4;border:none;padding:10px 18px;border-radius:5px;cursor:pointer;font-size:13px;">
                    🗜️ Full Zip
                </button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        saveProject,
        loadProject,
        deleteProject,
        listProjects,
        getCurrentProjectName,
        setCurrentProjectName,
        exportHTML,
        exportZip,
        exportGitHub,
        downloadHTML,
        downloadZip,
        downloadGitHubZip,
        showPublishModal,
    };
})();
