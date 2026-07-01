// ============================================================
// APP.JS — Main application orchestrator
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // STATE
    // ============================================================
    let currentRightTab = 'preview';
    let isDragging = false;
    let dragType = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartSize = 0;

    // ============================================================
    // DOM REFERENCES
    // ============================================================
    const $ = id => document.getElementById(id);

    const sidebar = $('sidebar');
    const editorArea = $('editor-area');
    const rightPanel = $('right-panel');
    const bottomPanel = $('bottom-panel');
    const mainArea = $('main-area');

    const dragLeft = $('drag-left');
    const dragRight = $('drag-right');
    const dragBottom = $('drag-bottom');

    const btnNew = $('btn-new');
    const btnSave = $('btn-save');
    const btnLoad = $('btn-load');
    const btnRun = $('btn-run');
    const btnStop = $('btn-stop');
    const btnExport = $('btn-export');
    const btnExportZip = $('btn-export-zip');
    const btnPublish = $('btn-publish');
    const projectNameInput = $('project-name-input');

    const consoleOutput = $('console-output');
    const consoleClear = $('console-clear-btn');

    const gameIframe = $('game-iframe');
    const gamePlaceholder = $('game-placeholder');

    const spriteCanvas = $('sprite-canvas');
    const isoCanvas = $('iso-canvas');
    const spritePalette = $('sprite-palette');

    const assetListEl = $('asset-list-container');

    const aiMessagesEl = $('ai-messages');
    const aiInputEl = $('ai-input');
    const aiSendBtn = $('ai-send-btn');
    const aiApiKeyInput = $('ai-api-key-input');
    const aiSpriteBtn = $('ai-sprite-btn');
    const aiClearBtn = $('ai-clear-btn');

    const statusText = $('status-text');
    const statusMode = $('status-mode');

    // Modal elements
    const saveModal = $('save-modal');
    const loadModal = $('load-modal');
    const exportModal = $('export-modal');

    // ============================================================
    // STATUS BAR
    // ============================================================
    function setStatus(msg) {
        if (statusText) statusText.textContent = msg;
    }

    // ============================================================
    // CONSOLE
    // ============================================================
    function appendConsole(level, args) {
        if (!consoleOutput) return;
        const line = document.createElement('div');
        line.className = `console-line ${level}`;

        const ts = new Date().toLocaleTimeString('en', { hour12: false });
        const icons = { log: '', warn: '⚠', error: '✖', info: 'ℹ' };
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');

        line.innerHTML = `
            <span class="console-ts">${ts}</span>
            <span class="console-msg">${icons[level] || ''} ${escapeHtmlConsole(msg)}</span>
        `;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    function escapeHtmlConsole(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Override console
    const _origLog = console.log;
    const _origWarn = console.warn;
    const _origError = console.error;
    const _origInfo = console.info;

    // Harmless internal warnings from CDN libraries we don't want to scare users with
    const SUPPRESSED = [
        "Duplicate definition of module 'vs/editor/editor.main'",
    ];
    function isSuppressed(args) {
        const msg = args.map(a => typeof a === 'string' ? a : '').join(' ');
        return SUPPRESSED.some(s => msg.includes(s));
    }

    console.log = (...args) => { _origLog(...args); appendConsole('log', args); };
    console.warn = (...args) => { _origWarn(...args); if (!isSuppressed(args)) appendConsole('warn', args); };
    console.error = (...args) => { _origError(...args); appendConsole('error', args); };
    console.info = (...args) => { _origInfo(...args); appendConsole('info', args); };

    if (consoleClear) {
        consoleClear.addEventListener('click', () => {
            consoleOutput.innerHTML = '';
        });
    }

    // ============================================================
    // GAME RUNNER INIT
    // ============================================================
    GameRunner.init(gameIframe, gamePlaceholder);
    GameRunner.onConsole((level, args) => appendConsole(level, args));

    // ============================================================
    // MONACO EDITOR INIT
    // ============================================================
    EditorModule.init('monaco-container', DEFAULT_GAME_CODE).then(() => {
        setStatus('Editor ready');
        console.info('Monaco Editor loaded');
    }).catch(e => {
        console.error('Editor load failed:', e.message);
    });

    // ============================================================
    // SPRITE EDITOR INIT
    // ============================================================
    SpriteEditor.init(spriteCanvas, isoCanvas);
    buildSpritePalette();
    buildSpriteToolbar();

    function buildSpritePalette() {
        if (!spritePalette) return;
        spritePalette.innerHTML = '';
        SpriteEditor.getPalette().forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'palette-color';
            swatch.style.background = color;
            swatch.title = color;
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.palette-color').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                SpriteEditor.setColor(color);
                const ci = $('sprite-color-input');
                if (ci) ci.value = color;
            });
            spritePalette.appendChild(swatch);
        });
        // Select first
        spritePalette.firstChild?.classList.add('selected');
    }

    function buildSpriteToolbar() {
        const tools = [
            { id: 'tool-pencil', label: '✏ Draw', tool: 'pencil' },
            { id: 'tool-eraser', label: '⌫ Erase', tool: 'eraser' },
            { id: 'tool-fill', label: '🪣 Fill', tool: 'fill' },
        ];

        tools.forEach(t => {
            const btn = $(t.id);
            if (!btn) return;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sprite-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                SpriteEditor.setTool(t.tool);
            });
        });

        // Grid toggle
        const gridBtn = $('tool-grid');
        if (gridBtn) gridBtn.addEventListener('click', () => { SpriteEditor.toggleGrid(); });

        // Clear
        const clearBtn = $('tool-clear');
        if (clearBtn) clearBtn.addEventListener('click', () => {
            if (confirm('Clear canvas?')) SpriteEditor.clearCanvas();
        });

        // Export PNG
        const exportBtn = $('tool-export-png');
        if (exportBtn) exportBtn.addEventListener('click', () => {
            const dataUrl = SpriteEditor.exportScaledPNG(8);
            const a = document.createElement('a');
            a.download = 'sprite.png';
            a.href = dataUrl;
            a.click();
        });

        // Add to assets
        const addAssetBtn = $('tool-add-asset');
        if (addAssetBtn) addAssetBtn.addEventListener('click', () => {
            const name = prompt('Asset name (e.g. player.png):', 'sprite.png');
            if (!name) return;
            const dataUrl = SpriteEditor.exportScaledPNG(4);
            AssetManager.addImageFromDataUrl(name, dataUrl);
            setStatus(`Sprite saved as asset: ${name}`);
            // Switch to assets tab
            switchRightTab('assets');
        });

        // Iso toggle
        const isoBtn = $('tool-iso');
        if (isoBtn) isoBtn.addEventListener('click', () => {
            const active = isoBtn.classList.toggle('active');
            SpriteEditor.toggleIso(active);
            const isoWrapper = $('iso-canvas-wrapper');
            if (isoWrapper) isoWrapper.classList.toggle('hidden', !active);
        });

        // Grid size
        const gridSizeSelect = $('sprite-grid-size');
        if (gridSizeSelect) {
            gridSizeSelect.addEventListener('change', () => {
                const [w, h] = gridSizeSelect.value.split('x').map(Number);
                SpriteEditor.setGridSize(w, h);
            });
        }

        // Color input
        const colorInput = $('sprite-color-input');
        if (colorInput) {
            colorInput.addEventListener('input', () => {
                SpriteEditor.setColor(colorInput.value);
            });
        }
    }

    // ============================================================
    // ASSET MANAGER INIT
    // ============================================================
    AssetManager.init(assetListEl, (code) => {
        EditorModule.insertAtCursor('\n' + code + '\n');
        setStatus('Asset code inserted');
    });

    // ============================================================
    // CATEGORIZED UPLOAD BUTTONS
    // ============================================================
    const uploadCatInput = $('upload-cat-input');

    // Wire the 4 category upload buttons
    document.querySelectorAll('.asset-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!uploadCatInput) return;
            uploadCatInput.accept = btn.dataset.accept || 'image/*,audio/*';
            uploadCatInput.dataset.category = btn.dataset.category;
            uploadCatInput.value = '';
            uploadCatInput.click();
        });
    });

    if (uploadCatInput) {
        uploadCatInput.addEventListener('change', async (e) => {
            const category = uploadCatInput.dataset.category || 'character';
            for (const file of e.target.files) {
                const name = await AssetManager.uploadFile(file, category);
                setStatus(`Uploaded to ${category}: ${name}`);
                console.info(`Asset uploaded [${category}]: ${name}`);
            }
            uploadCatInput.value = '';
            switchRightTab('assets');
        });
    }

    // Legacy inputs (still used by game-runner asset injection)
    const uploadImageInput = $('upload-image-input');
    const uploadSoundInput = $('upload-sound-input');

    // Drag-and-drop — ask category for dropped images
    const assetDropZone = $('asset-drop-zone');
    if (assetDropZone) {
        assetDropZone.addEventListener('dragover', e => {
            e.preventDefault();
            assetDropZone.style.borderColor = 'var(--accent)';
        });
        assetDropZone.addEventListener('dragleave', () => {
            assetDropZone.style.borderColor = '';
        });
        assetDropZone.addEventListener('drop', async e => {
            e.preventDefault();
            assetDropZone.style.borderColor = '';
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                if (file.type.startsWith('audio/')) {
                    await AssetManager.uploadFile(file, 'sound');
                } else if (file.type.startsWith('image/')) {
                    // Ask which category for images
                    const cats = ['background', 'character', 'object'];
                    const labels = ['🌄 Background', '🧍 Character', '🎯 Object'];
                    const choice = await showDropCategoryPicker(file.name, labels);
                    const category = choice !== null ? cats[choice] : 'character';
                    await AssetManager.uploadFile(file, category);
                }
                setStatus(`Asset uploaded: ${file.name}`);
            }
        });
    }

    function showDropCategoryPicker(filename, labels) {
        return new Promise(resolve => {
            const old = document.getElementById('drop-cat-picker');
            if (old) old.remove();
            const modal = document.createElement('div');
            modal.id = 'drop-cat-picker';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `<div style="background:#252526;border:1px solid #007acc;border-radius:8px;padding:20px;min-width:260px;font-family:inherit;">
                <div style="color:#9cdcfe;font-size:13px;margin-bottom:12px;">What is <strong>${filename}</strong>?</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${labels.map((l, i) => `<button class="dcp-btn" data-i="${i}" style="background:#3e3e42;border:none;color:#d4d4d4;padding:10px;border-radius:5px;cursor:pointer;font-size:13px;text-align:left;">${l}</button>`).join('')}
                </div>
            </div>`;
            document.body.appendChild(modal);
            modal.querySelectorAll('.dcp-btn').forEach(b => {
                b.onmouseenter = () => b.style.background = '#094771';
                b.onmouseleave = () => b.style.background = '#3e3e42';
                b.addEventListener('click', () => { modal.remove(); resolve(parseInt(b.dataset.i)); });
            });
        });
    }

    // ============================================================
    // FILE SAVE / LOAD (for library computers — bypasses localStorage wipe)
    // ============================================================
    const btnSaveFile = $('btn-save-file');
    const btnLoadFile = $('btn-load-file');
    const loadFileInput = $('load-file-input');

    if (btnSaveFile) {
        btnSaveFile.addEventListener('click', () => {
            const projectName = ProjectManager.getCurrentProjectName();
            const code = EditorModule.getCode();
            const assets = AssetManager.getAllAssetsRaw();
            const payload = {
                _format: 'indicolite-project',
                _version: 1,
                name: projectName,
                savedAt: new Date().toISOString(),
                code,
                assets,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
            a.download = `${safeName}.indicolite`;
            a.href = url;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            setStatus(`Project saved as ${safeName}.indicolite — keep this file safe!`);
            console.info(`Project file saved: ${safeName}.indicolite`);
        });
    }

    if (btnLoadFile && loadFileInput) {
        btnLoadFile.addEventListener('click', () => loadFileInput.click());
        loadFileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const payload = JSON.parse(text);
                if (payload._format !== 'indicolite-project') {
                    alert('This file doesn\'t look like an Indicolite project file.');
                    return;
                }
                if (!confirm(`Load project "${payload.name}"? This will replace your current code and assets.`)) return;

                EditorModule.setCode(payload.code || '');
                AssetManager.loadFromObject(payload.assets || {});
                ProjectManager.setCurrentProjectName(payload.name || 'My Game');
                const nameInput = $('project-name-input');
                if (nameInput) nameInput.value = payload.name || 'My Game';
                setStatus(`Project loaded: ${payload.name}`);
                console.info(`Loaded project file: ${file.name}`);
                switchRightTab('assets');
            } catch (err) {
                alert('Could not read project file: ' + err.message);
            }
            loadFileInput.value = '';
        });
    }

    // ============================================================
    // AI ASSISTANT INIT
    // ============================================================
    AIAssistant.init({
        messagesEl: aiMessagesEl,
        inputEl: aiInputEl,
        sendBtn: aiSendBtn,
        apiKeyInput: aiApiKeyInput,
        getEditorCode: () => EditorModule.getCode(),
        onInsertCode: (code, replace) => {
            if (replace) {
                EditorModule.setCode(code);
                setStatus('AI code applied — hit ▶ Run to play!');
            } else {
                EditorModule.insertAtCursor('\n' + code + '\n');
                setStatus('AI code inserted');
            }
        },
        onReplaceCode: (code) => {
            EditorModule.setCode(code);
            setStatus('AI code applied — hit ▶ Run to play!');
        },
        onSpriteCode: (code) => {
            // Apply to sprite editor
            SpriteEditor.executeDrawCode(code);
            switchRightTab('sprite');
            setStatus('Sprite generated by AI');
        },
    });

    if (aiSpriteBtn) {
        aiSpriteBtn.addEventListener('click', async () => {
            const desc = prompt('Describe the sprite to generate:\n(e.g. "a small red dragon", "a pixel art sword", "a coin with a star")');
            if (desc) {
                switchRightTab('ai');
                await AIAssistant.generateSprite(desc);
            }
        });
    }

    if (aiClearBtn) {
        aiClearBtn.addEventListener('click', () => AIAssistant.clearHistory());
    }

    // ============================================================
    // RIGHT PANEL TABS
    // ============================================================
    function switchRightTab(tabName) {
        currentRightTab = tabName;
        document.querySelectorAll('.right-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabName);
        });
        document.querySelectorAll('.right-panel-content').forEach(p => {
            p.classList.toggle('active', p.dataset.panel === tabName);
        });
    }

    document.querySelectorAll('.right-tab').forEach(tab => {
        tab.addEventListener('click', () => switchRightTab(tab.dataset.tab));
    });

    // ============================================================
    // TOOLBAR ACTIONS
    // ============================================================

    // RUN
    if (btnRun) {
        btnRun.addEventListener('click', () => {
            const code = EditorModule.getCode();
            const assets = AssetManager.listAssets();
            GameRunner.runGame(code, assets);
            switchRightTab('preview');
            setStatus('Game running');
            btnRun.classList.add('hidden');
            btnStop.classList.remove('hidden');
        });
    }

    // STOP
    if (btnStop) {
        btnStop.addEventListener('click', () => {
            GameRunner.stopGame();
            setStatus('Game stopped');
            btnStop.classList.add('hidden');
            btnRun.classList.remove('hidden');
        });
    }

    // NEW
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            if (!confirm('Start a new project? Unsaved changes will be lost.')) return;
            EditorModule.setCode(DEFAULT_GAME_CODE);
            if (projectNameInput) projectNameInput.value = 'My Game';
            ProjectManager.setCurrentProjectName('My Game');
            GameRunner.stopGame();
            setStatus('New project');
            console.info('New project created');
        });
    }

    // SAVE
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const name = projectNameInput ? projectNameInput.value.trim() || 'My Game' : 'My Game';
            const code = EditorModule.getCode();
            const assets = AssetManager.listAssets();
            const success = ProjectManager.saveProject(name, code, assets);
            if (success) {
                setStatus(`Saved: ${name}`);
                console.info(`Project saved: ${name}`);
                showToast(`Project "${name}" saved!`);
            } else {
                console.error('Save failed (storage full?)');
            }
        });
    }

    // LOAD
    if (btnLoad) {
        btnLoad.addEventListener('click', () => showLoadModal());
    }

    // EXPORT
    if (btnExport) {
        btnExport.addEventListener('click', () => showExportModal());
    }

    if (btnExportZip) {
        btnExportZip.addEventListener('click', async () => {
            const code = EditorModule.getCode();
            const assets = AssetManager.listAssets();
            try {
                await ProjectManager.downloadZip(code, assets);
                setStatus('ZIP exported');
            } catch (e) {
                console.error('ZIP export error:', e.message);
            }
        });
    }

    if (btnPublish) {
        btnPublish.addEventListener('click', () => ProjectManager.showPublishModal());
    }

    // Global export action handler used by publish modal buttons
    window.AppController = {
        exportActions: async (type) => {
            const code = EditorModule.getCode();
            const assets = AssetManager.listAssets();
            if (type === 'html') {
                ProjectManager.downloadHTML(code, assets);
                setStatus('HTML exported — ready to share!');
            } else if (type === 'zip') {
                await ProjectManager.downloadZip(code, assets);
                setStatus('ZIP exported');
            } else if (type === 'github') {
                await ProjectManager.downloadGitHubZip(code, assets);
                setStatus('GitHub zip exported — see README.md for upload instructions!');
            }
        }
    };

    // Project name
    if (projectNameInput) {
        projectNameInput.addEventListener('change', () => {
            ProjectManager.setCurrentProjectName(projectNameInput.value.trim() || 'My Game');
        });
    }

    // ============================================================
    // MODALS
    // ============================================================

    function showLoadModal() {
        const projects = ProjectManager.listProjects();
        const list = $('project-list');
        if (!list) return;

        list.innerHTML = '';
        if (projects.length === 0) {
            list.innerHTML = '<div style="padding:12px;color:#858585;text-align:center">No saved projects</div>';
        } else {
            projects.forEach(p => {
                const item = document.createElement('div');
                item.className = 'project-list-item';
                const d = new Date(p.savedAt);
                item.innerHTML = `
                    <span>${p.name}</span>
                    <span style="color:#858585;font-size:11px">${d.toLocaleDateString()}</span>
                    <span class="proj-delete" title="Delete project">🗑</span>
                `;
                item.querySelector('.proj-delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete project "${p.name}"?`)) {
                        ProjectManager.deleteProject(p.name);
                        showLoadModal();
                    }
                });
                item.addEventListener('click', () => {
                    document.querySelectorAll('.project-list-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    item.dataset.projectName = p.name;
                });
                list.appendChild(item);
            });
        }

        if (loadModal) loadModal.classList.remove('hidden');
    }

    function hideModal(modal) {
        if (modal) modal.classList.add('hidden');
    }

    // Load modal confirm
    const loadConfirmBtn = $('load-confirm-btn');
    if (loadConfirmBtn) {
        loadConfirmBtn.addEventListener('click', () => {
            const selected = document.querySelector('.project-list-item.selected');
            if (!selected) { alert('Select a project first'); return; }
            const name = selected.dataset.projectName || selected.querySelector('span')?.textContent;
            const project = ProjectManager.loadProject(name);
            if (!project) { alert('Project not found'); return; }

            EditorModule.setCode(project.code || '');
            if (projectNameInput) projectNameInput.value = project.name;

            // Restore assets
            if (project.assets && project.assets.length > 0) {
                project.assets.forEach(asset => {
                    if (asset.type === 'image') AssetManager.addImageFromDataUrl(asset.name, asset.dataUrl);
                });
            }

            hideModal(loadModal);
            setStatus(`Loaded: ${name}`);
            console.info(`Project loaded: ${name}`);
        });
    }

    const loadCancelBtn = $('load-cancel-btn');
    if (loadCancelBtn) loadCancelBtn.addEventListener('click', () => hideModal(loadModal));

    // Export modal
    function showExportModal() {
        if (exportModal) exportModal.classList.remove('hidden');
    }

    const exportHtmlBtn = $('export-html-btn');
    if (exportHtmlBtn) {
        exportHtmlBtn.addEventListener('click', () => {
            const code = EditorModule.getCode();
            const assets = AssetManager.listAssets();
            ProjectManager.downloadHTML(code, assets);
            hideModal(exportModal);
            setStatus('HTML exported');
        });
    }

    const exportZipBtn2 = $('export-zip-btn2');
    if (exportZipBtn2) {
        exportZipBtn2.addEventListener('click', async () => {
            const code = EditorModule.getCode();
            const assets = AssetManager.listAssets();
            try {
                await ProjectManager.downloadZip(code, assets);
                hideModal(exportModal);
                setStatus('ZIP exported');
            } catch (e) {
                console.error('ZIP export failed:', e.message);
            }
        });
    }

    const exportCancelBtn = $('export-cancel-btn');
    if (exportCancelBtn) exportCancelBtn.addEventListener('click', () => hideModal(exportModal));

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) hideModal(overlay);
        });
    });

    // ESC to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => hideModal(m));
        }
    });

    // ============================================================
    // PANEL RESIZE (drag handles)
    // ============================================================
    function startDrag(e, type) {
        isDragging = true;
        dragType = type;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        if (type === 'left') dragStartSize = sidebar.offsetWidth;
        else if (type === 'right') dragStartSize = rightPanel.offsetWidth;
        else if (type === 'bottom') dragStartSize = bottomPanel.offsetHeight;

        document.body.style.cursor = type === 'bottom' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';

        const handle = { left: dragLeft, right: dragRight, bottom: dragBottom }[type];
        if (handle) handle.classList.add('dragging');
    }

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        if (dragType === 'left') {
            const newW = Math.max(140, Math.min(400, dragStartSize + (e.clientX - dragStartX)));
            sidebar.style.width = newW + 'px';
        } else if (dragType === 'right') {
            const newW = Math.max(280, Math.min(800, dragStartSize - (e.clientX - dragStartX)));
            rightPanel.style.width = newW + 'px';
        } else if (dragType === 'bottom') {
            const newH = Math.max(60, Math.min(400, dragStartSize - (e.clientY - dragStartY)));
            bottomPanel.style.height = newH + 'px';
        }

        EditorModule.layout();
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        ['left', 'right', 'bottom'].forEach(t => {
            const handle = { left: dragLeft, right: dragRight, bottom: dragBottom }[t];
            if (handle) handle.classList.remove('dragging');
        });
        EditorModule.layout();
    });

    if (dragLeft) dragLeft.addEventListener('mousedown', (e) => startDrag(e, 'left'));
    if (dragRight) dragRight.addEventListener('mousedown', (e) => startDrag(e, 'right'));
    if (dragBottom) dragBottom.addEventListener('mousedown', (e) => startDrag(e, 'bottom'));

    // ============================================================
    // WINDOW RESIZE
    // ============================================================
    window.addEventListener('resize', () => {
        EditorModule.layout();
    });

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    document.addEventListener('keydown', (e) => {
        // Ctrl+S = save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            btnSave?.click();
        }
        // F5 or Ctrl+Enter = run
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
            e.preventDefault();
            if (GameRunner.isRunning()) {
                btnStop?.click();
            } else {
                btnRun?.click();
            }
        }
        // Ctrl+Shift+E = export
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            showExportModal();
        }
    });

    // ============================================================
    // TOAST NOTIFICATION
    // ============================================================
    function showToast(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 40px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            padding: 10px 18px;
            border-radius: 6px;
            font-size: 13px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // ============================================================
    // FILE TREE
    // ============================================================
    function renderFileTree() {
        const tree = $('file-tree');
        if (!tree) return;

        const files = [
            { name: 'game.js', icon: '📄', active: true },
        ];

        tree.innerHTML = '';
        files.forEach(f => {
            const item = document.createElement('div');
            item.className = `file-tree-item ${f.active ? 'active' : ''}`;
            item.innerHTML = `<span>${f.icon}</span> ${f.name}`;
            tree.appendChild(item);
        });
    }

    renderFileTree();

    // ============================================================
    // DISCLAIMER / SAVING AGREEMENT
    // ============================================================
    const DISCLAIMER_KEY = 'indicolite_disclaimer_agreed_v1';
    const disclaimerModal = $('disclaimer-modal');
    const disclaimerCheck = $('disclaimer-agree-check');
    const disclaimerBtn = $('disclaimer-agree-btn');
    const openDisclaimer = $('open-disclaimer');

    function showDisclaimer(force) {
        if (!disclaimerModal) return;
        // When reopened from footer link, allow closing without re-agreeing
        disclaimerModal.classList.add('show');
        if (force && disclaimerCheck && localStorage.getItem(DISCLAIMER_KEY)) {
            disclaimerCheck.checked = true;
            if (disclaimerBtn) { disclaimerBtn.disabled = false; disclaimerBtn.textContent = 'Close'; }
        }
    }

    if (disclaimerCheck && disclaimerBtn) {
        disclaimerCheck.addEventListener('change', () => {
            disclaimerBtn.disabled = !disclaimerCheck.checked;
        });
        disclaimerBtn.addEventListener('click', () => {
            try { localStorage.setItem(DISCLAIMER_KEY, new Date().toISOString()); } catch (e) {}
            disclaimerModal.classList.remove('show');
        });
    }

    if (openDisclaimer) {
        openDisclaimer.addEventListener('click', (e) => {
            e.preventDefault();
            showDisclaimer(true);
        });
    }

    // "Read the full disclaimer" link inside the checkbox scrolls to the full text
    const readFullDisclaimer = $('read-full-disclaimer');
    if (readFullDisclaimer) {
        readFullDisclaimer.addEventListener('click', (e) => {
            e.preventDefault();
            const box = document.querySelector('.disclaimer-box');
            if (box) box.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Show on first visit (only if not previously agreed)
    if (!localStorage.getItem(DISCLAIMER_KEY)) {
        showDisclaimer(false);
    }

    // ============================================================
    // INIT COMPLETE
    // ============================================================
    console.info('🎮 Indicolite loaded! Press F5 or click Run to start your game.');
    setStatus('Ready');
});
