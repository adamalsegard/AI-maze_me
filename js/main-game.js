/**
 * @author Adam Alsegård / http://www.adamalsegard.se
 */

// Check if browser supports WebGL before rendering anything.
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
  gameMode = undefined,
  mouseX = undefined,
  mouseY = undefined,
  maze = undefined,
  mazeMesh = undefined,
  ballMesh = undefined,
  groundMesh = undefined,
  intersectMeshes = undefined,
  intersectedObjectId = -1,
  nrOfDifferentMaterials = 2; // Remember to change in maze-generator as well!

// VS parameters
var lightVS = undefined,
  energyVS = 0,
  framesPerStepVS = 10, // TODO
  scoreVS = 0,
  ballBodyVS = undefined,
  ballMeshVS = undefined,
  ballInitPosVS = new CANNON.Vec3(1, 1, ballRadius),
  lastPosVS = new CANNON.Vec3(),
  intersectedObjectIdVS = -1,
  levelsCompleted = 0,
  MAX_LEVELS_FOR_ONE_GAME = 10,
  AIwin = false;

// AI parameters (changable)
var agentToUse = 0,
  numberOfAgents = 0,
  trainAI = false,
  stepsTaken = 0,
  maxTrainingSteps = 500,
  increaseMazeSizeAfterXRounds = 50;

// Game parameters
var energy = 0,
  initEnergy = 2000,
  mazeDimension = 19, // TODO: Change back to 11!
  framesPerStep = 5, // TODO: Change back to 60!
  DEFAULT_AI_FPS = 10,
  score = 0,
  completedLevelBonus = 0,
  ballRadius = 0.25,
  ballInitPos = new CANNON.Vec3(1, 1, ballRadius),
  goalPos = new CANNON.Vec3(0, 0, ballRadius),
  lastPos = new CANNON.Vec3(),
  keyAxis = [0, 0],
  nextStepAI = new THREE.Vector2(0, 0),
  iter = 0,
  displayed = false,
  win = false;

// Load textures
var ballTexture = textureLoader.load('./tex/ball.png'),
  brickTexture = textureLoader.load('./tex/brick.png'),
  bushLight1Texture = textureLoader.load('./tex/bush_light1.jpg'),
  gravel1Texture = textureLoader.load('./tex/gravel1.jpg'),
  /*gravel2Texture = textureLoader.load('./tex/gravel2.jpg'),
  stoneTexture = textureLoader.load('./tex/stone.jpg'),
  stoneRoadTexture = textureLoader.load('./tex/stone_road.jpg'),
  bushLight2Texture = textureLoader.load('./tex/bush_light2.jpg'),
  bushMed1Texture = textureLoader.load('./tex/bush_med1.jpg'),
  bushMed2Texture = textureLoader.load('./tex/bush_med2.jpg'),
  bushDark1Texture = textureLoader.load('./tex/bush_dark1.png'),
  bushDark2Texture = textureLoader.load('./tex/bush_dark2.jpg'),
  waterLightTexture = textureLoader.load('./tex/water_light.jpg'),
  waterMedTexture = textureLoader.load('./tex/water_medium.png'),
  waterDarkTexture = textureLoader.load('./tex/water_dark.png'),*/
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

