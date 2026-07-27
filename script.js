// Checkers / Draughts Master Game Engine with Customizable Color Choice & Board Positions

const BOARD_SIZE = 8;
let board = [];
let currentPlayer = 'p1'; // 'p1' = Bottom Player, 'p2' = Top Player
let selectedPiece = null;
let mustJump = false;
let multiJumpPiece = null;
let gameOver = false;

// Game Settings
let opponentType = 'human';     // 'human' | 'ai'
let aiDifficulty = 'easy';      // 'easy' | 'hard'
let gameMode = 'feed-first';    // 'feed-first' | 'strategic'
let currentTheme = 'red-white'; // 'red-white' | 'black-white' | 'brown-white'
let p1ColorChoice = 'primary';  // 'primary' (Red/Black/Brown) | 'white'
let firstTurnChoice = 'p1';     // 'p1' | 'p2'

let aiPlayer = 'p2';            // 'p1' or 'p2'
let humanPlayer = 'p1';         // 'p1' or 'p2'
let isAiThinking = false;
let soundEnabled = true;
let showCoordinates = true;

// Move History & Captured Tracking
let moveHistory = [];
let p1Captures = [];
let p2Captures = [];
let historyStack = [];

// Web Audio API Synthesizer
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
    console.warn("Audio error:", e);
  }
}

// Convert Row/Col to Chess Notation (e.g. r=7, c=0 -> 'a1')
function getNotation(r, c) {
  const colName = String.fromCharCode(97 + c);
  const rowName = 8 - r;
  return `${colName}${rowName}`;
}

// Initialize board state: P2 at Top (rows 0-2), P1 at Bottom (rows 5-7)
function initBoard() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) row.push({ player: 'p2', king: false }); // Top side moves DOWN
        else if (r > 4) row.push({ player: 'p1', king: false }); // Bottom side moves UP
        else row.push(null);
      } else {
        row.push(null);
      }
    }
    board.push(row);
  }
}

// Deep clone board state
function cloneState(b = board) {
  return JSON.parse(JSON.stringify(b));
}

function saveStateToUndo() {
  historyStack.push({
    board: cloneState(board),
    currentPlayer,
    selectedPiece: selectedPiece ? { ...selectedPiece } : null,
    mustJump,
    multiJumpPiece: multiJumpPiece ? { ...multiJumpPiece } : null,
    gameOver,
    moveHistory: JSON.parse(JSON.stringify(moveHistory)),
    p1Captures: JSON.parse(JSON.stringify(p1Captures)),
    p2Captures: JSON.parse(JSON.stringify(p2Captures))
  });
  if (historyStack.length > 50) historyStack.shift();
  document.getElementById('undo-btn').disabled = historyStack.length === 0;
}

function undoMove() {
  if (historyStack.length === 0 || isAiThinking) return;

  const stepsToUndo = (opponentType === 'ai' && historyStack.length >= 2) ? 2 : 1;
  let previousState = null;

  for (let i = 0; i < stepsToUndo; i++) {
    if (historyStack.length > 0) {
      previousState = historyStack.pop();
    }
  }

  if (!previousState) return;

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
function getValidMoves(r, c, b = board) {
  const piece = b[r][c];
  if (!piece) return { moves: [], jumps: [] };

  const moves = [];
  const jumps = [];
  // P1 (Bottom Player) moves UP (-1), P2 (Top Player) moves DOWN (+1)
  const directions = piece.king ? [-1, 1] : (piece.player === 'p1' ? [-1] : [1]);

  for (const dr of directions) {
    for (const dc of [-1, 1]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (!b[nr][nc]) {
          moves.push({ r: nr, c: nc });
        } else if (b[nr][nc].player !== piece.player) {
          const jr = r + dr * 2, jc = c + dc * 2;
          if (jr >= 0 && jr < BOARD_SIZE && jc >= 0 && jc < BOARD_SIZE && !b[jr][jc]) {
            jumps.push({ r: jr, c: jc, captureR: nr, captureC: nc });
          }
        }
      }
    }
  }
  return { moves, jumps };
}

