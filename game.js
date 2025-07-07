// 游戏状态
const gameState = {
    isRunning: false,
    isPaused: false,
    startTime: 0,
    lastUpdateTime: 0,
    shake: { x: 0, y: 0, intensity: 0, duration: 0 },
    wave: 1,
    nextWaveTime: 30000,
    lastWaveTime: 0,
    settings: {
        showFPS: true,
        particleEffects: true,
        screenShake: true,
        soundVolume: 50,
        quality: 'medium',
        showMinimap: true,
        showCrosshair: false
    },
    performance: {
        fps: 60,
        frameCount: 0,
        lastFPSUpdate: 0
    }
};

// 获取canvas和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 小地图
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
const minimapScale = 0.15;

// 游戏对象
const game = {
    player: null,
    arrows: [],
    enemies: [],
    items: [],
    particles: [],
    damageTexts: [],
    lastEnemySpawn: 0,
    lastArrowShoot: 0,
    enemySpawnRate: 2000, // 每2秒生成一个敌人
    gameTime: 0,
    kills: 0
};

// 输入状态
const input = {
    keys: {},
    mouse: { x: 0, y: 0 }
};

// 伤害数字类
class DamageText {
    constructor(x, y, damage, color = '#ff4466') {
        this.x = x;
        this.y = y;
        this.damage = Math.round(damage);
        this.color = color;
        this.life = 60;
        this.maxLife = 60;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -2 - Math.random() * 2;
        this.alpha = 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.05; // 重力
        this.life--;
        this.alpha = this.life / this.maxLife;
        
        return this.life > 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillText('-' + this.damage, this.x, this.y);
        ctx.restore();
    }
}

// 屏幕震动效果
function shakeScreen(intensity, duration) {
    gameState.shake.intensity = intensity;
    gameState.shake.duration = duration;
}

// 更新屏幕震动
function updateShake() {
    if (gameState.settings.screenShake && gameState.shake.duration > 0) {
        gameState.shake.x = (Math.random() - 0.5) * gameState.shake.intensity;
        gameState.shake.y = (Math.random() - 0.5) * gameState.shake.intensity;
        gameState.shake.duration--;
    } else {
        gameState.shake.x = 0;
        gameState.shake.y = 0;
        gameState.shake.intensity = 0;
    }
}

