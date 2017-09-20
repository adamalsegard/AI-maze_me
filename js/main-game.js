/**
 * @author Adam Alsegård / http://www.adamalsegard.se
 */

// Check if browser supports WebGL before rendering anything
if (!Detector.webgl) {
  var warning = Detector.getWebGLErrorMessage();
  document.body.appendChild(warning);
}

('use strict');

/**
 * INTERNAL HELPERS
 */
var textureLoader = new THREE.TextureLoader();

/**
 * DECLARE VARIABLES
 */
// Render variables
var camera = undefined,
  scene = undefined,
  renderer = undefined,
  light = undefined,
  raycaster = undefined,
  gameState = undefined,
  mouseX = undefined,
  mouseY = undefined,
  maze = undefined,
  mazeMesh = undefined,
  ballMesh = undefined,
  groundMesh = undefined,
  intersectMeshes = undefined,
  intersectedObjectId = -1,
  nrOfDifferentMaterials = 2; // Remember to change in maze-generator as well!

// Game parameters
var energy = 0,
  initEnergy = 100,
  score = 0,
  trainingRound = 1,
  completedLevelBonus = 0,
  mazeDimension = 11,
  ballRadius = 0.25,
  ballInitPos = new CANNON.Vec3(1, 1, ballRadius),
  lastPos = new CANNON.Vec3(),
  keyAxis = [0, 0],
  displayed = false,
  win = false;

// Load textures
var gravel1Texture = textureLoader.load('./tex/gravel1.jpg'),
  gravel2Texture = textureLoader.load('./tex/gravel2.jpg'),
  stoneTexture = textureLoader.load('./tex/stone.jpg'),
  stoneRoadTexture = textureLoader.load('./tex/stone_road.jpg'),
  bushLight1Texture = textureLoader.load('./tex/bush_light1.jpg'),
  bushLight2Texture = textureLoader.load('./tex/bush_light2.jpg'),
  bushMed1Texture = textureLoader.load('./tex/bush_med1.jpg'),
  bushMed2Texture = textureLoader.load('./tex/bush_med2.jpg'),
  bushDark1Texture = textureLoader.load('./tex/bush_dark1.png'),
  bushDark2Texture = textureLoader.load('./tex/bush_dark2.jpg'),
  ballTexture = textureLoader.load('./tex/ball.png'),
  brickTexture = textureLoader.load('./tex/brick.png'),
  waterLightTexture = textureLoader.load('./tex/water_light.jpg'),
  waterMedTexture = textureLoader.load('./tex/water_medium.png'),
  waterDarkTexture = textureLoader.load('./tex/water_dark.png'),
  bushLightSub = 5,
  bushMedSub = 10,
  bushDarkSub = 15,
  waterLightSub = 25,
  waterMedSub = 35,
  waterDarkSub = 45;

// Physic body variables
var globalWorld = undefined,
  fixedTimeStep = undefined,
  ballBody = undefined,
  groundBody = undefined,
  mazeBody = undefined;

/**
 * INIT FUNCTIONS
 */
function createPhysicsWorld() {
  // Create the physics world object.
  globalWorld = new CANNON.World();
  globalWorld.gravity.set(0, 0, -9.82);
  fixedTimeStep = 1.0 / 60.0;

  // Create materials
  var ballMaterial = new CANNON.Material({
    friction: 0.4,
    restitution: 0.3 // Studskoefficient
  });
  var brickMaterial = new CANNON.Material({
    friction: 0.2,
    restitution: 0.5
  });
  var groundMaterial = new CANNON.Material({
    friction: 0.7,
    restitution: 0.1
  });

  // Define contact materials
  var ballBrickContact = new CANNON.ContactMaterial(
    ballMaterial,
    brickMaterial,
    {
      friction: 0.2,
      restitution: 0.6
    }
  );
  globalWorld.addContactMaterial(ballBrickContact);
  var ballGroundContact = new CANNON.ContactMaterial(
    ballMaterial,
    groundMaterial,
    {
      friction: 0.7,
      restitution: 0.1
    }
  );
  globalWorld.addContactMaterial(ballGroundContact);

  // Create the ball.
  ballBody = new CANNON.Body({
    mass: 1,
    position: ballInitPos,
    shape: new CANNON.Sphere(ballRadius),
    material: ballMaterial
  });
  globalWorld.addBody(ballBody);

  // Create the maze
  for (var i = 0; i < maze.dimension; i++) {
    for (var j = 0; j < maze.dimension; j++) {
      // Check if we should place a solid body here
      if (maze[i][j] == nrOfDifferentMaterials) {
        mazeBody = new CANNON.Body({
          mass: 10,
          shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
          material: brickMaterial
        });
        mazeBody.position.x = i;
        mazeBody.position.y = j;
        mazeBody.position.z = 0.5;
        globalWorld.addBody(mazeBody);
      }
    }
  }

  // Create the ground
  groundBody = new CANNON.Body({
    mass: 0, // Static body
    shape: new CANNON.Plane(),
    material: groundMaterial
  });
  globalWorld.addBody(groundBody);
}

