"use strict";
// Get the canvas and status message from the HTML page.
const canvas = document.getElementById("gl-canvas");
const statusText = document.getElementById("status");
// Start WebGL2.
const gl = canvas.getContext("webgl2", {
    antialias: true,
    alpha: false
});
// Check if WebGL2 works.
if (!gl) {
    statusText.textContent = "WebGL2 is not available. Try Chrome or Safari.";
    throw new Error("WebGL2 context could not be created.");
}
// Load the shaders from index.html.
const program = initShaders(gl, "vertex-shader", "fragment-shader");

if (!program || program === -1) {
    statusText.textContent = "Shader compilation failed.";
    throw new Error("Could not create shader program.");
}
gl.useProgram(program);
// Get the shader variables.
const locations = {
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
    model: gl.getUniformLocation(program, "uModel"),
    view: gl.getUniformLocation(program, "uView"),
    projection: gl.getUniformLocation(program, "uProjection"),
    color: gl.getUniformLocation(program, "uColor"),
    light: gl.getUniformLocation(program, "uLightDirection"),
    eye: gl.getUniformLocation(program, "uEyePosition"),
    night: gl.getUniformLocation(program, "uNight")
};
// These functions help place and move 3D objects.
// Create a basic matrix.
function identity() {
    return new Float32Array([
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    ]);
}
// Multiply two matrices together.
function multiply(a, b) {
    const out = new Float32Array(16);

    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            out[c*4+r] =
                a[r]*b[c*4] +
                a[4+r]*b[c*4+1] +
                a[8+r]*b[c*4+2] +
                a[12+r]*b[c*4+3];
        }
    }

    return out;
}
// Move an object to a new position.
function translation(x,y,z) {
    const m = identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
}
// Change the size of an object.
function scaling(x,y,z) {
    const m = identity();
    m[0] = x;
    m[5] = y;
    m[10] = z;
    return m;
}
// Set the position and size of an object.
function modelMatrix(x,y,z,sx,sy,sz) {
    return multiply(
        translation(x,y,z),
        scaling(sx,sy,sz)
    );
}
// Turn and size the wheels.
function wheelMatrix(x,y,z) {
    const a = Math.PI/2;
    const c = Math.cos(a);
    const s = Math.sin(a);

    const rz = new Float32Array([
        c,s,0,0,
        -s,c,0,0,
        0,0,1,0,
        0,0,0,1
    ]);

    return multiply(
        multiply(translation(x,y,z),rz),
        scaling(.42,.42,.18)
    );
}
// Make far objects look smaller.
function perspective(fovy, aspect, near, far) {
    const f = 1/Math.tan(fovy/2);
    const nf = 1/(near-far);
    const out = new Float32Array(16);

    out[0] = f/aspect;
    out[5] = f;
    out[10] = (far+near)*nf;
    out[11] = -1;
    out[14] = 2*far*near*nf;

    return out;
}
// Make a vector have a length of 1.
function normalize(v) {
    const n = Math.hypot(v[0],v[1],v[2]) || 1;
    return [v[0]/n,v[1]/n,v[2]/n];
}
// Subtract one vector from another.
function subtract(a,b) {
    return [
        a[0]-b[0],
        a[1]-b[1],
        a[2]-b[2]
    ];
}
// Find the camera's directions.
function cross(a,b) {
    return [
        a[1]*b[2]-a[2]*b[1],
        a[2]*b[0]-a[0]*b[2],
        a[0]*b[1]-a[1]*b[0]
    ];
}
// Set the camera position and where it looks.
function lookAt(eye,target,up) {
    const z = normalize(subtract(eye,target));
    const x = normalize(cross(up,z));
    const y = cross(z,x);

    return new Float32Array([
        x[0],y[0],z[0],0,
        x[1],y[1],z[1],0,
        x[2],y[2],z[2],0,
        -x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2],
        -y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2],
        -z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2],1
    ]);
}
// Create the basic 3D shapes.
// Send shape data to the GPU.
function makeMesh(vertices) {
    const positions = [];
    const normals = [];
    // Save the position and normal of each vertex.
    for (const v of vertices) {
        positions.push(v[0],v[1],v[2]);
        normals.push(v[3],v[4],v[5]);
    }
    // Create a place to store the vertex data.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    // Send the position data to the GPU.
    const pbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,pbo);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
    );

    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(
        locations.position,3,gl.FLOAT,false,0,0
    );
    // Send the normal data to the GPU.
    const nbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,nbo);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(normals),
        gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(locations.normal);
    gl.vertexAttribPointer(
        locations.normal,3,gl.FLOAT,false,0,0
    );
    gl.bindVertexArray(null);
    return {
        vao,
        count: positions.length/3
    };
}
// Make one square using two triangles.
function addFace(out,a,b,c,d,n) {
    const pts = [a,b,c,a,c,d];

    for (const p of pts) {
        out.push([
            p[0],p[1],p[2],
            n[0],n[1],n[2]
        ]);
    }
}
// Create a cube with six faces.
function createCube() {
    const v = [];

    addFace(v,[-.5,-.5,.5],[.5,-.5,.5],
        [.5,.5,.5],[-.5,.5,.5],[0,0,1]);

    addFace(v,[.5,-.5,-.5],[-.5,-.5,-.5],
        [-.5,.5,-.5],[.5,.5,-.5],[0,0,-1]);

    addFace(v,[-.5,-.5,-.5],[-.5,-.5,.5],
        [-.5,.5,.5],[-.5,.5,-.5],[-1,0,0]);

    addFace(v,[.5,-.5,.5],[.5,-.5,-.5],
        [.5,.5,-.5],[.5,.5,.5],[1,0,0]);

    addFace(v,[-.5,.5,.5],[.5,.5,.5],
        [.5,.5,-.5],[-.5,.5,-.5],[0,1,0]);

    addFace(v,[-.5,-.5,-.5],[.5,-.5,-.5],
        [.5,-.5,.5],[-.5,-.5,.5],[0,-1,0]);

    return makeMesh(v);
}
// Create a sphere using many small triangles.
function createSphere(rows=12,cols=16) {
    const v = [];

    for (let i=0;i<rows;i++) {
        const t0 = Math.PI*i/rows;
        const t1 = Math.PI*(i+1)/rows;

        for (let j=0;j<cols;j++) {
            const p0 = 2*Math.PI*j/cols;
            const p1 = 2*Math.PI*(j+1)/cols;

            // Find points on the sphere.
            const point = (t,p) => [
                Math.sin(t)*Math.cos(p),
                Math.cos(t),
                Math.sin(t)*Math.sin(p)
            ];

            const a = point(t0,p0);
            const b = point(t1,p0);
            const c = point(t1,p1);
            const d = point(t0,p1);

            // Add the triangles.
            for (const q of [a,b,c,a,c,d]) {
                v.push([q[0],q[1],q[2],q[0],q[1],q[2]]);
            }
        }
    }

    return makeMesh(v);
}
// Create a cylinder using small triangles.
function createCylinder(segments=14) {
    const v = [];

    for (let i=0;i<segments;i++) {
        const a = i*2*Math.PI/segments;
        const b = (i+1)*2*Math.PI/segments;

        const p0 = [Math.cos(a),-.5,Math.sin(a)];
        const p1 = [Math.cos(b),-.5,Math.sin(b)];
        const p2 = [Math.cos(b),.5,Math.sin(b)];
        const p3 = [Math.cos(a),.5,Math.sin(a)];

        const n0 = normalize([Math.cos(a),0,Math.sin(a)]);
        const n1 = normalize([Math.cos(b),0,Math.sin(b)]);

        // Make the curved side of the cylinder.
        for (const q of [
            [p0,n0],[p1,n1],[p2,n1],
            [p0,n0],[p2,n1],[p3,n0]
        ]) {
            v.push([...q[0],...q[1]]);
        }

        // Add the top and bottom.
        const top = [0,.5,0];
        const bot = [0,-.5,0];

        for (const q of [
            [top,p3,p2],[top,p2,p1],
            [bot,p1,p0],[bot,p0,p3]
        ]) {
            const normal = q[0]===top
                ? [0,1,0] : [0,-1,0];

            for (const p of q) {
                v.push([...p,...normal]);
            }
        }
    }

    return makeMesh(v);
}
// Create the shapes once so we can use them many times.
const cube = createCube();
const sphere = createSphere();
const cylinder = createCylinder();
// Use the shapes to build the city.
const objects = [];
// Add a box to the city.
function box(x,y,z,sx,sy,sz,color,mesh=cube) {
    objects.push({
        mesh,
        matrix:modelMatrix(x,y,z,sx,sy,sz),
        color
    });
}
// Add a ball to the city.
function ball(x,y,z,sx,sy,sz,color) {
    box(x,y,z,sx,sy,sz,color,sphere);
}
// Add a pole to the city.
function pole(x,y,z,height,radius,color) {
    box(x,y,z,radius,height,radius,color,cylinder);
}
// Colours used for the city objects.
const C = {
    asphalt:[.16,.19,.21,1],
    sidewalk:[.60,.59,.54,1],
    concrete:[.66,.67,.65,1],
    white:[.90,.91,.86,1],
    yellow:[.98,.73,.12,1],
    glass:[.20,.48,.62,1],
    darkGlass:[.09,.22,.31,1],
    brick:[.56,.31,.23,1],
    cream:[.76,.69,.55,1],
    grey:[.47,.51,.53,1],
    blue:[.27,.43,.56,1],
    green:[.12,.34,.18,1],
    leaf:[.17,.43,.20,1],
    trunk:[.28,.17,.10,1],
    red:[.72,.12,.09,1],
    black:[.045,.055,.06,1],
    metal:[.28,.31,.32,1],
    sky:[.55,.78,.94,1]
};
// Create the road and sidewalks.
box(0,-.32,-19,42,.5,70,[.31,.48,.30,1]);
box(0,-.04,-18,10,.12,66,C.asphalt);
box(-6.1,.02,-18,2.2,.22,66,C.sidewalk);
box(6.1,.02,-18,2.2,.22,66,C.sidewalk);
box(-7.55,-.02,-18,.18,.16,66,C.concrete);
box(7.55,-.02,-18,.18,.16,66,C.concrete);
// Add the yellow lines in the middle of the road.
for(let z=7;z>-50;z-=5) {
    box(0,.035,z,.13,.025,2.5,C.yellow);
}
// Add the white lines near the crossing.
for(let i=-3;i<=3;i++) {
    box(i*.55,.04,3,.34,.025,1.6,C.white);
}
// Create the buildings and their windows.
const buildingColors = [
    C.cream,C.grey,C.brick,C.blue,
    [.70,.72,.69,1],[.49,.39,.31,1]
];
// Build one building.
function addBuilding(x,z,w,h,d,color,index) {
    // Main part of the building.
    box(x,h/2,z,w,h,d,color);
    // Top of the building.
    box(x,h+.08,z,w+.16,.16,d+.16,[.34,.37,.38,1]);
    // Small room on the roof.
    box(x+.45,h+.65,z-.5,w*.25,1.1,d*.22,[.40,.43,.44,1]);
    const front = z+d/2+.015;
    const cols = Math.max(2,Math.floor(w/1.05));
    const rows = Math.max(2,Math.floor(h/1.35));
    // Add windows to the front of the building.
    for(let r=0;r<rows;r++) {
        for(let c=0;c<cols;c++) {
            const wx = x-w/2+(c+.5)*w/cols;
            const wy = .75+r*(h-.9)/rows;

            box(wx,wy,front,.48,.66,.035,
                (r+c+index)%4===0 ? C.darkGlass : C.glass);

            // Add a small window frame.
            box(wx,wy+.36,front+.025,.5,.055,.045,
                [.28,.30,.31,1]);
        }
    }
    // Add windows to the side of the building.
    const side = x+(x<0?w/2+.02:-w/2-.02);
    for(let r=0;r<rows;r++) {
        for(let c=0;c<3;c++) {
            const wz = z-d/2+.9+c*(d-1.8)/2;
            box(side,.8+r*(h-.9)/rows,wz,
                .035,.62,.52,C.glass);
        }
    }
}
// Set the positions and sizes of the buildings.
const positions = [
    [-9,-1,5,13,7],
    [-9,-14,5,18,8],
    [-9,-30,5,23,8],
    [-9,-46,5,16,8],
    [9,-2,5,17,7],
    [9,-17,5,12,8],
    [9,-32,5,21,8],
    [9,-48,5,18,8],
    [-15,-12,5,22,9],
    [15,-23,5,25,9]
];
// Add all the buildings.
positions.forEach((p,i) => {
    addBuilding(
        p[0],p[1],p[2],p[3],p[4],
        buildingColors[i%buildingColors.length],i
    );
});
// Add shops on both sides of the road.
for(const side of [-1,1]) {
    for(let z of [-3,-15,-29,-43]) {
        const x = side*8.95;

        box(x,.85,z,1.0,1.7,3.4,[.27,.34,.36,1]);
        box(x,.25,z+1.72,1.05,.22,3.55,[.75,.31,.13,1]);
        box(x,.65,z+1.74,1.08,.12,3.55,[.88,.78,.55,1]);
    }
}
// Create trees using trunks and leaves.
for(const side of [-1,1]) {
    for(let z of [5,-7,-19,-31,-43]) {
        const x = side*6.35;

        // Tree trunk and leaves.
        pole(x,1.15,z,2.3,.28,C.trunk);
        ball(x,2.65,z,1.65,2.0,1.55,C.leaf);
        ball(x-.55,2.35,z+.2,1.1,1.3,1.0,[.19,.46,.22,1]);
        ball(x+.5,2.4,z-.2,1.05,1.3,1.0,[.14,.38,.18,1]);
    }
}
// Create the poles and lights.
for(const side of [-1,1]) {
    for(let z of [8,-12,-32,-48]) {
        const x = side*5.15;

        pole(x,2.1,z,4.2,.12,C.metal);
        box(x-side*.65,4.15,z,.95,.12,.15,C.metal);
        ball(x-side*1.05,4.05,z,.42,.2,.35,[1,.91,.63,1]);
    }
}
// Create the red, yellow and green lights.
for(const side of [-1,1]) {
    const x = side*4.6;

    pole(x,1.8,1.5,3.6,.12,C.metal);
    box(x,3.15,1.5,.42,.95,.38,C.black);

    ball(x,3.43,1.7,.22,.22,.18,[.8,.12,.08,1]);
    ball(x,3.15,1.7,.22,.22,.18,[.9,.62,.08,1]);
    ball(x,2.87,1.7,.22,.22,.18,[.12,.65,.22,1]);
}
// Add benches and waste bins.
for(const side of [-1,1]) {
    for(const z of [-5,-25,-40]) {
        const x = side*6.35;

        // Bench seat and back.
        box(x,.55,z,1.5,.12,.55,[.39,.23,.12,1]);
        box(x,.9,z-.22,1.5,.65,.12,[.39,.23,.12,1]);

        // Bench legs.
        for(const dx of [-.55,.55]) {
            pole(x+dx,.27,z,.5,.08,C.black);
        }

        // Waste bin.
        box(side*7.0,.55,z+2,.42,1.0,.42,[.25,.32,.34,1]);
    }
}
// Set the starting positions, speeds and colours.
const cars = [
    {x:-2.1,z:10,speed:-7,color:[.76,.10,.08,1]},
    {x:2.1,z:-9,speed:5,color:[.14,.32,.72,1]},
    {x:-2.1,z:-24,speed:-6,color:[.84,.84,.80,1]},
    {x:2.1,z:-36,speed:4.5,color:[.78,.43,.08,1]}
];
// Create rain drops for nighttime.
const rainDrops = [];
for (let i = 0; i < 120; i++) {
    rainDrops.push({
        x: Math.random() * 24 - 12,
        y: Math.random() * 12 + 2,
        z: Math.random() * 62 - 50,
        speed: Math.random() * 5 + 5
    });
}
// Draw one object on the screen.
function drawObject(mesh,matrix,color) {
    gl.uniformMatrix4fv(locations.model,false,matrix);
    gl.uniform4fv(locations.color,color);
     gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}
