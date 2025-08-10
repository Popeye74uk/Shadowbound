document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENTS ---
    const storyTextElement = document.getElementById('story-text');
    const echoHintElement = document.getElementById('echo-hint');
    const choicesButtonsElement = document.getElementById('choices-buttons');
    const healthBarElement = document.getElementById('health-bar');
    const healthValueElement = document.getElementById('health-value');
    const inventoryListElement = document.getElementById('inventory-list');
    const actionLogElement = document.getElementById('action-log');

    // --- MASTER GAME DATA (The unchanging blueprint) ---
    const masterRooms = {
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
            items: [{ id: 'torch', name: 'Flickering Torch', attack: 5 }],
            state: { revealedPassage: false, itemTaken: false },
            echo: "Perhaps the door is not the only way forward..."
        },
        goblinCorridor: {
            description: "You squeeze through the passage into a narrow corridor. A foul-smelling goblin holding a crude club is startled by your arrival!",
            enemy: { name: "Goblin", health: 30, maxHealth: 30, attack: 10, loot: { id: 'dragonKey', name: 'Dragon Key' } },
            choices: [ { text: "Flee back to the entrance", action: "move", target: "start" } ],
            state: { enemyDefeated: false },
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
            items: [{ id: 'strengthPotion', name: 'Potion of Strength', attackBonus: 10 }],
            state: { itemTaken: false },
            echo: "A key with a unique shape might be needed for the door."
        },
        observatory: {
            description: "This room was once a grand observatory, but the ceiling has collapsed, leaving a massive hole open to the sky. Starlight filters down, illuminating a pedestal in the center of the room.",
            choices: [{ text: "Approach the pedestal", action: "examine", target: "pedestal" }],
            onExamine: { pedestal: "You approach the pedestal and see the source of the light: a magnificent, Glowing Gem that hums with energy." },
            items: [{ id: 'glowingGem', name: 'Glowing Gem' }],
            state: { itemTaken: false },
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
        // Deep copy master data to create a fresh session state
        gameState = {
            player: { health: 100, maxHealth: 100, inventory: [], baseAttack: 2 },
            currentRoomId: 'start',
            rooms: JSON.parse(JSON.stringify(masterRooms)) // Crucial for restartable, clean state
        };
        updateUI();
    }

    // --- CORE UI RENDERER ---
    function updateUI() {
        resetEchoTimer();
        clearEchoHint();

        const room = gameState.rooms[gameState.currentRoomId];

        // --- Safety Check: Ensure the room exists ---
        if (!room) {
            storyTextElement.innerText = "A critical error has occurred. The world has vanished. Please restart the game.";
            console.error(`Error: Room with ID "${gameState.currentRoomId}" not found.`);
            choicesButtonsElement.innerHTML = '';
            choicesButtonsElement.appendChild(createButton("Restart", startGame));
            return;
        }

        // --- Render Room and Choices ---
        storyTextElement.innerText = room.description;
        choicesButtonsElement.innerHTML = '';
        actionLogElement.className = '';
        actionLogElement.innerText = '';

        // --- Low Health Warning ---
        const isCritical = gameState.player.health > 0 && gameState.player.health / gameState.player.maxHealth <= 0.2;
        if (isCritical) {
            logAction("CRITICAL HEALTH! Use a potion before it's too late!", true);
            const healingPotions = gameState.player.inventory.filter(item => item.heal);
            if (healingPotions.length > 0) {
                healingPotions.forEach(potion => {
                    choicesButtonsElement.appendChild(createButton(`Use ${potion.name}`, () => useItem(potion.id)));
                });
            }
        }
        
        // --- Combat UI ---
        if (room.enemy && !room.state.enemyDefeated) {
             choicesButtonsElement.appendChild(createButton("Attack " + room.enemy.name, () => handleAction({ action: 'attack' })));
        }

        // --- Standard Choices ---
        if (room.choices) {
            room.choices.forEach(choice => {
                choicesButtonsElement.appendChild(createButton(choice.text, () => handleAction(choice)));
            });
        }
        
        // --- Update Stats and Inventory ---
        healthBarElement.style.width = `${(gameState.player.health / gameState.player.maxHealth) * 100}%`;
        healthValueElement.innerText = `${gameState.player.health}/${gameState.player.maxHealth}`;
        updateInventory();
    }
    
    // --- ACTION HANDLER ---
    function handleAction(choice) {
        const { action, target } = choice;
        const room = gameState.rooms[gameState.currentRoomId];
        
        // --- Process Action ---
        switch (action) {
            case 'move':
                gameState.currentRoomId = target;
                break;
            case 'examine':
                logAction(room.onExamine[target]);
                // Add contextual choices post-examination
                if (target === 'crack' && !room.state.revealedPassage) {
                    room.choices.push({ text: "Squeeze through the passage", action: 'move', target: 'goblinCorridor' });
                    room.state.revealedPassage = true;
                }
                if (target === 'room' && !room.state.itemTaken) {
                    room.choices.push({ text: `Take the ${room.items[0].name}`, action: 'pickup', target: room.items[0].id });
                }
                if (target === 'rubble' && !room.state.itemTaken) {
                    room.choices.push({ text: `Take the ${room.items[0].name}`, action: 'pickup', target: room.items[0].id });
                }
                if (target === 'pedestal' && !room.state.itemTaken) {
                    room.choices.push({ text: `Take the ${room.items[0].name}`, action: 'pickup', target: room.items[0].id });
                }
                // Remove the examine choice after it's used
                room.choices = room.choices.filter(c => c.target !== target);
                break;
            case 'pickup':
                const itemData = room.items.find(item => item.id === target);
                gameState.player.inventory.push(itemData);
                logAction(`You take the ${itemData.name}.`);
                room.state.itemTaken = true;
                room.choices = room.choices.filter(c => c.action !== 'pickup');
                break;
            case 'attack':
                handleCombat();
                break;
            case 'win':
                gameState.currentRoomId = 'secretEnd';
                break;
            case 'restart':
                startGame();
                return; // Exit to prevent double render
        }
        
        updateUI();
    }

    function useItem(itemId) {
        const itemIndex = gameState.player.inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        const item = gameState.player.inventory[itemIndex];
        let used = false, consumable = false;
        
        // Logic for using specific items in specific rooms
        if (item.id === 'dragonKey' && gameState.currentRoomId === 'puzzleChamber') {
            logAction("You insert the Dragon Key into the slot. The stone door grinds open, revealing two paths.");
            const room = gameState.rooms.puzzleChamber;
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
        updateUI();
    }

    function handleCombat() {
        const room = gameState.rooms[gameState.currentRoomId];
        const enemy = room.enemy;
        let combatLog = "";

        // Player attacks
        let weapon = gameState.player.inventory.find(i => i.attack);
        let playerDamage = gameState.player.baseAttack + (weapon ? weapon.attack : 0);
        enemy.health -= playerDamage;
        combatLog += `You attack the ${enemy.name} for ${playerDamage} damage.`;

        // Check for enemy defeat
        if (enemy.health <= 0) {
            combatLog += `\nYou defeated the ${enemy.name}!`;
            if (enemy.loot) {
                gameState.player.inventory.push(enemy.loot);
                combatLog += ` It dropped a ${enemy.loot.name}.`;
            }
            room.state.enemyDefeated = true;
            gameState.currentRoomId = 'corridorClear';
            logAction(combatLog);
            updateUI();
            return;
        }

        // Enemy attacks
        gameState.player.health -= enemy.attack;
        combatLog += `\nThe ${enemy.name} attacks you for ${enemy.attack} damage.`;
        
        if (gameState.player.health <= 0) {
            gameState.player.health = 0;
            gameState.currentRoomId = 'gameOver';
            updateUI();
        } else {
            logAction(combatLog);
            // Just update health bar without full re-render
            healthBarElement.style.width = `${(gameState.player.health / gameState.player.maxHealth) * 100}%`;
            healthValueElement.innerText = `${gameState.player.health}/${gameState.player.maxHealth}`;
        }
    }
    
    // --- UTILITY & SYSTEM FUNCTIONS ---
    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.innerText = text;
        button.addEventListener('click', onClick);
        return button;
    }

    function logAction(text, isCritical = false) {
        actionLogElement.innerText = text;
        actionLogElement.className = isCritical ? 'critical-warning' : '';
    }

    function updateInventory() {
        inventoryListElement.innerHTML = '';
        if (gameState.player.inventory.length === 0) {
            inventoryListElement.innerHTML = '<li>(Empty)</li>';
        } else {
            gameState.player.inventory.forEach(item => {
                const li = document.createElement('li');
                li.innerText = item.name;
                li.title = `Click to use ${item.name}`;
                li.addEventListener('click', () => useItem(item.id));
                inventoryListElement.appendChild(li);
            });
        }
    }

    function resetEchoTimer() {
        clearTimeout(echoTimer);
        echoTimer = setTimeout(showEchoHint, 90000);
    }
    
    function showEchoHint() {
        const room = gameState.rooms[gameState.currentRoomId];
        if (room && room.echo) echoHintElement.innerText = room.echo;
    }

    function clearEchoHint() {
        echoHintElement.innerText = '';
    }

    // --- SAVE / LOAD / RESTART EVENT LISTENERS ---
    document.getElementById('save-button').addEventListener('click', () => {
        localStorage.setItem('dungeonGameState', JSON.stringify(gameState));
        logAction("Game Saved!");
    });

    document.getElementById('load-button').addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            gameState = JSON.parse(savedState);
            logAction("Game Loaded!");
            updateUI();
        } else {
            logAction("No saved game found.");
        }
    });
    
    document.getElementById('restart-button').addEventListener('click', () => {
        if(confirm("Are you sure you want to restart? All unsaved progress will be lost.")) {
            startGame();
        }
    });

    // --- Let the adventure begin! ---
    startGame();
});