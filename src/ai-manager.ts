import * as THREE from "three";
import type { Die } from "./models/die";
import type { Flag } from "./models/flag";
import type { GameBoard } from "./models/board";

export class AIManager {
  // Store references to game objects
  private redDice: Die[];
  private blueDice: Die[];
  private redFlag: Flag;
  private blueFlag: Flag;
  private gameBoard: GameBoard;
  private occupiedPositions: THREE.Vector3[];

  // AI state tracking
  private blueDiceMoveHistory: Map<Die, THREE.Vector3[]> = new Map();
  public isAIMoving = false;

  // Function references from GameManager
  private canDieMoveFn: (die: Die, direction: THREE.Vector3) => boolean;
  private checkCollisionsFn: (die: Die, newPosition: THREE.Vector3) => boolean;
  private createExplosionFn: (position: THREE.Vector3, color: number) => void;
  private triggerWinFn: (team: "red" | "blue") => void;

  constructor(options: {
    redDice: Die[];
    blueDice: Die[];
    redFlag: Flag;
    blueFlag: Flag;
    gameBoard: GameBoard;
    occupiedPositions: THREE.Vector3[];
    // Function to check if a die can move in a direction
    canDieMove: (die: Die, direction: THREE.Vector3) => boolean;
    // Function to check for collisions after movement
    checkCollisions: (die: Die, newPosition: THREE.Vector3) => boolean;
    // Function to create explosion effects
    createExplosion: (position: THREE.Vector3, color: number) => void;
    // Function to handle win conditions
    triggerWin: (team: "red" | "blue") => void;
  }) {
    this.redDice = options.redDice;
    this.blueDice = options.blueDice;
    this.redFlag = options.redFlag;
    this.blueFlag = options.blueFlag;
    this.gameBoard = options.gameBoard;
    this.occupiedPositions = options.occupiedPositions;

    // Store function references
    this.canDieMoveFn = options.canDieMove;
    this.checkCollisionsFn = options.checkCollisions;
    this.createExplosionFn = options.createExplosion;
    this.triggerWinFn = options.triggerWin;
  }

  // Find highest rank blue dice (for AI)
  public findHighestRankBlueDice(): { dice: Die[]; rank: number } {
    let highestRank = 0;

    // Find the highest rank among blue dice
    this.blueDice.forEach((die) => {
      if (die.topFace > highestRank) {
        highestRank = die.topFace;
      }
    });

    // Collect all blue dice with that rank
    const highestDice = this.blueDice.filter(
      (die) => die.topFace === highestRank
    );

    return { dice: highestDice, rank: highestRank };
  }

  // Choose the best die to move based on game state
  private chooseBestDie(dice: Die[]): Die | null {
    if (dice.length === 0) return null;

    // If there's only one die, choose it
    if (dice.length === 1) return dice[0];

    // Check if any red dice are close to the blue flag (threat detection)
    const threatLevel = this.calculateThreatToBlueFlag();

    // If threat level is high, prioritize defense
    if (threatLevel > 3) {
      console.log("High threat to blue flag detected! Prioritizing defense.");
      return this.chooseBestDefensiveDie(dice);
    }

    // If threat level is medium, balance offense and defense
    if (threatLevel > 1) {
      console.log(
        "Medium threat to blue flag detected. Balancing offense and defense."
      );
      // 50% chance to play defensively when under medium threat
      if (Math.random() < 0.5) {
        return this.chooseBestDefensiveDie(dice);
      }
    }

    // Otherwise, prioritize offense (capturing red flag)
    console.log("Low threat to blue flag. Prioritizing offense.");
    return this.chooseBestOffensiveDie(dice);
  }

  // Calculate threat level to blue flag
  private calculateThreatToBlueFlag(): number {
    let threatLevel = 0;
    const blueFlagPos = this.blueFlag.mesh.position;

    // Check each red die's distance to blue flag
    this.redDice.forEach((die) => {
      const distance = this.calculateManhattanDistance(
        die.mesh.position,
        blueFlagPos
      );

      // Closer dice pose a greater threat
      if (distance <= 2) {
        threatLevel += 3; // Very close - major threat
      } else if (distance <= 4) {
        threatLevel += 2; // Moderately close - medium threat
      } else if (distance <= 6) {
        threatLevel += 1; // Somewhat close - minor threat
      }

      // Higher value dice pose a greater threat
      threatLevel += die.topFace / 6; // Add 0.17 to 1.0 based on die value
    });

    console.log(`Current threat level to blue flag: ${threatLevel}`);
    return threatLevel;
  }