function create_maze_mesh(field) {
  var mazeGroup = new THREE.Group();
  intersectMeshes = [];
  for (var i = 0; i < field.dimension; i++) {
    for (var j = 0; j < field.dimension; j++) {
      if (field[i][j] > 0) {
        var mazeGeo = new THREE.BoxGeometry(1, 1, 1);
        // Check if mesh should be solid or not
        if (field[i][j] == 1) {
          var mazeMat = new THREE.MeshPhongMaterial({ map: bushLight1Texture });
          var maze_ij = new THREE.Mesh(mazeGeo, mazeMat);
          maze_ij.name = 'bushLight';
          intersectMeshes.push(maze_ij);
        } else {
          /*else if (field[i][j] == 2) {
          var mazeMat = new THREE.MeshPhongMaterial({ map: bushMed1Texture });
          var maze_ij = new THREE.Mesh(mazeGeo, mazeMat);
          maze_ij.name = 'bushMed';
          intersectMeshes.push(maze_ij);
        } else if (field[i][j] == 3) {
          var mazeMat = new THREE.MeshPhongMaterial({ map: bushDark1Texture });
          var maze_ij = new THREE.Mesh(mazeGeo, mazeMat);
          maze_ij.name = 'bushDark';
          intersectMeshes.push(maze_ij);
        }*/ // field[i][j] == nrOfDifferentMaterials
          var mazeMat = new THREE.MeshPhongMaterial({ map: brickTexture });
          var maze_ij = new THREE.Mesh(mazeGeo, mazeMat);
        }

        maze_ij.position.x = i;
        maze_ij.position.y = j;
        maze_ij.position.z = 0.5;
        maze_ij.castShadow = true;
        maze_ij.receiveShadow = true;
        mazeGroup.add(maze_ij);
      }
    }
  }
  return mazeGroup;
}

function createRenderWorld() {
  // Create the scene object.
  scene = new THREE.Scene();

  // Create the light.
  light = new THREE.PointLight(0xffffff, 1, 15, 2);
  light.position.set(1, 1, 1.5);
  light.castShadow = false; // TODO: Change back when I've fixed the scene
  scene.add(light);

  // Create the camera.
  var aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspect, 1, 1000);
  camera.position.set(1, 1, 7);
  scene.add(camera);

  // Create the raycaster
  raycaster = new THREE.Raycaster();

  // Create the ball and add to scene.
  var ballGeo = new THREE.SphereGeometry(ballRadius, 32, 16);
  var ballMat = new THREE.MeshPhongMaterial({ map: ballTexture });
  ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.position.copy(ballInitPos);
  scene.add(ballMesh);

  // Create the maze and add to scene.
  mazeMesh = create_maze_mesh(maze);
  scene.add(mazeMesh);

  // Create the ground and add to scene.
  var groundGeo = new THREE.PlaneGeometry(
    mazeDimension * 10,
    mazeDimension * 10,
    mazeDimension,
    mazeDimension
  );
  gravel1Texture.wrapS = gravel1Texture.wrapT = THREE.RepeatWrapping;
  gravel1Texture.repeat.set(mazeDimension * 5, mazeDimension * 5);
  var groundMat = new THREE.MeshPhongMaterial({ map: gravel1Texture });
  groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.set((mazeDimension - 1) / 2, (mazeDimension - 1) / 2, 0);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
}

/**
 * KEYBOARD INPUT - CAMERA MOVEMENT
 */
function onMoveUp() {
  keyAxis[1] = 1;
}
function onMoveDown() {
  keyAxis[1] = -1;
}
function onMoveLeft() {
  keyAxis[0] = -1;
}
function onMoveRight() {
  keyAxis[0] = 1;
}

