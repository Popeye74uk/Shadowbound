document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const storyTextElement = document.getElementById('story-text');
    const echoHintElement = document.getElementById('echo-hint');
    const choicesButtonsElement = document.getElementById('choices-buttons');
    const healthBarElement = document.getElementById('health-bar');
    const healthValueElement = document.getElementById('health-value');
    const inventoryListElement = document.getElementById('inventory-list');
    const actionLogElement = document.getElementById('action-log');

    // Game State Variables
    let player;
    let rooms;
    let currentRoomId;
    let currentEnemy;
    let echoTimer;

    // --- GAME DATA FACTORY ---
    function createInitialRoomsState() {
        return {
            start: {
                description: "You stand at the entrance to a long-forgotten dungeon. A heavy wooden door looms in front of you. The air is thick with dust. A faint, cool breeze emanates from a crack in the wall to your left.",
                choices: [
                    { text: "Examine the heavy door", action: 'examine', target: 'door' },
                    { text: "Examine the crack in the wall", action: 'examine', target: 'crack' },
                    { text: "Look around the entrance hall", action: 'examine', target: 'room' }
                ],
                examinations: {
                    door: "The door is made of heavy oak and is firmly barred from the other side. There's no way through here.",
                    crack: "You find a hidden passage behind a loose section of the wall! It's a tight squeeze.",
                    room: "You scan the dusty room. Against the wall rests a single, flickering torch. It might be useful."
                },
                items: [{ id: 'torch', name: 'Flickering Torch' }],
                state: { revealedPassage: false, tookTorch: false },
                echo: "Perhaps the door is not the only way forward..."
            },
            goblinCorridor: {
                description: "You squeeze through the passage into a narrow corridor. A foul-smelling goblin holding a crude club is startled by your arrival!",
                enemy: { name: "Goblin", health: 30, maxHealth: 30, attack: 10, loot: { id: 'dragonKey', name: 'Dragon Key' } },
                choices: [
                    { text: "Attack the Goblin", action: "attack" },
                    { text: "Flee back to the entrance", action: "flee", target: "start" }
                ],
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
                examinations: {
                    puzzleDoor: "The dragon-shaped slot seems to be waiting for a key.",
                    rubble: "Hidden in the rubble, you find a small vial containing a shimmering red liquid."
                },
                items: [{ id: 'strengthPotion', name: 'Potion of Strength', attackBonus: 10 }],
                state: { tookPotion: false },
                echo: "A key with a unique shape might be needed for the door."
            },
            observatory: {
                description: "This room was once a grand observatory, but the ceiling has collapsed, leaving a massive hole open to the sky. Starlight filters down, illuminating a pedestal in the center of the room.",
                choices: [{ text: "Approach the pedestal", action: "examine", target: "pedestal" }],
                examinations: { pedestal: "You approach the pedestal and see the source of the light: a magnificent, Glowing Gem that hums with energy." },
                items: [{ id: 'glowingGem', name: 'Glowing Gem' }],
                state: { tookGem: false },
                echo: "Such a beautiful object must have a purpose."
            },
            archives: {
                description: "You've discovered a hidden library! Dusty tomes line the walls. A large, locked book sits on a lectern. It has a circular indentation on its cover.",
                choices: [{ text: "Examine the locked book", action: "examine", target: "book" }],
                examinations: { book: "The heavy book is sealed by a lock with a circular indentation. It feels like something might fit there." },
                echo: "That indentation on the book looks familiar..."
            },
            secretEnd: {
                description: "The gem fits perfectly. The book opens, revealing the dungeon's history. The final page reveals a hidden exit behind a bookshelf. You have uncovered the truth!",
                choices: [{ text: "Escape with the knowledge", action: "winSecret" }]
            },
            finalExit: {
                description: "You found the main exit and escaped the dungeon with your life and some treasure. Congratulations!",
                choices: [{ text: "Play Again", action: "restart" }]
            },
            gameOver: {
                description: "You have been defeated. The darkness of the dungeon consumes you.",
                choices: [{ text: "Try Again", action: "restart" }]
            }
        };
    }

    // --- CORE GAME LOOP ---

    function startGame() {
        player = {
            health: 100,
            maxHealth: 100,
            inventory: [],
            attackBonus: 0,
        };
        rooms = createInitialRoomsState();
        currentRoomId = 'start';
        currentEnemy = null;
        updateUI();
    }

    function updateUI() {
        resetEchoTimer();
        const room = rooms[currentRoomId];
        storyTextElement.innerText = room.description;
        choicesButtonsElement.innerHTML = '';
        if (actionLogElement.className !== 'critical-warning') {
            logAction(''); // Clear log unless it's a critical warning
        }

        // --- RENDER CHOICES ---
        const isCritical = player.health > 0 && player.health / player.maxHealth <= 0.2;

        if (isCritical) {
            logAction("CRITICAL HEALTH! Use a potion before it's too late!", true);
            const healingPotions = player.inventory.filter(item => item.heal);
            if (healingPotions.length > 0) {
                healingPotions.forEach(potion => {
                    choicesButtonsElement.appendChild(createButton(`Use ${potion.name}`, () => useItem(potion.id)));
                });
            }
            choicesButtonsElement.appendChild(createButton("Do nothing", updateUI)); // Button to ignore warning
        } else {
             if (room.choices) {
                room.choices.forEach(choice => {
                    choicesButtonsElement.appendChild(createButton(choice.text, () => handleAction(choice)));
                });
            }
        }

        // --- UPDATE STATS AND INVENTORY ---
        healthBarElement.style.width = `${(player.health / player.maxHealth) * 100}%`;
        healthValueElement.innerText = `${player.health}/${player.maxHealth}`;
        updateInventory();
    }
    
    function handleAction(choice) {
        clearEchoHint();
        logAction(''); // Clear log on new action
        const { action, target } = choice;

        switch (action) {
            case 'move':
                currentRoomId = target;
                break;
            case 'flee':
                currentEnemy = null;
                currentRoomId = target;
                logAction("You flee back to safety.");
                break;
            case 'examine':
                handleExamine(target);
                break;
            case 'pickup':
                handlePickup(target);
                break;
            case 'attack':
                handleCombat();
                break;
            case 'winSecret':
            case 'restart':
                // Use a confirm dialog for restarting
                if (action === 'restart' && !confirm("Are you sure you want to restart?")) return;
                startGame();
                return;
        }

        // Re-evaluate enemy status after an action
        const room = rooms[currentRoomId];
        if (room && room.enemy && !room.state.enemyDefeated) {
            currentEnemy = { ...room.enemy };
        } else {
            currentEnemy = null;
        }

        // Avoid double-rendering for combat hits
        if (action !== 'attack' && currentRoomId !== 'gameOver') {
            updateUI();
        }
    }
    
    // --- ACTION HANDLERS ---
    
    function handleExamine(target) {
        const room = rooms[currentRoomId];
        logAction(room.examinations[target]);

        // Create contextual choices from examinations
        if (target === 'crack' && !room.state.revealedPassage) {
            room.choices.push({ text: "Squeeze through the passage", action: 'move', target: 'goblinCorridor' });
            room.state.revealedPassage = true;
        } else if (target === 'room' && !room.state.tookTorch) {
            room.choices.push({ text: `Take the ${room.items[0].name}`, action: 'pickup', target: 'torch' });
        } else if (target === 'rubble' && !room.state.tookPotion) {
            room.choices.push({ text: `Take the ${room.items[0].name}`, action: 'pickup', target: 'strengthPotion' });
        } else if (target === 'pedestal' && !room.state.tookGem) {
             room.choices.push({ text: `Take the ${room.items[0].name}`, action: 'pickup', target: 'glowingGem' });
        }
        
        // Remove the 'examine' choice to prevent clutter
        room.choices = room.choices.filter(c => c.target !== target);
        updateUI();
    }

    function handlePickup(itemId) {
        const room = rooms[currentRoomId];
        const itemData = room.items.find(item => item.id === itemId);
        player.inventory.push({ ...itemData });
        logAction(`You take the ${itemData.name}.`);

        // Update room state to prevent re-picking
        if (itemId === 'torch') room.state.tookTorch = true;
        if (itemId === 'strengthPotion') room.state.tookPotion = true;
        if (itemId === 'glowingGem') room.state.tookGem = true;

        room.choices = room.choices.filter(c => c.action !== 'pickup' || c.target !== itemId);
        updateUI();
    }

    function useItem(itemId) {
        const itemIndex = player.inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        const item = player.inventory[itemIndex];
        let used = false;
        let consumable = false;

        // Key Item Usage
        if (item.id === 'dragonKey' && currentRoomId === 'puzzleChamber') {
            logAction("You insert the Dragon Key into the slot. The stone door grinds open, revealing two paths.");
            rooms.puzzleChamber.choices.push({ text: "Enter the Observatory", action: "move", target: "observatory" });
            rooms.puzzleChamber.choices.push({ text: "Enter the Archives", action: "move", target: "archives" });
            used = true;
            consumable = true;
        } else if (item.id === 'glowingGem' && currentRoomId === 'archives') {
             logAction("You place the Glowing Gem into the book's indentation. It clicks open!");
             currentRoomId = 'secretEnd';
             used = true;
             consumable = true;
        } 
        // Potion Usage
        else if (item.heal) {
            player.health = Math.min(player.maxHealth, player.health + item.heal);
            logAction(`You use the ${item.name} and restore ${item.heal} health.`);
            used = true;
            consumable = true;
        } else if (item.attackBonus) {
            player.attackBonus += item.attackBonus;
            logAction(`You drink the ${item.name}. You feel a surge of power! Your attack has increased.`);
            used = true;
            consumable = true;
        } else {
             logAction("You can't use that here.");
        }

        if (used && consumable) {
            player.inventory.splice(itemIndex, 1);
        }
        updateUI();
    }
    
    function handleCombat() {
        if (!currentEnemy) return;
        let combatLog = "";

        // Player attacks
        let playerDamage = (player.inventory.some(i => i.id === 'torch') ? 10 : 5) + player.attackBonus;
        currentEnemy.health -= playerDamage;
        combatLog += `You attack the ${currentEnemy.name} for ${playerDamage} damage.`;

        // Check for enemy defeat
        if (currentEnemy.health <= 0) {
            combatLog += `\nYou defeated the ${currentEnemy.name}!`;
            if (currentEnemy.loot) {
                player.inventory.push(currentEnemy.loot);
                combatLog += ` It dropped a ${currentEnemy.loot.name}.`;
            }
            rooms[currentRoomId].state.enemyDefeated = true;
            currentEnemy = null;
            currentRoomId = 'corridorClear';
            logAction(combatLog);
            updateUI(); // Rerender room after combat ends
            return;
        }

        // Enemy attacks
        player.health -= currentEnemy.attack;
        combatLog += `\nThe ${currentEnemy.name} attacks you for ${currentEnemy.attack} damage.`;
        
        if (player.health <= 0) {
            player.health = 0;
            currentRoomId = 'gameOver';
            updateUI(); // Rerender for game over screen
        }
        
        logAction(combatLog);
        // Update health bar immediately after hit
        healthBarElement.style.width = `${(player.health / player.maxHealth) * 100}%`;
        healthValueElement.innerText = `${player.health}/${player.maxHealth}`;
    }

    // --- UTILITY FUNCTIONS ---
    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.innerText = text;
        button.addEventListener('click', onClick);
        return button;
    }

    function logAction(text, isCritical = false) {
        actionLogElement.innerHTML = text;
        actionLogElement.className = isCritical ? 'critical-warning' : '';
    }

    function updateInventory() {
        inventoryListElement.innerHTML = '';
        if (player.inventory.length === 0) {
            inventoryListElement.innerHTML = '<li>Empty</li>';
        } else {
            player.inventory.forEach(item => {
                const li = document.createElement('li');
                li.innerText = item.name;
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
        const room = rooms[currentRoomId];
        if (room && room.echo) echoHintElement.innerText = room.echo;
    }

    function clearEchoHint() {
        echoHintElement.innerText = '';
    }

    // --- SAVE / LOAD ---
    document.getElementById('save-button').addEventListener('click', () => {
        const gameState = { player, rooms, currentRoomId };
        localStorage.setItem('dungeonGameState', JSON.stringify(gameState));
        logAction("Game Saved!");
    });

    document.getElementById('load-button').addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            const gameState = JSON.parse(savedState);
            player = gameState.player;
            rooms = gameState.rooms;
            currentRoomId = gameState.currentRoomId;
            logAction("Game Loaded!");
            updateUI();
        } else {
            logAction("No saved game found.");
        }
    });
    
    document.getElementById('restart-button').addEventListener('click', () => handleAction({ action: 'restart' }));

    // --- INITIALIZE ---
    startGame();
});