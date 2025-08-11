// Global UI element cache
const ui = {
    // BUG FIX: Added puzzleContainer to the UI cache
    puzzleContainer: document.getElementById('puzzle-container'),
    gridContainer: document.getElementById('grid-container'),
    fleetList: document.getElementById('fleet-list'),
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loader-text'),
    gridSizeSelect: document.getElementById('grid-size-select'),
    difficultySelect: document.getElementById('difficulty-select'),
    mainControls: document.getElementById('main-controls'),
    gameBoard: document.getElementById('game-board'),
    completionModal: document.getElementById('completion-modal'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    hintBtn: document.getElementById('hint-btn'),
    revealBtn: document.getElementById('reveal-btn'),
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

// Game constants
const FLEET_DEFINITIONS = {
    8: { ships: [3, 2, 2, 1, 1, 1], hints: { easy: 6, medium: 3, hard: 0 } },
    10: { ships: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hints: { easy: 10, medium: 5, hard: 0 } },
    12: { ships: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1], hints: { easy: 15, medium: 8, hard: 0 } }
};
const CELL_STATE = { EMPTY: 0, WATER: 1, SHIP: 2 };
const SHIP_ID = 2;
const EMPTY_ID = 0;

/**
 * Updates global parameters based on UI selections.
 */
function updatePuzzleParameters() {
    gridSize = parseInt(ui.gridSizeSelect.value, 10);
    difficulty = ui.difficultySelect.value;
    fleetConfig = FLEET_DEFINITIONS[gridSize];
}

/**
 * Generates all data for a new puzzle, including ship placement and clues.
 * @returns {object} The complete puzzle data object.
 */
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
    
    const initialHints = [];
    const hintCount = fleetConfig.hints[difficulty];
    const possibleHintCells = [];
    for (let r=0; r < gridSize; r++) {
        for (let c=0; c < gridSize; c++) {
            possibleHintCells.push({r, c});
        }
    }
    possibleHintCells.sort(() => 0.5 - Math.random());
    for(let i=0; i < hintCount && i < possibleHintCells.length; i++) {
        const {r, c} = possibleHintCells[i];
        initialHints.push({ r, c, type: grid[r][c] === SHIP_ID ? 'ship' : 'water' });
    }

    return {
        gridSize,
        fleet: fleetConfig.ships,
        solutionGrid: grid,
        ships: placedShips,
        rowClues: rClues,
        colClues: cClues,
        initialHints
    };
}

/**
 * Places the fleet onto a grid according to the rules.
 * @returns {object|null} An object with the grid and ship locations, or null if it fails.
 */
