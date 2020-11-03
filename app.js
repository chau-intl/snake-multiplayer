const express = require('express');
const app = express();
const serv = require('http').Server(app);
const colors = require('colors/safe');
const middleware = require('socketio-wildcard')();
const bodyParser = require('body-parser');

//---------- Server settings ----------
const fps = 5;
const MAX_FOOD = 1500;
const config = {
    MAX_NAME_LENGTH: 32,
    MAP_WIDTH: 500,
    MAP_HEIGHT: 500
};
const FOOD_TYPES = [
	{ type: 'basic', color: '0x00FF00'},
	{ type: 'x3', color: '0xFF00FF'},
	{ type: 'x5', color: '0x0000FF'},
	{ type: 'wormhole', color: '0xFFFFFF'},
	{ type: 'blackhole', color: '0x070707'},
	{ type: 'supernova', color: '0xFFFF00'},
	{ type: 'flipper', color: '0x00FFFF'}
];

//-------------------------------------

const debug = typeof v8debug === 'object' || /--debug/.test(process.execArgv.join(' '));

console.log(colors.green('[Snake] Starting server...'));
app.use(bodyParser.urlencoded({extend: true}));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.get('/', (req, res) => {
	// res.sendFile(__dirname + '/client/index.html');
	res.render(__dirname + '/client/index.html', config);
});

app.use('/client', express.static(__dirname + '/client'));

const port = process.env.PORT || 80;
if (process.env.PORT == undefined) {
	console.log(colors.blue('[Snake] No port defined using default (80)'));
}

serv.listen(port);
const io = require('socket.io')(serv, {});
io.use(middleware);

console.log(colors.green('[Snake] Socket started on port ' + port));

let SOCKET_LIST = {};
let PLAYER_LIST = {};
let FOOD_LIST = {};

const Food = (id, x, y) => {
	let type = Math.floor(Math.random() * FOOD_TYPES.length);
	let self = {
		id: id,		
		color: FOOD_TYPES[type].color,
		type: FOOD_TYPES[type].type,
		x: x,
		y: y
	};
	return self;
};

