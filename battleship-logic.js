// Global UI element cache
const ui = {
    gridContainer: document.getElementById('grid-container'),
    fleetList: document.getElementById('fleet-list'),
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loader-text'),
    gridSizeSelect: document.getElementById('grid-size-select'),
    difficultySelect: document.getElementById('difficulty-select'),
    mainControls: document.getElementById('main-controls'),
    generateBookControls: document.getElementById('generate-book-controls'),
    gameBoard: document.getElementById('game-board'),
    completionModal: document.getElementById('completion-modal'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    hintBtn: document.getElementById('hint-btn'),
    revealBtn: document.getElementById('reveal-btn'),
    status: document.getElementById('source-status'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    generateBtn: document.getElementById('generate-btn'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    makeBookBtn: document.getElementById('make-book-btn'),
    createBookBtn: document.getElementById('create-book-btn'),
    cancelBookBtn: document.getElementById('cancel-book-options-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    cancelGenBtn: document.getElementById('cancel-btn')
};

// Game state variables
let gridSize, difficulty, fleetConfig;
let solutionGrid, playerGrid, ships, rowClues, colClues;
let isGeneratingBook = false;
let pdfWorker = null;
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
    // Try to generate a valid board a few times before giving up
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
    
    // Generate initial hints based on difficulty
    const initialHints = [];
    const hintCount = fleetConfig.hints[difficulty];
    const possibleHintCells = [];
    for (let r=0; r < gridSize; r++) {
        for (let c=0; c < gridSize; c++) {
            possibleHintCells.push({r, c});
        }
    }
    // Shuffle and pick hints
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
            // Check area around the ship for conflicts (including diagonals)
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
        if (!placed) return null; // Failed to place a ship, restart the whole process
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

    // Using a timeout allows the loader to render before the potentially blocking generation logic
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
    const containerWidth = ui.puzzleContainer.clientWidth;
    const fullGridSize = gridSize + 1;
    const cellSize = Math.floor(containerWidth / fullGridSize);

    ui.gridContainer.innerHTML = '';
    ui.gridContainer.style.gridTemplateColumns = `repeat(${fullGridSize}, ${cellSize}px)`;
    ui.gridContainer.style.gridTemplateRows = `repeat(${fullGridSize}, ${cellSize}px)`;

    // Calculate current ship counts for clue styling
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
                cell.className = 'grid-cell'; // Top-left corner cell
            } else if (r === 0) { // Column clues
                cell.className = 'grid-cell clue-cell';
                cell.textContent = colClues[c - 1];
                if (playerColCounts[c - 1] === colClues[c - 1]) {
                     cell.classList.add('satisfied');
                }
            } else if (c === 0) { // Row clues
                cell.className = 'grid-cell clue-cell';
                cell.textContent = rowClues[r - 1];
                 if (playerRowCounts[r - 1] === rowClues[r - 1]) {
                     cell.classList.add('satisfied');
                }
            } else { // Game cells
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
    
    // Identify fully-formed ships in the player's grid that match the solution
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
    
    // Cycle state: EMPTY -> SHIP -> WATER -> EMPTY
    const currentState = playerGrid[r][c];
    let nextState = CELL_STATE.EMPTY;
    if(currentState === CELL_STATE.EMPTY) nextState = CELL_STATE.SHIP;
    if(currentState === CELL_STATE.SHIP) nextState = CELL_STATE.WATER;
    if(currentState === CELL_STATE.WATER) nextState = CELL_STATE.EMPTY;
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
                // If a ship is placed where there should be water, it's not a win.
                if (playerGrid[r][c] === CELL_STATE.SHIP) {
                    incorrectShipPlacement = true;
                }
            }
        }
    }

    if (!incorrectShipPlacement && correctShipCells === totalShipCells) {
        const elapsedTime = Date.now() - startTime;
        handlePuzzleCompletion(elapsedTime);
        revealSolution(); // Show confirmed state
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
    startTime = null; // Stop game
    updateFleetDisplay(); // Mark all as found
}

/**
 * Provides a hint by revealing one incorrect cell's correct state.
 */
function giveHint() {
    const incorrectCells = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const solutionState = solutionGrid[r][c] === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER;
            const playerState = playerGrid[r][c];
            // An incorrect cell is one that is NOT empty and doesn't match the solution
            if (playerState !== CELL_STATE.EMPTY && playerState !== solutionState) {
                incorrectCells.push({r, c});
            }
        }
    }
    
    // If no specific errors, find an un-guessed correct cell
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
    const solutionState = solutionGrid[r][c] === SHIP_ID ? CELL_STATE.SHIP : CELL_STATE.WATER;
    playerGrid[r][c] = solutionState;
    
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

