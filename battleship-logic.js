// Global UI element cache
const ui = {
    puzzleContainer: document.getElementById('puzzle-container'),
    gridContainer: document.getElementById('grid-container'),
    fleetList: document.getElementById('fleet-list'),
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loader-text'),
    gridSizeSelect: document.getElementById('grid-size-select'),
    difficultySelect: document.getElementById('difficulty-select'),
    mistakeModeCheckbox: document.getElementById('mistake-mode-checkbox'),
    mainControls: document.getElementById('main-controls'),
    gameBoard: document.getElementById('game-board'),
    completionModal: document.getElementById('completion-modal'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    hintBtn: document.getElementById('hint-btn'),
    revealBtn: document.getElementById('reveal-btn'),
    finishBtn: document.getElementById('finish-btn'),
    status: document.getElementById('source-status'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    generateBtn: document.getElementById('generate-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
};

// Game state variables
let gridSize, difficulty, fleetConfig;
let solutionGrid, playerGrid, ships, rowClues, colClues;
let debounceTimeout;
let startTime, puzzleConfigKey;
let highlightedLine;

// Game constants
const FLEET_DEFINITIONS = {
    8: { ships: [3, 2, 2, 1, 1, 1], hints: { easy: 6, medium: 3, hard: 0 } },
    10: { ships: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hints: { easy: 10, medium: 5, hard: 0 } },
    12: { ships: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hints: { easy: 15, medium: 8, hard: 0 } }
};
const CELL_STATE = { EMPTY: 0, WATER: 1, SHIP: 2 };
const SHIP_ID = 2;

/**
 * Main function to generate and display a new puzzle.
 */
function generatePuzzle() {
    setUiLoading(true, 'Generating new puzzle...');
    hideCompletionModal();
    highlightedLine = { type: null, index: null };
    startTime = Date.now();
    ui.hintBtn.disabled = false;
    ui.revealBtn.disabled = false;
    ui.finishBtn.disabled = false;
    
    setTimeout(() => {
        try {
            const puzzleData = generatePuzzleData();
            solutionGrid = puzzleData.solutionGrid;
            ships = puzzleData.ships;
            rowClues = puzzleData.rowClues;
            colClues = puzzleData.colClues;
            playerGrid = puzzleData.playerGrid;

            puzzleConfigKey = `battleship-${gridSize}-${difficulty}`;
            ui.status.textContent = `Grid: ${gridSize}x${gridSize} | Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
            
            updateGridDisplay();
            updateFleetDisplay();
            setUiLoading(false);
        } catch (error) {
            ui.status.textContent = `Error: ${error.message}`;
            setUiLoading(false);
        }
    }, 10);
}

/**
 * Renders the game grid. Icons are placeholders until the game is won.
 * @param {boolean} [isFinished=false] - If true, displays final ship icons.
 * @param {Array} [errorCells=[]] - A list of {r, c} objects to highlight as errors.
 * @param {boolean} [isFailedAttempt=false] - If true, uses a different color for revealed ships.
 */
function updateGridDisplay(isFinished = false, errorCells = [], isFailedAttempt = false) {
    const fullGridSize = gridSize + 1;

    // BUG FIX: Set the grid size via CSS variable instead of direct style manipulation
    ui.gridContainer.style.setProperty('--grid-size', fullGridSize);
    ui.gridContainer.innerHTML = '';

    const playerRowCounts = Array(gridSize).fill(0);
    const playerColCounts = Array(gridSize).fill(0);
    for (let r=0; r < gridSize; r++) {
        for(let c=0; c < gridSize; c++) {
            if (playerGrid[r][c] === CELL_STATE.SHIP) {
                playerRowCounts[r]++;
                playerColCounts[c]++;
            }
        }
    }

    for (let r = 0; r < fullGridSize; r++) {
        for (let c = 0; c < fullGridSize; c++) {
            const cell = document.createElement('div');
            const isHighlighted = (highlightedLine.type === 'row' && highlightedLine.index === r - 1) || (highlightedLine.type === 'col' && highlightedLine.index === c - 1);

            if (r === 0 && c > 0) { // Column clues
                cell.className = 'grid-cell clue-cell';
                cell.textContent = colClues[c - 1];
                cell.dataset.clueType = 'col';
                cell.dataset.clueIndex = c - 1;
                if (playerColCounts[c - 1] === colClues[c - 1] && colClues[c-1] !== 0) cell.classList.add('satisfied');
                if (isHighlighted) cell.classList.add('highlight');
            } else if (c === 0 && r > 0) { // Row clues
                cell.className = 'grid-cell clue-cell';
                cell.textContent = rowClues[r - 1];
                cell.dataset.clueType = 'row';
                cell.dataset.clueIndex = r - 1;
                if (playerRowCounts[r - 1] === rowClues[r - 1] && rowClues[r-1] !== 0) cell.classList.add('satisfied');
                if (isHighlighted) cell.classList.add('highlight');
            } else if (r > 0 && c > 0) { // Game cells
                const gridR = r - 1;
                const gridC = c - 1;
                cell.className = 'grid-cell game-cell';
                cell.dataset.r = gridR;
                cell.dataset.c = gridC;
                if (isHighlighted) cell.classList.add('highlight');
                if (errorCells.some(e => e.r === gridR && e.c === gridC)) {
                    cell.classList.add('error-cell');
                }
                
                const state = playerGrid[gridR][gridC];
                if (state === CELL_STATE.WATER) {
                    cell.classList.add('water');
                } else if (state === CELL_STATE.SHIP) {
                    cell.classList.add('ship');
                    if (isFinished) {
                        cell.classList.add(isFailedAttempt ? 'revealed-fail' : 'revealed');
                        const sunkShipSegments = getSunkShipSegments();
                        const segmentKey = `${gridR},${gridC}`;
                        if (sunkShipSegments.has(segmentKey)) {
                            const { part, rotation } = sunkShipSegments.get(segmentKey);
                            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                            svg.setAttribute("class", "ship-segment-icon");
                            svg.setAttribute("viewBox", "0 0 16 16");
                            if (rotation) svg.style.transform = `rotate(${rotation}deg)`;
                            const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
                            use.setAttributeNS(null, "href", `#ship-${part}`);
                            svg.appendChild(use);
                            cell.appendChild(svg);
                        }
                    } else {
                         const placeholder = document.createElement('div');
                         placeholder.className = 'ship-segment-placeholder';
                         cell.appendChild(placeholder);
                    }
                }
            } else {
                cell.className = 'grid-cell';
            }
            ui.gridContainer.appendChild(cell);
        }
    }
}

