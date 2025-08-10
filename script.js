document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const storyTextElement = document.getElementById('story-text');
    const echoHintElement = document.getElementById('echo-hint');
    const choicesButtonsElement = document.getElementById('choices-buttons');
    const healthBarElement = document.getElementById('health-bar');
    const healthValueElement = document.getElementById('health-value');
    const inventoryListElement = document.getElementById('inventory-list');
    const actionLogElement = document.getElementById('action-log');

    // Game State
    let player;
    let rooms;
    let currentRoom;
    let currentEnemy;
    let echoTimer;

    // --- GAME DATA ---
    function initializeGameData() {
        player = {
            health: 100,
            maxHealth: 100,
            inventory: [],
            attackBonus: 0,
        };

        rooms = {
            start: {
                description: "You stand at the entrance to a long-forgotten dungeon. A heavy wooden door looms in front of you. The air is thick with dust, and you hear skittering in the shadows. A faint, cool breeze emanates from a crack in the wall to your left.",
                choices: [
                    { text: "Examine the heavy door", action: "examine", target: "door" },
                    { text: "Examine the crack in the wall", action: "examine", target: "crack" },
                    { text: "Look around the entrance hall", action: "examine", target: "room" }
                ],
                state: { examinedRoom: false },
                items: [{ id: 'torch', name: 'Flickering Torch', taken: false, description: "Against the wall rests a single, flickering torch. It might be useful." }],
                echo: "Perhaps the door is not the only way forward..."
            },
            // ... Add all other rooms here
            goblinCorridor: {
                description: "You squeeze through the passage into a narrow corridor. A foul-smelling goblin holding a crude club is startled by your arrival!",
                enemy: { name: "Goblin", health: 30, maxHealth: 30, attack: 10, loot: { id: 'dragonKey', name: 'Dragon Key' } },
                choices: [
                    { text: "Attack the Goblin", action: "attack" },
                    { text: "Flee back to the entrance", action: "flee", target: "start" }
                ],
                echo: "Combat is dangerous. Do you have a weapon?"
            },
            corridorClear: {
                description: "The corridor is quiet now, the goblin's body a grim reminder of your victory. The path continues forward into darkness, or you can return to the entrance hall.",
                choices: [
                    { text: "Go forward", action: "move", target: "puzzleChamber" },
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
                state: { rubbleSearched: false },
                items: [{ id: 'strengthPotion', name: 'Potion of Strength', taken: false, description: "Hidden in the rubble, you find a small vial containing a shimmering red liquid." }],
                echo: "A key with a unique shape might be needed for the door."
            },
            observatory: {
                description: "This room was once a grand observatory, but the ceiling has collapsed, leaving a massive hole open to the sky. Starlight filters down, illuminating a pedestal in the center of the room.",
                choices: [
                    { text: "Approach the pedestal", action: "examine", target: "pedestal" },
                    { text: "Return to the puzzle chamber", action: "move", target: "puzzleChamber" }
                ],
                items: [{ id: 'glowingGem', name: 'Glowing Gem', taken: false, description: "You approach the pedestal and see the source of the light: a magnificent, Glowing Gem that hums with energy." }],
                echo: "Such a beautiful object must have a purpose."
            },
            archives: {
                description: "You've discovered a hidden library! Dusty tomes line the walls. A large, locked book sits on a lectern in the middle of the room. It has a circular indentation on its cover.",
                choices: [
                    { text: "Examine the locked book", action: "examine", target: "book" },
                    { text: "Search the shelves", action: "examine", target: "shelves" },
                    { text: "Return to the puzzle chamber", action: "move", target: "puzzleChamber" }
                ],
                state: { shelvesSearched: false },
                items: [{ id: 'evasionElixir', name: 'Elixir of Evasion', taken: false, description: "Tucked behind a row of books, you find a swirling blue potion." }],
                echo: "That indentation on the book looks familiar..."
            },
            secretEnd: {
                description: "The gem fits perfectly. The book opens, revealing the dungeon's history: it was a sanctuary for scholars, corrupted by a magical cataclysm. The final page reveals a hidden exit behind a bookshelf. You have uncovered the truth!",
                choices: [{ text: "Escape with the knowledge", action: "winSecret" }],
            },
            mainExit: {
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
        initializeGameData();
        currentRoom = 'start';
        currentEnemy = null;
        updateUI();
    }

    function updateUI() {
        resetEchoTimer();
        storyTextElement.innerText = rooms[currentRoom].description;
        choicesButtonsElement.innerHTML = '';
        actionLogElement.innerHTML = '';

        // Low Health Warning
        if (player.health > 0 && player.health / player.maxHealth <= 0.1) {
            const healingPotions = player.inventory.filter(item => item.heal);
            if (healingPotions.length > 0) {
                actionLogElement.innerHTML = `<span class="critical-warning">CRITICAL HEALTH! Use a potion before it's too late!</span>`;
                healingPotions.forEach(potion => {
                    const button = createButton(`Use ${potion.name}`, () => useItem(potion.id));
                    choicesButtonsElement.appendChild(button);
                });
            } else {
                actionLogElement.innerHTML = `<span class="critical-warning">CRITICAL HEALTH! You have no healing items!</span>`;
            }
        }
        
        // Render Choices
        const room = rooms[currentRoom];
        if (room.choices) {
            room.choices.forEach(choice => {
                const button = createButton(choice.text, () => handleAction(choice));
                choicesButtonsElement.appendChild(button);
            });
        }

        // Update Stats and Inventory
        healthBarElement.style.width = `${(player.health / player.maxHealth) * 100}%`;
        healthValueElement.innerText = `${player.health}/${player.maxHealth}`;
        updateInventory();
    }

    function handleAction(choice) {
        clearEchoHint();
        const { action, target, move, payload } = choice;

        switch (action) {
            case 'move':
                currentRoom = target;
                break;
            case 'examine':
                handleExamine(target);
                break;
            case 'pickup':
                handlePickup(payload);
                break;
            case 'attack':
                handleCombat();
                break;
            case 'flee':
                currentEnemy = null;
                currentRoom = target;
                logAction("You flee back to safety.");
                break;
            case 'use':
                useItem(target);
                break;
            case 'restart':
                startGame();
                return;
            case 'winSecret':
            case 'mainExit':
                currentRoom = action;
                storyTextElement.innerText = rooms[currentRoom].description;
                choicesButtonsElement.innerHTML = '';
                choicesButtonsElement.appendChild(createButton("Play Again", () => handleAction({action: 'restart'})));
                return;
        }
        
        // Post-action checks
        const room = rooms[currentRoom];
        if (room && room.enemy && room.enemy.health > 0) {
            currentEnemy = { ...room.enemy };
        } else {
            currentEnemy = null;
        }

        updateUI();
    }

    // --- ACTION HANDLERS ---

    function handleExamine(target) {
        const room = rooms[currentRoom];
        let discoveryText = "";

        switch (target) {
            case 'room':
                if (!room.state.examinedRoom) {
                    discoveryText = "You scan the dusty room. ";
                    const unTakenItems = room.items.filter(item => !item.taken);
                    if (unTakenItems.length > 0) {
                        discoveryText += unTakenItems[0].description;
                        room.choices.push({ text: `Take the ${unTakenItems[0].name}`, action: 'pickup', payload: unTakenItems[0].id });
                    } else {
                        discoveryText += "You find nothing else of interest.";
                    }
                    room.state.examinedRoom = true;
                } else {
                    discoveryText = "You've already searched here.";
                }
                break;
            case 'crack':
                discoveryText = "You find a hidden passage behind a loose section of the wall! It's a tight squeeze.";
                room.choices.push({ text: "Squeeze through the passage", action: 'move', target: 'goblinCorridor' });
                room.choices = room.choices.filter(c => c.target !== 'crack');
                break;
            case 'door':
                 discoveryText = "The door is made of heavy oak and is firmly barred from the other side. There's no way through here.";
                 break;
            case 'rubble':
                if (!room.state.rubbleSearched) {
                    const potion = room.items.find(i => i.id === 'strengthPotion');
                    discoveryText = potion.description;
                    room.choices.push({ text: `Take the ${potion.name}`, action: 'pickup', payload: potion.id });
                    room.state.rubbleSearched = true;
                } else {
                    discoveryText = "Just a pile of rocks.";
                }
                break;
            case 'pedestal':
                const gem = room.items.find(i => i.id === 'glowingGem');
                if (!gem.taken) {
                    discoveryText = gem.description;
                    room.choices.push({ text: `Take the ${gem.name}`, action: 'pickup', payload: gem.id });
                } else {
                    discoveryText = "The pedestal is now empty.";
                }
                break;
            case 'puzzleDoor':
                discoveryText = "The dragon-shaped slot seems to be waiting for a key.";
                break;
            case 'shelves':
                 if (!room.state.shelvesSearched) {
                    const elixir = room.items.find(i => i.id === 'evasionElixir');
                    discoveryText = elixir.description;
                    room.choices.push({ text: `Take the ${elixir.name}`, action: 'pickup', payload: elixir.id });
                    room.state.shelvesSearched = true;
                } else {
                    discoveryText = "Just dusty old books.";
                }
                break;
            case 'book':
                discoveryText = "The heavy book is sealed by a lock with a circular indentation. It feels like something might fit there."
                // Logic to use gem is handled in useItem
                break;
        }

        logAction(discoveryText);
        // Remove the 'examine' choice to prevent clutter
        room.choices = room.choices.filter(c => !(c.action === 'examine' && c.target === target));
    }
    
    function handlePickup(itemId) {
        const room = rooms[currentRoom];
        const itemIndex = room.items.findIndex(item => item.id === itemId);
        const item = room.items[itemIndex];
        
        player.inventory.push({ ...item });
        item.taken = true;
        
        logAction(`You take the ${item.name}.`);
        room.choices = room.choices.filter(c => c.payload !== itemId);
    }
    
    function useItem(itemId) {
        const itemIndex = player.inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        const item = player.inventory[itemIndex];
        let used = false;

        // Potion Usage
        if (item.heal) {
            player.health = Math.min(player.maxHealth, player.health + item.heal);
            logAction(`You use the ${item.name} and restore ${item.heal} health.`);
            used = true;
        } else if (item.id === 'strengthPotion') {
            player.attackBonus += 10;
            logAction(`You drink the ${item.name}. You feel a surge of power! Your attack has increased.`);
            used = true;
        } else if (item.id === 'evasionElixir' && currentEnemy) {
            logAction(`You drink the ${item.name}. You move with impossible speed and escape the fight!`);
            currentEnemy = null;
            currentRoom = 'corridorClear'; // or a more generic safe spot
            used = true;
        }
        
        // Key Item Usage
        else if (item.id === 'dragonKey' && currentRoom === 'puzzleChamber') {
            logAction("You insert the Dragon Key into the slot. The stone door grinds open!");
            rooms.puzzleChamber.choices.push({ text: "Enter the Observatory", action: "move", target: "observatory" });
            rooms.puzzleChamber.choices.push({ text: "Enter the Archives", action: "move", target: "archives" });
            rooms.puzzleChamber.choices = rooms.puzzleChamber.choices.filter(c => c.target !== 'puzzleDoor');
            used = true;
        } else if (item.id === 'glowingGem' && currentRoom === 'archives') {
             logAction("You place the Glowing Gem into the book's indentation. It clicks open!");
             currentRoom = 'secretEnd';
             used = true;
        } else {
             logAction("You can't use that here.");
        }

        if (used) {
            // consumable items are removed from inventory
            if (item.heal || item.id.includes('Potion') || item.id.includes('Elixir') || item.id.includes('Key')) {
                 player.inventory.splice(itemIndex, 1);
            }
        }
        updateUI();
    }

    function handleCombat() {
        if (!currentEnemy) return;

        // Player attacks
        let playerDamage = (player.inventory.some(i => i.id === 'torch') ? 10 : 5) + player.attackBonus;
        currentEnemy.health -= playerDamage;
        let combatLog = `You attack the ${currentEnemy.name} for ${playerDamage} damage.`;

        if (currentEnemy.health <= 0) {
            combatLog += `\nYou defeated the ${currentEnemy.name}!`;
            if (currentEnemy.loot) {
                player.inventory.push(currentEnemy.loot);
                combatLog += ` It dropped a ${currentEnemy.loot.name}.`;
            }
            rooms[currentRoom].enemy.health = 0; // Mark as permanently defeated
            currentEnemy = null;
            currentRoom = 'corridorClear';
            logAction(combatLog);
            return;
        }

        // Enemy attacks
        player.health -= currentEnemy.attack;
        combatLog += `\nThe ${currentEnemy.name} attacks you for ${currentEnemy.attack} damage.`;
        
        if (player.health <= 0) {
            player.health = 0;
            currentRoom = 'gameOver';
        }
        logAction(combatLog);
    }
    
    // --- UTILITY FUNCTIONS ---

    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.innerText = text;
        button.addEventListener('click', onClick);
        return button;
    }

    function logAction(text) {
        actionLogElement.innerHTML = text;
    }

    function updateInventory() {
        inventoryListElement.innerHTML = '';
        player.inventory.forEach(item => {
            const li = document.createElement('li');
            li.innerText = item.name;
            li.addEventListener('click', () => handleAction({ action: 'use', target: item.id }));
            inventoryListElement.appendChild(li);
        });
    }

    // --- ECHO HINT SYSTEM ---
    function resetEchoTimer() {
        clearTimeout(echoTimer);
        echoTimer = setTimeout(showEchoHint, 90000); // 90 seconds
    }
    
    function showEchoHint() {
        const room = rooms[currentRoom];
        if (room && room.echo) {
            echoHintElement.innerText = room.echo;
        }
    }

    function clearEchoHint() {
        echoHintElement.innerText = '';
    }

    // --- SAVE / LOAD ---
    document.getElementById('save-button').addEventListener('click', () => {
        const gameState = { player, currentRoom, rooms };
        localStorage.setItem('dungeonGameState', JSON.stringify(gameState));
        logAction("Game Saved!");
    });

    document.getElementById('load-button').addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            const gameState = JSON.parse(savedState);
            player = gameState.player;
            currentRoom = gameState.currentRoom;
            rooms = gameState.rooms;
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

    // --- INITIALIZE ---
    startGame();
});