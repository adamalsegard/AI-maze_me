/**
 * VARIABLE DECLARATION
 */
var trainingRound = 0,
  agentIndex = 0,
  allAgents = [],
  bestScore = 0,
  isTraining = undefined,
  qTable = undefined,
  features = undefined,
  currentMaze = [],
  visitedMaze = undefined,
  MOVES = 4,
  NRFEATURES = 13,
  QSTATES = Math.pow(2, NRFEATURES), // All combinations if features can be binary classified!
  gamma = 0.8, // Addition of next step to new Q-value.
  learningRate = 0.8, // This value will start high and then go small.
  explorationRate = 0.5, // This value will decrease over time.
  explorationRatePlay = 0.1,
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
  // The Q table is a (States X Actions) matrix.
  qTable = new Array(QSTATES);
  for (var i = 0; i < QSTATES; i++) {
    qTable[i] = new Array(MOVES);
    for (var j = 0; j < MOVES; j++) {
      qTable[i][j] = 0;
    }
  }
  trainingRound = 0;

  // Add new agent to collection and increase number of agents.
  agentIndex = allAgents.length;
  var newAgent = {
    id: agentIndex,
    trainingRound: trainingRound,
    bestScore: bestScore,
    qTable: qTable
  };
  allAgents.push(newAgent);
  console.log('Created agent: ' + agentIndex);
}

// Fetch all old agents from file and return number of agents.
function fetchOldAgents(callback) {
  $.getJSON('agents/allAgents.json', function(data) {
    // Store all agents locally.
    allAgents = data;
  }).done(() => {
    console.log('Fetched ' + allAgents.length + ' agents!');
    if (allAgents.length < 1) {
      createNewAgent();
    }
    callback(allAgents.length);
  });
}

// Use one of the stored agents.
function setOldAgent(agentToUse) {
  // Get requested agent.
  agentIndex = allAgents[agentToUse].id;
  trainingRound = allAgents[agentToUse].trainingRound;
  bestScore = allAgents[agentToUse].bestScore;
  qTable = allAgents[agentToUse].qTable;

  console.log('Fetched agent: ' + agentToUse);
}

// Initialize the AI agent.
function initAgent(trainAI, maze, ballInitPos, mazeDimension) {
  // Set parameters for this iteration.
  isTraining = trainAI;
  goalPos = new THREE.Vector2(mazeDimension - 1, mazeDimension - 2);
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
  earlierDistance = currentPos.distanceToManhattan(goalPos);
  calculateFeatures(currentPos);
  currentState = getStateFromFeatures(features);
}

// Return current training round.
function getTrainingRound() {
  return trainingRound;
}

// Return the next move, either according to current policy or explore the space with a random move.
function getNextAIStep() {
  // Q-learning algorithm:
  // 1 - Pick an action from current state => a (s,a) transition.
  // 2 - Make the transition from (s,a) -> s'
  // 3 - Receive reward r(s')
  // 4 - Update Q(s,a) <- (1-learningRate)*Q(s,a) + learningRate*(r(s') + gamma*max::Q(s',a'))

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

      // Update the Q-table according to chosen move.
      updateQTable(currentState, moveIdx, currentPos);

      // Make the move, calculate new features and new state.
      currentPos.add(actions[moveIdx]);
      calculateFeatures(currentPos);
      currentState = getStateFromFeatures(features);
    } else {
      // Use a random move from time to time so we don't find ourselves in an infinite loop.
      if (Math.random() < explorationRatePlay) {
        // Take a random move.
        var moveIdx = Math.floor(Math.random() * MOVES);
      } else {
        // Get next move according to current policy.
        var moveIdx = getBestMove(currentState);
      }
      currentPos.add(actions[moveIdx]);
      calculateFeatures(currentPos);
      currentState = getStateFromFeatures(features);
    }
  } while (!isValidMove(currentPos));

  // Update visited matrix and return move.
  visitedMaze[currentPos.x][currentPos.y] = true;
  earlierDistance = currentPos.distanceToManhattan(goalPos);
  return actions[moveIdx];
}

// This game ended, use final score to update table.
function roundEnded(energyLeft) {
  // Update agents best score.
  if (energyLeft > bestScore) {
    bestScore = energyLeft;
  }
  trainingRound++;

  // Save latest iteration of the agent.
  if (trainingRound % 100 == 0) {
    // Update learning and exploration rates
    learningRate = learningRate > 0.2 ? learningRate - 0.05 : learningRate;
    explorationRate =
      explorationRate > 0.1 ? explorationRate - 0.02 : explorationRate;
    saveAgent();
  }
}