// 通知系统
function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// 更新小地图
function updateMinimap() {
    if (!gameState.settings.showMinimap) return;
    
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // 绘制边框
    minimapCtx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // 绘制玩家
    const playerX = game.player.x * minimapScale;
    const playerY = game.player.y * minimapScale;
    minimapCtx.fillStyle = '#0096ff';
    minimapCtx.beginPath();
    minimapCtx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    
    // 绘制敌人
    minimapCtx.fillStyle = '#ff4466';
    game.enemies.forEach(enemy => {
        const enemyX = enemy.x * minimapScale;
        const enemyY = enemy.y * minimapScale;
        minimapCtx.beginPath();
        minimapCtx.arc(enemyX, enemyY, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });
    
    // 绘制道具
    minimapCtx.fillStyle = '#00ffcc';
    game.items.forEach(item => {
        const itemX = item.x * minimapScale;
        const itemY = item.y * minimapScale;
        minimapCtx.beginPath();
        minimapCtx.arc(itemX, itemY, 1.5, 0, Math.PI * 2);
        minimapCtx.fill();
    });
}

// 更新性能监控
function updatePerformance() {
    const now = Date.now();
    gameState.performance.frameCount++;
    
    if (now - gameState.performance.lastFPSUpdate > 1000) {
        gameState.performance.fps = gameState.performance.frameCount;
        gameState.performance.frameCount = 0;
        gameState.performance.lastFPSUpdate = now;
    }
}

// 更新波次系统
function updateWave() {
    const now = Date.now();
    const timeInWave = now - gameState.lastWaveTime;
    const timeToNextWave = gameState.nextWaveTime - timeInWave;
    
    if (timeToNextWave <= 0) {
        gameState.wave++;
        gameState.lastWaveTime = now;
        showNotification(`🌊 第 ${gameState.wave} 波来袭！`, 2000);
        
        // 增加难度
        game.enemySpawnRate = Math.max(300, 2000 - gameState.wave * 100);
    }
}

// 升级选择系统
function showUpgradeChoice() {
    gameState.isPaused = true;
    const upgradePanel = document.getElementById('upgradeChoice');
    const upgradeOptions = document.getElementById('upgradeOptions');
    
    const upgrades = [
        {
            name: '🔥 火力强化',
            desc: '+5 攻击力',
            apply: () => game.player.attack += 5
        },
        {
            name: '⚡ 开火速度',
            desc: '+0.2 攻速',
            apply: () => game.player.attackSpeed += 0.2
        },
        {
            name: '🎯 炮弹射程',
            desc: '+20 射程',
            apply: () => game.player.range += 20
        },
        {
            name: '🛡️ 装甲强化',
            desc: '+20 最大生命值',
            apply: () => {
                game.player.maxHp += 20;
                game.player.hp = game.player.maxHp;
            }
        },
        {
            name: '⚡ 机动性',
            desc: '+0.5 移速',
            apply: () => game.player.speed += 0.5
        }
    ];
    
    // 随机选择3个升级选项
    const selectedUpgrades = [];
    while (selectedUpgrades.length < 3) {
        const upgrade = upgrades[Math.floor(Math.random() * upgrades.length)];
        if (!selectedUpgrades.includes(upgrade)) {
            selectedUpgrades.push(upgrade);
        }
    }
    
    upgradeOptions.innerHTML = '';
    selectedUpgrades.forEach((upgrade, index) => {
        const option = document.createElement('div');
        option.className = 'upgrade-option';
        option.innerHTML = `
            <div class="upgrade-title">${upgrade.name}</div>
            <div class="upgrade-desc">${upgrade.desc}</div>
        `;
        option.addEventListener('click', () => {
            upgrade.apply();
            upgradePanel.style.display = 'none';
            gameState.isPaused = false;
            showNotification(`获得升级: ${upgrade.name}`, 2000);
        });
        upgradeOptions.appendChild(option);
    });
    
    upgradePanel.style.display = 'block';
}

// 切换设置面板
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    gameState.isPaused = !isVisible;
}

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
        this.color = '#0096ff';
    }

    update() {
        // 键盘移动
        let moveX = 0;
        let moveY = 0;
        
        if (input.keys['KeyW'] || input.keys['ArrowUp']) moveY -= 1;
        if (input.keys['KeyS'] || input.keys['ArrowDown']) moveY += 1;
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveX -= 1;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) moveX += 1;
        
        // 如果有键盘输入，优先使用键盘移动
        if (moveX !== 0 || moveY !== 0) {
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            this.x += (moveX / length) * this.speed;
            this.y += (moveY / length) * this.speed;
        } else {
            // 否则使用鼠标移动
            const rect = canvas.getBoundingClientRect();
            if (input.mouse.x !== undefined && input.mouse.y !== undefined) {
                const targetX = input.mouse.x - rect.left;
                const targetY = input.mouse.y - rect.top;
                
                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance > 5) {
                    this.x += (dx / distance) * this.speed;
                    this.y += (dy / distance) * this.speed;
                }
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
        
        // 创建升级特效
        this.createLevelUpEffect();
        
        // 显示升级选择界面
        showUpgradeChoice();
    }

    createLevelUpEffect() {
        if (gameState.settings.particleEffects) {
            for (let i = 0; i < 20; i++) {
                const particle = new Particle(
                    this.x + (Math.random() - 0.5) * 40,
                    this.y + (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 4,
                    (Math.random() - 0.5) * 4,
                    '#00ffcc',
                    30
                );
                game.particles.push(particle);
            }
        }
        
        // 显示升级文本
        const levelUpText = document.createElement('div');
        levelUpText.className = 'level-up-text';
        levelUpText.textContent = `LEVEL UP! ${this.level}`;
        levelUpText.style.left = (this.x - 50) + 'px';
        levelUpText.style.top = (this.y - 50) + 'px';
        document.getElementById('gameContainer').appendChild(levelUpText);
        
        // 动画效果
        setTimeout(() => {
            levelUpText.style.transform = 'translateY(-30px)';
            levelUpText.style.opacity = '0';
        }, 100);
        
        setTimeout(() => {
            if (levelUpText.parentNode) {
                levelUpText.parentNode.removeChild(levelUpText);
            }
        }, 1500);
        
        // 屏幕震动
        shakeScreen(5, 10);
    }

    die() {
        gameState.isRunning = false;
        showGameOver();
    }

    draw() {
        ctx.save();
        
        // 绘制射程范围（半透明）
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // 绘制坦克光环
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size + 15);
        gradient.addColorStop(0, 'rgba(0, 150, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 150, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size + 15, 0, Math.PI * 2);
        ctx.fill();
        
        // 坦克履带阴影
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - this.size * 0.7 + 2, this.y - this.size * 0.9 + 2, this.size * 1.4, this.size * 1.8);
        ctx.globalAlpha = 1;
        
        // 绘制坦克履带
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.fillRect(this.x - this.size * 0.7, this.y - this.size * 0.9, this.size * 1.4, this.size * 1.8);
        ctx.strokeRect(this.x - this.size * 0.7, this.y - this.size * 0.9, this.size * 1.4, this.size * 1.8);
        
        // 履带细节
        ctx.fillStyle = '#444';
        for (let i = 0; i < 4; i++) {
            let trackY = this.y - this.size * 0.6 + i * this.size * 0.4;
            ctx.fillRect(this.x - this.size * 0.65, trackY, this.size * 1.3, 2);
        }
        
        // 绘制坦克主体（车身）
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        
        ctx.fillRect(this.x - this.size * 0.6, this.y - this.size * 0.6, this.size * 1.2, this.size * 1.2);
        ctx.strokeRect(this.x - this.size * 0.6, this.y - this.size * 0.6, this.size * 1.2, this.size * 1.2);
        
        // 绘制炮塔
        ctx.fillStyle = '#0088ff';
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 绘制炮管（指向最近的敌人）
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 10;
        
        // 计算炮管方向
        let barrelAngle = 0;
        if (game.enemies.length > 0) {
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
                barrelAngle = Math.atan2(closestEnemy.y - this.y, closestEnemy.x - this.x);
            }
        }
        
        const barrelLength = this.size * 0.8;
        const barrelEndX = this.x + Math.cos(barrelAngle) * barrelLength;
        const barrelEndY = this.y + Math.sin(barrelAngle) * barrelLength;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(barrelEndX, barrelEndY);
        ctx.stroke();
        
        // 炮口特效
        ctx.fillStyle = '#00ffcc';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(barrelEndX, barrelEndY, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制坦克标识（五角星）
        ctx.fillStyle = '#00d4ff';
        ctx.shadowBlur = 8;
        this.drawStar(this.x, this.y - this.size * 0.2, 4);
        
        ctx.restore();
    }
    
    drawStar(x, y, radius) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const starX = x + Math.cos(angle) * radius;
            const starY = y + Math.sin(angle) * radius;
            if (i === 0) {
                ctx.moveTo(starX, starY);
            } else {
                ctx.lineTo(starX, starY);
            }
        }
        ctx.closePath();
        ctx.fill();
    }
}

