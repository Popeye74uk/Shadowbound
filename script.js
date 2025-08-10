/* The Forgotten Dungeon - v0.9 */
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
            alchemistQuest: 'none',
            leverPuzzleSolved: false,
            spiderDefeated: false,
            archivesDrained: false,
        }
    });

    // Item Definitions
    const items = {
        'rusty sword': { name: 'Rusty Sword', description: 'Deals moderate damage. A trusty, if ugly, blade.', use: (f) => f.push('This is a weapon. It is automatically used in combat.') },
        'health potion': { name: 'Health Potion', description: 'A swirling red liquid that restores 50 health.', use: (f) => {
            if (gameState.player.health >= gameState.player.maxHealth) { f.push('You are already at full health.'); }
            else { gameState.player.health = Math.min(gameState.player.maxHealth, gameState.player.health + 50); removeItem('health potion'); f.push('You drink the health potion. You recovered 50 health.'); updatePlayerStats(); }
        }},
        'ornate dagger': { name: 'Ornate Dagger', description: 'A beautifully crafted dagger. Deals significant damage.', use: (f) => f.push('A fine weapon. It is automatically used in combat.') },
        'glowing gem': { name: 'Glowing Gem', description: 'A fist-sized gem that hums with power. This feels like the "Heartstone" the Alchemist\'s notes mentioned.', use: (f) => f.push('The gem hums warmly in your hand, but does nothing by itself.') },
        'master alchemists notes': { name: 'Master Alchemist\'s Notes', description: 'Faded notes confirming the guardian is keyed to a "Heartstone" and will not permit passage to any who do not bear it.', use: (f) => f.push('The notes confirm the guardian needs a "Heartstone".') },
        'spider silk': { name: 'Spider Silk', description: 'A clump of strong, sticky spider silk.', use: (f) => {
            if(gameState.currentRoom === 'alchemistStudy' && gameState.flags.alchemistQuest === 'accepted'){
                removeItem('spider silk');
                addItem('health potion');
                gameState.flags.alchemistQuest = 'completed';
                f.push('You give the silk to the Alchemist. "Wonderful!" he cackles, handing you a potent Health Potion. "Now I can finish my work."');
                showRoom('alchemistStudy');
            } else { f.push('This silk is strong, but you have no use for it right here.'); }
        }},
        'lever handle': { name: 'Lever Handle', description: 'A heavy iron handle, rusted but solid. It looks like it could fit onto a drainage pump mechanism.', use: (f) => {
            if(gameState.currentRoom === 'floodedArchives' && !gameState.flags.archivesDrained){
                removeItem('lever handle');
                gameState.flags.archivesDrained = true;
                f.push('You fit the handle onto the pump and give it a mighty heave. With a groan, the pump activates, and the murky water begins to drain away, revealing a clear path and a previously submerged chest.');
                showRoom('floodedArchives');
            } else { f.push('This handle doesn\'t fit anything here.'); }
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
        inventoryListEl.innerHTML = ''; // Clear old inventory before rebuilding
        if (gameState.player.inventory.length === 0) {
            inventoryListEl.innerHTML = '<li>Your inventory is empty.</li>';
        } else {
            gameState.player.inventory.forEach(itemName => {
                const li = document.createElement('li');
                li.textContent = items[itemName].name;
                // **BUG FIX IS HERE**: Use addEventListener for robust, scoped event handling
                li.addEventListener('click', () => openItemModal(itemName));
                inventoryListEl.appendChild(li);
            });
        }
    };

    const showFeedback = (feedback) => {
        feedbackTextEl.innerHTML = feedback.length > 0 ? feedback.join('<br>') : '';
    };

    const showRoom = (roomId) => {
        const room = rooms[roomId];
        if (!room) { console.error(`Room with id "${roomId}" not found!`); return; }

        gameState.currentRoom = roomId;
        roomTitleEl.textContent = room.title;
        storyTextEl.innerHTML = typeof room.description === 'function' ? room.description() : room.description;
        feedbackTextEl.innerHTML = '';
        choicesButtonsEl.innerHTML = '';

        const availableChoices = room.choices.filter(choice => !choice.condition || choice.condition(gameState));
        availableChoices.forEach(choice => {
            const button = document.createElement('button');
            button.innerHTML = choice.text;
            button.onclick = () => { const f = []; choice.action(f); showFeedback(f); };
            choicesButtonsEl.appendChild(button);
        });
        updatePlayerStats();
    };

    const startCombat = (enemy, postCombatRoomId) => {
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
                usePotionBtn.onclick = () => { const f = []; items['health potion'].use(f); showFeedback(f); if(gameState.player.health > 0) setTimeout(enemyTurn, 1000); };
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
            if (gameState.player.health <= 0 || currentEnemy.health <= 0) return;
            const damage = Math.floor(Math.random() * currentEnemy.attack) + 5;
            gameState.player.health -= damage;
            updatePlayerStats();
            showFeedback([`The ${currentEnemy.name} attacks you for ${damage} damage.`]);
            if (gameState.player.health <= 0) { gameOver('You have been slain in battle...'); } else { setTimeout(renderCombatUI, 1000); }
        };

        const endCombat = () => {
            const feedback = [`You have defeated the ${currentEnemy.name}!`];
            if (enemy.flag) gameState.flags[enemy.flag] = true;
            if (enemy.loot) {
                addItem(enemy.loot);
                feedback.push(`The ${currentEnemy.name} dropped a ${items[enemy.loot].name}. You picked it up.`);
            }
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

    // --- Modal, Hint, and Save/Load Logic ---
    const openItemModal = (itemName) => {
        const item = items[itemName];
        itemModalTitle.textContent = item.name;
        itemModalDescription.textContent = item.description;
        itemUseBtn.onclick = () => { const f = []; item.use(f); closeItemModal(); showFeedback(f); };
        itemDropBtn.onclick = () => { const f = []; removeItem(itemName); showFeedback([`You dropped the ${item.name}.`]); closeItemModal(); }; // Simplified drop
        itemModal.classList.remove('hidden');
    };
    const closeItemModal = () => itemModal.classList.add('hidden');
    itemModalCloseBtn.onclick = closeItemModal;

    const getHint = () => {
        let hint;
        if (gameState.currentRoom === 'stoneGuardian' && !gameState.player.inventory.includes('glowing gem')) { hint = 'The Guardian is impassable. The ghost and notes mentioned a "Heartstone" gem. The ghost said it was hidden "where the starlight could touch it". I should explore the West Wing more thoroughly.'; }
        else if (gameState.currentRoom === 'floodedArchives' && !gameState.flags.archivesDrained && !gameState.player.inventory.includes('lever handle')) { hint = 'This water is too deep. I need to find a way to drain it. There must be a pump mechanism, and it might be missing a part. A maintenance tunnel sounds like a good place to look for spare parts.'; }
        else if (gameState.currentRoom === 'floodedArchives' && !gameState.flags.archivesDrained && gameState.player.inventory.includes('lever handle')) { hint = 'I have the lever handle! I should try using it on the drainage pump in this room.'; }
        else if (gameState.flags.alchemistQuest === 'accepted' && !gameState.player.inventory.includes('spider silk')) { hint = 'The alchemist wants spider silk. I should find and defeat the spider in the East Wing.'; }
        else { hint = 'I should explore all available rooms and interact with everything I can. Sometimes items found in one area are needed in another.'; }
        showFeedback([`Hint: ${hint}`]);
    };

    // --- Game Data: Rooms ---
    const rooms = {
        start: { title: "The Dungeon Entrance", description: "You stand before a heavy wooden door, the entrance to the 'Forgotten Dungeon'. The air is thick with the smell of dust and decay.", choices: [{ text: 'Push open the heavy door', action: () => showRoom('goblinLair') },{ text: 'Look around the entrance area', action: (f) => { if (!gameState.player.inventory.includes('rusty sword')) { f.push('In a corner, you find a Rusty Sword and take it.'); addItem('rusty sword'); } else { f.push("You've already searched this area."); } }}]},
        goblinLair: { title: "Goblin Guard Post", description: () => gameState.flags.goblinDefeated ? "The corpse of the goblin lies on the stone floor. A path leads deeper into the dungeon." : "You enter a small, damp chamber. A Goblin snarls and raises a crude club.", choices: [{ text: 'Move forward', condition: gs => gs.flags.goblinDefeated, action: () => showRoom('antechamber') },{ text: 'Fight the Goblin', condition: gs => !gs.flags.goblinDefeated, action: () => startCombat({ name: 'Goblin', health: 50, attack: 15, description: 'A vicious little creature.', flag: 'goblinDefeated', loot: 'health potion' }, 'goblinLair') }]},
        antechamber: { title: "The Grand Antechamber", description: "You are in a large, circular hub room. There are three paths: an archway to the East Wing, a sturdy door to the West Wing, and ahead, a colossal stone door watched over by a silent Guardian.", choices: [{ text: 'Enter the East Wing', action: () => showRoom('eastHallway') },{ text: 'Enter the West Wing', action: () => showRoom('westHallway') },{ text: 'Approach the Stone Guardian', action: () => showRoom('stoneGuardian') }]},
        eastHallway: { title: "East Wing Hallway", description: "This hallway smells of chemicals and decay. A tidy-looking door stands to the left, while a crumbling doorway on the right is covered in cobwebs.", choices: [{ text: "Enter the tidy door (Alchemist's Study)", action: () => showRoom('alchemistStudy') },{ text: "Enter the crumbling doorway (Spider's Nest)", action: () => showRoom('spiderNest') },{ text: 'Return to the Antechamber', action: () => showRoom('antechamber') },]},
        alchemistStudy: { title: "Alchemist's Study", description: () => { if(gameState.flags.leverPuzzleSolved) return "The old alchemist is busy at his table, occasionally glancing at the empty hidden compartment in the wall. He seems to have no more to say to you."; switch(gameState.flags.alchemistQuest){ case 'none': return "The room is a mess of broken glass and esoteric charts. A frail, old man looks up. 'A visitor! If you can help me, I may help you. I need fresh Spider Silk for a potion.'"; case 'accepted': return "The old alchemist looks at you expectantly. 'Have you retrieved the Spider Silk?'"; case 'completed': return "The alchemist nods. 'Thank you. Now I can work.' He gestures to levers on the wall. 'A small puzzle the old Master set for me. Never could figure out the order he scribbled in his ledger.'"; } }, choices: [{ text: 'Accept the quest', condition: gs => gs.flags.alchemistQuest === 'none', action: (f) => { gameState.flags.alchemistQuest = 'accepted'; f.push("'Excellent!' he rasps. 'Find the spiders, bring me their silk!'"); showRoom('alchemistStudy'); }},{ text: 'Interact with the levers', condition: gs => gs.flags.alchemistQuest === 'completed' && !gs.flags.leverPuzzleSolved, action: (f) => { f.push("You pull the levers: Middle, Right, Left. With a *click*, a stone slab slides away, revealing an Ornate Dagger! You take it."); addItem('ornate dagger'); gameState.flags.leverPuzzleSolved = true; }},{ text: 'Leave the study', action: () => showRoom('eastHallway') }]},
        spiderNest: { title: "Spider's Nest", description: () => gameState.flags.spiderDefeated ? "The giant spider's carcass is sprawled here amidst the thick webs." : "The doorway leads into a dark, web-filled room. A Giant Spider descends from the ceiling.", choices: [{ text: 'Fight the Giant Spider', condition: gs => !gs.flags.spiderDefeated, action: () => startCombat({ name: 'Giant Spider', health: 80, attack: 20, description: 'A horrifyingly large arachnid.', flag: 'spiderDefeated', loot: 'spider silk' }, 'spiderNest') },{ text: 'Leave the nest', action: () => showRoom('eastHallway') }]},
        westHallway: { title: "West Wing Hallway", description: "This part of the dungeon feels older. One path leads to a room from which you can hear dripping water, while another seems to be a simple maintenance tunnel.", choices: [{ text: 'Enter the dripping room (Flooded Archives)', action: () => showRoom('floodedArchives') },{ text: 'Enter the Maintenance Tunnel', action: () => showRoom('maintenanceTunnel') },{ text: 'Return to the Antechamber', action: () => showRoom('antechamber') }]},
        floodedArchives: { title: "The Flooded Archives", description: () => gameState.flags.archivesDrained ? "The water has receded, revealing shelves of ruined books and a clear path. A single, heavy chest sits in the center, now accessible." : "The room is an archive, flooded with murky, knee-deep water. On a patch of dry land, a large, rusted water pump sits silently. The socket for its lever is empty.", choices: [{ text: 'Open the revealed chest', condition: gs => gs.flags.archivesDrained && !gs.player.inventory.includes('master alchemists notes'), action: (f) => { f.push("You open the heavy chest. Inside, preserved in oilskin, you find the Master Alchemist's Notes! You take them."); addItem('master alchemists notes'); }},{ text: 'Cross the room to the far door', condition: gs => gs.flags.archivesDrained, action: () => showRoom('collapsedObservatory')},{ text: 'Return to the hallway', action: () => showRoom('westHallway') }]},
        maintenanceTunnel: { title: "Maintenance Tunnel", description: "A narrow, grime-covered tunnel. Tools lie scattered on the floor.", choices: [{ text: 'Search the scattered tools', action: (f) => { if(!gameState.player.inventory.includes('lever handle')){ f.push('Amongst the debris, you find a heavy, iron Lever Handle. You take it.'); addItem('lever handle'); } else { f.push('You find nothing else of use here.'); } }},{ text: 'Return to the hallway', action: () => showRoom('westHallway') }]},
        collapsedObservatory: { title: "Collapsed Observatory", description: "This room was once a grand observatory, but the ceiling has collapsed, leaving a massive hole open to the sky. Starlight filters down, illuminating a pedestal in the center of the room.", choices: [{ text: 'Take the glittering object from the pedestal', condition: gs => !gs.player.inventory.includes('glowing gem'), action: (f) => { f.push("You approach the pedestal and pick up the source of the light: a magnificent, Glowing Gem that hums with energy. You take it."); addItem('glowing gem'); }},{ text: 'Return to the archives', action: () => showRoom('floodedArchives') }]},
        stoneGuardian: { title: "Before the Stone Guardian", description: "The Stone Guardian is immense, radiating an ancient power. In a corner, a Ghostly Spirit shimmers sorrowfully. The Guardian blocks the final door.", choices: [{ text: 'Present the Glowing Gem', condition: gs => gs.player.inventory.includes('glowing gem'), action: (f) => { f.push("You hold out the Glowing Gem. A cavity opens in the guardian's chest. You place the gem inside, and it flares with light. The guardian steps aside, revealing the exit."); showRoom('exit'); }},{ text: 'Speak to the Ghostly Spirit', action: (f) => { if(!gameState.flags.talkedToGhost){ f.push('"Bound to this place..." it whispers. "The Guardian protects the Master\'s great secret. It was made to see not with eyes, but with the dungeon\'s heart. A gem... a Heartstone... he hid it where the starlight could touch it."'); gameState.flags.talkedToGhost = true; } else { f.push('The spirit swirls mournfully, having no more to say.'); } }},{ text: 'Attack the Guardian', action: (f) => f.push('Your weapon scrapes uselessly against the magical stone.') },{ text: 'Return to the Antechamber', action: () => showRoom('antechamber') }]},
        exit: { title: "The Way Out", description: "The path is clear. A staircase spirals upwards towards natural light. You have found the way out.", choices: [{ text: 'Escape the Dungeon (True Ending)', action: () => gameOver('You ascend into the light, not just as an escapee, but as one who unraveled the dungeon\'s secrets. You leave with both your life and your wisdom. The End.') }]}
    };

    // --- Initialization and Event Listeners ---
    const initGame = () => {
        gameState = getInitialState();
        showRoom(gameState.currentRoom);
    };

    restartBtn.addEventListener('click', () => { if (confirm('Are you sure you want to restart?')) { initGame(); } });
    saveBtn.addEventListener('click', () => { try { localStorage.setItem('dungeonGameState', JSON.stringify(gameState)); alert('Game Saved!'); } catch (e) { alert('Could not save game.'); } });
    loadBtn.addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            if (confirm('Load your saved game?')) {
                gameState = JSON.parse(savedState);
                alert('Game Loaded!');
                showRoom(gameState.currentRoom);
            }
        } else { alert('No saved game found.'); }
    });
    hintBtn.addEventListener('click', getHint);

    initGame();
});