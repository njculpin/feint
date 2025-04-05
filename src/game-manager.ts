import * as THREE from "three";
import { Die } from "./models/die";
import { GameBoard } from "./models/board";
import { Flag } from "./models/flag";

export interface GameManagerOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  dieSize: number;
  gridSize: number;
}

export class GameManager {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public gameBoard: GameBoard;
  public redDice: Die[] = [];
  public blueDice: Die[] = [];
  public selectedDice: Die[] = [];
  public occupiedPositions: THREE.Vector3[] = [];
  public isRolling = false;
  public gameOver = false;
  public winner: "red" | "blue" | null = null;
  public startPosition: THREE.Vector3;
  public oppositeStartPos: THREE.Vector3;
  public blueFlag: Flag;

  constructor(options: GameManagerOptions) {
    this.scene = options.scene;
    this.renderer = options.renderer;

    // Create game board
    this.gameBoard = new GameBoard({
      cellSize: options.dieSize,
      gridSize: options.gridSize,
      color: 0x222222,
      borderColor: 0x444444,
      gridColor: 0x444444,
      startMarkerColor: 0x0066ff, // Blue button
    });

    // Add game board to scene
    this.gameBoard.addToScene(this.scene);

    // Get starting position for die
    this.startPosition = this.gameBoard.getStartPosition(options.dieSize);

    // Create a red flag on the opposite side of the board for blue dice
    this.oppositeStartPos = new THREE.Vector3(
      -this.startPosition.x,
      0,
      -this.startPosition.z
    );

    // Create red flag for blue dice
    this.blueFlag = new Flag({
      position: new THREE.Vector3(
        this.oppositeStartPos.x,
        0,
        this.oppositeStartPos.z
      ),
      poleHeight: options.dieSize * 2.5,
      poleRadius: options.dieSize * 0.08,
      flagWidth: options.dieSize * 1.0,
      flagHeight: options.dieSize * 0.6,
      flagColor: 0xff0000, // Red flag
      poleColor: 0x8b4513, // Brown pole
    });

    // Add the blue flag to the scene
    this.blueFlag.addToScene(this.scene);

    // Initialize the game
    this.initializeGame(options.dieSize);
  }

  private initializeGame(dieSize: number) {
    // Add start position to occupied positions (to prevent placing dice there)
    this.occupiedPositions.push(this.startPosition.clone());

    // Add opposite start position to occupied positions
    this.occupiedPositions.push(this.oppositeStartPos.clone());

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

    // Shuffle the adjacent positions array for random placement
    const shuffledPositions = [...adjacentPositions].sort(
      () => Math.random() - 0.5
    );

    // Create red dice
    this.createDice(shuffledPositions, dieSize, true);

    // Create blue dice
    this.createDice(shuffledPositions, dieSize, false);

    // Make sure all dice have their top face calculated correctly
    this.redDice.forEach((die) => die.updateTopFaceFromRotation());
    this.blueDice.forEach((die) => die.updateTopFaceFromRotation());
  }

  private createDice(
    shuffledPositions: THREE.Vector3[],
    dieSize: number,
    isRed: boolean
  ) {
    let diceCount = 0;
    const maxDice = 6;
    const basePosition = isRed ? this.startPosition : this.oppositeStartPos;
    const diceArray = isRed ? this.redDice : this.blueDice;
    const color = isRed ? "#ff0000" : "#0066ff";

    // Try to place dice in shuffled positions
    for (const offset of shuffledPositions) {
      if (diceCount >= maxDice) break;

      // Calculate absolute position
      const position = new THREE.Vector3(
        basePosition.x + offset.x,
        dieSize / 2, // Keep y position at half the die height
        basePosition.z + offset.z
      );

      // Check if position is within board boundaries and not occupied
      if (
        this.gameBoard.isWithinBoundaries(position) &&
        !this.isPositionOccupied(position)
      ) {
        // Create die with specific color and a specific top face
        const faceValue = (diceCount % 6) + 1; // Assign values 1-6
        const die = new Die({
          size: dieSize,
          position: position,
          color: color,
          pipColor: "#ffffff",
          initialTopFace: faceValue, // Set the initial top face
        });

        // Set anisotropy for better texture quality
        die.setAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

        // Add to scene and dice array
        this.scene.add(die.mesh);
        diceArray.push(die);

        // Mark position as occupied
        this.occupiedPositions.push(position.clone());

        // Increment dice count
        diceCount++;
      }
    }
  }

