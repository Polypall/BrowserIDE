// Default starter game — a complete working Phaser 3 game
const DEFAULT_GAME_CODE = `
// ==========================================
// INDICOLITE - STARTER GAME
// A simple platformer with movement & score
// ==========================================

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 450,
    backgroundColor: '#1a1a2e',
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let platforms;
let cursors;
let coins;
let score = 0;
let scoreText;
let gameOver = false;
let jumpCount = 0;

function preload() {
    // No external assets needed — we draw everything with graphics
}

function create() {
    // --- Background stars ---
    const bg = this.add.graphics();
    for (let i = 0; i < 80; i++) {
        const x = Phaser.Math.Between(0, 800);
        const y = Phaser.Math.Between(0, 450);
        const r = Math.random() < 0.3 ? 2 : 1;
        bg.fillStyle(0xffffff, Math.random() * 0.7 + 0.3);
        bg.fillCircle(x, y, r);
    }

    // --- Platforms ---
    platforms = this.physics.add.staticGroup();

    // Ground
    const ground = this.add.graphics();
    ground.fillStyle(0x16213e, 1);
    ground.fillRect(0, 420, 800, 30);
    ground.fillStyle(0x0f3460, 1);
    ground.fillRect(0, 420, 800, 4);
    this.physics.add.existing(ground, true);
    ground.body.setSize(800, 30);
    ground.body.setOffset(0, 420);
    platforms.add(ground);

    function makePlatform(scene, x, y, w) {
        const g = scene.add.graphics();
        g.fillStyle(0x0f3460, 1);
        g.fillRoundedRect(0, 0, w, 14, 6);
        g.fillStyle(0x533483, 1);
        g.fillRoundedRect(0, 0, w, 4, { tl: 6, tr: 6, bl: 0, br: 0 });
        g.x = x;
        g.y = y;
        scene.physics.add.existing(g, true);
        g.body.setSize(w, 14);
        g.body.setOffset(0, 0);
        platforms.add(g);
        return g;
    }

    makePlatform(this, 100, 340, 120);
    makePlatform(this, 300, 270, 120);
    makePlatform(this, 520, 310, 100);
    makePlatform(this, 650, 220, 120);
    makePlatform(this, 50, 180, 100);
    makePlatform(this, 380, 150, 130);

    // --- Player ---
    const playerGfx = this.add.graphics();
    playerGfx.fillStyle(0xe94560, 1);
    playerGfx.fillRoundedRect(-14, -20, 28, 38, 5);
    playerGfx.fillStyle(0xffeaa7, 1);
    playerGfx.fillCircle(0, -22, 12); // head
    playerGfx.fillStyle(0x2d3436, 1);
    playerGfx.fillCircle(-4, -24, 2); // left eye
    playerGfx.fillCircle(4, -24, 2);  // right eye

    const rt = this.add.renderTexture(0, 0, 28, 42);
    rt.setVisible(false);

    player = this.physics.add.sprite(100, 360, null);
    player.setVisible(false);

    // Use a rectangle body for the player
    player = this.add.rectangle(80, 360, 24, 34, 0xe94560);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
    player.body.setMaxVelocityX(300);

    // Eye decorations (follow player)
    const eyeL = this.add.circle(-4, -6, 3, 0x2d3436);
    const eyeR = this.add.circle(4, -6, 3, 0x2d3436);

    // --- Coins ---
    coins = this.physics.add.staticGroup();

    function makeCoin(scene, x, y) {
        const c = scene.add.circle(x, y, 8, 0xf9ca24);
        scene.physics.add.existing(c, true);
        c.body.setCircle(8);
        coins.add(c);
        // Tween for pulse
        scene.tweens.add({
            targets: c,
            scaleX: 0.85,
            scaleY: 0.85,
            yoyo: true,
            repeat: -1,
            duration: 600,
            ease: 'Sine.easeInOut'
        });
        return c;
    }

    makeCoin(this, 160, 320);
    makeCoin(this, 360, 250);
    makeCoin(this, 580, 290);
    makeCoin(this, 710, 200);
    makeCoin(this, 100, 160);
    makeCoin(this, 440, 130);

    // --- Colliders ---
    this.physics.add.collider(player, platforms);
    this.physics.add.overlap(player, coins, collectCoin, null, this);

    // --- Score text ---
    scoreText = this.add.text(16, 16, 'Score: 0', {
        fontFamily: 'monospace',
        fontSize: '20px',
        fill: '#f0f0f0',
        stroke: '#000',
        strokeThickness: 3
    }).setDepth(10);

    const helpText = this.add.text(16, 44, 'Arrow keys / WASD to move & jump (double jump!)', {
        fontFamily: 'monospace',
        fontSize: '12px',
        fill: '#aaaaaa'
    }).setDepth(10);

    // --- Cursors ---
    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.addKeys('W,A,S,D');

    this.wasd = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    jumpCount = 0;
    player.body.onFloor = true;

    console.log('Game started! Collect all coins!');
}

function collectCoin(player, coin) {
    coin.destroy();
    score += 10;
    scoreText.setText('Score: ' + score);
    console.log('Coin collected! Score: ' + score);

    if (coins.countActive(true) === 0) {
        scoreText.setText('You Win! Score: ' + score);
        console.log('You collected all coins! You win!');
    }
}

function update() {
    if (!player || !player.body) return;

    const onGround = player.body.blocked.down;
    if (onGround) jumpCount = 0;

    const leftDown = cursors.left.isDown || this.wasd.left.isDown;
    const rightDown = cursors.right.isDown || this.wasd.right.isDown;
    const jumpDown = Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up);

    // Horizontal movement
    if (leftDown) {
        player.body.setVelocityX(-220);
    } else if (rightDown) {
        player.body.setVelocityX(220);
    } else {
        player.body.setVelocityX(0);
    }

    // Jump (double jump allowed)
    if (jumpDown && jumpCount < 2) {
        player.body.setVelocityY(-420);
        jumpCount++;
    }
}
`;