  // Choose the best die for defense
  private chooseBestDefensiveDie(dice: Die[]): Die | null {
    // Calculate distance to blue flag for each die
    const diceWithDistances = dice.map((die) => {
      const distance = this.calculateDistanceToBlueFlag(die);
      return { die, distance };
    });

    // Sort by distance to blue flag (closest first)
    diceWithDistances.sort((a, b) => a.distance - b.distance);

    // Return the die closest to the blue flag
    return diceWithDistances[0].die;
  }

  // Choose the best die for offense
  private chooseBestOffensiveDie(dice: Die[]): Die | null {
    // Calculate distance to red flag for each die
    const diceWithDistances = dice.map((die) => {
      const distance = this.calculateDistanceToRedFlag(die);
      return { die, distance };
    });

    // Sort by distance to red flag (closest first)
    diceWithDistances.sort((a, b) => a.distance - b.distance);

    // Return the die closest to the red flag
    return diceWithDistances[0].die;
  }

  // Calculate distance to blue flag
  private calculateDistanceToBlueFlag(die: Die): number {
    const diePos = die.mesh.position;
    const flagPos = this.blueFlag.mesh.position;

    // Use Manhattan distance (grid-based)
    return Math.abs(diePos.x - flagPos.x) + Math.abs(diePos.z - flagPos.z);
  }

  // Calculate distance to red flag
  private calculateDistanceToRedFlag(die: Die): number {
    const diePos = die.mesh.position;
    const flagPos = this.redFlag.mesh.position;

    // Use Manhattan distance (grid-based) rather than Euclidean
    return Math.abs(diePos.x - flagPos.x) + Math.abs(diePos.z - flagPos.z);
  }

  // Check if die is stuck in a loop
  private isDieStuckInLoop(die: Die): boolean {
    // Get move history for this die
    const history = this.blueDiceMoveHistory.get(die);

    // If no history or not enough moves, die is not stuck
    if (!history || history.length < 4) return false;

    // Check for a pattern of moving back and forth between positions
    // We'll look at the last 4 positions
    const lastFour = history.slice(-4);

    // Check if position 0 matches position 2 AND position 1 matches position 3
    // This would indicate a back-and-forth pattern like A->B->A->B
    const isOscillating =
      this.positionsEqual(lastFour[0], lastFour[2]) &&
      this.positionsEqual(lastFour[1], lastFour[3]);

    return isOscillating;
  }

  // Helper method to check if two positions are equal
  private positionsEqual(pos1: THREE.Vector3, pos2: THREE.Vector3): boolean {
    return Math.abs(pos1.x - pos2.x) < 0.1 && Math.abs(pos1.z - pos2.z) < 0.1;
  }

  // Record a die's move in its history
  private recordDieMove(die: Die): void {
    // Initialize history array if it doesn't exist
    if (!this.blueDiceMoveHistory.has(die)) {
      this.blueDiceMoveHistory.set(die, []);
    }

    // Get the current history
    const history = this.blueDiceMoveHistory.get(die)!;

    // Add current position to history
    history.push(die.mesh.position.clone());

    // Keep only the last 6 positions to limit memory usage
    if (history.length > 6) {
      history.shift();
    }
  }

  // Check if a move would return to a recently visited position
  private wouldMoveToRecentPosition(
    die: Die,
    direction: THREE.Vector3
  ): boolean {
    const history = this.blueDiceMoveHistory.get(die);

    // If no history, this move is fine
    if (!history || history.length < 2) return false;

    // Calculate the new position
    const newPos = die.mesh.position
      .clone()
      .add(direction.clone().multiplyScalar(die.size));

    // Check if this position matches any of the last 3 positions
    // Skip the most recent position (index -1) as that's the current position
    for (let i = 2; i <= Math.min(3, history.length); i++) {
      const pastPos = history[history.length - i];
      if (this.positionsEqual(newPos, pastPos)) {
        return true;
      }
    }

    return false;
  }