// Init CANNON physics world.
function createPhysicsWorld() {
  // Create the physics world object.
  globalWorld = new CANNON.World();
  globalWorld.gravity.set(0, 0, -9.82);
  fixedTimeStep = 1.0 / framesPerStep;

  // Create materials.
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

  // Define contact materials.
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

  // Create another ball if we're in Versus mode.
  if (gameMode == 'versus') {
    ballBodyVS = new CANNON.Body({
      mass: 0,
      position: ballInitPosVS,
      shape: new CANNON.Sphere(ballRadius),
      material: ballMaterial
    });
    globalWorld.addBody(ballBodyVS);
  }

  // Create the maze.
  for (var i = 0; i < maze.dimension; i++) {
    for (var j = 0; j < maze.dimension; j++) {
      // Check if we should place a solid body here.
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

  // Create the ground.
  groundBody = new CANNON.Body({
    mass: 0, // Static body
    shape: new CANNON.Plane(),
    material: groundMaterial
  });
  globalWorld.addBody(groundBody);
}

// Create the maze mesh and return as a single group mesh.
function create_maze_mesh(field) {
  var mazeGroup = new THREE.Group();
  intersectMeshes = [];
  for (var i = 0; i < field.dimension; i++) {
    for (var j = 0; j < field.dimension; j++) {
      if (field[i][j] > 0) {
        var mazeGeo = new THREE.BoxGeometry(1, 1, 1);
        // Check if mesh should be solid or not.
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

// Init THREE render world.
function createRenderWorld() {
  // Create the scene object.
  scene = new THREE.Scene();

  // Create the light.
  light = new THREE.PointLight(0xffffff, 1, 15, 2);
  light.position.set(ballBody.position.x, ballBody.position.y, 1.5); // FOR SHADOWS: Change to 1.1
  light.castShadow = false; // FOR SHADOWS: Change to true
  scene.add(light);

  // Create the camera.
  var aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspect, 1, 1000);
  camera.position.set(ballBody.position.x, ballBody.position.y, 7);
  scene.add(camera);

  // Create the raycaster.
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

  // Create everything for Versus mode.
  if (gameMode == 'versus') {
    // Create another light to follow AI.
    lightVS = new THREE.PointLight(0xffffff, 1, 15, 2);
    lightVS.position.set(ballBodyVS.position.x, ballBodyVS.position.y, 1.1);
    lightVS.castShadow = true;
    scene.add(lightVS);

    // In this mode we'll always use shadows.
    light.position.set(ballBody.position.x, ballBody.position.y, 1.1);
    light.castShadow = true;

    // Create the AI ball and add to scene.
    ballMeshVS = new THREE.Mesh(ballGeo, ballMat);
    ballMeshVS.position.copy(ballInitPosVS);
    scene.add(ballMeshVS);
  }
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

// Update function called in render loop that listens for user input.
function updateCameraPosition() {
  if (Key.isDown(Key.UP)) onMoveUp();
  if (Key.isDown(Key.LEFT)) onMoveLeft();
  if (Key.isDown(Key.DOWN)) onMoveDown();
  if (Key.isDown(Key.RIGHT)) onMoveRight();
}

// Define keys to listen for.
var Key = {
  _pressed: {},
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
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

// Update CANNON physics.
function updatePhysicsWorld() {
  if (gameMode == 'manual') {
    // Apply user-directed force.
    var inputForce = new CANNON.Vec3(
      keyAxis[0] * ballBody.mass * 0.25,
      keyAxis[1] * ballBody.mass * 0.25,
      0.0
    );
    ballBody.applyImpulse(inputForce, ballBody.position);
    keyAxis = [0, 0];
  } else if (gameMode == 'ai') {
    // Update ballBody position with fixed step in direction AI agent choose.
    var addVector = new CANNON.Vec3(
      nextStepAI.x * fixedTimeStep,
      nextStepAI.y * fixedTimeStep,
      0.0
    );
    ballBody.position.vadd(addVector, ballBody.position);
  } else if (gameMode == 'versus') {
    // Apply both user-directed force and AI positioning!
    var inputForce = new CANNON.Vec3(
      keyAxis[0] * ballBody.mass * 0.25,
      keyAxis[1] * ballBody.mass * 0.25,
      0.0
    );
    // User
    ballBody.applyImpulse(inputForce, ballBody.position);
    keyAxis = [0, 0];

    // AI
    var addVector = new CANNON.Vec3(
      nextStepAI.x * fixedTimeStep,
      nextStepAI.y * fixedTimeStep,
      0.0
    );
    ballBodyVS.position.vadd(addVector, ballBodyVS.position);
  }

  // Take a time step.
  globalWorld.step(fixedTimeStep); // TODO!
}

// Update THREE render.
function updateRenderWorld() {
  // Update ball position and rotation.
  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);

  // Update camera and light positions.
  camera.position.x += (ballMesh.position.x - camera.position.x) * 0.1;
  camera.position.y += (ballMesh.position.y - camera.position.y) * 0.1;
  light.position.x = camera.position.x;
  light.position.y = camera.position.y;

  // Check for intersection with non-solid materials.
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
    // Subtract energy for type of entered material.
    // This will not subtract if the same object is entered several time *in a row*!
    materialEntered(intersections[0].object.name, false);
    intersectedObjectId = intersections[0].object.id;
  }

  // Update AI parameters when in versus mode.
  if (gameMode == 'versus') {
    // Update AI position and rotation.
    ballMeshVS.position.copy(ballBodyVS.position);
    ballMeshVS.quaternion.copy(ballBodyVS.quaternion);

    // Update AI light.
    lightVS.position.x += (ballMeshVS.position.x - lightVS.position.x) * 0.1;
    lightVS.position.y += (ballMeshVS.position.y - lightVS.position.y) * 0.1;

    // AI: Check for intersection with non-solid materials.
    raycaster.set(ballMeshVS.position, new THREE.Vector3(1, 0, 0));
    var intersectionsVS = raycaster.intersectObjects(intersectMeshes);
    raycaster.set(ballMeshVS.position, new THREE.Vector3(-1, 0, 0));
    intersectionsVS.push.apply(
      intersectionsVS,
      raycaster.intersectObjects(intersectMeshes)
    );
    raycaster.set(ballMeshVS.position, new THREE.Vector3(0, 1, 0));
    intersectionsVS.push.apply(
      intersectionsVS,
      raycaster.intersectObjects(intersectMeshes)
    );
    raycaster.set(ballMeshVS.position, new THREE.Vector3(0, -1, 0));
    intersectionsVS.push.apply(
      intersectionsVS,
      raycaster.intersectObjects(intersectMeshes)
    );

    intersectionsVS.sort();
    if (
      intersectionsVS.length > 0 &&
      intersectionsVS[0].distance < ballRadius &&
      intersectionsVS[0].object.id != intersectedObjectIdVS
    ) {
      // Subtract energy for type of entered material.
      // This will not subtract if the same object is entered several time *in a row*!
      materialEntered(intersectionsVS[0].object.name, true);
      intersectedObjectIdVS = intersectionsVS[0].object.id;
    }
  }
}

// Return energy spent if the player (ball) moved move than one square.
function energySpent() {
  // Calculate distance moved since last subtraction.
  var moved = ballBody.position.vsub(lastPos);

  // Only return if moved move than one square!
  if (moved.length() >= 0.98) {
    // Also update the path in map scene.
    updateLinePath();
    lastPos.copy(ballBody.position);
    return Math.round(moved.length());
  } else {
    return 0;
  }
}

// Update energy for AI in versus mode.
function energySpentVS() {
  // Calculate distance moved since last subtraction.
  var moved = ballBodyVS.position.vsub(lastPosVS);

  // Only return if moved move than one square!
  if (moved.length() >= 0.98) {
    // Also update the path in map scene.
    updateLinePathVS();
    lastPosVS.copy(ballBodyVS.position);
    return Math.round(moved.length());
  } else {
    return 0;
  }
}

// Return sum to subtract when player (ball) entered a non-solid material in the maze.
function materialEntered(materialType, isAIinVS) {
  var sum = 0;
  switch (materialType) {
    case 'bushLight':
      animateEnergySubtraction(bushLightSub, isAIinVS);
      sum -= bushLightSub;
      break;
    case 'bushMed':
      animateEnergySubtraction(bushMedSub, isAIinVS);
      sum -= bushMedSub;
      break;
    case 'bushDark':
      animateEnergySubtraction(bushDarkSub, isAIinVS);
      sum -= bushDarkSub;
      break;
  }
  if (isAIinVS) {
    energyVS -= sum;
  } else {
    energy -= sum;
  }
}

// Animate energy subtraction when a material was entered.
function animateEnergySubtraction(subtractedSum, isAIinVS) {
  var topString = isAIinVS ? '8vw' : '1vw';
  var leftString = isAIinVS ? 'calc(1vw + 145px)' : 'calc(1vw + 125px)';
  $('#energy-decrease').css({ top: topString, left: leftString });
  $('#energy-decrease').html('-' + subtractedSum);
  $('#energy-decrease').removeClass('run-animation');
  void $('#energy-decrease').width();
  $('#energy-decrease').addClass('run-animation');
}

/**
 * MAIN GAME LOOP
 */
function gameLoop() {
  switch (gameState) {
    case 'initLevel':
      // Randomize start and exit posistions.
      ballInitPos.x = Math.floor(Math.random() * (mazeDimension - 3)) + 1;
      ballInitPos.y = Math.floor(Math.random() * (mazeDimension - 3)) + 1;
      // Place goal at further end from player.
      // Ensure that goal is at an odd number in range [1, mazeDim-2]
      if (Math.random() < 0.5) {
        goalPos.x = ballInitPos.x < mazeDimension / 2 ? mazeDimension - 1 : 0;
        goalPos.y =
          Math.floor(Math.random() * ((mazeDimension - 3) / 2)) * 2 + 1;
      } else {
        goalPos.x =
          Math.floor(Math.random() * ((mazeDimension - 3) / 2)) * 2 + 1;
        goalPos.y = ballInitPos.y < mazeDimension / 2 ? mazeDimension - 1 : 0;
      }

      // Create AI parameters if we're in Versus mode.
      if (gameMode == 'versus') {
        ballInitPosVS.x = Math.floor(Math.random() * (mazeDimension - 3)) + 1;
        ballInitPosVS.y = Math.floor(Math.random() * (mazeDimension - 3)) + 1;

        energyVS = initEnergy + completedLevelBonus;
        lastPosVS.copy(ballInitPosVS);
      }

      // Init maze field and use it for physics and rendering.
      maze = generateSquareMaze(
        mazeDimension,
        ballInitPos,
        ballInitPosVS,
        goalPos
      );
      createPhysicsWorld();
      createRenderWorld();

      // Init game parameters.
      energy = initEnergy + completedLevelBonus;
      lastPos.copy(ballInitPos);

      // Init AI agent and update player (ball) accordingly.
      if (gameMode == 'ai') {
        initAgent(trainAI, maze, ballInitPos, mazeDimension, goalPos);
        ballBody.mass = 0;
        ballBody.updateMassProperties();
        ballBody.velocity.set(0, 0, 0);
        ballBody.angularVelocity.set(0, 0, 0);
        nextStepAI = new THREE.Vector2(0, 0);
      } else if (gameMode == 'versus') {
        initAgent(trainAI, maze, ballInitPosVS, mazeDimension, goalPos);
        ballBodyVS.mass = 0;
        ballBodyVS.updateMassProperties();
        ballBodyVS.velocity.set(0, 0, 0);
        ballBodyVS.angularVelocity.set(0, 0, 0);
        nextStepAI = new THREE.Vector2(0, 0);
      } else {
        ballBody.mass = 1;
      }

      // Init map over entire maze.
      createMap(maze);

      // Update static display metrics.
      light.intensity = 0;
      var level = Math.floor((mazeDimension - 1) / 2 - 4);
      $('#level').html('Level ' + level);
      $('#maze-size').html('Maze size: ' + mazeDimension);
      $('#training-round').html('Training round: ' + getTrainingRound());
      $('#energy-left').html('Energy left: ' + energy);
      var distToGoal = Math.round(ballBody.position.distanceTo(goalPos));
      $('#distToGoal').html('Distance to goal: ' + distToGoal);
      $('#framesPerStep').html('Frames per step: ' + framesPerStep);
      displayed = false;

      if (gameMode == 'versus') {
        $('#versus-energy-left').html('AI energy left: ' + energy);
        var distToGoalVS = Math.round(ballBodyVS.position.distanceTo(goalPos));
        $('#distToGoalVS').html('AI distance to goal: ' + distToGoalVS);
      }

      // Switch game state.
      gameState = 'fadeIn';
      break;

    case 'fadeIn':
      // Fade in before play starts.
      light.intensity += 0.1 * (1.0 - light.intensity);
      renderer.render(scene, camera);
      if (Math.abs(light.intensity - 1.0) < 0.05) {
        light.intensity = 1.0;
        gameState = 'play';
      }
      break;

    case 'play':
      if (gameMode == 'manual') {
        // Update camera from user input.
        updateCameraPosition();
      } else if (gameMode == 'ai') {
        // Update AI input and parameters.
        if (iter % framesPerStep == 0) {
          // Get next step for AI, this will also update the Q-table if we are in a training session.
          nextStepAI = getNextAIStep();
          iter = 0;
          stepsTaken++;
        }
        iter++;
      } else if (gameMode == 'versus') {
        // Update camera from user input and get next step for AI.
        updateCameraPosition();
        if (iter % framesPerStep == 0) {
          // TODO!
          nextStepAI = getNextAIStep();
          iter = 0;
          stepsTaken++;
        }
        iter++;
      } else {
        // gameMode is undefined, pause everything!
      }

      // Game loop, update all dynamic metrics.
      updatePhysicsWorld();
      updateRenderWorld();
      renderer.render(scene, camera);

      // Update Map view.
      updateMap();

      // Update info.
      energy -= energySpent();
      $('#energy-left').html('Energy left: ' + energy);
      var distToGoal = Math.round(ballBody.position.distanceTo(goalPos));
      $('#distToGoal').html('Distance to goal: ' + distToGoal);
      $('#framesPerStep').html('Frames per step: ' + framesPerStep);

      if (gameMode == 'versus') {
        energyVS -= energySpentVS();
        $('#versus-energy-left').html('AI energy left: ' + energyVS);
        var distToGoalVS = Math.round(ballBodyVS.position.distanceTo(goalPos));
        $('#distToGoalVS').html('AI distance to goal: ' + distToGoalVS);
      }

      // If we are in a training session we want to continue until max iterations, so we can learn even after we reach the goal state.
      if (trainAI) {
        //if (stepsTaken > maxTrainingSteps || energy <= 0) {
        if (
          stepsTaken > maxTrainingSteps ||
          energy <= 0 ||
          ballBody.position.almostEquals(goalPos, 0.3)
        ) {
          stepsTaken = 0;
          gameState = 'fadeOut';
        }
      } else if (gameMode == 'versus') {
        // TODO: Change how players get points!
        if (energy <= 0 && energyVS <= 0) {
          // Check if both have lost.
          win = false;
          AIwin = false;
          gameState = 'fadeOut';
        } else if (ballBody.position.almostEquals(goalPos, 0.3)) {
          // Else check for victory for User.
          win = true;
          AIwin = false;
          gameState = 'fadeOut';
        } else if (ballBodyVS.position.almostEquals(goalPos, 0.3)) {
          // Else check for victory for AI.
          win = false;
          AIwin = true;
          gameState = 'fadeOut';
        }
      } else {
        // Check for loss.
        if (energy <= 0) {
          win = false;
          gameState = 'fadeOut';
        }
        // Check for victory.
        if (ballBody.position.almostEquals(goalPos, 0.3)) {
          win = true;
          gameState = 'fadeOut';
        }
      }
      break;

    case 'fadeOut':
      light.intensity += 0.1 * (0.0 - light.intensity);
      renderer.render(scene, camera);
      if (Math.abs(light.intensity - 0.0) < 0.1) {
        light.intensity = 0.0;
        renderer.render(scene, camera);

        // If we're in a training state then just save and restart, else check for victory or loss!
        if (trainAI) {
          // If we've trainged a while on the same size then maybe it's time to increase!
          if (getTrainingRound() % increaseMazeSizeAfterXRounds == 0) {
            mazeDimension += 2;
          }
          roundEnded(energy);
          gameState = 'initLevel';
        } else if (gameMode == 'versus') {
          gameState = 'versusEnd';
          levelsCompleted++;
          mazeDimension += 2;
        } else if (win) {
          gameState = 'victory';
          mazeDimension += 2;
        } else {
          gameState = 'loss';
        }
      }
      break;

    case 'victory':
      // Display score and 'Next level' button.
      if (!displayed) {
        completedLevelBonus += 50;
        score += energy;
        $('#endTitle').html('You won!');
        $('#score').html('Total score: ' + score);
        $('#restartBtn').html('Play next level');
        $('#game-ended').show();
        displayed = true;
      }
      break;

    case 'loss':
      // Display score and 'Restart' button.
      if (!displayed) {
        $('#endTitle').html('You lost!');
        $('#score').html('Total score: ' + score);
        $('#restartBtn').html('Restart level');
        $('#game-ended').show();
        displayed = true;
      }
      break;

    case 'versusEnd':
      // One round in versus battle completed. Show the correct div.
      if (!displayed) {
        completedLevelBonus += 50;
        score += energy;
        scoreVS += energyVS;
        if (levelsCompleted == MAX_LEVELS_FOR_ONE_GAME) {
          $('#endTitleVS').html('Game ended!');
          $('#scoreP').html('Final score Player: ' + score);
          $('#scoreVS').html('Final score AI: ' + scoreVS);
          $('#restartBtnVS').html('New game');
        } else {
          $('#endTitleVS').html('Level ended');
          $('#scoreP').html('Total score Player: ' + score);
          $('#scoreVS').html('Total score AI: ' + scoreVS);
          $('#restartBtnVS').html('Next level');
        }
        $('#versus-game-ended').show();
        displayed = true;
      }
      break;
  }

  requestAnimationFrame(gameLoop);
}

/**
 * WINDOW FUNCTIONS
 */

// Called automatically every time window gets resized.
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // Re-center centered windows.
  $('#instructions').center();
  $('#help').center();
  $('#game-ended').center();
  $('#versus-game-ended').center();
  $('#ai-mode-info').center();
  $('#manual-mode-info').center();
  $('#versus-mode-info').center();
}

jQuery.fn.centerH = function() {
  wh = window.innerHeight;
  h = this.outerHeight();
  this.css('position', 'absolute');
  this.css('top', Math.max(0, (wh - h) / 2) + 'px');
  return this;
};

jQuery.fn.centerW = function() {
  ww = window.innerWidth;
  w = this.outerWidth();
  this.css('position', 'absolute');
  this.css('left', Math.max(0, (ww - w) / 2) + 'px');
  return this;
};

jQuery.fn.center = function() {
  this.centerH();
  this.centerW();
  return this;
};

/**
 * BINDING OF HTML BUTTON FUNCTIONS
 */
$('#start-ai').click(() => {
  // Hide pop up on click.
  $('#ai-mode-info').hide();

  // Let user decide what agent to use.
  if (agentToUse < 0 || agentToUse >= numberOfAgents) {
    agentToUse = numberOfAgents > 0 ? numberOfAgents - 1 : 0;
  }

  // Fetch an old agent and start playing.
  setOldAgent(agentToUse);
  $('#agent').html('Agent: ' + agentToUse);
  $('#versus-energy-info').hide();
  trainAI = false;
  gameMode = 'ai';
  gameState = 'initLevel';
});

$('#start-manual').click(() => {
  // Hide pop up on click and save any possible AI agents if training was in session!
  $('#manual-mode-info').hide();
  if (trainAI) {
    agentToUse = saveAgent();
    trainAI = false;
  }
  $('#agent').html('Agent: None');
  $('#versus-energy-info').hide();
  gameMode = 'manual';
  gameState = 'initLevel';
});

$('#start-versus').click(() => {
  // Hide pop up on click and save any possible AI agents if training was in session!
  $('#versus-mode-info').hide();
  if (trainAI) {
    agentToUse = saveAgent();
    trainAI = false;
  }
  // Let user decide what agent to play against.
  if (agentToUse < 0 || agentToUse >= numberOfAgents) {
    agentToUse = numberOfAgents > 0 ? numberOfAgents - 1 : 0;
  }
  setOldAgent(agentToUse);
  $('#agent').html('Opponent: ' + agentToUse);
  $('#versus-energy-info').show();
  gameMode = 'versus';
  levelsCompleted = 0;
  gameState = 'initLevel';
});

$('#restartBtn').click(() => {
  // Start next level.
  $('#game-ended').hide();
  gameState = 'initLevel';
});
$('#restartBtnVS').click(() => {
  // Start next level.
  $('#versus-game-ended').hide();
  gameState = 'initLevel';
});

/**
 * MAIN (LOAD) FUNCTION
 */
$(document).ready(function() {
  // Prepare the 'Instructions' window. Bind 'I' key to hide/show window with PRESS.
  $('#instructions')
    .center()
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

  // Prepare the 'Help' window. Bind 'H' key to hide/show window iwth PRESS.
  $('#help')
    .center()
    .center()
    .hide();
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
    .center()
    .hide();

  $('#versus-game-ended')
    .center()
    .center()
    .hide();

  // Prepare the 'Map' window. Bind 'M' key to hide/show map with CLICK.
  $('#maze-map').hide();
  keyboardJS.bind('m', function() {
    if ($('#maze-map').is(':visible')) {
      $('#maze-map').hide();
    } else {
      $('#maze-map').show();
    }
  });

  // Bind 'A' key to 'AI Mode'. Start by DEFAULT.
  $('#ai-mode-info')
    .center()
    .center();
  keyboardJS.bind('a', function() {
    if (gameMode != 'ai') {
      // Show pop up with info and switch to start AI agent loop.
      gameMode = undefined;
      // Reload agents.
      fetchOldAgents(result => {
        numberOfAgents = result;
        $('#agentCount').html(
          'Else chose a number between [0, ' +
            (numberOfAgents - 1) +
            '] to play another agent.'
        );
      });
      $('#manual-mode-info').hide();
      $('#versus-mode-info').hide();
      $('#ai-mode-info').show();
    }
  });

  // Bind 'P' key to 'Manual Player Mode'.
  $('#manual-mode-info')
    .center()
    .center()
    .hide();
  keyboardJS.bind('p', function() {
    if (gameMode != 'manual') {
      // Show pop up with info and switch to start Manual player loop.
      gameMode = undefined;
      $('#ai-mode-info').hide();
      $('#versus-mode-info').hide();
      $('#manual-mode-info').show();
    }
  });

  // Bind 'V' key to 'Versus Mode'.
  $('#versus-mode-info')
    .center()
    .center()
    .hide();
  keyboardJS.bind('v', function() {
    if (gameMode != 'versus') {
      // Show pop up with info and switch to start Manual player loop.
      gameMode = undefined;
      fetchOldAgents(result => {
        numberOfAgents = result;
        $('#availableAgents').html(
          'Available agents: [0, ' + (numberOfAgents - 1) + ']'
        );
      });
      $('#ai-mode-info').hide();
      $('#manual-mode-info').hide();
      $('#versus-mode-info').show();
    }
  });
  $('#versus-energy-info').hide();

  // Bind 'N' key to New training session.
  keyboardJS.bind('n', function() {
    // Hide (eventually) open windows
    $('#ai-mode-info').hide();
    $('#manual-mode-info').hide();
    $('#versus-mode-info').hide();

    // Start new AI agent traning session.
    gameMode = 'ai';
    agentToUse = createNewAgent();
    $('#agent').html('Agent: ' + agentToUse);
    trainAI = true;
    gameState = 'initLevel';
  });

  // Bind 'C' key to Continue training session.
  keyboardJS.bind('c', function() {
    // Continue training session for this AI agent.
    if (gameMode == 'ai') {
      trainAI = true;
      framesPerStep = DEFAULT_AI_FPS;
      gameState = 'initLevel';
    }
  });

  // Bind 'S' key to Save current Ai AGENT.
  keyboardJS.bind('s', function() {
    // Save Q-values for this AI agent.
    if (gameMode == 'ai') {
      agentToUse = saveAgent();
    }
  });

  // Bind 'R' key to restart current level.
  keyboardJS.bind('r', function() {
    gameState = 'initLevel';
  });

  // Bind '+' key to Increase training speed.
  keyboardJS.bind('+', function() {
    framesPerStep = framesPerStep > 5 ? framesPerStep - 5 : framesPerStep;
    fixedTimeStep = 1.0 / framesPerStep;
  });

  // Bind '-' key to Decrease training speed.
  keyboardJS.bind('-', function() {
    framesPerStep += 5;
    fixedTimeStep = 1.0 / framesPerStep;
  });

  // Bind number keys to set which agentToUse.
  keyboardJS.bind(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], function(
    e
  ) {
    agentToUse = parseInt(e.key);
    console.log('Chosen agent: ' + agentToUse);
    $('#chosenAgent').html('Chosen agent: ' + agentToUse);
    $('#opponent').html('Opponent: ' + agentToUse);
  });

  // Create the WebGL renderer.
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Enable shadows.
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

  // Fetch old agents from file and add info to AI menu (done by callback function).
  fetchOldAgents(result => {
    numberOfAgents = result;
    $('#agentCount').html(
      'Else chose a number between [0, ' +
        (numberOfAgents - 1) +
        '] to play another agent.'
    );
    $('#availableAgents').html(
      'Available agents: [0, ' + (numberOfAgents - 1) + ']'
    );
  });
  $('#agent').html('Agent: None');

  // Init first level.
  gameState = 'initLevel';

  // Start the game loop.
  requestAnimationFrame(gameLoop);
});
