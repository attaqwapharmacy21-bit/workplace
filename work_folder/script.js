// ============================================
// HILL CLIMBING RACING GAME - ENHANCED VERSION
// ============================================

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = Math.min(1200, container.clientWidth - 40);
    canvas.height = 600;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================
// GAME CONSTANTS
// ============================================
const GRAVITY = 0.4;              // Reduced for more stability
const GROUND_FRICTION = 0.97;     // Slightly less friction
const AIR_RESISTANCE = 0.99;
const MAX_SPEED = 12;
const ACCELERATION = 0.35;
const BRAKE_FORCE = 0.4;
const REVERSE_SPEED = -6;         // Maximum reverse speed
const INITIAL_FUEL = 100;
const FUEL_CONSUMPTION = 0.015;   // Slightly reduced
const HILL_SEGMENT_WIDTH = 30;
const MAX_FUEL = INITIAL_FUEL;
const FUEL_PICKUP_AMOUNT = 30;
const COIN_PICKUP_CHANCE = 0.1;
const PICKUP_CLEAR_BEHIND = 200;

// Improved terrain parameters for more natural feel
const TERRAIN_FREQUENCY = 0.012;
const TERRAIN_FREQUENCY_2 = 0.025;
const TERRAIN_FREQUENCY_3 = 0.006;
const TERRAIN_AMPLITUDE = 70;
const TERRAIN_AMPLITUDE_2 = 35;
const TERRAIN_AMPLITUDE_3 = 50;
const NOISE_AMPLITUDE = 15;
const NOISE_SMOOTH = 0.9;

// Fuel spawn control
const FUEL_SPAWN_MIN_M = 400;
const FUEL_SPAWN_MAX_M = 600;
let lastFuelSpawnX = 0;
let nextFuelSpawnPx = (FUEL_SPAWN_MIN_M + Math.random() * (FUEL_SPAWN_MAX_M - FUEL_SPAWN_MIN_M)) * 10;
let terrainNoisePrev = 0;

// Bridge system
const BRIDGE_MIN_DISTANCE = 250;  // Minimum distance between bridges (meters)
const BRIDGE_MAX_DISTANCE = 400;
const BRIDGE_LENGTH = 150;        // Bridge length in pixels
let lastBridgeX = -500;           // Start with negative to allow first bridge
let nextBridgeX = (BRIDGE_MIN_DISTANCE + Math.random() * (BRIDGE_MAX_DISTANCE - BRIDGE_MIN_DISTANCE)) * 10;
let bridges = [];                 // Array of bridge objects

// Boost system
const BOOST_SPAWN_MIN = 200;
const BOOST_SPAWN_MAX = 350;
const BOOST_DURATION = 3000;      // 3 seconds
const BOOST_SPEED_MULTIPLIER = 1.8;
let boosts = [];
let boostActive = false;
let boostEndTime = 0;
let lastBoostSpawnX = 0;
let nextBoostSpawnPx = (BOOST_SPAWN_MIN + Math.random() * (BOOST_SPAWN_MAX - BOOST_SPAWN_MIN)) * 10;

// Background system
const BACKGROUND_CHANGE_DISTANCE = 100; // Change every 100 meters
const BACKGROUNDS = [
    { name: 'green', sky: ['#87CEEB', '#E0F6FF', '#90EE90'], ground: '#8B4513' },
    { name: 'desert', sky: ['#FFB347', '#FFD27F', '#F4A460'], ground: '#D2691E' },
    { name: 'snow', sky: ['#B0E0E6', '#E0FFFF', '#F0F8FF'], ground: '#8B7D7B' },
    { name: 'evening', sky: ['#FF6B6B', '#FFA07A', '#FFB6C1'], ground: '#654321' },
    { name: 'night', sky: ['#191970', '#483D8B', '#2F4F4F'], ground: '#4B3621' }
];
let currentBackgroundIndex = 0;
let nextBackgroundIndex = 1;
let backgroundTransition = 0;   // 0 to 1 for smooth transition

// Level system
let currentLevel = 1;
const LEVEL_DISTANCE = 500;      // Level up every 500 meters

// Particle system for effects
let particles = [];

