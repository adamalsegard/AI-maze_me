//
// VERTEX SHADER
//
const vertGLSL = `
attribute vec4 aPosition;

uniform mat4 uMV;
uniform mat4 uP;

void main()  {
  gl_Position = uP * uMV * aPosition;
}`;

//
// FRAGMENT SHADER
//
const fragGLSL = `
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}`;

//
// MAIN GAME LOOP
//
main();

function main() {
  // Get canvas and initialize GL context
  const canvas = document.querySelector('#glCanvas');
  const gl = canvas.getContext('webgl');

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser may not support it.');
    return;
  }

  // Create shaders
  const shaderProgram = initShaderProgram(gl, vertGLSL, fragGLSL)

  // Define shader locations
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uP'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uMV'),
    },
  };

  // Clear buffers
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

//
// INIT SHADERS
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create shader program
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);

  if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

// Help function to load a shader of specified type
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('Unable to compile shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}
