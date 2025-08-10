document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // --- UI ELEMENTS ---
    const ui = {
        storyText: document.getElementById('story-text'),
        echoHint: document.getElementById('echo-hint'),
        choicesButtons: document.getElementById('choices-buttons'),
        healthBar: document.getElementById('health-bar'),
        healthValue: document.getElementById('health-value'),
        inventoryList: document.getElementById('inventory-list'),
        actionLog: document.getElementById('action-log'),
        saveButton: document.getElementById('save-button'),
        loadButton: document.getElementById('load-button'),
        restartButton: document.getElementById('restart-button')
    };

    // --- MASTER GAME DATA (The unchanging blueprint) ---
    const masterRoomsData = {
        start: {
            description: "You stand at the entrance to a long-forgotten dungeon. A heavy wooden door looms in front of you. The air is thick with dust. A faint, cool breeze emanates from a crack in the wall to your left.",
            choices: [
                { text: "Examine the heavy door", action: 'examine', target: 'door' },
                { text: "Examine the crack in the wall", action: 'examine', target: 'crack' },
                { text: "Look around the room", action: 'examine', target: 'room' }
            ],
            onExamine: {
                door: "The door is made of heavy oak and is firmly barred from the other side. There's no way through here.",
                crack: "You find a hidden passage behind a loose section of the wall! It's a tight squeeze.",
                room: "You scan the dusty room. Against the wall rests a single, flickering torch. It might be useful."
            },
            item: { id: 'torch', name: 'Flickering Torch', attack: 5 },
            echo: "Perhaps the door is not the only way forward..."
        },
        goblinCorridor: {
            description: "You squeeze through the passage into a narrow corridor. A foul-smelling goblin holding a crude club is startled by your arrival!",
            enemy: { name: "Goblin", health: 30, maxHealth: 30, attack: 10, loot: { id: 'dragonKey', name: 'Dragon Key' } },
            choices: [ { text: "Flee back to the entrance", action: "move", target: "start" } ],
            echo: "Combat is dangerous. Do you have a weapon?"
        },
        corridorClear: {
            description: "The corridor is quiet now, the goblin's body a grim reminder of your victory. The path continues forward into darkness.",
            choices: [
                { text: "Go forward to a chamber", action: "move", target: "puzzleChamber" },
                { text: "Return to the entrance hall", action: "move", target: "start" }
            ],
            echo: "The key you found must fit a lock somewhere."
        },
        puzzleChamber: {
            description: "The corridor opens into a square chamber. A large stone door blocks your path. Intricate symbols are carved into it, with a single, dragon-shaped slot in the center. A faint whistling sound comes from a pile of rubble in the corner.",
            choices: [
                { text: "Examine the stone door", action: "examine", target: "puzzleDoor" },
                { text: "Examine the rubble", action: "examine", target: "rubble" },
                { text: "Go back to the corridor", action: "move", target: "corridorClear" }
            ],
            onExamine: {
                puzzleDoor: "The dragon-shaped slot seems to be waiting for a key.",
                rubble: "Hidden in the rubble, you find a small vial containing a shimmering red liquid."
            },
            item: { id: 'strengthPotion', name: 'Potion of Strength', attackBonus: 10 },
            echo: "A key with a unique shape might be needed for the door."
        },
        observatory: {
            description: "This room was once a grand observatory, but the ceiling has collapsed, leaving a massive hole open to the sky. Starlight filters down, illuminating a pedestal in the center of the room.",
            choices: [{ text: "Approach the pedestal", action: "examine", target: "pedestal" }],
            onExamine: { pedestal: "You approach the pedestal and see the source of the light: a magnificent, Glowing Gem that hums with energy." },
            item: { id: 'glowingGem', name: 'Glowing Gem' },
            echo: "Such a beautiful object must have a purpose."
        },
        archives: {
            description: "You've discovered a hidden library! Dusty tomes line the walls. A large, locked book sits on a lectern. It has a circular indentation on its cover.",
            choices: [{ text: "Examine the locked book", action: "examine", target: "book" }],
            onExamine: { book: "The heavy book is sealed by a lock with a circular indentation. It feels like something might fit there." },
            echo: "That indentation on the book looks familiar..."
        },
        secretEnd: {
            description: "The gem fits perfectly. The book opens, revealing the dungeon's history. The final page reveals a hidden exit behind a bookshelf. You have uncovered the truth!",
            choices: [{ text: "Escape with the knowledge", action: "win" }]
        },
        gameOver: {
            description: "You have been defeated. The darkness of the dungeon consumes you.",
            choices: [{ text: "Try Again", action: "restart" }]
        }
    };

    // --- GAME STATE (The dynamic, saveable progress) ---
    let gameState = {};
    let echoTimer = null;

    // --- GAME INITIALIZATION ---
    function startGame() {
        gameState = {
            player: { health: 100, maxHealth: 100, inventory: [], baseAttack: 2 },
            currentRoomId: 'start',
            roomStates: {} // Stores dynamic state like { start: { itemTaken: true }, ... }
        };
        // Initialize room states
        for (const roomId in masterRoomsData) {
            gameState.roomStates[roomId] = {};
        }
        render();
    }

    // --- CORE RENDERER ---
    function render() {
        resetEchoTimer();
        const roomData = masterRoomsData[gameState.currentRoomId];
        const roomState = gameState.roomStates[gameState.currentRoomId];

        if (!roomData) {
            ui.storyText.innerText = "ERROR: Room not found. Please restart.";
            console.error("Attempted to render non-existent room:", gameState.currentRoomId);
            return;
        }

        ui.storyText.innerText = roomData.description;
        ui.choicesButtons.innerHTML = '';
        logAction(''); // Clear log on every new render

        // --- Low Health Warning ---
        const isCritical = gameState.player.health > 0 && gameState.player.health / gameState.player.maxHealth <= 0.2;
        if (isCritical) {
            logAction("CRITICAL HEALTH! Use a potion before it's too late!", true);
            const healingPotions = gameState.player.inventory.filter(item => item.heal);
            if (healingPotions.length > 0) {
                healingPotions.forEach(potion => {
                    ui.choicesButtons.appendChild(createButton(`Use ${potion.name}`, () => useItem(potion.id)));
                });
            }
        }
        
        // --- Combat UI ---
        if (roomData.enemy && !roomState.enemyDefeated) {
             ui.choicesButtons.appendChild(createButton("Attack " + roomData.enemy.name, () => handleAction({ action: 'attack' })));
        }

        // --- Standard Choices ---
        if (roomData.choices) {
            roomData.choices.forEach(choice => {
                // Hide choices that are no longer relevant (e.g., examine after it's done)
                if (roomState[choice.target + 'Examined']) return;
                ui.choicesButtons.appendChild(createButton(choice.text, () => handleAction(choice)));
            });
        }
        
        // --- Update Stats and Inventory ---
        updatePlayerStatsUI();
        updateInventoryUI();
    }
    
    // --- ACTION HANDLER ---
    function handleAction(choice) {
        clearEchoHint();
        const { action, target } = choice;
        const roomData = masterRoomsData[gameState.currentRoomId];
        const roomState = gameState.roomStates[gameState.currentRoomId];
        
        switch (action) {
            case 'move':
                gameState.currentRoomId = target;
                break;
            case 'examine':
                logAction(roomData.onExamine[target]);
                roomState[target + 'Examined'] = true; // Mark as examined
                // Contextual choices
                if (target === 'crack' && !roomState.revealedPassage) {
                    roomData.choices.push({ text: "Squeeze through the passage", action: 'move', target: 'goblinCorridor' });
                    roomState.revealedPassage = true;
                } else if (roomData.item && !roomState.itemTaken) {
                    roomData.choices.push({ text: `Take the ${roomData.item.name}`, action: 'pickup' });
                }
                break;
            case 'pickup':
                const item = roomData.item;
                gameState.player.inventory.push(item);
                logAction(`You take the ${item.name}.`);
                roomState.itemTaken = true;
                roomData.choices = roomData.choices.filter(c => c.action !== 'pickup');
                break;
            case 'attack':
                handleCombat();
                return; // Combat handles its own rendering
            case 'win':
                gameState.currentRoomId = 'secretEnd';
                break;
            case 'restart':
                if (confirm("Are you sure you want to restart?")) startGame();
                return;
        }
        render();
    }

    function useItem(itemId) {
        const itemIndex = gameState.player.inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        const item = gameState.player.inventory[itemIndex];
        let used = false, consumable = false;
        
        if (item.id === 'dragonKey' && gameState.currentRoomId === 'puzzleChamber') {
            logAction("You insert the Dragon Key into the slot. The stone door grinds open, revealing two paths.");
            const room = masterRoomsData.puzzleChamber;
            room.choices.push({ text: "Enter the Observatory", action: "move", target: "observatory" });
            room.choices.push({ text: "Enter the Archives", action: "move", target: "archives" });
            used = true; consumable = true;
        } else if (item.id === 'glowingGem' && gameState.currentRoomId === 'archives') {
             logAction("You place the Glowing Gem into the book's indentation. It clicks open!");
             gameState.currentRoomId = 'secretEnd';
             used = true; consumable = true;
        } else {
             logAction("You can't use that here.");
        }

        if (used && consumable) {
            gameState.player.inventory.splice(itemIndex, 1);
        }
        render();
    }

    function handleCombat() {
        const roomData = masterRoomsData[gameState.currentRoomId];
        const roomState = gameState.roomStates[gameState.currentRoomId];
        const enemy = roomData.enemy;
        let combatLog = "";

        // Player attacks
        const weapon = gameState.player.inventory.find(i => i.attack);
        const attackBonus = gameState.player.inventory.find(i => i.attackBonus) || { attackBonus: 0 };
        const playerDamage = gameState.player.baseAttack + (weapon ? weapon.attack : 0) + attackBonus.attackBonus;
        
        enemy.health -= playerDamage;
        combatLog += `You attack the ${enemy.name} for ${playerDamage} damage.`;

        // Enemy defeat check
        if (enemy.health <= 0) {
            combatLog += `\nYou defeated the ${enemy.name}!`;
            if (enemy.loot) {
                gameState.player.inventory.push(enemy.loot);
                combatLog += ` It dropped a ${enemy.loot.name}.`;
            }
            roomState.enemyDefeated = true;
            gameState.currentRoomId = 'corridorClear';
            logAction(combatLog);
            render();
            return;
        }

        // Enemy attacks
        gameState.player.health -= enemy.attack;
        combatLog += `\nThe ${enemy.name} attacks you for ${enemy.attack} damage.`;
        logAction(combatLog);
        updatePlayerStatsUI();
        
        if (gameState.player.health <= 0) {
            gameState.player.health = 0;
            gameState.currentRoomId = 'gameOver';
            render();
        }
    }
    
    // --- UI UTILITY FUNCTIONS ---
    function updatePlayerStatsUI() {
        const p = gameState.player;
        ui.healthBar.style.width = `${(p.health / p.maxHealth) * 100}%`;
        ui.healthValue.innerText = `${p.health}/${p.maxHealth}`;
    }
    function updateInventoryUI() {
        ui.inventoryList.innerHTML = '';
        if (gameState.player.inventory.length === 0) {
            ui.inventoryList.innerHTML = '<li>(Empty)</li>';
        } else {
            gameState.player.inventory.forEach(item => {
                const li = document.createElement('li');
                li.innerText = item.name;
                li.title = `Click to use ${item.name}`;
                li.addEventListener('click', () => useItem(item.id));
                ui.inventoryList.appendChild(li);
            });
        }
    }
    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.innerText = text;
        button.addEventListener('click', onClick);
        return button;
    }
    function logAction(text, isCritical = false) {
        ui.actionLog.innerText = text;
        ui.actionLog.className = isCritical ? 'critical-warning' : '';
    }

    // --- ECHO HINT SYSTEM ---
    function resetEchoTimer() {
        clearTimeout(echoTimer);
        echoTimer = setTimeout(showEchoHint, 90000);
    }
    function showEchoHint() {
        const roomData = masterRoomsData[gameState.currentRoomId];
        if (roomData && roomData.echo) ui.echoHint.innerText = roomData.echo;
    }
    function clearEchoHint() {
        ui.echoHint.innerText = '';
    }

    // --- SYSTEM EVENT LISTENERS ---
    ui.saveButton.addEventListener('click', () => {
        localStorage.setItem('dungeonGameState', JSON.stringify(gameState));
        logAction("Game Saved!");
    });
    ui.loadButton.addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            gameState = JSON.parse(savedState);
            logAction("Game Loaded!");
            render();
        } else {
            logAction("No saved game found.");
        }
    });
    ui.restartButton.addEventListener('click', () => handleAction({ action: 'restart' }));

    // --- Let the adventure begin! ---
    startGame();
});