// ============================================
// GAME STATE
// ============================================
let gameState = 'start';
let score = 0;
let fuel = INITIAL_FUEL;
let isGameOver = false;

// ============================================
// CAR OBJECT (Enhanced stability)
// ============================================
const car = {
    x: 200,
    y: 300,
    width: 55,
    height: 28,
    velocityX: 0,
    velocityY: 0,
    rotation: 0,
    angularVelocity: 0,
    onGround: false,
    mass: 2.5,                    // Added mass for stability
    rotationDamping: 0.88,        // Higher damping = less rotation
    
    wheels: {
        front: { x: 0, y: 0, radius: 9 },
        back: { x: 0, y: 0, radius: 9 }
    }
};

// ============================================
// TERRAIN GENERATION
// ============================================
let terrain = [];
let terrainOffset = 0;
let fuelPickups = [];
let coins = [];
let coinCount = 0;

// Generate initial terrain
function generateTerrain() {
    terrain = [];
    bridges = [];
    const numSegments = Math.ceil(canvas.width / HILL_SEGMENT_WIDTH) + 10;

    fuelPickups = [];
    coins = [];
    boosts = [];

    lastFuelSpawnX = terrainOffset;
    nextFuelSpawnPx = (FUEL_SPAWN_MIN_M + Math.random() * (FUEL_SPAWN_MAX_M - FUEL_SPAWN_MIN_M)) * 10;
    
    lastBoostSpawnX = terrainOffset;
    nextBoostSpawnPx = (BOOST_SPAWN_MIN + Math.random() * (BOOST_SPAWN_MAX - BOOST_SPAWN_MIN)) * 10;

    lastBridgeX = terrainOffset - 500;
    nextBridgeX = (BRIDGE_MIN_DISTANCE + Math.random() * (BRIDGE_MAX_DISTANCE - BRIDGE_MIN_DISTANCE)) * 10;

    for (let i = 0; i < numSegments; i++) {
        const x = i * HILL_SEGMENT_WIDTH;
        addTerrainSegment(x, i);
    }
}

// Add a single terrain segment
function addTerrainSegment(x, index) {
    const baseHeight = canvas.height * 0.6;
    const phase = (index + terrainOffset / HILL_SEGMENT_WIDTH);
    
    // Check if this segment is part of a bridge
    const isOnBridge = bridges.some(bridge => x >= bridge.startX && x <= bridge.endX);
    
    let y;
    if (isOnBridge) {
        // Flat bridge surface
        const bridge = bridges.find(b => x >= b.startX && x <= b.endX);
        y = bridge.y;
    } else {
        // Normal terrain with waves
        const levelMultiplier = 1 + (currentLevel - 1) * 0.15; // Increase difficulty with level
        const wave1 = Math.sin(phase * TERRAIN_FREQUENCY) * TERRAIN_AMPLITUDE * levelMultiplier;
        const wave2 = Math.sin(phase * TERRAIN_FREQUENCY_2) * TERRAIN_AMPLITUDE_2;
        const wave3 = Math.sin(phase * TERRAIN_FREQUENCY_3) * TERRAIN_AMPLITUDE_3;

        const rawNoise = (Math.random() - 0.5) * NOISE_AMPLITUDE;
        terrainNoisePrev = terrainNoisePrev * NOISE_SMOOTH + rawNoise * (1 - NOISE_SMOOTH);

        y = baseHeight + wave1 + wave2 + wave3 + terrainNoisePrev;
    }

    terrain.push({ x: x, y: y, isOnBridge: isOnBridge });

    // Check if we should spawn a bridge
    if (x >= lastBridgeX + nextBridgeX && !isOnBridge) {
        const bridgeStartX = x;
        const bridgeEndX = x + BRIDGE_LENGTH;
        const bridgeY = y;
        
        bridges.push({
            startX: bridgeStartX,
            endX: bridgeEndX,
            y: bridgeY,
            type: Math.random() > 0.5 ? 'wooden' : 'metal'
        });
        
        lastBridgeX = x;
        nextBridgeX = (BRIDGE_MIN_DISTANCE + Math.random() * (BRIDGE_MAX_DISTANCE - BRIDGE_MIN_DISTANCE)) * 10;
    }

    // Spawn fuel
    if (x >= lastFuelSpawnX + nextFuelSpawnPx) {
        fuelPickups.push({ x: x + HILL_SEGMENT_WIDTH * 0.5, y: y - 15, collected: false });
        lastFuelSpawnX = x;
        nextFuelSpawnPx = (FUEL_SPAWN_MIN_M + Math.random() * (FUEL_SPAWN_MAX_M - FUEL_SPAWN_MIN_M)) * 10;
    }

    // Spawn boosts
    if (x >= lastBoostSpawnX + nextBoostSpawnPx) {
        boosts.push({ x: x + HILL_SEGMENT_WIDTH * 0.5, y: y - 5, collected: false, active: false });
        lastBoostSpawnX = x;
        nextBoostSpawnPx = (BOOST_SPAWN_MIN + Math.random() * (BOOST_SPAWN_MAX - BOOST_SPAWN_MIN)) * 10;
    }

    // Spawn coins
    if (Math.random() < COIN_PICKUP_CHANCE * (1 - currentLevel * 0.05)) {
        coins.push({ x: x + HILL_SEGMENT_WIDTH * 0.6, y: y - 35 - Math.random() * 20, collected: false });
    }
}

