let MAP_WIDTH = 500;
let MAP_HEIGHT = 500;

const PIXEL_SIZE = 10;
const CAMERA_SPEED = 0.15;

var PLAYER_ID = -1;

var game;
var socket = io();

var cameraFollow;

var players;
var tails;
var food;
var map;
var names;

/* Server ping */
var startTime;

setInterval(function() {
  startTime = Date.now();
  socket.emit('ping2');
}, 2000);

socket.on('pong2', function() {
	let latency = Date.now() - startTime;
    const fast = (latency < 100);
    const pingBadge = document.querySelector("#ping-badge");
    pingBadge.classList.remove((fast ? "badge-danger" : "badge-success"));
    pingBadge.classList.add((fast ? "badge-success" : "badge-danger"));
	document.querySelector("#server-ping").textContent = latency;
});

/* Init game engine*/
function preload() {
	game.load.image('background', '/client/img/game/background.png');
};

function create() {
	game.world.setBounds(0, 0, MAP_WIDTH * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);
	game.add.tileSprite(0, 0, game.width * PIXEL_SIZE, game.height * PIXEL_SIZE, "background");

	game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
	game.scale.fullScreenScaleMode = Phaser.ScaleManager.RESIZE;
	game.scale.parentIsWindow = true;

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

	map.add(g);
};

/* Socket events */
socket.on("id", function(data) {
	PLAYER_ID = data.id;
	console.log("Your id is " + PLAYER_ID);
});

socket.on("death", function(data) {
	document.querySelector("#total-score").textContent = data.score;
	document.querySelector("#final-score").style.display = "block";
	setTimeout(function() {
		$(document.querySelector("#menu")).fadeIn(1000);
		$(document.querySelector("#player-info")).fadeOut(1000);
		document.querySelector("#btn_play").focus();
	}, 1000);
});

socket.on("spawn", function(data) {
	$(document.querySelector("#menu")).fadeOut(500);
	$(document.querySelector("#player-info")).fadeIn(500);
	try {
		game.camera.follow(null, Phaser.Camera.FOLLOW_LOCKON, 1, 1);
		game.camera.x = data.x * PIXEL_SIZE;
		game.camera.y = data.y * PIXEL_SIZE;
		game.camera.follow(cameraFollow, Phaser.Camera.FOLLOW_LOCKON, (CAMERA_SPEED / PIXEL_SIZE), (CAMERA_SPEED / PIXEL_SIZE));
	} catch(err) {
		console.log(err);
	};
});

socket.on("gamestate", function(data) {
	if(players == undefined || tails == undefined || food == undefined || names == undefined) {
		console.log("Waiting for engine to start...");
		return;
	};

	players.removeAll();
	tails.removeAll();
	food.removeAll();
	names.removeAll();

    let leaderboardcontent = "";
	while(data.leaderboard.length > 0) {
		let entry = data.leaderboard.pop();
		leaderboardcontent += '<div class="lb-entry ' + ((entry.id == PLAYER_ID) ? "lb-entry-self" : "") + '">' + (entry.place + 1) + ': ' + encodeHTML(entry.name) + '</div>';
	};

	document.querySelector("#leaderboard-content").innerHTML = leaderboardcontent;

	for(let i = 0, iEnd = data.food.length; i < iEnd; ++i) {
		let foodData = data.food[i];
		let g = game.add.graphics(foodData.x * PIXEL_SIZE, foodData.y * PIXEL_SIZE);
		g.beginFill(hslToHex(foodData.color, 100, 35), 1);
		g.drawRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
		g.endFill();
		food.add(g);
	};

	for(let i = 0, iEnd = data.playerTails.length; i < iEnd; ++i) {
		let tail = data.playerTails[i];
		let g = game.add.graphics(tail.x * PIXEL_SIZE, tail.y * PIXEL_SIZE);
		g.beginFill(hslToHex(tail.color, 100, 25), 1);
		g.drawRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
		g.endFill();
		tails.add(g);
	};

	for(let i = 0, iEnd = data.players.length; i < iEnd; ++i) {
		let player = data.players[i];
		let g = game.add.graphics(player.x* PIXEL_SIZE, player.y * PIXEL_SIZE);

		if(player.id === PLAYER_ID) {
			cameraFollow.x = (player.x * PIXEL_SIZE);
			cameraFollow.y = (player.y * PIXEL_SIZE);
			document.querySelector("#player-score").textContent = player.score;
			document.querySelector("#position").textContent = "X: " + player.x + " Y: " + player.y;
		};

		g.beginFill(hslToHex(player.color, 100, 50), 1);
		g.drawRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
		g.endFill();
		players.add(g);

		let t = game.add.text(player.x * PIXEL_SIZE, (player.y * PIXEL_SIZE) - 10, player.name, {fill:"#000", fontSize:"15px"});
		t.anchor.setTo(0.5);
		names.add(t);
	};
});

/* Functions */
function encodeHTML(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
};

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length === 1 ? "0" + hex : hex;
};

function hslToHex(h,s,l) {
	let rgb = Phaser.Color.HSLtoRGB(h / 360, s / 100, l / 100);
	return "0x"+componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);
};

function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

function play() {
	socket.emit("spawn", {name:document.querySelector("#name").value});
};

/* Load */
document.addEventListener("DOMContentLoaded", function() {
	try {
		let conf = JSON.parse($.ajax({
			async: false,
			cache: false,
			type: "GET",
			url: "/config"
		}).responseText);

		MAP_WIDTH = conf.MAP_WIDTH;
		MAP_HEIGHT = conf.MAP_HEIGHT;
		document.querySelector("#name").setAttribute('maxlength', conf.MAX_NAME_LENGTH);
	} catch(err) {
		console.log(err);
	};
	document.querySelector("#final-score").style.display = "none";
	document.querySelector("#btn_play").addEventListener("click", function() {
		play();
	});

	document.querySelector("form").addEventListener('submit',function(e){
		e.preventDefault();
		play();
	});

    document.querySelector("#name").addEventListener("change", function() {
        setCookie("MultiplayerSnake-name", document.querySelector("#name").value, 14);
    });

	document.querySelector("#name").focus();

	// game = new Phaser.Game(800, 600, Phaser.CANVAS, 'snake-game', {preload: preload, create:create});
	game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        scene: {
            preload: preload,
            create: create
        }
    });

	try {
		let name = getCookie("MultiplayerSnake-name");
		if(name.length > 0 && name.length <= 16) {
			console.log("Loaded name from cookie: " + name);
			document.querySelector("#name").value = name;
		};
	} catch(err) {
		console.log(err);
	};
});

/* Key listener */
document.addEventListener("keydown", function(e) {
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
        default:
    }
	if (inputId) {
		socket.emit('keyPress', {
			inputId: inputId,
			state: true
		});
	};
});