// 炮弹类
class Arrow {
    constructor(x, y, targetX, targetY, damage) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.speed = 8;
        this.size = 4;
        this.color = '#00ffcc';
        this.trail = []; // 炮弹尾迹
        
        // 计算方向
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
        
        this.life = 100; // 生命周期
        this.angle = Math.atan2(dy, dx); // 炮弹旋转角度
    }

    update() {
        // 添加到尾迹
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 6) {
            this.trail.shift();
        }
        
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
        
        // 绘制炮弹尾迹
        if (gameState.settings.particleEffects && this.trail.length > 1) {
            for (let i = 0; i < this.trail.length - 1; i++) {
                const alpha = (i + 1) / this.trail.length * 0.7;
                const size = (i + 1) / this.trail.length * 4;
                
                ctx.globalAlpha = alpha;
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 6;
                
                ctx.beginPath();
                ctx.arc(this.trail[i].x, this.trail[i].y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        
        // 绘制炮弹光晕
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 10);
        gradient.addColorStop(0, 'rgba(0, 255, 204, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 255, 204, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制炮弹主体
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // 炮弹外壳
        ctx.fillStyle = '#666666';
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
        ctx.fillRect(-this.size * 1.5, -this.size/2, this.size * 3, this.size);
        ctx.strokeRect(-this.size * 1.5, -this.size/2, this.size * 3, this.size);
        
        // 炮弹头部（尖头）
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.moveTo(this.size * 1.5, 0);
        ctx.lineTo(this.size * 0.5, -this.size/2);
        ctx.lineTo(this.size * 0.5, this.size/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 炮弹能量核心
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, this.size/3, 0, Math.PI * 2);
        ctx.fill();
        
        // 炮弹尾部喷射火焰
        if (gameState.settings.particleEffects) {
            ctx.globalAlpha = 0.8;
            const flameGradient = ctx.createLinearGradient(-this.size * 1.5, 0, -this.size * 2.5, 0);
            flameGradient.addColorStop(0, '#ffaa00');
            flameGradient.addColorStop(0.5, '#ff6600');
            flameGradient.addColorStop(1, '#ff3300');
            
            ctx.fillStyle = flameGradient;
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 12;
            
            // 火焰形状
            ctx.beginPath();
            ctx.moveTo(-this.size * 1.5, 0);
            ctx.lineTo(-this.size * 2, -this.size/3);
            ctx.lineTo(-this.size * 2.5, 0);
            ctx.lineTo(-this.size * 2, this.size/3);
            ctx.closePath();
            ctx.fill();
            
            // 额外的火花
            ctx.fillStyle = '#ffff00';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(-this.size * 2.2, 0, this.size/6, 0, Math.PI * 2);
            ctx.fill();
        }
        
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
        // 使用红色到紫色的对比色调
        this.color = `hsl(${300 + Math.random() * 60}, 70%, 50%)`;
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
        
        // 显示伤害数字
        const damageText = new DamageText(this.x, this.y - 20, damage);
        game.damageTexts.push(damageText);
        
        // 屏幕震动
        shakeScreen(2, 3);
        
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
        if (gameState.settings.particleEffects) {
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
            
            // 添加蓝色爆炸效果
            for (let i = 0; i < 5; i++) {
                const particle = new Particle(
                    this.x + (Math.random() - 0.5) * 15,
                    this.y + (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8,
                    '#0096ff',
                    25
                );
                game.particles.push(particle);
            }
        }
    }

    draw() {
        ctx.save();
        
        // 绘制敌方坦克阴影
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x - this.size * 0.7 + 2, this.y - this.size * 0.9 + 2, this.size * 1.4, this.size * 1.8);
        ctx.globalAlpha = 1;
        
        // 绘制敌方坦克光环
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size + 5);
        gradient.addColorStop(0, this.color + '80');
        gradient.addColorStop(1, this.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制敌方坦克履带
        ctx.fillStyle = '#660000';
        ctx.strokeStyle = '#880000';
        ctx.lineWidth = 1;
        ctx.fillRect(this.x - this.size * 0.7, this.y - this.size * 0.9, this.size * 1.4, this.size * 1.8);
        ctx.strokeRect(this.x - this.size * 0.7, this.y - this.size * 0.9, this.size * 1.4, this.size * 1.8);
        
        // 敌方履带细节
        ctx.fillStyle = '#770000';
        for (let i = 0; i < 4; i++) {
            let trackY = this.y - this.size * 0.6 + i * this.size * 0.4;
            ctx.fillRect(this.x - this.size * 0.65, trackY, this.size * 1.3, 2);
        }
        
        // 绘制敌方坦克主体（车身）
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        
        ctx.fillRect(this.x - this.size * 0.6, this.y - this.size * 0.6, this.size * 1.2, this.size * 1.2);
        ctx.strokeRect(this.x - this.size * 0.6, this.y - this.size * 0.6, this.size * 1.2, this.size * 1.2);
        
        // 绘制敌方炮塔
        ctx.fillStyle = '#aa0000';
        ctx.strokeStyle = '#660000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 绘制敌方炮管（指向玩家）
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 8;
        
        // 计算炮管方向（指向玩家）
        const barrelAngle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
        const barrelLength = this.size * 0.7;
        const barrelEndX = this.x + Math.cos(barrelAngle) * barrelLength;
        const barrelEndY = this.y + Math.sin(barrelAngle) * barrelLength;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(barrelEndX, barrelEndY);
        ctx.stroke();
        
        // 敌方炮口特效
        ctx.fillStyle = '#ff4444';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(barrelEndX, barrelEndY, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制敌方标识（叉号）
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        const markSize = 3;
        ctx.beginPath();
        ctx.moveTo(this.x - markSize, this.y - this.size * 0.2 - markSize);
        ctx.lineTo(this.x + markSize, this.y - this.size * 0.2 + markSize);
        ctx.moveTo(this.x + markSize, this.y - this.size * 0.2 - markSize);
        ctx.lineTo(this.x - markSize, this.y - this.size * 0.2 + markSize);
        ctx.stroke();
        
        // 绘制血条背景
        const barWidth = this.size * 2;
        const barHeight = 6;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 15;
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // 绘制血条
        const healthPercent = this.hp / this.maxHp;
        const healthGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        if (healthPercent > 0.6) {
            healthGradient.addColorStop(0, '#44ff44');
            healthGradient.addColorStop(1, '#66ff66');
        } else if (healthPercent > 0.3) {
            healthGradient.addColorStop(0, '#ffff44');
            healthGradient.addColorStop(1, '#ffff66');
        } else {
            healthGradient.addColorStop(0, '#ff4444');
            healthGradient.addColorStop(1, '#ff6666');
        }
        
        ctx.fillStyle = healthGradient;
        ctx.fillRect(barX, barY, healthPercent * barWidth, barHeight);
        
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
                this.color = '#0096ff';
                this.name = '火力强化';
                this.value = 3 + Math.random() * 5;
                break;
            case 'speed':
                this.color = '#00ccff';
                this.name = '机动性';
                this.value = 0.3 + Math.random() * 0.5;
                break;
            case 'range':
                this.color = '#00ffcc';
                this.name = '炮弹射程';
                this.value = 15 + Math.random() * 20;
                break;
            case 'heal':
                this.color = '#0088ff';
                this.name = '装甲修复';
                this.value = 20 + Math.random() * 30;
                break;
            case 'attackSpeed':
                this.color = '#44ddff';
                this.name = '开火速度';
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
        let message = '';
        switch (this.type) {
            case 'attack':
                game.player.attack += this.value;
                message = `🔥 火力强化 +${Math.round(this.value)}`;
                break;
            case 'speed':
                game.player.speed += this.value;
                message = `⚡ 机动性 +${this.value.toFixed(1)}`;
                break;
            case 'range':
                game.player.range += this.value;
                message = `🎯 射程强化 +${Math.round(this.value)}`;
                break;
            case 'heal':
                const healAmount = Math.min(game.player.maxHp - game.player.hp, this.value);
                game.player.hp = Math.min(game.player.maxHp, game.player.hp + this.value);
                message = `🛡️ 装甲修复 +${Math.round(healAmount)}`;
                break;
            case 'attackSpeed':
                game.player.attackSpeed += this.value;
                message = `🔥 开火速度 +${this.value.toFixed(1)}`;
                break;
        }
        
        // 显示拾取通知
        showNotification(message, 2000);
        
        // 创建拾取特效
        this.createPickupEffect();
    }

    createPickupEffect() {
        if (gameState.settings.particleEffects) {
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
            
            // 添加白色闪光效果
            for (let i = 0; i < 3; i++) {
                const particle = new Particle(
                    this.x + (Math.random() - 0.5) * 10,
                    this.y + (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    '#ffffff',
                    15
                );
                game.particles.push(particle);
            }
        }
    }

    draw() {
        ctx.save();
        
        // 绘制道具光环
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size + 8);
        gradient.addColorStop(0, this.color + '80');
        gradient.addColorStop(0.5, this.color + '40');
        gradient.addColorStop(1, this.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制道具主体
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        // 绘制道具
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 绘制能量核心
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制拾取范围（半透明）
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.2;
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
    document.getElementById('expMax').textContent = game.player.expToNext;
    document.getElementById('hp').textContent = Math.round(game.player.hp);
    document.getElementById('maxHp').textContent = game.player.maxHp;
    document.getElementById('attack').textContent = Math.round(game.player.attack);
    document.getElementById('attackSpeed').textContent = game.player.attackSpeed.toFixed(1);
    document.getElementById('range').textContent = Math.round(game.player.range);
    document.getElementById('kills').textContent = game.kills;
    document.getElementById('time').textContent = Math.floor(game.gameTime / 1000);
    
    // 更新右侧UI
    document.getElementById('enemyCount').textContent = game.enemies.length;
    document.getElementById('waveNumber').textContent = gameState.wave;
    
    const now = Date.now();
    const timeInWave = now - gameState.lastWaveTime;
    const timeToNextWave = Math.max(0, (gameState.nextWaveTime - timeInWave) / 1000);
    document.getElementById('nextWave').textContent = Math.ceil(timeToNextWave);
    
    // 更新性能监控
    if (gameState.settings.showFPS) {
        document.getElementById('fps').textContent = gameState.performance.fps;
        const objectCount = game.enemies.length + game.arrows.length + game.items.length + game.particles.length;
        document.getElementById('objectCount').textContent = objectCount;
    }
    
    // 更新进度条
    const hpPercent = (game.player.hp / game.player.maxHp) * 100;
    const expPercent = (game.player.exp / game.player.expToNext) * 100;
    
    document.getElementById('hpFill').style.width = hpPercent + '%';
    document.getElementById('expFill').style.width = expPercent + '%';
    
    // 更新暂停按钮文本
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = gameState.isPaused ? '继续' : '暂停';
    
    // 更新准星位置
    if (gameState.settings.showCrosshair && input.mouse.x && input.mouse.y) {
        const crosshair = document.getElementById('crosshair');
        const rect = canvas.getBoundingClientRect();
        crosshair.style.left = (input.mouse.x - rect.left - 10) + 'px';
        crosshair.style.top = (input.mouse.y - rect.top - 10) + 'px';
        crosshair.style.display = 'block';
    } else {
        document.getElementById('crosshair').style.display = 'none';
    }
}

// 游戏主循环
function gameLoop() {
    if (!gameState.isRunning) return;
    
    const now = Date.now();
    const deltaTime = now - gameState.lastUpdateTime;
    gameState.lastUpdateTime = now;
    game.gameTime = now - gameState.startTime;
    
    // 如果游戏暂停，只绘制不更新
    if (gameState.isPaused) {
        drawGame();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // 更新屏幕震动
    updateShake();
    
    // 更新性能监控
    updatePerformance();
    
    // 更新波次系统
    updateWave();
    
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
    
    // 更新伤害数字
    for (let i = game.damageTexts.length - 1; i >= 0; i--) {
        if (!game.damageTexts[i].update()) {
            game.damageTexts.splice(i, 1);
        }
    }
    
    // 生成敌人
    spawnEnemy();
    
    // 碰撞检测
    checkCollisions();
    
    // 绘制游戏
    drawGame();
    
    // 更新小地图
    updateMinimap();
    
    // 更新UI
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// 绘制游戏
function drawGame() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 应用屏幕震动
    ctx.save();
    ctx.translate(gameState.shake.x, gameState.shake.y);
    
    // 绘制所有对象
    game.particles.forEach(particle => particle.draw());
    game.items.forEach(item => item.draw());
    game.enemies.forEach(enemy => enemy.draw());
    game.arrows.forEach(arrow => arrow.draw());
    game.player.draw();
    game.damageTexts.forEach(damageText => damageText.draw());
    
    // 如果游戏暂停，绘制暂停提示
    if (gameState.isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-gameState.shake.x, -gameState.shake.y, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#4299e1';
        ctx.shadowBlur = 20;
        ctx.fillText('游戏暂停', canvas.width/2 - gameState.shake.x, canvas.height/2 - gameState.shake.y);
        
        ctx.font = '24px Rajdhani';
        ctx.fillText('按空格键继续', canvas.width/2 - gameState.shake.x, canvas.height/2 + 60 - gameState.shake.y);
    }
    
    ctx.restore();
}

// 初始化游戏
function initGame() {
    game.player = new Player(canvas.width / 2, canvas.height / 2);
    game.arrows = [];
    game.enemies = [];
    game.items = [];
    game.particles = [];
    game.damageTexts = [];
    game.kills = 0;
    game.gameTime = 0;
    game.lastEnemySpawn = 0;
    game.lastArrowShoot = 0;
    game.enemySpawnRate = 2000;
    
    gameState.isRunning = true;
    gameState.isPaused = false;
    gameState.startTime = Date.now();
    gameState.lastUpdateTime = Date.now();
    gameState.shake = { x: 0, y: 0, intensity: 0, duration: 0 };
    gameState.wave = 1;
    gameState.lastWaveTime = Date.now();
    gameState.performance = {
        fps: 60,
        frameCount: 0,
        lastFPSUpdate: Date.now()
    };
    
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('upgradeChoice').style.display = 'none';
    document.getElementById('settingsPanel').style.display = 'none';
    
    showNotification('🎮 游戏开始！', 2000);
}

// 显示游戏结束界面
function showGameOver() {
    document.getElementById('finalKills').textContent = game.kills;
    document.getElementById('finalTime').textContent = Math.floor(game.gameTime / 1000);
    document.getElementById('finalLevel').textContent = game.player.level;
    document.getElementById('finalWave').textContent = gameState.wave;
    document.getElementById('gameOver').style.display = 'block';
    
    // 隐藏其他面板
    document.getElementById('upgradeChoice').style.display = 'none';
    document.getElementById('settingsPanel').style.display = 'none';
}

// 暂停/继续游戏
function togglePause() {
    gameState.isPaused = !gameState.isPaused;
}

// 键盘事件监听
document.addEventListener('keydown', (e) => {
    input.keys[e.code] = true;
    
    // 空格键暂停/继续
    if (e.code === 'Space') {
        e.preventDefault();
        if (document.getElementById('upgradeChoice').style.display === 'none' && 
            document.getElementById('settingsPanel').style.display === 'none') {
            togglePause();
        }
    }
    
    // ESC键打开/关闭设置
    if (e.code === 'Escape') {
        e.preventDefault();
        if (document.getElementById('upgradeChoice').style.display === 'none') {
            toggleSettings();
        }
    }
    
    // M键切换小地图
    if (e.code === 'KeyM') {
        e.preventDefault();
        gameState.settings.showMinimap = !gameState.settings.showMinimap;
        document.getElementById('rightUI').querySelector('.minimap').style.display = 
            gameState.settings.showMinimap ? 'block' : 'none';
        showNotification(`小地图: ${gameState.settings.showMinimap ? '开启' : '关闭'}`, 1500);
    }
    
    // C键切换准星
    if (e.code === 'KeyC') {
        e.preventDefault();
        gameState.settings.showCrosshair = !gameState.settings.showCrosshair;
        showNotification(`准星: ${gameState.settings.showCrosshair ? '开启' : '关闭'}`, 1500);
    }
});

document.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
});

// 鼠标移动事件
canvas.addEventListener('mousemove', (e) => {
    input.mouse.x = e.clientX;
    input.mouse.y = e.clientY;
});

// 暂停按钮
document.getElementById('pauseBtn').addEventListener('click', togglePause);

// 设置按钮
document.getElementById('settingsBtn').addEventListener('click', toggleSettings);

// 设置面板事件
document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsPanel').style.display = 'none';
    gameState.isPaused = false;
});

// 设置选项事件
document.getElementById('showFPS').addEventListener('click', (e) => {
    gameState.settings.showFPS = !gameState.settings.showFPS;
    e.target.textContent = gameState.settings.showFPS ? '开启' : '关闭';
    document.querySelector('.performance-monitor').style.display = 
        gameState.settings.showFPS ? 'block' : 'none';
});

document.getElementById('particleEffects').addEventListener('click', (e) => {
    gameState.settings.particleEffects = !gameState.settings.particleEffects;
    e.target.textContent = gameState.settings.particleEffects ? '开启' : '关闭';
});

document.getElementById('screenShake').addEventListener('click', (e) => {
    gameState.settings.screenShake = !gameState.settings.screenShake;
    e.target.textContent = gameState.settings.screenShake ? '开启' : '关闭';
});

document.getElementById('quality').addEventListener('change', (e) => {
    gameState.settings.quality = e.target.value;
    // 可以根据画质设置调整渲染质量
});

document.getElementById('soundVolume').addEventListener('input', (e) => {
    gameState.settings.soundVolume = e.target.value;
    // 音量控制逻辑
});

// 重新开始按钮
document.getElementById('restartBtn').addEventListener('click', () => {
    initGame();
    gameLoop();
});

// 防止右键菜单
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// 窗口大小改变事件
window.addEventListener('resize', () => {
    // 可以添加响应式调整逻辑
});

// 开始游戏
initGame();
gameLoop();