// Update terrain
function updateTerrain() {
    while (terrain.length > 0 && terrain[0].x < terrainOffset - 100) {
        terrain.shift();
    }
    
    while (terrain[terrain.length - 1].x < terrainOffset + canvas.width + 100) {
        const lastSegment = terrain[terrain.length - 1];
        const x = lastSegment.x + HILL_SEGMENT_WIDTH;
        const index = terrain.length;
        addTerrainSegment(x, index);
    }

    // Clean old bridges
    bridges = bridges.filter(b => b.endX > terrainOffset - 200);
}

// ============================================
// INPUT HANDLING (Desktop + Mobile)
// ============================================
const keys = {
    forward: false,  // D key
    backward: false, // A key
    brake: false     // B key
};

// Desktop keyboard controls
document.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') return;
    
    const key = e.key.toLowerCase();
    if (key === 'd' || key === 'arrowright') {
        keys.forward = true;
    }
    if (key === 'a' || key === 'arrowleft') {
        keys.backward = true;
    }
    if (key === 'b') {
        keys.brake = true;
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'd' || key === 'arrowright') {
        keys.forward = false;
    }
    if (key === 'a' || key === 'arrowleft') {
        keys.backward = false;
    }
    if (key === 'b') {
        keys.brake = false;
    }
});

// Mobile touch controls
function setupMobileControls() {
    const btnForward = document.getElementById('btnForward');
    const btnReverse = document.getElementById('btnReverse');
    const btnBrake = document.getElementById('btnBrake');

    if (btnForward) {
        btnForward.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys.forward = true;
        });
        btnForward.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys.forward = false;
        });
    }

    if (btnReverse) {
        btnReverse.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys.backward = true;
        });
        btnReverse.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys.backward = false;
        });
    }

    if (btnBrake) {
        btnBrake.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys.brake = true;
        });
        btnBrake.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys.brake = false;
        });
    }
}

// ============================================
// COLLISION DETECTION
// ============================================
function getTerrainHeightAt(worldX) {
    for (let i = 0; i < terrain.length - 1; i++) {
        const p1 = terrain[i];
        const p2 = terrain[i + 1];
        
        if (worldX >= p1.x && worldX <= p2.x) {
            const ratio = (worldX - p1.x) / (p2.x - p1.x);
            return p1.y + (p2.y - p1.y) * ratio;
        }
    }
    return canvas.height * 0.6;
}

function getTerrainAngleAt(worldX) {
    for (let i = 0; i < terrain.length - 1; i++) {
        const p1 = terrain[i];
        const p2 = terrain[i + 1];
        
        if (worldX >= p1.x && worldX <= p2.x) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            return Math.atan2(dy, dx);
        }
    }
    return 0;
}

