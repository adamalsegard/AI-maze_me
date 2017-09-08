// file:"index.html"
// Vertex shader

const vsSource = '
  attribute vec4 aPosition;

  uniform mat4 uMV;
  uniform mat4 uP;

  void main()  {
    gl_Position = uP * uMV * aPosition;
  }
  ';