// Check if player has any mandatory jump available anywhere on board
function hasAnyJumps(player, b = board) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = b[r][c];
      if (p && p.player === player) {
        const { jumps } = getValidMoves(r, c, b);
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
  if (!selectedPiece || (opponentType === 'ai' && currentPlayer === aiPlayer)) return;
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

function handleCellClick(r, c, isAiCall = false) {
  if (gameOver) return;

  // Block human clicks during AI turn
  if (!isAiCall && opponentType === 'ai' && currentPlayer === aiPlayer) {
    return;
  }

  const piece = board[r][c];

  // 1. Own piece selection
  if (piece && piece.player === currentPlayer) {
    if (multiJumpPiece && (r !== multiJumpPiece.r || c !== multiJumpPiece.c)) return;

    if (gameMode === 'feed-first' && mustJump) {
      const { jumps } = getValidMoves(r, c);
      if (jumps.length === 0) return;
    }

    selectedPiece = { r, c };
    renderBoard();
    return;
  }

  // 2. Target square selection
  if (!selectedPiece) return;

  const { moves, jumps } = getValidMoves(selectedPiece.r, selectedPiece.c);
  const targetJump = jumps.find(j => j.r === r && j.c === c);
  const targetMove = moves.find(m => m.r === r && m.c === c);

  if (!targetJump && !targetMove) return;

  const isMultiJumpStep = !!multiJumpPiece;
  if ((isMultiJumpStep || (gameMode === 'feed-first' && mustJump)) && !targetJump) {
    return;
  }

  saveStateToUndo();

  const isJump = !!targetJump;
  const startNotation = getNotation(selectedPiece.r, selectedPiece.c);
  const endNotation = getNotation(r, c);

  // Execute board move
  board[r][c] = board[selectedPiece.r][selectedPiece.c];
  board[selectedPiece.r][selectedPiece.c] = null;

  if (isJump) {
    const capturedPieceInfo = board[targetJump.captureR][targetJump.captureC];
    board[targetJump.captureR][targetJump.captureC] = null;
    if (currentPlayer === 'p1') p1Captures.push(capturedPieceInfo);
    else p2Captures.push(capturedPieceInfo);
    renderCaptures();
  }

  // Promotion check: P1 (Bottom) promotes at row 0, P2 (Top) promotes at row 7
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

  // Audio feedback
  if (promotedThisTurn) playSound('king');
  else if (isJump) playSound('capture');
  else playSound('move');

  // Record move history notation
  if (isMultiJumpStep) {
    recordMove(currentPlayer, `${endNotation}${promotedThisTurn ? '♔' : ''}`, true);
  } else {
    const moveStr = `${startNotation}${isJump ? 'x' : '-'}${endNotation}${promotedThisTurn ? '♔' : ''}`;
    recordMove(currentPlayer, moveStr, false);
  }

  // Multi-jump check
  if (isJump && !promotedThisTurn) {
    const { jumps: moreJumps } = getValidMoves(r, c);
    if (moreJumps.length > 0) {
      selectedPiece = { r, c };
      multiJumpPiece = { r, c };
      mustJump = true;
      renderBoard();
      updateStatus();

      if (opponentType === 'ai' && currentPlayer === aiPlayer) {
        setTimeout(() => triggerAiTurn(), 400);
      }
      return;
    }
  }

  // End of turn: Reset multi-jump state and switch player
  multiJumpPiece = null;
  selectedPiece = null;
  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';

  mustJump = (gameMode === 'feed-first') ? hasAnyJumps(currentPlayer) : false;
  isAiThinking = false;

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

  const p1Name = getPlayerDisplayName('p1');
  const p2Name = getPlayerDisplayName('p2');

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

function getPrimaryColorName() {
  const names = { 'red-white': 'Red', 'black-white': 'Black', 'brown-white': 'Brown' };
  return names[currentTheme] || 'Red';
}

function getPlayerColorName(player) {
  const primaryName = getPrimaryColorName();
  if (player === 'p1') {
    return p1ColorChoice === 'primary' ? primaryName : 'White';
  } else {
    return p1ColorChoice === 'primary' ? 'White' : primaryName;
  }
}

function getPlayerDisplayName(player) {
  const colorName = getPlayerColorName(player);
  if (opponentType === 'ai') {
    return player === aiPlayer ? `Computer 🤖 (${colorName})` : `Player (${colorName})`;
  } else {
    return player === 'p1' ? `P1 (${colorName})` : `P2 (${colorName})`;
  }
}

function updateStatus() {
  if (gameOver) return;

  const banner = document.getElementById('status-banner');
  const icon = document.getElementById('status-icon');
  const text = document.getElementById('status-text');

  const p1Name = getPlayerDisplayName('p1');
  const p2Name = getPlayerDisplayName('p2');
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

  if (opponentType === 'ai' && currentPlayer === aiPlayer) {
    banner.classList.add('thinking');
    icon.textContent = '🤖';
    text.textContent = 'Computer is thinking...';

    if (!isAiThinking) {
      isAiThinking = true;
      setTimeout(() => triggerAiTurn(), 450);
    }
  } else {
    banner.classList.remove('thinking');
    icon.textContent = (gameMode === 'feed-first' && mustJump) ? '🔥' : '👉';
    text.textContent = `${currentName}'s Turn` + (mustJump ? ' (Jump Required!)' : '');
  }
}

// -------------------------------------------------------------
// 🤖 COMPUTER AI ENGINE
// -------------------------------------------------------------

function getAllLegalMovesForPlayer(player, b = board, mode = gameMode, multiPiece = multiJumpPiece) {
  const allMoves = [];
  const hasJumps = hasAnyJumps(player, b);

  if (multiPiece) {
    const { jumps } = getValidMoves(multiPiece.r, multiPiece.c, b);
    jumps.forEach(j => {
      allMoves.push({ fromR: multiPiece.r, fromC: multiPiece.c, toR: j.r, toC: j.c, isJump: true });
    });
    return allMoves;
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = b[r][c];
      if (piece && piece.player === player) {
        const { moves, jumps } = getValidMoves(r, c, b);

        if (mode === 'feed-first' && hasJumps) {
          jumps.forEach(j => allMoves.push({ fromR: r, fromC: c, toR: j.r, toC: j.c, isJump: true }));
        } else {
          jumps.forEach(j => allMoves.push({ fromR: r, fromC: c, toR: j.r, toC: j.c, isJump: true }));
          if (!hasJumps || mode === 'strategic') {
            moves.forEach(m => allMoves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c, isJump: false }));
          }
        }
      }
    }
  }
  return allMoves;
}