function updateWheelPositions() {
    const cos = Math.cos(car.rotation);
    const sin = Math.sin(car.rotation);
    
    const frontOffsetX = car.width * 0.35;
    car.wheels.front.x = car.x + frontOffsetX * cos;
    car.wheels.front.y = car.y + frontOffsetX * sin + car.height / 2;
    
    const backOffsetX = -car.width * 0.35;
    car.wheels.back.x = car.x + backOffsetX * cos;
    car.wheels.back.y = car.y + backOffsetX * sin + car.height / 2;
}

function checkWheelCollision(wheel) {
    const worldX = wheel.x + terrainOffset;
    const terrainY = getTerrainHeightAt(worldX);
    
    if (wheel.y + wheel.radius >= terrainY) {
        return {
            collision: true,
            terrainY: terrainY,
            penetration: (wheel.y + wheel.radius) - terrainY
        };
    }
    
    return { collision: false };
}

// ============================================
// PICKUP & BOOST COLLISION
// ============================================
function checkPickups() {
    const carWorldX = car.x + terrainOffset;
    const carWorldY = car.y;
    const carRadius = Math.max(car.width, car.height) * 0.6;

    // Fuel pickups
    for (let i = 0; i < fuelPickups.length; i++) {
        const p = fuelPickups[i];
        if (p.collected) continue;
        const dx = p.x - carWorldX;
        const dy = p.y - carWorldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < carRadius + 10) {
            p.collected = true;
            fuel = Math.min(MAX_FUEL, fuel + FUEL_PICKUP_AMOUNT);
            createParticles(p.x - terrainOffset, p.y, '#f4a261', 8);
        }
    }

    // Coins with animation
    for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (c.collected) continue;
        const dx = c.x - carWorldX;
        const dy = c.y - carWorldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < carRadius + 10) {
            c.collected = true;
            coinCount += 1;
            createParticles(c.x - terrainOffset, c.y, '#FFD700', 10);
        }
    }

    // Boosts
    for (let i = 0; i < boosts.length; i++) {
        const b = boosts[i];
        if (b.collected) continue;
        const dx = b.x - carWorldX;
        const dy = b.y - carWorldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < carRadius + 15) {
            b.collected = true;
            activateBoost();
            createParticles(b.x - terrainOffset, b.y, '#FFD93D', 15);
        }
    }

    fuelPickups = fuelPickups.filter(p => !p.collected && p.x > terrainOffset - PICKUP_CLEAR_BEHIND);
    coins = coins.filter(c => !c.collected && c.x > terrainOffset - PICKUP_CLEAR_BEHIND);
    boosts = boosts.filter(b => !b.collected && b.x > terrainOffset - PICKUP_CLEAR_BEHIND);
}

// ============================================
// BOOST SYSTEM
// ============================================
function activateBoost() {
    boostActive = true;
    boostEndTime = Date.now() + BOOST_DURATION;
    document.getElementById('boostIndicator').classList.add('active');
}

function updateBoost() {
    if (boostActive) {
        const remaining = boostEndTime - Date.now();
        if (remaining <= 0) {
            boostActive = false;
            document.getElementById('boostIndicator').classList.remove('active');
        } else {
            const percent = (remaining / BOOST_DURATION) * 100;
            document.getElementById('boostBar').style.width = percent + '%';
        }
    }
}

// ============================================
// PARTICLE SYSTEM
// ============================================
function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            life: 1,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= 0.02;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