/**
 * Handles clicks on any cell in the grid container.
 */
function handleGridClick(e) {
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;

    if (cell.classList.contains('game-cell')) {
        handleGameCellClick(cell);
    } else if (cell.classList.contains('clue-cell')) {
        handleClueCellClick(cell);
    }
}

/**
 * Handles clicks on game cells to cycle their state.
 */
function handleGameCellClick(cell) {
    if (startTime === null) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    
    let currentState = playerGrid[r][c];
    let nextState = (currentState + 1) % 3;
    
    if (ui.mistakeModeCheckbox.checked && nextState === CELL_STATE.SHIP && solutionGrid[r][c] !== SHIP_ID) {
        cell.classList.add('error-flash');
        return;
    }
    cell.classList.remove('error-flash');

    playerGrid[r][c] = nextState;
    updateGridDisplay();
    updateFleetDisplay();
}

/**
 * Handles clicks on clue cells to toggle focus highlight.
 */
function handleClueCellClick(cell) {
    const type = cell.dataset.clueType;
    const index = parseInt(cell.dataset.clueIndex);

    if (highlightedLine.type === type && highlightedLine.index === index) {
        highlightedLine.type = null;
        highlightedLine.index = null;
    } else {
        highlightedLine.type = type;
        highlightedLine.index = index;
    }
    updateGridDisplay();
}

/**
 * Checks the player's solution.
 */
function checkSolution() {
    let isCorrect = true;
    const errorCells = [];

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const playerAnswer = playerGrid[r][c] === CELL_STATE.SHIP ? SHIP_ID : 0;
            const solutionAnswer = solutionGrid[r][c];
            if (playerAnswer !== solutionAnswer) {
                isCorrect = false;
                errorCells.push({ r, c });
            }
        }
    }

    const elapsedTime = Date.now() - (startTime || Date.now());
    startTime = null;
    ui.finishBtn.disabled = true;
    ui.hintBtn.disabled = true;

    if (isCorrect) {
        handlePuzzleCompletion(elapsedTime);
        updateGridDisplay(true, [], false);
        updateFleetDisplay(true);
    } else {
        playerGrid = solutionGrid.map(row => row.map(cell => cell === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER));
        updateGridDisplay(true, errorCells, true);
        updateFleetDisplay(true);
    }
}

/**
 * Event Listeners and Game Initialization
 */
