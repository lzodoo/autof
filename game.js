// 游戏状态
const gameState = {
    isRunning: false,
    isPaused: false,
    startTime: 0,
    lastUpdateTime: 0
};

// 获取canvas和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏对象
const game = {
    player: null,
    arrows: [],
    enemies: [],
    items: [],
    particles: [],
    lastEnemySpawn: 0,
    lastArrowShoot: 0,
    enemySpawnRate: 2000, // 每2秒生成一个敌人
    gameTime: 0,
    kills: 0
};

// 玩家类
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 15;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.attack = 20;
        this.attackSpeed = 1.0; // 每秒攻击次数
        this.range = 150;
        this.level = 1;
        this.exp = 0;
        this.expToNext = 100;
        this.speed = 2;
        this.color = '#4CAF50';
    }

    update() {
        // 玩家移动（跟随鼠标）
        const rect = canvas.getBoundingClientRect();
        if (window.mouseX !== undefined && window.mouseY !== undefined) {
            const targetX = window.mouseX - rect.left;
            const targetY = window.mouseY - rect.top;
            
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance > 5) {
                this.x += (dx / distance) * this.speed;
                this.y += (dy / distance) * this.speed;
            }
        }

        // 保持玩家在屏幕内
        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));

        // 自动射击
        this.autoShoot();
    }

    autoShoot() {
        const now = Date.now();
        if (now - game.lastArrowShoot > 1000 / this.attackSpeed) {
            // 找到最近的敌人
            let closestEnemy = null;
            let closestDistance = this.range;

            for (let enemy of game.enemies) {
                const distance = Math.sqrt(
                    Math.pow(enemy.x - this.x, 2) + Math.pow(enemy.y - this.y, 2)
                );
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestEnemy = enemy;
                }
            }

            if (closestEnemy) {
                const arrow = new Arrow(this.x, this.y, closestEnemy.x, closestEnemy.y, this.attack);
                game.arrows.push(arrow);
                game.lastArrowShoot = now;
            }
        }
    }

    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.expToNext) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.exp = 0;
        this.expToNext = this.level * 100;
        
        // 随机提升属性
        const upgrades = [
            () => { this.attack += 5; },
            () => { this.attackSpeed += 0.2; },
            () => { this.range += 20; },
            () => { this.maxHp += 20; this.hp = this.maxHp; },
            () => { this.speed += 0.5; }
        ];
        
        const randomUpgrade = upgrades[Math.floor(Math.random() * upgrades.length)];
        randomUpgrade();
        
        // 创建升级特效
        this.createLevelUpEffect();
    }

    createLevelUpEffect() {
        for (let i = 0; i < 20; i++) {
            const particle = new Particle(
                this.x + (Math.random() - 0.5) * 40,
                this.y + (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                '#FFD700',
                30
            );
            game.particles.push(particle);
        }
    }

    die() {
        gameState.isRunning = false;
        showGameOver();
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2;
        
        // 绘制玩家（弓箭手）
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.strokeRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        
        // 绘制弓
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

// 弓箭类
class Arrow {
    constructor(x, y, targetX, targetY, damage) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.speed = 8;
        this.size = 3;
        this.color = '#8B4513';
        
        // 计算方向
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
        
        this.life = 100; // 生命周期
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        
        // 检查是否超出屏幕
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height || this.life <= 0) {
            return false;
        }
        
        return true;
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        
        // 绘制箭头
        const angle = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        
        // 箭身
        ctx.fillRect(-8, -1, 16, 2);
        // 箭头
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(4, -3);
        ctx.lineTo(4, 3);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// 敌人类
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 12 + Math.random() * 8;
        this.maxHp = 30 + Math.random() * 50;
        this.hp = this.maxHp;
        this.speed = 0.5 + Math.random() * 1.5;
        this.damage = 10 + Math.random() * 10;
        this.color = `hsl(${Math.random() * 60}, 70%, 50%)`;
        this.lastDamageTime = 0;
        this.expValue = Math.floor(this.maxHp / 5);
    }

    update() {
        // 向玩家移动
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance > 0) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
        
        // 检查与玩家碰撞
        if (distance < this.size + game.player.size) {
            const now = Date.now();
            if (now - this.lastDamageTime > 500) { // 每0.5秒伤害一次
                game.player.takeDamage(this.damage);
                this.lastDamageTime = now;
            }
        }
        
        return true;
    }

    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.die();
            return false;
        }
        return true;
    }

    die() {
        game.kills++;
        game.player.gainExp(this.expValue);
        
        // 随机掉落道具
        if (Math.random() < 0.3) { // 30%掉落率
            const item = new Item(this.x, this.y);
            game.items.push(item);
        }
        
        // 创建死亡特效
        this.createDeathEffect();
    }

    createDeathEffect() {
        for (let i = 0; i < 10; i++) {
            const particle = new Particle(
                this.x + (Math.random() - 0.5) * 20,
                this.y + (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                this.color,
                20
            );
            game.particles.push(particle);
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        
        // 绘制敌人
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 绘制血条
        const barWidth = this.size * 2;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(barX, barY, (this.hp / this.maxHp) * barWidth, barHeight);
        
        ctx.restore();
    }
}

// 道具类
class Item {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 8;
        this.pickupRadius = 25;
        this.life = 300; // 15秒后消失
        this.bobOffset = Math.random() * Math.PI * 2;
        this.initialY = y;
        
        // 随机道具类型
        const types = ['attack', 'speed', 'range', 'heal', 'attackSpeed'];
        this.type = types[Math.floor(Math.random() * types.length)];
        
        this.setTypeProperties();
    }

    setTypeProperties() {
        switch (this.type) {
            case 'attack':
                this.color = '#ff4444';
                this.name = '攻击力';
                this.value = 3 + Math.random() * 5;
                break;
            case 'speed':
                this.color = '#4444ff';
                this.name = '移速';
                this.value = 0.3 + Math.random() * 0.5;
                break;
            case 'range':
                this.color = '#44ff44';
                this.name = '射程';
                this.value = 15 + Math.random() * 20;
                break;
            case 'heal':
                this.color = '#ff44ff';
                this.name = '治疗';
                this.value = 20 + Math.random() * 30;
                break;
            case 'attackSpeed':
                this.color = '#ffff44';
                this.name = '攻速';
                this.value = 0.1 + Math.random() * 0.2;
                break;
        }
    }

    update() {
        // 上下浮动效果
        this.y = this.initialY + Math.sin(Date.now() * 0.005 + this.bobOffset) * 3;
        
        // 检查与玩家碰撞
        const distance = Math.sqrt(
            Math.pow(this.x - game.player.x, 2) + Math.pow(this.y - game.player.y, 2)
        );
        
        if (distance < this.pickupRadius) {
            this.applyEffect();
            return false;
        }
        
        this.life--;
        return this.life > 0;
    }

    applyEffect() {
        switch (this.type) {
            case 'attack':
                game.player.attack += this.value;
                break;
            case 'speed':
                game.player.speed += this.value;
                break;
            case 'range':
                game.player.range += this.value;
                break;
            case 'heal':
                game.player.hp = Math.min(game.player.maxHp, game.player.hp + this.value);
                break;
            case 'attackSpeed':
                game.player.attackSpeed += this.value;
                break;
        }
        
        // 创建拾取特效
        this.createPickupEffect();
    }

    createPickupEffect() {
        for (let i = 0; i < 8; i++) {
            const particle = new Particle(
                this.x + (Math.random() - 0.5) * 20,
                this.y + (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                this.color,
                25
            );
            game.particles.push(particle);
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        // 绘制道具
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 绘制拾取范围（半透明）
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.pickupRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

// 粒子类
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = 2 + Math.random() * 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life--;
        
        return this.life > 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 敌人生成函数
function spawnEnemy() {
    const now = Date.now();
    if (now - game.lastEnemySpawn > game.enemySpawnRate) {
        // 从屏幕边缘随机生成
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (side) {
            case 0: // 顶部
                x = Math.random() * canvas.width;
                y = -20;
                break;
            case 1: // 右侧
                x = canvas.width + 20;
                y = Math.random() * canvas.height;
                break;
            case 2: // 底部
                x = Math.random() * canvas.width;
                y = canvas.height + 20;
                break;
            case 3: // 左侧
                x = -20;
                y = Math.random() * canvas.height;
                break;
        }
        
        const enemy = new Enemy(x, y);
        game.enemies.push(enemy);
        game.lastEnemySpawn = now;
        
        // 随着时间推移，敌人生成速度加快
        game.enemySpawnRate = Math.max(500, 2000 - game.gameTime * 10);
    }
}

// 碰撞检测函数
function checkCollisions() {
    // 弓箭与敌人碰撞
    for (let i = game.arrows.length - 1; i >= 0; i--) {
        const arrow = game.arrows[i];
        
        for (let j = game.enemies.length - 1; j >= 0; j--) {
            const enemy = game.enemies[j];
            const distance = Math.sqrt(
                Math.pow(arrow.x - enemy.x, 2) + Math.pow(arrow.y - enemy.y, 2)
            );
            
            if (distance < arrow.size + enemy.size) {
                // 弓箭击中敌人
                if (!enemy.takeDamage(arrow.damage)) {
                    // 敌人死亡
                    game.enemies.splice(j, 1);
                }
                game.arrows.splice(i, 1);
                break;
            }
        }
    }
}

// 更新UI
function updateUI() {
    document.getElementById('level').textContent = game.player.level;
    document.getElementById('exp').textContent = game.player.exp;
    document.getElementById('hp').textContent = game.player.hp;
    document.getElementById('attack').textContent = Math.round(game.player.attack);
    document.getElementById('attackSpeed').textContent = game.player.attackSpeed.toFixed(1);
    document.getElementById('range').textContent = Math.round(game.player.range);
    document.getElementById('kills').textContent = game.kills;
    document.getElementById('time').textContent = Math.floor(game.gameTime / 1000);
    
    // 更新进度条
    const hpPercent = (game.player.hp / game.player.maxHp) * 100;
    const expPercent = (game.player.exp / game.player.expToNext) * 100;
    
    document.getElementById('hpFill').style.width = hpPercent + '%';
    document.getElementById('expFill').style.width = expPercent + '%';
}

// 游戏主循环
function gameLoop() {
    if (!gameState.isRunning) return;
    
    const now = Date.now();
    const deltaTime = now - gameState.lastUpdateTime;
    gameState.lastUpdateTime = now;
    game.gameTime = now - gameState.startTime;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 更新游戏对象
    game.player.update();
    
    // 更新弓箭
    for (let i = game.arrows.length - 1; i >= 0; i--) {
        if (!game.arrows[i].update()) {
            game.arrows.splice(i, 1);
        }
    }
    
    // 更新敌人
    for (let i = game.enemies.length - 1; i >= 0; i--) {
        if (!game.enemies[i].update()) {
            game.enemies.splice(i, 1);
        }
    }
    
    // 更新道具
    for (let i = game.items.length - 1; i >= 0; i--) {
        if (!game.items[i].update()) {
            game.items.splice(i, 1);
        }
    }
    
    // 更新粒子
    for (let i = game.particles.length - 1; i >= 0; i--) {
        if (!game.particles[i].update()) {
            game.particles.splice(i, 1);
        }
    }
    
    // 生成敌人
    spawnEnemy();
    
    // 碰撞检测
    checkCollisions();
    
    // 绘制所有对象
    game.particles.forEach(particle => particle.draw());
    game.items.forEach(item => item.draw());
    game.enemies.forEach(enemy => enemy.draw());
    game.arrows.forEach(arrow => arrow.draw());
    game.player.draw();
    
    // 更新UI
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// 初始化游戏
function initGame() {
    game.player = new Player(canvas.width / 2, canvas.height / 2);
    game.arrows = [];
    game.enemies = [];
    game.items = [];
    game.particles = [];
    game.kills = 0;
    game.gameTime = 0;
    game.lastEnemySpawn = 0;
    game.lastArrowShoot = 0;
    game.enemySpawnRate = 2000;
    
    gameState.isRunning = true;
    gameState.startTime = Date.now();
    gameState.lastUpdateTime = Date.now();
    
    document.getElementById('gameOver').style.display = 'none';
}

// 显示游戏结束界面
function showGameOver() {
    document.getElementById('finalKills').textContent = game.kills;
    document.getElementById('finalTime').textContent = Math.floor(game.gameTime / 1000);
    document.getElementById('gameOver').style.display = 'block';
}

// 鼠标移动事件
canvas.addEventListener('mousemove', (e) => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;
});

// 重新开始按钮
document.getElementById('restartBtn').addEventListener('click', () => {
    initGame();
    gameLoop();
});

// 开始游戏
initGame();
gameLoop();