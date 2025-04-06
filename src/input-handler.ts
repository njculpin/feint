import * as THREE from "three";
import type { Die } from "./models/die";

// Update the InputHandlerOptions interface to use aiManager.isAIMoving
export interface InputHandlerOptions {
  camera: THREE.PerspectiveCamera;
  initialCameraPosition: THREE.Vector3;
  initialCameraTarget: THREE.Vector3;
  container: HTMLElement;
  dieSize: number;
  gameBoard: {
    boundaryLimit: number;
  };
  cursor: {
    position: THREE.Vector3;
    targetPosition: THREE.Vector3;
    updatePosition: () => void;
    mesh: THREE.Object3D | null;
  };
  dice: {
    redDice: Die[];
    blueDice: Die[];
    selectedDice: Die[];
    isRolling: boolean;
    isPlayerTurn: boolean;
    isAIMoving: boolean;
    findHighestRankDice: () => { dice: Die[]; rank: number };
    isHighestRankDie: (die: Die) => boolean;
    updateHighlightedDice: (cursorPosition?: THREE.Vector3) => void;
    moveDie: (
      direction: THREE.Vector3,
      animateCursorMovement?: (
        x: number,
        z: number,
        duration?: number,
        onComplete?: () => void
      ) => void
    ) => void;
    checkContinuousMovement: () => void;
  };
  state: {
    gameOver: boolean;
    isCursorMoving: boolean;
  };
  animateCursorMovement: (
    targetX: number,
    targetZ: number,
    duration?: number,
    onComplete?: () => void
  ) => void;
}

export class InputHandler {
  private camera: THREE.PerspectiveCamera;
  private initialCameraPosition: THREE.Vector3;
  private initialCameraTarget: THREE.Vector3;
  private container: HTMLElement;
  private dieSize: number;
  private gameBoard: { boundaryLimit: number };
  private cursor: {
    position: THREE.Vector3;
    targetPosition: THREE.Vector3;
    updatePosition: () => void;
    mesh: THREE.Object3D | null;
  };
  private dice: {
    redDice: Die[];
    blueDice: Die[];
    selectedDice: Die[];
    isRolling: boolean;
    isPlayerTurn: boolean;
    isAIMoving: boolean;
    findHighestRankDice: () => { dice: Die[]; rank: number };
    isHighestRankDie: (die: Die) => boolean;
    updateHighlightedDice: (cursorPosition?: THREE.Vector3) => void;
    moveDie: (
      direction: THREE.Vector3,
      animateCursorMovement?: (
        x: number,
        z: number,
        duration?: number,
        onComplete?: () => void
      ) => void
    ) => void;
    checkContinuousMovement: () => void;
  };
  private state: {
    gameOver: boolean;
    isCursorMoving: boolean;
  };
  private animateCursorMovement: (
    targetX: number,
    targetZ: number,
    duration?: number,
    onComplete?: () => void
  ) => void;

  // Camera panning variables
  private isPanning = false;
  private previousMousePosition = { x: 0, y: 0 };
  private panSpeed = 0.05;