function initEventListeners() {
    ui.generateBtn.addEventListener('click', generatePuzzle);
    ui.hintBtn.addEventListener('click', giveHint);
    ui.revealBtn.addEventListener('click', () => revealSolution(false));
    ui.finishBtn.addEventListener('click', checkSolution);
    ui.playAgainBtn.addEventListener('click', generatePuzzle);
    ui.completionModal.addEventListener('click', hideCompletionModal);
    ui.gridSizeSelect.addEventListener('change', handleGlobalOptionChange);
    ui.difficultySelect.addEventListener('change', handleGlobalOptionChange);
    ui.fullscreenBtn.addEventListener('click', toggleFullScreen);
    ui.themeToggleBtn.addEventListener('click', () => setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark'));
    ui.gridContainer.addEventListener('click', handleGridClick);
}

window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    const isMobile = /Mobi/i.test(navigator.userAgent);
    if (isMobile) { ui.fullscreenBtn.style.display = 'none'; }
    
    initEventListeners();
    setTimeout(generatePuzzle, 0);
});

// --- Utility and Helper Functions ---

function updatePuzzleParameters() {
    gridSize = parseInt(ui.gridSizeSelect.value, 10);
    difficulty = ui.difficultySelect.value;
    fleetConfig = FLEET_DEFINITIONS[gridSize];
}

function placeShipsOnGrid() {
    const grid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    const placedShips = [];
    const shipsToPlace = [...fleetConfig.ships];
    for (const shipLength of shipsToPlace) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 200) {
            attempts++;
            const isVertical = Math.random() > 0.5;
            const r = Math.floor(Math.random() * (isVertical ? gridSize - shipLength + 1 : gridSize));
            const c = Math.floor(Math.random() * (isVertical ? gridSize : gridSize - shipLength + 1));
            let canPlace = true;
            for (let i = -1; i <= shipLength; i++) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        let curR = r + (isVertical ? i : 0) + dr;
                        let curC = c + (isVertical ? 0 : i) + dc;
                        if (curR >= 0 && curR < gridSize && curC >= 0 && curC < gridSize) {
                            if (grid[curR][curC] !== 0) {
                                canPlace = false; break;
                            }
                        }
                    }
                    if (!canPlace) break;
                }
                if (!canPlace) break;
            }
            if (canPlace) {
                const newShip = { segments: [], length: shipLength };
                for (let i = 0; i < shipLength; i++) {
                    let curR = r + (isVertical ? i : 0);
                    let curC = c + (isVertical ? 0 : i);
                    grid[curR][curC] = SHIP_ID;
                    newShip.segments.push({ r: curR, c: curC });
                }
                placedShips.push(newShip);
                placed = true;
            }
        }
        if (!placed) return null;
    }
    return { grid, ships: placedShips };
}

function generatePuzzleData() {
    updatePuzzleParameters();
    let placedShips;
    let grid;
    let attempts = 0;
    while (attempts < 50) {
        const result = placeShipsOnGrid();
        if (result) {
            grid = result.grid;
            placedShips = result.ships;
            break;
        }
        attempts++;
    }
    if (!placedShips) {
         throw new Error(`Failed to generate a valid puzzle board after ${attempts} attempts.`);
    }

    const rClues = Array(gridSize).fill(0);
    const cClues = Array(gridSize).fill(0);
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (grid[r][c] === SHIP_ID) {
                rClues[r]++;
                cClues[c]++;
            }
        }
    }

    const tempPlayerGrid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(CELL_STATE.EMPTY));
    rClues.forEach((clue, r) => {
        if (clue === 0) {
            for (let c = 0; c < gridSize; c++) tempPlayerGrid[r][c] = CELL_STATE.WATER;
        }
    });
    cClues.forEach((clue, c) => {
        if (clue === 0) {
            for (let r = 0; r < gridSize; r++) tempPlayerGrid[r][c] = CELL_STATE.WATER;
        }
    });
    
    const initialHints = [];
    const hintCount = fleetConfig.hints[difficulty];
    const possibleHintCells = [];
    for (let r=0; r < gridSize; r++) {
        for (let c=0; c < gridSize; c++) {
            if (tempPlayerGrid[r][c] === CELL_STATE.EMPTY) {
                possibleHintCells.push({r, c});
            }
        }
    }

    possibleHintCells.sort(() => 0.5 - Math.random());
    for(let i=0; i < hintCount && i < possibleHintCells.length; i++) {
        const {r, c} = possibleHintCells[i];
        initialHints.push({ r, c, type: grid[r][c] === SHIP_ID ? 'ship' : 'water' });
    }

    initialHints.forEach(hint => {
        tempPlayerGrid[hint.r][hint.c] = hint.type === 'ship' ? CELL_STATE.SHIP : CELL_STATE.WATER;
    });

    return {
        gridSize, fleet: fleetConfig.ships, solutionGrid: grid, ships: placedShips, rowClues: rClues, colClues: cClues, playerGrid: tempPlayerGrid
    };
}

