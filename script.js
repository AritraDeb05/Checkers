// Checkers / Draughts Master Game Engine

const BOARD_SIZE = 8;
let board = [];
let currentPlayer = 'p1'; // 'p1' = Bottom Player, 'p2' = Top Player
let selectedPiece = null;
let mustJump = false;
let multiJumpPiece = null;
let gameOver = false;
let gameMode = 'feed-first'; // 'feed-first' | 'strategic'
let currentTheme = 'red-white';
let soundEnabled = true;
let showCoordinates = true;

// Move History & Captured Tracking
let moveHistory = []; // Array of { turnNumber, p1Move, p2Move }
let p1Captures = [];  // Captured pieces by P1 (i.e. P2 pieces lost)
let p2Captures = [];  // Captured pieces by P2 (i.e. P1 pieces lost)
let historyStack = []; // State stack for Undo functionality

// Sound Synthesizer via Web Audio API
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'capture') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'king') {
      // Ascending chord flourish
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + i * 0.08);
        g.gain.setValueAtTime(0.25, now + i * 0.08);
        g.gain.linearRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
        o.start(now + i * 0.08);
        o.stop(now + i * 0.08 + 0.2);
      });
    } else if (type === 'win') {
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.3, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.3);
      });
    }
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
}

// Convert Row/Col to Chess Notation (e.g. r=7, c=0 -> 'a1')
function getNotation(r, c) {
  const colName = String.fromCharCode(97 + c);
  const rowName = 8 - r;
  return `${colName}${rowName}`;
}

// Initialize board state
function initBoard() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) row.push({ player: 'p2', king: false });
        else if (r > 4) row.push({ player: 'p1', king: false });
        else row.push(null);
      } else {
        row.push(null);
      }
    }
    board.push(row);
  }
}

// Deep clone board state for undo history
function cloneState() {
  return {
    board: JSON.parse(JSON.stringify(board)),
    currentPlayer,
    selectedPiece: selectedPiece ? { ...selectedPiece } : null,
    mustJump,
    multiJumpPiece: multiJumpPiece ? { ...multiJumpPiece } : null,
    gameOver,
    moveHistory: JSON.parse(JSON.stringify(moveHistory)),
    p1Captures: JSON.parse(JSON.stringify(p1Captures)),
    p2Captures: JSON.parse(JSON.stringify(p2Captures))
  };
}

function saveStateToUndo() {
  historyStack.push(cloneState());
  if (historyStack.length > 30) historyStack.shift(); // Limit undo stack size
  document.getElementById('undo-btn').disabled = historyStack.length === 0;
}

function undoMove() {
  if (historyStack.length === 0) return;
  const previousState = historyStack.pop();
  board = previousState.board;
  currentPlayer = previousState.currentPlayer;
  selectedPiece = previousState.selectedPiece;
  mustJump = previousState.mustJump;
  multiJumpPiece = previousState.multiJumpPiece;
  gameOver = previousState.gameOver;
  moveHistory = previousState.moveHistory;
  p1Captures = previousState.p1Captures;
  p2Captures = previousState.p2Captures;

  document.getElementById('undo-btn').disabled = historyStack.length === 0;
  updateStatus();
  renderBoard();
  renderHistoryTable();
  renderCaptures();
}

// Check valid moves and jumps for a piece at (r, c)
function getValidMoves(r, c) {
  const piece = board[r][c];
  if (!piece) return { moves: [], jumps: [] };

  const moves = [];
  const jumps = [];
  // P1 moves UP (-1), P2 moves DOWN (+1)
  const directions = piece.king ? [-1, 1] : (piece.player === 'p1' ? [-1] : [1]);

  for (const dr of directions) {
    for (const dc of [-1, 1]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (!board[nr][nc]) {
          moves.push({ r: nr, c: nc });
        } else if (board[nr][nc].player !== piece.player) {
          const jr = r + dr * 2, jc = c + dc * 2;
          if (jr >= 0 && jr < BOARD_SIZE && jc >= 0 && jc < BOARD_SIZE && !board[jr][jc]) {
            jumps.push({ r: jr, c: jc, captureR: nr, captureC: nc });
          }
        }
      }
    }
  }
  return { moves, jumps };
}

