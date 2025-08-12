// Global UI element cache
const ui = {
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
let disabledRowClues, disabledColClues; // For player aid
let sunkShipSegments; // For enhanced visuals

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
 * Initializes all states for a new puzzle.
 */
function initNewPuzzleState() {
    disabledRowClues = new Set();
    disabledColClues = new Set();
    sunkShipSegments = new Map();
    startTime = Date.now();
    ui.hintBtn.disabled = false;
    ui.revealBtn.disabled = false;
}

/**
 * Main function to generate and display a new puzzle.
 */
function generatePuzzle() {
    setUiLoading(true, 'Generating new puzzle...');
    hideCompletionModal();
    initNewPuzzleState();
    
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
            if (r === 0 && c > 0) { // Column clues
                cell.className = 'grid-cell clue-cell';
                cell.textContent = colClues[c - 1];
                cell.dataset.clueType = 'col';
                cell.dataset.clueIndex = c - 1;
                if (playerColCounts[c - 1] === colClues[c - 1]) cell.classList.add('satisfied');
                if (disabledColClues.has(c - 1)) cell.classList.add('clue-disabled');
            } else if (c === 0 && r > 0) { // Row clues
                cell.className = 'grid-cell clue-cell';
                cell.textContent = rowClues[r - 1];
                cell.dataset.clueType = 'row';
                cell.dataset.clueIndex = r - 1;
                if (playerRowCounts[r - 1] === rowClues[r - 1]) cell.classList.add('satisfied');
                if (disabledRowClues.has(r - 1)) cell.classList.add('clue-disabled');
            } else if (r > 0 && c > 0) { // Game cells
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
                    } else {
                         const placeholder = document.createElement('div');
                         placeholder.className = 'ship-segment-placeholder';
                         cell.appendChild(placeholder);
                    }
                }
            } else {
                cell.className = 'grid-cell'; // Corner cell
            }
            ui.gridContainer.appendChild(cell);
        }
    }
}


/**
 * Handles clicks on any cell in the grid container.
 * @param {Event} e - The click event.
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
 * @param {HTMLElement} cell - The game cell that was clicked.
 */
function handleGameCellClick(cell) {
    if (startTime === null) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    
    playerGrid[r][c] = (playerGrid[r][c] + 1) % 3; // Cycles 0, 1, 2

    checkSunkShips();
    updateGridDisplay();
    updateFleetDisplay();
    checkWinCondition();
}

/**
 * Handles clicks on clue cells to toggle their disabled state.
 * @param {HTMLElement} cell - The clue cell that was clicked.
 */
function handleClueCellClick(cell) {
    const type = cell.dataset.clueType;
    const index = parseInt(cell.dataset.clueIndex);
    const targetSet = type === 'row' ? disabledRowClues : disabledColClues;

    if (targetSet.has(index)) {
        targetSet.delete(index);
    } else {
        targetSet.add(index);
    }
    cell.classList.toggle('clue-disabled');
}


/**
 * Provides a hint by revealing one incorrect cell's correct state.
 */
function giveHint() {
    const incorrectCells = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (playerGrid[r][c] === CELL_STATE.EMPTY) {
                incorrectCells.push({r,c});
            }
        }
    }

    if (incorrectCells.length === 0) return;

    const {r, c} = incorrectCells[Math.floor(Math.random() * incorrectCells.length)];
    const cellElement = ui.gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);

    if (cellElement) {
        cellElement.classList.add('hint-flash');
        ui.hintBtn.disabled = true;

        setTimeout(() => {
            cellElement.classList.remove('hint-flash');
            playerGrid[r][c] = solutionGrid[r][c] === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER;
            
            checkSunkShips();
            updateGridDisplay();
            updateFleetDisplay();
            checkWinCondition();
            if (startTime) ui.hintBtn.disabled = false;
        }, 1000);
    }
}

/**
 * Scans the player grid, compares to solution, and populates the sunkShipSegments map.
 */
