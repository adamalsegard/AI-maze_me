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
var camera = undefined,
  scene = undefined,
  renderer = undefined,
  light = undefined,
  gameState = undefined,
  mouseX = undefined,
  mouseY = undefined,
  maze = undefined,
  mazeMesh = undefined,
  ballMesh = undefined,
  groundMesh = undefined,
  mazeDimension = 11,
  ballRadius = 0.25,
  keyAxis = [0, 0],
  // Load textures
  groundTexture = textureLoader.load('./tex/gravel1.jpg'),
  mazeTexture = textureLoader.load('./tex/bush_light1.jpg'),
  ballTexture = textureLoader.load('./tex/ball.png'),
  // Physic body variables
  globalWorld = undefined,
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
  var solidMaterial = new CANNON.Material({
    friction: 0.5,
    restitution: 0.3 // Studskoefficient
  });
  var contactDef = new CANNON.ContactMaterial(
    solidMaterial,
    solidMaterial, 
    {
      friction: 0.5,
      restitution: 0.8,
    }
  );
  globalWorld.addContactMaterial(contactDef);

  // Create the ball.
  ballBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(1, 1, ballRadius),
    shape: new CANNON.Sphere(ballRadius),
    material: solidMaterial
  });
  globalWorld.addBody(ballBody);

  // Create the maze
  for (var i = 0; i < maze.dimension; i++) {
    for (var j = 0; j < maze.dimension; j++) {
      if (maze[i][j]) {
        mazeBody = new CANNON.Body({
          mass: 10,
          shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
          material: solidMaterial
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
    material: solidMaterial
  });
  globalWorld.addBody(groundBody);
}

function create_maze_mesh(field) {
  var mazeGroup = new THREE.Group();
  for (var i = 0; i < field.dimension; i++) {
    for (var j = 0; j < field.dimension; j++) {
      if (field[i][j]) {
        var mazeGeo = new THREE.BoxGeometry(1, 1, 1);
        var mazeMat = new THREE.MeshPhongMaterial({ map: mazeTexture });
        var maze_ij = new THREE.Mesh(mazeGeo, mazeMat);
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

  // Create the ball and add to scene.
  var ballGeo = new THREE.SphereGeometry(ballRadius, 32, 16);
  var ballMat = new THREE.MeshPhongMaterial({ map: ballTexture });
  ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.position.set(1, 1, ballRadius);
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
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(mazeDimension * 5, mazeDimension * 5);
  var groundMat = new THREE.MeshPhongMaterial({ map: groundTexture });
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
}

/**
 * MAIN GAME LOOP
 */
function gameLoop() {
  switch (gameState) {

    case 'initialize':
      maze = generateSquareMaze(mazeDimension);
      maze[mazeDimension - 1][mazeDimension - 2] = false;
      createPhysicsWorld();
      createRenderWorld();

      light.intensity = 0;
      var level = Math.floor((mazeDimension - 1) / 2 - 4);
      $('#level').html('Level ' + level);
      gameState = 'fade in';
      break;

    case 'fade in':
      light.intensity += 0.1 * (1.0 - light.intensity);
      renderer.render(scene, camera);

      if (Math.abs(light.intensity - 1.0) < 0.05) {
        light.intensity = 1.0;
        gameState = 'play';
      }
      break;

    case 'play':
      updateCameraPosition();
      updatePhysicsWorld();
      updateRenderWorld();
      renderer.render(scene, camera);

      // Check for victory.
      var mazeX = Math.floor(ballMesh.position.x + 0.5);
      var mazeY = Math.floor(ballMesh.position.y + 0.5);
      if (mazeX == mazeDimension && mazeY == mazeDimension - 2) {
        mazeDimension += 2;
        gameState = 'fade out';
      }
      break;

    case 'fade out':
      updatePhysicsWorld();
      updateRenderWorld();
      light.intensity += 0.1 * (0.0 - light.intensity);
      renderer.render(scene, camera);

      if (Math.abs(light.intensity - 0.0) < 0.1) {
        light.intensity = 0.0;
        renderer.render(scene, camera);
        gameState = 'initialize';
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
  // TODO: Init map over entire maze
  $('#information').hide();

  // Prepare the instructions.
  $('#instructions').center();
  $('#instructions').hide();
  keyboardJS.bind(
    'h',
    function() {
      $('#instructions').show();
    },
    function() {
      $('#instructions').hide();
    }
  );

  // Create the WebGL renderer.
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Enable shadows
  renderer.shadowMap.enabled = true;
  //renderer.shadowMapSoft = true; // TODO: Which one!?
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

  // Set the initial game state.
  gameState = 'initialize';

  // Start the game loop.
  requestAnimationFrame(gameLoop);
});