// Check if player has any mandatory jump available anywhere on board
function hasAnyJumps(player) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p && p.player === player) {
        const { jumps } = getValidMoves(r, c);
        if (jumps.length > 0) return true;
      }
    }
  }
  return false;
}

function renderBoard() {
  const container = document.getElementById('board');
  container.innerHTML = '';

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      const isDark = (r + c) % 2 === 1;
      cell.className = 'cell ' + (isDark ? 'dark' : 'light');
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Coordinate badge inside dark cell
      if (isDark) {
        const coordLabel = document.createElement('span');
        coordLabel.className = 'cell-coord';
        coordLabel.textContent = getNotation(r, c);
        cell.appendChild(coordLabel);
      }

      if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
        cell.classList.add('selected');
      }

      const piece = board[r][c];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `piece ${piece.player}`;
        if (piece.king) {
          pieceEl.classList.add('king');
          const crown = document.createElement('span');
          crown.className = 'crown-icon-sm';
          crown.textContent = '♔';
          pieceEl.appendChild(crown);
        }
        cell.appendChild(pieceEl);
      }

      cell.onclick = () => handleCellClick(r, c);
      container.appendChild(cell);
    }
  }
  highlightValidMoves();
}

function highlightValidMoves() {
  if (!selectedPiece) return;
  const { moves, jumps } = getValidMoves(selectedPiece.r, selectedPiece.c);
  
  let valid = [];
  if (multiJumpPiece) {
    valid = jumps;
  } else if (gameMode === 'feed-first') {
    valid = mustJump ? jumps : (jumps.length > 0 ? jumps : moves);
  } else { // 'strategic' mode
    valid = [...jumps, ...moves];
  }

  const cells = document.getElementById('board').children;
  for (const m of valid) {
    const idx = m.r * BOARD_SIZE + m.c;
    const dot = document.createElement('div');
    const isJump = jumps.some(j => j.r === m.r && j.c === m.c);
    dot.className = 'hint ' + (isJump ? 'jump' : 'move');
    cells[idx].appendChild(dot);
  }
}

function handleCellClick(r, c) {
  if (gameOver) return;
  const piece = board[r][c];

  // 1. If clicking an own piece
  if (piece && piece.player === currentPlayer) {
    // If in middle of a multi-jump sequence, player CANNOT select a different piece
    if (multiJumpPiece && (r !== multiJumpPiece.r || c !== multiJumpPiece.c)) {
      return;
    }

    // In Feed-First mode, if a jump is mandatory, only allow selecting pieces that can jump
    if (gameMode === 'feed-first' && mustJump) {
      const { jumps } = getValidMoves(r, c);
      if (jumps.length === 0) return;
    }

    selectedPiece = { r, c };
    renderBoard();
    return;
  }

  // 2. If no piece selected, cannot move
  if (!selectedPiece) return;

  // 3. Compute valid moves for the selected piece
  const { moves, jumps } = getValidMoves(selectedPiece.r, selectedPiece.c);
  const targetJump = jumps.find(j => j.r === r && j.c === c);
  const targetMove = moves.find(m => m.r === r && m.c === c);

  if (!targetJump && !targetMove) return;

  // If multi-jump in progress or in Feed-First mode with mandatory jump: only jumps are valid!
  const isMultiJumpStep = !!multiJumpPiece;
  if ((isMultiJumpStep || (gameMode === 'feed-first' && mustJump)) && !targetJump) {
    return;
  }

  // 4. Save state before making the move
  saveStateToUndo();

  const isJump = !!targetJump;
  const startNotation = getNotation(selectedPiece.r, selectedPiece.c);
  const endNotation = getNotation(r, c);

  // 5. Execute move on board
  board[r][c] = board[selectedPiece.r][selectedPiece.c];
  board[selectedPiece.r][selectedPiece.c] = null;

  if (isJump) {
    const capturedPieceInfo = board[targetJump.captureR][targetJump.captureC];
    board[targetJump.captureR][targetJump.captureC] = null;
    if (currentPlayer === 'p1') p1Captures.push(capturedPieceInfo);
    else p2Captures.push(capturedPieceInfo);
    renderCaptures();
  }

  // 6. Promotion check
  const movedPiece = board[r][c];
  let promotedThisTurn = false;
  if (!movedPiece.king) {
    if (movedPiece.player === 'p1' && r === 0) {
      movedPiece.king = true;
      promotedThisTurn = true;
    } else if (movedPiece.player === 'p2' && r === BOARD_SIZE - 1) {
      movedPiece.king = true;
      promotedThisTurn = true;
    }
  }

  // 7. Audio feedback
  if (promotedThisTurn) playSound('king');
  else if (isJump) playSound('capture');
  else playSound('move');

  // 8. Record move history notation
  if (isMultiJumpStep) {
    recordMove(currentPlayer, `${endNotation}${promotedThisTurn ? '♔' : ''}`, true);
  } else {
    const moveStr = `${startNotation}${isJump ? 'x' : '-'}${endNotation}${promotedThisTurn ? '♔' : ''}`;
    recordMove(currentPlayer, moveStr, false);
  }

  // 9. Multi-jump check
  // Note: If a piece is promoted to King on a jump, standard Checkers rules state turn ends immediately.
  if (isJump && !promotedThisTurn) {
    const { jumps: moreJumps } = getValidMoves(r, c);
    if (moreJumps.length > 0) {
      selectedPiece = { r, c };
      multiJumpPiece = { r, c };
      mustJump = true;
      renderBoard();
      updateStatus();
      return; // Keep turn active for next jump!
    }
  }

  // 10. End of turn: Reset multi-jump state and switch player
  multiJumpPiece = null;
  selectedPiece = null;
  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';

  mustJump = (gameMode === 'feed-first') ? hasAnyJumps(currentPlayer) : false;

  updateStatus();
  renderBoard();
  checkWin();
}