function placeShipsOnGrid() {
    const grid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(EMPTY_ID));
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
                            if (grid[curR][curC] !== EMPTY_ID) {
                                canPlace = false;
                                break;
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

/**
 * Shows or hides the loading overlay.
 * @param {boolean} isLoading - Whether to show the loader.
 * @param {string} [message=''] - The message to display in the loader.
 */
function setUiLoading(isLoading, message = '') {
    document.querySelectorAll('button').forEach(btn => btn.disabled = isLoading);
    ui.loader.classList.toggle('hidden', !isLoading);
    ui.loaderText.textContent = message;
}

/**
 * Main function to generate and display a new puzzle.
 */
function generatePuzzle() {
    setUiLoading(true, 'Generating new puzzle...');
    hideCompletionModal();
    
    ui.hintBtn.disabled = false;
    ui.revealBtn.disabled = false;

    setTimeout(() => {
        try {
            const puzzleData = generatePuzzleData();
            solutionGrid = puzzleData.solutionGrid;
            ships = puzzleData.ships;
            rowClues = puzzleData.rowClues;
            colClues = puzzleData.colClues;
            
            playerGrid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(CELL_STATE.EMPTY));
            puzzleData.initialHints.forEach(hint => {
                playerGrid[hint.r][hint.c] = hint.type === 'ship' ? CELL_STATE.SHIP : CELL_STATE.WATER;
            });

            puzzleConfigKey = `battleship-${gridSize}-${difficulty}`;
            ui.status.textContent = `Grid: ${gridSize}x${gridSize} | Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
            
            updateGridDisplay();
            updateFleetDisplay();
            startTime = Date.now();
            setUiLoading(false);
        } catch (error) {
            ui.status.textContent = `Error: ${error.message}`;
            setUiLoading(false);
        }
    }, 50);
}

/**
 * Renders the game grid and clues based on the current state.
 */
function updateGridDisplay() {
    // This was the line that caused the error. It's now fixed because ui.puzzleContainer is defined.
    const containerWidth = ui.puzzleContainer.clientWidth;
    const fullGridSize = gridSize + 1;
    const cellSize = Math.floor(containerWidth / fullGridSize);

    ui.gridContainer.innerHTML = '';
    ui.gridContainer.style.gridTemplateColumns = `repeat(${fullGridSize}, ${cellSize}px)`;
    ui.gridContainer.style.gridTemplateRows = `repeat(${fullGridSize}, ${cellSize}px)`;
    ui.gridContainer.style.width = `${fullGridSize * cellSize}px`;

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
            if (r === 0 && c === 0) {
                cell.className = 'grid-cell';
            } else if (r === 0) {
                cell.className = 'grid-cell clue-cell';
                cell.textContent = colClues[c - 1];
                if (playerColCounts[c - 1] === colClues[c - 1]) {
                     cell.classList.add('satisfied');
                }
            } else if (c === 0) {
                cell.className = 'grid-cell clue-cell';
                cell.textContent = rowClues[r - 1];
                 if (playerRowCounts[r - 1] === rowClues[r - 1]) {
                     cell.classList.add('satisfied');
                }
            } else {
                const gridR = r - 1;
                const gridC = c - 1;
                cell.className = 'grid-cell game-cell';
                cell.dataset.r = gridR;
                cell.dataset.c = gridC;
                
                const state = playerGrid[gridR][gridC];
                if (state === CELL_STATE.WATER) {
                    cell.classList.add('water');
                } else if (state === CELL_STATE.SHIP) {
                    cell.classList.add('ship');
                    const segment = document.createElement('div');
                    segment.className = 'ship-segment';
                    cell.appendChild(segment);
                }
            }
            ui.gridContainer.appendChild(cell);
        }
    }
}

/**
 * Renders the fleet list and marks ships that have been correctly found.
 */
function updateFleetDisplay() {
    ui.fleetList.innerHTML = '';
    
    const playerShips = identifyShipsInGrid(playerGrid);
    const solutionShipSignatures = new Set(ships.map(s => s.segments.map(seg => `${seg.r},${seg.c}`).sort().join(';')));
    
    const foundShipCounts = {};
    playerShips.forEach(playerShip => {
        const signature = playerShip.segments.map(seg => `${seg.r},${seg.c}`).sort().join(';');
        if (solutionShipSignatures.has(signature)) {
            const len = playerShip.length;
            foundShipCounts[len] = (foundShipCounts[len] || 0) + 1;
        }
    });

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

        if (foundShipCounts[length] >= count) {
            li.classList.add('found');
        }

        ui.fleetList.appendChild(li);
    });
}

/**
 * Handles clicks on game cells, cycling their state.
 * @param {Event} e - The click event.
 */
function handleCellClick(e) {
    const cell = e.target.closest('.game-cell');
    if (!cell || startTime === null) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    
    const currentState = playerGrid[r][c];
    let nextState = (currentState + 1) % 3; // Cycles 0, 1, 2
    playerGrid[r][c] = nextState;

    updateGridDisplay();
    updateFleetDisplay();
    checkWinCondition();
}

/**
 * Checks if the player has correctly placed all ships.
 */
function checkWinCondition() {
    let correctShipCells = 0;
    let totalShipCells = 0;
    let incorrectShipPlacement = false;

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (solutionGrid[r][c] === SHIP_ID) {
                totalShipCells++;
                if (playerGrid[r][c] === CELL_STATE.SHIP) {
                    correctShipCells++;
                }
            } else {
                if (playerGrid[r][c] === CELL_STATE.SHIP) {
                    incorrectShipPlacement = true;
                }
            }
        }
    }

    if (!incorrectShipPlacement && correctShipCells === totalShipCells) {
        const elapsedTime = Date.now() - startTime;
        handlePuzzleCompletion(elapsedTime);
        revealSolution();
    }
}

/**
 * Reveals the entire solution on the grid.
 */
function revealSolution() {
    if (!solutionGrid) return;
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = ui.gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);
            if(cell) {
                 cell.classList.remove('ship', 'water');
                 if (solutionGrid[r][c] === SHIP_ID) {
                    cell.classList.add('revealed');
                    if (!cell.querySelector('.ship-segment')) {
                        const segment = document.createElement('div');
                        segment.className = 'ship-segment';
                        cell.appendChild(segment);
                    }
                }
            }
        }
    }
    ui.hintBtn.disabled = true;
    ui.revealBtn.disabled = true;
    startTime = null;
    updateFleetDisplay();
}

/**
 * Provides a hint by revealing one incorrect cell's correct state.
 */
function giveHint() {
    const incorrectCells = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const solutionState = solutionGrid[r][c] === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER;
            if (playerGrid[r][c] !== CELL_STATE.EMPTY && playerGrid[r][c] !== solutionState) {
                incorrectCells.push({r, c});
            }
        }
    }
    
    if (incorrectCells.length === 0) {
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                 if (playerGrid[r][c] === CELL_STATE.EMPTY) {
                     incorrectCells.push({r,c});
                 }
            }
        }
    }

    if (incorrectCells.length === 0) return;

    const hintCellCoord = incorrectCells[Math.floor(Math.random() * incorrectCells.length)];
    const {r, c} = hintCellCoord;
    playerGrid[r][c] = solutionGrid[r][c] === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER;
    
    updateGridDisplay();
    updateFleetDisplay();

    const cellElement = ui.gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);
    if (cellElement) {
        cellElement.classList.add('hint-reveal');
        setTimeout(() => cellElement.classList.remove('hint-reveal'), 1500);
    }
    
    ui.hintBtn.disabled = true;
    setTimeout(() => { if(startTime) ui.hintBtn.disabled = false; }, 1000);
    checkWinCondition();
}

// --- Utility & Helper Functions ---
/**
 * Scans a grid to identify contiguous groups of ship cells.
 * @param {Array<Array<number>>} targetGrid - The grid to analyze.
 * @returns {Array<object>} A list of found ship objects.
 */
function identifyShipsInGrid(targetGrid) {
    const checked = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));
    const foundShips = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (targetGrid[r][c] === CELL_STATE.SHIP && !checked[r][c]) {
                const ship = { length: 0, segments: [] };
                const q = [{r, c}];
                checked[r][c] = true;
                while(q.length > 0) {
                    const curr = q.shift();
                    ship.length++;
                    ship.segments.push(curr);
                    [{dr:0,dc:1}, {dr:0,dc:-1}, {dr:1,dc:0}, {dr:-1,dc:0}].forEach(dir => {
                        const nr = curr.r + dir.dr, nc = curr.c + dir.dc;
                        if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize && targetGrid[nr][nc] === CELL_STATE.SHIP && !checked[nr][nc]) {
                            checked[nr][nc] = true;
                            q.push({r: nr, c: nc});
                        }
                    });
                }
                foundShips.push(ship);
            }
        }
    }
    return foundShips;
}

/**
 * Formats milliseconds into a MM:SS string.
 * @param {number} milliseconds - The time in milliseconds.
 * @returns {string} The formatted time string.
 */
function formatTime(milliseconds) { const s = Math.floor(milliseconds / 1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

/**
 * Handles the logic for puzzle completion, timing, and displaying the modal.
 * @param {number} elapsedTime - The time taken to solve the puzzle.
 */
function handlePuzzleCompletion(elapsedTime) {
    startTime = null;
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

// --- Event Listeners Initialization ---
function initEventListeners() {
    ui.generateBtn.addEventListener('click', generatePuzzle);
    ui.hintBtn.addEventListener('click', giveHint);
    ui.revealBtn.addEventListener('click', revealSolution);
    ui.playAgainBtn.addEventListener('click', generatePuzzle);
    ui.completionModal.addEventListener('click', hideCompletionModal);
    ui.gridSizeSelect.addEventListener('change', handleGlobalOptionChange);
    ui.difficultySelect.addEventListener('change', handleGlobalOptionChange);
    ui.fullscreenBtn.addEventListener('click', toggleFullScreen);
    ui.themeToggleBtn.addEventListener('click', () => setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark'));
    ui.gridContainer.addEventListener('click', handleCellClick);
    
    document.addEventListener('keydown', (event) => {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
        const key = event.key.toLowerCase();
        if (key === 'h' && !ui.hintBtn.disabled) { event.preventDefault(); giveHint(); } 
        else if (key === 'f') { event.preventDefault(); toggleFullScreen(); } 
        else if (key === 'n') { event.preventDefault(); generatePuzzle(); } 
        else if (key === 'r' && !ui.revealBtn.disabled) { event.preventDefault(); revealSolution(); }
    });
}

// --- Initial Load ---
window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

    const isMobile = /Mobi/i.test(navigator.userAgent);
    if (isMobile) { ui.fullscreenBtn.style.display = 'none'; }
    
    initEventListeners();
    generatePuzzle();
});