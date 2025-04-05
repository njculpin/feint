import * as THREE from "three";
import "./style.css";
import { Die } from "./models/die";
import { GameBoard } from "./models/board";
import { Flag } from "./models/flag";

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

  // Camera setup - completely top-down view
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const initialCameraPosition = new THREE.Vector3(0, 50, 0); // Position directly above
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

  // Create game board
  const gameBoard = new GameBoard({
    cellSize: dieSize,
    gridSize: gridSize,
    color: 0x222222,
    borderColor: 0x444444,
    gridColor: 0x444444,
    startMarkerColor: 0x0066ff, // Blue button
  });

  // Add game board to scene
  gameBoard.addToScene(scene);

  // Get starting position for die
  const startPosition = gameBoard.getStartPosition(dieSize);
  const endPosition = gameBoard.getEndPosition(dieSize);

  // Create array to store all dice
  const redDice: Die[] = [];
  const blueDice: Die[] = [];

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

  // Create and add 6 red dice in adjacent positions
  let diceCount = 0;
  const maxDice = 6;

  // Shuffle the adjacent positions array for random placement
  const shuffledPositions = [...adjacentPositions].sort(
    () => Math.random() - 0.5
  );

  // Try to place red dice in shuffled positions
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
      // Create die with red color and a specific top face
      const faceValue = (diceCount % 6) + 1; // Assign values 1-6
      const redDie = new Die({
        size: dieSize,
        position: position,
        color: "#ff0000", // Red dice
        pipColor: "#ffffff",
        initialTopFace: faceValue, // Set the initial top face
      });

      // Set anisotropy for better texture quality
      redDie.setAnisotropy(renderer.capabilities.getMaxAnisotropy());

      // Add to scene and dice array
      scene.add(redDie.mesh);
      redDice.push(redDie);

      // Mark position as occupied
      occupiedPositions.push(position.clone());

      // Increment dice count
      diceCount++;
    }
  }

  // Create a red flag on the opposite side of the board for blue dice
  const oppositeStartPos = new THREE.Vector3(
    -startPosition.x,
    0,
    -startPosition.z
  );

  // Create red flag for blue dice
  const blueFlag = new Flag({
    position: new THREE.Vector3(oppositeStartPos.x, 0, oppositeStartPos.z),
    poleHeight: dieSize * 2.5,
    poleRadius: dieSize * 0.08,
    flagWidth: dieSize * 1.0,
    flagHeight: dieSize * 0.6,
    flagColor: 0xff0000, // Red flag
    poleColor: 0x8b4513, // Brown pole
  });

  // Add the blue flag to the scene
  blueFlag.addToScene(scene);

  // Add opposite start position to occupied positions
  occupiedPositions.push(oppositeStartPos.clone());

  // Create and add 6 blue dice in adjacent positions to the opposite flag
  diceCount = 0;

  // Try to place blue dice in shuffled positions around the opposite flag
  for (const offset of shuffledPositions) {
    if (diceCount >= maxDice) break;

    // Calculate absolute position (mirrored from red dice)
    const position = new THREE.Vector3(
      oppositeStartPos.x + offset.x,
      dieSize / 2, // Keep y position at half the die height
      oppositeStartPos.z + offset.z
    );

    // Check if position is within board boundaries and not occupied
    if (
      gameBoard.isWithinBoundaries(position) &&
      !isPositionOccupied(position)
    ) {
      // Create die with blue color and a specific top face
      const faceValue = (diceCount % 6) + 1; // Assign values 1-6
      const blueDie = new Die({
        size: dieSize,
        position: position,
        color: "#0066ff", // Blue dice
        pipColor: "#ffffff",
        initialTopFace: faceValue, // Set the initial top face
      });

      // Set anisotropy for better texture quality
      blueDie.setAnisotropy(renderer.capabilities.getMaxAnisotropy());

      // Add to scene and dice array
      scene.add(blueDie.mesh);
      blueDice.push(blueDie);

      // Mark position as occupied
      occupiedPositions.push(position.clone());

      // Increment dice count
      diceCount++;
    }
  }

  // Make sure all dice have their top face calculated correctly
  redDice.forEach((die) => {
    die.updateTopFaceFromRotation();
  });

  blueDice.forEach((die) => {
    die.updateTopFaceFromRotation();
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

  // Initialize cursor at a default position
  const cursorPosition = new THREE.Vector3(0, 0, 0);
  // Target position for smooth cursor movement
  const cursorTargetPosition = new THREE.Vector3(0, 0, 0);
  updateCursorPosition();
  scene.add(cursor);

  // Array to store selected dice
  let selectedDice: Die[] = [];

  // Track if a die is currently rolling
  let isRolling = false;

  // Track if cursor is currently moving
  let isCursorMoving = false;

  // Track game state
  let gameOver = false;
  let winner: "red" | "blue" | null = null;

  // Track key states
  const keyStates: { [key: string]: boolean } = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
  };

  // Function to update cursor position
  function updateCursorPosition() {
    cursor.position.x = cursorPosition.x;
    cursor.position.z = cursorPosition.z;
  }

  // Function to update info display
  function updateInfoDisplay() {
    // Get all red dice top faces for debugging
    const redDiceFaces = redDice
      .map((die) => `Red Die ${redDice.indexOf(die) + 1}: ${die.topFace}`)
      .join("<br>");

    // Get all blue dice top faces for debugging
    const blueDiceFaces = blueDice
      .map((die) => `Blue Die ${blueDice.indexOf(die) + 1}: ${die.topFace}`)
      .join("<br>");

    // Get the highest rank among red dice
    const { rank } = findHighestRankDice();

    if (selectedDice.length === 0) {
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

    const activeDie = selectedDice[0];
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

  // Function to update game status display
  function updateGameStatusDisplay() {
    if (gameOver) {
      gameStatusDisplay.innerHTML = `
        <div class="game-over">
          <h2>Game Over!</h2>
          <h3>${winner === "red" ? "Red" : "Blue"} team wins!</h3>
          <button id="restart-button">Restart Game</button>
        </div>
      `;

      // Add event listener to restart button
      const restartButton = document.getElementById("restart-button");
      if (restartButton) {
        restartButton.addEventListener("click", restartGame);
      }
    } else {
      gameStatusDisplay.innerHTML = `
        <div class="game-status-info">
          <p>Red Dice: ${redDice.length}</p>
          <p>Blue Dice: ${blueDice.length}</p>
        </div>
      `;
    }
  }

  // Function to restart the game
  function restartGame() {
    // Reload the page for simplicity
    window.location.reload();
  }

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

  // Function to move cursor with animation
  function moveCursor(direction: THREE.Vector3) {
    // Don't start a new movement if already moving
    if (isCursorMoving) return;

    // Find red dice with highest rank
    const { dice: highestDice } = findHighestRankDice();

    // If no highest dice, don't move cursor
    if (highestDice.length === 0) return;

    // Find the next die in the direction of movement
    let nextDie: Die | null = null;
    let minDistance = Number.POSITIVE_INFINITY;

    // Current cursor position
    const currentX = cursorPosition.x;
    const currentZ = cursorPosition.z;

    // Direction values
    const dirX = direction.x;
    const dirZ = direction.z;

    // First pass: Try to find a die in the same row/column
    for (const die of highestDice) {
      const dieX = die.mesh.position.x;
      const dieZ = die.mesh.position.z;

      // Calculate distance from cursor to die
      const distX = dieX - currentX;
      const distZ = dieZ - currentZ;

      // Check if die is in the correct direction
      const isInDirection =
        (dirX > 0 && distX > 0) || // Right
        (dirX < 0 && distX < 0) || // Left
        (dirZ > 0 && distZ > 0) || // Down
        (dirZ < 0 && distZ < 0); // Up

      if (!isInDirection) continue;

      // For horizontal movement, check if die is in roughly the same row
      if (Math.abs(dirX) > 0 && Math.abs(distZ) > dieSize * 0.5) continue;

      // For vertical movement, check if die is in roughly the same column
      if (Math.abs(dirZ) > 0 && Math.abs(distX) > dieSize * 0.5) continue;

      // Calculate absolute distance
      const distance = Math.sqrt(distX * distX + distZ * distZ);

      // If this die is closer than the current closest, update
      if (distance < minDistance) {
        minDistance = distance;
        nextDie = die;
      }
    }

    // If we didn't find a die in the same row/column, look for the nearest die in any row/column
    if (!nextDie) {
      // For horizontal movement (left/right), find the nearest row with a die
      if (Math.abs(dirX) > 0) {
        // Find all rows that have dice in the correct direction
        const rows = new Map<number, Die[]>();

        for (const die of highestDice) {
          const dieX = die.mesh.position.x;
          const dieZ = die.mesh.position.z;
          const distX = dieX - currentX;

          // Check if die is in the correct direction
          const isInDirection =
            (dirX > 0 && distX > 0) || (dirX < 0 && distX < 0);

          if (isInDirection) {
            // Group by Z coordinate (row)
            if (!rows.has(dieZ)) {
              rows.set(dieZ, []);
            }
            rows.get(dieZ)!.push(die);
          }
        }

        // Find the nearest row
        let nearestRowDist = Number.POSITIVE_INFINITY;
        let nearestRowDice: Die[] = [];

        for (const [rowZ, rowDice] of rows.entries()) {
          const rowDist = Math.abs(rowZ - currentZ);
          if (rowDist < nearestRowDist) {
            nearestRowDist = rowDist;
            nearestRowDice = rowDice;
          }
        }

        // Find the nearest die in the nearest row
        if (nearestRowDice.length > 0) {
          for (const die of nearestRowDice) {
            const dieX = die.mesh.position.x;
            const distX = dieX - currentX;
            const distance = Math.abs(distX);

            if (distance < minDistance) {
              minDistance = distance;
              nextDie = die;
            }
          }
        }
      }

      // For vertical movement (up/down), find the nearest column with a die
      if (Math.abs(dirZ) > 0) {
        // Find all columns that have dice in the correct direction
        const columns = new Map<number, Die[]>();

        for (const die of highestDice) {
          const dieX = die.mesh.position.x;
          const dieZ = die.mesh.position.z;
          const distZ = dieZ - currentZ;

          // Check if die is in the correct direction
          const isInDirection =
            (dirZ > 0 && distZ > 0) || (dirZ < 0 && distZ < 0);

          if (isInDirection) {
            // Group by X coordinate (column)
            if (!columns.has(dieX)) {
              columns.set(dieX, []);
            }
            columns.get(dieX)!.push(die);
          }
        }

        // Find the nearest column
        let nearestColDist = Number.POSITIVE_INFINITY;
        let nearestColDice: Die[] = [];

        for (const [colX, colDice] of columns.entries()) {
          const colDist = Math.abs(colX - currentX);
          if (colDist < nearestColDist) {
            nearestColDist = colDist;
            nearestColDice = colDice;
          }
        }

        // Find the nearest die in the nearest column
        if (nearestColDice.length > 0) {
          for (const die of nearestColDice) {
            const dieZ = die.mesh.position.z;
            const distZ = dieZ - currentZ;
            const distance = Math.abs(distZ);

            if (distance < minDistance) {
              minDistance = distance;
              nextDie = die;
            }
          }
        }
      }
    }

    // If we found a die, move cursor to it with animation and select it
    if (nextDie) {
      // Animate cursor movement
      animateCursorMovement(
        nextDie.mesh.position.x,
        nextDie.mesh.position.z,
        300,
        () => {
          // Select the die after cursor arrives
          selectedDice = [nextDie!];
          updateHighlightedDice();
        }
      );
    }
  }

  // Function to find all red dice with the highest rank
  const findHighestRankDice = (): { dice: Die[]; rank: number } => {
    let highestRank = 0;

    // First find the highest rank among red dice only
    redDice.forEach((die) => {
      if (die.topFace > highestRank) {
        highestRank = die.topFace;
      }
    });

    // Then collect all red dice with that rank
    const highestDice = redDice.filter((die) => die.topFace === highestRank);

    return { dice: highestDice, rank: highestRank };
  };

  // Update which dice are highlighted
  const updateHighlightedDice = (): void => {
    // Find red dice with highest rank
    const { dice: highestDice } = findHighestRankDice();

    // Unhighlight all dice
    redDice.forEach((die) => die.highlight(false));
    // Blue dice are never highlighted or selectable
    blueDice.forEach((die) => die.highlight(false));

    // Highlight highest-ranked red dice with appropriate colors
    highestDice.forEach((die) => {
      // If this die is in the selected dice array, highlight it as selected (yellow)
      // Otherwise, highlight it as movable but not selected (orange)
      die.highlight(true, selectedDice.includes(die));
    });

    // If there's only one highest die and no dice are selected, auto-select it
    if (highestDice.length === 1 && selectedDice.length === 0) {
      selectedDice = [highestDice[0]];
      // Update the highlight to show it's selected
      highestDice[0].highlight(true, true);

      // Move cursor to the selected die with animation
      animateCursorMovement(
        highestDice[0].mesh.position.x,
        highestDice[0].mesh.position.z
      );
    }

    // Update info display
    updateInfoDisplay();
  };

  // Initialize highlighted dice
  updateHighlightedDice();

  // Function to check if a position is orthogonally adjacent to a die
  const isOrthogonallyAdjacentToDie = (
    position: THREE.Vector3,
    die: Die
  ): boolean => {
    const diePos = die.mesh.position.clone();

    // Check if the position is orthogonally adjacent (no diagonals)
    // This means it's exactly one die size away in either X or Z direction, but not both
    const dx = Math.abs(position.x - diePos.x);
    const dz = Math.abs(position.z - diePos.z);

    // For orthogonal adjacency, one of the differences should be approximately equal to die size
    // and the other should be approximately zero
    return (
      (Math.abs(dx - dieSize) < 0.1 && dz < 0.1) ||
      (Math.abs(dz - dieSize) < 0.1 && dx < 0.1)
    );
  };

  // Function to check if a die can move in a direction
  const canDieMove = (die: Die, direction: THREE.Vector3): boolean => {
    // Calculate new position after rolling
    const newPosition = die.mesh.position
      .clone()
      .add(direction.clone().multiplyScalar(dieSize));

    // Check if new position is within boundaries
    if (!gameBoard.isWithinBoundaries(newPosition)) {
      return false;
    }

    // Check if new position is occupied by a die of the same color
    const isSameColorDieAtPosition = (
      position: THREE.Vector3,
      isRed: boolean
    ): boolean => {
      const diceArray = isRed ? redDice : blueDice;
      return diceArray.some(
        (d) =>
          Math.abs(d.mesh.position.x - position.x) < 0.1 &&
          Math.abs(d.mesh.position.z - position.z) < 0.1
      );
    };

    // If the die is red and there's another red die at the new position, can't move
    if (redDice.includes(die) && isSameColorDieAtPosition(newPosition, true)) {
      return false;
    }

    // If the die is blue and there's another blue die at the new position, can't move
    if (
      blueDice.includes(die) &&
      isSameColorDieAtPosition(newPosition, false)
    ) {
      return false;
    }

    return true;
  };

  // Function to check if a die is among the highest rank red dice
  const isHighestRankDie = (die: Die): boolean => {
    const { dice: highestDice } = findHighestRankDice();
    return highestDice.includes(die);
  };

  // Function to create explosion effect
  function createExplosion(position: THREE.Vector3, color: number) {
    // Create particles
    const particleCount = 30;
    const particles: THREE.Mesh[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Create a small cube for each particle
      const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5,
      });

      const particle = new THREE.Mesh(geometry, material);

      // Position at explosion center
      particle.position.copy(position);

      // Random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.2,
        (Math.random() - 0.5) * 0.3
      );

      // Add to scene
      scene.add(particle);

      // Store particle with its velocity
      particles.push(particle);
      (particle as any).velocity = velocity;
    }

    // Animate particles
    const startTime = Date.now();

    function animateParticles() {
      const elapsed = Date.now() - startTime;

      // Remove particles after 1 second
      if (elapsed > 1000) {
        particles.forEach((particle) => scene.remove(particle));
        return;
      }

      // Update particle positions
      particles.forEach((particle) => {
        const vel = (particle as any).velocity;

        // Apply gravity
        vel.y -= 0.01;

        // Update position
        particle.position.add(vel);

        // Fade out
        const scale = 1 - elapsed / 1000;
        particle.scale.set(scale, scale, scale);
      });

      requestAnimationFrame(animateParticles);
    }

    animateParticles();
  }

  // Function to remove a die from the game
  function removeDie(die: Die, isRed: boolean) {
    // Create explosion effect
    createExplosion(die.mesh.position.clone(), isRed ? 0xff0000 : 0x0066ff);

    // Remove from scene
    scene.remove(die.mesh);

    // Remove from array
    const diceArray = isRed ? redDice : blueDice;
    const index = diceArray.indexOf(die);
    if (index !== -1) {
      diceArray.splice(index, 1);
    }

    // Remove from occupied positions
    const posIndex = occupiedPositions.findIndex(
      (pos) =>
        Math.abs(pos.x - die.mesh.position.x) < 0.1 &&
        Math.abs(pos.z - die.mesh.position.z) < 0.1
    );

    if (posIndex !== -1) {
      occupiedPositions.splice(posIndex, 1);
    }

    // If die was selected, deselect it
    if (selectedDice.includes(die)) {
      selectedDice = [];
    }

    // Check for win conditions
    checkWinConditions();

    // Update displays
    updateHighlightedDice();
    updateGameStatusDisplay();
  }

  // Function to check for collisions between dice
  function checkCollisions(activeDie: Die, newPosition: THREE.Vector3) {
    // Check if the active die is red
    const isRedDie = redDice.includes(activeDie);

    // Get the opposing dice array
    const opposingDice = isRedDie ? blueDice : redDice;

    // Check for collision with opposing dice
    for (const opposingDie of opposingDice) {
      if (
        Math.abs(opposingDie.mesh.position.x - newPosition.x) < 0.1 &&
        Math.abs(opposingDie.mesh.position.z - newPosition.z) < 0.1
      ) {
        // Collision detected!
        // If red die collides with blue die, remove blue die
        if (isRedDie) {
          removeDie(opposingDie, false);
        }
        // If blue die collides with red die, remove red die
        else {
          removeDie(opposingDie, true);
        }

        return true;
      }
    }

    return false;
  }

  // Function to check if a die is at a flag position
  function checkFlagCapture(die: Die) {
    const isRedDie = redDice.includes(die);

    // Check if red die is at blue flag (opposite start position)
    if (
      isRedDie &&
      Math.abs(die.mesh.position.x - oppositeStartPos.x) < 0.1 &&
      Math.abs(die.mesh.position.z - oppositeStartPos.z) < 0.1
    ) {
      // Red team wins!
      gameOver = true;
      winner = "red";
      updateGameStatusDisplay();
      return true;
    }

    // Check if blue die is at red flag (start position)
    if (
      !isRedDie &&
      Math.abs(die.mesh.position.x - startPosition.x) < 0.1 &&
      Math.abs(die.mesh.position.z - startPosition.z) < 0.1
    ) {
      // Blue team wins!
      gameOver = true;
      winner = "blue";
      updateGameStatusDisplay();
      return true;
    }

    return false;
  }

  // Function to check win conditions
  function checkWinConditions() {
    // If game is already over, don't check again
    if (gameOver) return;

    // Check if all red dice are eliminated
    if (redDice.length === 0 && blueDice.length > 0) {
      gameOver = true;
      winner = "blue";
      updateGameStatusDisplay();
      return;
    }

    // Check if all blue dice are eliminated
    if (blueDice.length === 0 && redDice.length > 0) {
      gameOver = true;
      winner = "red";
      updateGameStatusDisplay();
      return;
    }
  }

  // Function to handle die movement
  function moveDie(direction: THREE.Vector3) {
    if (isRolling || selectedDice.length === 0 || gameOver) return;

    const activeDie = selectedDice[0];

    // Check if the die is a red die (only red dice can be controlled)
    if (!redDice.includes(activeDie)) {
      // If not a red die, deselect it and update highlighted dice
      selectedDice = [];
      updateHighlightedDice();
      return;
    }

    // Check if the die is still among the highest rank
    if (!isHighestRankDie(activeDie)) {
      // If not, update highlighted dice and return
      updateHighlightedDice();
      return;
    }

    // Check if the die can move in the given direction
    if (canDieMove(activeDie, direction)) {
      // Calculate new position
      const oldPosition = activeDie.mesh.position.clone();
      const newPosition = oldPosition
        .clone()
        .add(direction.clone().multiplyScalar(dieSize));

      // Set rolling flag
      isRolling = true;

      // Start cursor movement simultaneously with die roll
      // The duration matches the typical roll animation time
      animateCursorMovement(newPosition.x, newPosition.z, 500);

      // Roll the die
      activeDie.roll(direction, gameBoard.boundaryLimit, () => {
        // After rolling completes, update occupied positions
        // Remove old position from occupied list
        const oldIndex = occupiedPositions.findIndex(
          (pos) =>
            Math.abs(pos.x - oldPosition.x) < 0.1 &&
            Math.abs(pos.z - oldPosition.z) < 0.1
        );
        if (oldIndex !== -1) {
          occupiedPositions.splice(oldIndex, 1);
        }

        // Check for collisions with opposing dice
        const collisionOccurred = checkCollisions(activeDie, newPosition);

        // If no collision, add new position to occupied list
        if (!collisionOccurred) {
          occupiedPositions.push(newPosition.clone());
        }

        // Check if die captured a flag
        checkFlagCapture(activeDie);

        // Update highlights
        updateHighlightedDice();

        // Reset rolling flag
        isRolling = false;

        // Check if any movement keys are still pressed and the die is still highest rank
        if (!gameOver) {
          checkContinuousMovement();
        }
      });
    }
  }

  // Function to check if continuous movement should continue
  function checkContinuousMovement() {
    if (selectedDice.length === 0 || gameOver) return;

    const activeDie = selectedDice[0];

    // Only continue if the die is a red die
    if (!redDice.includes(activeDie)) return;

    // Only continue if the die is still highest rank
    if (!isHighestRankDie(activeDie)) return;

    // Check which movement key is pressed
    let direction: THREE.Vector3 | null = null;

    if (keyStates.KeyW) {
      direction = new THREE.Vector3(0, 0, -1); // Forward
    } else if (keyStates.KeyS) {
      direction = new THREE.Vector3(0, 0, 1); // Backward
    } else if (keyStates.KeyA) {
      direction = new THREE.Vector3(-1, 0, 0); // Left
    } else if (keyStates.KeyD) {
      direction = new THREE.Vector3(1, 0, 0); // Right
    }

    // If a direction key is pressed, continue movement
    if (direction) {
      moveDie(direction);
    }
  }

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
    // For top-down view, we move in X and Z while keeping Y constant
    const deltaX = -deltaMove.x * panSpeed;
    const deltaZ = deltaMove.y * panSpeed; // Inverted for intuitive panning

    // Apply panning without limits
    camera.position.x += deltaX;
    camera.position.z += deltaZ;

    // Update the camera target to maintain the top-down view
    const target = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    camera.lookAt(target);

    // Update previous position
    previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  });

  function recenterCamera() {
    camera.position.copy(initialCameraPosition);
    camera.lookAt(initialCameraTarget);
  }

  // Handle keyboard events for key down
  window.addEventListener("keydown", (event) => {
    // Don't process new key events if game is over
    if (gameOver) return;

    // Don't process new key events if cursor is moving
    if (
      isCursorMoving &&
      (event.code === "ArrowUp" ||
        event.code === "ArrowDown" ||
        event.code === "ArrowLeft" ||
        event.code === "ArrowRight")
    ) {
      return;
    }

    // Arrow keys for cursor movement
    if (event.code === "ArrowUp") {
      moveCursor(new THREE.Vector3(0, 0, -1)); // Move cursor forward
    } else if (event.code === "ArrowDown") {
      moveCursor(new THREE.Vector3(0, 0, 1)); // Move cursor backward
    } else if (event.code === "ArrowLeft") {
      moveCursor(new THREE.Vector3(-1, 0, 0)); // Move cursor left
    } else if (event.code === "ArrowRight") {
      moveCursor(new THREE.Vector3(1, 0, 0)); // Move cursor right
    }

    // WASD keys for dice movement
    if (
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD"
    ) {
      // Update key state
      keyStates[event.code] = true;

      // Only process if not already rolling
      if (!isRolling) {
        let direction: THREE.Vector3 | null = null;

        if (event.code === "KeyW") {
          direction = new THREE.Vector3(0, 0, -1); // Forward
        } else if (event.code === "KeyS") {
          direction = new THREE.Vector3(0, 0, 1); // Backward
        } else if (event.code === "KeyA") {
          direction = new THREE.Vector3(-1, 0, 0); // Left
        } else if (event.code === "KeyD") {
          direction = new THREE.Vector3(1, 0, 0); // Right
        }

        if (direction) {
          moveDie(direction);
        }
      }
    }

    // Q and E keys for rotating dice in place
    if (event.code === "KeyQ" || event.code === "KeyE") {
      if (!isRolling && selectedDice.length > 0) {
        const activeDie = selectedDice[0];

        // Check if the die is a red die (only red dice can be controlled)
        if (!redDice.includes(activeDie)) {
          // If not a red die, deselect it and update highlighted dice
          selectedDice = [];
          updateHighlightedDice();
          return;
        }

        // Check if the die is still among the highest rank
        if (!isHighestRankDie(activeDie)) {
          updateHighlightedDice();
          return;
        }

        // Set rotation direction based on key
        const direction = event.code === "KeyQ" ? "left" : "right";

        // Set rolling flag
        isRolling = true;

        // Rotate the die
        activeDie.rotateInPlace(direction, () => {
          // After rotation completes

          // Update highlights
          updateHighlightedDice();

          // Reset rolling flag
          isRolling = false;
        });
      }
    }

    // Space or Enter to select a die at cursor position
    if (event.code === "Space" || event.code === "Enter") {
      if (isCursorMoving) return;

      const { dice: highestDice } = findHighestRankDice();
      const dieAtCursor = highestDice.find(
        (die) =>
          Math.abs(die.mesh.position.x - cursorPosition.x) < 0.1 &&
          Math.abs(die.mesh.position.z - cursorPosition.z) < 0.1
      );

      if (dieAtCursor) {
        selectedDice = [dieAtCursor];
        updateHighlightedDice();
      }
    }

    // Handle camera recentering with F key
    if (event.code === "KeyF") {
      recenterCamera();
    }

    // For testing: Allow manually setting die values with number keys 1-6
    if (event.code.startsWith("Digit") && selectedDice.length > 0) {
      const digit = Number.parseInt(event.code.replace("Digit", ""));
      if (digit >= 1 && digit <= 6) {
        const activeDie = selectedDice[0];

        // Only allow setting values for red dice
        if (redDice.includes(activeDie)) {
          activeDie.setTopFace(digit);
          updateHighlightedDice();
        }
      }
    }
  });

  // Handle keyboard events for key up
  window.addEventListener("keyup", (event) => {
    // Update key state
    if (event.code in keyStates) {
      keyStates[event.code] = false;
    }
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Make the cursor pulsate slightly for better visibility with uniform scaling
    const pulseFactor = 0.1 * Math.sin(Date.now() * 0.005) + 1;
    cursor.scale.set(pulseFactor, pulseFactor, pulseFactor);

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
