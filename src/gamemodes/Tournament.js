var Mode = require('./Mode');
var Entity = require('../entity')

function Tournament() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
    
    this.ID = 4;
    this.name = "Tournament";
    this.packetLB = 48;
    this.IsTournament = true;
    // Config (1 tick = 1000 ms)
    this.endTime = 15; // Amount of ticks after someone wins to restart the game
    this.dcTime = 0;
    
    // Gamemode Specific Variables
    this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End

    this.timer;
    this.timeLimit = 3600; // in seconds
}

module.exports = Tournament;
Tournament.prototype = new Mode();

// Gamemode Specific Functions

Tournament.prototype.startGame = function (gameServer) {
    gameServer.run = true;
    this.gamePhase = 0;
    gameServer.config.playerDisconnectTime = this.dcTime; // Reset config
};

Tournament.prototype.endGameTimeout = function (gameServer) {
    gameServer.run = false;
    this.gamePhase = 1;
    this.timer = this.endTime; // 30 Seconds
};

Tournament.prototype.prepare = function (gameServer) {
    // Remove all cells
    var len = gameServer.nodes.length;
    for (var i = 0; i < len; i++) {
        var node = gameServer.nodes[0];
        
        if (!node) {
            continue;
        }
        
        gameServer.removeNode(node);
    }
    
    gameServer.bots.loadNames();
    
    // Pauses the server
    gameServer.run = true;
    this.gamePhase = 0;
    
    // Handles disconnections
    this.dcTime = gameServer.config.playerDisconnectTime;
    gameServer.config.playerDisconnectTime = 0;
    
    this.endTime = gameServer.config.tourneyEndTime;
    
    // Time limit
    this.timeLimit = gameServer.config.tourneyTimeLimit * 60; // in seconds
};

Tournament.prototype.formatTime = function (time) {
    if (time < 0) {
        return "0:00";
    }
    // Format
    var min = Math.floor(this.timeLimit / 60);
    var sec = this.timeLimit % 60;
    sec = (sec > 9) ? sec : "0" + sec.toString();
    return min + ":" + sec;
};

// Override

Tournament.prototype.onServerInit = function (gameServer) {
    // Called when the server starts
    gameServer.run = true;
    this.prepare(gameServer);
    
    // Ovveride functions for special virus mechanics
    var self = this;
    Entity.Virus.prototype.onEat = function (prey) {
        // Pushes the virus
        this.setBoost(220, prey.boostDirection.angle());
    };
    Entity.MotherCell.prototype.onAdd = function () {
        self.nodesMother.push(this);
    };
    Entity.MotherCell.prototype.onRemove = function () {
        var index = self.nodesMother.indexOf(this);
        if (index != -1) 
            self.nodesMother.splice(index, 1);
    };
};
Tournament.prototype.onPlayerSpawn = function(gameServer, player) {
    player.color = gameServer.getRandomColor();
    // Spawn player
    gameServer.spawnPlayer(player, gameServer.randomPos());
};

Tournament.prototype.onPlayerDeath = function (gameServer) {
    // Nothing
};


Tournament.prototype.updateLB = function (gameServer, lb) {
    gameServer.leaderboardType = this.packetLB;

    switch (this.gamePhase) {
        case 0:
            lb[0] = "Restart in " + this.formatTime(this.timeLimit);
            if (this.timeLimit < 0) {
                // Timed out
                this.endGameTimeout(gameServer);
            } else {
                this.timeLimit--;
            }
            break;
        case 1:
            lb[0] = "GG";
            if (this.timer <= 0) {
                // Reset the game
                process.exit(3);
            } else {
                lb[1] = "Restarting in";
                lb[2] = this.timer.toString();
                this.timer--;
            }
        default:
            break;
    }
};

Tournament.prototype.onTick = function (gameServer) {
    // Mother Cell Spawning
    if (this.tickMotherSpawn >= this.motherSpawnInterval) {
        this.tickMotherSpawn = 0;
        this.spawnMotherCell(gameServer);
    } else {
        this.tickMotherSpawn++;
    }
    if (this.tickMotherUpdate >= this.motherUpdateInterval) {
        this.tickMotherUpdate = 0;
        for (var i = 0; i < this.nodesMother.length; i++) {
            this.nodesMother[i].onUpdate();
        }
    } else {
        this.tickMotherUpdate++;
    }
};
