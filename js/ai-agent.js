/**
 * VARIABLE DECLARATION
 */
var trainingRound = 0,
  isTraining = undefined,
  qTable = undefined,
  weights = undefined,
  features = undefined,
  currentMaze = [],
  visitedMaze = undefined,
  MOVES = 4,
  NRFEATURES = 13,
  QSTATES = Math.pow(2, NRFEATURES), // All combinations if features can be binary classified!
  gamma = 0.8, // TODO: What should this be?
  learningRate = 0.9, // TODO: Start high and then go small!?
  explorationRate = 0.4, // TODO: change this over time!?
  actions = [
    new THREE.Vector2(-1, 0), // Left
    new THREE.Vector2(0, 1), // Up
    new THREE.Vector2(1, 0), // Right
    new THREE.Vector2(0, -1) // Down
  ],
  goalPos = new THREE.Vector2(0, 0),
  currentPos = new THREE.Vector2(0, 0),
  currentState = 0,
  earlierDistance = 0;

/**
 * PUBLIC FUNCTIONS
 */

// Initialize the Q-table for a new AI Agent.
function createNewAgent() {
  // The Q table is a (States X Actions) matrix;
  qTable = new Array(QSTATES);
  for (var i = 0; i < QSTATES; i++) {
    qTable[i] = new Array(MOVES);
    for (var j = 0; j < MOVES; j++) {
      // Initialize to a random number, so our current policy is something at least...
      qTable[i][j] = Math.floor(Math.random() * MOVES);
    }
  }
  trainingRound = 0;
  weights = new Array(NRFEATURES).fill(1.0);
}

// Read an old agent from file.
function fetchOldAgent(agentToUse) {
  // Read agents from file, nr 0 should be the best!
  //qTable = readQFromFile(agentToUse);
  //trainingRound = readRoundFromFile(agentToUse);
  //weights = ...
}

// Initialize the AI agent.
function initAgent(trainAI, maze, ballInitPos, mazeDimension) {
  // Set parameters for this iteration.
  isTraining = trainAI;
  goalPos = new THREE.Vector2(mazeDimension-1, mazeDimension - 2);
  currentPos.copy(ballInitPos);
  currentMaze = maze.map(arr => {
    return arr.slice();
  });

  // Create a maze-sized matrix defining if we've visited a position before.
  visitedMaze = new Array(mazeDimension);
  for (var i = 0; i < mazeDimension; i++) {
    visitedMaze[i] = new Array(mazeDimension).fill(false);
  }
  visitedMaze[ballInitPos.x][ballInitPos.y] = true;

  // Calculate new features and set starting state.
  features = new Array(NRFEATURES).fill(1.0);
  calculateFeatures(currentPos);
  earlierDistance = currentPos.distanceToManhattan(goalPos);
  currentState = getStateFromFeatures(features);
}

// Return current training round.
function getTrainingRound() {
  return trainingRound;
}

// Return the next move, either according to current policy or explore the space with a random move.
function getNextAIStep() {
  // Q-learning algorithm:
  // 1 - Pick a state, action (s,a) transition.
  // 2 - Make the transition from (s,a) -> s'
  // 3 - Receive reward r
  // 4 - Update Q(s,a) <- (1-alpha) Q(s,a) + alpha*(r + gamma* max Q(s',a'))

  // Save current position until we can find a valid move.
  var tempPos = new THREE.Vector2();
  tempPos.copy(currentPos);

  // Return position only if move didn't bring us into a wall. But update Q-table for the other scenarios as well.
  do {
    // Reset position.
    currentPos.copy(tempPos);

    // If we are training then use the exploration/exploitation rule. Else always move according to policy.
    if (isTraining) {
      if (Math.random() < explorationRate) {
        // Take a random move.
        var moveIdx = Math.floor(Math.random() * MOVES);
      } else {
        // Move according to current policy.
        var moveIdx = getBestMove(currentState);
      }

      // Make the move, calculate new features and current state and update the Q-table accordingly.
      currentPos.add(actions[moveIdx]);
      calculateFeatures(currentPos);
      currentState = getStateFromFeatures(features);
      updateQTable(currentState, moveIdx, currentPos);
    } else {
      // Get next move according to current policy.
      var moveIdx = getBestMove(currentState);
      currentPos.add(actions[moveIdx]);
      calculateFeatures(currentPos);
      currentState = getStateFromFeatures(features);
    }
  } while (!isValidMove(currentPos));

  // Update visited matrix
  visitedMaze[currentPos.x][currentPos.y] = true;
  return actions[moveIdx];
}

// This game ended, use final score to update table
function roundEnded(energyLeft) {
  var energyScore = energyLeft; // TODO: Use this?
  trainingRound++;
}

// Save current agent to file.
function saveAgent() {
  if (qTable != undefined) {
    // TODO: Save Q-table and training round to file

    // Return index where current agent was saved
    var index = 1;
    return index;
  } else {
    return -1;
  }
}

/**
 * PRIVATE FUNCTIONS
 */

// Calculate the Q-value for this state.
// TODO: Use!?
function calcQValue(state, action) {
  var Q = 0;
  for (var i = 0; i < NRFEATURES; i++) {
    Q += weights[i] * features[i];
  }
  return Q;
}