function triggerAiTurn() {
  if (gameOver || currentPlayer !== aiPlayer) {
    isAiThinking = false;
    return;
  }

  const legalOptions = getAllLegalMovesForPlayer(aiPlayer);
  if (legalOptions.length === 0) {
    isAiThinking = false;
    checkWin();
    return;
  }

  let selectedMove = null;

  if (aiDifficulty === 'easy') {
    const randIdx = Math.floor(Math.random() * legalOptions.length);
    selectedMove = legalOptions[randIdx];
  } else {
    selectedMove = getBestMoveMinimax(aiPlayer, 4);
  }

  if (!selectedMove) {
    selectedMove = legalOptions[0];
  }

  selectedPiece = { r: selectedMove.fromR, c: selectedMove.fromC };
  handleCellClick(selectedMove.toR, selectedMove.toC, true);
}

function evaluateBoardState(b, aiPl, humPl) {
  let score = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = b[r][c];
      if (p) {
        let val = p.king ? 18 : 10;

        if (r >= 2 && r <= 5 && c >= 2 && c <= 5) val += 1.2;

        if (p.player === 'p1' && r === 7) val += 1.5;
        if (p.player === 'p2' && r === 0) val += 1.5;

        if (!p.king) {
          if (p.player === 'p1') val += (7 - r) * 0.4;
          else val += r * 0.4;
        }

        if (p.player === aiPl) score += val;
        else score -= val;
      }
    }
  }

  const aiMobility = getAllLegalMovesForPlayer(aiPl, b).length;
  const humMobility = getAllLegalMovesForPlayer(humPl, b).length;
  score += (aiMobility - humMobility) * 0.5;

  return score;
}

function simulateMoveOnBoard(b, move) {
  const newBoard = cloneState(b);
  const { fromR, fromC, toR, toC, isJump } = move;

  newBoard[toR][toC] = newBoard[fromR][fromC];
  newBoard[fromR][fromC] = null;

  if (isJump) {
    const capR = Math.floor((fromR + toR) / 2);
    const capC = Math.floor((fromC + toC) / 2);
    newBoard[capR][capC] = null;
  }

  const p = newBoard[toR][toC];
  if (!p.king) {
    if (p.player === 'p1' && toR === 0) p.king = true;
    if (p.player === 'p2' && toR === BOARD_SIZE - 1) p.king = true;
  }

  return newBoard;
}

function getBestMoveMinimax(player, depth) {
  const legalMoves = getAllLegalMovesForPlayer(player);
  if (legalMoves.length === 0) return null;

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of legalMoves) {
    const nextBoard = simulateMoveOnBoard(board, move);
    const score = minimax(nextBoard, depth - 1, alpha, beta, false, player, humanPlayer);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, bestScore);
  }

  return bestMove;
}

