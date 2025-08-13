// Global UI element cache
const ui = {
    container: document.getElementById('container'),
    puzzleContainer: document.getElementById('puzzle-container'),
    gridContainer: document.getElementById('grid-container'),
    fleetList: document.getElementById('fleet-list'),
    fleetListFs: document.getElementById('fleet-list-fs'),
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loader-text'),
    bookLoader: document.getElementById('book-loader'),
    loaderTextBook: document.getElementById('loader-text-book'),
    cancelBookGenerationBtn: document.getElementById('cancel-book-generation-btn'),
    gridSizeSelect: document.getElementById('grid-size-select'),
    difficultySelect: document.getElementById('difficulty-select'),
    mistakeModeCheckbox: document.getElementById('mistake-mode-checkbox'),
    mainControls: document.getElementById('main-controls'),
    gameBoard: document.getElementById('game-board'),
    completionModal: document.getElementById('completion-modal'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    hintBtn: document.getElementById('hint-btn'),
    revealBtn: document.getElementById('reveal-btn'),
    checkBtn: document.getElementById('check-btn'),
    finishBtn: document.getElementById('finish-btn'),
    undoBtn: document.getElementById('undo-btn'),
    restartBtn: document.getElementById('restart-btn'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    makeBookBtn: document.getElementById('make-book-btn'),
    status: document.getElementById('source-status'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    generateBtn: document.getElementById('generate-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    generateBookPanel: document.getElementById('generate-book-panel'),
    createBookBtn: document.getElementById('create-book-btn'),
    cancelBookOptionsBtn: document.getElementById('cancel-book-options-btn'),
};

// Game state variables
let gridSize, difficulty, fleetConfig;
let solutionGrid, playerGrid, ships, rowClues, colClues, initialPlayerGrid;
let debounceTimeout;
let startTime, puzzleConfigKey;
let highlightedLine;
let foundShips = new Set();
let hintedCells = [];
let moveHistory = [];
let puzzleSolvability = null;
let selectedCell = { r: 0, c: 0 };
let isGeneratingBook = false;

// Game constants
const FLEET_DEFINITIONS = {
    8: { ships: [3, 2, 2, 1, 1, 1], clues: { easy: 22, medium: 16, hard: 12, expert: 8 } },
    10: { ships: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], clues: { easy: 40, medium: 30, hard: 22, expert: 15 } },
    12: { ships: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1], clues: { easy: 60, medium: 45, hard: 35, expert: 25 } }
};
const CELL_STATE = { EMPTY: 0, WATER: 1, SHIP: 2 };
const SHIP_ID = 2;

/**
 * Main function to generate and display a new puzzle.
 */
function generatePuzzle() {
    setUiLoading(true, 'Generating a fair puzzle...');
    
    setTimeout(() => {
        try {
            const puzzleData = generatePuzzleData();
            
            puzzleSolvability = true;
            hideCompletionModal();
            highlightedLine = { type: null, index: null };
            foundShips.clear();
            hintedCells = [];
            moveHistory = [];
            selectedCell = { r: 0, c: 0 };
            
            ui.hintBtn.disabled = false;
            ui.revealBtn.disabled = false;
            ui.finishBtn.disabled = false;

            solutionGrid = puzzleData.solutionGrid;
            ships = puzzleData.ships;
            rowClues = puzzleData.rowClues;
            colClues = puzzleData.colClues;
            playerGrid = puzzleData.playerGrid;
            initialPlayerGrid = JSON.parse(JSON.stringify(puzzleData.playerGrid));
            startTime = Date.now();

            puzzleConfigKey = `battleship-${gridSize}-${difficulty}`;
            ui.status.textContent = `Grid: ${gridSize}x${gridSize} | Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;

            applyAutoWaterLogic();
            checkForFoundShips();
            updateGridDisplay();
            updateUndoButton(); // Set initial state of undo button
            setUiLoading(false);
        } catch (error) {
            ui.status.textContent = `Error: ${error.message}. Please try again.`;
            setUiLoading(false);
        }
    }, 10);
}

/**
 * Renders the game grid.
 */
function updateGridDisplay(isFinished = false, errorCells = [], isFailedAttempt = false) {
    const isFullscreen = !!document.fullscreenElement;
    let containerSize;

    if (isFullscreen) {
        const isPortrait = window.innerHeight > window.innerWidth;
        if (isPortrait) {
            containerSize = window.innerWidth * 0.9;
        } else {
            const availableHeight = window.innerHeight * 0.85;
            const availableWidth = (window.innerWidth - 200 - 80);
            containerSize = Math.min(availableHeight, availableWidth);
        }
    } else {
        containerSize = ui.puzzleContainer.clientWidth;
    }

    if (containerSize === 0) return;

    const fullGridSize = gridSize + 1;
    const gap = 1;
    const totalGapSize = (fullGridSize - 1) * gap;
    const cellSize = Math.floor((containerSize - totalGapSize) / fullGridSize);
    const totalGridWidth = (fullGridSize * cellSize) + totalGapSize;

    ui.gridContainer.innerHTML = '';
    ui.gridContainer.style.gridTemplateColumns = `repeat(${fullGridSize}, ${cellSize}px)`;
    ui.gridContainer.style.gridTemplateRows = `repeat(${fullGridSize}, ${cellSize}px)`;
    ui.gridContainer.style.width = `${totalGridWidth}px`;
    ui.gridContainer.style.height = `${totalGridWidth}px`;

    const playerRowCounts = Array(gridSize).fill(0);
    const playerColCounts = Array(gridSize).fill(0);
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
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

            if (r === 0 && c > 0) {
                cell.className = 'grid-cell clue-cell';
                cell.textContent = colClues[c - 1];
                cell.dataset.clueType = 'col';
                cell.dataset.clueIndex = c - 1;
                if (playerColCounts[c - 1] === colClues[c - 1] && colClues[c - 1] !== 0) cell.classList.add('satisfied');
                if (isHighlighted) cell.classList.add('highlight');
            } else if (c === 0 && r > 0) {
                cell.className = 'grid-cell clue-cell';
                cell.textContent = rowClues[r - 1];
                cell.dataset.clueType = 'row';
                cell.dataset.clueIndex = r - 1;
                if (playerRowCounts[r - 1] === rowClues[r - 1] && rowClues[r - 1] !== 0) cell.classList.add('satisfied');
                if (isHighlighted) cell.classList.add('highlight');
            } else if (r > 0 && c > 0) {
                const gridR = r - 1;
                const gridC = c - 1;
                cell.className = 'grid-cell game-cell';
                cell.dataset.r = gridR;
                cell.dataset.c = gridC;
                if (gridR === selectedCell.r && gridC === selectedCell.c) cell.classList.add('selected-cell');
                if (isHighlighted) cell.classList.add('highlight');
                if (errorCells.some(e => e.r === gridR && e.c === gridC)) cell.classList.add('error-cell');
                if (hintedCells.some(h => h.r === gridR && h.c === gridC)) cell.classList.add('hint-cell');

                const state = playerGrid[gridR][gridC];

                if (state === CELL_STATE.WATER) {
                    cell.classList.add('water');
                } else if (state === CELL_STATE.SHIP) {
                    cell.classList.add('ship');
                    if (isFinished) {
                        const { part, rotation } = getSunkShipSegments().get(`${gridR},${gridC}`) || {};
                        if (part) {
                            cell.classList.add(isFailedAttempt ? 'revealed-fail' : 'revealed');
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
                    } else {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'ship-segment-placeholder';
                        cell.appendChild(placeholder);
                    }
                }
            } else {
                cell.className = 'grid-cell solvability-cell';
                if (puzzleSolvability === true) {
                    cell.innerHTML = `<span class="solvable-tick">✓</span>`;
                } else if (puzzleSolvability === false) {
                    cell.innerHTML = `<span class="unsolvable-cross">✗</span>`;
                }
            }
            ui.gridContainer.appendChild(cell);
        }
    }
}

function handleGridClick(e) {
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    if (cell.classList.contains('game-cell')) handleGameCellClick(cell);
    else if (cell.classList.contains('clue-cell')) handleClueCellClick(cell);
}

function handleGameCellClick(cell) {
    if (startTime === null) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    
    // Save state BEFORE modification for undo
    moveHistory.push(JSON.parse(JSON.stringify(playerGrid)));
    if (moveHistory.length > 10) moveHistory.shift();
    
    selectedCell.r = r;
    selectedCell.c = c;
    let currentState = playerGrid[r][c];
    let nextState = (currentState + 1) % 3;
    if (ui.mistakeModeCheckbox.checked && nextState === CELL_STATE.SHIP && solutionGrid[r][c] !== SHIP_ID) {
        cell.classList.add('error-flash');
        moveHistory.pop(); // Remove the saved state since the move was invalid
        return;
    }

    cell.classList.remove('error-flash');
    playerGrid[r][c] = nextState;
    
    applyAutoWaterLogic();
    checkForFoundShips();
    updateGridDisplay();
    updateUndoButton();
}

function applyAutoWaterLogic() {
    const playerRowCounts = Array(gridSize).fill(0);
    const playerColCounts = Array(gridSize).fill(0);
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (playerGrid[r][c] === CELL_STATE.SHIP) {
                playerRowCounts[r]++;
                playerColCounts[c]++;
            }
        }
    }

    for (let r = 0; r < gridSize; r++) {
        if (playerRowCounts[r] === rowClues[r]) {
            for (let c = 0; c < gridSize; c++) {
                if (playerGrid[r][c] === CELL_STATE.EMPTY) {
                    playerGrid[r][c] = CELL_STATE.WATER;
                }
            }
        }
    }
    for (let c = 0; c < gridSize; c++) {
        if (playerColCounts[c] === colClues[c]) {
            for (let r = 0; r < gridSize; r++) {
                if (playerGrid[r][c] === CELL_STATE.EMPTY) {
                    playerGrid[r][c] = CELL_STATE.WATER;
                }
            }
        }
    }
}

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

function checkSolution() {
    ui.puzzleContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (isCorrect) {
        const elapsedTime = Date.now() - startTime;
        startTime = null;
        ui.finishBtn.disabled = true;
        ui.hintBtn.disabled = true;
        handlePuzzleCompletion(elapsedTime);
        updateGridDisplay(true, [], false);
        updateFleetDisplay();
    } else {
        revealSolution(true);
    }
}

function checkWork() {
    ui.puzzleContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const errorCells = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (playerGrid[r][c] === CELL_STATE.SHIP && solutionGrid[r][c] !== SHIP_ID) {
                errorCells.push({ r, c });
            }
        }
    }
    if (errorCells.length > 0) {
        errorCells.forEach(({ r, c }) => {
            const cellEl = ui.gridContainer.querySelector(`[data-r='${r}'][data-c='${c}']`);
            if (cellEl) {
                cellEl.classList.add('check-work-error');
                setTimeout(() => cellEl.classList.remove('check-work-error'), 2500);
            }
        });
    } else {
        ui.status.textContent = 'No mistakes found in your ship placements so far!';
        setTimeout(() => {
            ui.status.textContent = `Grid: ${gridSize}x${gridSize} | Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
        }, 2000);
    }
}

function initEventListeners() {
    ui.generateBtn.addEventListener('click', generatePuzzle);
    ui.hintBtn.addEventListener('click', giveHint);
    ui.revealBtn.addEventListener('click', () => revealSolution(false));
    ui.finishBtn.addEventListener('click', checkSolution);
    ui.checkBtn.addEventListener('click', checkWork);
    ui.undoBtn.addEventListener('click', undoMove);
    ui.restartBtn.addEventListener('click', restartPuzzle);
    ui.downloadPdfBtn.addEventListener('click', downloadPdf);
    ui.makeBookBtn.addEventListener('click', () => showPanel(ui.generateBookPanel));
    ui.cancelBookOptionsBtn.addEventListener('click', hidePanel);
    ui.createBookBtn.addEventListener('click', createAndDownloadBook);
    ui.cancelBookGenerationBtn.addEventListener('click', () => { isGeneratingBook = false; });
    ui.playAgainBtn.addEventListener('click', generatePuzzle);
    ui.completionModal.addEventListener('click', hideCompletionModal);
    ui.gridSizeSelect.addEventListener('change', handleGlobalOptionChange);
    ui.difficultySelect.addEventListener('change', handleGlobalOptionChange);
    ui.fullscreenBtn.addEventListener('click', toggleFullScreen);
    ui.themeToggleBtn.addEventListener('click', () => setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark'));
    ui.gridContainer.addEventListener('click', handleGridClick);

    document.addEventListener('fullscreenchange', () => {
        document.body.classList.toggle('fullscreen-active', !!document.fullscreenElement);
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(updateGridDisplay, 100);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleFullScreen();
            return;
        }
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || startTime === null) return;

        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'n': generatePuzzle(); break;
            case 'h': giveHint(); break;
            case 'e': checkSolution(); break;
            case 'u': undoMove(); break;
            case 'c': checkWork(); break;
            case 'arrowup': selectedCell.r = Math.max(0, selectedCell.r - 1); break;
            case 'arrowdown': selectedCell.r = Math.min(gridSize - 1, selectedCell.r + 1); break;
            case 'arrowleft': selectedCell.c = Math.max(0, selectedCell.c - 1); break;
            case 'arrowright': selectedCell.c = Math.min(gridSize - 1, selectedCell.c + 1); break;
            case ' ':
                const cell = ui.gridContainer.querySelector(`[data-r='${selectedCell.r}'][data-c='${selectedCell.c}']`);
                if (cell) handleGameCellClick(cell);
                break;
            default: handled = false;
        }

        if (handled) {
            e.preventDefault();
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
                updateGridDisplay();
            }
        }
    });
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

