/**
 * VARIABLE DECLARATION
 */
var mapCamera = undefined,
  mapScene = undefined,
  mapRenderer = undefined,
  mapLight = undefined,
  canvasSize = 300,
  mapBall = undefined,
  mapLine = undefined,
  lineVertices = undefined,
  MAX_POINTS = 5000,
  nrOfPointsToDraw = 1,
  vertIndex = 0;

// Versus mode variables.
var mapBallVS = undefined,
  mapLineVS = undefined,
  lineVerticesVS = undefined,
  nrOfPointsToDrawVS = 1,
  vertIndexVS = 0;

// Load textures.
var textureLoader = new THREE.TextureLoader(),
  mapBushTex = textureLoader.load('./tex/bush_light1.jpg'),
  mapBallTex = textureLoader.load('./tex/ball.png'),
  mapVsBallTex = textureLoader.load('./tex/red_brick.jpg'),
  mapBrickTex = textureLoader.load('./tex/brick.png');

/**
 * PUBLIC FUNCTIONS
 */

// Create the scene and renderer for the map.
function createMap(field) {
  var aspect = canvasSize / mazeDimension;

  // Create map renderer.
  var mapCanvas = document.getElementById('mapCanvas');
  var mapContext = mapCanvas.getContext('webgl');
  mapContext.canvas.width = mapContext.canvas.height = canvasSize;
  mapRenderer = new THREE.WebGLRenderer({ context: mapContext });
  mapRenderer.setSize(canvasSize, canvasSize);

  // Create the map scene object.
  mapScene = new THREE.Scene();
  mapScene.background = new THREE.Color(0x444444);

  // Create the light.
  mapLight = new THREE.DirectionalLight(0xe8e8e8, 0.8);
  mapLight.position.set(0, 0, 1000);
  mapScene.add(mapLight);

  // Create the camera.
  mapCamera = new THREE.OrthographicCamera(
    -canvasSize / 2,
    canvasSize / 2,
    canvasSize / 2,
    -canvasSize / 2,
    1,
    1000
  );
  mapCamera.position.set(canvasSize / 2, canvasSize / 2, 100);
  mapCamera.lookAt(new THREE.Vector3(canvasSize / 2, canvasSize / 2, 0));
  mapScene.add(mapCamera);

  // Create the ball and add to scene.
  var ballGeo = new THREE.CircleGeometry(ballRadius * aspect, 8);
  var ballMat = new THREE.MeshPhongMaterial({ map: mapBallTex });
  mapBall = new THREE.Mesh(ballGeo, ballMat);
  mapBall.position.copy(ballInitPos);
  mapBall.position.add(new THREE.Vector3(0.5, 0.5, 0));
  mapBall.position.multiplyScalar(aspect);
  mapScene.add(mapBall);

  // Create the maze and add to scene.
  for (var i = 0; i < field.dimension; i++) {
    for (var j = 0; j < field.dimension; j++) {
      if (field[i][j] > 0) {
        var mazeGeo = new THREE.BoxGeometry(aspect, aspect, aspect);
        if (field[i][j] == 1) {
          var mazeMat = new THREE.MeshPhongMaterial({ map: mapBushTex });
          var maze_ij = new THREE.Mesh(mazeGeo, mazeMat);
        } else {
          var mazeMat = new THREE.MeshPhongMaterial({ map: mapBrickTex });
          var maze_ij = new THREE.Mesh(mazeGeo, mazeMat);
        }
        maze_ij.position.set(i + 0.5, j + 0.5, 0.5);
        maze_ij.position.multiplyScalar(aspect);
        mapScene.add(maze_ij);
      }
    }
  }

  // Reset values if level was completed.
  nrOfPointsToDraw = 1;
  vertIndex = 0;

  // Create line for ball's path.
  var lineMat = new THREE.LineBasicMaterial({ color: 0xffff66 });
  var lineGeo = new THREE.BufferGeometry();
  var positions = new Float32Array(MAX_POINTS * 3); // 3 vertices
  lineGeo.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  lineGeo.setDrawRange(0, nrOfPointsToDraw);
  mapLine = new THREE.Line(lineGeo, lineMat);
  lineVertices = mapLine.geometry.attributes.position.array;
  lineVertices[vertIndex++] = mapBall.position.x;
  lineVertices[vertIndex++] = mapBall.position.y;
  lineVertices[vertIndex++] = mapBall.position.z;
  mapScene.add(mapLine);

  // Add second ball if we're in versus mode
  if (gameMode == 'versus') {
    var ballMatVS = new THREE.MeshPhongMaterial({ map: mapVsBallTex });
    mapBallVS = new THREE.Mesh(ballGeo, ballMatVS);
    mapBallVS.position.copy(ballInitPosVS);
    mapBallVS.position.add(new THREE.Vector3(0.5, 0.5, 0));
    mapBallVS.position.multiplyScalar(aspect);
    mapScene.add(mapBallVS);

    // Reset values if level was completed.
    nrOfPointsToDrawVS = 1;
    vertIndexVS = 0;

    // Create line for ball's path.
    var lineMatVS = new THREE.LineBasicMaterial({ color: 0xff420e });
    var lineGeoVS = new THREE.BufferGeometry();
    var positionsVS = new Float32Array(MAX_POINTS * 3); // 3 vertices
    lineGeoVS.addAttribute('position', new THREE.BufferAttribute(positionsVS, 3));
    lineGeoVS.setDrawRange(0, nrOfPointsToDrawVS);
    mapLineVS = new THREE.Line(lineGeoVS, lineMatVS);
    lineVerticesVS = mapLineVS.geometry.attributes.position.array;
    lineVerticesVS[vertIndexVS++] = mapBallVS.position.x;
    lineVerticesVS[vertIndexVS++] = mapBallVS.position.y;
    lineVerticesVS[vertIndexVS++] = mapBallVS.position.z;
    mapScene.add(mapLineVS);
  }
}

