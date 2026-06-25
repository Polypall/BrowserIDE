// ============================================================
// ASSET-MANAGER.JS — Asset upload and management
// ============================================================

const AssetManager = (() => {
    const STORAGE_KEY = 'indicolite_assets';
    let assets = {}; // { name: { type, dataUrl, size } }
    let insertCallback = null;
    let listContainer = null;

    function loadFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) assets = JSON.parse(data);
        } catch (e) {
            assets = {};
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
        } catch (e) {
            console.warn('Asset storage full or unavailable:', e.message);
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
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function uploadImage(file) {
        const dataUrl = await readFileAsBase64(file);
        const name = sanitizeName(file.name);
        assets[name] = { type: 'image', dataUrl, size: file.size, originalName: file.name };
        saveToStorage();
        renderAssetList();
        return name;
    }

    async function uploadSound(file) {
        const dataUrl = await readFileAsBase64(file);
        const name = sanitizeName(file.name);
        assets[name] = { type: 'sound', dataUrl, size: file.size, originalName: file.name };
        saveToStorage();
        renderAssetList();
        return name;
    }

    function addImageFromDataUrl(name, dataUrl) {
        const sanitized = sanitizeName(name);
        assets[sanitized] = { type: 'image', dataUrl, size: dataUrl.length, originalName: name };
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
        return Object.entries(assets).map(([name, asset]) => ({
            name, ...asset
        }));
    }

    function getAsset(name) {
        return assets[name] || null;
    }

    function getAssetCode(name, usage) {
        const asset = assets[name];
        if (!asset) return `// Asset "${name}" not found`;

        if (asset.type === 'image') {
            if (usage === 'background') {
                return `// ---- BACKGROUND IMAGE ----\n// In preload():\nthis.load.image('${name}', window.__ASSETS__['${name}']);\n\n// In create():\n// Stretch to fill the whole game canvas:\nthis.add.image(400, 300, '${name}').setDisplaySize(800, 450);\n// Or tile it across the background:\n// this.add.tileSprite(0, 0, 800, 450, '${name}').setOrigin(0, 0);`;
            }
            if (usage === 'sprite') {
                return `// ---- CHARACTER / SPRITE ----\n// In preload():\nthis.load.image('${name}', window.__ASSETS__['${name}']);\n\n// In create():\nconst player = this.physics.add.sprite(100, 300, '${name}');\nplayer.setCollideWorldBounds(true);`;
            }
            // Default: show both options
            return `// Load in preload():\nthis.load.image('${name}', window.__ASSETS__['${name}']);\n\n// Use as BACKGROUND in create():\nthis.add.image(400, 300, '${name}').setDisplaySize(800, 450);\n\n// OR use as CHARACTER/SPRITE in create():\n// const player = this.physics.add.sprite(100, 300, '${name}');\n// player.setCollideWorldBounds(true);`;
        } else if (asset.type === 'sound') {
            return `// Load sound in preload():\nthis.load.audio('${name}', window.__ASSETS__['${name}']);\n\n// Play in create() or update():\nconst snd = this.sound.add('${name}');\nsnd.play();`;
        }
        return `// Asset: ${name}`;
    }

    function getAllAssetsForInjection() {
        const result = {};
        Object.entries(assets).forEach(([name, asset]) => {
            result[name] = asset.dataUrl;
        });
        return result;
    }

    function sanitizeName(filename) {
        return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    }

    function renderAssetList() {
        if (!listContainer) return;
        listContainer.innerHTML = '';

        const assetList = listAssets();
        if (assetList.length === 0) {
            listContainer.innerHTML = '<div style="color:#858585;font-size:12px;padding:10px;text-align:center;">No assets uploaded yet</div>';
            return;
        }

        const images = assetList.filter(a => a.type === 'image');
        const sounds = assetList.filter(a => a.type === 'sound');

        if (images.length > 0) {
            const label = document.createElement('div');
            label.className = 'section-label';
            label.textContent = '🖼 Images';
            listContainer.appendChild(label);

            const grid = document.createElement('div');
            grid.className = 'asset-list';
            listContainer.appendChild(grid);

            images.forEach(asset => {
                const item = document.createElement('div');
                item.className = 'asset-item';
                item.title = `${asset.name}\n${formatSize(asset.size)}\nClick to use as background or character`;

                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'asset-delete';
                deleteBtn.textContent = '✕';
                deleteBtn.title = 'Delete asset';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete asset "${asset.name}"?`)) {
                        deleteAsset(asset.name);
                    }
                });

                const img = document.createElement('img');
                img.src = asset.dataUrl;
                img.alt = asset.name;

                const nameEl = document.createElement('div');
                nameEl.className = 'asset-name';
                nameEl.textContent = asset.name;

                item.appendChild(deleteBtn);
                item.appendChild(img);
                item.appendChild(nameEl);
                grid.appendChild(item);

                item.addEventListener('click', () => {
                    showImageUsageMenu(asset.name, item);
                });
            });
        }

        if (sounds.length > 0) {
            const label = document.createElement('div');
            label.className = 'section-label';
            label.textContent = '🔊 Sounds';
            listContainer.appendChild(label);

            sounds.forEach(asset => {
                const item = document.createElement('div');
                item.className = 'asset-sound-item';
                item.title = `Click to insert code`;

                item.innerHTML = `
                    <span class="sound-icon">🎵</span>
                    <span class="sound-name">${asset.name}</span>
                    <span style="color:#858585;font-size:11px">${formatSize(asset.size)}</span>
                    <span class="asset-delete" title="Delete" style="display:inline;margin-left:6px">✕</span>
                `;

                item.querySelector('.asset-delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete asset "${asset.name}"?`)) {
                        deleteAsset(asset.name);
                    }
                });

                item.addEventListener('click', () => {
                    if (insertCallback) insertCallback(getAssetCode(asset.name));
                });

                listContainer.appendChild(item);
            });
        }
    }

    function showImageUsageMenu(name, anchorEl) {
        // Remove any existing menu
        const old = document.getElementById('asset-usage-menu');
        if (old) old.remove();

        const menu = document.createElement('div');
        menu.id = 'asset-usage-menu';
        const rect = anchorEl.getBoundingClientRect();
        menu.style.cssText = `
            position:fixed;left:${rect.right + 6}px;top:${rect.top}px;
            background:#2d2d30;border:1px solid #007acc;border-radius:6px;
            z-index:9999;padding:6px;display:flex;flex-direction:column;gap:4px;
            box-shadow:0 4px 16px rgba(0,0,0,0.5);min-width:190px;font-family:inherit;
        `;
        menu.innerHTML = `
            <div style="font-size:11px;color:#858585;padding:2px 6px;border-bottom:1px solid #3e3e42;margin-bottom:2px;">Use <strong style="color:#9cdcfe">${name}</strong> as:</div>
            <button class="asset-use-btn" data-usage="background">🌄 Background Image</button>
            <button class="asset-use-btn" data-usage="sprite">🧍 Character / Sprite</button>
            <button class="asset-use-btn" data-usage="both">📋 Show Both Code Options</button>
        `;
        menu.querySelectorAll('.asset-use-btn').forEach(btn => {
            btn.style.cssText = 'background:#3e3e42;border:none;color:#d4d4d4;padding:7px 12px;border-radius:4px;cursor:pointer;text-align:left;font-size:12px;';
            btn.onmouseenter = () => btn.style.background = '#094771';
            btn.onmouseleave = () => btn.style.background = '#3e3e42';
            btn.addEventListener('click', () => {
                const usage = btn.dataset.usage === 'both' ? null : btn.dataset.usage;
                if (insertCallback) insertCallback(getAssetCode(name, usage));
                menu.remove();
            });
        });

        document.body.appendChild(menu);
        const close = (e) => { if (!menu.contains(e.target) && e.target !== anchorEl) { menu.remove(); document.removeEventListener('click', close); } };
        setTimeout(() => document.addEventListener('click', close), 10);
    }

    return {
        init,
        uploadImage,
        uploadSound,
        addImageFromDataUrl,
        deleteAsset,
        listAssets,
        getAsset,
        getAssetCode,
        getAllAssetsForInjection,
        renderAssetList,
    };
})();
