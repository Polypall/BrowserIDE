// ============================================================
// ASSET-MANAGER.JS — Asset upload and management
// ============================================================

const AssetManager = (() => {
    const STORAGE_KEY = 'browseride_assets';
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

    function getAssetCode(name) {
        const asset = assets[name];
        if (!asset) return `// Asset "${name}" not found`;

        if (asset.type === 'image') {
            return `// Load asset in preload():\nthis.load.image('${name}', window.__ASSETS__['${name}']);\n\n// Use in create():\nconst sprite = this.add.image(400, 300, '${name}');`;
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
                item.title = `${asset.name}\n${formatSize(asset.size)}\nClick to insert code`;

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
                    if (insertCallback) insertCallback(getAssetCode(asset.name));
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