function runSolver(grid, rowClues, colClues) {
    const size = grid.length;
    let changedInPass = true;
    while (changedInPass) {
        changedInPass = false;
        const rowShipCount = Array(size).fill(0);
        const colShipCount = Array(size).fill(0);
        const rowEmptyCount = Array(size).fill(0);
        const colEmptyCount = Array(size).fill(0);
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c] === CELL_STATE.SHIP) {
                    rowShipCount[r]++;
                    colShipCount[c]++;
                } else if (grid[r][c] === CELL_STATE.EMPTY) {
                    rowEmptyCount[r]++;
                    colEmptyCount[c]++;
                }
            }
        }
        for (let i = 0; i < size; i++) {
            if (rowShipCount[i] === rowClues[i]) {
                for (let c = 0; c < size; c++) if (grid[i][c] === CELL_STATE.EMPTY) { grid[i][c] = CELL_STATE.WATER; changedInPass = true; }
            }
            if (colShipCount[i] === colClues[i]) {
                for (let r = 0; r < size; r++) if (grid[r][i] === CELL_STATE.EMPTY) { grid[r][i] = CELL_STATE.WATER; changedInPass = true; }
            }
            if (rowShipCount[i] + rowEmptyCount[i] === rowClues[i]) {
                for (let c = 0; c < size; c++) if (grid[i][c] === CELL_STATE.EMPTY) { grid[i][c] = CELL_STATE.SHIP; changedInPass = true; }
            }
            if (colShipCount[i] + colEmptyCount[i] === colClues[i]) {
                for (let r = 0; r < size; r++) if (grid[r][i] === CELL_STATE.EMPTY) { grid[r][i] = CELL_STATE.SHIP; changedInPass = true; }
            }
        }
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c] === CELL_STATE.SHIP) {
                    for (let dr of [-1, 1]) {
                        for (let dc of [-1, 1]) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === CELL_STATE.EMPTY) {
                                grid[nr][nc] = CELL_STATE.WATER; changedInPass = true;
                            }
                        }
                    }
                }
            }
        }
    }
    return grid;
}

