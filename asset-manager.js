// ============================================================
// ASSET-MANAGER.JS — Categorized asset upload and management
// ============================================================

const AssetManager = (() => {
    const STORAGE_KEY = 'indicolite_assets';

    // Each asset: { name, category, type, dataUrl, size, originalName }
    let assets = {};
    let insertCallback = null;
    let listContainer = null;

    const CATEGORIES = [
        { id: 'background', label: '🌄 Backgrounds',  color: '#4ec9b0', desc: 'Sky, ground, room, level scenery' },
        { id: 'character',  label: '🧍 Characters',   color: '#569cd6', desc: 'Player, enemies, NPCs' },
        { id: 'object',     label: '🎯 Objects',      color: '#c586c0', desc: 'Weapons, food, coins, health items, platforms' },
        { id: 'sound',      label: '🔊 Sounds',       color: '#dcdcaa', desc: 'Music, effects, voice' },
    ];

    function loadFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) assets = JSON.parse(data);
            // Migrate old assets that have no category
            Object.values(assets).forEach(a => {
                if (!a.category) a.category = a.type === 'sound' ? 'sound' : 'character';
            });
        } catch (e) { assets = {}; }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
        } catch (e) {
            console.warn('Asset storage full:', e.message);
        }
    }

    function init(containerEl, onInsert) {
        listContainer = containerEl;
        insertCallback = onInsert;
        loadFromStorage();
        renderAssetList();
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function uploadFile(file, category) {
        const dataUrl = await readFileAsBase64(file);
        const name = sanitizeName(file.name);
        const type = file.type.startsWith('audio') ? 'sound' : 'image';
        assets[name] = { type, category, dataUrl, size: file.size, originalName: file.name };
        saveToStorage();
        renderAssetList();
        return name;
    }

    // Legacy compat
    async function uploadImage(file) { return uploadFile(file, 'character'); }
    async function uploadSound(file) { return uploadFile(file, 'sound'); }

    function addImageFromDataUrl(name, dataUrl, category) {
        const sanitized = sanitizeName(name);
        assets[sanitized] = {
            type: 'image',
            category: category || 'character',
            dataUrl,
            size: dataUrl.length,
            originalName: name
        };
        saveToStorage();
        renderAssetList();
        return sanitized;
    }

    function deleteAsset(name) {
        delete assets[name];
        saveToStorage();
        renderAssetList();
    }

    function listAssets() {
        return Object.entries(assets).map(([name, asset]) => ({ name, ...asset }));
    }

    function getAsset(name) { return assets[name] || null; }

    function getAllAssetsForInjection() {
        const result = {};
        Object.entries(assets).forEach(([name, a]) => { result[name] = a.dataUrl; });
        return result;
    }

    function getAllAssetsRaw() { return assets; }

    function loadFromObject(obj) {
        assets = obj || {};
        saveToStorage();
        renderAssetList();
    }

    // ============================================================
    // CODE GENERATION
    // ============================================================
    function getAssetCode(name, category) {
        const asset = assets[name];
        if (!asset) return `// Asset "${name}" not found`;
        const cat = category || asset.category || 'character';

        if (asset.type === 'image') {
            const loadLine = `// In preload():\nthis.load.image('${name}', window.__ASSETS__['${name}']);`;
            if (cat === 'background') {
                return `// ---- BACKGROUND: ${name} ----
${loadLine}

// In create() — stretch to fill canvas:
this.add.image(400, 300, '${name}').setDisplaySize(800, 450);
// Or tile it:
// this.add.tileSprite(0, 0, 800, 450, '${name}').setOrigin(0, 0);`;
            }
            if (cat === 'character') {
                return `// ---- CHARACTER: ${name} ----
${loadLine}

// In create() — physics sprite:
const player = this.physics.add.sprite(100, 300, '${name}');
player.setCollideWorldBounds(true);`;
            }
            if (cat === 'object') {
                return `// ---- OBJECT: ${name} ----
${loadLine}

// In create() — static group (platforms, pickups):
const items = this.physics.add.staticGroup();
items.create(400, 300, '${name}');

// Or dynamic sprite:
// const item = this.physics.add.sprite(400, 300, '${name}');

// Overlap to collect (put in create()):
// this.physics.add.overlap(player, items, (p, item) => {
//     item.destroy();  // remove on collect
//     score += 10;
// });`;
            }
        }

        if (asset.type === 'sound') {
            return `// ---- SOUND: ${name} ----
// In preload():
this.load.audio('${name}', window.__ASSETS__['${name}']);

// In create():
const snd_${name.replace(/\W/g,'_')} = this.sound.add('${name}');

// To play:
snd_${name.replace(/\W/g,'_')}.play();`;
        }

        return `// Asset: ${name}`;
    }

    // ============================================================
    // RENDER UI
    // ============================================================
    function renderAssetList() {
        if (!listContainer) return;
        listContainer.innerHTML = '';

        const all = listAssets();
        if (all.length === 0) {
            listContainer.innerHTML = `<div style="color:#858585;font-size:12px;padding:16px;text-align:center;">
                No assets yet.<br>Use the upload buttons above to add images and sounds.
            </div>`;
            return;
        }

        CATEGORIES.forEach(cat => {
            const catAssets = all.filter(a => a.category === cat.id);
            if (catAssets.length === 0) return;

            // Section header
            const header = document.createElement('div');
            header.className = 'asset-section-header';
            header.style.cssText = `border-left:3px solid ${cat.color};`;
            header.innerHTML = `<span style="color:${cat.color}">${cat.label}</span> <span class="asset-count">${catAssets.length}</span>`;
            listContainer.appendChild(header);

            if (cat.id === 'sound') {
                // Sound list
                catAssets.forEach(asset => {
                    const item = document.createElement('div');
                    item.className = 'asset-sound-item';
                    item.innerHTML = `
                        <span class="sound-icon">🎵</span>
                        <span class="sound-name" title="${asset.originalName || asset.name}">${asset.name}</span>
                        <span style="color:#858585;font-size:11px">${formatSize(asset.size)}</span>
                        <span class="asset-delete" title="Delete">✕</span>
                    `;
                    item.querySelector('.asset-delete').addEventListener('click', e => {
                        e.stopPropagation();
                        if (confirm(`Delete "${asset.name}"?`)) deleteAsset(asset.name);
                    });
                    item.addEventListener('click', () => {
                        if (insertCallback) insertCallback(getAssetCode(asset.name, 'sound'));
                    });
                    listContainer.appendChild(item);
                });
            } else {
                // Image grid
                const grid = document.createElement('div');
                grid.className = 'asset-list';
                listContainer.appendChild(grid);

                catAssets.forEach(asset => {
                    const item = document.createElement('div');
                    item.className = 'asset-item';
                    item.title = `${asset.name} — click to insert code`;

                    const del = document.createElement('span');
                    del.className = 'asset-delete';
                    del.textContent = '✕';
                    del.addEventListener('click', e => {
                        e.stopPropagation();
                        if (confirm(`Delete "${asset.name}"?`)) deleteAsset(asset.name);
                    });

                    const img = document.createElement('img');
                    img.src = asset.dataUrl;
                    img.alt = asset.name;

                    const nameEl = document.createElement('div');
                    nameEl.className = 'asset-name';
                    nameEl.textContent = asset.name;

                    item.appendChild(del);
                    item.appendChild(img);
                    item.appendChild(nameEl);
                    grid.appendChild(item);

                    item.addEventListener('click', () => {
                        if (insertCallback) insertCallback(getAssetCode(asset.name, asset.category));
                    });
                });
            }
        });
    }

    // ============================================================
    // USAGE POPUP (kept for drag-drop with unknown category)
    // ============================================================
    function showCategoryMenu(name, anchorEl) {
        const old = document.getElementById('asset-cat-menu');
        if (old) old.remove();

        const menu = document.createElement('div');
        menu.id = 'asset-cat-menu';
        const rect = anchorEl.getBoundingClientRect();
        menu.style.cssText = `
            position:fixed;left:${rect.right + 6}px;top:${rect.top}px;
            background:#2d2d30;border:1px solid #007acc;border-radius:6px;
            z-index:9999;padding:6px;display:flex;flex-direction:column;gap:4px;
            box-shadow:0 4px 16px rgba(0,0,0,0.5);min-width:200px;font-family:inherit;
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-size:11px;color:#858585;padding:2px 6px;border-bottom:1px solid #3e3e42;margin-bottom:2px;';
        title.innerHTML = `Move <strong style="color:#9cdcfe">${name}</strong> to:`;
        menu.appendChild(title);

        CATEGORIES.filter(c => c.id !== 'sound').forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat.label;
            btn.style.cssText = 'background:#3e3e42;border:none;color:#d4d4d4;padding:7px 12px;border-radius:4px;cursor:pointer;text-align:left;font-size:12px;';
            btn.onmouseenter = () => btn.style.background = '#094771';
            btn.onmouseleave = () => btn.style.background = '#3e3e42';
            btn.addEventListener('click', () => {
                if (assets[name]) {
                    assets[name].category = cat.id;
                    saveToStorage();
                    renderAssetList();
                }
                if (insertCallback) insertCallback(getAssetCode(name, cat.id));
                menu.remove();
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
        const close = e => {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }
        };
        setTimeout(() => document.addEventListener('click', close), 10);
    }

    function sanitizeName(filename) {
        return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / 1048576).toFixed(1) + 'MB';
    }

    return {
        init,
        uploadFile,
        uploadImage,
        uploadSound,
        addImageFromDataUrl,
        deleteAsset,
        listAssets,
        getAsset,
        getAssetCode,
        getAllAssetsForInjection,
        getAllAssetsRaw,
        loadFromObject,
        renderAssetList,
        showCategoryMenu,
        CATEGORIES,
    };
})();