  // Choose the best direction for a die to move
  private chooseBestDirection(die: Die): THREE.Vector3 | null {
    const possibleDirections = [
      new THREE.Vector3(0, 0, -1), // Forward
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(1, 0, 0), // Right
      new THREE.Vector3(0, 0, 1), // Backward
    ];

    // Check if die is stuck in a loop
    const isStuck = this.isDieStuckInLoop(die);

    // Filter directions that are valid moves
    let validDirections = possibleDirections.filter((dir) =>
      this.canDieMoveFn(die, dir)
    );

    // If we have valid directions, filter out those that would move to a recent position
    // unless the die is stuck (in which case we need to try anything)
    if (validDirections.length > 1 && !isStuck) {
      const nonRepeatingDirections = validDirections.filter(
        (dir) => !this.wouldMoveToRecentPosition(die, dir)
      );

      // Only use non-repeating directions if we have some
      if (nonRepeatingDirections.length > 0) {
        validDirections = nonRepeatingDirections;
      }
    }

    if (validDirections.length === 0) return null;

    // Check if any red dice are close to the blue flag (threat detection)
    const threatLevel = this.calculateThreatToBlueFlag();
    const isDefensiveMode =
      threatLevel > 1 &&
      this.calculateDistanceToBlueFlag(die) <
        this.calculateDistanceToRedFlag(die);

    // Calculate scores for each direction
    const directionsWithScores = validDirections.map((dir) => {
      const newPos = die.mesh.position
        .clone()
        .add(dir.clone().multiplyScalar(die.size));

      // Initialize score
      let score = 0;

      // If in defensive mode, prioritize moving toward blue flag
      if (isDefensiveMode) {
        // Distance to blue flag (lower is better)
        score = this.calculateManhattanDistance(
          newPos,
          this.blueFlag.mesh.position
        );

        // Check if this move would intercept a red die's path to the blue flag
        const wouldBlockRedPath = this.redDice.some((redDie) => {
          // Check if red die is heading toward blue flag
          if (this.calculateDistanceToBlueFlag(redDie) <= 6) {
            // Check if new position is between red die and blue flag
            const redToBlue = this.calculateManhattanDistance(
              redDie.mesh.position,
              this.blueFlag.mesh.position
            );
            const redToNew = this.calculateManhattanDistance(
              redDie.mesh.position,
              newPos
            );
            const newToBlue = this.calculateManhattanDistance(
              newPos,
              this.blueFlag.mesh.position
            );

            // If new position is roughly on the path from red to blue flag
            return redToNew + newToBlue - redToBlue < 3;
          }
          return false;
        });

        // If this move would block a red die's path, give it a big bonus
        if (wouldBlockRedPath) {
          score -= 50;
        }
      }
      // Otherwise, prioritize offense
      else {
        // Distance to red flag (lower is better)
        score = this.calculateManhattanDistance(
          newPos,
          this.redFlag.mesh.position
        );
      }

      // Check if this move would capture a red die
      const wouldCaptureRedDie = this.redDice.some(
        (redDie) =>
          Math.abs(redDie.mesh.position.x - newPos.x) < 0.1 &&
          Math.abs(redDie.mesh.position.z - newPos.z) < 0.1
      );

      // If this move would capture a red die, give it a big bonus
      if (wouldCaptureRedDie) {
        score -= 100;
      }

      // Check if this move would capture the red flag
      const wouldCaptureFlag =
        Math.abs(newPos.x - this.redFlag.mesh.position.x) < 0.1 &&
        Math.abs(newPos.z - this.redFlag.mesh.position.z) < 0.1;

      // If this move would capture the flag, give it the highest priority
      if (wouldCaptureFlag) {
        score -= 1000;
      }

      // If die is stuck in a loop, add randomness to break the pattern
      if (isStuck) {
        // Add significant random factor to break patterns
        score += (Math.random() - 0.5) * 50;
        console.log(
          "Die is stuck in a loop! Adding randomness to direction choice."
        );
      }

      // Penalize moves that would return to a recent position
      if (this.wouldMoveToRecentPosition(die, dir)) {
        score += 30; // Significant penalty
      }

      return { direction: dir, score };
    });

    // Sort by score (lower is better)
    directionsWithScores.sort((a, b) => a.score - b.score);

    // Log the best move for debugging
    if (directionsWithScores.length > 0) {
      const bestMove = directionsWithScores[0];
      console.log(
        `Best move score: ${bestMove.score}, direction: (${bestMove.direction.x}, ${bestMove.direction.z})`
      );
    }

    // Return the direction with the best score
    return directionsWithScores[0].direction;
  }