function setUiLoading(isLoading, message = '') {
    document.querySelectorAll('button, input, select').forEach(el => el.disabled = isLoading);
    ui.loader.classList.toggle('hidden', !isLoading);
    ui.loaderText.textContent = message;
}

function updateFleetDisplay(isFinished = false) {
    ui.fleetList.innerHTML = '';
    const totalShipCounts = {};
    fleetConfig.ships.forEach(len => totalShipCounts[len] = (totalShipCounts[len] || 0) + 1);

    Object.keys(totalShipCounts).sort((a,b) => b-a).forEach(length => {
        const count = totalShipCounts[length];
        const li = document.createElement('li');
        const icon = document.createElement('div');
        icon.className = 'ship-icon';
        for (let i = 0; i < length; i++) {
            icon.appendChild(document.createElement('div'));
        }
        const label = document.createElement('span');
        label.textContent = `x ${count}`;
        li.appendChild(icon);
        li.appendChild(label);
        if (isFinished) {
            li.classList.add('found');
        }
        ui.fleetList.appendChild(li);
    });
}

function revealSolution(isFailedAttempt = false) {
    if (!solutionGrid) return;
    startTime = null;
    playerGrid = solutionGrid.map(row => row.map(cell => cell === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER));
    updateGridDisplay(true, [], isFailedAttempt);
    updateFleetDisplay(true);
    ui.hintBtn.disabled = true;
    ui.finishBtn.disabled = true;
    ui.revealBtn.disabled = true;
}

function getSunkShipSegments() {
    const segments = new Map();
    for (const ship of ships) {
        if (ship.length === 1) {
            const {r, c} = ship.segments[0];
            segments.set(`${r},${c}`, { part: 'submarine', rotation: 0 });
            continue;
        }
        const isVertical = ship.segments.length > 1 && ship.segments[0].c === ship.segments[1].c;
        const sortedSegments = ship.segments.sort((a, b) => isVertical ? a.r - b.r : a.c - b.c);
        const firstEndRotation = isVertical ? 270 : 180;
        const lastEndRotation = isVertical ? 90 : 0;
        const middleRotation = isVertical ? 0 : 90;
        const {r: r1, c: c1} = sortedSegments[0];
        segments.set(`${r1},${c1}`, { part: 'end', rotation: firstEndRotation });
        const {r: rL, c: cL} = sortedSegments[sortedSegments.length - 1];
        segments.set(`${rL},${cL}`, { part: 'end', rotation: lastEndRotation });
        for (let i = 1; i < sortedSegments.length - 1; i++) {
            const {r, c} = sortedSegments[i];
            segments.set(`${r},${c}`, { part: 'middle', rotation: middleRotation });
        }
    }
    return segments;
}

function giveHint() {
    if (window.innerWidth < 768) {
        ui.puzzleContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const emptyCells = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (playerGrid[r][c] === CELL_STATE.EMPTY) {
                emptyCells.push({r, c});
            }
        }
    }
    if (emptyCells.length === 0) return;
    const {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const cellElement = ui.gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);
    if (cellElement) {
        cellElement.classList.add('hint-flash');
        ui.hintBtn.disabled = true;
        setTimeout(() => {
            cellElement.classList.remove('hint-flash');
            playerGrid[r][c] = solutionGrid[r][c] === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER;
            updateGridDisplay();
            updateFleetDisplay();
            if (startTime) ui.hintBtn.disabled = false;
        }, 1000);
    }
}

function formatTime(milliseconds) { const s = Math.floor(milliseconds / 1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

function handlePuzzleCompletion(elapsedTime) {
    const bestTime = localStorage.getItem(puzzleConfigKey);
    let isNewBest = false;
    if (bestTime === null || elapsedTime < parseInt(bestTime, 10)) {
        localStorage.setItem(puzzleConfigKey, elapsedTime);
        isNewBest = true;
    }
    document.getElementById('your-time').textContent = `Your time: ${formatTime(elapsedTime)}`;
    document.getElementById('best-time').textContent = `Best time: ${formatTime(localStorage.getItem(puzzleConfigKey))}`;
    document.getElementById('new-best-time').textContent = isNewBest ? 'New Best Time!' : '';
    showCompletionModal();
}

function showCompletionModal() { ui.completionModal.classList.add('visible'); ui.hintBtn.disabled = true; ui.revealBtn.disabled = true; }
function hideCompletionModal() { ui.completionModal.classList.remove('visible'); }

function handleGlobalOptionChange() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(generatePuzzle, 250);
}

function toggleFullScreen() {
    const target = document.querySelector('.container');
    if (!document.fullscreenElement) {
        target.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
}

function setTheme(theme) { 
    document.body.classList.toggle('dark-mode', theme === 'dark'); 
    localStorage.setItem('theme', theme); 
}