// Directions: 0 = up (-y), 1 = right (+x), 2 = down = (+y), 3 = left (-x)
const Player = (id) => {
	const self = {
		id: id,
		direction: 0,
		lastDirection: 0,
		x: config.MAP_WIDTH / 2,
		y: config.MAP_HEIGHT / 2,
		score: 0,
		tailBlocks: [],
		inGame: false,
		stuck: false,
		invincible: false,
		invincibleBlocks: 0,
		name: 'Unnamed player',
		color: 0
	};

	self.update = () => {		
		// We can be stuck if inside a wormhole.
		if (!self.stuck) {
			// Add new head to the snake.
			self.tailBlocks.unshift(Tail(self.x, self.y, self.id, self.color));
		} else {
			// Reduce the score by one for each iteration.
			if(self.score > 0) {
				--self.score;
			} else {
				self.stuck = false;
				// Make sure we add a block on the wormhole.
				self.tailBlocks.unshift(Tail(self.x, self.y, self.id, self.color));
			}
		}
		
		// Ensure the snake is atleast 2 blocks long, but remove the tail until it matches the score.
		while (self.score + 2 < self.tailBlocks.length) {
			delete self.tailBlocks.pop();
		};
		if (!self.stuck) {
			switch (self.direction) {
				case 0:
					--self.y;
					break;
				case 1:
					++self.x;
					break;
				case 2:
					++self.y;
					break;
				case 3:
					--self.x;
					break;
				default:
					self.direction = 0;
					break;
			};
		};
		self.lastDirection = self.direction;

		// The player dies if leaving the map.
		if (self.x <= 0 || self.x >= config.MAP_WIDTH || self.y <= 0 || self.y >= config.MAP_WIDTH) {
			self.die();
			return;
		};

		// If invincible, skip the test to see if we have hit another player.
		if(self.invincible) {
			self.invincibleBlocks -= 1;
			if(self.invincibleBlocks == 0) {
				self.invincible = false;
			};
		} else {
			for (let p in PLAYER_LIST) {
				let player = PLAYER_LIST[p];
				for (let t in player.tailBlocks) {
					let pTail = player.tailBlocks[t];
					if (self.x === pTail.x && self.y === pTail.y) {
						self.die();
						player.score += (5+(self.score / 2));
						return;
					};
				};
			};
		};

		for (let f in FOOD_LIST) {
			let food = FOOD_LIST[f];
			if (self.x === food.x && self.y === food.y) {
				// We have hit food.
				if(food.type == 'x3') {
					self.score += 2;
				} else if (food.type == 'x5') {
					self.score += 4;
				} else if(food.type == 'wormhole') {
					self.x = Math.floor(Math.random() * (config.MAP_WIDTH - 20)) + 10;
					self.y = Math.floor(Math.random() * (config.MAP_WIDTH - 20)) + 10;
					self.direction = Math.floor(Math.random() * 4);
				} else if(food.type == 'blackhole') {
					if(!self.invincible) {
					self.stuck = true;
					};
				} else if(food.type == 'supernova') {
					self.invincible = true;
					self.invincibleBlocks = 30;
				} else if(food.type == 'flipper') {
					// Set the head as the last tail piece.
					tailBlock = self.tailBlocks[self.tailBlocks.length - 1];
					self.x = tailBlock.x;
					self.y = tailBlock.y;

					// Get the second last tailblock.
					secondTailBlock = self.tailBlocks[self.tailBlocks.length - 2];
					if(tailBlock.x - secondTailBlock.x > 0) {
						self.direction = 1;
					} else if(tailBlock.y - secondTailBlock.y > 0) {
						self.direction = 2;
					} else if(tailBlock.x - secondTailBlock.x < 0) {
						self.direction = 3;
					} else if(tailBlock.y - secondTailBlock.y < 0) {
						self.direction = 0;
					};

					// Reverse the tailblocks.
					self.tailBlocks.reverse();
				};
				++self.score;

				delete FOOD_LIST[food.id];				
			};
		};
	};

	self.die = () => {
		self.inGame = false;
		self.deleteTail();
		
		try {
			SOCKET_LIST[self.id].emit('death', {
				score:self.score
			});
		} catch(err) {
			if(debug) {
				console.log(err);
			};
		};
	};

	self.deleteTail = () => {
		for (let i = self.tailBlocks.length; i > 0; --i) {
			self.tailBlocks.pop();
		};
	};

	self.spawn = () => {
		self.x = Math.floor(Math.random() * (config.MAP_WIDTH - 20)) + 10;
		self.y = Math.floor(Math.random() * (config.MAP_WIDTH - 20)) + 10;
		self.color = self.y = Math.floor(Math.random() * 360);
		self.direction = Math.floor(Math.random() * 4);
		self.score = 0;
		self.inGame = true;
	};
	return self;
};

const Tail = (x, y, playerId, color) => {
	let self = {
		x: x,
		y: y,
		playerId: playerId,
		color: color
	};
	return self;
};

const dynamicSort = (property) => {
	let sortOrder = 1;
	if (property[0] === "-") {
		sortOrder = -1;
		property = property.substr(1);
	};
	return (a,b) => {
		let result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
		return result * sortOrder;
	};
};

