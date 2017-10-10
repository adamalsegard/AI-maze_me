// Define how many materials we'll use for the maze
// Remember to change in mai-game as well!
var nrOfDifferentMaterials = 2;

// Recursive method to iterate through the maze.
function iterate(field, visitedCells, x, y, startPos, startPosVS, goalPos) {
  // Set this cell as visited.
  visitedCells[x][y] = true;

  // Beta distribution with left weight.
  betaDist = Math.pow(Math.sin(Math.random() * Math.PI / 2), 2);
  beta_left = (betaDist < 0.5) ? 2*betaDist : 2*(1-betaDist);
  beta_right = (betaDist > 0.5) ? 2*betaDist-1 : 2*(1-betaDist)-1;

  // Use left distribution and floor rounding to make sure we have a solution.
  field[x][y] = Math.floor(beta_left * nrOfDifferentMaterials);
  while (true) {
    directions = [];
    if (x > 1 && !visitedCells[x-2][y]) {
      directions.push([-1, 0]);
    }
    if (x < field.dimension-2 && !visitedCells[x+2][y]) {
      directions.push([1, 0]);
    }
    if (y > 1 && !visitedCells[x][y-2]) {
      directions.push([0, -1]);
    }
    if (y < field.dimension-2 && !visitedCells[x][y+2]) {
      directions.push([0, 1]);
    }
    if (directions.length == 0) {
      // Randomized start and exit points. 
      field[startPos.x][startPos.y] = 0;
      field[startPosVS.x][startPosVS.y] = 0;
      field[goalPos.x][goalPos.y] = 0;
      return field;
    }

    // Take a random (possible) direction and use floor(beta_left) to remove the wall in between.
    dir = directions[Math.floor(Math.random() * directions.length)];
    field[x + dir[0]][y + dir[1]] = Math.floor(beta_left * nrOfDifferentMaterials); 
    field = iterate(field, visitedCells, x + dir[0]*2, y + dir[1]*2, startPos, startPosVS, goalPos);
  }
}   

// Public method to generate a solvable maze.
function generateSquareMaze(dimension, startPos, startPosVS, goalPos) {
  // Initialize the field.
  var field = new Array(dimension);
  var visitedCells = new Array(dimension);
  field.dimension = dimension;
  for (var i = 0; i < dimension; i++) {
    field[i] = new Array(dimension);
    visitedCells[i] = new Array(dimension);
    for (var j = 0; j < dimension; j++) {
      if(i == 0 || j == 0 || i == dimension-1 || j == dimension-1){
        // Initialize outer border as bricks.
        field[i][j] = nrOfDifferentMaterials;
        visitedCells[i][j] = false;
      }
      else {
        // Use right distribution and ceil for 'wall' segments.
        betaDist = Math.pow(Math.sin(Math.random() * Math.PI / 2), 2);
        beta_right = (betaDist > 0.5) ? 2*betaDist-1 : 2*(1-betaDist)-1;
        field[i][j] = Math.ceil(beta_right * nrOfDifferentMaterials);
        visitedCells[i][j] = false;
      }
      
    }
  }

  // Gnerate the maze recursively.
  field = iterate(field, visitedCells, 1, 1, startPos, startPosVS, goalPos);

  return field;
}
