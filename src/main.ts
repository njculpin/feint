import type * as THREE from "three";
import "./style.css";
import { InputHandler } from "./input-handler";
import { GameManager } from "./game-manager";
import { CursorManager } from "./models/cursor";
import { UIManager } from "./ui-manager";
import { SceneManager } from "./scene-manager";

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create container
  const container = document.createElement("div");
  container.id = "container";
  document.body.appendChild(container);

  // Create scene manager
  const sceneManager = new SceneManager({
    container,
    enableShadows: true,
    enableFog: true,
  });

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
    scene: sceneManager.scene,
    renderer: sceneManager.renderer,
    dieSize,
    gridSize,
  });

  // Update flag light positions based on actual flag positions
  sceneManager.updateFlagLightPositions(
    gameManager.redFlag.mesh.position,
    gameManager.blueFlag.mesh.position
  );

  // Create cursor manager
  const cursorManager = new CursorManager(sceneManager.scene, dieSize);

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
    camera: sceneManager.camera,
    initialCameraPosition: sceneManager.initialCameraPosition,
    initialCameraTarget: sceneManager.initialCameraTarget,
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

    // Render the scene
    sceneManager.render();
  }

  // Start animation loop
  animate();
});