const update = async () => {
	let playerPack = [];
	let tailPack = [];
	let foodPack = [];

	let leaderboardPlayers = [];

	for (let p in PLAYER_LIST) {
		let player = PLAYER_LIST[p];

		if (player.inGame) {
			player.update();
			if (!player.inGame) { // Player died
				continue;
			};
			let color = player.color;
			if(player.invincible) {
				color = Math.floor(Math.random() * 360);
			}
			playerPack.push({
				id: player.id,
				x: player.x,
				y: player.y,
				name: player.name,
				score: player.score,
				color: color
			});
			leaderboardPlayers.push(player);
			for (let t in player.tailBlocks) {
				let tail = player.tailBlocks[t];
				let color = tail.color;
				if(player.invincible) {
					color = Math.floor(Math.random() * 360);
				}
				tailPack.push({
					x: tail.x,
					y: tail.y,
					color: color
				});
			};
		};
	};

	for (let f in FOOD_LIST) {
		let food = FOOD_LIST[f];
		foodPack.push({
			x: food.x,
			y: food.y,
			color: food.color
		});
	};

	let leaderboard = [];

	leaderboardPlayers.sort(dynamicSort('score'));
	while (leaderboardPlayers.length > 10) {
		leaderboardPlayers.pop();
	};

	for (let i = 0, iEnd = leaderboardPlayers.length; i < iEnd; ++i) {
		leaderboard.push({place: i, name: leaderboardPlayers[i].name, id: leaderboardPlayers[i].id});
	};

	for (let s in SOCKET_LIST) {
		SOCKET_LIST[s].emit('gamestate', {
			score: PLAYER_LIST[s].score,
			leaderboard: leaderboard,
			players: playerPack,
			playerTails: tailPack,
			food: foodPack
		});
	};
};

setInterval(() => {
	update();
}, 1000 / fps);

const spawnFood = () => {
	let id = Math.random();
	FOOD_LIST[id] = Food(id, Math.floor(Math.random() * (config.MAP_WIDTH - 4)) + 2, Math.floor(Math.random() * (config.MAP_WIDTH - 4)) + 2);
};

setInterval(() => {
	if (FOOD_LIST.length < MAX_FOOD) {
		spawnFood();
	};
}, 500);

for (let i = 0; i < MAX_FOOD; ++i) {
	spawnFood();
};

const spawnPlayer = (id) => {
	try {
		PLAYER_LIST[id].spawn();
		SOCKET_LIST[id].emit('spawn', {x: PLAYER_LIST[id].x, y: PLAYER_LIST[id].y})
	} catch(err) {
		if(debug) {
			throw err;
		};
	};
};

const disconnectSocket = (id) => {
	try {
		if (PLAYER_LIST[id] != undefíned) {
			PLAYER_LIST[id].deleteTail();
			delete PLAYER_LIST[id];
		};
	} catch(err) {
	};
	SOCKET_LIST[id].disconnect();
	delete SOCKET_LIST[id];
};

io.sockets.on('connection', (socket) => {
	socket.id = Math.random();

	SOCKET_LIST[socket.id] = socket;
	let player = Player(socket.id);

	PLAYER_LIST[socket.id] = player;
	console.log(colors.cyan('[Snake] Socket connection with id ' + socket.id));
	socket.emit('id', {
		id: socket.id
	});

	socket.on('disconnect', () => {
		try {
			delete PLAYER_LIST[socket.id];
			console.log(colors.cyan('[Snake] Player with id ' + socket.id + ' disconnected'));
			disconnectSocket(socket.id);
		} catch(err) {
			if (debug) {
				throw err;
			};
		};
	});

	socket.on('ping2', () => {
		socket.emit('pong2');
	});

	socket.on('spawn', (data) => {
		try {
			if (!PLAYER_LIST[socket.id].inGame) {
				if (data.name != undefined) {
					if (!(data.name.length < 1 || data.name.length > config.MAX_NAME_LENGTH)) {
						PLAYER_LIST[socket.id].name = data.name;
					};
				};
				spawnPlayer(socket.id);
			};
		} catch(err) {
			if (debug) {
				throw err;
			};
		};
	});

	socket.on('keyPress',(data) => {
		try {
			if(data.inputId === 'up' && player.lastDirection !== 2)
				player.direction = 0;
			else if(data.inputId === 'right' && player.lastDirection !== 3)
				player.direction = 1;
			else if(data.inputId === 'down' && player.lastDirection !== 0)
				player.direction = 2;
			else if(data.inputId === 'left' && player.lastDirection !== 1)
				player.direction = 3;
		} catch(err) {
			if(debug) {
				throw err;
			};
		};
	});
});

console.log(colors.green('[Snake] Server started '));
if (debug) {
	console.log('Running in debug mode');
};