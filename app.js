let rotationMatrix = mat4.create();
let dragging = false;
let lastMouseX = null;
let lastMouseY = null;
let zoomDistance = -6.0; // Default zoom distance
let triangleColor = [1.0, 1.0, 1.0, 1.0]; // White color for triangles
let lineColor = [0.0, 0.0, 0.0, 1.0]; // Black color for lines

function main() {
    const canvas = document.getElementById("glCanvas");
    const zoomSlider = document.getElementById("zoomSlider");
    const changeColorButton = document.getElementById("changeColorButton");
    const gl = canvas.getContext("webgl");

    if (!gl) {
        console.error("Unable to initialize WebGL. Your browser may not support it.");
        return;
    }

    // Ensure the canvas is resized to fit the screen
    resizeCanvasToDisplaySize(gl.canvas);

    // Initialize the shaders
    let shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    let lineShaderProgram = initShaderProgram(gl, vertexShaderSource, lineFragmentShaderSource);

    let programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        },
    };

    let lineProgramInfo = {
        program: lineShaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(lineShaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(lineShaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(lineShaderProgram, 'uModelViewMatrix'),
        },
    };

    // Define the basic vertices of a tetrahedron
    const vertices = [
        [0.0, 0.0, 1.0],
        [0.0, 0.942809, -0.333333],
        [-0.816497, -0.471405, -0.333333],
        [0.816497, -0.471405, -0.333333],
    ];

    const indices = [
        [0, 1, 2],
        [3, 2, 1],
        [0, 3, 1],
        [0, 2, 3]
    ];

    let positions = [];
    let linePositions = [];

    // Recursive subdivision function
    function divideTriangle(a, b, c, count) {
        if (count > 0) {
            const ab = normalize(mix(a, b, 0.5));
            const ac = normalize(mix(a, c, 0.5));
            const bc = normalize(mix(b, c, 0.5));

            divideTriangle(a, ab, ac, count - 1);
            divideTriangle(ab, b, bc, count - 1);
            divideTriangle(bc, c, ac, count - 1);
            divideTriangle(ab, bc, ac, count - 1);
        } else {
            positions.push(...a, ...b, ...c);
            linePositions.push(...a, ...b, ...b, ...c, ...c, ...a);
        }
    }

    function normalize(v) {
        const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
        return v.map(x => x / len);
    }

    function mix(a, b, t) {
        return [
            (1 - t) * a[0] + t * b[0],
            (1 - t) * a[1] + t * b[1],
            (1 - t) * a[2] + t * b[2]
        ];
    }

    // Subdivide the tetrahedron
    const subdivisionLevel = 4; // You can change this level to increase or decrease detail
    for (const triangle of indices) {
        divideTriangle(vertices[triangle[0]], vertices[triangle[1]], vertices[triangle[2]], subdivisionLevel);
    }

    // Create buffers for the positions and lines
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linePositions), gl.STATIC_DRAW);

    // Define the projection matrix
    const fieldOfView = 45 * Math.PI / 180;   // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // Set the viewport to match the canvas size
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Mouse event handlers
    canvas.addEventListener('mousedown', handleMouseDown, false);
    canvas.addEventListener('mouseup', handleMouseUp, false);
    canvas.addEventListener('mousemove', handleMouseMove, false);

    // Zoom slider event handler
    zoomSlider.addEventListener('input', handleZoom, false);

    // Change color button handler
    changeColorButton.addEventListener('click', handleChangeColors, false);

    function handleMouseDown(event) {
        dragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }

    function handleMouseUp(event) {
        dragging = false;
    }

    function handleMouseMove(event) {
        if (!dragging) return;

        const newX = event.clientX;
        const newY = event.clientY;

        const deltaX = newX - lastMouseX;
        const deltaY = newY - lastMouseY;

        // Adjust rotation based on mouse movement
        const newRotationMatrix = mat4.create();
        mat4.rotate(newRotationMatrix, newRotationMatrix, glMatrix.toRadian(deltaX / 4), [0, 1, 0]);
        mat4.rotate(newRotationMatrix, newRotationMatrix, glMatrix.toRadian(deltaY / 4), [1, 0, 0]);

        // Apply the rotation to the existing rotationMatrix
        mat4.multiply(rotationMatrix, newRotationMatrix, rotationMatrix);

        lastMouseX = newX;
        lastMouseY = newY;

        drawScene(gl, programInfo, lineProgramInfo, positionBuffer, lineBuffer, positions.length / 3, linePositions.length / 3, projectionMatrix);
    }

    function handleZoom(event) {
        // Convert slider value to zoom distance
        zoomDistance = -1 * (event.target.value / 10);
        drawScene(gl, programInfo, lineProgramInfo, positionBuffer, lineBuffer, positions.length / 3, linePositions.length / 3, projectionMatrix);
    }

    function handleChangeColors() {
        // Generate random colors for triangles and lines
        triangleColor = [Math.random(), Math.random(), Math.random(), 1.0];
        lineColor = [Math.random(), Math.random(), Math.random(), 1.0];

        // Update the fragment shaders with new colors
        fragmentShaderSource = `
            precision mediump float;
            void main(void) {
                gl_FragColor = vec4(${triangleColor[0]}, ${triangleColor[1]}, ${triangleColor[2]}, ${triangleColor[3]});
            }
        `;

        lineFragmentShaderSource = `
            precision mediump float;
            void main(void) {
                gl_FragColor = vec4(${lineColor[0]}, ${lineColor[1]}, ${lineColor[2]}, ${lineColor[3]});
            }
        `;

        // Reinitialize shaders with new colors
        shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
        lineShaderProgram = initShaderProgram(gl, vertexShaderSource, lineFragmentShaderSource);

        // Update programInfo and lineProgramInfo with new shader programs
        programInfo = {
            program: shaderProgram,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            },
            uniformLocations: {
                projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            },
        };

        lineProgramInfo = {
            program: lineShaderProgram,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(lineShaderProgram, 'aVertexPosition'),
            },
            uniformLocations: {
                projectionMatrix: gl.getUniformLocation(lineShaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: gl.getUniformLocation(lineShaderProgram, 'uModelViewMatrix'),
            },
        };

        drawScene(gl, programInfo, lineProgramInfo, positionBuffer, lineBuffer, positions.length / 3, linePositions.length / 3, projectionMatrix);
    }

    // Initial draw
    drawScene(gl, programInfo, lineProgramInfo, positionBuffer, lineBuffer, positions.length / 3, linePositions.length / 3, projectionMatrix);

    // Handle window resize
    window.addEventListener('resize', () => {
        resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        mat4.perspective(projectionMatrix, fieldOfView, gl.canvas.clientWidth / gl.canvas.clientHeight, zNear, zFar);
        drawScene(gl, programInfo, lineProgramInfo, positionBuffer, lineBuffer, positions.length / 3, linePositions.length / 3, projectionMatrix);
    });
}

