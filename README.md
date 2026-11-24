 Town – WebGL2 Computer Graphics Project
Project Description
This project is an interactive 3D city street created using WebGL2, JavaScript, and GLSL. It includes buildings, windows, roads, sidewalks, trees, streetlights, traffic lights, street furniture, and animated cars. The scene supports camera movement and day/night lighting.

Technologies Used
•HTML5 Canvas
•JavaScript
•WebGL2
•GLSL ES 3.00 vertex and fragment shaders
•Common/MVnew.js
•Common/initShaders.js

Project Files
•index.html: WebGL2 canvas, shaders, controls, and on-screen instructions.
•main.js3: D geometry, camera, lighting, keyboard controls, and animation.
•Common/MVnew.js: Course graphics helper library.
•Common/initShaders.js: Loads and compiles the shaders.

How to Run
1. Extract the complete project folder.
2. Keep the Common folder beside index.html.
3. Open index.html in a browser that supports WebGL2, such as a recent version of Chrome, Firefox, or Safari.
4. If local file restrictions prevent the scripts from loading, run the folder using a local web server.

Controls

•W or Up Arrow: Move the camera forward 
•S or Down Arrow: Move the camera backward 
•A or Left Arrow: Move the camera left 
•D or Right Arrow:  Move the camera right 
•Pause:  Stop car movement Action
•Reset:  Return cars to their starting positions 
•Switch to Night / Switch to Day Change the scene lighting

Graphics Techniques
•3D geometry is created using shapes such as cubes, spheres, and cylinders.
•Vertex buffers send position and normal data to the GPU.
•Model transformations position and scale objects.
• Action View and perspective projection matrices create the 3D camera view.
•GLSL vertex and fragment shaders calculate lighting, including diffuse and specular effects.
•Animation updates the cars' positions over time.
•Keyboard and button controls allow the user to interact with the scene.

 Project Scope
The scene uses procedural geometry and solid colours rather than image textures. Building windows and road details are represented with geometry. The project demonstrates WebGL2, GLSL shaders, 3D transformations, lighting, camera movement, animation, and user interaction.


