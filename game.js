document.addEventListener('DOMContentLoaded', () => {
    const storyTextElement = document.getElementById('story-text');
    const choicesButtonsElement = document.getElementById('choices-buttons');
    const healthBarElement = document.getElementById('health-bar');
    const healthValueElement = document.getElementById('health-value');
    const inventoryListElement = document.getElementById('inventory-list');
    const actionLogElement = document.getElementById('action-log');

    let player = {
        health: 100,
        maxHealth: 100,
        inventory: [],
        progress: {
            hasRustedKey: false,
            puzzleSolved: false
        }
    };

    const rooms = {
        start: {
            description: "You stand at the entrance to a long-forgotten dungeon. A heavy wooden door looms in front of you, its frame weathered and cracked. Faint light flickers through a narrow gap under the door. The air is thick with dust, and you hear something skittering in the shadows.",
            choices: [
                { text: "Examine the door", action: "examineDoor" },
                { text: "Enter the door", action: "enterDoor" },
                { text: "Look around the room", action: "lookAroundStart" }
            ]
        },
        examineDoor: {
            description: "You inspect the heavy wooden door. It's barred from the other side, but you notice a rusted keyhole set into the wood.",
            choices: [
                { text: "Try to open the door", action: "enterDoor" },
                { text: "Look around the room", action: "lookAroundStart" }
            ]
        },
        lookAroundStart: {
            description: "Searching the dusty corners of the entrance hall, you find a rusty sword lying against the wall and a tattered note on the floor.",
            choices: [
                { text: "Pick up the rusty sword", action: "pickUpSword" },
                { text: "Read the note", action: "readNote" },
                { text: "Enter the door", action: "enterDoor" }
            ]
        },
        goblinCorridor: {
            description: "You step through the doorway into a narrow corridor. A foul-smelling goblin holding a crude club turns to face you with a snarl!",
            enemy: { name: "Goblin", health: 30, attack: 10 },
            choices: [
                { text: "Attack the Goblin", action: "attack" },
                { text: "Flee back to the entrance", action: "start" }
            ]
        },
        puzzleChamber: {
            description: "The corridor opens into a square chamber. A large stone door blocks your path forward. Intricate symbols are carved into it, with a single, oddly shaped slot in the center.",
            choices: [
                { text: "Examine the symbols", action: "examineSymbols" },
                { text: "Search the room", action: "searchPuzzleRoom" },
                { text: "Go back to the corridor", action: "goblinCorridorDefeated" }
            ]
        },
        goblinCorridorDefeated: {
            description: "You are in the corridor where you fought the goblin. Its body lies on the ground.",
            choices: [
                { text: "Go to the puzzle chamber", action: "puzzleChamber" },
                { text: "Return to the entrance hall", action: "start" }
            ]
        },
        treasureRoom: {
            description: "You've opened the puzzle door! Inside is a small room with a treasure chest. You also see another door leading further into the dungeon.",
            choices: [
                { text: "Open the chest", action: "openChest" },
                { text: "Go deeper into the dungeon", action: "deepDungeon" }
            ]
        },
        deepDungeon: {
            description: "You venture deeper. The air grows colder. You hear a low growl from the darkness ahead. This path seems much more dangerous. To be continued...",
            choices: [
                { text: "Restart the game", action: "restart" }
            ]
        },
        secretPassage: {
            description: "You found a secret passage behind a loose stone! It leads to a dark, narrow tunnel.",
            choices: [
                { text: "Enter the secret passage", action: "secretEnd" },
                { text: "Go back to the puzzle chamber", action: "puzzleChamber" }
            ]
        },
        secretEnd: {
            description: "The passage leads you to an old, forgotten library. A large tome on a pedestal tells the true story of the dungeon: it was a place of magical learning, corrupted by a dark force. You have uncovered the dungeon's secret! You see a hidden exit behind a bookshelf.",
            choices: [
                { text: "Escape with the knowledge", action: "winSecret" }
            ]
        },
        winNormal: {
            description: "You've found the main exit and escaped the dungeon with your life and some treasure. Congratulations!",
            choices: [
                { text: "Play Again", action: "restart" }
            ]
        },
        winSecret: {
            description: "You emerge into the sunlight, carrying the knowledge of the dungeon's true past. You have not only survived but also become a keeper of its history. A truly remarkable victory!",
            choices: [
                { text: "Play Again", action: "restart" }
            ]
        },
        gameOver: {
            description: "You have been defeated. The darkness of the dungeon consumes you.",
            choices: [
                { text: "Try Again", action: "restart" }
            ]
        }
    };

    let currentRoom = 'start';
    let currentEnemy = null;

    function startGame() {
        currentRoom = 'start';
        player = {
            health: 100,
            maxHealth: 100,
            inventory: [],
            progress: {
                hasRustedKey: false,
                puzzleSolved: false
            }
        };
        updateUI();
    }

    function updateUI() {
        const room = rooms[currentRoom];
        storyTextElement.innerText = room.description;

        choicesButtonsElement.innerHTML = '';
        room.choices.forEach(choice => {
            const button = document.createElement('button');
            button.innerText = choice.text;
            button.addEventListener('click', () => handleAction(choice.action));
            choicesButtonsElement.appendChild(button);
        });

        healthBarElement.style.width = `${(player.health / player.maxHealth) * 100}%`;
        healthValueElement.innerText = `${player.health}/${player.maxHealth}`;

        inventoryListElement.innerHTML = '';
        player.inventory.forEach(item => {
            const li = document.createElement('li');
            li.innerText = item.name;
            li.addEventListener('click', () => useItem(item));
            inventoryListElement.appendChild(li);
        });
    }
    
    function handleAction(action) {
        actionLogElement.innerText = '';
        if (action === 'attack') {
            combat(action);
            return;
        }

        if (rooms[action]) {
            currentRoom = action;
            if (rooms[currentRoom].enemy && rooms[currentRoom].enemy.health > 0) {
                currentEnemy = { ...rooms[currentRoom].enemy };
            } else {
                currentEnemy = null;
            }
        } else {
            handleCustomAction(action);
        }
        updateUI();
    }
    
    function handleCustomAction(action) {
        switch (action) {
            case 'enterDoor':
                if (currentRoom === 'start' || currentRoom === 'examineDoor' || currentRoom === 'lookAroundStart') {
                    currentRoom = 'goblinCorridor';
                    if(rooms[currentRoom].enemy.health > 0){
                        currentEnemy = { ...rooms.goblinCorridor.enemy };
                    } else {
                        currentRoom = 'goblinCorridorDefeated';
                    }
                }
                break;
            case 'pickUpSword':
                if (!player.inventory.find(item => item.id === 'rustySword')) {
                    player.inventory.push({ id: 'rustySword', name: 'Rusty Sword', attack: 15 });
                    actionLogElement.innerText = 'You picked up a Rusty Sword.';
                }
                rooms.lookAroundStart.choices = rooms.lookAroundStart.choices.filter(c => c.action !== 'pickUpSword');
                break;
            case 'readNote':
                actionLogElement.innerText = 'The note reads: "Beware the puzzles. Not all exits are made of stone."';
                rooms.lookAroundStart.choices = rooms.lookAroundStart.choices.filter(c => c.action !== 'readNote');
                break;
            case 'examineSymbols':
                actionLogElement.innerText = 'The symbols are ancient and seem to form a complex lock. One symbol looks like a dragon's head, which matches the head of a key you might find.';
                break;
            case 'searchPuzzleRoom':
                actionLogElement.innerText = 'You search the room and find a loose stone in the wall.';
                rooms.puzzleChamber.choices.push({ text: "Inspect the loose stone", action: "secretPassage" });
                rooms.puzzleChamber.choices = rooms.puzzleChamber.choices.filter(c => c.action !== 'searchPuzzleRoom');
                break;
            case 'openChest':
                if (!player.inventory.find(item => item.id === 'healthPotion')) {
                    player.inventory.push({ id: 'healthPotion', name: 'Health Potion', heal: 50 });
                    actionLogElement.innerText = 'You found a Health Potion!';
                    rooms.treasureRoom.choices = rooms.treasureRoom.choices.filter(c => c.action !== 'openChest');
                } else {
                    actionLogElement.innerText = 'The chest is empty.';
                }
                break;
            case 'restart':
                startGame();
                return;
            case 'winSecret':
            case 'winNormal':
                currentRoom = action;
                break;
        }
    }

    function combat(action) {
        if (!currentEnemy) return;

        let playerDamage = 0;
        const sword = player.inventory.find(item => item.id === 'rustySword');
        playerDamage = sword ? sword.attack : 5; // Base attack is 5

        currentEnemy.health -= playerDamage;
        actionLogElement.innerText = `You attack the ${currentEnemy.name} for ${playerDamage} damage.`;

        if (currentEnemy.health <= 0) {
            actionLogElement.innerText += `\nYou defeated the ${currentEnemy.name}!`;
            if (currentEnemy.name === "Goblin"){
                const key = {id: 'dragonKey', name: 'Dragon Key'};
                player.inventory.push(key);
                actionLogElement.innerText += ` It dropped a ${key.name}.`;
                rooms.goblinCorridor.enemy.health = 0; // Mark as defeated
            }
            currentEnemy = null;
            currentRoom = 'goblinCorridorDefeated';
            updateUI();
            return;
        }

        player.health -= currentEnemy.attack;
        actionLogElement.innerText += `\nThe ${currentEnemy.name} attacks you for ${currentEnemy.attack} damage.`;

        if (player.health <= 0) {
            player.health = 0;
            currentRoom = 'gameOver';
        }
        
        updateUI();
    }

    function useItem(item) {
        if (currentRoom === 'puzzleChamber' && item.id === 'dragonKey') {
            actionLogElement.innerText = 'You insert the Dragon Key into the slot. The stone door grinds open!';
            currentRoom = 'treasureRoom';
            player.inventory = player.inventory.filter(i => i.id !== 'dragonKey');
            updateUI();
        } else if (item.id === 'healthPotion') {
            player.health = Math.min(player.maxHealth, player.health + item.heal);
            actionLogElement.innerText = `You used a Health Potion and restored ${item.heal} health.`;
            player.inventory = player.inventory.filter(i => i.id !== 'healthPotion');
            updateUI();
        } else {
            actionLogElement.innerText = 'You can\'t use that here.';
        }
    }
    
    document.getElementById('save-button').addEventListener('click', () => {
        const gameState = {
            player,
            currentRoom,
            rooms
        };
        localStorage.setItem('dungeonGameState', JSON.stringify(gameState));
        actionLogElement.innerText = "Game Saved!";
    });

    document.getElementById('load-button').addEventListener('click', () => {
        const savedState = localStorage.getItem('dungeonGameState');
        if (savedState) {
            const gameState = JSON.parse(savedState);
            player = gameState.player;
            currentRoom = gameState.currentRoom;
            Object.assign(rooms, gameState.rooms);
            actionLogElement.innerText = "Game Loaded!";
            updateUI();
        } else {
            actionLogElement.innerText = "No saved game found.";
        }
    });
    
    document.getElementById('restart-button').addEventListener('click', startGame);

    startGame();
});