// Save current agent to file.
function saveAgent() {
  if (qTable != undefined) {
    // Update agent before saving.
    allAgents[agentIndex].id = agentIndex;
    allAgents[agentIndex].trainingRound = trainingRound;
    allAgents[agentIndex].bestScore = bestScore;
    allAgents[agentIndex].qTable = qTable;

    // Sort agents based on score. Best comes first!
    // TODO: If this is done then we need to update index (of all agents!)
    /*allAgents.sort((a, b) => {
      return b.bestScore - a.bestScore;
    });
    console.log('Save agent as index: ' + agentIndex); */

    // Send all agents as a JSON and download file as <a>.
    var qTableJSON = JSON.stringify(allAgents);
    downloadObject(qTableJSON, 'allAgents.json', 'application/json');

    // Return index where current agent was saved (useful only if we sort => update agents' index...)
    return agentIndex;
  } else {
    return -1;
  }
}

/**
 * PRIVATE FUNCTIONS
 */

// Download JSON object as an <a> tag.
function downloadObject(text, name, type) {
  var a = document.createElement('a');
  var file = new Blob([text], { type: type });
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
}

// Update the Q-value for this state and move: Q(s,a).
function updateQTable(state, actionIdx, pos) {
  // Calculate s' (and thus the new position and features from this move).
  var nextPos = new THREE.Vector2();
  nextPos.copy(pos);
  nextPos.add(actions[actionIdx]);
  calculateFeatures(nextPos);
  var nextState = getStateFromFeatures(features);

  // Calculate optimal Q-value for a new move from this s' state.
  var qValues = actions.map((dir, index) => {
    return qTable[nextState][index];
  });
  var maxQ = Math.max(...qValues);

  // Update Q-value for this state & action, Q(s,a)! Round to 3 decimals.
  var oldValue = (1 - learningRate) * qTable[state][actionIdx];
  var newValue =
    learningRate *
    (getReward(nextPos) + getTransitionReward(nextPos) + gamma * maxQ);
  qTable[state][actionIdx] = Math.round(1000 * (oldValue + newValue)) / 1000;
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
  if (
    pos.x > 0 &&
    pos.x < currentMaze.length && // OBS: must be without '-1' so we can reach the goal!
    pos.y > 0 &&
    pos.y < currentMaze.length - 1 &&
    currentMaze[pos.x][pos.y] != 2
  ) {
    return true;
  } else {
    return false;
  }
}

// Returns the reward for this transition.
function getTransitionReward(pos) {
  var reward = 0;
  // Incooperate the difference to goal as reward.
  var dist = calcGoalDist(pos);
  var diff = earlierDistance - dist;
  reward += diff;

  if (
    pos.x < 1 ||
    pos.x >= currentMaze.length - 1 ||
    pos.y < 1 ||
    pos.y >= currentMaze.length - 1
  ) {
    return reward;
  }

  // Get bonus if we explore an unvisited state.
  if (!visitedMaze[pos.x][pos.y]) {
    reward += 5;
  }

  return reward;
}

// Returns the reward of this position.
function getReward(pos) {
  // Check if we've reached the goal.
  if (pos.equals(goalPos)) {
    console.log('Reached goal!');
    return 100;
  } else if (
    pos.x < 1 ||
    pos.x >= currentMaze.length - 1 ||
    pos.y < 1 ||
    pos.y >= currentMaze.length - 1
  ) {
    // Still needed because we update the table for invalid moves as well.
    return -50;
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
      return -50;
  }
}

/**
 * UPDATE FUNCTIONS FOR FEATURES AND STATE
 */

// Returns the number of free squares in this direction.
function getFreeSquares(direction, pos) {
  var free = 0;
  var newPos = new THREE.Vector2(pos.x, pos.y);
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
  while (
    newPos.x < currentMaze.length - 1 &&
    currentMaze[newPos.x][newPos.y] == 0
  ) {
    free++;
    newPos.add(direction);
  }
  return free;
}

// Returns the material when there are no more free squares.
function getMaterialAtEnd(direction, pos) {
  var newPos = new THREE.Vector2(pos.x, pos.y);
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
  } while (
    newPos.x < currentMaze.length - 1 &&
    currentMaze[newPos.x][newPos.y] == 0
  );
  return currentMaze[newPos.x][newPos.y];
}

// Returns true if the closet square in this direction has been visited before.
function getVisited(direction, pos) {
  var newPos = new THREE.Vector2(pos.x, pos.y);
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

// Return the euclidean distance to goal state.
function calcGoalDist(pos) {
  return pos.distanceToManhattan(goalPos);
}

// Calculate the feature values for this posiiton.
function calculateFeatures(pos) {
  var idx = 0;
  actions.forEach(dir => {
    features[idx++] = getFreeSquares(dir, pos);
    features[idx++] = getMaterialAtEnd(dir, pos);
    features[idx++] = getVisited(dir, pos);
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

  return stateIndex;
}
