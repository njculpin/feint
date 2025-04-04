import * as THREE from "three";
import "./style.css";
import { Die } from "./models/die";
import { GameBoard } from "./models/board";

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create container
  const container = document.createElement("div");
  container.id = "container";
  document.body.appendChild(container);

  // Add instructions
  const instructions = document.createElement("div");
  instructions.className = "instructions";
  instructions.textContent =
    "Use WASD or Arrow Keys to roll the highlighted die. The die with the highest face value will be highlighted and is the next to move.";
  document.body.appendChild(instructions);

  // Add a rank display element
  const rankDisplay = document.createElement("div");
  rankDisplay.className = "rank-display";
  rankDisplay.style.position = "absolute";
  rankDisplay.style.top = "70px";
  rankDisplay.style.left = "20px";
  rankDisplay.style.color = "white";
  rankDisplay.style.fontFamily = "Arial, sans-serif";
  rankDisplay.style.fontSize = "24px";
  rankDisplay.style.fontWeight = "bold";
  rankDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  rankDisplay.style.padding = "10px";
  rankDisplay.style.borderRadius = "5px";
  rankDisplay.style.zIndex = "10";
  document.body.appendChild(rankDisplay);

  // Function to update the rank display
  const updateRankDisplay = (rank: number) => {
    rankDisplay.textContent = `Current Highest Rank: ${rank}`;
  };

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Camera setup
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const initialCameraPosition = new THREE.Vector3(0, 30, 40);
  const initialCameraTarget = new THREE.Vector3(0, 0, 0);
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

  // Create game board
  const gameBoard = new GameBoard({
    cellSize: dieSize,
    gridSize: gridSize,
    color: 0x222222,
    borderColor: 0x444444,
    gridColor: 0x444444,
    startMarkerColor: 0x0066ff, // Blue flag
  });

  // Add game board to scene
  gameBoard.addToScene(scene);

  // Get starting position for die
  const startPosition = gameBoard.getStartPosition(dieSize);

  // Create array to store all dice
  const dice: Die[] = [];

  // Create array to track occupied positions
  const occupiedPositions: THREE.Vector3[] = [];

  // Add start position to occupied positions (to prevent placing dice there)
  occupiedPositions.push(startPosition.clone());

  // Define all possible adjacent positions to the starting position
  const adjacentPositions = [
    new THREE.Vector3(-dieSize, 0, 0), // Left
    new THREE.Vector3(dieSize, 0, 0), // Right
    new THREE.Vector3(0, 0, -dieSize), // Forward
    new THREE.Vector3(0, 0, dieSize), // Backward
    new THREE.Vector3(-dieSize, 0, -dieSize), // Forward-Left diagonal
    new THREE.Vector3(dieSize, 0, -dieSize), // Forward-Right diagonal
    new THREE.Vector3(-dieSize, 0, dieSize), // Backward-Left diagonal
    new THREE.Vector3(dieSize, 0, dieSize), // Backward-Right diagonal
  ];

  // Function to check if a position is already occupied
  const isPositionOccupied = (position: THREE.Vector3): boolean => {
    return occupiedPositions.some(
      (pos) => pos.x === position.x && pos.z === position.z
    );
  };

  // Create and add 6 dice in adjacent positions
  let diceCount = 0;
  const maxDice = 6;

  // Shuffle the adjacent positions array for random placement
  const shuffledPositions = [...adjacentPositions].sort(
    () => Math.random() - 0.5
  );

  // Try to place dice in shuffled positions
  for (const offset of shuffledPositions) {
    if (diceCount >= maxDice) break;

    // Calculate absolute position
    const position = new THREE.Vector3(
      startPosition.x + offset.x,
      dieSize / 2, // Keep y position at half the die height
      startPosition.z + offset.z
    );

    // Check if position is within board boundaries and not occupied
    if (
      gameBoard.isWithinBoundaries(position) &&
      !isPositionOccupied(position)
    ) {
      // Create die with red color
      const adjacentDie = new Die({
        size: dieSize,
        position: position,
        color: "#ff0000", // All dice are red
        pipColor: "#ffffff",
      });

      // For testing, set all dice to have a top face of 2
      adjacentDie.topFace = 2;

      // Set anisotropy for better texture quality
      adjacentDie.setAnisotropy(renderer.capabilities.getMaxAnisotropy());

      // Add to scene and dice array
      scene.add(adjacentDie.mesh);
      dice.push(adjacentDie);

      // Mark position as occupied
      occupiedPositions.push(position.clone());

      // Increment dice count
      diceCount++;
    }
  }

  // Add individual die rank displays
  const createDieRankLabels = () => {
    dice.forEach((die, index) => {
      const dieLabel = document.createElement("div");
      dieLabel.className = "die-label";
      dieLabel.id = `die-label-${index}`;
      dieLabel.style.position = "absolute";
      dieLabel.style.color = "white";
      dieLabel.style.fontFamily = "Arial, sans-serif";
      dieLabel.style.fontSize = "16px";
      dieLabel.style.backgroundColor = "rgba(255, 0, 0, 0.7)";
      dieLabel.style.padding = "5px";
      dieLabel.style.borderRadius = "3px";
      dieLabel.style.zIndex = "10";
      dieLabel.style.pointerEvents = "none"; // Don't interfere with clicks
      document.body.appendChild(dieLabel);
    });
  };

  // Update die labels in the animation loop
  const updateDieLabels = () => {
    dice.forEach((die, index) => {
      const dieLabel = document.getElementById(`die-label-${index}`);
      if (dieLabel) {
        // Convert die position to screen coordinates
        const position = new THREE.Vector3();
        position.copy(die.mesh.position);
        position.y += die.size; // Position above the die

        // Project the 3D position to 2D screen coordinates
        const vector = position.clone();
        vector.project(camera);

        // Convert to CSS coordinates
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        // Update label position and content
        dieLabel.style.left = `${x}px`;
        dieLabel.style.top = `${y}px`;
        dieLabel.textContent = `Face: ${die.topFace}`;

        // Highlight the label if this die is active
        if (die === activeDie) {
          dieLabel.style.backgroundColor = "rgba(255, 255, 0, 0.7)"; // Yellow for active die
        } else {
          dieLabel.style.backgroundColor = "rgba(255, 0, 0, 0.7)"; // Red for inactive dice
        }
      }
    });
  };

  // Call createDieRankLabels after creating all dice
  createDieRankLabels();

  // Active die reference
  let activeDie: Die | null = null;

  // Function to find all dice with the highest rank
  const findHighestRankDice = (): { dice: Die[]; rank: number } => {
    let highestRank = 0;

    // First find the highest rank among all dice
    dice.forEach((die) => {
      if (die.topFace > highestRank) {
        highestRank = die.topFace;
      }
    });

    // Then collect all dice with that rank
    const highestDice = dice.filter((die) => die.topFace === highestRank);

    return { dice: highestDice, rank: highestRank };
  };

  // Update which dice are highlighted
  const updateHighlightedDice = (): void => {
    // Find dice with highest rank
    const { dice: highestDice, rank } = findHighestRankDice();

    // Update the rank display
    updateRankDisplay(rank);

    // Unhighlight all dice
    dice.forEach((die) => die.highlight(false));

    // Highlight highest-ranked dice
    highestDice.forEach((die) => die.highlight(true));

    // If there's only one highest die, make it the active die
    if (highestDice.length === 1) {
      activeDie = highestDice[0];
    }
    // If the active die is no longer among the highest-ranked dice, deselect it
    else if (activeDie && !highestDice.includes(activeDie)) {
      activeDie = null;
    }

    // Update status message
    if (highestDice.length > 1 && !activeDie) {
      instructions.textContent = `Multiple dice with rank ${rank} are tied for highest. Click on one to select it.`;
    } else if (activeDie) {
      instructions.textContent = `Use WASD or Arrow Keys to roll the highlighted die with rank ${rank}.`;
    }
  };

  // Initialize highlighted dice
  updateHighlightedDice();

  // Raycaster for mouse picking
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Handle mouse click for die selection
  container.addEventListener("click", (event) => {
    // Only handle left clicks
    if (event.button !== 0) return;

    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster
    raycaster.setFromCamera(mouse, camera);

    // Find highest-ranked dice
    const { dice: highestDice, rank } = findHighestRankDice();

    // If there's only one highest die and it's already active, do nothing
    if (highestDice.length === 1 && activeDie === highestDice[0]) return;

    // Get all intersected objects
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Check if we clicked on a die
    for (const intersect of intersects) {
      const object = intersect.object;

      // Find which die was clicked
      for (const die of highestDice) {
        if (
          object === die.mesh ||
          (object.parent && object.parent === die.mesh)
        ) {
          // Set as active die
          activeDie = die;
          console.log(`Die with rank ${die.topFace} selected by click`);

          // Update instructions
          instructions.textContent = `Use WASD or Arrow Keys to roll the highlighted die with rank ${rank}.`;

          return;
        }
      }
    }
  });

  // Camera panning variables
  let isPanning = false;
  let previousMousePosition = { x: 0, y: 0 };
  const panSpeed = 0.05;

  // Handle mouse events for panning
  container.addEventListener("contextmenu", (event) => {
    event.preventDefault(); // Prevent context menu from appearing
  });

  container.addEventListener("mousedown", (event) => {
    // Only start panning on right mouse button
    if (event.button === 2) {
      isPanning = true;
      previousMousePosition = {
        x: event.clientX,
        y: event.clientY,
      };
    }
  });

  window.addEventListener("mouseup", () => {
    isPanning = false;
  });

  window.addEventListener("mousemove", (event) => {
    if (!isPanning) return;

    // Calculate mouse movement
    const deltaMove = {
      x: event.clientX - previousMousePosition.x,
      y: event.clientY - previousMousePosition.y,
    };

    // Update camera position based on mouse movement
    const deltaX = -deltaMove.x * panSpeed;
    const deltaZ = -deltaMove.y * panSpeed;

    // Apply panning without limits
    camera.position.x += deltaX;
    camera.position.z += deltaZ;

    // Update the camera target to maintain the same viewing angle
    const target = new THREE.Vector3(
      camera.position.x,
      0,
      camera.position.z - 40 // Maintain the same distance from the target
    );
    camera.lookAt(target);

    // Update previous position
    previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  });

  // Function to recenter the camera
  function recenterCamera() {
    camera.position.copy(initialCameraPosition);
    camera.lookAt(initialCameraTarget);
  }

  // Handle keyboard events
  window.addEventListener("keydown", (event) => {
    // Define directions
    const directions = {
      KeyW: new THREE.Vector3(0, 0, -1), // Forward
      KeyS: new THREE.Vector3(0, 0, 1), // Backward
      KeyA: new THREE.Vector3(-1, 0, 0), // Left
      KeyD: new THREE.Vector3(1, 0, 0), // Right
      ArrowUp: new THREE.Vector3(0, 0, -1), // Forward
      ArrowDown: new THREE.Vector3(0, 0, 1), // Backward
      ArrowLeft: new THREE.Vector3(-1, 0, 0), // Left
      ArrowRight: new THREE.Vector3(1, 0, 0), // Right
    };

    const direction = directions[event.code as keyof typeof directions];

    // Check if we have a valid direction and an active die
    if (direction && activeDie) {
      // Calculate new position after rolling
      const newPosition = activeDie.mesh.position
        .clone()
        .add(direction.clone().multiplyScalar(dieSize));

      // Check if new position is within boundaries and not occupied by another die
      const wouldCollide = isPositionOccupied(newPosition);

      if (!wouldCollide) {
        // Store the die that's about to move
        const movingDie = activeDie;

        // Roll the die
        movingDie.roll(direction, gameBoard.boundaryLimit, () => {
          // After rolling completes, update occupied positions
          const oldPosition = movingDie.mesh.position
            .clone()
            .sub(direction.clone().multiplyScalar(dieSize));

          // Remove old position from occupied list
          const oldIndex = occupiedPositions.findIndex(
            (pos) => pos.x === oldPosition.x && pos.z === oldPosition.z
          );
          if (oldIndex !== -1) {
            occupiedPositions.splice(oldIndex, 1);
          }

          // Add new position to occupied list
          occupiedPositions.push(newPosition.clone());

          // Update which dice are highlighted based on highest rank
          updateHighlightedDice();
        });
      }
    } else if (direction && !activeDie) {
      // If we have a direction but no active die, remind the user to select a die
      console.log(
        "No active die selected. Please click on a highlighted die to select it."
      );
      instructions.textContent =
        "No active die selected. Please click on a highlighted die to select it.";
    }

    // Handle camera recentering with F key
    if (event.code === "KeyF") {
      recenterCamera();
    }

    // For testing: Allow manually setting die values with number keys 1-6
    if (event.code.startsWith("Digit") && activeDie) {
      const digit = Number.parseInt(event.code.replace("Digit", ""));
      if (digit >= 1 && digit <= 6) {
        console.log(
          `Manually setting die value from ${activeDie.topFace} to ${digit}`
        );
        activeDie.topFace = digit;
        updateHighlightedDice();
      }
    }
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    updateDieLabels(); // Update die labels each frame
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