function resizeCanvasToDisplaySize(canvas) {
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width  !== displayWidth || canvas.height !== displayHeight) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
    }
}

const vertexShaderSource = `
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
`;

let fragmentShaderSource = `
    precision mediump float;

    void main(void) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // Initial white color for triangles
    }
`;

let lineFragmentShaderSource = `
    precision mediump float;

    void main(void) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Initial black color for lines
    }
`;

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function drawScene(gl, programInfo, lineProgramInfo, positionBuffer, lineBuffer, vertexCount, lineVertexCount, projectionMatrix) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);   // Clear to black, fully opaque
    gl.clearDepth(1.0);                  // Clear everything
    gl.enable(gl.DEPTH_TEST);            // Enable depth testing
    gl.depthFunc(gl.LEQUAL);             // Near things obscure far things

    // Clear the canvas before we start drawing on it
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Create the model-view matrix
    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, zoomDistance]); // Use zoomDistance for zooming
    mat4.multiply(modelViewMatrix, modelViewMatrix, rotationMatrix);             // Apply rotation

    // Draw the filled triangles
    gl.useProgram(programInfo.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        3, // Pull out 3 values per iteration
        gl.FLOAT, // The data in the buffer is 32bit floats
        false, // Don't normalize
        0, // How many bytes to get from one set of values to the next
        0 // How many bytes inside the buffer to start from
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    // Set the shader uniforms for filled triangles
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    // Draw the triangle edges
    gl.useProgram(lineProgramInfo.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.vertexAttribPointer(
        lineProgramInfo.attribLocations.vertexPosition,
        3, // Pull out 3 values per iteration
        gl.FLOAT, // The data in the buffer is 32bit floats
        false, // Don't normalize
        0, // How many bytes to get from one set of values to the next
        0 // How many bytes inside the buffer to start from
    );
    gl.enableVertexAttribArray(lineProgramInfo.attribLocations.vertexPosition);

    // Set the shader uniforms for lines
    gl.uniformMatrix4fv(
        lineProgramInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix);
    gl.uniformMatrix4fv(
        lineProgramInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix);

    gl.drawArrays(gl.LINES, 0, lineVertexCount);
}

// Start the WebGL application
main();