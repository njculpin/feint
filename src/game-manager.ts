import * as THREE from "three";
import { Die } from "./models/die";
import { GameBoard } from "./models/board";
import { Flag } from "./models/flag";
import { AIManager } from "./ai-manager";

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
  public redFlag: Flag;
  private pendingDiceMovements = 0;

  // Remove unused property
  // public isPlayerTurn = true // true for player (red), false for AI (blue)

  // AI Manager
  public aiManager: AIManager;

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

    // Remove the gameBoard.startFlag and endFlag from the scene if they exist
    if (this.gameBoard.startFlag) {
      this.gameBoard.startFlag.removeFromScene(this.scene);
    }
    if (this.gameBoard.endFlag) {
      this.gameBoard.endFlag.removeFromScene(this.scene);
    }

    // Create blue flag for blue dice at the opposite start position
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
      flagColor: 0x0066ff, // Blue flag for blue dice
      poleColor: 0x8b4513, // Brown pole
    });

    // Add the blue flag to the scene
    this.blueFlag.addToScene(this.scene);

    // Add a red flag for red dice at the start position
    this.redFlag = new Flag({
      position: new THREE.Vector3(
        this.startPosition.x,
        0,
        this.startPosition.z
      ),
      poleHeight: options.dieSize * 2.5,
      poleRadius: options.dieSize * 0.08,
      flagWidth: options.dieSize * 1.0,
      flagHeight: options.dieSize * 0.6,
      flagColor: 0xff0000, // Red flag for red dice
      poleColor: 0x8b4513, // Brown pole
    });

    // Add the red flag to the scene
    this.redFlag.addToScene(this.scene);

    // Initialize the game
    this.initializeGame(options.dieSize);

    // Initialize AI Manager after dice are created
    this.aiManager = new AIManager({
      redDice: this.redDice,
      blueDice: this.blueDice,
      redFlag: this.redFlag,
      blueFlag: this.blueFlag,
      gameBoard: this.gameBoard,
      occupiedPositions: this.occupiedPositions,
      canDieMove: this.canDieMove.bind(this),
      checkCollisions: this.checkCollisions.bind(this),
      createExplosion: this.createExplosion.bind(this),
      triggerWin: this.triggerWin.bind(this),
    });
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

  // Check if a position has a flag
  public isPositionFlag(position: THREE.Vector3): boolean {
    // Check if position matches either flag position
    return (
      (Math.abs(position.x - this.redFlag.mesh.position.x) < 0.1 &&
        Math.abs(position.z - this.redFlag.mesh.position.z) < 0.1) ||
      (Math.abs(position.x - this.blueFlag.mesh.position.x) < 0.1 &&
        Math.abs(position.z - this.blueFlag.mesh.position.z) < 0.1)
    );
  }

  // Check if a position has the opposing team's flag
  public isPositionOpposingFlag(
    position: THREE.Vector3,
    isRedDie: boolean
  ): boolean {
    const flagToCheck = isRedDie ? this.blueFlag : this.redFlag;
    return (
      Math.abs(position.x - flagToCheck.mesh.position.x) < 0.1 &&
      Math.abs(position.z - flagToCheck.mesh.position.z) < 0.1
    );
  }

  // Find highest rank red dice (for player)
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

  // Check if a red die is highest rank
  public isHighestRankDie(die: Die): boolean {
    const { dice: highestDice } = this.findHighestRankDice();
    return highestDice.includes(die);
  }

  // Update the updateHighlightedDice method to handle multiple selected dice
  public updateHighlightedDice(cursorPosition?: THREE.Vector3): void {
    // Find red dice with highest rank
    const { dice: highestDice } = this.findHighestRankDice();

    // Unhighlight all dice first
    this.redDice.forEach((die) => die.highlight(false, false));
    this.blueDice.forEach((die) => die.highlight(false, false));

    // Highlight highest-ranked red dice
    highestDice.forEach((die) => {
      // If this die is in the selected dice array, highlight it as selected (yellow)
      // Otherwise, highlight it as movable but not selected (orange)
      const isSelected = this.selectedDice.includes(die);
      die.highlight(true, isSelected);
    });

    // Check if any of the currently selected dice are still in the highest rank list
    const anySelectedDiceStillValid = this.selectedDice.some((die) =>
      highestDice.includes(die)
    );

    // If none of the selected dice are valid anymore, or if there are no selected dice
    if (!anySelectedDiceStillValid) {
      // Clear the current selection
      this.selectedDice.length = 0;

      // If we have a cursor position, find the nearest highest-rank die
      if (cursorPosition && highestDice.length > 0) {
        let nearestDie = highestDice[0];
        let minDistance = Number.POSITIVE_INFINITY;

        // Find the nearest die to the cursor position
        highestDice.forEach((die) => {
          const distance = new THREE.Vector3(
            die.mesh.position.x - cursorPosition.x,
            0,
            die.mesh.position.z - cursorPosition.z
          ).length();

          if (distance < minDistance) {
            minDistance = distance;
            nearestDie = die;
          }
        });

        // Select the nearest die
        this.selectedDice[0] = nearestDie;
      }
      // If no cursor position provided or no highest dice, select the first highest die if available
      else if (highestDice.length > 0) {
        this.selectedDice[0] = highestDice[0];
      }

      // Update the highlight to show the new selection
      if (this.selectedDice.length > 0) {
        this.selectedDice[0].highlight(true, true);
      }
    } else {
      // Ensure all selected dice are actually highest rank dice
      // Remove any selected dice that aren't highest rank
      for (let i = this.selectedDice.length - 1; i >= 0; i--) {
        const die = this.selectedDice[i];
        if (!highestDice.includes(die)) {
          this.selectedDice.splice(i, 1);
        }
      }
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

    // Check if the new position has the same team's flag (can't move there)
    const isRedDie = this.redDice.includes(die);
    const sameTeamFlag = isRedDie ? this.redFlag : this.blueFlag;
    if (
      Math.abs(newPosition.x - sameTeamFlag.mesh.position.x) < 0.1 &&
      Math.abs(newPosition.z - sameTeamFlag.mesh.position.z) < 0.1
    ) {
      return false;
    }

    // Check if the new position has the opposing team's flag
    // If it does, we'll allow the move but handle it specially
    const opposingFlag = isRedDie ? this.blueFlag : this.redFlag;
    if (
      Math.abs(newPosition.x - opposingFlag.mesh.position.x) < 0.1 &&
      Math.abs(newPosition.z - opposingFlag.mesh.position.z) < 0.1
    ) {
      // Allow the move - we'll handle the flag capture in the move logic
      return true;
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
      const selectedIndex = this.selectedDice.indexOf(die);
      if (selectedIndex !== -1) {
        this.selectedDice.splice(selectedIndex, 1);
      }
    }

    // Check for win conditions
    this.checkWinConditions();
  }

  // Check for collisions during movement
  public checkCollisionDuringMovement(
    activeDie: Die,
    currentPosition: THREE.Vector3
  ): boolean {
    // Check if the active die is red
    const isRedDie = this.redDice.includes(activeDie);

    // Get the opposing dice array
    const opposingDice = isRedDie ? this.blueDice : this.redDice;

    // Check for collision with opposing dice
    for (const opposingDie of opposingDice) {
      // Calculate distance between dice centers
      const distance = new THREE.Vector3(
        opposingDie.mesh.position.x - currentPosition.x,
        0,
        opposingDie.mesh.position.z - currentPosition.z
      ).length();

      // If dice are close enough to collide (less than 80% of a die size)
      if (distance < activeDie.size * 0.8) {
        // Collision detected!
        console.log(
          "Collision detected during movement! Both dice will explode."
        );

        // Create explosion effects for both dice
        this.createExplosion(
          opposingDie.mesh.position.clone(),
          isRedDie ? 0x0066ff : 0xff0000
        );
        this.createExplosion(
          currentPosition.clone(),
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

        // Remove from occupied positions
        const activePosIndex = this.occupiedPositions.findIndex(
          (pos) =>
            Math.abs(pos.x - activeDie.mesh.position.x) < 0.1 &&
            Math.abs(pos.z - activeDie.mesh.position.z) < 0.1
        );
        if (activePosIndex !== -1) {
          this.occupiedPositions.splice(activePosIndex, 1);
        }

        // Check for win conditions
        this.checkWinConditions();

        return true;
      }
    }

    // Check if the die is about to move into the opposing flag position
    const opposingFlag = isRedDie ? this.blueFlag : this.redFlag;
    if (
      Math.abs(currentPosition.x - opposingFlag.mesh.position.x) <
        activeDie.size * 0.8 &&
      Math.abs(currentPosition.z - opposingFlag.mesh.position.z) <
        activeDie.size * 0.8
    ) {
      // Flag capture detected!
      console.log(
        `${isRedDie ? "Red" : "Blue"} die is capturing the opposing flag!`
      );

      // Trigger win for the capturing team
      this.triggerWin(isRedDie ? "red" : "blue");

      return true;
    }

    return false;
  }

  // This method is now only used for fallback collision checks
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
        // If we get here, it means a collision wasn't detected during movement
        // This is a fallback and shouldn't normally happen
        console.log(
          "Collision detected at end of movement! Both dice will explode."
        );

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
          const selectedIndex = this.selectedDice.indexOf(activeDie);
          if (selectedIndex !== -1) {
            this.selectedDice.splice(selectedIndex, 1);
          }
        }

        // Check for win conditions
        this.checkWinConditions();

        return true;
      }
    }

    // Check if the die is moving into the opposing flag position
    const opposingFlag = isRedDie ? this.blueFlag : this.redFlag;
    if (
      Math.abs(newPosition.x - opposingFlag.mesh.position.x) < 0.1 &&
      Math.abs(newPosition.z - opposingFlag.mesh.position.z) < 0.1
    ) {
      // Flag capture detected!
      console.log(
        `${isRedDie ? "Red" : "Blue"} die is capturing the opposing flag!`
      );

      // Trigger win for the capturing team
      this.triggerWin(isRedDie ? "red" : "blue");

      return true;
    }

    return false;
  }

  // Trigger win for a specific team
  public triggerWin(team: "red" | "blue") {
    console.log(`${team === "red" ? "Red" : "Blue"} team wins!`);

    // Create explosion at the opposing flag
    const flagPosition =
      team === "red"
        ? this.blueFlag.mesh.position.clone()
        : this.redFlag.mesh.position.clone();
    this.createExplosion(flagPosition, team === "red" ? 0xff0000 : 0x0066ff);

    // Make all opposing dice explode
    const opposingDice =
      team === "red" ? [...this.blueDice] : [...this.redDice];
    opposingDice.forEach((die) => {
      this.createExplosion(
        die.mesh.position.clone(),
        team === "red" ? 0x0066ff : 0xff0000
      );
      this.scene.remove(die.mesh);
    });

    // Clear the opposing dice array
    if (team === "red") {
      this.blueDice.length = 0;
    } else {
      this.redDice.length = 0;
    }

    // Set game over and winner
    this.gameOver = true;
    this.winner = team;
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

    // Check if all dice from both teams are eliminated (draw)
    if (this.redDice.length === 0 && this.blueDice.length === 0) {
      console.log("All dice eliminated!");
      this.gameOver = true;
      this.winner = null;
      console.log("Game over! It's a draw!");
      return;
    }
  }

  // Update the moveDie method to handle flag capture
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

    // Filter selected dice to only include red dice with highest rank
    const validSelectedDice = this.selectedDice.filter(
      (die) => this.redDice.includes(die) && this.isHighestRankDie(die)
    );

    if (validSelectedDice.length === 0) {
      // No valid dice selected, update highlighted dice and return
      this.selectedDice = [];
      this.updateHighlightedDice();
      return;
    }

    // Check if all selected dice can move in the given direction
    const canAllMove = validSelectedDice.every((die) =>
      this.canDieMove(die, direction)
    );

    if (!canAllMove) {
      // If any die can't move, don't move any
      return;
    }

    // Set rolling flag
    this.isRolling = true;

    // Store old positions for all dice
    const oldPositions = validSelectedDice.map((die) =>
      die.mesh.position.clone()
    );

    // Calculate new positions for all dice
    const newPositions = validSelectedDice.map((die) =>
      die.mesh.position.clone().add(direction.clone().multiplyScalar(die.size))
    );

    // Check if any dice would move into the opposing flag
    const wouldCaptureFlag = validSelectedDice.some((die) => {
      const newPos = die.mesh.position
        .clone()
        .add(direction.clone().multiplyScalar(die.size));
      const isRedDie = this.redDice.includes(die);
      const opposingFlag = isRedDie ? this.blueFlag : this.redFlag;

      return (
        Math.abs(newPos.x - opposingFlag.mesh.position.x) < 0.1 &&
        Math.abs(newPos.z - opposingFlag.mesh.position.z) < 0.1
      );
    });

    // If any dice would capture the flag, trigger win immediately
    if (wouldCaptureFlag) {
      // Determine which team is capturing
      const isRedCapturing = this.redDice.includes(validSelectedDice[0]);

      // Create explosion at the die's position
      this.createExplosion(
        validSelectedDice[0].mesh.position.clone(),
        isRedCapturing ? 0xff0000 : 0x0066ff
      );

      // Trigger win
      this.triggerWin(isRedCapturing ? "red" : "blue");

      // Reset rolling flag
      this.isRolling = false;

      return;
    }

    // Store the current cursor position for later use
    const currentCursorPosition =
      validSelectedDice.length > 0
        ? new THREE.Vector3(
            validSelectedDice[0].mesh.position.x,
            0,
            validSelectedDice[0].mesh.position.z
          )
        : null;

    // Move cursor with the first die if animateCursorMovement is provided
    if (animateCursorMovement && validSelectedDice.length > 0) {
      // Use a shorter animation duration for better responsiveness
      // Pass the exact new position of the first die
      animateCursorMovement(newPositions[0].x, newPositions[0].z, 300);
    }

    // Track dice that need to be removed from selection due to collisions
    const diceToRemove: Die[] = [];

    // Reset pending movements counter
    this.pendingDiceMovements = validSelectedDice.length;

    // Custom roll function that checks for collisions during movement
    const customRoll = (
      die: Die,
      direction: THREE.Vector3,
      index: number,
      onComplete?: () => void
    ) => {
      if (die.isRolling) return false;

      // Store the starting position
      const startPosition = die.mesh.position.clone();

      // Calculate the target position (exactly one grid space away)
      const targetPosition = startPosition
        .clone()
        .add(direction.clone().multiplyScalar(die.size));

      // Calculate the axis of rotation (perpendicular to direction and up vector)
      const axis = new THREE.Vector3();
      axis.crossVectors(new THREE.Vector3(0, 1, 0), direction);
      axis.normalize();

      // Store the initial rotation
      const initialRotation = die.mesh.rotation.clone();

      die.isRolling = true;

      // Use performance.now() for smoother animation timing
      const startTime = performance.now();
      const duration = 300; // Match the cursor movement duration (300ms)

      // Flag to track if this specific die had a collision
      let hadCollision = false;

      const animateRoll = () => {
        // If this specific die had a collision, stop its animation
        if (hadCollision) {
          die.isRolling = false;
          if (onComplete) onComplete();
          return;
        }

        const currentTime = performance.now();
        const elapsed = currentTime - startTime;

        // If animation is complete
        if (elapsed >= duration) {
          // Snap to exact target position
          die.mesh.position.copy(targetPosition);

          // Ensure the die has rotated exactly 90 degrees around the axis
          die.mesh.rotation.copy(initialRotation);
          die.mesh.rotateOnWorldAxis(axis, Math.PI / 2); // Rotate 90 degrees

          // Update the orientation based on the direction of roll
          die.updateTopFaceFromRotation();

          die.isRolling = false;

          if (onComplete) onComplete();
          return;
        }

        // Calculate progress (0 to 1)
        const progress = Math.min(elapsed / duration, 1);

        // Apply easing function for smoother movement (ease-out cubic)
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        // Calculate the current position based on progress
        const currentPosition = new THREE.Vector3().lerpVectors(
          startPosition,
          targetPosition,
          easedProgress
        );

        // Check for collisions at the current position
        if (
          !hadCollision &&
          this.checkCollisionDuringMovement(die, currentPosition)
        ) {
          // Mark this specific die as having a collision
          hadCollision = true;
          diceToRemove.push(die);
          die.isRolling = false;
          if (onComplete) onComplete();
          return;
        }

        // Update the die position
        die.mesh.position.copy(currentPosition);

        // Calculate the rotation angle based on progress (0 to 90 degrees)
        const rotationAngle = (Math.PI / 2) * easedProgress;

        // Apply rotation - reset to initial rotation first, then apply the new rotation
        die.mesh.rotation.copy(initialRotation);
        die.mesh.rotateOnWorldAxis(axis, rotationAngle);

        requestAnimationFrame(animateRoll);
      };

      animateRoll();
      return true;
    };

    // Roll all dice
    validSelectedDice.forEach((die, index) => {
      customRoll(die, direction, index, () => {
        // After rolling completes for each die

        // If no collision occurred during movement
        if (!diceToRemove.includes(die)) {
          // Remove old position from occupied list
          const oldIndex = this.occupiedPositions.findIndex(
            (pos) =>
              Math.abs(pos.x - oldPositions[index].x) < 0.1 &&
              Math.abs(pos.z - oldPositions[index].z) < 0.1
          );
          if (oldIndex !== -1) {
            this.occupiedPositions.splice(oldIndex, 1);
          }

          // If no collision, add new position to occupied list
          this.occupiedPositions.push(newPositions[index].clone());

          // No need to check for flag capture since dice can't move into flag cells
        }

        // Decrement pending movements counter
        this.pendingDiceMovements--;

        // If all dice have completed their moves
        if (this.pendingDiceMovements === 0) {
          // Remove dice that had collisions from selection
          diceToRemove.forEach((dieToRemove) => {
            const index = this.selectedDice.indexOf(dieToRemove);
            if (index !== -1) {
              this.selectedDice.splice(index, 1);
            }
          });

          // Update highlights - this will auto-select a new die if needed
          // Pass the last known cursor position to help find the nearest die
          this.updateHighlightedDice(currentCursorPosition || newPositions[0]);

          // If animateCursorMovement is provided and we have a new selection
          if (animateCursorMovement && this.selectedDice.length > 0) {
            // Move cursor to the newly selected die
            const newSelectedDie = this.selectedDice[0];
            animateCursorMovement(
              newSelectedDie.mesh.position.x,
              newSelectedDie.mesh.position.z,
              300
            );
          }

          // Reset rolling flag
          this.isRolling = false;
        }
      });
    });
  }

  // Delegate AI move to the AIManager
  public performAIMove() {
    return this.aiManager.performAIMove(this.isRolling, this.gameOver);
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
    if (this.selectedDice.length === 0 || this.gameOver || this.isRolling)
      return;

    // Check if all selected dice are red and highest rank
    const allValidDice = this.selectedDice.every(
      (die) => this.redDice.includes(die) && this.isHighestRankDie(die)
    );

    if (!allValidDice) return;

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

  // Clean up resources
  public dispose(): void {
    // No resources to clean up after removing particle system
  }
}
