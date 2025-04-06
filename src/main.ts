import * as THREE from "three";
import "./style.css";
import { InputHandler } from "./input-handler";
import { GameManager } from "./game-manager";
import { CursorManager } from "./models/cursor";
import { UIManager } from "./ui-manager";

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create container
  const container = document.createElement("div");
  container.id = "container";
  document.body.appendChild(container);

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
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Increased ambient light intensity
  scene.add(ambientLight);

  // Main directional light (sun-like)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased intensity
  directionalLight.position.set(10, 15, 10); // Adjusted position
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Add a secondary directional light from the opposite direction to reduce shadows
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-10, 10, -10);
  scene.add(fillLight);

  // Add a subtle blue-tinted light from below for more dimension
  const groundLight = new THREE.DirectionalLight(0xaaccff, 0.2);
  groundLight.position.set(0, -5, 0);
  scene.add(groundLight);

  // Define sizes for grid-based movement
  const dieSize = 2; // Size of the die
  const gridSize = 10; // Number of cells in each direction

  // Function to restart the game
  function restartGame() {
    console.log("Restarting game...");
    window.location.reload();
  }

  // Create UI manager
  const uiManager = new UIManager({
    container,
    onRestartGame: restartGame,
  });

  // Create game manager
  const gameManager = new GameManager({
    scene,
    renderer,
    dieSize,
    gridSize,
  });

  // Create cursor manager
  const cursorManager = new CursorManager(scene, dieSize);

  // Function to update cursor position
  function updateCursorPosition() {
    cursorManager.updateSelectedCursors(gameManager.selectedDice);
  }

  // Function to position cursor at highest ranking die
  function positionCursorAtHighestDie() {
    const { dice: highestDice } = gameManager.findHighestRankDice();

    if (highestDice.length > 0) {
      // Auto-select this die
      gameManager.selectedDice[0] = highestDice[0];
      gameManager.updateHighlightedDice();
      updateCursorPosition();
    }
  }

  // Initialize cursor at the highest ranking die
  positionCursorAtHighestDie();

  // Define the dice movement speed - this will be used for both dice and cursor
  const MOVEMENT_DURATION = 300; // 300ms for movement animations

  // Function to animate cursor movement
  function animateCursorMovement(
    targetX: number,
    targetZ: number,
    duration = MOVEMENT_DURATION,
    onComplete?: () => void
  ) {
    cursorManager.animateCursorMovement(targetX, targetZ, duration, () => {
      // Ensure cursor position is updated with the exact target position
      updateCursorPosition();
      if (onComplete) onComplete();
    });
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
      position: cursorManager.getCursorPosition(),
      targetPosition: cursorManager.getCursorTargetPosition(),
      updatePosition: updateCursorPosition,
      mesh: null, // No main cursor
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
      isCursorMoving: cursorManager.isMoving(),
    },
    animateCursorMovement,
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Update cursor animations
    cursorManager.update();

    // Update UI displays
    const { rank } = gameManager.findHighestRankDice();
    uiManager.updateInfoDisplay(
      gameManager.redDice,
      gameManager.blueDice,
      gameManager.selectedDice,
      rank
    );

    uiManager.updateGameStatusDisplay(
      gameManager.gameOver,
      gameManager.winner,
      gameManager.redDice.length,
      gameManager.blueDice.length
    );

    renderer.render(scene, camera);
  }

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start animation loop
  animate();
});