  public isPositionOccupied(position: THREE.Vector3): boolean {
    return this.occupiedPositions.some(
      (pos) => pos.x === position.x && pos.z === position.z
    );
  }

  public findHighestRankDice(): { dice: Die[]; rank: number } {
    let highestRank = 0;

    // First find the highest rank among red dice only
    this.redDice.forEach((die) => {
      if (die.topFace > highestRank) {
        highestRank = die.topFace;
      }
    });

    // Then collect all red dice with that rank
    const highestDice = this.redDice.filter(
      (die) => die.topFace === highestRank
    );

    return { dice: highestDice, rank: highestRank };
  }

  public isHighestRankDie(die: Die): boolean {
    const { dice: highestDice } = this.findHighestRankDice();
    return highestDice.includes(die);
  }

  public updateHighlightedDice(): void {
    // Find red dice with highest rank
    const { dice: highestDice } = this.findHighestRankDice();

    // Unhighlight all dice
    this.redDice.forEach((die) => die.highlight(false));
    // Blue dice are never highlighted or selectable
    this.blueDice.forEach((die) => die.highlight(false));

    // Highlight highest-ranked red dice with appropriate colors
    highestDice.forEach((die) => {
      // If this die is in the selected dice array, highlight it as selected (yellow)
      // Otherwise, highlight it as movable but not selected (orange)
      die.highlight(true, this.selectedDice.includes(die));
    });

    // If there's only one highest die and no dice are selected, auto-select it
    if (highestDice.length === 1 && this.selectedDice.length === 0) {
      this.selectedDice[0] = highestDice[0];
      // Update the highlight to show it's selected
      highestDice[0].highlight(true, true);
    }
  }

  public canDieMove(die: Die, direction: THREE.Vector3): boolean {
    // Calculate new position after rolling
    const newPosition = die.mesh.position
      .clone()
      .add(direction.clone().multiplyScalar(die.size));

    // Check if new position is within boundaries
    if (!this.gameBoard.isWithinBoundaries(newPosition)) {
      return false;
    }

    // Check if new position is occupied by a die of the same color
    const isSameColorDieAtPosition = (
      position: THREE.Vector3,
      isRed: boolean
    ): boolean => {
      const diceArray = isRed ? this.redDice : this.blueDice;
      return diceArray.some(
        (d) =>
          Math.abs(d.mesh.position.x - position.x) < 0.1 &&
          Math.abs(d.mesh.position.z - position.z) < 0.1
      );
    };

    // If the die is red and there's another red die at the new position, can't move
    if (
      this.redDice.includes(die) &&
      isSameColorDieAtPosition(newPosition, true)
    ) {
      return false;
    }

    // If the die is blue and there's another blue die at the new position, can't move
    if (
      this.blueDice.includes(die) &&
      isSameColorDieAtPosition(newPosition, false)
    ) {
      return false;
    }

    return true;
  }

  public createExplosion(position: THREE.Vector3, color: number) {
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
      this.scene.add(particle);

      // Store particle with its velocity
      particles.push(particle);
      (particle as any).velocity = velocity;
    }

    // Animate particles
    const startTime = Date.now();

    const animateParticles = () => {
      const elapsed = Date.now() - startTime;

      // Remove particles after 1 second
      if (elapsed > 1000) {
        particles.forEach((particle) => this.scene.remove(particle));
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
    };

    animateParticles();
  }