function verifySolvability(puzzle) {
    const solverGrid = JSON.parse(JSON.stringify(puzzle.playerGrid));
    const solvedGrid = runSolver(solverGrid, puzzle.rowClues, puzzle.colClues);
    for (let r = 0; r < puzzle.gridSize; r++) {
        for (let c = 0; c < puzzle.gridSize; c++) {
            const solverCell = solvedGrid[r][c] === CELL_STATE.SHIP ? SHIP_ID : 0;
            const solutionCell = puzzle.solutionGrid[r][c];
            if (solverCell !== solutionCell) return false;
        }
    }
    return true;
}

function restartPuzzle() {
    if (!initialPlayerGrid) return;
    playerGrid = JSON.parse(JSON.stringify(initialPlayerGrid));
    moveHistory = [];
    hintedCells = [];
    startTime = Date.now();
    updateUndoButton();
    checkForFoundShips();
    updateGridDisplay();
    ui.puzzleContainer.scrollIntoView({ behavior: 'smooth' });
}

function undoMove() {
    if (moveHistory.length === 0) return;
    playerGrid = moveHistory.pop();
    updateUndoButton();
    checkForFoundShips();
    updateGridDisplay();
}

function updateUndoButton() {
    if (ui.undoBtn) {
        ui.undoBtn.disabled = moveHistory.length === 0;
    }
}

