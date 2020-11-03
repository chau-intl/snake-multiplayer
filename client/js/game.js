const PIXEL_SIZE = 10;
const CAMERA_SPEED = 0.20;

let PLAYER_ID = -1;

let game;
const socket = io();
const ratioPixelSize = PIXEL_SIZE * window.devicePixelRatio;

let cameraFollow;

let players;
let tails;
let food;
let map;
let names;
let backgroundSprite;
let grid;

let elements = {};

/* Server ping */
let startTime;

setInterval(() => {
  startTime = Date.now();
  socket.emit('ping2');
}, 2000);

socket.on('pong2', () => {
	let latency = Date.now() - startTime;
    const fast = (latency < 100);
    elements.pingBadge.classList.remove((fast ? 'badge-danger' : 'badge-success'));
    elements.pingBadge.classList.add((fast ? 'badge-success' : 'badge-danger'));
	elements.serverPing.textContent = latency;
});

/* Init game engine*/
const preload = () => {
	game.load.image('background', '/client/img/game/basic_stars.png');
};

const create = () => {
    game.stage.smoothed = false;
    game.world.setBounds(0, 0, MAP_WIDTH * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);

	backgroundSprite = game.add.tileSprite(0, 0, MAP_WIDTH * ratioPixelSize, MAP_HEIGHT * ratioPixelSize, 'background');
    backgroundSprite.alpha = 1;    

	game.scale.parentIsWindow = false;

	cameraFollow = game.add.sprite(game.world.centerX, game.world.centerY);

	players = game.add.group();
	tails = game.add.group();
	food = game.add.group();
	map = game.add.group();
	names = game.add.group();

	game.camera.x = game.world.centerX;
	game.camera.y = game.world.centerY;
	game.camera.roundPx = false;
	game.camera.follow(cameraFollow, Phaser.Camera.FOLLOW_LOCKON, (CAMERA_SPEED / PIXEL_SIZE), (CAMERA_SPEED / PIXEL_SIZE));

	let g = game.add.graphics(0, 0);

	g.beginFill(0x222222, 1);
	g.drawRect(0, 0, MAP_WIDTH * PIXEL_SIZE, PIXEL_SIZE);
	g.drawRect(0, 0, PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);

	g.drawRect(0, (MAP_HEIGHT - 1) * PIXEL_SIZE, MAP_WIDTH * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);
	g.drawRect((MAP_WIDTH - 1) * PIXEL_SIZE, 0, (MAP_HEIGHT) * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);
	g.endFill();
};

const update = () => {

};

/* Socket events */
socket.on('id', (data) => {
	PLAYER_ID = data.id;
	console.log('Your id is ' + PLAYER_ID);
});

socket.on('death', (data) => {
	elements.totalScore.textContent = data.score;
	elements.finalScore.style.display = 'block';
    setTimeout(() => {
		$(elements.menu).fadeIn(1000);
		$(elements.playerInfo).fadeOut(1000);
		elements.btnPlay.focus();
	}, 1000);
});

socket.on('spawn', (data) => {
	$(elements.menu).fadeOut(500);
	$(elements.playerInfo).fadeIn(500);
	try {
		game.camera.follow(null, Phaser.Camera.FOLLOW_LOCKON, 1, 1);
		game.camera.x = data.x * PIXEL_SIZE;
		game.camera.y = data.y * PIXEL_SIZE;
		game.camera.follow(cameraFollow, Phaser.Camera.FOLLOW_LOCKON, (CAMERA_SPEED / PIXEL_SIZE), (CAMERA_SPEED / PIXEL_SIZE));
	} catch(err) {
		console.log(err);
	};
});

socket.on('gamestate', (data) => {
    if (players == undefined || tails == undefined || food == undefined || names == undefined) {
		console.log('Waiting for engine to start...');
		return;
	};

	players.removeAll();
	tails.removeAll();
	food.removeAll();
	names.removeAll();

    let leaderboardcontent = "";
	while (data.leaderboard.length > 0) {
		let entry = data.leaderboard.pop();
		leaderboardcontent += '<div class="lb-entry ' + ((entry.id === PLAYER_ID) ? 'lb-entry-self' : '') + '">' + (entry.place + 1) + ': ' + encodeHTML(entry.name) + '</div>';
	};

	elements.leaderboardContent.innerHTML = leaderboardcontent;

	for (let i = 0, iEnd = data.food.length; i < iEnd; ++i) {
		let foodData = data.food[i];
		let g = game.add.graphics(foodData.x * PIXEL_SIZE, foodData.y * PIXEL_SIZE);
		//g.beginFill(hslToHex(foodData.color, 100, 35), 1);
		g.beginFill(foodData.color);
		g.drawRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
		g.endFill();
		food.add(g);
	};

	for (let i = 0, iEnd = data.playerTails.length; i < iEnd; ++i) {
		let tail = data.playerTails[i];
		let g = game.add.graphics(tail.x * PIXEL_SIZE, tail.y * PIXEL_SIZE);
		g.beginFill(hslToHex(tail.color, 100, 25), 1);
		g.drawRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
		g.endFill();
		tails.add(g);
	};

	for (let i = 0, iEnd = data.players.length; i < iEnd; ++i) {
		let player = data.players[i];
		let g = game.add.graphics(player.x* PIXEL_SIZE, player.y * PIXEL_SIZE);

		if (player.id === PLAYER_ID) {
			cameraFollow.x = (player.x * PIXEL_SIZE);
			cameraFollow.y = (player.y * PIXEL_SIZE);
			elements.playerScore.textContent = player.score;
			elements.position.textContent = "X: " + player.x + " Y: " + player.y;
		};

		g.beginFill(hslToHex(player.color, 100, 50), 1);
		g.drawRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
		g.endFill();
		players.add(g);

		let t = game.add.text(player.x * PIXEL_SIZE, (player.y * PIXEL_SIZE) - 10, player.name, {fill: '#FFF', fontSize: '16px', stroke: '#000', strokeThickness: 1});
		t.anchor.setTo(0.5);
        t.smoothed = false;
        t.resolution = window.devicePixelRatio;
		names.add(t);
	};
});