// Draw one complete car.
function drawCar(car,z) {
    const x = car.x;
    // Main body of the car.
    drawObject(cube,
        modelMatrix(x,.48,z,1.65,.62,3.0),car.color);
    // Top part of the car.
    drawObject(cube,
        modelMatrix(x,.91,z-.15,1.25,.58,1.55),
        [.15,.27,.34,1]);
    // Car windows.
    drawObject(cube,
        modelMatrix(x,.93,z+.05,1.18,.43,.72),
        [.31,.52,.61,1]);

    // Add the four wheels.
    for(const dx of [-.73,.73]) {
        for(const dz of [-.92,.92]) {
            drawObject(cylinder,
                wheelMatrix(x+dx,.27,z+dz),C.black);
        }
    }
    // Add the front and back lights.
    for(const dx of [-.52,.52]) {
        drawObject(cube,
            modelMatrix(x+dx,.55,z+1.51,.22,.18,.08),
            [1,.93,.68,1]);

        drawObject(cube,
            modelMatrix(x+dx,.55,z-1.51,.22,.18,.08),
            [.75,.05,.04,1]);
    }
}
// Add buildings far away in the background.
for(let i=0;i<12;i++) {
    const x = -25+i*4.5;
    const h = 5+(i*7%11);

    box(x,h/2,-58,3,h,4,[.49,.62,.69,1]);
}
// Save the city objects that do not move.
const staticObjects = objects.slice();
// Set the camera position.
const eye = [0,3.2,13.5];
// Where the camera looks.
const target = [0,3.0,-24];
// Up direction.
const up = [0,1,0];
let projection;
let view;
// Update the camera view.
function updateCamera() {
    projection = perspective(
        Math.PI/3,
        canvas.width/canvas.height,
        .1,
        150
    );
    view = lookAt(eye,target,up);
}
// Move the camera forward or sideways.
function moveCamera(forwardAmount,rightAmount) {
    const forward = normalize([
        target[0]-eye[0],
        0,
        target[2]-eye[2]
    ]);
    const right = normalize([
        -forward[2],
        0,
        forward[0]
    ]);
    const moveX =
        forward[0]*forwardAmount +
        right[0]*rightAmount;
    const moveZ =
        forward[2]*forwardAmount +
        right[2]*rightAmount;
    // Move the camera and where it looks.
    eye[0] += moveX;
    eye[2] += moveZ;
    target[0] += moveX;
    target[2] += moveZ;
    updateCamera();
}
// Change the canvas size when the window changes.
function resize() {
    const w = Math.min(window.innerWidth-30,1100);
    canvas.width = Math.max(640,w);
    canvas.height = 680;
    gl.viewport(0,0,canvas.width,canvas.height);
    updateCamera();
}
window.addEventListener("resize",resize);
resize();
// Use W, A, S, D or the arrow keys to move.
const cameraKeys = {
    "w":[0.45,0],
    "ArrowUp":[0.45,0],
    "s":[-0.45,0],
    "ArrowDown":[-0.45,0],
    "a":[0,-0.45],
    "ArrowLeft":[0,-0.45],
    "d":[0,0.45],
    "ArrowRight":[0,0.45]
};

