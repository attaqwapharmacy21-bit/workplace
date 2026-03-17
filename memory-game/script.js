/*
  Memory Card Game
  - Uses vanilla JavaScript, CSS Grid, and transform animations.
  - No external libraries.
*/

const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const movesElement = document.getElementById('moves');
const timerElement = document.getElementById('timer');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const winModal = document.getElementById('winModal');
const finalStats = document.getElementById('finalStats');

const difficultyButtons = document.querySelectorAll('.difficulty-btn');

const difficultyConfig = {
  easy: { pairs: 4, pointsPerMatch: 20, penalty: 5 },
  medium: { pairs: 6, pointsPerMatch: 35, penalty: 10 },
  hard: { pairs: 8, pointsPerMatch: 50, penalty: 15 },
};

let difficulty = 'easy';
let cards = [];
let firstCard = null;
let secondCard = null;
let isBoardLocked = false;
let matchesFound = 0;
let moves = 0;
let score = 0;
let timerInterval = null;
let secondsPassed = 0;
let timerStarted = false;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateStats() {
  scoreElement.textContent = score;
  movesElement.textContent = moves;
  timerElement.textContent = formatTime(secondsPassed);
}

function startTimer() {
  if (timerStarted) return;
  timerStarted = true;
  timerInterval = setInterval(() => {
    secondsPassed += 1;
    timerElement.textContent = formatTime(secondsPassed);
  }, 1000);
}

function stopTimer() {
  timerStarted = false;
  clearInterval(timerInterval);
}

function resetTimer() {
  stopTimer();
  secondsPassed = 0;
  timerElement.textContent = formatTime(secondsPassed);
}

function setActiveDifficultyButton() {
  difficultyButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.difficulty === difficulty);
  });
}

function getIconList(pairCount) {
  const icons = [
    '🧠',
    '🚀',
    '🌟',
    '🎮',
    '🧩',
    '⚡',
    '🍀',
    '🎯',
    '🎵',
    '🛡️',
    '💎',
    '🔥',
    '🍏',
    '🐉',
    '🌈',
    '🧲',
  ];

  // Shuffle a copy and take required number of icons
  const copy = [...icons].sort(() => Math.random() - 0.5);
  return copy.slice(0, pairCount);
}

function buildCards() {
  const { pairs } = difficultyConfig[difficulty];
  const icons = getIconList(pairs);

  // Create two card objects for each icon
  cards = icons.flatMap((icon) => [
    { id: crypto.randomUUID(), icon, matched: false },
    { id: crypto.randomUUID(), icon, matched: false },
  ]);

  // Shuffle cards
  cards.sort(() => Math.random() - 0.5);
}

function createCardElement(cardData) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.dataset.id = cardData.id;
  card.dataset.icon = cardData.icon;

  const inner = document.createElement('div');
  inner.className = 'card__inner';

  const front = document.createElement('div');
  front.className = 'card__face card__face--front';

  // Use a styled span to render the icon, making it look like a polished image.
  const icon = document.createElement('span');
  icon.className = 'card-icon';
  icon.textContent = cardData.icon;
  front.appendChild(icon);

  const back = document.createElement('div');
  back.className = 'card__face card__face--back';

  inner.append(back, front);
  card.appendChild(inner);

  card.addEventListener('click', () => handleCardClick(card));

  return card;
}

function renderBoard() {
  boardElement.innerHTML = '';
  const { pairs } = difficultyConfig[difficulty];

  const columns = pairs <= 4 ? 4 : pairs === 6 ? 4 : 4;
  const rows = Math.ceil((pairs * 2) / columns);

  boardElement.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  boardElement.style.gridTemplateRows = `repeat(${rows}, auto)`;

  cards.forEach((card) => {
    const cardElement = createCardElement(card);
    boardElement.appendChild(cardElement);
  });
}

function lockBoard() {
  isBoardLocked = true;
  document.querySelectorAll('.card').forEach((c) => c.classList.add('disabled'));
}

function unlockBoard() {
  isBoardLocked = false;
  document.querySelectorAll('.card').forEach((c) => c.classList.remove('disabled'));
  // Keep matched cards disabled
  document.querySelectorAll('.card[data-matched="true"]').forEach((c) => {
    c.classList.add('disabled');
  });
}

function checkForMatch() {
  const isMatch = firstCard.dataset.icon === secondCard.dataset.icon;

  if (isMatch) {
    firstCard.dataset.matched = 'true';
    secondCard.dataset.matched = 'true';
    firstCard.classList.add('disabled');
    secondCard.classList.add('disabled');
    matchesFound += 1;

    const points = difficultyConfig[difficulty].pointsPerMatch;
    score += points;
    updateStats();

    // Unlock the board so the player can continue matching other cards.
    // Matched cards remain disabled via the `data-matched` attribute.
    unlockBoard();
    resetSelection();

    if (matchesFound === difficultyConfig[difficulty].pairs) {
      endGame();
    }
  } else {
    const penalty = difficultyConfig[difficulty].penalty;
    score = Math.max(0, score - penalty);
    updateStats();

    lockBoard();
    setTimeout(() => {
      firstCard.classList.remove('flipped');
      secondCard.classList.remove('flipped');
      resetSelection();
      unlockBoard();
    }, 1000);
  }
}

function resetSelection() {
  [firstCard, secondCard] = [null, null];
}

function handleCardClick(cardElement) {
  if (isBoardLocked) return;
  if (cardElement === firstCard) return; // Clicking same card twice doesn't count
  if (cardElement.dataset.matched === 'true') return;

  if (!timerStarted) {
    startTimer();
  }

  cardElement.classList.add('flipped');

  if (!firstCard) {
    firstCard = cardElement;
    return;
  }

  secondCard = cardElement;
  moves += 1;
  updateStats();
  lockBoard();

  checkForMatch();
}

function resetGameState() {
  stopTimer();
  timerStarted = false;
  matchesFound = 0;
  moves = 0;
  score = 0;
  isBoardLocked = false;
  resetSelection();
  resetTimer();
  updateStats();
  winModal.classList.remove('show');
  document.body.classList.remove('game-won');
}

function setDifficulty(newDifficulty) {
  difficulty = newDifficulty;
  setActiveDifficultyButton();
  resetGameState();
  buildCards();
  renderBoard();
}

function endGame() {
  stopTimer();
  const timeText = formatTime(secondsPassed);
  finalStats.textContent = `Final Score: ${score} • Moves: ${moves} • Time: ${timeText}`;
  winModal.classList.add('show');
  winModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('game-won');
}

function resetBoardAndStart() {
  resetGameState();
  buildCards();
  renderBoard();
}

function init() {
  difficultyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const level = button.dataset.difficulty;
      if (level === difficulty) return;
      setDifficulty(level);
    });
  });

  restartBtn.addEventListener('click', () => {
    resetBoardAndStart();
  });

  playAgainBtn.addEventListener('click', () => {
    winModal.classList.remove('show');
    winModal.setAttribute('aria-hidden', 'true');
    resetBoardAndStart();
  });

  // Start with default difficulty
  setActiveDifficultyButton();
  buildCards();
  renderBoard();
  updateStats();
}

init();
