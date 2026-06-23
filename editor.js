// ============================================================
// EDITOR.JS — Monaco Editor setup
// ============================================================

const EditorModule = (() => {
    let editor = null;
    let changeCallback = null;

    const PHASER_COMPLETIONS = [
        { label: 'Phaser.Game', kind: 'Class', detail: 'Create a new Phaser Game instance' },
        { label: 'Phaser.AUTO', kind: 'Constant', detail: 'Auto-detect renderer' },
        { label: 'Phaser.CANVAS', kind: 'Constant', detail: 'Force Canvas renderer' },
        { label: 'Phaser.WEBGL', kind: 'Constant', detail: 'Force WebGL renderer' },
        { label: 'Phaser.Scene', kind: 'Class', detail: 'Base Scene class' },
        { label: 'this.add.image', kind: 'Method', detail: 'add.image(x, y, key)' },
        { label: 'this.add.sprite', kind: 'Method', detail: 'add.sprite(x, y, key)' },
        { label: 'this.add.text', kind: 'Method', detail: 'add.text(x, y, text, style)' },
        { label: 'this.add.rectangle', kind: 'Method', detail: 'add.rectangle(x, y, w, h, color)' },
        { label: 'this.add.circle', kind: 'Method', detail: 'add.circle(x, y, radius, color)' },
        { label: 'this.add.graphics', kind: 'Method', detail: 'add.graphics()' },
        { label: 'this.add.group', kind: 'Method', detail: 'add.group(config)' },
        { label: 'this.add.tileSprite', kind: 'Method', detail: 'add.tileSprite(x, y, w, h, key)' },
        { label: 'this.physics.add.sprite', kind: 'Method', detail: 'physics.add.sprite(x, y, key)' },
        { label: 'this.physics.add.group', kind: 'Method', detail: 'physics.add.group()' },
        { label: 'this.physics.add.staticGroup', kind: 'Method', detail: 'physics.add.staticGroup()' },
        { label: 'this.physics.add.collider', kind: 'Method', detail: 'physics.add.collider(a, b, callback)' },
        { label: 'this.physics.add.overlap', kind: 'Method', detail: 'physics.add.overlap(a, b, callback)' },
        { label: 'this.input.keyboard.createCursorKeys', kind: 'Method', detail: 'createCursorKeys()' },
        { label: 'this.input.keyboard.addKey', kind: 'Method', detail: 'addKey(keyCode)' },
        { label: 'this.cameras.main', kind: 'Property', detail: 'Main camera' },
        { label: 'this.cameras.main.startFollow', kind: 'Method', detail: 'startFollow(target)' },
        { label: 'this.tweens.add', kind: 'Method', detail: 'tweens.add(config)' },
        { label: 'this.time.addEvent', kind: 'Method', detail: 'time.addEvent(config)' },
        { label: 'this.load.image', kind: 'Method', detail: 'load.image(key, url)' },
        { label: 'this.load.spritesheet', kind: 'Method', detail: 'load.spritesheet(key, url, frameConfig)' },
        { label: 'this.load.audio', kind: 'Method', detail: 'load.audio(key, url)' },
        { label: 'this.sound.add', kind: 'Method', detail: 'sound.add(key)' },
        { label: 'this.anims.create', kind: 'Method', detail: 'anims.create(config)' },
        { label: 'Phaser.Math.Between', kind: 'Method', detail: 'Between(min, max) - random integer' },
        { label: 'Phaser.Math.Clamp', kind: 'Method', detail: 'Clamp(value, min, max)' },
        { label: 'Phaser.Input.Keyboard.JustDown', kind: 'Method', detail: 'JustDown(key)' },
        { label: 'Phaser.Input.Keyboard.KeyCodes', kind: 'Namespace', detail: 'Key code constants' },
    ];

    function init(containerId, initialCode) {
        return new Promise((resolve) => {
            require.config({
                paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
            });

            require(['vs/editor/editor.main'], () => {
                // Register Phaser completions
                monaco.languages.registerCompletionItemProvider('javascript', {
                    provideCompletionItems: (model, position) => {
                        const suggestions = PHASER_COMPLETIONS.map(item => ({
                            label: item.label,
                            kind: monaco.languages.CompletionItemKind[item.kind] || monaco.languages.CompletionItemKind.Value,
                            detail: item.detail,
                            insertText: item.label.split('.').pop(),
                            documentation: item.detail,
                        }));
                        return { suggestions };
                    }
                });

                // Add Phaser type definitions as a library
                const phaserDts = `
declare namespace Phaser {
    const AUTO: number;
    const CANVAS: number;
    const WEBGL: number;
    class Game {
        constructor(config: GameConfig);
        destroy(removeCanvas: boolean): void;
    }
    class Scene {
        add: GameObjectFactory;
        physics: Physics;
        input: Input;
        cameras: CameraManager;
        tweens: TweenManager;
        time: TimeManager;
        sound: SoundManager;
        load: LoaderPlugin;
        anims: AnimationManager;
        sys: Systems;
    }
    interface GameConfig {
        type?: number;
        width?: number;
        height?: number;
        backgroundColor?: string | number;
        parent?: string | HTMLElement;
        physics?: PhysicsConfig;
        scene?: any;
    }
    namespace Math {
        function Between(min: number, max: number): number;
        function Clamp(value: number, min: number, max: number): number;
        function Distance(x1: number, y1: number, x2: number, y2: number): number;
        function RadToDeg(radians: number): number;
        function DegToRad(degrees: number): number;
    }
    namespace Input {
        namespace Keyboard {
            function JustDown(key: any): boolean;
            function JustUp(key: any): boolean;
            namespace KeyCodes {
                const W: number; const A: number; const S: number; const D: number;
                const SPACE: number; const SHIFT: number; const CTRL: number;
                const UP: number; const DOWN: number; const LEFT: number; const RIGHT: number;
            }
        }
    }
}
`;
                monaco.languages.typescript.javascriptDefaults.addExtraLib(phaserDts, 'phaser.d.ts');
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: false
                });

                editor = monaco.editor.create(document.getElementById(containerId), {
                    value: initialCode || '',
                    language: 'javascript',
                    theme: 'vs-dark',
                    fontSize: 14,
                    fontFamily: "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace",
                    fontLigatures: true,
                    minimap: { enabled: true, scale: 0.8 },
                    scrollBeyondLastLine: false,
                    wordWrap: 'off',
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    cursorBlinking: 'phase',
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: true,
                    tabSize: 4,
                    formatOnPaste: true,
                    bracketPairColorization: { enabled: true },
                    smoothScrolling: true,
                    padding: { top: 8 },
                });

                editor.onDidChangeModelContent(() => {
                    if (changeCallback) changeCallback(editor.getValue());
                });

                resolve(editor);
            });
        });
    }

    function getCode() {
        return editor ? editor.getValue() : '';
    }

    function setCode(code) {
        if (editor) {
            editor.setValue(code);
        }
    }

    function insertAtCursor(text) {
        if (!editor) return;
        const pos = editor.getPosition();
        editor.executeEdits('insert', [{
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text
        }]);
        editor.focus();
    }

    function onChange(callback) {
        changeCallback = callback;
    }

    function layout() {
        if (editor) editor.layout();
    }

    function focus() {
        if (editor) editor.focus();
    }

    return { init, getCode, setCode, insertAtCursor, onChange, layout, focus };
})();