// socket.on('backgroundUpdate', (data) => {
//     BACKGROUND_ID = data.BACKGROUND_ID;
//     game.add.tween(backgroundSprite).to({ alpha: 0 }, 1000, Phaser.Easing.Linear.None, true, 0, 0, false);
//     window.setTimeout(() => {
//         backgroundSprite.loadTexture('background' + BACKGROUND_ID);
//         game.add.tween(backgroundSprite).to({ alpha: 1 }, 1000, Phaser.Easing.Linear.None, true, 0, 0, false);
//     }, 1000);
// });

/* Functions */
const encodeHTML = (s) => {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
};

const componentToHex = (c) => {
	const hex = c.toString(16);
	return hex.length === 1 ? '0' + hex : hex;
};

const hslToHex = (h,s,l) => {
	const rgb = Phaser.Color.HSLtoRGB(h / 360, s / 100, l / 100);
	return '0x'+componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);
};

const rgbToHex = (r, g, b) => {
	return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const play = () => {
	socket.emit('spawn', {name: elements.name.value});
};

/* Load */
document.addEventListener('DOMContentLoaded', () => {
    elements = {
        playerInfo: document.querySelector('#player-info'),
        playerScore: document.querySelector('#player-score'),
        finalScore: document.querySelector('#final-score'),
        totalScore: document.querySelector('#total-score'),
        btnPlay: document.querySelector('#btn_play'),
        form: document.querySelector('form'),
        name: document.querySelector('#name'),
        menu: document.querySelector('#menu'),
        position: document.querySelector('#position'),
        leaderboardContent: document.querySelector('#leaderboard-content'),
        serverPing: document.querySelector('#server-ping'),
        pingBadge: document.querySelector('#ping-badge'),
        snakeGame: document.querySelector("#snake-game")
    };

	elements.name.focus();
	elements.finalScore.style.display = 'none';

    elements.btnPlay.addEventListener('click', () => {
		play();
	}, {capture: true, once: false, passive: true});

	elements.form.addEventListener('submit',(e) => {
		e.preventDefault();
		play();
	}, {capture: true, once: false, passive: false});

    elements.name.addEventListener('change', () => {
        setCookie('MultiplayerSnake-name', elements.name.value, 14);
    }, {capture: true, once: false, passive: true});

	game = new Phaser.Game({
        width: elements.snakeGame.clientWidth,
        height: elements.snakeGame.clientHeight,
        renderer: Phaser.CANVAS,
        parent: elements.snakeGame,
        transparent: false,
        antialias: false,
        multiTexture: false,
        backgroundColor: 'rgba(0,0,0,1)',
        clearBeforeRender: true,
        crisp: true,
        enableDebug: false,
        fullScreenScaleMode: Phaser.ScaleManager.RESIZE,
        resolution: window.devicePixelRatio,
        roundPixels: true,
        scaleMode: Phaser.ScaleManager.RESIZE,
        state: {
            preload: preload,
            create: create,
            update: update
        }
    });

	try {
		let name = getCookie('MultiplayerSnake-name');
		if (name.length > 0 && name.length <= 16) {
			console.log('Loaded name from cookie: ' + name);
			elements.name.value = name;
		};
	} catch(err) {
		console.log(err);
	};
});

/* Key listener */
document.addEventListener('keydown', (e) => {
	const key = (e === null) ? event.keyCode : e.which;

    let inputId = null;
    switch (key) {
        case 68:
        case 39:
            inputId = 'right';
        	break;
        case 83:
        case 40:
            inputId = 'down';
        	break;
        case 65:
        case 37:
            inputId = 'left';
        	break;
        case 87:
        case 38:
            inputId = 'up';
			break;
		case 71:
			if(grid) {
				grid.destroy();
				grid = null;
			} else {
				game.create.grid('grid', MAP_WIDTH * ratioPixelSize, MAP_HEIGHT * ratioPixelSize, ratioPixelSize, ratioPixelSize, 'rgba(127,127,127,0.2)', true, () => { grid = game.add.sprite(0, 0, 'grid'); });
			}
			break;			
        default:
    }
	if (inputId) {
		socket.emit('keyPress', {
			inputId: inputId,
			state: true
		});
	};
}, {capture: false, once: false, passive: true});