function checkSunkShips() {
    sunkShipSegments.clear();
    const playerShips = identifyShipsInGrid(playerGrid);
    const solutionSignatures = new Set(ships.map(s => s.segments.map(seg => `${seg.r},${seg.c}`).sort().join(';')));
    
    for (const pShip of playerShips) {
        const signature = pShip.segments.map(seg => `${seg.r},${seg.c}`).sort().join(';');
        if (solutionSignatures.has(signature)) {
            // It's a valid, sunk ship. Now determine parts.
            if (pShip.length === 1) {
                const {r, c} = pShip.segments[0];
                sunkShipSegments.set(`${r},${c}`, { part: 'submarine', rotation: 0 });
                continue;
            }

            const isVertical = pShip.segments.length > 1 && pShip.segments[0].c === pShip.segments[1].c;
            const sortedSegments = pShip.segments.sort((a, b) => isVertical ? a.r - b.r : a.c - b.c);

            // First segment is an end-cap
            const {r: r1, c: c1} = sortedSegments[0];
            sunkShipSegments.set(`${r1},${c1}`, { part: 'end', rotation: isVertical ? 0 : 270 });
            
            // Last segment is an end-cap
            const {r: rL, c: cL} = sortedSegments[sortedSegments.length - 1];
            sunkShipSegments.set(`${rL},${cL}`, { part: 'end', rotation: isVertical ? 180 : 90 });

            // Middle segments
            for (let i = 1; i < sortedSegments.length - 1; i++) {
                const {r, c} = sortedSegments[i];
                sunkShipSegments.set(`${r},${c}`, { part: 'middle', rotation: isVertical ? 0 : 90 });
            }
        }
    }
}

// --- Event Listeners and Init ---

/**
 * Initializes all event listeners for the application.
 */
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
    
    // Use a single listener on the container for efficiency
    ui.gridContainer.addEventListener('click', handleGridClick);
    
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

/**
 * Initial load function.
 */
window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

    const isMobile = /Mobi/i.test(navigator.userAgent);
    if (isMobile) { ui.fullscreenBtn.style.display = 'none'; }
    
    initEventListeners();
    generatePuzzle();
});

// --- Utility and Helper functions (some are unchanged but included for completeness) ---

function updatePuzzleParameters() {
    gridSize = parseInt(ui.gridSizeSelect.value, 10);
    difficulty = ui.difficultySelect.value;
    fleetConfig = FLEET_DEFINITIONS[gridSize];
}

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

function setUiLoading(isLoading, message = '') {
    document.querySelectorAll('button').forEach(btn => btn.disabled = isLoading);
    ui.loader.classList.toggle('hidden', !isLoading);
    ui.loaderText.textContent = message;
}

function updateFleetDisplay() {
    ui.fleetList.innerHTML = '';
    const sunkShips = identifyShipsInGrid(playerGrid, true); // Get only confirmed sunk ships
    const sunkCounts = {};
    sunkShips.forEach(ship => sunkCounts[ship.length] = (sunkCounts[ship.length] || 0) + 1);

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
        if (sunkCounts[length] >= count) {
            li.classList.add('found');
        }
        ui.fleetList.appendChild(li);
    });
}

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

function revealSolution() {
    if (!solutionGrid) return;
    playerGrid = solutionGrid.map(row => [...row]);
    checkSunkShips();
    updateGridDisplay();
    updateFleetDisplay();
    ui.hintBtn.disabled = true;
    ui.revealBtn.disabled = true;
    startTime = null;
}

function identifyShipsInGrid(targetGrid, mustBeCorrect = false) {
    const checked = Array(gridSize).fill(0).map(() => Array(gridSize).fill(false));
    const foundShips = [];
    const solutionSignatures = mustBeCorrect ? new Set(ships.map(s => s.segments.map(seg => `${seg.r},${seg.c}`).sort().join(';'))) : null;

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
                if (mustBeCorrect) {
                    const signature = ship.segments.map(seg => `${seg.r},${seg.c}`).sort().join(';');
                    if (solutionSignatures.has(signature)) foundShips.push(ship);
                } else {
                    foundShips.push(ship);
                }
            }
        }
    }
    return foundShips;
}

function formatTime(milliseconds) { const s = Math.floor(milliseconds / 1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

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