function recordMove(player, moveNotation, isMultiJumpAppend = false) {
  if (isMultiJumpAppend) {
    if (moveHistory.length > 0) {
      const lastTurn = moveHistory[moveHistory.length - 1];
      if (player === 'p1') {
        lastTurn.p1Move += `x${moveNotation}`;
      } else {
        lastTurn.p2Move += `x${moveNotation}`;
      }
    }
    renderHistoryTable();
    return;
  }
  if (player === 'p1') {
    moveHistory.push({
      turnNumber: moveHistory.length + 1,
      p1Move: moveNotation,
      p2Move: '-'
    });
  } else {
    if (moveHistory.length > 0 && moveHistory[moveHistory.length - 1].p2Move === '-') {
      moveHistory[moveHistory.length - 1].p2Move = moveNotation;
    } else {
      moveHistory.push({
        turnNumber: moveHistory.length + 1,
        p1Move: '-',
        p2Move: moveNotation
      });
    }
  }
  renderHistoryTable();
}

function renderHistoryTable() {
  const tbody = document.getElementById('history-list');
  tbody.innerHTML = '';

  if (moveHistory.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No moves recorded yet</td></tr>';
    document.getElementById('total-moves-count').textContent = '0 moves';
    return;
  }

  document.getElementById('total-moves-count').textContent = `${moveHistory.length} turns`;

  moveHistory.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.turnNumber}</td>
      <td>${item.p1Move}</td>
      <td>${item.p2Move}</td>
    `;
    tbody.appendChild(tr);
  });

  // Auto scroll table to bottom
  const container = document.querySelector('.history-table-container');
  container.scrollTop = container.scrollHeight;
}

function renderCaptures() {
  const p1Container = document.getElementById('p1-captures');
  const p2Container = document.getElementById('p2-captures');

  p1Container.innerHTML = '';
  p2Container.innerHTML = '';

  p1Captures.forEach(piece => {
    const el = document.createElement('span');
    el.className = 'mini-piece p2' + (piece.king ? ' king' : '');
    p1Container.appendChild(el);
  });

  p2Captures.forEach(piece => {
    const el = document.createElement('span');
    el.className = 'mini-piece p1' + (piece.king ? ' king' : '');
    p2Container.appendChild(el);
  });
}

function checkWin() {
  let p1Count = 0, p2Count = 0;
  let p1Moves = 0, p2Moves = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p) {
        const { moves, jumps } = getValidMoves(r, c);
        const total = moves.length + jumps.length;
        if (p.player === 'p1') {
          p1Count++;
          p1Moves += total;
        } else {
          p2Count++;
          p2Moves += total;
        }
      }
    }
  }

  const p1Name = getPlayerName('p1');
  const p2Name = getPlayerName('p2');

  if (p1Count === 0 || p1Moves === 0) {
    gameOver = true;
    playSound('win');
    showWinner(`${p2Name} Wins! 🏆`);
    return;
  }
  if (p2Count === 0 || p2Moves === 0) {
    gameOver = true;
    playSound('win');
    showWinner(`${p1Name} Wins! 🏆`);
    return;
  }
}

function showWinner(wText) {
  const banner = document.getElementById('status-banner');
  banner.className = 'status-banner win-banner';
  document.getElementById('status-icon').textContent = '🏆';
  document.getElementById('status-text').textContent = wText;

  document.getElementById('p1-card').classList.remove('active-turn');
  document.getElementById('p2-card').classList.remove('active-turn');
}

function getPlayerName(player) {
  const p1Names = { 'red-white': 'Red', 'black-white': 'Black', 'brown-white': 'Brown' };
  return player === 'p1' ? p1Names[currentTheme] : 'White';
}

function updateStatus() {
  if (gameOver) return;

  const banner = document.getElementById('status-banner');
  const icon = document.getElementById('status-icon');
  const text = document.getElementById('status-text');

  const p1Name = getPlayerName('p1');
  const p2Name = getPlayerName('p2');
  const currentName = currentPlayer === 'p1' ? p1Name : p2Name;

  const p1Card = document.getElementById('p1-card');
  const p2Card = document.getElementById('p2-card');

  if (currentPlayer === 'p1') {
    banner.className = 'status-banner p1-turn';
    p1Card.classList.add('active-turn');
    p2Card.classList.remove('active-turn');
    document.getElementById('p1-status-badge').textContent = 'Active Turn';
    document.getElementById('p2-status-badge').textContent = 'Waiting';
  } else {
    banner.className = 'status-banner p2-turn';
    p2Card.classList.add('active-turn');
    p1Card.classList.remove('active-turn');
    document.getElementById('p2-status-badge').textContent = 'Active Turn';
    document.getElementById('p1-status-badge').textContent = 'Waiting';
  }

  icon.textContent = (gameMode === 'feed-first' && mustJump) ? '🔥' : '👉';
  text.textContent = `${currentName}'s Turn` + (mustJump ? ' (Jump Required!)' : '');
}

