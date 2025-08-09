document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const storyTextEl = document.getElementById('story-text');
    const feedbackTextEl = document.getElementById('feedback-text');
    const roomTitleEl = document.getElementById('room-title');
    const choicesButtonsEl = document.getElementById('choices-buttons');
    const inventoryListEl = document.getElementById('inventory-list');
    const healthBarEl = document.getElementById('health-bar');
    const healthTextEl = document.getElementById('health-text');
    const hintBtn = document.getElementById('hint-btn');
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
    let gameState = {};

    const getInitialState = () => ({
        player: { health: 100, maxHealth: 100, inventory: [] },
        currentRoom: 'start',
        flags: {
            goblinDefeated: false,
            talkedToGhost: false,
            alchemistQuest: 'none', // none, accepted, completed
            leverPuzzleSolved: false,
            spiderDefeated: false,
            archivesDrained: false,
        }
    });

    // Item Definitions
    const items = {
        'rusty sword': { name: 'Rusty Sword', description: 'Deals moderate damage. A trusty, if ugly, blade.', use: (feedback) => feedback.push('This is a weapon. It is automatically used in combat.') },
        'health potion': { name: 'Health Potion', description: 'A swirling red liquid that restores 50 health.', use: (feedback) => {
            if (gameState.player.health >= gameState.player.maxHealth) { feedback.push('You are already at full health.'); }
            else { gameState.player.health = Math.min(gameState.player.maxHealth, gameState.player.health + 50); removeItem('health potion'); feedback.push('You drink the health potion. You recovered 50 health.'); updatePlayerStats(); }
        }},
        'ornate dagger': { name: 'Ornate Dagger', description: 'A beautifully crafted dagger. Deals significant damage.', use: (feedback) => feedback.push('A fine weapon. It is automatically used in combat.') },
        'glowing gem': { name: 'Glowing Gem', description: 'A fist-sized gem that emits a soft, ethereal light. It hums with a power that feels ancient and connected to this dungeon. This feels like the "Heartstone" the Alchemist\'s notes mentioned.', use: (feedback) => feedback.push('The gem hums warmly in your hand, but does nothing by itself.') },
        'master alchemists notes': { name: 'Master Alchemist\'s Notes', description: 'Faded notes found in the archives. It details the creation of a Stone Guardian, stating it is keyed to a power source called a "Heartstone" and will not permit passage to any who do not bear it.', use: (feedback) => feedback.push('The notes confirm the guardian needs a "Heartstone" to be bypassed.') },
        'spider silk': { name: 'Spider Silk', description: 'A clump of strong, sticky spider silk.', use: (feedback) => {
            if(gameState.currentRoom === 'alchemistStudy' && gameState.flags.alchemistQuest === 'accepted'){
                removeItem('spider silk');
                addItem('health potion');
                gameState.flags.alchemistQuest = 'completed';
                feedback.push('You give the silk to the Alchemist. "Wonderful!" he cackles, handing you a potent Health Potion. "Now I can finish my work."');
                showRoom('alchemistStudy'); // Refresh room
            } else { feedback.push('This silk is strong, but you have no use for it right here.'); }
        }},
        'lever handle': { name: 'Lever Handle', description: 'A heavy iron handle, rusted but solid. It looks like it could fit onto a drainage pump mechanism.', use: (feedback) => {
            if(gameState.currentRoom === 'floodedArchives'){
                if(!gameState.flags.archivesDrained){
                    removeItem('lever handle');
                    gameState.flags.archivesDrained = true;
                    feedback.push('You fit the handle onto the pump and give it a mighty heave. With a great groan, the pump activates, and the murky water begins to drain away, revealing a clear path and a previously submerged chest.');
                    showRoom('floodedArchives');
                } else {
                    feedback.push('The pump has already been operated.');
                }
            } else {
                feedback.push('This handle doesn\'t fit anything here.');
            }
        }}
    };

    // --- Core Game Logic ---
    const updatePlayerStats = () => {
        const { health, maxHealth } = gameState.player;
        healthBarEl.style.width = `${(health / maxHealth) * 100}%`;
        healthTextEl.textContent = `${health}/${maxHealth}`;
        updateInventory();
    };

    const addItem = (itemName) => { if (!gameState.player.inventory.includes(itemName)) { gameState.player.inventory.push(itemName); } updateInventory(); };
    const removeItem = (itemName) => { gameState.player.inventory = gameState.player.inventory.filter(item => item !== itemName); updateInventory(); };

    const updateInventory = () => {
        inventoryListEl.innerHTML = gameState.player.inventory.length === 0 ? '<li>Your inventory is empty.</li>' : gameState.player.inventory.map(itemName => `<li onclick="openItemModal('${itemName}')">${items[itemName].name}</li>`).join('');
    };

    const showFeedback = (feedback) => {
        feedbackTextEl.innerHTML = feedback.length > 0 ? feedback.join('<br>') : '';
    };

    const showRoom = (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        gameState.currentRoom = roomId;
        roomTitleEl.textContent = room.title;
        storyTextEl.innerHTML = typeof room.description === 'function' ? room.description() : room.description;
        feedbackTextEl.innerHTML = '';
        choicesButtonsEl.innerHTML = '';

        const availableChoices = room.choices.filter(choice => !choice.condition || choice.condition(gameState));
        availableChoices.forEach(choice => {
            const button = document.createElement('button');
            button.innerHTML = choice.text; // Use innerHTML to allow icons or other tags if needed
            button.onclick = () => {
                const feedback = [];
                choice.action(feedback);
                showFeedback(feedback);
            };
            choicesButtonsEl.appendChild(button);
        });
        updatePlayerStats();
    };

    const startCombat = (enemy, postCombatRoomId) => {
        // Combat logic remains the same as previous enhanced version
        const originalRoomId = gameState.currentRoom;
        gameState.currentRoom = 'inCombat';
        let currentEnemy = { ...enemy };

        const renderCombatUI = () => {
            roomTitleEl.textContent = `In Combat with ${currentEnemy.name}!`;
            storyTextEl.innerHTML = `<p>${currentEnemy.description}</p><p>The ${currentEnemy.name} has ${currentEnemy.health} health remaining.</p>`;
            choicesButtonsEl.innerHTML = '';
            
            const attackBtn = document.createElement('button');
            attackBtn.textContent = 'Attack';
            attackBtn.onclick = playerTurn;
            choicesButtonsEl.appendChild(attackBtn);

            if (gameState.player.inventory.includes('health potion')) {
                const usePotionBtn = document.createElement('button');
                usePotionBtn.textContent = 'Use Health Potion';
                usePotionBtn.onclick = () => { const f = []; items['health potion'].use(f); showFeedback(f); if(gameState.player.health > 0) enemyTurn(); };
                choicesButtonsEl.appendChild(usePotionBtn);
            }

            const fleeBtn = document.createElement('button');
            fleeBtn.textContent = 'Flee';
            fleeBtn.onclick = () => {
                if (Math.random() < 0.5) { showFeedback(['You successfully escaped!']); setTimeout(() => showRoom(originalRoomId), 1000); }
                else { showFeedback(['Your attempt to flee failed!']); setTimeout(enemyTurn, 1000); }
            };
            choicesButtonsEl.appendChild(fleeBtn);
        };

        const playerTurn = () => {
            const playerDamage = gameState.player.inventory.includes('ornate dagger') ? 25 : gameState.player.inventory.includes('rusty sword') ? 15 : 8;
            const damage = Math.floor(Math.random() * 10) + playerDamage;
            currentEnemy.health -= damage;
            showFeedback([`You strike the ${currentEnemy.name} for ${damage} damage.`]);
            if (currentEnemy.health <= 0) { endCombat(); } else { setTimeout(enemyTurn, 1000); }
        };

        const enemyTurn = () => {
            if (gameState.player.health <= 0) return;
            const damage = Math.floor(Math.random() * currentEnemy.attack) + 5;
            gameState.player.health -= damage;
            updatePlayerStats();
            showFeedback([`The ${currentEnemy.name} attacks you for ${damage} damage.`]);
            if (gameState.player.health <= 0) { gameOver('You have been slain in battle...'); } else { setTimeout(renderCombatUI, 1000); }
        };

        const endCombat = () => {
            const feedback = [`You have defeated the ${currentEnemy.name}!`];
            if (enemy.flag) gameState.flags[enemy.flag] = true;
            if (enemy.loot) { addItem(enemy.loot); feedback.push(`The ${currentEnemy.name} dropped a ${items[enemy.loot].name}.`); }
            showFeedback(feedback);
            setTimeout(() => showRoom(postCombatRoomId), 2000);
        };

        renderCombatUI();
    };

    const gameOver = (message) => {
        gameState.currentRoom = 'gameOver';
        roomTitleEl.textContent = 'Game Over';
        storyTextEl.innerHTML = `<p>${message}</p>`;
        feedbackTextEl.innerHTML = '';
        choicesButtonsEl.innerHTML = '';
    };

    // --- Modal & Hint Logic ---
    window.openItemModal = (itemName) => {
        const item = items[itemName];
        itemModalTitle.textContent = item.name;
        itemModalDescription.textContent = item.description;
        itemUseBtn.onclick = () => { const f = []; item.use(f); closeItemModal(); showFeedback(f); };
        itemDropBtn.onclick = () => { removeItem(itemName); closeItemModal(); showFeedback([`You dropped the ${item.name}.`]); };
        itemModal.classList.remove('hidden');
    };
    const closeItemModal = () => itemModal.classList.add('hidden');
    itemModalCloseBtn.onclick = closeItemModal;

    const getHint = () => {
        let hint = "I'm not sure what to do here.";
        if (gameState.currentRoom === 'stoneGuardian' && !gameState.player.inventory.includes('glowing gem')) {
            hint = 'The Stone Guardian is impassable. The ghost and the alchemist\'s notes both mentioned a "Heartstone" or gem. I must find it. Perhaps there is an area I haven\'t fully explored?';
        } else if (gameState.currentRoom === 'floodedArchives' && !gameState.flags.archivesDrained && !gameState.player.inventory.includes('lever handle')) {
            hint = 'This water is too deep. I need to find a way to drain it. There must be a pump mechanism, but it might be missing a part.';
        } else if (gameState.currentRoom === 'floodedArchives' && !gameState.flags.archivesDrained && gameState.player.inventory.includes('lever handle')) {
            hint = 'I have the lever handle! I should try using it on the drainage pump in this room.';
        } else if (gameState.flags.alchemistQuest === 'accepted' && !gameState.player.inventory.includes('spider silk')) {
            hint = 'The alchemist wants spider silk. I should look for the spider nest he mentioned, likely through the most decrepit-looking door.';
        } else if (gameState.currentRoom === 'antechamber') {
            hint = 'This seems to be a central hub. I should explore all the paths from here: the East Wing, the West Wing, and the Guardian\'s door.';
        } else {
            hint = 'I should explore all available rooms and interact with everything I can. Sometimes items found in one area are needed in another.';
        }
        showFeedback([`Hint: ${hint}`]);
    };

    // --- Game Data: Rooms ---
    const rooms = {
        start: {
            title: "The Dungeon Entrance",
            description: "You stand before a heavy wooden door, the entrance to the 'Forgotten Dungeon'. The air is thick with the smell of dust and decay. A chilling draft whispers through the cracks.",
            choices: [
                { text: 'Push open the heavy door', action: () => showRoom('goblinLair') },
                { text: 'Look around the entrance area', action: (f) => {
                    if (!gameState.player.inventory.includes('rusty sword')) { f.push('In a corner, you find a Rusty Sword clutched in a skeletal hand. You take it.'); addItem('rusty sword'); }
                    else { f.push('You\'ve already searched this area.'); }
                }}
            ]
        },
        goblinLair: {
            title: "Goblin Guard Post",
            description: () => gameState.flags.goblinDefeated ? "The corpse of the goblin lies on the stone floor. The room is now quiet. A single path leads deeper into the dungeon." : "You enter a small, damp chamber. A Goblin, startled from its meal, snarls and raises a crude club.",
            choices: [
                { text: 'Move forward into the hallway', condition: gs => gs.flags.goblinDefeated, action: () => showRoom('antechamber') },
                { text: 'Fight the Goblin', condition: gs => !gs.flags.goblinDefeated, action: () => startCombat({ name: 'Goblin', health: 50, attack: 15, description: 'A vicious little creature.', flag: 'goblinDefeated', loot: 'health potion' }, 'goblinLair') }
            ]
        },
        antechamber: {
            title: "The Grand Antechamber",
            description: "You are in a large, circular hub room. Torches cast long shadows. There are three main paths: an archway to the East Wing, a sturdy door leading to the West Wing, and directly ahead, a colossal stone door watched over by a silent, motionless Guardian.",
            choices: [
                { text: 'Enter the East Wing', action: () => showRoom('eastHallway') },
                { text: 'Enter the West Wing', action: () => showRoom('westHallway') },
                { text: 'Approach the Stone Guardian', action: () => showRoom('stoneGuardian') }
            ]
        },
        // --- East Wing ---
        eastHallway: {
            title: "East Wing Hallway",
            description: "This hallway is filled with the scent of strange chemicals and decay. A tidy-looking door stands to the left, while a crumbling doorway on the right is covered in thick cobwebs.",
            choices: [
                { text: 'Enter the tidy door (Alchemist\'s Study)', action: () => showRoom('alchemistStudy') },
                { text: 'Enter the crumbling doorway (Spider\'s Nest)', action: () => showRoom('spiderNest') },
                { text: 'Return to the Antechamber', action: () => showRoom('antechamber') },
            ]
        },
        alchemistStudy: {
            title: "Alchemist's Study",
            description: () => {
                if(gameState.flags.leverPuzzleSolved) return "The old alchemist is busy at his table, occasionally glancing at the empty hidden compartment in the wall. He seems to have no more to say to you.";
                switch(gameState.flags.alchemistQuest){
                    case 'none': return "The room is a mess of broken glass and esoteric charts. A frail, old man in tattered robes looks up. 'A visitor! If you can help me, I may help you. I need fresh Spider Silk for a potion.'";
                    case 'accepted': return "The old alchemist looks at you expectantly. 'Have you retrieved the Spider Silk?'";
                    case 'completed': return "The alchemist nods at you. 'Thank you again. Now I can work.' He gestures to a set of dusty levers on the wall. 'A small puzzle the old Master set for me. Never could figure out the order he scribbled in his ledger.'";
                }
            },
            choices: [
                { text: 'Accept the quest', condition: gs => gs.flags.alchemistQuest === 'none', action: (f) => { gameState.flags.alchemistQuest = 'accepted'; f.push("'Excellent!' he rasps. 'Find the spiders, bring me their silk!'"); showRoom('alchemistStudy'); }},
                { text: 'Interact with the levers', condition: gs => gs.flags.alchemistQuest === 'completed' && !gs.flags.leverPuzzleSolved, action: (f) => {
                     f.push("You pull the levers: Middle, Right, Left. With a *click*, a stone slab slides away, revealing an Ornate Dagger!");
                     addItem('ornate dagger');
                     gameState.flags.leverPuzzleSolved = true;
                }},
                { text: 'Leave the study', action: () => showRoom('eastHallway') }
            ]
        },
        spiderNest: {
            title: "Spider's Nest",
            description: () => gameState.flags.spiderDefeated ? "The giant spider's carcass is sprawled here amidst the thick webs." : "The doorway leads into a dark, web-filled room. A Giant Spider descends from the ceiling, its many eyes fixed on you.",
            choices: [
                { text: 'Fight the Giant Spider', condition: gs => !gs.flags.spiderDefeated, action: () => startCombat({ name: 'Giant Spider', health: 80, attack: 20, description: 'A horrifyingly large arachnid.', flag: 'spiderDefeated', loot: 'spider silk' }, 'spiderNest') },
                { text: 'Leave the nest', action: () => showRoom('eastHallway') }
            ]
        },
        // --- West Wing ---
        westHallway: {
            title: "West Wing Hallway",
            description: "This part of the dungeon feels older and less stable. Dust motes dance in the air. One path leads to a room from which you can hear dripping water, while another seems to be a simple maintenance tunnel.",
            choices: [
                { text: 'Enter the dripping room (Flooded Archives)', action: () => showRoom('floodedArchives') },
                { text: 'Enter the Maintenance Tunnel', action: () => showRoom('maintenanceTunnel') },
                { text: 'Return to the Antechamber', action: () => showRoom('antechamber') }
            ]
        },
        floodedArchives: {
            title: "The Flooded Archives",
            description: () => {
                if(gameState.flags.archivesDrained){
                    return "The water has receded, revealing shelves of ruined books and a clear path across the room. A single, heavy chest sits in the center of the room, now accessible.";
                }
                return "The room is an archive, but it's flooded with murky, knee-deep water, blocking access to the far side. On a small patch of dry land, a large, rusted water pump sits silently. The socket for its operating lever is empty.";
            },
            choices: [
                { text: 'Open the revealed chest', condition: gs => gs.flags.archivesDrained && !gs.player.inventory.includes('master alchemists notes'), action: (f) => {
                    f.push("You open the heavy, waterlogged chest. Inside, preserved in oilskin, you find the Master Alchemist's Notes!");
                    addItem('master alchemists notes');
                }},
                { text: 'Cross the room to the far door', condition: gs => gs.flags.archivesDrained, action: () => showRoom('collapsedObservatory')},
                { text: 'Return to the hallway', action: () => showRoom('westHallway') }
            ]
        },
        maintenanceTunnel: {
            title: "Maintenance Tunnel",
            description: "A narrow, grime-covered tunnel. It smells of rust and stagnant water. Tools lie scattered on the floor.",
            choices: [
                 { text: 'Search the scattered tools', action: (f) => {
                     if(!gameState.player.inventory.includes('lever handle')){
                        f.push('Amongst the debris, you find a heavy, iron Lever Handle. This might be useful.');
                        addItem('lever handle');
                     } else {
                        f.push('You find nothing else of use here.');
                     }
                 }},
                 { text: 'Return to the hallway', action: () => showRoom('westHallway') }
            ]
        },
        collapsedObservatory: {
            title: "Collapsed Observatory",
            description: "This room was once a grand observatory, but the ceiling has collapsed, leaving a massive hole open to the sky above. Starlight filters down, illuminating the dust. In the center of the room, on a pedestal, something glitters.",
            choices: [
                { text: 'Take the glittering object', condition: gs => !gs.player.inventory.includes('glowing gem'), action: (f) => {
                    f.push("You approach the pedestal and pick up the source of the light: a magnificent, Glowing Gem that hums with energy.");
                    addItem('glowing gem');
                }},
                { text: 'Return to the archives', action: () => showRoom('floodedArchives') }
            ]
        },
        // --- Final Area ---
        stoneGuardian: {
            title: "Before the Stone Guardian",
            description: "The Stone Guardian is immense, radiating an ancient, unyielding power. In a corner, a Ghostly Spirit shimmers sorrowfully. The Guardian blocks the final door.",
            choices: [
                { text: 'Present the Glowing Gem', condition: gs => gs.player.inventory.includes('glowing gem'), action: (f) => {
                    f.push("You hold out the Glowing Gem. A cavity opens in the guardian's chest. You place the gem inside, and it flares with light. The guardian steps aside, revealing the exit.");
                    showRoom('exit');
                }},
                { text: 'Speak to the Ghostly Spirit', action: (f) => {
                    if(!gameState.flags.talkedToGhost){
                        f.push('"Bound to this place..." it whispers. "The Guardian protects the Master\'s great secret. It was made to see not with eyes, but with the dungeon\'s heart. A gem... a Heartstone... he hid it where the starlight could touch it."');
                        gameState.flags.talkedToGhost = true;
                    } else { f.push('The spirit swirls mournfully, having no more to say.'); }
                }},
                { text: 'Attack the Guardian', action: (f) => f.push('Your weapon scrapes uselessly against the magical stone.') },
                { text: 'Return to the Antechamber', action: () => showRoom('antechamber') }
            ]
        },
        exit: {
            title: "The Way Out",
            description: "The path is clear. A staircase spirals upwards towards a sliver of bright, natural light. You have found the way out of the Forgotten Dungeon.",
            choices: [
                { text: 'Escape the Dungeon (True Ending)', action: () => gameOver('You ascend into the light, not just as an escapee, but as one who unraveled the dungeon\'s secrets. By understanding its past and freeing the spirit, you leave with both your life and your wisdom. The End.') }
            ]
        }
    };

    // --- Initialization and Event Listeners ---
    const initGame = () => {
        gameState = getInitialState();
        showRoom(gameState.currentRoom);
    };

    restartBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to restart? All unsaved progress will be lost.')) {
            initGame();
        }
    });

    saveBtn.addEventListener('click', () => {
        try { localStorage.setItem('dungeonGameState', JSON.stringify(gameState)); alert('Game Saved!'); }
        catch (e) { alert('Could not save game.'); }
    });

    loadBtn.addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            if (confirm('Load your saved game? This will overwrite your current progress.')) {
                gameState = JSON.parse(savedState);
                alert('Game Loaded!');
                showRoom(gameState.currentRoom);
            }
        } else { alert('No saved game found.'); }
    });

    hintBtn.addEventListener('click', getHint);

    initGame();
});