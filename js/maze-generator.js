// Recursive method to iterate through the maze
function iterate(field, visitedCells, x, y) {
  // Set 
  visitedCells[x][y] = true;
  betaDist = Math.pow(Math.sin(Math.random() * Math.PI / 2), 2);
  beta_left = (betaDist < 0.5) ? 2*betaDist : 2*(1-betaDist);
  beta_right = (betaDist > 0.5) ? 2*betaDist-1 : 2*(1-betaDist)-1;
  field[x][y] = Math.floor(beta_left * nrOfDifferentMaterials);
  while (true) {
    directions = [];
    if (x > 1 && !visitedCells[x-1][y]) {
      directions.push([-1, 0]);
    }
    if (x < field.dimension-2 && !visitedCells[x+1][y]) {
      directions.push([1, 0]);
    }
    if (y > 1 && !visitedCells[x][y-1]) {
      directions.push([0, -1]);
    }
    if (y < field.dimension-2 && !visitedCells[x][y+1]) {
      directions.push([0, 1]);
    }
    if (directions.length == 0) {
      field[1][1] = 0;
      field[field.dimension - 1][field.dimension - 2] = 0;
      return field;
    }
    // Take random direction
    dir = directions[Math.floor(Math.random() * directions.length)];
    //field[x + dir[0]][y + dir[1]] = Math.floor(Math.random() * nrOfDifferentMaterials);
    field = iterate(field, visitedCells, x + dir[0], y + dir[1]);
  }
}   

function generateSquareMaze(dimension) {
  var nrOfDifferentMaterials = 2;
  // Initialize the field.
  var field = new Array(dimension);
  var visitedCells = new Array(dimension);
  field.dimension = dimension;
  for (var i = 0; i < dimension; i++) {
    field[i] = new Array(dimension);
    visitedCells[i] = new Array(dimension);
    for (var j = 0; j < dimension; j++) {
      // Initialize entire field as bricks
      field[i][j] = nrOfDifferentMaterials;
      visitedCells[i][j] = false;
    }
  }

  // Gnerate the maze recursively.
  field = iterate(field, visitedCells, 1, 1);

  return field;
}