  // Helper method for Manhattan distance calculation
  private calculateManhattanDistance(
    pos1: THREE.Vector3,
    pos2: THREE.Vector3
  ): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.z - pos2.z);
  }

  // Main method to perform an AI move
  public performAIMove(isRolling: boolean, gameOver: boolean): boolean {
    if (gameOver || isRolling || this.isAIMoving) {
      console.log("Cannot perform AI move - invalid state");
      return false;
    }

    console.log("AI is thinking...");
    this.isAIMoving = true;

    // Find blue dice with highest rank
    const { dice: highestBlueDice, rank } = this.findHighestRankBlueDice();
    console.log(
      `Found ${highestBlueDice.length} highest rank blue dice with rank ${rank}`
    );

    // Choose the best die to move
    const bestDie = this.chooseBestDie(highestBlueDice);
    if (!bestDie) {
      console.log("No best die found");
      this.isAIMoving = false;
      return false;
    }

    // Choose the best direction to move
    const bestDirection = this.chooseBestDirection(bestDie);
    if (!bestDirection) {
      console.log("No valid direction found for best die");
      this.isAIMoving = false;
      return false;
    }

    // Check if this move would capture the flag
    const newPos = bestDie.mesh.position
      .clone()
      .add(bestDirection.clone().multiplyScalar(bestDie.size));
    const wouldCaptureFlag =
      Math.abs(newPos.x - this.redFlag.mesh.position.x) < 0.1 &&
      Math.abs(newPos.z - this.redFlag.mesh.position.z) < 0.1;

    if (wouldCaptureFlag) {
      this.createExplosionFn(bestDie.mesh.position.clone(), 0x0066ff);
      this.triggerWinFn("blue");
      this.isAIMoving = false;
      return true;
    }

    // Perform the move
    return this.moveAIDie(bestDie, bestDirection);
  }

  // Move an AI die in the specified direction
  private moveAIDie(die: Die, direction: THREE.Vector3): boolean {
    if (!this.blueDice.includes(die)) {
      console.log("Cannot move AI die - invalid die");
      this.isAIMoving = false;
      return false;
    }

    console.log(
      `AI moving die at (${die.mesh.position.x}, ${die.mesh.position.z}) in direction (${direction.x}, ${direction.z})`
    );

    // Store old position
    const oldPosition = die.mesh.position.clone();

    // Calculate new position
    const newPosition = oldPosition
      .clone()
      .add(direction.clone().multiplyScalar(die.size));

    // Roll the die
    const rollSuccessful = die.roll(
      direction,
      this.gameBoard.boundaryLimit,
      () => {
        // After rolling completes
        console.log("AI die roll complete");

        // Check for collisions
        const hadCollision = this.checkCollisionsFn(die, newPosition);

        if (!hadCollision) {
          // Remove old position from occupied list
          const oldIndex = this.occupiedPositions.findIndex(
            (pos) =>
              Math.abs(pos.x - oldPosition.x) < 0.1 &&
              Math.abs(pos.z - oldPosition.z) < 0.1
          );
          if (oldIndex !== -1) {
            this.occupiedPositions.splice(oldIndex, 1);
          }

          // Add new position to occupied list
          this.occupiedPositions.push(newPosition.clone());

          // Record this move in the die's history
          this.recordDieMove(die);
        }

        // End AI turn
        this.isAIMoving = false;
      }
    );

    // If roll couldn't start, reset state
    if (!rollSuccessful) {
      console.log("AI die roll could not start");
      this.isAIMoving = false;
      return false;
    }

    return true;
  }
}