function updatePuzzleParameters() {
    gridSize = parseInt(ui.gridSizeSelect.value, 10);
    difficulty = ui.difficultySelect.value;
    fleetConfig = FLEET_DEFINITIONS[gridSize];
}

function placeShipsOnGrid() {
    const grid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    const placedShips = [];
    const shipsToPlace = [...fleetConfig.ships];
    let shipIdCounter = 0;
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
                const newShip = { id: shipIdCounter++, segments: [], length: shipLength };
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
    
    let placedShipsResult = null;
    while(placedShipsResult === null) {
        placedShipsResult = placeShipsOnGrid();
    }

    const { grid, ships: placedShips } = placedShipsResult;
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
    
    const allCells = [];
    for(let r=0; r<gridSize; r++) {
        for(let c=0; c<gridSize; c++) {
            allCells.push({r,c});
        }
    }
    allCells.sort(() => 0.5 - Math.random());

    let finalPlayerGrid = grid.map(row => row.map(cell => cell === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER));
    const cluesToKeepCount = fleetConfig.clues[difficulty];
    let cellsToRemove = gridSize * gridSize - cluesToKeepCount;

    for(const cell of allCells) {
        if(cellsToRemove <= 0) break;

        const {r, c} = cell;
        const originalState = finalPlayerGrid[r][c];
        
        finalPlayerGrid[r][c] = CELL_STATE.EMPTY;
        
        const testPuzzle = {
            playerGrid: JSON.parse(JSON.stringify(finalPlayerGrid)),
            rowClues: rClues, colClues: cClues, solutionGrid: grid, gridSize: gridSize
        };

        if(!verifySolvability(testPuzzle)) {
            finalPlayerGrid[r][c] = originalState;
        } else {
            cellsToRemove--;
        }
    }
    
    rClues.forEach((clue, r) => { if (clue === 0) { for (let c = 0; c < gridSize; c++) finalPlayerGrid[r][c] = CELL_STATE.WATER; } });
    cClues.forEach((clue, c) => { if (clue === 0) { for (let r = 0; r < gridSize; r++) finalPlayerGrid[r][c] = CELL_STATE.WATER; } });

    return {
        gridSize, fleet: fleetConfig.ships, solutionGrid: grid, ships: placedShips, rowClues: rClues, colClues: cClues, playerGrid: finalPlayerGrid
    };
}