/**
 * Initiates a PDF download of the current puzzle.
 */
function downloadPdf() {
    if (!solutionGrid) { alert("Please generate a puzzle first."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const puzzleData = { gridSize, fleet: fleetConfig.ships, rowClues, colClues, solutionGrid, ships };
    drawPuzzleOnPdfPage(doc, puzzleData, null, false);
    doc.save(`Battleship-Solo-${gridSize}x${gridSize}.pdf`);
}

// --- PDF Drawing Functions ---
function drawPuzzleOnPdfPage(doc, puzzleData, pageNum, includePageNumbers) {
    const { gridSize, fleet, rowClues, colClues } = puzzleData;
   const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 15;
   let currentY = margin;

   doc.setFont('helvetica', 'bold').setFontSize(16).text("Battleship Solo Puzzle", pageW / 2, currentY, { align: 'center' });
   currentY += 12;

   // Draw Fleet
   doc.setFont('helvetica', 'bold').setFontSize(12).text("Fleet to Find:", margin, currentY);
   currentY += 6;
   doc.setFont('helvetica', 'normal').setFontSize(10);
   const shipCounts = {};
   fleet.forEach(len => shipCounts[len] = (shipCounts[len] || 0) + 1);
   let fleetTextY = currentY;
   Object.keys(shipCounts).sort((a,b)=>b-a).forEach(length => {
       doc.text(`${shipCounts[length]} x ${length}-unit ship`, margin, fleetTextY);
       fleetTextY += 5;
   });

   // Draw Grid
   const gridTotalSize = 120;
   const fullGridSize = gridSize + 1;
   const cellSize = gridTotalSize / fullGridSize;
   const startX = (pageW - gridTotalSize) / 2;
   const startY = currentY + 10;

   doc.setFont('helvetica', 'bold').setFontSize(10);
   doc.setLineWidth(0.2).setDrawColor(0);

   for (let r = 0; r < fullGridSize; r++) {
       for (let c = 0; c < fullGridSize; c++) {
           const xPos = startX + c * cellSize;
           const yPos = startY + r * cellSize;
           doc.rect(xPos, yPos, cellSize, cellSize, 'S');
           if (r === 0 && c > 0) { // Col clues
               doc.text(String(colClues[c - 1]), xPos + cellSize / 2, yPos + cellSize / 2, { align: 'center', baseline: 'middle' });
           }
           if (c === 0 && r > 0) { // Row clues
               doc.text(String(rowClues[r - 1]), xPos + cellSize / 2, yPos + cellSize / 2, { align: 'center', baseline: 'middle' });
           }
       }
   }

   if (includePageNumbers && pageNum) {
       doc.setFont('helvetica', 'normal').setFontSize(8).text(String(pageNum), pageW / 2, pageH - (margin / 2), { align: 'center' });
   }
}

function drawAnswerKey(doc, allPuzzlesData, includePageNumbers) {
    doc.addPage();
   const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 15;
   doc.setFont('helvetica', 'bold').setFontSize(20).text("Answer Key", pageW / 2, margin, { align: 'center' });
   
   const puzzlesPerPage = 6, cols = 2, rows = 3;
   const cellW = (pageW - margin * 2) / cols, cellH = (pageH - margin * 2) / rows;

   allPuzzlesData.forEach((puzzleData, index) => {
       if (index > 0 && index % puzzlesPerPage === 0) {
           doc.addPage();
           doc.setFont('helvetica', 'bold').setFontSize(20).text("Answer Key", pageW / 2, margin, { align: 'center' });
       }
       const puzzleNumber = index + 1;
       const i = index % puzzlesPerPage;
       const col = i % cols, row = Math.floor(i / cols);
       const startX = margin + col * cellW, startY = margin + row * cellH;

       let labelText = `${puzzleData.gridSize}x${puzzleData.gridSize} Puzzle`;
       if (includePageNumbers) { labelText = `Puzzle ${puzzleNumber}`; }
       doc.setFont('helvetica', 'bold').setFontSize(10).text(labelText, startX + cellW / 2, startY + 8, { align: 'center' });

       const gridTotalSize = 60, cellSize = gridTotalSize / puzzleData.gridSize;
       const gridStartX = startX + (cellW - gridTotalSize) / 2, gridStartY = startY + 12;

       doc.setDrawColor(150);
       puzzleData.ships.forEach(ship => {
           ship.segments.forEach(seg => {
               doc.setFillColor(200, 200, 200).rect(gridStartX + seg.c * cellSize, gridStartY + seg.r * cellSize, cellSize, cellSize, 'F');
           });
       });
       doc.setDrawColor(0).rect(gridStartX, gridStartY, gridTotalSize, gridTotalSize, 'S');
   });
}

// --- Book Generation & Worker ---
function showBookOptions() { ui.mainControls.style.display = 'none'; ui.generateBookControls.style.display = 'block'; }
function resetBookUI() { ui.mainControls.style.display = 'grid'; ui.generateBookControls.style.display = 'none'; }

async function downloadBook() {
    const puzzleCount = parseInt(document.getElementById('puzzle-count-input').value, 10);
    if (isNaN(puzzleCount) || puzzleCount < 1 || puzzleCount > 100) { alert("Please enter a number between 1 and 100."); return; }

    isGeneratingBook = true;
    setUiLoading(true, `Preparing to generate ${puzzleCount} puzzles...`);
    ui.loader.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ui.cancelGenBtn.style.display = 'block';
    ui.cancelGenBtn.disabled = false;
    
    const bookOptions = {
        includeAnswerKey: document.getElementById('answer-key-checkbox').checked,
        includePageNumbers: document.getElementById('page-numbers-checkbox').checked,
        bookTitle: document.getElementById('book-title-input').value.trim() || "My Battleship Puzzle Book",
        bookSubtitle: document.getElementById('book-subtitle-input').value.trim(),
        puzzleCount
    };
    
    try {
        // Phase 1: Gather all puzzle data
        ui.loaderText.textContent = `Generating data for ${puzzleCount} puzzles...`;
        const allPuzzlesData = [];
        for (let i = 0; i < puzzleCount; i++) {
            if (!isGeneratingBook) throw new Error("Cancelled");
            try {
                allPuzzlesData.push(generatePuzzleData());
            } catch (e) { console.warn("Skipping a failed puzzle generation for the book.") }
        }
        
        if (!isGeneratingBook) throw new Error("Cancelled");
        if (allPuzzlesData.length === 0) throw new Error("Failed to generate data for any puzzles.");

        await createPdfInWorker({ ...bookOptions, allPuzzlesData });
        ui.status.textContent = "Book successfully generated!";

    } catch (error) {
        if (error.message === "Cancelled") { ui.status.textContent = "Book generation cancelled."; } 
        else { ui.status.textContent = `Error: ${error.message}`; console.error("Book generation failed:", error); }
    } finally {
        if (pdfWorker) { pdfWorker.terminate(); pdfWorker = null; }
        isGeneratingBook = false;
        setUiLoading(false);
        resetBookUI();
        ui.cancelGenBtn.style.display = 'none';
        generatePuzzle(); // Generate a fresh puzzle for the screen
    }
}

function createPdfInWorker(payload) {
    return new Promise((resolve, reject) => {
       const workerScript = `
           self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
           
           // --- Paste drawPuzzleOnPdfPage and drawAnswerKey functions here ---
           // In a real project these would be imported, but for a single file they are duplicated.
           function drawPuzzleOnPdfPage(doc, puzzleData, pageNum, includePageNumbers) {
                const { gridSize, fleet, rowClues, colClues } = puzzleData;
                const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 15;
                let currentY = margin;
                doc.setFont('helvetica', 'bold').setFontSize(16).text("Battleship Solo Puzzle", pageW / 2, currentY, { align: 'center' });
                currentY += 12;
                doc.setFont('helvetica', 'bold').setFontSize(12).text("Fleet to Find:", margin, currentY);
                currentY += 6;
                doc.setFont('helvetica', 'normal').setFontSize(10);
                const shipCounts = {};
                fleet.forEach(len => shipCounts[len] = (shipCounts[len] || 0) + 1);
                let fleetTextY = currentY;
                Object.keys(shipCounts).sort((a,b)=>b-a).forEach(length => {
                    doc.text(shipCounts[length] + ' x ' + length + '-unit ship', margin, fleetTextY);
                    fleetTextY += 5;
                });
                const gridTotalSize = 120, fullGridSize = gridSize + 1, cellSize = gridTotalSize / fullGridSize;
                const startX = (pageW - gridTotalSize) / 2, startY = currentY + 10;
                doc.setFont('helvetica', 'bold').setFontSize(10).setLineWidth(0.2).setDrawColor(0);
                for (let r = 0; r < fullGridSize; r++) {
                    for (let c = 0; c < fullGridSize; c++) {
                        const xPos = startX + c * cellSize, yPos = startY + r * cellSize;
                        doc.rect(xPos, yPos, cellSize, cellSize, 'S');
                        if (r === 0 && c > 0) doc.text(String(colClues[c - 1]), xPos + cellSize / 2, yPos + cellSize / 2, { align: 'center', baseline: 'middle' });
                        if (c === 0 && r > 0) doc.text(String(rowClues[r - 1]), xPos + cellSize / 2, yPos + cellSize / 2, { align: 'center', baseline: 'middle' });
                    }
                }
                if (includePageNumbers && pageNum) doc.setFont('helvetica', 'normal').setFontSize(8).text(String(pageNum), pageW / 2, pageH - (margin / 2), { align: 'center' });
            }

            function drawAnswerKey(doc, allPuzzlesData, includePageNumbers) {
                doc.addPage();
                const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 15;
                doc.setFont('helvetica', 'bold').setFontSize(20).text("Answer Key", pageW / 2, margin, { align: 'center' });
                const puzzlesPerPage = 6, cols = 2, rows = 3;
                const cellW = (pageW - margin * 2) / cols, cellH = (pageH - margin * 2) / rows;
                allPuzzlesData.forEach((puzzleData, index) => {
                    if (index > 0 && index % puzzlesPerPage === 0) {
                        doc.addPage();
                        doc.setFont('helvetica', 'bold').setFontSize(20).text("Answer Key", pageW / 2, margin, { align: 'center' });
                    }
                    const puzzleNumber = index + 1;
                    const i = index % puzzlesPerPage;
                    const col = i % cols, row = Math.floor(i / cols);
                    const startX = margin + col * cellW, startY = margin + row * cellH;
                    let labelText = puzzleData.gridSize + 'x' + puzzleData.gridSize + ' Puzzle';
                    if (includePageNumbers) labelText = 'Puzzle ' + puzzleNumber;
                    doc.setFont('helvetica', 'bold').setFontSize(10).text(labelText, startX + cellW / 2, startY + 8, { align: 'center' });
                    const gridTotalSize = 60, cellSize = gridTotalSize / puzzleData.gridSize;
                    const gridStartX = startX + (cellW - gridTotalSize) / 2, gridStartY = startY + 12;
                    doc.setDrawColor(150);
                    puzzleData.ships.forEach(ship => {
                        ship.segments.forEach(seg => {
                            doc.setFillColor(200, 200, 200).rect(gridStartX + seg.c * cellSize, gridStartY + seg.r * cellSize, cellSize, cellSize, 'F');
                        });
                    });
                    doc.setDrawColor(0).rect(gridStartX, gridStartY, gridTotalSize, gridTotalSize, 'S');
                });
            }
           
           self.onmessage = function(e) {
               const { allPuzzlesData, bookTitle, bookSubtitle, includeAnswerKey, includePageNumbers, puzzleCount } = e.data;
               const { jsPDF } = self.jspdf;
               const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
               doc.deletePage(1); 
               
               if (bookTitle) {
                   doc.addPage();
                   const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
                   doc.setFont('helvetica', 'bold').setFontSize(30).text(bookTitle, pageW/2, pageH/2 - 10, {align: 'center'});
                   if (bookSubtitle) doc.setFont('helvetica', 'normal').setFontSize(16).text(bookSubtitle, pageW/2, pageH/2 + 5, {align: 'center'});
               }

               allPuzzlesData.forEach((puzzleData, index) => {
                   self.postMessage({ status: 'progress', text: 'Building PDF: Page ' + (index + 1) + ' of ' + puzzleCount });
                   doc.addPage();
                   drawPuzzleOnPdfPage(doc, puzzleData, index + 1, includePageNumbers);
               });
               
               if (includeAnswerKey) {
                   self.postMessage({ status: 'progress', text: 'Generating Answer Key...' });
                   drawAnswerKey(doc, allPuzzlesData, includePageNumbers);
               }
               
               const pdfBlob = doc.output('blob');
               self.postMessage({ status: 'complete', blob: pdfBlob });
           };
       `;
       const blob = new Blob([workerScript], { type: 'application/javascript' });
       pdfWorker = new Worker(URL.createObjectURL(blob));

       pdfWorker.onmessage = (e) => {
           if (e.data.status === 'progress') {
               ui.loaderText.textContent = e.data.text;
           } else if (e.data.status === 'complete') {
               const safeTitle = (payload.bookTitle.replace(/[^a-zA-Z0-9]/g, '-') || `Battleship-Solo-Book`).substring(0, 50);
               const url = URL.createObjectURL(e.data.blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = `${safeTitle}.pdf`;
               document.body.appendChild(a);
               a.click();
               document.body.removeChild(a);
               URL.revokeObjectURL(url);
               pdfWorker.terminate();
               pdfWorker = null;
               resolve();
           }
       };
       pdfWorker.onerror = (e) => {
           pdfWorker.terminate(); pdfWorker = null;
           reject(new Error(`PDF Worker error: ${e.message}`));
       };
       pdfWorker.postMessage(payload);
   });
}

/**
 * Cancels an in-progress book generation.
 */
function cancelBookGeneration() { 
    isGeneratingBook = false; 
    if (pdfWorker) { pdfWorker.terminate(); pdfWorker = null; }
}

// --- Utility & Helper Functions ---
/**
 * Scans a grid to identify contiguous groups of ship cells.
 * @param {Array<Array<number>>} targetGrid - The grid to analyze.
 * @returns {Array<object>} A list of found ship objects, with length and segment coordinates.
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
                    // Check neighbors
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
    startTime = null; // Stop game
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
    // Buttons
    ui.generateBtn.addEventListener('click', generatePuzzle);
    ui.hintBtn.addEventListener('click', giveHint);
    ui.revealBtn.addEventListener('click', revealSolution);
    ui.downloadPdfBtn.addEventListener('click', downloadPdf);
    ui.makeBookBtn.addEventListener('click', showBookOptions);
    ui.createBookBtn.addEventListener('click', downloadBook);
    ui.cancelBookBtn.addEventListener('click', resetBookUI);
    ui.playAgainBtn.addEventListener('click', generatePuzzle);
    ui.completionModal.addEventListener('click', hideCompletionModal);
    ui.cancelGenBtn.addEventListener('click', cancelBookGeneration);

    // Global Options
    ui.gridSizeSelect.addEventListener('change', handleGlobalOptionChange);
    ui.difficultySelect.addEventListener('change', handleGlobalOptionChange);

    // Header Controls
    ui.fullscreenBtn.addEventListener('click', toggleFullScreen);
    ui.themeToggleBtn.addEventListener('click', () => setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark'));

    // Grid Interaction
    ui.gridContainer.addEventListener('click', handleCellClick);
    
    // Keyboard Shortcuts
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
    // Apply saved or preferred theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

    // Hide fullscreen button on mobile devices as it's often not supported well
    const isMobile = /Mobi/i.test(navigator.userAgent);
    if (isMobile) { ui.fullscreenBtn.style.display = 'none'; }
    
    // Initialize all event listeners
    initEventListeners();
    
    // Generate the first puzzle
    generatePuzzle();
});