// Check which key the user presses.
window.addEventListener("keydown",(event) => {
    const key = event.key.length===1
        ? event.key.toLowerCase()
        : event.key;
    const movement = cameraKeys[key];
    // Move the camera if the key is in the list.
    if(movement) {
        event.preventDefault();
        moveCamera(movement[0],movement[1]);
    }
});
// Set up the screen and lighting.\
// Turn on depth testing.
gl.enable(gl.DEPTH_TEST);
// Set the first background colour.
gl.clearColor(.55,.78,.94,1);
// Send camera and light information to the shaders.
gl.uniformMatrix4fv(locations.view,false,view);
gl.uniformMatrix4fv(locations.projection,false,projection);
gl.uniform3fv(locations.light,normalize([-.45,-1,-.35]));
gl.uniform3fv(locations.eye,eye);
// Set up the three buttons.
let paused = false;
let lastTime = 0;
// false = Day, true = Night.
let isNight = false;
// Get the buttons from the HTML page.
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const dayNightButton = document.getElementById("dayNightButton");
// Change between Day and Night mode.
if(dayNightButton) {
    dayNightButton.addEventListener("click",() => {
        isNight = !isNight;
        // Change the button name.
        dayNightButton.textContent = isNight
            ? "Switch to Day"
            : "Switch to Night";

        // Show the selected mode.
        statusText.textContent = isNight
            ? "Night mode enabled."
            : "Day mode enabled.";
    });
}
// PAUSE BUTTON
// Stop or start the cars.
if(pauseButton) {
    pauseButton.addEventListener("click",() => {
        paused = !paused;

        pauseButton.textContent = paused
            ? "Resume"
            : "Pause";

        statusText.textContent = paused
            ? "Animation paused."
            : "City running – cars are moving.";
    });
}
// RESET BUTTON
// Put the cars back in their first positions.
if(resetButton) {
    resetButton.addEventListener("click",() => {
        cars[0].z = 10;
        cars[1].z = -9;
        cars[2].z = -24;
        cars[3].z = -36;

        statusText.textContent = "City animation reset.";
    });
}
// Draw the city again and again.
function render(time) {
    // Change the time from milliseconds to seconds.
    const now = time*0.001;
    // Find the time since the last frame.
    const dt = Math.min(now-lastTime,.05);
    lastTime = now;

    // Choose the background colour.
    if(isNight) {
        gl.clearColor(.015,.025,.09,1);
    } else {
        gl.clearColor(.55,.78,.94,1);
    }

    // Clear the screen before drawing again.
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    // Tell the shader if it is Day or Night.
    // 0 means Day and 1 means Night.
    gl.uniform1f(locations.night,isNight ? 1.0 : 0.0);
    // Send the camera information to the GPU.
    gl.uniformMatrix4fv(locations.view,false,view);
    gl.uniformMatrix4fv(locations.projection,false,projection);
    // Change the light direction for each mode.
    gl.uniform3fv(
        locations.light,
        normalize(isNight ? [-.15,-1,-.25] : [-.45,-1,-.35])
    );
    gl.uniform3fv(locations.eye,eye);
    // Draw buildings, roads, trees and other objects.
    for(let i=0;i<staticObjects.length;i++) {
        const obj = staticObjects[i];

        drawObject(obj.mesh,obj.matrix,obj.color);
    }
    // Only move them when the animation is running.
    if(!paused) {
        for(const car of cars) {
            car.z += car.speed*dt;
            // Send cars back when they reach the end of the road.
            if(car.speed<0 && car.z < -52) {
                car.z = 12;
            }
            if(car.speed>0 && car.z > 12) {
                car.z = -52;
            }
        }
    }

    // Draw rain only during nighttime.
    if (isNight) {
        for (const drop of rainDrops) {
            // Move the rain down.
            drop.y -= drop.speed * dt;

            // Start the rain again when it reaches the ground.
            if (drop.y < 0.1) {
                drop.y = 12;
                drop.x = Math.random() * 24 - 12;
                drop.z = Math.random() * 62 - 50;
            }

            // Draw each rain drop.
            drawObject(
                cube,
                modelMatrix(
                    drop.x,
                    drop.y,
                    drop.z,
                    0.025,
                    0.45,
                    0.025
                ),
                [0.55, 0.72, 1.0, 1]
            );
        }
    }

    // DRAW THE CARS
    for(const car of cars) {
        drawCar(car,car.z);
    }
    // Draw the next frame.
    requestAnimationFrame(render);
}
// Start the animation.
requestAnimationFrame(render);