function setUiLoading(isLoading, message = '') {
    document.querySelectorAll('button, input, select').forEach(el => el.disabled = isLoading);
    ui.loader.classList.toggle('hidden', !isLoading);
    ui.loaderText.textContent = message;
}

function checkForFoundShips() {
    if (!ships) return;
    foundShips.clear();
    ships.forEach((ship) => {
        const isFound = ship.segments.every(
            seg => playerGrid[seg.r][seg.c] === CELL_STATE.SHIP
        );
        if (isFound) {
            foundShips.add(ship.id);
        }
    });
    updateFleetDisplay();
}

function getShipSegmentDetails(r, c) {
    if (!ships) return { isFound: false };
    for (const ship of ships) {
        for (const segment of ship.segments) {
            if (segment.r === r && segment.c === c) {
                return {
                    shipId: ship.id,
                    isFound: foundShips.has(ship.id)
                };
            }
        }
    }
    return { isFound: false };
}

function updateFleetDisplay() {
    const lists = [ui.fleetList, ui.fleetListFs];
    lists.forEach(list => { if (list) list.innerHTML = ''; });
    const shipCounts = {};
    if (!fleetConfig) return;
    fleetConfig.ships.forEach(len => shipCounts[len] = (shipCounts[len] || 0) + 1);
    const foundCounts = {};
    if (ships) {
        foundShips.forEach(shipId => {
            const ship = ships.find(s => s.id === shipId);
            if (ship) { foundCounts[ship.length] = (foundCounts[ship.length] || 0) + 1; }
        });
    }
    const sortedLengths = Object.keys(shipCounts).map(Number).sort((a, b) => b - a);
    sortedLengths.forEach(length => {
        const total = shipCounts[length];
        const numFound = foundCounts[length] || 0;
        const li = document.createElement('li');
        const icon = document.createElement('div');
        icon.className = 'ship-icon';
        for (let j = 0; j < length; j++) { icon.appendChild(document.createElement('div')); }
        const label = document.createElement('span');
        label.textContent = `x ${total}`;
        li.appendChild(icon);
        li.appendChild(label);
        if (numFound === total) { li.classList.add('found'); }
        lists.forEach(list => { if (list) list.appendChild(li.cloneNode(true)); });
    });
}

function revealSolution(isFailedAttempt = false) {
    if (!solutionGrid) return;
    startTime = null;
    playerGrid = solutionGrid.map(row => row.map(cell => cell === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER));
    checkForFoundShips();
    updateGridDisplay(true, [], isFailedAttempt);
    ui.hintBtn.disabled = true;
    ui.finishBtn.disabled = true;
    ui.revealBtn.disabled = true;
}

function getSunkShipSegments() {
    const segments = new Map();
    if (!ships) return segments;

    for (const ship of ships) {
        if (ship.length === 1) {
            const { r, c } = ship.segments[0];
            segments.set(`${r},${c}`, { part: 'submarine', rotation: 0 });
            continue;
        }

        const isVertical = ship.segments.length > 1 && ship.segments[0].c === ship.segments[1].c;
        const sortedSegments = ship.segments.sort((a, b) => isVertical ? a.r - b.r : a.c - b.c);

        // Define rotations. Default end piece SVG points right (0 deg).
        const firstEndRotation = isVertical ? 270 : 180; // Pointing UP or LEFT
        const lastEndRotation = isVertical ? 90 : 0;    // Pointing DOWN or RIGHT
        const middleRotation = isVertical ? 90 : 0;   // Rotated for vertical or horizontal alignment

        // Set the first segment (top or left end)
        const { r: r1, c: c1 } = sortedSegments[0];
        segments.set(`${r1},${c1}`, { part: 'end', rotation: firstEndRotation });

        // Set the last segment (bottom or right end)
        const { r: rL, c: cL } = sortedSegments[sortedSegments.length - 1];
        segments.set(`${rL},${cL}`, { part: 'end', rotation: lastEndRotation });

        // Set all middle segments
        for (let i = 1; i < sortedSegments.length - 1; i++) {
            const { r, c } = sortedSegments[i];
            segments.set(`${r},${c}`, { part: 'middle', rotation: middleRotation });
        }
    }
    return segments;
}