function updateCameraPosition() {
  if (Key.isDown(Key.UP)) onMoveUp();
  if (Key.isDown(Key.LEFT)) onMoveLeft();
  if (Key.isDown(Key.DOWN)) onMoveDown();
  if (Key.isDown(Key.RIGHT)) onMoveRight();
}

var Key = {
  _pressed: {},

  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  I: 73,

  isDown: function(keyCode) {
    return this._pressed[keyCode];
  },

  onKeydown: function(event) {
    this._pressed[event.keyCode] = true;
  },

  onKeyup: function(event) {
    delete this._pressed[event.keyCode];
  }
};

/**
 * UPDATE FUNCTIONS
 */
function updatePhysicsWorld() {
  // Apply user-directed force.
  var inputForce = new CANNON.Vec3(
    keyAxis[0] * ballBody.mass * 0.25,
    keyAxis[1] * ballBody.mass * 0.25,
    0.0
  );
  ballBody.applyImpulse(inputForce, ballBody.position);
  keyAxis = [0, 0];

  // Take a time step.
  globalWorld.step(fixedTimeStep);
}

function updateRenderWorld() {
  // Update ball position and rotation.
  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);

  // Update camera and light positions.
  camera.position.x += (ballMesh.position.x - camera.position.x) * 0.1;
  camera.position.y += (ballMesh.position.y - camera.position.y) * 0.1;
  light.position.x = camera.position.x;
  light.position.y = camera.position.y;

  // Check for intersection with non-solid materials
  raycaster.far = 0.5;
  raycaster.set(ballMesh.position, new THREE.Vector3(1, 0, 0));
  var intersections = raycaster.intersectObjects(intersectMeshes);
  raycaster.set(ballMesh.position, new THREE.Vector3(-1, 0, 0));
  intersections.push.apply(
    intersections,
    raycaster.intersectObjects(intersectMeshes)
  );
  raycaster.set(ballMesh.position, new THREE.Vector3(0, 1, 0));
  intersections.push.apply(
    intersections,
    raycaster.intersectObjects(intersectMeshes)
  );
  raycaster.set(ballMesh.position, new THREE.Vector3(0, -1, 0));
  intersections.push.apply(
    intersections,
    raycaster.intersectObjects(intersectMeshes)
  );

  intersections.sort();
  if (
    intersections.length > 0 &&
    intersections[0].distance < ballRadius &&
    intersections[0].object.id != intersectedObjectId
  ) {
    materialEntered(intersections[0].object.name);
    intersectedObjectId = intersections[0].object.id; // TODO: Keep track of all visited ids?
  } else if (intersections.length == 0) {
    //intersectedObjectId = -1;
    // TODO: rethink this!
  }
}

function energySpent() {
  // Calculate distance moved since last frame
  var moved = ballBody.position.vsub(lastPos);
  // TODO: only return if moved move than one square?
  if (moved.length() > 1.0) {
    updateLinePath()
    lastPos.copy(ballBody.position);
    return Math.floor(moved.length());
  } else {
    return 0;
  }
}

function materialEntered(materialType) {
  // TODO: Animate
  switch (materialType) {
    case 'bushLight':
      energy -= bushLightSub;
      break;
    case 'bushMed':
      energy -= bushMedSub;
      break;
    case 'bushDark':
      energy -= bushDarkSub;
      break;
  }
}

/**
 * MAIN GAME LOOP
 */
