// ============================================================
// PROJECT-MANAGER.JS — Save, load, export projects
// ============================================================

const ProjectManager = (() => {
    const PROJECTS_KEY = 'browseride_projects';
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

        const assetScript = Object.keys(assetMap).length > 0
            ? `<script>window.__ASSETS__ = ${JSON.stringify(assetMap)};<\/script>`
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

This game was created with Browser Game IDE.

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
        downloadHTML,
        downloadZip,
    };
})();