function giveHint() {
    ui.puzzleContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Save state BEFORE hint for undo
    moveHistory.push(JSON.parse(JSON.stringify(playerGrid)));
    if (moveHistory.length > 10) moveHistory.shift();

    const solvedGrid = runSolver(JSON.parse(JSON.stringify(playerGrid)), rowClues, colClues);
    const possibleHints = [];

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (playerGrid[r][c] === CELL_STATE.EMPTY && solvedGrid[r][c] !== CELL_STATE.EMPTY) {
                possibleHints.push({ r, c, state: solvedGrid[r][c] });
            }
        }
    }

    if (possibleHints.length > 0) {
        const hint = possibleHints[Math.floor(Math.random() * possibleHints.length)];
        playerGrid[hint.r][hint.c] = hint.state;
        hintedCells.push({ r: hint.r, c: hint.c });
        
        applyAutoWaterLogic();
        checkForFoundShips();
        updateGridDisplay();
        updateUndoButton();
    } else {
        moveHistory.pop(); // No hint was given, so remove the saved state
        ui.status.textContent = 'No more logical moves could be found.';
        setTimeout(() => {
            ui.status.textContent = `Grid: ${gridSize}x${gridSize} | Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
        }, 2000);
    }
}

function formatTime(milliseconds) { const s = Math.floor(milliseconds / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

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
    const target = ui.gameBoard;
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

// --- PDF Generation ---
function showPanel(panel) {
    ui.mainControls.style.display = 'none';
    ui.generateBookPanel.style.display = 'none';
    if (panel) panel.style.display = 'block';
}

function hidePanel() {
    ui.mainControls.style.display = 'grid';
    ui.generateBookPanel.style.display = 'none';
}

function downloadPdf() {
    if (!playerGrid) { alert("Please generate a puzzle first."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const puzzleData = {
        grid: playerGrid,
        rowClues: rowClues,
        colClues: colClues,
        gridSize: gridSize,
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
        fleet: fleetConfig.ships
    };
    drawPuzzlesOnPage(doc, [puzzleData], 0, { puzzlesPerPage: 1, includePageNumbers: false });
    doc.save(`Battleships-${gridSize}x${gridSize}-${difficulty}.pdf`);
}

async function createAndDownloadBook() {
    const bookOptions = {
        title: document.getElementById('book-title-input').value.trim(),
        subtitle: document.getElementById('book-subtitle-input').value.trim(),
        puzzleCount: parseInt(document.getElementById('puzzle-count-input').value, 10),
        puzzlesPerPage: parseInt(document.getElementById('puzzles-per-page-select').value, 10),
        includeSolutions: document.getElementById('answer-key-checkbox').checked,
        includePageNumbers: document.getElementById('page-numbers-checkbox').checked
    };

    if (isNaN(bookOptions.puzzleCount) || bookOptions.puzzleCount < 1 || bookOptions.puzzleCount > 100) { alert("Please enter a number of puzzles between 1 and 100."); return; }
    
    isGeneratingBook = true;
    ui.container.style.display = 'none';
    ui.bookLoader.classList.remove('hidden');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.deletePage(1);

    const allPuzzlesData = [];
    try {
        for (let i = 1; i <= bookOptions.puzzleCount; i++) {
            if (!isGeneratingBook) throw new Error("Cancelled");
            ui.loaderTextBook.textContent = `Generating Puzzle ${i} of ${bookOptions.puzzleCount}...`;
            await new Promise(r => setTimeout(r, 10)); 
            const puzzleData = generatePuzzleData();
            allPuzzlesData.push({
                grid: puzzleData.playerGrid,
                solutionGrid: puzzleData.solutionGrid,
                rowClues: puzzleData.rowClues,
                colClues: puzzleData.colClues,
                gridSize: puzzleData.gridSize,
                difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
                fleet: puzzleData.fleet
            });
        }

        ui.loaderTextBook.textContent = `Building PDF...`;
        await new Promise(r => setTimeout(r, 10));

        if (bookOptions.title) {
            doc.addPage();
            const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
            doc.setFont('helvetica', 'bold').setFontSize(30).text(bookOptions.title, pageW/2, pageH/2 - 10, {align: 'center'});
            if (bookOptions.subtitle) doc.setFont('helvetica', 'normal').setFontSize(16).text(bookOptions.subtitle, pageW/2, pageH/2 + 5, {align: 'center'});
        }

        for (let i = 0; i < allPuzzlesData.length; i += bookOptions.puzzlesPerPage) {
            if (!isGeneratingBook) throw new Error("Cancelled");
            doc.addPage();
            drawPuzzlesOnPage(doc, allPuzzlesData, i, bookOptions);
        }
        
        if (bookOptions.includeSolutions) {
            if (!isGeneratingBook) throw new Error("Cancelled");
            ui.loaderTextBook.textContent = "Generating Answer Key...";
            await new Promise(r => setTimeout(r, 50));
            drawAnswerKeyPage(doc, allPuzzlesData);
        }
        
        const safeTitle = (bookOptions.title.replace(/[^a-zA-Z0-9]/g, '-') || `Battleships-Book`).substring(0, 50);
        doc.save(`${safeTitle}.pdf`);
        ui.status.textContent = "Book successfully generated!";

    } catch (error) {
        ui.status.textContent = `Error: ${error.message === "Cancelled" ? "Book generation cancelled." : error.message}`;
    } finally {
        isGeneratingBook = false;
        ui.container.style.display = '';
        ui.bookLoader.classList.add('hidden');
        setUiLoading(false);
        hidePanel();
    }
}

function drawSingleBattleshipsGrid(doc, puzzleData, startX, startY, gridTotalSize, showSolution = false) {
    const {grid, rowClues, colClues, gridSize, solutionGrid} = puzzleData;
    const fullGridSize = gridSize + 1;
    const cellSize = gridTotalSize / fullGridSize;
    const fontSize = (cellSize * 0.6) / 0.352778; 
    
    doc.setFont('helvetica', 'bold').setFontSize(fontSize).setTextColor(0,0,0);

    for(let i=0; i<gridSize; i++){
        doc.text(String(colClues[i]), startX + (i + 1.5) * cellSize, startY + cellSize * 0.5, { align: 'center', baseline: 'middle' });
        doc.text(String(rowClues[i]), startX + cellSize * 0.5, startY + (i + 1.5) * cellSize, { align: 'center', baseline: 'middle' });
    }
    
    const gridToDraw = showSolution ? solutionGrid.map(row => row.map(cell => cell === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER)) : grid;

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cellX = startX + (c + 1) * cellSize;
            const cellY = startY + (r + 1) * cellSize;
            const state = gridToDraw[r][c];

            if(state === CELL_STATE.WATER) {
                doc.setFillColor(200, 200, 200);
                doc.rect(cellX, cellY, cellSize, cellSize, 'F');
            } else if (state === CELL_STATE.SHIP) {
                 doc.setFillColor(0, 0, 0); // Black
                 doc.rect(cellX + cellSize * 0.2, cellY + cellSize * 0.2, cellSize * 0.6, cellSize * 0.6, 'F');
            }
        }
    }
    
    doc.setDrawColor(0,0,0);
    for (let i = 0; i <= fullGridSize; i++) {
        const isThick = i === 0 || i === fullGridSize || i === 1;
        doc.setLineWidth(isThick ? 0.4 : 0.2);
        doc.line(startX, startY + i * cellSize, startX + gridTotalSize, startY + i * cellSize);
        doc.line(startX + i * cellSize, startY, startX + i * cellSize, startY + gridTotalSize);
    }
}

function drawPuzzlesOnPage(doc, puzzles, startIndex, options) {
    const { puzzlesPerPage, includePageNumbers } = options;
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), cornerRadius = 3;
    const layouts = {
        1: [{ x: (pageW - 120) / 2, y: 40, size: 120 }],
        2: [{ x: (pageW - 75) / 2, y: 30, size: 75 }, { x: (pageW - 75) / 2, y: 165, size: 75 }],
        4: [
            { x: 20, y: 30, size: 75 }, { x: pageW - 75 - 20, y: 30, size: 75 },
            { x: 20, y: 165, size: 75 }, { x: pageW - 75 - 20, y: 165, size: 75 }
        ]
    };
    const layout = layouts[puzzlesPerPage] || layouts[1];

    for (let i = 0; i < puzzlesPerPage; i++) {
        const puzzleIndex = startIndex + i;
        if (puzzleIndex >= puzzles.length) break;
        
        const puzzleData = puzzles[puzzleIndex];
        const { x, y, size } = layout[i];
        const padding = 5;
        const fleetAreaHeight = 35; 

        // --- Draw Header ---
        const titleText = `Puzzle ${puzzleIndex + 1}`;
        const headerCenterX = x + size / 2;
        const headerY = y - 12;
        
        doc.setFont('helvetica', 'bold').setFontSize(12).text(titleText, headerCenterX, headerY, { align: 'center' });
        doc.setFont('helvetica', 'normal').setFontSize(9).text(`Difficulty: ${puzzleData.difficulty}`, headerCenterX, headerY + 5, { align: 'center' });
        
        // --- Draw Grid ---
        drawSingleBattleshipsGrid(doc, puzzleData, x, y, size, false);

        // --- Draw Fleet Key ---
        if (puzzleData.fleet) {
            const shipCounts = {};
            puzzleData.fleet.forEach(len => shipCounts[len] = (shipCounts[len] || 0) + 1);
            const sortedLengths = Object.keys(shipCounts).map(Number).sort((a, b) => b - a);
            
            const fleetCenterX = x + size / 2;
            let fleetStartY = y + size + 8; 

            doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(0,0,0);
            doc.text('Fleet', fleetCenterX, fleetStartY, { align: 'center' });
            fleetStartY += 8;

            doc.setFont('helvetica', 'normal').setFontSize(9);
            const iconSegmentSize = 3.5;
            const iconGap = 0.7;
            const textGap = 4;
            const lineHeight = iconSegmentSize + 3.5;
            
            const availableHeight = fleetAreaHeight - 16;
            const requiredHeight = sortedLengths.length * lineHeight;

            const getColumnWidth = (items) => {
                let maxWidth = 0;
                if (!items) return 0;
                for (const length of items) {
                    const text = `x ${shipCounts[length]}`;
                    const iconWidth = length * iconSegmentSize + (length - 1) * iconGap;
                    maxWidth = Math.max(maxWidth, iconWidth + textGap + doc.getTextWidth(text));
                }
                return maxWidth;
            };

            const drawColumn = (items, startX, startY, colWidth) => {
                let currentY = startY;
                for(const length of items) {
                    const text = `x ${shipCounts[length]}`;
                    const iconWidth = length * iconSegmentSize + (length - 1) * iconGap;
                    const itemWidth = iconWidth + textGap + doc.getTextWidth(text);
                    const itemStartX = startX + (colWidth - itemWidth) / 2;

                    doc.setFillColor(0, 0, 0);
                    for (let j = 0; j < length; j++) {
                        doc.rect(itemStartX + j * (iconSegmentSize + iconGap), currentY - (iconSegmentSize/2), iconSegmentSize, iconSegmentSize, 'F');
                    }
                    doc.text(text, itemStartX + iconWidth + textGap, currentY, { baseline: 'middle' });
                    currentY += lineHeight;
                }
            };
            
            if (requiredHeight > availableHeight && sortedLengths.length > 1) {
                // Two-column layout
                const splitPoint = Math.ceil(sortedLengths.length / 2);
                const col1Items = sortedLengths.slice(0, splitPoint);
                const col2Items = sortedLengths.slice(splitPoint);
                
                const col1Width = getColumnWidth(col1Items);
                const col2Width = getColumnWidth(col2Items);
                const colGap = 5;
                const totalWidth = col1Width + col2Width + colGap;

                const blockStartX = fleetCenterX - totalWidth / 2;
                drawColumn(col1Items, blockStartX, fleetStartY, col1Width);
                drawColumn(col2Items, blockStartX + col1Width + colGap, fleetStartY, col2Width);
            } else {
                // Original single-column layout
                const colWidth = getColumnWidth(sortedLengths);
                const startX = fleetCenterX - colWidth / 2;
                let currentY = fleetStartY;
                for(const length of sortedLengths) {
                    doc.setFillColor(0, 0, 0);
                    const count = shipCounts[length];
                    const text = `x ${count}`;
                    const iconWidth = length * iconSegmentSize + (length - 1) * iconGap;

                    for (let j = 0; j < length; j++) {
                        doc.rect(startX + j * (iconSegmentSize + iconGap), currentY - (iconSegmentSize/2), iconSegmentSize, iconSegmentSize, 'F');
                    }
                    doc.text(text, startX + iconWidth + textGap, currentY, { baseline: 'middle' });
                    currentY += lineHeight;
                }
            }
        }
        
        // --- Draw Border last to be on top ---
        const borderX = x - padding;
        const borderY = y - padding;
        const borderWidth = size + (padding * 2);
        const borderHeight = size + padding + fleetAreaHeight;
        doc.setDrawColor(0).setLineWidth(0.6).roundedRect(borderX, borderY, borderWidth, borderHeight, cornerRadius, cornerRadius, 'S');
    }

    if (includePageNumbers) doc.setFont('helvetica', 'normal').setFontSize(8).text(String(Math.floor(startIndex / puzzlesPerPage) + 1), pageW / 2, pageH - 10, { align: 'center' });
}

function drawAnswerKeyPage(doc, allPuzzlesData) {
    doc.addPage();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    doc.setFont('helvetica', 'bold').setFontSize(20).text("Answer Key", pageW / 2, margin, { align: 'center' });

    const puzzlesPerPage = 6;
    const cols = 2;
    const rows = 3;
    const cellW = (pageW - margin * 2) / cols;
    const cellH = (doc.internal.pageSize.getHeight() - margin * 2 - 10) / rows;

    allPuzzlesData.forEach((puzzleData, index) => {
        if (index > 0 && index % puzzlesPerPage === 0) {
            doc.addPage();
            doc.setFont('helvetica', 'bold').setFontSize(20).text("Answer Key", pageW / 2, margin, { align: 'center' });
        }

        const puzzleNumber = index + 1;
        const i = index % puzzlesPerPage;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const startX = margin + col * cellW;
        const startY = margin + 10 + row * cellH;

        doc.setFont('helvetica', 'bold').setFontSize(10).text(`Puzzle ${puzzleNumber}`, startX + cellW / 2, startY + 8, { align: 'center' });

        const gridTotalSize = Math.min(cellW * 0.7, cellH * 0.7);
        const gridStartX = startX + (cellW - gridTotalSize) / 2;
        const gridStartY = startY + 12;

        drawSingleBattleshipsGrid(doc, puzzleData, gridStartX, gridStartY, gridTotalSize, true);
    });
}