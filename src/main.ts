import type * as THREE from "three";
import "./style.css";
import { InputHandler } from "./input-handler";
import { GameManager } from "./game-manager";
import { CursorManager } from "./models/cursor";
import { UIManager } from "./ui-manager";
import { SceneManager } from "./scene-manager";

document.addEventListener("DOMContentLoaded", () => {
  // Setup container and managers
  const container = document.createElement("div");
  container.id = "container";
  document.body.appendChild(container);

  const sceneManager = new SceneManager({
    container,
    enableShadows: true,
    enableFog: true,
    enablePostProcessing: true,
  });

  const dieSize = 2;
  const gridSize = 10;

  const gameManager = new GameManager({
    scene: sceneManager.scene,
    renderer: sceneManager.renderer,
    dieSize,
    gridSize,
  });

  const uiManager = new UIManager({
    container,
    onRestartGame: () => window.location.reload(),
  });

  const cursorManager = new CursorManager(sceneManager.scene, dieSize);

  // Update flag lights
  sceneManager.updateFlagLightPositions(
    gameManager.redFlag.mesh.position,
    gameManager.blueFlag.mesh.position
  );

  // Setup cursor and initial die selection
  function updateCursorPosition() {
    cursorManager.updateSelectedCursors(gameManager.selectedDice);
  }

  function initializeSelection() {
    const { dice: highestDice } = gameManager.findHighestRankDice();
    if (highestDice.length > 0) {
      gameManager.selectedDice[0] = highestDice[0];
      gameManager.updateHighlightedDice();
      updateCursorPosition();
    }
  }

  initializeSelection();

  // Cursor movement animation
  function animateCursorMovement(
    targetX: number,
    targetZ: number,
    duration = 300,
    onComplete?: () => void
  ) {
    cursorManager.animateCursorMovement(targetX, targetZ, duration, () => {
      updateCursorPosition();
      if (onComplete) onComplete();
    });
  }

  // Initialize input handler
  const inputHandler = new InputHandler({
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
      mesh: null,
    },
    dice: {
      redDice: gameManager.redDice,
      blueDice: gameManager.blueDice,
      selectedDice: gameManager.selectedDice,
      isRolling: gameManager.isRolling,
      isPlayerTurn: true,
      isAIMoving: gameManager.aiManager.isAIMoving,
      findHighestRankDice: gameManager.findHighestRankDice.bind(gameManager),
      isHighestRankDie: gameManager.isHighestRankDie.bind(gameManager),
      updateHighlightedDice:
        gameManager.updateHighlightedDice.bind(gameManager),
      moveDie: (direction: THREE.Vector3) => {
        let moveSuccessful = false;
        gameManager.moveDie(direction, (x, z, duration, onComplete) => {
          animateCursorMovement(x, z, duration, () => {
            moveSuccessful = true;
            if (onComplete) onComplete();

            // Trigger AI move after player's move
            if (!gameManager.gameOver) {
              setTimeout(() => {
                if (!gameManager.isRolling && moveSuccessful) {
                  gameManager.performAIMove();
                }
              }, 200);
            }
          });
        });
      },
      checkContinuousMovement: () => {
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

  // Camera view shortcuts
  window.addEventListener("keydown", (event) => {
    if (!gameManager.isRolling && !cursorManager.isMoving()) {
      switch (event.code) {
        case "Digit1":
          sceneManager.cameraManager.resetCamera();
          break;
        case "Digit2":
          sceneManager.cameraManager.setTopDownView();
          break;
        case "Digit3":
          sceneManager.cameraManager.setFrontView();
          break;
        case "Digit4":
          sceneManager.cameraManager.setIsometricView();
          break;
      }
    }
  });

  // AI move timer
  let aiMoveTimer: number | null = null;
  let consecutiveFailedMoves = 0;
  const MAX_FAILED_MOVES = 3;

  function startAIMoveTimer() {
    if (aiMoveTimer !== null) clearTimeout(aiMoveTimer);

    const moveDelay =
      consecutiveFailedMoves >= MAX_FAILED_MOVES
        ? 100 // Fast if stuck
        : Math.random() * 200 + 200; // Normal speed

    aiMoveTimer = window.setTimeout(() => {
      if (
        !gameManager.gameOver &&
        !gameManager.isRolling &&
        !gameManager.aiManager.isAIMoving
      ) {
        const blueDiceCountBefore = gameManager.blueDice.length;
        gameManager.performAIMove();

        setTimeout(() => {
          if (
            blueDiceCountBefore === gameManager.blueDice.length &&
            !gameManager.isRolling
          ) {
            consecutiveFailedMoves++;
          } else {
            consecutiveFailedMoves = 0;
          }
        }, 600);
      }
      startAIMoveTimer();
    }, moveDelay);
  }

  // Start AI moves
  startAIMoveTimer();
  setTimeout(() => {
    if (!gameManager.gameOver && !gameManager.isRolling) {
      gameManager.performAIMove();
    }
  }, 500);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

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

    sceneManager.render();
  }

  animate();
});