function minimax(b, depth, alpha, beta, isMaximizing, aiPl, humPl) {
  if (depth === 0) {
    return evaluateBoardState(b, aiPl, humPl);
  }

  const activePl = isMaximizing ? aiPl : humPl;
  const legalMoves = getAllLegalMovesForPlayer(activePl, b);

  if (legalMoves.length === 0) {
    return isMaximizing ? -1000 : 1000;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const nextB = simulateMoveOnBoard(b, move);
      const evalScore = minimax(nextB, depth - 1, alpha, beta, false, aiPl, humPl);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      const nextB = simulateMoveOnBoard(b, move);
      const evalScore = minimax(nextB, depth - 1, alpha, beta, true, aiPl, humPl);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// -------------------------------------------------------------
// Control Bar Event Handlers & Theme UI Sync
// -------------------------------------------------------------

function changeOpponent(opp) {
  opponentType = opp;
  document.getElementById('ai-options-group').classList.toggle('hidden', opponentType !== 'ai');
  updateThemeAndColorUI();
  resetGame();
}

function changeAiDifficulty(diff) {
  aiDifficulty = diff;
}

function changeTheme(theme) {
  currentTheme = theme;
  updateThemeAndColorUI();
  resetGame();
}

function changeColorChoice(choice) {
  p1ColorChoice = choice;
  updateThemeAndColorUI();
  resetGame();
}

function changeFirstTurn(turn) {
  firstTurnChoice = turn;
  resetGame();
}

function changeGameMode(mode) {
  gameMode = mode;
  mustJump = gameMode === 'feed-first' ? hasAnyJumps(currentPlayer) : false;
  updateStatus();
  renderBoard();
}

function updateThemeAndColorUI() {
  document.body.setAttribute('data-theme', currentTheme);
  document.body.setAttribute('data-p1-color', p1ColorChoice);

  const primaryName = getPrimaryColorName();
  const primaryEmoji = currentTheme === 'red-white' ? '🔴' : (currentTheme === 'black-white' ? '⚫' : '🤎');

  // Update Color Choice Options
  const optP1Primary = document.getElementById('opt-p1-primary');
  const optP1White = document.getElementById('opt-p1-white');

  optP1Primary.textContent = `${primaryEmoji} ${primaryName}`;
  optP1White.textContent = `⚪ White`;

  // Update First Turn Options
  const optFirstP1 = document.getElementById('opt-first-p1');
  const optFirstP2 = document.getElementById('opt-first-p2');

  const p1ColName = getPlayerColorName('p1');
  const p2ColName = getPlayerColorName('p2');

  if (opponentType === 'ai') {
    optFirstP1.textContent = `👤 Player (${p1ColName}) First`;
    optFirstP2.textContent = `🤖 Computer (${p2ColName}) First`;
  } else {
    optFirstP1.textContent = `👤 Player 1 (${p1ColName}) First`;
    optFirstP2.textContent = `👥 Player 2 (${p2ColName}) First`;
  }

  // Update Player Card Names
  const p1NameEl = document.getElementById('p1-name');
  const p2NameEl = document.getElementById('p2-name');
  const thP1 = document.getElementById('th-p1');
  const thP2 = document.getElementById('th-p2');
  const p1Avatar = document.getElementById('p1-avatar-icon');
  const p2Avatar = document.getElementById('p2-avatar-icon');

  p1NameEl.textContent = opponentType === 'ai' ? `Player (You: ${p1ColName})` : `Player 1 (Bottom: ${p1ColName})`;
  p2NameEl.textContent = opponentType === 'ai' ? `Computer 🤖 (${p2ColName})` : `Player 2 (Top: ${p2ColName})`;

  thP1.textContent = `P1 (${p1ColName})`;
  thP2.textContent = `P2 (${p2ColName})`;

  p1Avatar.textContent = opponentType === 'ai' ? '👤' : '♟️';
  p2Avatar.textContent = opponentType === 'ai' ? '🤖' : '♟️';

  // AI vs Human Player assignment
  if (opponentType === 'ai') {
    aiPlayer = 'p2';
    humanPlayer = 'p1';
  }
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
  currentPlayer = firstTurnChoice;
  selectedPiece = null;
  mustJump = false;
  multiJumpPiece = null;
  gameOver = false;
  isAiThinking = false;
  moveHistory = [];
  p1Captures = [];
  p2Captures = [];
  historyStack = [];

  document.getElementById('undo-btn').disabled = true;
  initBoard();
  updateThemeAndColorUI();

  mustJump = (gameMode === 'feed-first') ? hasAnyJumps(currentPlayer) : false;
  updateStatus();
  renderBoard();
  renderHistoryTable();
  renderCaptures();
}

// Initial game load
initBoard();
updateThemeAndColorUI();
resetGame();