function gameLoop() {
  switch (gameState) {
    case 'initLevel':
      // Init maze field and use it for physics and rendering.
      maze = generateSquareMaze(mazeDimension);
      createPhysicsWorld();
      createRenderWorld();

      // Game parameters
      energy = initEnergy + completedLevelBonus;
      lastPos.copy(ballInitPos);
      // TODO: Init AI agents view

      // Init map over entire maze
      createMap(maze);

      // Update static display metrics
      light.intensity = 0;
      var level = Math.floor((mazeDimension - 1) / 2 - 4);
      $('#level').html('Level ' + level);
      $('#maze-size').html('Maze size: ' + mazeDimension);
      $('#training-round').html('Training round: ' + trainingRound); // TODO: implement
      $('#energy-left').html('Energy left: ' + energy);
      displayed = false;

      // Switch game state
      gameState = 'fadeIn';
      break;

    case 'fadeIn':
      // Fade in before play starts
      light.intensity += 0.1 * (1.0 - light.intensity);
      renderer.render(scene, camera);
      if (Math.abs(light.intensity - 1.0) < 0.05) {
        light.intensity = 1.0;
        gameState = 'play';
      }
      break;

    case 'play':
      // Game loop, update all dynamic metrics.
      updateCameraPosition();
      updatePhysicsWorld();
      updateRenderWorld();
      renderer.render(scene, camera);

      // Update Map view
      updateMap();

      // Update energy window.
      // TODO: make some animation when energy declines!
      energy -= energySpent();
      $('#energy-left').html('Energy left: ' + energy);

      // Check for loss
      if (energy <= 0) {
        win = false;
        gameState = 'fadeOut';
      }

      // Check for victory.
      var mazeX = Math.floor(ballMesh.position.x + 0.5);
      var mazeY = Math.floor(ballMesh.position.y + 0.5);
      if (mazeX == mazeDimension && mazeY == mazeDimension - 2) {
        mazeDimension += 2;
        win = true;
        gameState = 'fadeOut';
      }
      break;

    case 'fadeOut':
      updatePhysicsWorld();
      updateRenderWorld();
      light.intensity += 0.1 * (0.0 - light.intensity);
      renderer.render(scene, camera);
      if (Math.abs(light.intensity - 0.0) < 0.1) {
        light.intensity = 0.0;
        renderer.render(scene, camera);
        if (win) {
          gameState = 'victory';
        } else {
          gameState = 'loss';
        }
      }
      break;

    case 'victory':
      // Display score and 'Next level' button
      if (!displayed) {
        completedLevelBonus += 50;
        score += energy;
        $('#endTitle').html('You won!');
        $('#score').html('Total score: ' + score);
        $('#restartBtn').html('Play next level');
        $('#restartBtn').click(() => {
          $('#game-ended').hide();
          gameState = 'initLevel';
        });
        $('#game-ended').show();
        displayed = true;
      }
      break;

    case 'loss':
      // Display score and 'Restart' button
      if (!displayed) {
        $('#endTitle').html('You lost!');
        $('#score').html('Total score: ' + score);
        $('#restartBtn').html('Restart level');
        $('#restartBtn').click(() => {
          $('#game-ended').hide();
          gameState = 'initLevel';
        });
        $('#game-ended').show();
        displayed = true;
      }
      break;
  }

  requestAnimationFrame(gameLoop);
}

/**
 * WINDOW FUNCTIONS
 */
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // Recenter instructions
  $('#instructions').center();
  $('#help').center();
  $('#game-ended').center();
}

jQuery.fn.centerv = function() {
  wh = window.innerHeight;
  h = this.outerHeight();
  this.css('position', 'absolute');
  this.css('top', Math.max(0, (wh - h) / 2) + 'px');
  return this;
};

jQuery.fn.centerh = function() {
  ww = window.innerWidth;
  w = this.outerWidth();
  this.css('position', 'absolute');
  this.css('left', Math.max(0, (ww - w) / 2) + 'px');
  return this;
};

jQuery.fn.center = function() {
  this.centerv();
  this.centerh();
  return this;
};

/**
 * MAIN (LOAD) FUNCTION
 */
$(document).ready(function() {
  // Prepare the 'Instructions' window.
  $('#instructions')
    .center()
    .hide();
  keyboardJS.bind(
    'i',
    function() {
      $('#instructions').show();
    },
    function() {
      $('#instructions').hide();
    }
  );

  // Prepare the 'Help' window.
  $('#help')
    .center()
    .hide(); // TODO: show on reload?
  keyboardJS.bind(
    'h',
    function() {
      $('#help').show();
    },
    function() {
      $('#help').hide();
    }
  );
  $('#game-ended')
    .center()
    .hide();

  // Prepare the 'Map' window.
  $('#maze-map').hide();
  keyboardJS.bind('m', function() {
    if ($('#maze-map').is(':visible')) {
      $('#maze-map').hide();
    } else {
      $('#maze-map').show();
    }
  });

  // Create the WebGL renderer.
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Bind keyboard and resize events.
  window.addEventListener(
    'keyup',
    function(event) {
      Key.onKeyup(event);
    },
    false
  );
  window.addEventListener(
    'keydown',
    function(event) {
      Key.onKeydown(event);
    },
    false
  );
  $(window).resize(onResize);

  // Start first game level.
  gameState = 'initLevel';

  // Start the game loop.
  requestAnimationFrame(gameLoop);
});
