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

  // Create scene manager with post-processing enabled
  const sceneManager = new SceneManager({
    container,
    enableShadows: true,
    enableFog: true,
    enablePostProcessing: true,
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

  // Create cursor manager (no visual cursor)
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
  const inputHandler: InputHandler = new InputHandler({
    camera: sceneManager.cameraManager.camera,
    initialCameraPosition: sceneManager.cameraManager.initialPosition,
    initialCameraTarget: sceneManager.cameraManager.initialTarget,
    container,
    dieSize,
    gameBoard: {
      boundaryLimit: gameManager.gameBoard.boundaryLimit,
    },
    cursor: {
      position: cursorManager.getCursorPosition(),
      targetPosition: cursorManager.getCursorTargetPosition(),
      updatePosition: updateCursorPosition,
      mesh: null, // No cursor mesh
    },
    dice: {
      redDice: gameManager.redDice,
      blueDice: gameManager.blueDice,
      selectedDice: gameManager.selectedDice,
      isRolling: gameManager.isRolling,
      isPlayerTurn: gameManager.isPlayerTurn,
      isAIMoving: gameManager.aiManager.isAIMoving,
      findHighestRankDice: gameManager.findHighestRankDice.bind(gameManager),
      isHighestRankDie: gameManager.isHighestRankDie.bind(gameManager),
      updateHighlightedDice:
        gameManager.updateHighlightedDice.bind(gameManager),
      moveDie: (direction: THREE.Vector3) => {
        // Set a flag to track if the move was successful
        let moveSuccessful = false;

        // Attempt to move the die
        gameManager.moveDie(direction, (x, z, duration, onComplete) => {
          // Call the original animateCursorMovement
          animateCursorMovement(x, z, duration, () => {
            // Mark the move as successful
            moveSuccessful = true;

            // Call the original onComplete if provided
            if (onComplete) onComplete();

            // After player's move completes and animations finish, trigger AI move
            // but don't toggle turns or block player
            if (!gameManager.gameOver) {
              setTimeout(() => {
                if (!gameManager.isRolling && moveSuccessful) {
                  // Trigger AI move without toggling turns
                  gameManager.performAIMove();
                }
              }, 200); // Reduced delay after player move
            }
          });
        });
      },
      checkContinuousMovement: (): void => {
        gameManager.checkContinuousMovement(
          inputHandler.getKeyStates(),
          animateCursorMovement
        );
      },
    },
    state: {
      gameOver: gameManager.gameOver,
      isCursorMoving: cursorManager.isMoving(),
    },
    animateCursorMovement,
  });

  // Add keyboard shortcuts for camera views
  window.addEventListener("keydown", (event) => {
    // Only handle camera view changes if not in the middle of a game action
    if (!gameManager.isRolling && !cursorManager.isMoving()) {
      switch (event.code) {
        case "Digit1":
          // Default isometric view
          sceneManager.cameraManager.resetCamera();
          break;
        case "Digit2":
          // Top-down view
          sceneManager.cameraManager.setTopDownView();
          break;
        case "Digit3":
          // Front view
          sceneManager.cameraManager.setFrontView();
          break;
        case "Digit4":
          // Isometric view from opposite side
          sceneManager.cameraManager.setIsometricView();
          break;
      }
    }
  });

  // Set up a timer for AI moves to make blue dice more aggressive
  let aiMoveTimer: number | null = null;
  let consecutiveFailedMoves = 0;
  const MAX_FAILED_MOVES = 3;

  function startAIMoveTimer() {
    // Clear any existing timer
    if (aiMoveTimer !== null) {
      clearTimeout(aiMoveTimer);
    }

    // Calculate move delay based on consecutive failed moves
    const moveDelay =
      consecutiveFailedMoves >= MAX_FAILED_MOVES
        ? 100 // Very fast if we've had several failed moves
        : Math.random() * 200 + 200; // 200-400ms normally

    aiMoveTimer = window.setTimeout(() => {
      // Only move if the game is not over and no dice are currently rolling
      if (
        !gameManager.gameOver &&
        !gameManager.isRolling &&
        !gameManager.aiManager.isAIMoving
      ) {
        // Store the number of blue dice before the move
        const blueDiceCountBefore = gameManager.blueDice.length;

        // Try to perform an AI move
        gameManager.performAIMove();

        // Check if the move was successful by seeing if any dice moved
        setTimeout(() => {
          if (
            blueDiceCountBefore === gameManager.blueDice.length &&
            !gameManager.isRolling
          ) {
            // No dice were lost and no dice are rolling, so the move probably failed
            consecutiveFailedMoves++;
            console.log(
              `AI move likely failed. Consecutive failed moves: ${consecutiveFailedMoves}`
            );
          } else {
            // Reset the counter if a move was successful
            consecutiveFailedMoves = 0;
          }
        }, 600); // Check after move animation would complete
      }

      // Restart the timer for the next move
      startAIMoveTimer();
    }, moveDelay);
  }

  // Start the AI move timer
  startAIMoveTimer();

  // Also trigger an immediate AI move to get things started
  setTimeout(() => {
    if (!gameManager.gameOver && !gameManager.isRolling) {
      gameManager.performAIMove();
    }
  }, 500);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

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