  public removeDie(die: Die, isRed: boolean) {
    // Create explosion effect
    this.createExplosion(
      die.mesh.position.clone(),
      isRed ? 0xff0000 : 0x0066ff
    );

    // Remove from scene
    this.scene.remove(die.mesh);

    // Remove from array
    const diceArray = isRed ? this.redDice : this.blueDice;
    const index = diceArray.indexOf(die);
    if (index !== -1) {
      diceArray.splice(index, 1);
    }

    // Remove from occupied positions
    const posIndex = this.occupiedPositions.findIndex(
      (pos) =>
        Math.abs(pos.x - die.mesh.position.x) < 0.1 &&
        Math.abs(pos.z - die.mesh.position.z) < 0.1
    );

    if (posIndex !== -1) {
      this.occupiedPositions.splice(posIndex, 1);
    }

    // If die was selected, deselect it
    if (this.selectedDice.includes(die)) {
      this.selectedDice.length = 0;
    }

    // Check for win conditions
    this.checkWinConditions();
  }

  public checkCollisions(activeDie: Die, newPosition: THREE.Vector3) {
    // Check if the active die is red
    const isRedDie = this.redDice.includes(activeDie);

    // Get the opposing dice array
    const opposingDice = isRedDie ? this.blueDice : this.redDice;

    // Check for collision with opposing dice
    for (const opposingDie of opposingDice) {
      if (
        Math.abs(opposingDie.mesh.position.x - newPosition.x) < 0.1 &&
        Math.abs(opposingDie.mesh.position.z - newPosition.z) < 0.1
      ) {
        // Collision detected!
        console.log("Collision detected! Both dice will explode.");

        // Create explosion effects for both dice
        this.createExplosion(
          opposingDie.mesh.position.clone(),
          isRedDie ? 0x0066ff : 0xff0000
        );
        this.createExplosion(
          newPosition.clone(),
          isRedDie ? 0xff0000 : 0x0066ff
        );

        // Remove the opposing die
        this.scene.remove(opposingDie.mesh);
        const opposingDiceArray = isRedDie ? this.blueDice : this.redDice;
        const opposingIndex = opposingDiceArray.indexOf(opposingDie);
        if (opposingIndex !== -1) {
          opposingDiceArray.splice(opposingIndex, 1);
        }

        // Remove the opposing die position from occupied positions
        const opposingPosIndex = this.occupiedPositions.findIndex(
          (pos) =>
            Math.abs(pos.x - opposingDie.mesh.position.x) < 0.1 &&
            Math.abs(pos.z - opposingDie.mesh.position.z) < 0.1
        );
        if (opposingPosIndex !== -1) {
          this.occupiedPositions.splice(opposingPosIndex, 1);
        }

        // Remove the active die
        this.scene.remove(activeDie.mesh);
        const activeDiceArray = isRedDie ? this.redDice : this.blueDice;
        const activeIndex = activeDiceArray.indexOf(activeDie);
        if (activeIndex !== -1) {
          activeDiceArray.splice(activeIndex, 1);
        }

        // If active die was selected, deselect it
        if (this.selectedDice.includes(activeDie)) {
          this.selectedDice.length = 0;
        }

        // Check for win conditions
        this.checkWinConditions();

        return true;
      }
    }

    return false;
  }

  public checkFlagCapture(die: Die) {
    const isRedDie = this.redDice.includes(die);

    // Check if red die is at blue flag (opposite start position)
    if (
      isRedDie &&
      Math.abs(die.mesh.position.x - this.oppositeStartPos.x) < 0.1 &&
      Math.abs(die.mesh.position.z - this.oppositeStartPos.z) < 0.1
    ) {
      console.log("Red die captured blue flag!");
      // Make all blue dice explode
      const blueDiceCopy = [...this.blueDice];
      blueDiceCopy.forEach((blueDie) => {
        this.createExplosion(blueDie.mesh.position.clone(), 0x0066ff);
        this.scene.remove(blueDie.mesh);
      });

      // Clear the blue dice array
      this.blueDice.length = 0;

      // Red team wins!
      this.gameOver = true;
      this.winner = "red";
      console.log("Game over! Red team wins!");
      return true;
    }

    // Check if blue die is at red flag (start position)
    if (
      !isRedDie &&
      Math.abs(die.mesh.position.x - this.startPosition.x) < 0.1 &&
      Math.abs(die.mesh.position.z - this.startPosition.z) < 0.1
    ) {
      console.log("Blue die captured red flag!");
      // Make all red dice explode
      const redDiceCopy = [...this.redDice];
      redDiceCopy.forEach((redDie) => {
        this.createExplosion(redDie.mesh.position.clone(), 0xff0000);
        this.scene.remove(redDie.mesh);
      });

      // Clear the red dice array
      this.redDice.length = 0;

      // Blue team wins!
      this.gameOver = true;
      this.winner = "blue";
      console.log("Game over! Blue team wins!");
      return true;
    }

    return false;
  }