// ============================================
// PHYSICS UPDATE (Enhanced Stability)
// ============================================
function updatePhysics() {
    const currentMaxSpeed = boostActive ? MAX_SPEED * BOOST_SPEED_MULTIPLIER : MAX_SPEED;
    const currentAcceleration = boostActive ? ACCELERATION * 1.5 : ACCELERATION;

    // Apply controls
    if (keys.forward && fuel > 0) {
        car.velocityX += currentAcceleration;
        fuel -= FUEL_CONSUMPTION;
        if (fuel < 0) fuel = 0;
    }
    
    if (keys.backward) {
        car.velocityX -= ACCELERATION * 0.8;
    }
    
    if (keys.brake) {
        car.velocityX *= (1 - BRAKE_FORCE);
    }
    
    // Limit speeds
    if (car.velocityX > currentMaxSpeed) car.velocityX = currentMaxSpeed;
    if (car.velocityX < REVERSE_SPEED) car.velocityX = REVERSE_SPEED;
    
    // Apply gravity
    car.velocityY += GRAVITY;
    
    updateWheelPositions();
    
    const frontCollision = checkWheelCollision(car.wheels.front);
    const backCollision = checkWheelCollision(car.wheels.back);
    
    car.onGround = frontCollision.collision || backCollision.collision;
    
    if (car.onGround) {
        const worldX = car.x + terrainOffset;
        const terrainAngle = getTerrainAngleAt(worldX);
        
        // Smoother rotation with increased damping
        const targetRotation = terrainAngle;
        const rotationDiff = targetRotation - car.rotation;
        car.rotation += rotationDiff * 0.15; // Reduced from 0.2 for smoother rotation
        
        if (frontCollision.collision && backCollision.collision) {
            const avgTerrainY = (frontCollision.terrainY + backCollision.terrainY) / 2;
            car.y = avgTerrainY - car.height / 2 - car.wheels.front.radius;
        } else if (frontCollision.collision) {
            car.y = frontCollision.terrainY - car.height / 2 - car.wheels.front.radius;
        } else if (backCollision.collision) {
            car.y = backCollision.terrainY - car.height / 2 - car.wheels.back.radius;
        }
        
        car.velocityX *= GROUND_FRICTION;
        car.velocityY = 0;
        
        const slopeInfluence = Math.sin(terrainAngle) * 0.25;
        car.velocityX += slopeInfluence;
        
        // Dampen angular velocity more on ground
        car.angularVelocity *= car.rotationDamping;
        
    } else {
        car.velocityX *= AIR_RESISTANCE;
        car.rotation += car.angularVelocity;
        car.angularVelocity *= 0.96; // Slightly more damping in air
        car.angularVelocity += car.velocityX * 0.0008; // Reduced rotation from velocity
    }
    
    car.x += car.velocityX;
    car.y += car.velocityY;
    
    // Scroll terrain
    if (car.x > canvas.width * 0.4) {
        const scroll = car.x - canvas.width * 0.4;
        terrainOffset += scroll;
        car.x = canvas.width * 0.4;
        score += scroll / 10;
    }
    
    if (car.x < 50) {
        car.x = 50;
        car.velocityX = Math.max(0, car.velocityX);
    }
    
    if (car.y > canvas.height + 100) {
        endGame('You fell into the abyss!');
    }
    
    // More lenient flip detection
    const normalizedRotation = ((car.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (normalizedRotation > Math.PI * 0.7 && normalizedRotation < Math.PI * 1.3) {
        endGame('Your car flipped!');
    }
    
    if (fuel <= 0 && car.velocityX < 0.1 && car.velocityX > -0.1) {
        endGame('Out of fuel!');
    }
}

// ============================================
// LEVEL SYSTEM
// ============================================
function updateLevel() {
    const newLevel = Math.floor(score / LEVEL_DISTANCE) + 1;
    if (newLevel > currentLevel) {
        currentLevel = newLevel;
        // Level up effects could be added here
    }
}

// ============================================
// BACKGROUND SYSTEM
// ============================================
function updateBackground() {
    const targetIndex = Math.floor(score / BACKGROUND_CHANGE_DISTANCE) % BACKGROUNDS.length;
    
    if (targetIndex !== currentBackgroundIndex) {
        nextBackgroundIndex = targetIndex;
        backgroundTransition = Math.min(1, backgroundTransition + 0.01);
        
        if (backgroundTransition >= 1) {
            currentBackgroundIndex = nextBackgroundIndex;
            backgroundTransition = 0;
        }
    }
}

function drawBackground() {
    const current = BACKGROUNDS[currentBackgroundIndex];
    const next = BACKGROUNDS[nextBackgroundIndex];
    const t = backgroundTransition;
    
    // Interpolate sky colors
    const skyColors = current.sky.map((color, i) => {
        return lerpColor(color, next.sky[i], t);
    });
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, skyColors[0]);
    gradient.addColorStop(0.5, skyColors[1]);
    gradient.addColorStop(1, skyColors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Sun or moon
    if (currentBackgroundIndex === 4) { // Night - draw moon
        ctx.fillStyle = '#F0F0F0';
        ctx.beginPath();
        ctx.arc(100, 80, 35, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(100, 80, 40, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Clouds
    drawCloud(200, 100, 60);
    drawCloud(500, 80, 80);
    drawCloud(800, 120, 70);
}

function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function drawCloud(x, y, size) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.4, y, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x - size * 0.4, y, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x, y - size * 0.3, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================
// RENDERING
// ============================================
function drawTerrain() {
    const current = BACKGROUNDS[currentBackgroundIndex];
    const next = BACKGROUNDS[nextBackgroundIndex];
    const t = backgroundTransition;
    
    const groundColor = lerpColor(current.ground, next.ground, t);
    
    ctx.fillStyle = groundColor;
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    
    for (let i = 0; i < terrain.length; i++) {
        const x = terrain[i].x - terrainOffset;
        const y = terrain[i].y;
        
        if (i === 0) {
            ctx.lineTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Grass line
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < terrain.length; i++) {
        const x = terrain[i].x - terrainOffset;
        const y = terrain[i].y;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

function drawBridges() {
    bridges.forEach(bridge => {
        const startX = bridge.startX - terrainOffset;
        const endX = bridge.endX - terrainOffset;
        const y = bridge.y;
        
        if (endX < -50 || startX > canvas.width + 50) return;
        
        ctx.save();
        
        if (bridge.type === 'wooden') {
            // Wooden bridge
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(startX, y - 8, endX - startX, 12);
            
            // Planks
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            for (let x = startX; x < endX; x += 15) {
                ctx.beginPath();
                ctx.moveTo(x, y - 8);
                ctx.lineTo(x, y + 4);
                ctx.stroke();
            }
            
            // Support beams
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(startX, y + 30);
            ctx.moveTo(startX + (endX - startX) / 2, y);
            ctx.lineTo(startX + (endX - startX) / 2, y + 35);
            ctx.moveTo(endX, y);
            ctx.lineTo(endX, y + 30);
            ctx.stroke();
        } else {
            // Metal bridge
            ctx.fillStyle = '#708090';
            ctx.fillRect(startX, y - 6, endX - startX, 10);
            
            // Rivets
            ctx.fillStyle = '#4F4F4F';
            for (let x = startX; x < endX; x += 20) {
                ctx.beginPath();
                ctx.arc(x, y - 2, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Girders
            ctx.strokeStyle = '#696969';
            ctx.lineWidth = 3;
            for (let x = startX; x < endX; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, y - 6);
                ctx.lineTo(x + 20, y + 4);
                ctx.moveTo(x + 20, y - 6);
                ctx.lineTo(x, y + 4);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    });
}

function drawPickups() {
    // Fuel cans
    fuelPickups.forEach(p => {
        if (p.collected) return;
        const drawX = p.x - terrainOffset;
        const drawY = p.y;
        if (drawX < -50 || drawX > canvas.width + 50) return;

        ctx.save();
        ctx.fillStyle = '#f4a261';
        ctx.strokeStyle = '#e76f51';
        ctx.lineWidth = 2;
        ctx.fillRect(drawX - 8, drawY - 20, 16, 26);
        ctx.strokeRect(drawX - 8, drawY - 20, 16, 26);
        ctx.fillStyle = '#333';
        ctx.fillRect(drawX + 6, drawY - 16, 4, 6);
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f4a261';
        ctx.strokeRect(drawX - 8, drawY - 20, 16, 26);
        ctx.restore();
    });

    // Coins with shine
    coins.forEach(c => {
        if (c.collected) return;
        const drawX = c.x - terrainOffset;
        const drawY = c.y;
        if (drawX < -30 || drawX > canvas.width + 30) return;

        ctx.save();
        const gradient = ctx.createRadialGradient(drawX - 2, drawY - 2, 2, drawX, drawY, 10);
        gradient.addColorStop(0, '#FFF8DC');
        gradient.addColorStop(0.5, '#FFD700');
        gradient.addColorStop(1, '#B8860B');
        
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(drawX, drawY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Shine animation
        const shimmer = Math.sin(Date.now() * 0.005 + drawX * 0.1) * 0.3 + 0.7;
        ctx.globalAlpha = shimmer;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(drawX - 3, drawY - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawBoosts() {
    boosts.forEach(b => {
        if (b.collected) return;
        const drawX = b.x - terrainOffset;
        const drawY = b.y;
        if (drawX < -50 || drawX > canvas.width + 50) return;

        ctx.save();
        
        // Boost pad base
        const gradient = ctx.createLinearGradient(drawX - 25, drawY, drawX + 25, drawY);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 107, 107, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0.3)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(drawX - 25, drawY - 3, 50, 8);
        
        // Arrows
        const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#FFD93D';
        ctx.strokeStyle = '#FF6B6B';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 3; i++) {
            const offsetX = (i - 1) * 12;
            ctx.beginPath();
            ctx.moveTo(drawX + offsetX - 6, drawY - 8);
            ctx.lineTo(drawX + offsetX, drawY);
            ctx.lineTo(drawX + offsetX - 6, drawY + 8);
            ctx.lineTo(drawX + offsetX - 3, drawY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        
        // Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD93D';
        ctx.strokeRect(drawX - 25, drawY - 3, 50, 8);
        
        ctx.restore();
    });
}

function drawCar() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.rotation);

    // Enhanced car with better design
    const carGradient = ctx.createLinearGradient(-car.width / 2, -car.height, car.width / 2, car.height);
    carGradient.addColorStop(0, '#E53935');
    carGradient.addColorStop(1, '#C62828');

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.fillRect(-car.width / 2 + 3, car.height / 2 + 4, car.width - 6, 8);
    ctx.restore();

    // Chassis
    ctx.fillStyle = carGradient;
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 2;
    roundRect(ctx, -car.width / 2, -car.height / 2, car.width, car.height, 8, true, true);

    // Cabin
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath();
    ctx.moveTo(-car.width * 0.15, -car.height / 2);
    ctx.lineTo(car.width * 0.35, -car.height / 2);
    ctx.lineTo(car.width * 0.20, -car.height / 2 - 20);
    ctx.lineTo(-car.width * 0.05, -car.height / 2 - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Windows
    const windowGradient = ctx.createLinearGradient(0, -car.height / 2 - 15, 0, -car.height / 2 - 5);
    windowGradient.addColorStop(0, '#87CEEB');
    windowGradient.addColorStop(1, '#ADD8E6');
    ctx.fillStyle = windowGradient;
    ctx.fillRect(-car.width * 0.03, -car.height / 2 - 14, car.width * 0.15, 9);
    ctx.fillRect(car.width * 0.05, -car.height / 2 - 14, car.width * 0.15, 9);

    // Wheels with detail
    const wheelGradient = ctx.createRadialGradient(0, 0, 2, 0, 0, car.wheels.back.radius);
    wheelGradient.addColorStop(0, '#444');
    wheelGradient.addColorStop(1, '#111');
    
    ctx.fillStyle = wheelGradient;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    // Back wheel
    ctx.beginPath();
    ctx.arc(-car.width * 0.33, car.height / 2, car.wheels.back.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Rim
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(-car.width * 0.33, car.height / 2);
        ctx.lineTo(
            -car.width * 0.33 + Math.cos(angle) * 6,
            car.height / 2 + Math.sin(angle) * 6
        );
        ctx.stroke();
    }
    
    // Front wheel
    ctx.fillStyle = wheelGradient;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(car.width * 0.33, car.height / 2, car.wheels.front.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Rim
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(car.width * 0.33, car.height / 2);
        ctx.lineTo(
            car.width * 0.33 + Math.cos(angle) * 6,
            car.height / 2 + Math.sin(angle) * 6
        );
        ctx.stroke();
    }

    // Driver
    const driverRotation = -car.rotation * 0.2;
    const driverBob = Math.sin(Date.now() * 0.004) * Math.min(1.5, Math.abs(car.velocityX) * 0.03);
    
    ctx.save();
    ctx.translate(-car.width * 0.05, -car.height / 2 - 10 + driverBob);
    ctx.rotate(driverRotation);
    
    // Head
    const headGradient = ctx.createRadialGradient(-1, -5, 2, 0, -4, 6);
    headGradient.addColorStop(0, '#FFDAB9');
    headGradient.addColorStop(1, '#E6B89C');
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C9A58C';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Helmet detail
    ctx.fillStyle = '#FF5722';
    ctx.beginPath();
    ctx.arc(0, -5, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = '#3f51b5';
    ctx.fillRect(-6, 2, 12, 11);
    ctx.strokeStyle = '#303F9F';
    ctx.strokeRect(-6, 2, 12, 11);
    
    // Arms
    ctx.strokeStyle = '#3f51b5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-10, 8);
    ctx.moveTo(6, 4);
    ctx.lineTo(10, 8);
    ctx.stroke();
    
    ctx.restore();

    // Boost effect
    if (boostActive) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        const boostGradient = ctx.createLinearGradient(-car.width / 2, 0, -car.width / 2 - 30, 0);
        boostGradient.addColorStop(0, 'rgba(255, 107, 107, 0.8)');
        boostGradient.addColorStop(1, 'rgba(255, 215, 61, 0)');
        ctx.fillStyle = boostGradient;
        
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-car.width / 2, -8 + i * 8);
            ctx.lineTo(-car.width / 2 - 20, -5 + i * 8);
            ctx.lineTo(-car.width / 2 - 20, -11 + i * 8);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'undefined') radius = 5;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// ============================================
// UI UPDATE
// ============================================
function updateUI() {
    document.getElementById('scoreValue').textContent = Math.floor(score) + 'm';
    document.getElementById('levelValue').textContent = currentLevel;
    
    const fuelPercent = Math.max(0, (fuel / INITIAL_FUEL) * 100);
    document.getElementById('fuelValue').textContent = Math.floor(fuelPercent) + '%';
    
    const fuelBar = document.getElementById('fuelBar');
    fuelBar.style.width = fuelPercent + '%';
    
    fuelBar.classList.remove('low', 'critical');
    if (fuelPercent < 30) {
        fuelBar.classList.add('critical');
    } else if (fuelPercent < 50) {
        fuelBar.classList.add('low');
    }
    
    const speed = Math.abs(car.velocityX).toFixed(1);
    document.getElementById('speedValue').textContent = speed;
    document.getElementById('coinValue').textContent = coinCount;
}

// ============================================
// GAME STATES
// ============================================
function startGame() {
    gameState = 'playing';
    score = 0;
    fuel = INITIAL_FUEL;
    terrainOffset = 0;
    currentLevel = 1;
    currentBackgroundIndex = 0;
    nextBackgroundIndex = 0;
    backgroundTransition = 0;
    
    car.x = 200;
    car.y = 300;
    car.velocityX = 0;
    car.velocityY = 0;
    car.rotation = 0;
    car.angularVelocity = 0;
    car.onGround = false;
    
    keys.forward = false;
    keys.backward = false;
    keys.brake = false;
    
    fuelPickups = [];
    coins = [];
    boosts = [];
    coinCount = 0;
    terrainNoisePrev = 0;
    particles = [];
    boostActive = false;
    
    generateTerrain();
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    gameLoop();
}

function endGame(reason) {
    if (gameState !== 'playing') return;
    
    gameState = 'gameOver';
    
    document.getElementById('gameOverReason').textContent = reason;
    document.getElementById('finalScore').textContent = Math.floor(score) + 'm';
    document.getElementById('finalCoins').textContent = coinCount;
    document.getElementById('finalLevel').textContent = currentLevel;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
    if (gameState !== 'playing') return;
    
    updatePhysics();
    updateTerrain();
    checkPickups();
    updateBoost();
    updateParticles();
    updateLevel();
    updateBackground();
    updateUI();
    
    drawBackground();
    drawTerrain();
    drawBridges();
    drawBoosts();
    drawPickups();
    drawParticles();
    drawCar();
    
    requestAnimationFrame(gameLoop);
}

// ============================================
// EVENT LISTENERS
// ============================================
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', startGame);

// ============================================
// INITIALIZE
// ============================================
setupMobileControls();
generateTerrain();
drawBackground();
drawTerrain();
car.y = getTerrainHeightAt(car.x + terrainOffset) - car.height / 2 - car.wheels.front.radius;
updateWheelPositions();
drawCar();