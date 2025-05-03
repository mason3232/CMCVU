const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = {
  x: 50,
  y: 400,
  width: 30,
  height: 30,
  speed: 5,
  jumpForce: 12,
  gravity: 0.5,
  velocityY: 0,
  isJumping: false,
  doubleJumpAvailable: true,
  id: Math.random().toString(36).substr(2, 9),
  lastMoved: Date.now(),
  isInvisible: false,
  equippedItem: null,
  color: '#4CAF50'
};

let otherPlayers = {};
let currentLevel = 1;
let platforms = [];
let obstacles = [];
let leaderboard = [];

// Chat system
function addChatMessage(username, message) {
  const chatMessages = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.textContent = `${username}: ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    const message = e.target.value.trim();
    const username = document.getElementById('playerName').textContent;

    // Secret admin command
    if (message === '!2#4%6&8(') {
      const admins = JSON.parse(localStorage.getItem('admins') || '[]');
      if (!admins.includes(username)) {
        admins.push(username);
        localStorage.setItem('admins', JSON.stringify(admins));
        addChatMessage('System', `${username} is now an admin`);
      }
      e.target.value = '';
      return;
    }

    localStorage.setItem('chat_' + Date.now(), JSON.stringify({
      username,
      message,
      timestamp: Date.now()
    }));
    e.target.value = '';
  }
});

// Broadcast player position every 50ms
setInterval(() => {
  const playerData = {
    id: player.id,
    x: player.x,
    y: player.y,
    name: document.getElementById('playerName').textContent,
    lastMoved: player.lastMoved,
    equippedItem: player.equippedItem,
    color: player.color
  };
  localStorage.setItem('player_' + player.id, JSON.stringify(playerData));
}, 50);

// Check for new chat messages
setInterval(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('chat_')) {
      const data = JSON.parse(localStorage.getItem(key));
      if (data.timestamp > Date.now() - 1000) { // Only show messages from last second
        addChatMessage(data.username, data.message);
      }
      localStorage.removeItem(key); // Clean up old messages
    }
  }
}, 100);

// Update other players
setInterval(() => {
  const bannedPlayers = JSON.parse(localStorage.getItem('bannedPlayers') || '{}');

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('player_') && !key.includes(player.id)) {
      const data = JSON.parse(localStorage.getItem(key));
      // Only show players that aren't banned
      if (!bannedPlayers[data.name]) {
        otherPlayers[data.id] = data;
      } else {
        delete otherPlayers[data.id];
      }
    }
  }
}, 50);

function removePlayerFromLeaderboard(playerToRemove, reason, customDuration = 0) {
  leaderboard = leaderboard.filter(entry => entry.username !== playerToRemove);
  localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
  displayLeaderboard();

  // Get ban history
  const banHistory = JSON.parse(localStorage.getItem('banHistory') || '{}');
  if (!banHistory[playerToRemove]) {
    banHistory[playerToRemove] = { count: 0 };
  }
  banHistory[playerToRemove].count++;

  // Calculate ban duration
  let banDuration = customDuration;
  if (!customDuration && reason === "Exploiting") {
    banDuration = 3000 * Math.pow(10, banHistory[playerToRemove].count - 1); // 3s, 30s, 300s, etc.
  }

  // Store ban information
  const bannedPlayers = JSON.parse(localStorage.getItem('bannedPlayers') || '{}');
  bannedPlayers[playerToRemove] = {
    reason: reason,
    duration: banDuration,
    timestamp: Date.now()
  };

  localStorage.setItem('bannedPlayers', JSON.stringify(bannedPlayers));
  localStorage.setItem('banHistory', JSON.stringify(banHistory));

  // If the banned player is currently playing, kick them
  if (document.getElementById('playerName').textContent === playerToRemove) {
    displayBanScreen(reason, banDuration);
  }
}

function displayBanManagementMenu() {
  const menuDiv = document.createElement('div');
  menuDiv.id = 'banMenu';
  menuDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);padding:20px;border-radius:10px;z-index:9999;color:white;min-width:300px;';

  const bannedPlayers = JSON.parse(localStorage.getItem('bannedPlayers') || '{}');

  menuDiv.innerHTML = `
    <h2 style="margin:0 0 15px 0;color:#4CAF50">Ban Management</h2>
    <div id="bannedPlayersList" style="margin-bottom:15px;">
      <h3>Currently Banned Players:</h3>
      ${Object.entries(bannedPlayers).map(([player, info]) => `
        <div style="margin:5px 0;padding:5px;background:rgba(255,255,255,0.1);">
          ${player} - ${info.reason}
          <button onclick="unbanPlayer('${player}')" style="float:right;padding:2px 5px;background:#4CAF50">Unban</button>
        </div>
      `).join('') || '<p>No banned players</p>'}
    </div>
    <button onclick="this.parentElement.remove()" style="background:#ff4444">Close</button>
  `;

  document.body.appendChild(menuDiv);
}

function unbanPlayer(username) {
  const bannedPlayers = JSON.parse(localStorage.getItem('bannedPlayers') || '{}');
  delete bannedPlayers[username];
  localStorage.setItem('bannedPlayers', JSON.stringify(bannedPlayers));

  // Refresh the menu
  const oldMenu = document.getElementById('banMenu');
  if (oldMenu) {
    oldMenu.remove();
    displayBanManagementMenu();
  }
}

function displayBanScreen(reason, duration) {
  const banScreen = document.createElement('div');
  banScreen.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);padding:20px;border-radius:10px;z-index:9999;text-align:center;';
  const durationText = duration ? ` for ${duration/1000} seconds` : ' permanently';
  banScreen.innerHTML = `
    <h1 style="color:#ff0000;margin:0">You Have Been Banned</h1>
    <p style="color:#fff;margin:10px 0">Reason: ${reason}</p>
    <p style="color:#fff;margin:10px 0">Duration: ${durationText}</p>
  `;
  document.body.appendChild(banScreen);

  if (duration) {
    setTimeout(() => {
      const bannedPlayers = JSON.parse(localStorage.getItem('bannedPlayers') || '{}');
      delete bannedPlayers[document.getElementById('playerName').textContent];
      localStorage.setItem('bannedPlayers', JSON.stringify(bannedPlayers));
      banScreen.remove();
    }, duration);
  }

  // Remove player data from localStorage when banned
  localStorage.removeItem('player_' + player.id);
}

function updateLeaderboard(username, level) {
  leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
  const existingEntry = leaderboard.findIndex(entry => entry.username === username);

  if (existingEntry !== -1) {
    if (level > leaderboard[existingEntry].level) {
      leaderboard[existingEntry].level = level;
    }
  } else {
    leaderboard.push({ username, level });
  }

  leaderboard.sort((a, b) => b.level - a.level);
  localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
  displayLeaderboard();
}

function displayLeaderboard() {
  const leaderboardDiv = document.getElementById('leaderboard');
  leaderboardDiv.innerHTML = '<h2>Leaderboard</h2>';
  const filteredLeaderboard = leaderboard.filter(entry => entry.username.toLowerCase() !== 'salerno');
  filteredLeaderboard.slice(0, 10).forEach((entry, index) => {
    leaderboardDiv.innerHTML += `<div>${index + 1}. ${entry.username}: Level ${entry.level}</div>`;
  });
}

function startGame() {
  const username = document.getElementById('username').value;
  if (!username) {
    alert('Please enter a username!');
    return;
  }

  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  document.getElementById('playerName').textContent = username;

  canvas.width = 800;
  canvas.height = 600;

  generateLevel(currentLevel);
  gameLoop();
}

function generateLevel(level) {
  const version = document.getElementById('version').value;
  platforms = [
    { x: 0, y: 550, width: 800, height: 50 } // Ground
  ];

  let platformCount = level + 2;
  let platformWidth = 100;
  let movingPlatforms = false;

  // Version-specific features
  if (version >= '1.1') {
    platformCount += 2; // More platforms in v1.1
    platformWidth = 80; // Smaller platforms for increased difficulty
  }

  if (version >= '1.2') {
    platformCount += 3; // Even more platforms in v1.2
    movingPlatforms = true; // Moving platforms feature
  }

  if (version >= '1.4') {
    platformCount += 4; // Additional platforms in v1.4
    player.jumpForce = 13; // Stronger jump
    player.speed = 6; // Faster movement
  }
  if (version >= '1.5.1') {
    platformCount += 5; // Additional platforms in v1.4
    player.jumpForce = 13; // Stronger jump
    player.speed = 4; // Faster movement
  }

  // Add platforms based on level and version
  for (let i = 0; i < platformCount; i++) {
    let platform = {
      x: Math.random() * (canvas.width - platformWidth),
      y: Math.random() * (canvas.height - 200) + 100,
      width: platformWidth,
      height: 20
    };

    if (movingPlatforms && i % 2 === 0) {
      platform.isMoving = true;
      platform.moveSpeed = version >= '1.4' ? 2.5 : 2;
      platform.moveRange = version >= '1.4' ? 150 : 100;
      platform.startX = platform.x;
      platform.direction = 1;
      platform.movePattern = version >= '1.4' ? (i % 3) : 0; // Different movement patterns in v1.4
    }
    if (movingPlatforms && i % 5 === 0) {
      platform.isMoving = true;
      platform.moveSpeed = version >= '1.5.1' ? 2.5 : 2;
      platform.moveRange = version >= '1.5.1' ? 150 : 100;
      platform.startX = platform.x;
      platform.direction = 1.69;
      platform.movePattern = version >= '1.5.1' ? (i % 7) : 0; // Different movement patterns in v1.4
    }

    platforms.push(platform);
  }

  // Add obstacles
  obstacles = [];
  const obstacleCount = Math.min(currentLevel + 1, 8); // More obstacles as levels progress
  for (let i = 0; i < obstacleCount; i++) {
    obstacles.push({
      x: Math.random() * (canvas.width - 30),
      y: Math.random() * (canvas.height - 200) + 100,
      width: 30,
      height: 30
    });
  }

  // Add checkpoint above a random platform (except ground) with increasing height based on level
  const randomPlatform = platforms[Math.floor(Math.random() * (platforms.length - 1)) + 1];
  const checkpointHeight = Math.min(50 + (currentLevel * 2), 150); // Increase height with level, max 150px
  platforms.push({
    x: randomPlatform.x + (randomPlatform.width / 2) - 15,
    y: randomPlatform.y - checkpointHeight,
    width: 30,
    height: 30,
    isCheckpoint: true,
    isCircle: true
  });
}

function drawPlayer() {
  if (!player.isInvisible) {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    if (player.equippedItem) {
      ctx.font = '12px Arial';
      ctx.fillStyle = '#FFF';
      ctx.fillText(player.equippedItem.name, player.x - 10, player.y - 5);
    }
  }
}

function drawObstacles() {
  ctx.fillStyle = '#FF0000';
  obstacles.forEach(obstacle => {
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  });
}

function drawPlatforms() {
  platforms.forEach(platform => {
    if (platform.isCheckpoint) {
      ctx.fillStyle = '#FFD700'; // Gold color for checkpoint
      if (platform.isCircle) {
        ctx.beginPath();
        ctx.arc(platform.x + platform.width/2, platform.y + platform.height/2, platform.width/2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#666';
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    }
  });
}

function checkCollision(player, platform) {
  return player.x < platform.x + platform.width &&
         player.x + player.width > platform.x &&
         player.y < platform.y + platform.height &&
         player.y + player.height > platform.y;
}

function handleMovement() {
  // Check if player moved
  if (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.Space || player.velocityY !== 0) {
    player.lastMoved = Date.now();
    player.isInvisible = false;
  } else if (Date.now() - player.lastMoved >= 60000) { // 60 seconds
    player.isInvisible = true;
  }

  // Check if player is banned
  const bannedPlayers = JSON.parse(localStorage.getItem('bannedPlayers') || '{}');
  const currentPlayer = document.getElementById('playerName').textContent;
  if (bannedPlayers[currentPlayer]) {
    const banInfo = bannedPlayers[currentPlayer];
    if (banInfo.duration && Date.now() - banInfo.timestamp >= banInfo.duration) {
      delete bannedPlayers[currentPlayer];
      localStorage.setItem('bannedPlayers', JSON.stringify(bannedPlayers));
    } else if (!document.getElementById('banNotice')) {
      displayBanScreen(banInfo.reason, banInfo.duration);
    }
    return; // Stop all movement if banned
  }

  // Check obstacle collision
  obstacles.forEach(obstacle => {
    if (checkCollision(player, obstacle) && !isGodMode) {
      currentLevel = 1;
      player.x = 50;
      player.y = 400;
      document.getElementById('levelDisplay').textContent = currentLevel;
      generateLevel(currentLevel);
    }
  });

  if (keys.ArrowLeft) player.x -= player.speed;
  if (keys.ArrowRight) player.x += player.speed;

  player.velocityY += player.gravity;
  player.y += player.velocityY;

  // Handle moving platforms
  platforms.forEach(platform => {
    if (platform.isMoving) {
      if (platform.movePattern === 1) {
        platform.x = platform.startX + Math.cos(Date.now() * 0.004) * platform.moveRange;
      } else if (platform.movePattern === 2) {
        platform.x = platform.startX + Math.tan(Date.now() * 0.001) * (platform.moveRange / 2);
      } else {
        platform.x = platform.startX + Math.sin(Date.now() * 0.003) * platform.moveRange;
      }
    }
  });

  // Platform collision
  platforms.forEach(platform => {
    if (checkCollision(player, platform)) {
      if (platform.isCheckpoint) {
        currentLevel++;
        document.getElementById('levelDisplay').textContent = currentLevel;
        updateLeaderboard(document.getElementById('playerName').textContent, currentLevel);
        player.x = 50;
        player.y = 400;
        generateLevel(currentLevel);
      }
      if (player.velocityY > 0) {
        player.isJumping = false;
        player.doubleJumpAvailable = true;
        player.velocityY = 0;
        player.y = platform.y - player.height;
      }
    }
  });

  // Screen boundaries
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}

let keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);
function handleJump() {
  if (!player.isJumping) {
    player.velocityY = -player.jumpForce;
    player.isJumping = true;
    player.doubleJumpAvailable = true;
  } else if (player.doubleJumpAvailable) {
    player.velocityY = -player.jumpForce;
    player.doubleJumpAvailable = false;
  }
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyB') {
    displayShopMenu();
  }
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    handleJump();
  }
  if (e.code === 'KeyE') {
    const admins = JSON.parse(localStorage.getItem('admins') || '[]');
    const currentPlayer = document.getElementById('playerName').textContent;
    if (currentPlayer === "salerno" || currentPlayer === "salerno69" || admins.includes(currentPlayer)) {
      displayBanManagementMenu();
    }
  }
  if (e.code === 'KeyQ') {
    const admins = JSON.parse(localStorage.getItem('admins') || '[]');
    const currentPlayer = document.getElementById('playerName').textContent;
    if (currentPlayer === "salerno" || currentPlayer === "salerno69" || admins.includes(currentPlayer)) {
      const newLevel = parseInt(prompt("Enter your desired level:"));
      if (!isNaN(newLevel) && newLevel > 0) {
        currentLevel = newLevel;
        document.getElementById('levelDisplay').textContent = currentLevel;
        updateLeaderboard(currentPlayer, currentLevel);
      }
    }
  }
  if (e.code === 'KeyR') {
    const admins = JSON.parse(localStorage.getItem('admins') || '[]');
    const currentPlayer = document.getElementById('playerName').textContent;
    if (currentPlayer === "salerno" || currentPlayer === "salerno69" || admins.includes(currentPlayer)) {
      displayAdminAbilitiesMenu();
    }
  }
  if (e.code === 'KeyT') {
    const admins = JSON.parse(localStorage.getItem('admins') || '[]');
    const currentPlayer = document.getElementById('playerName').textContent;
    if (currentPlayer === "salerno" || currentPlayer === "salerno69" || admins.includes(currentPlayer)) {
      const playerToBan = prompt("Enter player name to ban:");
      if (playerToBan) {
        const reason = prompt("Enter ban reason:");
        const duration = parseInt(prompt("Enter ban duration in seconds (0 for permanent):"));
        if (reason && !isNaN(duration)) {
          removePlayerFromLeaderboard(playerToBan, reason, duration * 1000);
        }
      }
    }
  }
});

const shopItems = [
  { name: 'Golden Crown', color: '#FFD700', cost: 2 },
  { name: 'Blue Cape', color: '#1E90FF', cost: 2 },
  { name: 'Red Armor', color: '#FF4444', cost: 2 },
  { name: 'Purple Hat', color: '#9932CC', cost: 2 }
];

function displayShopMenu() {
  const menuDiv = document.createElement('div');
  menuDiv.id = 'shopMenu';
  menuDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);padding:20px;border-radius:10px;z-index:9999;color:white;min-width:300px;';

  let itemsHtml = '';
  shopItems.forEach(item => {
    itemsHtml += `
      <button onclick="equipItem('${item.name}')" style="background:${item.color};margin:5px;width:100%">
        ${item.name} (Cost: ${item.cost} levels)
      </button>
    `;
  });

  menuDiv.innerHTML = `
    <h2 style="margin:0 0 15px 0;color:#4CAF50">Item Shop</h2>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${itemsHtml}
      <button onclick="unequipItem()" style="background:#666">Unequip Item</button>
    </div>
    <button onclick="this.parentElement.remove()" style="background:#ff4444;margin-top:15px">Close</button>
  `;

  document.body.appendChild(menuDiv);
}

function equipItem(itemName) {
  if (currentLevel < 2) {
    alert('You need at least 2 levels to equip items!');
    return;
  }

  const item = shopItems.find(i => i.name === itemName);
  if (item) {
    player.equippedItem = item;
    player.color = item.color;
    currentLevel -= 2;
    document.getElementById('levelDisplay').textContent = currentLevel;
  }

  const menuDiv = document.getElementById('shopMenu');
  if (menuDiv) menuDiv.remove();
}

function unequipItem() {
  player.equippedItem = null;
  player.color = '#4CAF50';
  const menuDiv = document.getElementById('shopMenu');
  if (menuDiv) menuDiv.remove();
}

function displayAdminAbilitiesMenu() {
  const menuDiv = document.createElement('div');
  menuDiv.id = 'adminMenu';
  menuDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);padding:20px;border-radius:10px;z-index:9999;color:white;min-width:300px;';

  menuDiv.innerHTML = `
    <h2 style="margin:0 0 15px 0;color:#4CAF50">Admin Special Abilities</h2>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button onclick="toggleInvisibility()" style="background:#4CAF50">Toggle Invisibility</button>
      <button onclick="teleportToStart()" style="background:#2196F3">Teleport to Start</button>
      <button onclick="superJump()" style="background:#9C27B0">Toggle Super Jump</button>
      <button onclick="toggleGodMode()" style="background:#F44336">Toggle God Mode</button>
    </div>
    <button onclick="this.parentElement.remove()" style="background:#ff4444;margin-top:15px">Close</button>
  `;

  document.body.appendChild(menuDiv);
}

let isGodMode = false;
let isSuperJumpEnabled = false;

function toggleInvisibility() {
  player.isInvisible = !player.isInvisible;
}

function teleportToStart() {
  player.x = 50;
  player.y = 400;
}

function superJump() {
  isSuperJumpEnabled = !isSuperJumpEnabled;
  player.jumpForce = isSuperJumpEnabled ? 20 : 13;
}

function toggleGodMode() {
  isGodMode = !isGodMode;
}

function drawOtherPlayers() {
  Object.values(otherPlayers).forEach(otherPlayer => {
    // Only draw if player has moved in the last 60 seconds
    if (Date.now() - otherPlayer.lastMoved < 60000) {
      ctx.fillStyle = otherPlayer.color || '#FF6B6B';
      ctx.fillRect(otherPlayer.x, otherPlayer.y, player.width, player.height);
      ctx.fillStyle = '#FFF';
      ctx.font = '12px Arial';
      ctx.fillText(otherPlayer.name, otherPlayer.x, otherPlayer.y - 5);
      if (otherPlayer.equippedItem) {
        ctx.fillText(otherPlayer.equippedItem.name, otherPlayer.x - 10, otherPlayer.y - 20);
      }
    }
  });
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  handleMovement();
  drawPlatforms();
  drawObstacles();
  drawOtherPlayers();
  drawPlayer();

  requestAnimationFrame(gameLoop);
}