  public checkWinConditions() {
    // If game is already over, don't check again
    if (this.gameOver) return;

    // Check if all red dice are eliminated
    if (this.redDice.length === 0 && this.blueDice.length > 0) {
      console.log("All red dice eliminated!");
      this.gameOver = true;
      this.winner = "blue";
      console.log("Game over! Blue team wins!");
      return;
    }

    // Check if all blue dice are eliminated
    if (this.blueDice.length === 0 && this.redDice.length > 0) {
      console.log("All blue dice eliminated!");
      this.gameOver = true;
      this.winner = "red";
      console.log("Game over! Red team wins!");
      return;
    }
  }

  public moveDie(
    direction: THREE.Vector3,
    animateCursorMovement?: (
      x: number,
      z: number,
      duration?: number,
      onComplete?: () => void
    ) => void
  ) {
    if (this.isRolling || this.selectedDice.length === 0 || this.gameOver)
      return;

    const activeDie = this.selectedDice[0];

    // Check if the die is a red die (only red dice can be controlled)
    if (!this.redDice.includes(activeDie)) {
      // If not a red die, deselect it and update highlighted dice
      this.selectedDice.length = 0;
      this.updateHighlightedDice();
      return;
    }

    // Check if the die is still among the highest rank
    if (!this.isHighestRankDie(activeDie)) {
      // If not, update highlighted dice and return
      this.updateHighlightedDice();
      return;
    }

    // Check if the die can move in the given direction
    if (this.canDieMove(activeDie, direction)) {
      // Calculate new position
      const oldPosition = activeDie.mesh.position.clone();
      const newPosition = oldPosition
        .clone()
        .add(direction.clone().multiplyScalar(activeDie.size));

      // Set rolling flag
      this.isRolling = true;

      // Move cursor with die if animateCursorMovement is provided
      if (animateCursorMovement) {
        animateCursorMovement(newPosition.x, newPosition.z, 500);
      }

      // Roll the die
      activeDie.roll(direction, this.gameBoard.boundaryLimit, () => {
        // After rolling completes, update occupied positions
        // Remove old position from occupied list
        const oldIndex = this.occupiedPositions.findIndex(
          (pos) =>
            Math.abs(pos.x - oldPosition.x) < 0.1 &&
            Math.abs(pos.z - oldPosition.z) < 0.1
        );
        if (oldIndex !== -1) {
          this.occupiedPositions.splice(oldIndex, 1);
        }

        // Check for collisions with opposing dice
        const collisionOccurred = this.checkCollisions(activeDie, newPosition);

        // If no collision, add new position to occupied list and check for flag capture
        if (!collisionOccurred) {
          this.occupiedPositions.push(newPosition.clone());

          // Check if die captured a flag
          this.checkFlagCapture(activeDie);
        }

        // Update highlights - this will auto-select a new die if needed
        this.updateHighlightedDice();

        // If the active die was removed and we have a new selected die, move cursor to it
        if (
          collisionOccurred &&
          this.selectedDice.length > 0 &&
          animateCursorMovement
        ) {
          animateCursorMovement(
            this.selectedDice[0].mesh.position.x,
            this.selectedDice[0].mesh.position.z,
            300
          );
        }

        // Reset rolling flag
        this.isRolling = false;
      });
    }
  }

  public checkContinuousMovement(
    keyStates: { [key: string]: boolean },
    animateCursorMovement?: (
      x: number,
      z: number,
      duration?: number,
      onComplete?: () => void
    ) => void
  ) {
    if (this.selectedDice.length === 0 || this.gameOver) return;

    const activeDie = this.selectedDice[0];

    // Only continue if the die is a red die
    if (!this.redDice.includes(activeDie)) return;

    // Only continue if the die is still highest rank
    if (!this.isHighestRankDie(activeDie)) return;

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
      this.moveDie(direction, animateCursorMovement);
    }
  }
}