// Called every render to update the map.
function updateMap() {
  var aspect = canvasSize / mazeDimension;

  // Update ball position.
  mapBall.position.copy(ballBody.position);
  mapBall.position.add(new THREE.Vector3(0.5, 0.5, 0));
  mapBall.position.multiply(new THREE.Vector3(aspect, aspect, 0));

  // Update AI ball in versus mode.
  if (gameMode == 'versus') {
    mapBallVS.position.copy(ballBodyVS.position);
    mapBallVS.position.add(new THREE.Vector3(0.5, 0.5, 0));
    mapBallVS.position.multiply(new THREE.Vector3(aspect, aspect, 0));
  }

  mapRenderer.render(mapScene, mapCamera);
}

// Called when a new line should be added to path.
function updateLinePath() {
  // Draw yellow line on path where ball has moved.
  lineVertices[vertIndex++] = mapBall.position.x;
  lineVertices[vertIndex++] = mapBall.position.y;
  lineVertices[vertIndex++] =
    mapBall.position.z + 2 * canvasSize / mazeDimension;
  mapLine.geometry.setDrawRange(0, ++nrOfPointsToDraw);
  mapLine.geometry.attributes.position.needsUpdate = true;
}

// Called when a new line should be added to path for AI in Versus mode.
function updateLinePathVS() {
  // Draw yellow line on path where ball has moved.
  lineVerticesVS[vertIndexVS++] = mapBallVS.position.x;
  lineVerticesVS[vertIndexVS++] = mapBallVS.position.y;
  lineVerticesVS[vertIndexVS++] =
    mapBallVS.position.z + 2 * canvasSize / mazeDimension;
  mapLineVS.geometry.setDrawRange(0, ++nrOfPointsToDrawVS);
  mapLineVS.geometry.attributes.position.needsUpdate = true;
}