  // Track key states
  private keyStates: { [key: string]: boolean } = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
  };

  // Add raycaster and mouse properties
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private isCtrlPressed = false;
  private clickCooldown = false;

  // Add mouse click handling to the InputHandler class

  // Update the constructor to include raycaster for mouse picking
  constructor(options: InputHandlerOptions) {
    this.camera = options.camera;
    this.initialCameraPosition = options.initialCameraPosition;
    this.initialCameraTarget = options.initialCameraTarget;
    this.container = options.container;
    this.dieSize = options.dieSize;
    this.gameBoard = options.gameBoard;
    this.cursor = options.cursor;
    this.dice = options.dice;
    this.state = options.state;
    this.animateCursorMovement = options.animateCursorMovement;

    // Initialize raycaster for mouse picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupEventListeners();
  }

  // Update setupEventListeners to include mouse click and ctrl key detection
  private setupEventListeners() {
    // Handle mouse events for panning
    this.container.addEventListener("contextmenu", this.onContextMenu);
    this.container.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);

    // Add click event for die selection
    this.container.addEventListener("click", this.onClick);

    // Handle keyboard events
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  // Update cleanup to remove new event listeners
  public cleanup() {
    // Remove event listeners when no longer needed
    this.container.removeEventListener("contextmenu", this.onContextMenu);
    this.container.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.container.removeEventListener("click", this.onClick);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault(); // Prevent context menu from appearing
  };

  private onMouseDown = (event: MouseEvent) => {
    // Only start panning on right mouse button
    if (event.button === 2) {
      this.isPanning = true;
      this.previousMousePosition = {
        x: event.clientX,
        y: event.clientY,
      };
    }
  };

  private onMouseUp = () => {
    this.isPanning = false;
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.isPanning) return;

    // Calculate mouse movement
    const deltaMove = {
      x: event.clientX - this.previousMousePosition.x,
      y: event.clientY - this.previousMousePosition.y,
    };

    // Update camera position based on mouse movement
    const deltaX = -deltaMove.x * this.panSpeed;
    const deltaZ = deltaMove.y * this.panSpeed; // Inverted for intuitive panning

    // Apply panning without changing the camera's height (Y position)
    this.camera.position.x += deltaX;
    this.camera.position.z += deltaZ;

    // Always look at the center of the board (0,0,0) to keep it in view
    this.camera.lookAt(this.initialCameraTarget);

    // Update previous position
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  // Add onClick handler for die selection
  private onClick = (event: MouseEvent) => {
    // Don't process clicks if game is over or dice are rolling
    if (this.state.gameOver || this.dice.isRolling || this.clickCooldown)
      return;

    // Set a cooldown to prevent multiple rapid clicks
    this.clickCooldown = true;
    setTimeout(() => {
      this.clickCooldown = false;
    }, 300);

    // Don't process right clicks (used for camera panning)
    if (event.button !== 0) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this.container.getBoundingClientRect();
    this.mouse.x =
      ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
    this.mouse.y =
      -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Find all red dice with highest rank
    const { dice: highestDice } = this.dice.findHighestRankDice();

    // Get all dice meshes for intersection testing
    const allDiceMeshes = [...this.dice.redDice, ...this.dice.blueDice].map(
      (die) => die.mesh
    );

    // Check for intersections with all dice
    const intersects = this.raycaster.intersectObjects(allDiceMeshes, false);

    if (intersects.length > 0) {
      // Find the die that was clicked
      const clickedMesh = intersects[0].object;

      // Find which die this mesh belongs to
      const clickedDie = [...this.dice.redDice, ...this.dice.blueDice].find(
        (die) => die.mesh === clickedMesh
      );

      if (clickedDie) {
        // Check if it's a red die with highest rank
        const isHighestRankRedDie =
          this.dice.redDice.includes(clickedDie) &&
          this.dice.isHighestRankDie(clickedDie);

        if (isHighestRankRedDie) {
          // If Ctrl is pressed, add to selection (or remove if already selected)
          if (this.isCtrlPressed) {
            const index = this.dice.selectedDice.indexOf(clickedDie);
            if (index !== -1) {
              // Remove from selection if already selected
              this.dice.selectedDice.splice(index, 1);
            } else {
              // Add to selection
              this.dice.selectedDice.push(clickedDie);
            }
          } else {
            // If Ctrl is not pressed, replace selection with just this die
            this.dice.selectedDice.length = 0;
            this.dice.selectedDice.push(clickedDie);
          }

          // Move cursor to the clicked die
          // Select the die without moving cursor
        }
      }
    } else if (!this.isCtrlPressed) {
      // If clicking empty space and Ctrl is not pressed, clear selection
      this.dice.selectedDice.length = 0;
    }

    // Always update highlighted dice and cursors after any click
    this.dice.updateHighlightedDice(this.cursor.position);
  };

  // Update onKeyDown to track Ctrl key state
  private onKeyDown = (event: KeyboardEvent) => {
    // Track Ctrl key state
    if (event.code === "ControlLeft" || event.code === "ControlRight") {
      this.isCtrlPressed = true;
    }

    // Don't process new key events if game is over
    if (this.state.gameOver) return;

    // Remove the turn-based restriction
    // if (!this.dice.isPlayerTurn || this.dice.isAIMoving) return

    // Don't process new key events if cursor is moving
    if (
      this.state.isCursorMoving &&
      (event.code === "ArrowUp" ||
        event.code === "ArrowDown" ||
        event.code === "ArrowLeft" ||
        event.code === "ArrowRight")
    ) {
      return;
    }

    // Arrow keys for cursor movement
    if (event.code === "ArrowUp") {
      this.moveCursor(new THREE.Vector3(0, 0, -1)); // Move cursor forward
    } else if (event.code === "ArrowDown") {
      this.moveCursor(new THREE.Vector3(0, 0, 1)); // Move cursor backward
    } else if (event.code === "ArrowLeft") {
      this.moveCursor(new THREE.Vector3(-1, 0, 0)); // Move cursor left
    } else if (event.code === "ArrowRight") {
      this.moveCursor(new THREE.Vector3(1, 0, 0)); // Move cursor right
    }

    // WASD keys for dice movement
    if (
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD"
    ) {
      // Update key state
      this.keyStates[event.code] = true;

      // Only process if not already rolling
      if (!this.dice.isRolling) {
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
          this.dice.moveDie(direction, this.animateCursorMovement);
        }
      }
    }
    // Q and E keys for rotating dice in place
    if (event.code === "KeyQ" || event.code === "KeyE") {
      if (!this.dice.isRolling && this.dice.selectedDice.length > 0) {
        // Filter selected dice to only include red dice with highest rank
        const validSelectedDice = this.dice.selectedDice.filter(
          (die) =>
            this.dice.redDice.includes(die) && this.dice.isHighestRankDie(die)
        );

        if (validSelectedDice.length === 0) {
          // No valid dice selected, update highlighted dice and return
          this.dice.selectedDice = [];
          this.dice.updateHighlightedDice();
          return;
        }

        // Set rotation direction based on key
        const direction = event.code === "KeyQ" ? "left" : "right";

        // Rotate all selected dice
        this.rotateSelectedDice(direction);
      }
    }

    // Space or Enter to select a die at cursor position
    if (event.code === "Space" || event.code === "Enter") {
      if (this.state.isCursorMoving) return;

      const { dice: highestDice } = this.dice.findHighestRankDice();
      const dieAtCursor = highestDice.find(
        (die) =>
          Math.abs(die.mesh.position.x - this.cursor.position.x) < 0.1 &&
          Math.abs(die.mesh.position.z - this.cursor.position.z) < 0.1
      );

      if (dieAtCursor) {
        if (this.isCtrlPressed) {
          // If Ctrl is pressed, toggle selection
          const index = this.dice.selectedDice.indexOf(dieAtCursor);
          if (index !== -1) {
            this.dice.selectedDice.splice(index, 1);
          } else {
            this.dice.selectedDice.push(dieAtCursor);
          }
        } else {
          // Otherwise, replace selection
          this.dice.selectedDice.length = 0;
          this.dice.selectedDice.push(dieAtCursor);
        }
        this.dice.updateHighlightedDice();
      }
    }

    // Handle camera recentering with F key
    if (event.code === "KeyF") {
      this.recenterCamera();
    }

    // For testing: Allow manually setting die values with number keys 1-6
    if (event.code.startsWith("Digit") && this.dice.selectedDice.length > 0) {
      const digit = Number.parseInt(event.code.replace("Digit", ""));
      if (digit >= 1 && digit <= 6) {
        const activeDie = this.dice.selectedDice[0];

        // Only allow setting values for red dice
        if (this.dice.redDice.includes(activeDie)) {
          activeDie.setTopFace(digit);
          this.dice.updateHighlightedDice();
        }
      }
    }
  };

  // Update onKeyUp to track Ctrl key state
  private onKeyUp = (event: KeyboardEvent) => {
    // Track Ctrl key state
    if (event.code === "ControlLeft" || event.code === "ControlRight") {
      this.isCtrlPressed = false;
    }

    // Update key state
    if (event.code in this.keyStates) {
      this.keyStates[event.code] = false;
    }
  };

  private moveCursor(direction: THREE.Vector3) {
    // Don't start a new movement if already moving
    if (this.state.isCursorMoving) return;

    // Find red dice with highest rank
    const { dice: highestDice } = this.dice.findHighestRankDice();

    // If no highest dice, don't move cursor
    if (highestDice.length === 0) return;

    // Find the next die in the direction of movement
    let nextDie: Die | null = null;
    let minDistance = Number.POSITIVE_INFINITY;

    // Current cursor position
    const currentX = this.cursor.position.x;
    const currentZ = this.cursor.position.z;

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
      if (Math.abs(dirX) > 0 && Math.abs(distZ) > this.dieSize * 0.5) continue;

      // For vertical movement, check if die is in roughly the same column
      if (Math.abs(dirZ) > 0 && Math.abs(distX) > this.dieSize * 0.5) continue;

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
      nextDie = this.findNearestDieInDirection(
        highestDice,
        direction,
        currentX,
        currentZ,
        minDistance
      );
    }

    // If we found a die, move cursor to it with animation and select it
    if (nextDie) {
      // Animate cursor movement
      this.animateCursorMovement(
        nextDie.mesh.position.x,
        nextDie.mesh.position.z,
        300,
        () => {
          // Select the die after cursor arrives
          this.dice.selectedDice[0] = nextDie!;
          this.dice.updateHighlightedDice();
        }
      );
    }
  }

  private findNearestDieInDirection(
    highestDice: Die[],
    direction: THREE.Vector3,
    currentX: number,
    currentZ: number,
    minDistance: number
  ): Die | null {
    let nextDie: Die | null = null;
    const dirX = direction.x;
    const dirZ = direction.z;

    // For horizontal movement (left/right), find the nearest row with a die
    if (Math.abs(dirX) > 0) {
      nextDie = this.findNearestDieInHorizontalDirection(
        highestDice,
        dirX,
        currentX,
        currentZ,
        minDistance
      );
    }

    // For vertical movement (up/down), find the nearest column with a die
    if (Math.abs(dirZ) > 0 && !nextDie) {
      nextDie = this.findNearestDieInVerticalDirection(
        highestDice,
        dirZ,
        currentX,
        currentZ,
        minDistance
      );
    }

    return nextDie;
  }

  private findNearestDieInHorizontalDirection(
    highestDice: Die[],
    dirX: number,
    currentX: number,
    currentZ: number,
    minDistance: number
  ): Die | null {
    // Find all rows that have dice in the correct direction
    const rows = new Map<number, Die[]>();

    for (const die of highestDice) {
      const dieX = die.mesh.position.x;
      const dieZ = die.mesh.position.z;
      const distX = dieX - currentX;

      // Check if die is in the correct direction
      const isInDirection = (dirX > 0 && distX > 0) || (dirX < 0 && distX < 0);

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
    let nextDie: Die | null = null;
    let minDist = minDistance;

    if (nearestRowDice.length > 0) {
      for (const die of nearestRowDice) {
        const dieX = die.mesh.position.x;
        const distX = dieX - currentX;
        const distance = Math.abs(distX);

        if (distance < minDist) {
          minDist = distance;
          nextDie = die;
        }
      }
    }

    return nextDie;
  }

  private findNearestDieInVerticalDirection(
    highestDice: Die[],
    dirZ: number,
    currentX: number,
    currentZ: number,
    minDistance: number
  ): Die | null {
    // Find all columns that have dice in the correct direction
    const columns = new Map<number, Die[]>();

    for (const die of highestDice) {
      const dieX = die.mesh.position.x;
      const dieZ = die.mesh.position.z;
      const distZ = dieZ - currentZ;

      // Check if die is in the correct direction
      const isInDirection = (dirZ > 0 && distZ > 0) || (dirZ < 0 && distZ < 0);

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
    let nextDie: Die | null = null;
    let minDist = minDistance;

    if (nearestColDice.length > 0) {
      for (const die of nearestColDice) {
        const dieZ = die.mesh.position.z;
        const distZ = dieZ - currentZ;
        const distance = Math.abs(distZ);

        if (distance < minDist) {
          minDist = distance;
          nextDie = die;
        }
      }
    }

    return nextDie;
  }

  // Update rotateSelectedDie to handle multiple dice
  private rotateSelectedDice(direction: "left" | "right") {
    if (this.dice.isRolling || this.dice.selectedDice.length === 0) return;

    // Filter selected dice to only include red dice with highest rank
    const validSelectedDice = this.dice.selectedDice.filter(
      (die) =>
        this.dice.redDice.includes(die) && this.dice.isHighestRankDie(die)
    );

    if (validSelectedDice.length === 0) return;

    // Set rolling flag (this will be reset in the callback)
    this.dice.isRolling = true;

    // Track how many dice are still rotating
    let pendingRotations = validSelectedDice.length;

    // Rotate each selected die
    validSelectedDice.forEach((die) => {
      die.rotateInPlace(direction, () => {
        // After each die completes rotation
        pendingRotations--;

        // When all dice have completed rotation
        if (pendingRotations === 0) {
          // Update highlights
          this.dice.updateHighlightedDice();

          // Reset rolling flag
          this.dice.isRolling = false;
        }
      });
    });
  }

  public recenterCamera() {
    this.camera.position.copy(this.initialCameraPosition);
    this.camera.lookAt(this.initialCameraTarget);
  }

  public getKeyStates() {
    return { ...this.keyStates };
  }
}
