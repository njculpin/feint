import * as THREE from "three";
import "./style.css";
import { InputHandler } from "./input-handler";
import { GameManager } from "./game-manager";

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create container
  const container = document.createElement("div");
  container.id = "container";
  document.body.appendChild(container);

  // Create instructions element
  const instructions = document.createElement("div");
  instructions.className = "instructions";
  instructions.innerHTML = `
    <h3>Dice Game Controls</h3>
    <p>WASD: Move selected die</p>
    <p>Q/E: Rotate die in place</p>
    <p>Arrow Keys: Move cursor</p>
    <p>Space/Enter: Select die at cursor</p>
    <p>F: Recenter camera</p>
    <p>Right-click + drag: Pan camera</p>
  `;
  document.body.appendChild(instructions);

  // Add an info display to show the current top face
  const infoDisplay = document.createElement("div");
  infoDisplay.className = "info";
  document.body.appendChild(infoDisplay);

  // Add a game status display
  const gameStatusDisplay = document.createElement("div");
  gameStatusDisplay.className = "game-status";
  document.body.appendChild(gameStatusDisplay);

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Camera setup - 45-degree angle view
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const initialCameraPosition = new THREE.Vector3(0, 35, 35); // Position at 45-degree angle
  const initialCameraTarget = new THREE.Vector3(0, 0, 0); // Look at center of board
  camera.position.copy(initialCameraPosition);
  camera.lookAt(initialCameraTarget);

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Define sizes for grid-based movement
  const dieSize = 2; // Size of the die
  const gridSize = 10; // Number of cells in each direction

  // Create game manager
  const gameManager = new GameManager({
    scene,
    renderer,
    dieSize,
    gridSize,
  });

  // Create a square cursor using line segments (no diagonals)
  const cursorSize = dieSize * 1.2;
  const halfSize = cursorSize / 2;

  // Create the cursor using LineSegments
  const cursorGeometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    // Bottom edge
    -halfSize,
    0,
    -halfSize,
    halfSize,
    0,
    -halfSize,

    // Right edge
    halfSize,
    0,
    -halfSize,
    halfSize,
    0,
    halfSize,

    // Top edge
    halfSize,
    0,
    halfSize,
    -halfSize,
    0,
    halfSize,

    // Left edge
    -halfSize,
    0,
    halfSize,
    -halfSize,
    0,
    -halfSize,
  ]);

  cursorGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(vertices, 3)
  );

  const cursorMaterial = new THREE.LineBasicMaterial({
    color: 0x00ffff, // Cyan
    linewidth: 3, // Note: linewidth only works in WebGL 2 and some browsers
    transparent: true,
    opacity: 0.8,
  });

  const cursor = new THREE.LineSegments(cursorGeometry, cursorMaterial);
  cursor.position.y = 0.1; // Slightly above the ground

  // Initialize cursor position variables
  const cursorPosition = new THREE.Vector3(0, 0, 0);
  const cursorTargetPosition = new THREE.Vector3(0, 0, 0);

  function updateCursorPosition() {
    cursor.position.x = cursorPosition.x;
    cursor.position.z = cursorPosition.z;
  }

  // Function to position cursor at highest ranking die
  function positionCursorAtHighestDie() {
    const { dice: highestDice } = gameManager.findHighestRankDice();

    if (highestDice.length > 0) {
      // Position at the first highest die
      const targetDie = highestDice[0];
      cursorPosition.x = targetDie.mesh.position.x;
      cursorPosition.z = targetDie.mesh.position.z;
      updateCursorPosition();

      // Auto-select this die
      gameManager.selectedDice[0] = targetDie;
      gameManager.updateHighlightedDice();
    }
  }

  // Initialize cursor at the highest ranking die
  positionCursorAtHighestDie();
  scene.add(cursor);

  // Track if cursor is currently moving
  let isCursorMoving = false;

  // Function to animate cursor movement
  function animateCursorMovement(
    targetX: number,
    targetZ: number,
    duration = 500,
    onComplete?: () => void
  ) {
    // Set target position
    cursorTargetPosition.x = targetX;
    cursorTargetPosition.z = targetZ;

    // Start cursor movement animation
    isCursorMoving = true;

    // Animation parameters
    const startPosition = cursorPosition.clone();
    const startTime = Date.now();
    const endTime = startTime + duration;

    // Function to perform animation step
    const performAnimation = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;

      // If animation is complete
      if (currentTime >= endTime) {
        cursorPosition.copy(cursorTargetPosition);
        updateCursorPosition();
        isCursorMoving = false;
        if (onComplete) onComplete();
        return;
      }

      // Calculate progress (0 to 1)
      const progress = elapsed / duration;

      // Update cursor position using linear interpolation
      cursorPosition.x =
        startPosition.x + (cursorTargetPosition.x - startPosition.x) * progress;
      cursorPosition.z =
        startPosition.z + (cursorTargetPosition.z - startPosition.z) * progress;
      updateCursorPosition();

      // Continue animation
      requestAnimationFrame(performAnimation);
    };

    // Start animation
    performAnimation();
  }

  // Initialize input handler
  const inputHandler = new InputHandler({
    camera,
    initialCameraPosition,
    initialCameraTarget,
    container,
    dieSize,
    gameBoard: {
      boundaryLimit: gameManager.gameBoard.boundaryLimit,
    },
    cursor: {
      position: cursorPosition,
      targetPosition: cursorTargetPosition,
      updatePosition: updateCursorPosition,
      mesh: cursor,
    },
    dice: {
      redDice: gameManager.redDice,
      blueDice: gameManager.blueDice,
      selectedDice: gameManager.selectedDice,
      isRolling: gameManager.isRolling,
      findHighestRankDice: gameManager.findHighestRankDice.bind(gameManager),
      isHighestRankDie: gameManager.isHighestRankDie.bind(gameManager),
      updateHighlightedDice:
        gameManager.updateHighlightedDice.bind(gameManager),
      moveDie: (direction: THREE.Vector3) =>
        gameManager.moveDie(direction, animateCursorMovement),
      checkContinuousMovement: () =>
        gameManager.checkContinuousMovement(
          inputHandler.getKeyStates(),
          animateCursorMovement
        ),
    },
    state: {
      gameOver: gameManager.gameOver,
      isCursorMoving,
    },
    animateCursorMovement,
  });

  // Initialize highlighted dice (this is now handled by positionCursorAtHighestDie)
  // gameManager.updateHighlightedDice()

  // Function to update info display
  function updateInfoDisplay() {
    // Get all red dice top faces for debugging
    const redDiceFaces = gameManager.redDice
      .map(
        (die) =>
          `Red Die ${gameManager.redDice.indexOf(die) + 1}: ${die.topFace}`
      )
      .join("<br>");

    // Get all blue dice top faces for debugging
    const blueDiceFaces = gameManager.blueDice
      .map(
        (die) =>
          `Blue Die ${gameManager.blueDice.indexOf(die) + 1}: ${die.topFace}`
      )
      .join("<br>");

    // Get the highest rank among red dice
    const { rank } = gameManager.findHighestRankDice();

    if (gameManager.selectedDice.length === 0) {
      infoDisplay.innerHTML = `
        <strong>Game Status</strong><br>
        Highest Red Die Face: ${rank}<br>
        <br>
        ${redDiceFaces}<br>
        <br>
        ${blueDiceFaces}<br>
        <br>
        No die selected
      `;
      return;
    }

    const activeDie = gameManager.selectedDice[0];
    infoDisplay.innerHTML = `
      <strong>Game Status</strong><br>
      Highest Red Die Face: ${rank}<br>
      <br>
      ${redDiceFaces}<br>
      <br>
      ${blueDiceFaces}<br>
      <br>
      <strong>Selected Die</strong><br>
      Top Face: ${activeDie.topFace}
    `;
  }

  // Track previous game state to detect changes
  let previousGameOver = gameManager.gameOver;
  let previousWinner = gameManager.winner;
  let previousRedDiceCount = gameManager.redDice.length;
  let previousBlueDiceCount = gameManager.blueDice.length;

  // Function to update game status display
  function updateGameStatusDisplay() {
    // Only update the display if the game state has changed
    const gameStateChanged =
      previousGameOver !== gameManager.gameOver ||
      previousWinner !== gameManager.winner ||
      previousRedDiceCount !== gameManager.redDice.length ||
      previousBlueDiceCount !== gameManager.blueDice.length;

    if (!gameStateChanged) {
      return;
    }

    // Update previous state
    previousGameOver = gameManager.gameOver;
    previousWinner = gameManager.winner;
    previousRedDiceCount = gameManager.redDice.length;
    previousBlueDiceCount = gameManager.blueDice.length;

    if (gameManager.gameOver) {
      gameStatusDisplay.innerHTML = `
        <div class="game-over">
          <h2>Game Over!</h2>
          <h3>${gameManager.winner === "red" ? "Red" : "Blue"} team wins!</h3>
          <button id="restart-button">Restart Game</button>
        </div>
      `;
    } else {
      gameStatusDisplay.innerHTML = `
        <div class="game-status-info">
          <p>Red Dice: ${gameManager.redDice.length}</p>
          <p>Blue Dice: ${gameManager.blueDice.length}</p>
        </div>
      `;
    }
  }

  // Function to restart the game
  function restartGame() {
    console.log("Restarting game...");
    window.location.reload();
  }

  // Add event listener to the game status display using event delegation
  gameStatusDisplay.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.id === "restart-button" || target.closest("#restart-button")) {
      console.log("Restart button clicked");
      restartGame();
    }
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Make the cursor pulsate slightly for better visibility with uniform scaling
    const pulseFactor = 0.1 * Math.sin(Date.now() * 0.005) + 1;
    cursor.scale.set(pulseFactor, pulseFactor, pulseFactor);

    // Update displays
    updateInfoDisplay();
    updateGameStatusDisplay();

    renderer.render(scene, camera);
  }

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Initialize game status display
  updateGameStatusDisplay();

  // Start animation loop
  animate();
});
