document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const storyTextEl = document.getElementById('story-text');
    const roomTitleEl = document.getElementById('room-title');
    const choicesButtonsEl = document.getElementById('choices-buttons');
    const inventoryListEl = document.getElementById('inventory-list');
    const healthBarEl = document.getElementById('health-bar');
    const healthTextEl = document.getElementById('health-text');
    const restartBtn = document.getElementById('restart-btn');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const itemModal = document.getElementById('item-modal');
    const itemModalTitle = document.getElementById('item-modal-title');
    const itemModalDescription = document.getElementById('item-modal-description');
    const itemUseBtn = document.getElementById('item-use-btn');
    const itemDropBtn = document.getElementById('item-drop-btn');
    const itemModalCloseBtn = document.getElementById('item-modal-close-btn');

    // Game State
    let gameState = {
        player: {
            health: 100,
            maxHealth: 100,
            inventory: [],
        },
        currentRoom: 'start',
        flags: {
            goblinDefeated: false,
            talkedToGhost: false,
            puzzleSolved: false,
            alchemistQuest: 'none', // none, accepted, completed
            spiderDefeated: false
        }
    };

    // Item Definitions
    const items = {
        'rusty sword': {
            name: 'Rusty Sword',
            description: 'A simple sword, pitted with rust. Deals moderate damage.',
            use: (feedback) => feedback.push('You can only equip this for combat.')
        },
        'health potion': {
            name: 'Health Potion',
            description: 'A swirling red liquid that restores 50 health.',
            use: (feedback) => {
                if (gameState.player.health >= gameState.player.maxHealth) {
                    feedback.push('You are already at full health.');
                } else {
                    gameState.player.health = Math.min(gameState.player.maxHealth, gameState.player.health + 50);
                    removeItem('health potion');
                    feedback.push('You drink the health potion and feel invigorated. You recovered health.');
                    updatePlayerStats();
                }
            }
        },
        'ancient key': {
            name: 'Ancient Key',
            description: 'A heavy, ornate key made of a strange, dark metal.',
            use: (feedback) => feedback.push('This key doesn\'t seem to fit any visible lock here.')
        },
        'ornate dagger': {
            name: 'Ornate Dagger',
            description: 'A beautifully crafted dagger. It feels light and deadly.',
            use: (feedback) => feedback.push('This is a weapon. It is ready for combat.')
        },
        'glowing gem': {
            name: 'Glowing Gem',
            description: 'A fist-sized gem that emits a soft, ethereal light. It hums with latent power.',
            use: (feedback) => feedback.push('The gem hums warmly in your hand, but does nothing.')
        },
        'old scroll': {
            name: 'Old Scroll',
            description: 'A brittle scroll with faded writing. It reads: "The guardian sees not with eyes, but with the heart of the dungeon."',
            use: (feedback) => feedback.push('The scroll reads: "The guardian sees not with eyes, but with the heart of the dungeon."')
        },
        'heavy ledger': {
            name: 'Heavy Ledger',
            description: 'An old ledger from the alchemist. A page is marked with a sequence: MIDDLE, RIGHT, LEFT.',
            use: (feedback) => feedback.push('A page is marked with a sequence: MIDDLE, RIGHT, LEFT.')
        },
        'spider silk': {
            name: 'Spider Silk',
            description: 'A clump of strong, sticky spider silk. The alchemist might want this.',
            use: (feedback) => {
                if(gameState.currentRoom === 'alchemistStudy' && gameState.flags.alchemistQuest === 'accepted'){
                    removeItem('spider silk');
                    addItem('health potion');
                    gameState.flags.alchemistQuest = 'completed';
                    feedback.push('You give the silk to the Alchemist. He hands you a potent Health Potion in return!');
                } else {
                    feedback.push('This silk seems strong, but you have no use for it here.');
                }
            }
        }
    };

    // Utility Functions
    const updatePlayerStats = () => {
        const { health, maxHealth } = gameState.player;
        const healthPercentage = (health / maxHealth) * 100;
        healthBarEl.style.width = `${healthPercentage}%`;
        healthTextEl.textContent = `${health}/${maxHealth}`;
        updateInventory();
    };

    const addItem = (itemName) => {
        if (!gameState.player.inventory.includes(itemName)) {
            gameState.player.inventory.push(itemName);
            updateInventory();
        }
    };

    const removeItem = (itemName) => {
        gameState.player.inventory = gameState.player.inventory.filter(item => item !== itemName);
        updateInventory();
    };

    const updateInventory = () => {
        inventoryListEl.innerHTML = '';
        if (gameState.player.inventory.length === 0) {
            inventoryListEl.innerHTML = '<li>Your inventory is empty.</li>';
        } else {
            gameState.player.inventory.forEach(itemName => {
                const li = document.createElement('li');
                li.textContent = items[itemName].name;
                li.onclick = () => openItemModal(itemName);
                inventoryListEl.appendChild(li);
            });
        }
    };
    
    const showFeedback = (feedback) => {
        if (feedback.length > 0) {
            const feedbackEl = document.createElement('p');
            feedbackEl.className = 'action-feedback';
            feedbackEl.innerHTML = feedback.join('<br>');
            storyTextEl.appendChild(feedbackEl);
        }
    };

    // Room Rendering
    const showRoom = (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        gameState.currentRoom = roomId;
        roomTitleEl.textContent = room.title;
        storyTextEl.innerHTML = typeof room.description === 'function' ? room.description() : room.description;
        choicesButtonsEl.innerHTML = '';

        const availableChoices = room.choices.filter(choice => !choice.condition || choice.condition(gameState));
        availableChoices.forEach(choice => {
            const button = document.createElement('button');
            button.textContent = choice.text;
            button.onclick = () => {
                const feedback = [];
                choice.action(feedback);
                showFeedback(feedback);
            };
            choicesButtonsEl.appendChild(button);
        });
        updatePlayerStats();
    };

    // Combat System
    const startCombat = (enemy, postCombatRoomId) => {
        const originalRoomId = gameState.currentRoom;
        gameState.currentRoom = 'inCombat';
        let currentEnemy = { ...enemy };

        const renderCombat = () => {
            roomTitleEl.textContent = `In Combat with ${currentEnemy.name}!`;
            storyTextEl.innerHTML = `<p>${currentEnemy.description}</p><p>The ${currentEnemy.name} has ${currentEnemy.health} health remaining.</p>`;
            choicesButtonsEl.innerHTML = '';
            
            // Attack Button
            const attackBtn = document.createElement('button');
            attackBtn.textContent = 'Attack';
            attackBtn.onclick = playerTurn;
            choicesButtonsEl.appendChild(attackBtn);

            // Use Item Button
             if (gameState.player.inventory.includes('health potion')) {
                const usePotionBtn = document.createElement('button');
                usePotionBtn.textContent = 'Use Health Potion';
                usePotionBtn.onclick = () => {
                    const feedback = [];
                    items['health potion'].use(feedback);
                    showFeedback(feedback);
                    if(gameState.player.health > 0) enemyTurn();
                };
                choicesButtonsEl.appendChild(usePotionBtn);
            }

            // Flee Button
            const fleeBtn = document.createElement('button');
            fleeBtn.textContent = 'Flee';
            fleeBtn.onclick = () => {
                if (Math.random() < 0.5) {
                    showFeedback(['You successfully escaped!']);
                    setTimeout(() => showRoom(originalRoomId), 1000);
                } else {
                    showFeedback(['Your attempt to flee failed!']);
                    setTimeout(enemyTurn, 1000);
                }
            };
            choicesButtonsEl.appendChild(fleeBtn);
        };

        const playerTurn = () => {
            const playerDamage = gameState.player.inventory.includes('ornate dagger') ? 25 : gameState.player.inventory.includes('rusty sword') ? 15 : 8;
            const damage = Math.floor(Math.random() * 10) + playerDamage;
            currentEnemy.health -= damage;
            const feedback = [`You strike the ${currentEnemy.name} for ${damage} damage.`];
            showFeedback(feedback);

            if (currentEnemy.health <= 0) {
                endCombat();
            } else {
                setTimeout(enemyTurn, 1000);
            }
        };

        const enemyTurn = () => {
            if (gameState.player.health <= 0) return; // Prevent enemy from attacking if player already used potion and combat ended
            const damage = Math.floor(Math.random() * currentEnemy.attack) + 5;
            gameState.player.health -= damage;
            updatePlayerStats();
            const feedback = [`The ${currentEnemy.name} attacks you for ${damage} damage.`];
            showFeedback(feedback);

            if (gameState.player.health <= 0) {
                gameOver('You have been slain in battle...');
            } else {
                setTimeout(renderCombat, 1000);
            }
        };

        const endCombat = () => {
            showFeedback([`You have defeated the ${currentEnemy.name}!`]);
            if (enemy.flag) gameState.flags[enemy.flag] = true;
            if (enemy.loot) {
                addItem(enemy.loot);
                showFeedback([`The ${currentEnemy.name} dropped a ${items[enemy.loot].name}.`]);
            }
            setTimeout(() => showRoom(postCombatRoomId), 2000);
        };

        renderCombat();
    };

    const gameOver = (message) => {
        gameState.currentRoom = 'gameOver';
        roomTitleEl.textContent = 'Game Over';
        storyTextEl.innerHTML = `<p>${message}</p>`;
        choicesButtonsEl.innerHTML = '';
    };

    // Item Modal Logic
    const openItemModal = (itemName) => {
        const item = items[itemName];
        itemModalTitle.textContent = item.name;
        itemModalDescription.textContent = item.description;

        itemUseBtn.onclick = () => {
            const feedback = [];
            item.use(feedback);
            closeItemModal();
            showFeedback(feedback);
        };
        itemDropBtn.onclick = () => {
            removeItem(itemName);
            closeItemModal();
            showFeedback([`You dropped the ${item.name}.`]);
        };

        itemModal.classList.remove('hidden');
    };

    const closeItemModal = () => itemModal.classList.add('hidden');
    itemModalCloseBtn.onclick = closeItemModal;
    
    // Game Data
    const rooms = {
        start: {
            title: "The Dungeon Entrance",
            description: "You stand before a heavy wooden door, the entrance to the 'Forgotten Dungeon'. The air is thick with the smell of dust and decay. A faint, flickering light seeps from beneath the door, and a chilling draft whispers through the cracks.",
            choices: [
                { text: 'Push open the heavy door', action: () => showRoom('goblinLair') },
                { text: 'Look around the entrance area', action: (feedback) => {
                    if (!gameState.player.inventory.includes('rusty sword')) {
                        feedback.push('In a dark corner, your foot nudges something hard. You find a Rusty Sword clutched in a skeletal hand. You take it.');
                        addItem('rusty sword');
                    } else {
                        feedback.push('You\'ve already searched this area. There is nothing else of interest.');
                    }
                }}
            ]
        },
        goblinLair: {
            title: "Goblin Guard Post",
            description: () => gameState.flags.goblinDefeated ? "The corpse of the goblin lies on the stone floor. The room is now quiet, save for the dripping of water. A path leads deeper into the dungeon." : "You push the door open into a small, damp chamber. A foul smell assaults your senses. A Goblin, startled from its meal of unidentifiable gristle, snarls and raises a crude club.",
            choices: [
                { text: 'Move forward into the hallway', condition: gs => gs.flags.goblinDefeated, action: () => showRoom('mainHallway') },
                { text: 'Charge the Goblin!', condition: gs => !gs.flags.goblinDefeated, action: () => startCombat({ name: 'Goblin', health: 50, attack: 15, description: 'A vicious little creature with sharp teeth and a mean streak.', flag: 'goblinDefeated', loot: 'health potion' }, 'goblinLair') }
            ]
        },
        mainHallway: {
            title: "The Main Hallway",
            description: "You are in a long hallway, lit by sputtering torches that cast dancing shadows. There are three doors here: a sturdy wooden door to your left, a crumbling doorway to your right, and a grand stone archway at the far end of the hall.",
            choices: [
                { text: 'Enter the left door (Alchemist\'s Study)', action: () => showRoom('alchemistStudy') },
                { text: 'Enter the right door (Spider\'s Nest)', action: () => showRoom('spiderNest') },
                { text: 'Approach the grand stone archway', action: () => showRoom('guardianAntechamber') },
                { text: 'Return to the entrance', action: () => showRoom('start') },
            ]
        },
        alchemistStudy: {
            title: "Alchemist's Study",
            description: () => {
                switch(gameState.flags.alchemistQuest){
                    case 'none': return "The room is a mess of broken glass, overturned tables, and esoteric charts. A frail, old man in tattered robes looks up. 'A visitor! Be wary, adventurer. If you can help me, I may help you. I need some... fresh Spider Silk for a potion.'";
                    case 'accepted': return "The old alchemist looks at you expectantly. 'Have you retrieved the Spider Silk? Be quick, my time is short.'";
                    case 'completed': return "The alchemist nods at you. 'Thank you again for your help. May your journey be a safe one.' In one corner, you see a set of three dusty levers on the wall.";
                }
            },
            choices: [
                { text: 'Accept the quest', condition: gs => gs.flags.alchemistQuest === 'none', action: (feedback) => {
                    gameState.flags.alchemistQuest = 'accepted';
                    feedback.push("'Excellent!' the alchemist rasps. 'You might find spiders through the crumbling doorway in the main hall.'");
                    showRoom('alchemistStudy');
                }},
                 { text: 'Interact with the levers', condition: gs => gs.flags.alchemistQuest === 'completed', action: () => showRoom('leverPuzzle') },
                { text: 'Leave the study', action: () => showRoom('mainHallway') }
            ]
        },
        leverPuzzle: {
            title: "The Lever Puzzle",
            description: () => gameState.flags.puzzleSolved ? "The secret compartment is open, its contents taken." : "Three levers are set into the wall: Left, Middle, and Right. They are all in the 'up' position.",
            choices: [
                { text: 'Pull them: Middle, Right, Left', condition: gs => !gs.flags.puzzleSolved, action: (feedback) => {
                    feedback.push('You hear a satisfying *click* and a stone slab slides away, revealing a hidden compartment!');
                    if (!gameState.player.inventory.includes('ornate dagger')) {
                        feedback.push('Inside, you find an Ornate Dagger.');
                        addItem('ornate dagger');
                    }
                    gameState.flags.puzzleSolved = true;
                }},
                 { text: 'Try another combination', condition: gs => !gs.flags.puzzleSolved, action: (feedback) => {
                     feedback.push('Nothing happens. You hear a faint resetting sound.');
                 }},
                { text: 'Leave', action: () => showRoom('alchemistStudy') }
            ]
        },
        spiderNest: {
            title: "Spider's Nest",
            description: () => gameState.flags.spiderDefeated ? "The giant spider's carcass is sprawled in the center of the room, which is now still and quiet. Webs cover everything." : "The crumbling doorway leads into a dark, web-filled room. The air is thick with a cloying scent. A Giant Spider descends from the ceiling, its many eyes fixed on you.",
            choices: [
                { text: 'Fight the Giant Spider', condition: gs => !gs.flags.spiderDefeated, action: () => startCombat({ name: 'Giant Spider', health: 80, attack: 20, description: 'A horrifyingly large arachnid with dripping fangs.', flag: 'spiderDefeated', loot: 'spider silk' }, 'spiderNest') },
                { text: 'Leave the nest', action: () => showRoom('mainHallway') }
            ]
        },
        guardianAntechamber: {
            title: "Guardian's Antechamber",
            description: "You pass through the archway into a circular room dominated by a massive Stone Guardian. It has no face, only a smooth surface where eyes should be. Behind it is a colossal door, presumably the exit. In one corner of the room, a ghostly spirit shimmers.",
            choices: [
                 { text: 'Approach the Stone Guardian', action: () => showRoom('stoneGuardian') },
                 { text: 'Speak to the Ghostly Spirit', action: (feedback) => {
                    if(!gameState.flags.talkedToGhost){
                        feedback.push('"Bound to this place..." it whispers. "The Guardian protects the Master\'s great secret. It was made to see not with eyes, but with the dungeon\'s heart. A gem... he loved his gems..."');
                        gameState.flags.talkedToGhost = true;
                    } else {
                        feedback.push('The spirit swirls mournfully, having no more to say.');
                    }
                }},
                 { text: 'Go back to the hallway', action: () => showRoom('mainHallway') }
            ]
        },
        stoneGuardian: {
            title: "Before the Stone Guardian",
            description: "The Stone Guardian is immense, radiating an ancient, unyielding power. It remains perfectly still, blocking the final door.",
            choices: [
                { text: 'Present the Glowing Gem', condition: gs => gs.player.inventory.includes('glowing gem'), action: (feedback) => {
                    feedback.push("You hold out the Glowing Gem. A cavity opens in the guardian's chest. You place the gem inside, and it flares with light. The guardian steps aside, revealing the exit.");
                    showRoom('exit');
                }},
                { text: 'Attack the Guardian', action: (feedback) => feedback.push('Your weapon scrapes uselessly against the magical stone.') },
                { text: 'Return to the antechamber', action: () => showRoom('guardianAntechamber') }
            ]
        },
        exit: {
            title: "The Way Out",
            description: "The path is clear. A staircase spirals upwards towards a sliver of bright, natural light. You have found the way out of the Forgotten Dungeon.",
            choices: [
                { text: 'Escape the Dungeon (Normal Ending)', condition: gs => !gs.flags.talkedToGhost, action: () => gameOver('You climb the stairs and emerge into the sunlight, free at last. The secrets of the dungeon, and the spirits within, remain forgotten.') },
                { text: 'Escape the Dungeon (True Ending)', condition: gs => gs.flags.talkedToGhost, action: () => gameOver('You ascend into the light, not just as an escapee, but as a liberator. By understanding its past, you have brought peace to this forgotten place and freed the sorrowful spirit. You carry its silent gratitude with you.') }
            ]
        }
    };
    
    // Add missing items/rooms from the original prompt for completeness
    rooms.mainHallway.choices.push({ text: 'Examine a side passage', action: () => showRoom('treasureRoom')});
    rooms.treasureRoom = {
        title: 'Hidden Alcove',
        description: () => gameState.player.inventory.includes('glowing gem') ? "The chest is open and empty." : "A small, hidden alcove contains a dusty chest.",
        choices: [
            { text: 'Open the chest', condition: gs => !gs.player.inventory.includes('glowing gem'), action: (feedback) => {
                feedback.push('The chest creaks open. Inside, resting on velvet, is a large Glowing Gem!');
                addItem('glowing gem');
            }},
            { text: 'Return to the hallway', action: () => showRoom('mainHallway')}
        ]
    };

    // Save/Load/Restart Logic
    restartBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to restart? All unsaved progress will be lost.')) {
            gameState = {
                player: { health: 100, maxHealth: 100, inventory: [] },
                currentRoom: 'start',
                flags: { goblinDefeated: false, talkedToGhost: false, puzzleSolved: false, alchemistQuest: 'none', spiderDefeated: false }
            };
            showRoom('start');
        }
    });

    saveBtn.addEventListener('click', () => {
        try {
            localStorage.setItem('dungeonGameState', JSON.stringify(gameState));
            alert('Game Saved!');
        } catch (e) {
            console.error(e);
            alert('Could not save game. Your browser may be blocking local storage.');
        }
    });

    loadBtn.addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            if (confirm('Load your saved game? This will overwrite your current progress.')) {
                gameState = JSON.parse(savedState);
                alert('Game Loaded!');
                showRoom(gameState.currentRoom);
            }
        } else {
            alert('No saved game found.');
        }
    });

    // Initial Game Start
    showRoom(gameState.currentRoom);
});