// Update the Q-value for this state and move: Q(s,a).
function updateQTable(state, actionIdx, pos) {
  // Calculate optimal Q-value for a new move from this state.
  var qValues = actions.map((dir, index) => {
    return qTable[state][index];
  });
  var maxQ = Math.max(...qValues);

  // Update Q-value for this state & action!
  qTable[state][actionIdx] =
    (1 - learningRate) * qTable[state][actionIdx] +
    learningRate * (getReward(pos) + gamma * maxQ);
}

// Returns the index of the best move for this set of features (e.g. state).
function getBestMove(state) {
  var values = actions.map((dir, idx, arr) => {
    return qTable[state][idx];
  });
  var max = -Infinity;
  var bestIndex = -1;
  values.forEach((val, idx) => {
    if (max < val) {
      max = val;
      bestIndex = idx;
    }
  });
  return bestIndex;
}

// Return true if this was a valid move (i.e. didn't bring us into a wall).
function isValidMove(pos) {
  if (pos.equals(goalPos) || currentMaze[pos.x][pos.y] != 2) {
    return true;
  } else {
    return false;
  }
}

// Returns the reward of this position.
function getReward(pos) {
  // Check if we've reached the goal.
  if (pos.equals(goalPos)) {
    // TODO: Use distanceTo istället?
    return 100;
  } else if (
    pos.x < 1 ||
    pos.x >= currentMaze.length - 1 ||
    pos.y < 1 ||
    pos.y >= currentMaze.length - 1
  ) {
    return -100;
  }

  // Otherwise check what material we have in new position.
  var value = currentMaze[pos.x][pos.y];
  switch (value) {
    case 0:
      // Empty road
      return -1;
    case 1:
      // Bush
      return -5;
    case 2:
      // Wall
      return -20;
  }
}

/**
 * UPDATE FUNCTIONS FOR FEATURES AND STATE
 */

// Returns the number of free squares in this direction.
function getFreeSquares(direction) {
  var free = 0;
  var newPos = new THREE.Vector2(currentPos.x, currentPos.y);
  // Check if we are at a border
  if (
    newPos.x < 1 ||
    newPos.x >= currentMaze.length - 1 ||
    newPos.y < 1 ||
    newPos.y >= currentMaze.length - 1
  ) {
    return 0;
  }
  newPos.add(direction);
  while (currentMaze[newPos.x][newPos.y] == 0 && newPos.x < currentMaze.length - 1) {
    free++;
    newPos.add(direction);
  }
  return free;
}

// Returns the material when there are no more free squares.
function getMaterialAtEnd(direction) {
  var newPos = new THREE.Vector2(currentPos.x, currentPos.y);
  // Check if we are at a border
  if (
    newPos.x < 1 ||
    newPos.x >= currentMaze.length - 1 ||
    newPos.y < 1 ||
    newPos.y >= currentMaze.length - 1
  ) {
    return 2;
  }
  do {
    newPos.add(direction);
  } while (currentMaze[newPos.x][newPos.y] == 0 && newPos.x < currentMaze.length - 1);
  return currentMaze[newPos.x][newPos.y];
}

// Returns true if the closet square in this direction has been visited before.
function getVisited(direction) {
  var newPos = new THREE.Vector2(currentPos.x, currentPos.y);
  // Check if we are at a border
  if (
    newPos.x < 1 ||
    newPos.x >= currentMaze.length - 1 ||
    newPos.y < 1 ||
    newPos.y >= currentMaze.length - 1
  ) {
    return false;
  }
  newPos.add(direction);
  return visitedMaze[newPos.x][newPos.y];
}

// Calculate euclidean distance to goal state.
function calcGoalDist(pos) {
  return pos.distanceToManhattan(goalPos);
}

// Calculate the feature values for this posiiton.
function calculateFeatures(pos) {
  var idx = 0;
  actions.forEach(dir => {
    features[idx++] = getFreeSquares(dir); // TODO: Combine these two!?
    features[idx++] = getMaterialAtEnd(dir); // TODO: Combine these two!?
    features[idx++] = getVisited(dir);
  });
  features[idx] = calcGoalDist(pos);
}

// Return the state index corresponding to this set of features.
function getStateFromFeatures(currentFeatures) {
  // Use a binary system, all features should be able to be classified binary.
  var stateIndex = 0;
  if (currentFeatures[0] > 0) stateIndex += 1; // Free spaces to the left
  if (currentFeatures[1] == 2) stateIndex += 2; // Brick at end
  if (currentFeatures[2]) stateIndex += 4; // Direction visited
  if (currentFeatures[3] > 0) stateIndex += 8; // Free spaces upwards
  if (currentFeatures[4] == 2) stateIndex += 16; // Brick at end
  if (currentFeatures[5]) stateIndex += 32; // Direction visited
  if (currentFeatures[6] > 0) stateIndex += 64; // Free spaces to the right
  if (currentFeatures[7] == 2) stateIndex += 128; // Brick at end
  if (currentFeatures[8]) stateIndex += 256; // Direction visited
  if (currentFeatures[9] > 0) stateIndex += 512; // Free spaces downwards
  if (currentFeatures[10] == 2) stateIndex += 1024; // Brick at end
  if (currentFeatures[11]) stateIndex += 2048; // Direction visited
  if (currentFeatures[12] < earlierDistance) stateIndex += 4096; // Do we increase or decrease the distance to goal?

  earlierDistance = currentFeatures[12];
  return stateIndex;
}
