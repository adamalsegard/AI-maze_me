/**
 * @author Adam Alsegård / http://www.adamalsegard.se
 */

// Check if browser supports WebGL before rendering anything
if (!Detector.webgl) {
  var warning = Detector.getWebGLErrorMessage();
  document.body.appendChild(warning);
}

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
  
  // Box2D shortcuts
  /*b2World = Box2D.Dynamics.b2World,
  b2FixtureDef = Box2D.Dynamics.b2FixtureDef,
  b2BodyDef = Box2D.Dynamics.b2BodyDef,
  b2Body = Box2D.Dynamics.b2Body,
  b2CircleShape = Box2D.Collision.Shapes.b2CircleShape,
  b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape,
  b2Settings = Box2D.Common.b2Settings,
  b2Vec2 = Box2D.Common.Math.b2Vec2,*/

  // Box2D world variables
  wWorld = undefined,
  wBall = undefined;


/**
 * INIT FUNCTIONS
 */
function createPhysicsWorld() {
  // Create the world object.
  wWorld = new b2World(new b2Vec2(0, 0), true);

  // Create the ball.
  var bodyDef = new b2BodyDef();
  bodyDef.type = b2Body.b2_dynamicBody;
  bodyDef.position.Set(1, 1);
  wBall = wWorld.CreateBody(bodyDef);
  var fixDef = new b2FixtureDef();
  fixDef.density = 1.0;
  fixDef.friction = 0.0;
  fixDef.restitution = 0.25;
  fixDef.shape = new b2CircleShape(ballRadius);
  wBall.CreateFixture(fixDef);

  // Create the maze.
  bodyDef.type = b2Body.b2_staticBody;
  fixDef.shape = new b2PolygonShape();
  fixDef.shape.SetAsBox(0.5, 0.5);
  for (var i = 0; i < maze.dimension; i++) {
    for (var j = 0; j < maze.dimension; j++) {
      if (maze[i][j]) {
        bodyDef.position.x = i;
        bodyDef.position.y = j;
        wWorld.CreateBody(bodyDef).CreateFixture(fixDef);
      }
    }
  }
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
  light.castShadow = false; // TODO: Change back when I fixed scene
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
function onMoveUp() { keyAxis[1] = 1; }
function onMoveDown() { keyAxis[1] = -1; }
function onMoveLeft() { keyAxis[0] = -1; }
function onMoveRight() { keyAxis[0] = 1; }

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
  // Apply "friction".
  var lv = wBall.GetLinearVelocity();
  lv.Multiply(0.95);
  wBall.SetLinearVelocity(lv);

  // Apply user-directed force.
  var f = new b2Vec2(
    keyAxis[0] * wBall.GetMass() * 0.25,
    keyAxis[1] * wBall.GetMass() * 0.25
  );
  wBall.ApplyImpulse(f, wBall.GetPosition());
  keyAxis = [0, 0];

  // Take a time step.
  wWorld.Step(1 / 60, 8, 3);
}

function updateRenderWorld() {
  // Update ball position.
  /*var stepX = wBall.GetPosition().x - ballMesh.position.x;
  var stepY = wBall.GetPosition().y - ballMesh.position.y;
  ballMesh.position.x += stepX;
  ballMesh.position.y += stepY;

  // Update ball rotation.
  var tempMat = new THREE.Matrix4();
  tempMat.makeRotationAxis(new THREE.Vector3(0, 1, 0), stepX / ballRadius);
  tempMat.multiply(ballMesh.matrix);
  ballMesh.matrix = tempMat;
  tempMat = new THREE.Matrix4();
  tempMat.makeRotationAxis(new THREE.Vector3(1, 0, 0), -stepY / ballRadius);
  tempMat.multiply(ballMesh.matrix);
  ballMesh.matrix = tempMat;
  ballMesh.rotation.setFromRotationMatrix(ballMesh.matrix);
  */

  // Update camera and light positions.
  camera.position.x += keyAxis[0] * 0.3; //(ballMesh.position.x - camera.position.x) * 0.1;
  camera.position.y += keyAxis[1] * 0.3; //(ballMesh.position.y - camera.position.y) * 0.1;
  //camera.position.z += (5 - camera.position.z) * 0.1;
  light.position.x = camera.position.x;
  light.position.y = camera.position.y;
  //light.position.z = camera.position.z - 3.7;
  keyAxis = [0, 0];
}

/**
 * MAIN GAME LOOP
 */
function gameLoop() {
  switch (gameState) {
    case 'initialize':
      maze = generateSquareMaze(mazeDimension);
      maze[mazeDimension - 1][mazeDimension - 2] = false;
      //createPhysicsWorld();
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
      //updatePhysicsWorld();
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
      //updatePhysicsWorld();
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
  console.log("Resized!"); // Test this shit later!
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Bind keyboard and resize events.
  window.addEventListener('keyup', function(event) { Key.onKeyup(event); }, false);
  window.addEventListener('keydown', function(event) { Key.onKeydown(event); }, false);
  $(window).resize(onResize); // TODO: Doesn't work!

  // Set the initial game state.
  gameState = 'initialize';

  // Start the game loop.
  requestAnimationFrame(gameLoop);

});