// Control Bar Handlers
function changeGameMode(mode) {
  gameMode = mode;
  mustJump = gameMode === 'feed-first' ? hasAnyJumps(currentPlayer) : false;
  updateStatus();
  renderBoard();
}

function changeTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  
  const p1Name = getPlayerName('p1');
  document.getElementById('p1-name').textContent = p1Name;
  document.getElementById('p2-name').textContent = 'White';
  document.getElementById('th-p1').textContent = p1Name;
  document.getElementById('th-p2').textContent = 'White';

  updateStatus();
  renderBoard();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const icon = document.getElementById('sound-icon');
  icon.textContent = soundEnabled ? '🔊' : '🔇';
  document.getElementById('sound-btn').classList.toggle('active', soundEnabled);
}

function toggleCoordinates() {
  showCoordinates = !showCoordinates;
  document.body.classList.toggle('hide-coords', !showCoordinates);
  document.getElementById('coord-btn').classList.toggle('active', showCoordinates);
}

function toggleRulesModal() {
  document.getElementById('rules-modal').classList.toggle('hidden');
}

function closeRulesOnBackdrop(e) {
  if (e.target.id === 'rules-modal') toggleRulesModal();
}

function resetGame() {
  currentPlayer = 'p1';
  selectedPiece = null;
  mustJump = false;
  multiJumpPiece = null;
  gameOver = false;
  moveHistory = [];
  p1Captures = [];
  p2Captures = [];
  historyStack = [];

  document.getElementById('undo-btn').disabled = true;
  initBoard();
  mustJump = gameMode === 'feed-first' ? hasAnyJumps(currentPlayer) : false;
  changeTheme(currentTheme);
  updateStatus();
  renderBoard();
  renderHistoryTable();
  renderCaptures();
}

// Initial setup
initBoard();
changeTheme('red-white');
resetGame();
