import * as THREE from "three"
import type { Die } from "./models/die"
import type { Flag } from "./models/flag"
import type { GameBoard } from "./models/board"

// Node for A* pathfinding
interface PathNode {
  x: number
  z: number
  g: number // Cost from start
  h: number // Heuristic (estimated cost to goal)
  f: number // Total cost (g + h)
  parent: PathNode | null
}

export class AIManager {
  // Store references to game objects
  private redDice: Die[]
  private blueDice: Die[]
  private redFlag: Flag
  private blueFlag: Flag
  private gameBoard: GameBoard
  private occupiedPositions: THREE.Vector3[]

  // AI state tracking
  private blueDiceMoveHistory: Map<Die, THREE.Vector3[]> = new Map()
  public isAIMoving = false

  // Function references from GameManager
  private canDieMoveFn: (die: Die, direction: THREE.Vector3) => boolean
  private checkCollisionsFn: (die: Die, newPosition: THREE.Vector3) => boolean
  private createExplosionFn: (position: THREE.Vector3, color: number) => void
  private triggerWinFn: (team: "red" | "blue") => void

  constructor(options: {
    redDice: Die[]
    blueDice: Die[]
    redFlag: Flag
    blueFlag: Flag
    gameBoard: GameBoard
    occupiedPositions: THREE.Vector3[]
    // Function to check if a die can move in a direction
    canDieMove: (die: Die, direction: THREE.Vector3) => boolean
    // Function to check for collisions after movement
    checkCollisions: (die: Die, newPosition: THREE.Vector3) => boolean
    // Function to create explosion effects
    createExplosion: (position: THREE.Vector3, color: number) => void
    // Function to handle win conditions
    triggerWin: (team: "red" | "blue") => void
  }) {
    this.redDice = options.redDice
    this.blueDice = options.blueDice
    this.redFlag = options.redFlag
    this.blueFlag = options.blueFlag
    this.gameBoard = options.gameBoard
    this.occupiedPositions = options.occupiedPositions

    // Store function references
    this.canDieMoveFn = options.canDieMove
    this.checkCollisionsFn = options.checkCollisions
    this.createExplosionFn = options.createExplosion
    this.triggerWinFn = options.triggerWin
  }

  // Find highest rank blue dice (for AI)
  public findHighestRankBlueDice(): { dice: Die[]; rank: number } {
    let highestRank = 0

    // Find the highest rank among blue dice
    this.blueDice.forEach((die) => {
      if (die.topFace > highestRank) {
        highestRank = die.topFace
      }
    })

    // Collect all blue dice with that rank
    const highestDice = this.blueDice.filter((die) => die.topFace === highestRank)

    return { dice: highestDice, rank: highestRank }
  }

  // Choose the best die to move based on game state
  private chooseBestDie(dice: Die[]): Die | null {
    if (dice.length === 0) return null

    // If there's only one die, choose it
    if (dice.length === 1) return dice[0]

    // Check if any red dice are close to the blue flag (threat detection)
    const threatLevel = this.calculateThreatToBlueFlag()

    // Calculate paths for each die
    const diceWithPaths = dice.map((die) => {
      // Find path to red flag
      const pathToFlag = this.findPathToTarget(die, this.redFlag.mesh.position)

      // Find paths to intercept red dice
      const interceptionPaths = this.findInterceptionPaths(die)

      return {
        die,
        pathToFlag,
        interceptionPaths,
        distanceToRedFlag: this.calculateDistanceToRedFlag(die),
        distanceToBlueFlag: this.calculateDistanceToBlueFlag(die),
      }
    })

    // If threat level is high, prioritize defense
    if (threatLevel > 3) {
      console.log("High threat to blue flag detected! Prioritizing defense.")

      // Sort by best defensive position (closest to blue flag or with good interception paths)
      diceWithPaths.sort((a, b) => {
        // If one die has interception paths and the other doesn't, prefer the one with paths
        if (a.interceptionPaths.length > 0 && b.interceptionPaths.length === 0) return -1
        if (a.interceptionPaths.length === 0 && b.interceptionPaths.length > 0) return 1

        // Otherwise sort by distance to blue flag
        return a.distanceToBlueFlag - b.distanceToBlueFlag
      })

      return diceWithPaths[0].die
    }

    // If threat level is medium, balance offense and defense
    if (threatLevel > 1) {
      console.log("Medium threat to blue flag detected. Balancing offense and defense.")

      // 50% chance to play defensively when under medium threat
      if (Math.random() < 0.5) {
        // Sort by best defensive position
        diceWithPaths.sort((a, b) => {
          if (a.interceptionPaths.length > 0 && b.interceptionPaths.length === 0) return -1
          if (a.interceptionPaths.length === 0 && b.interceptionPaths.length > 0) return 1
          return a.distanceToBlueFlag - b.distanceToBlueFlag
        })
      } else {
        // Sort by best offensive position
        diceWithPaths.sort((a, b) => {
          // Prefer dice with paths to the flag
          if (a.pathToFlag && !b.pathToFlag) return -1
          if (!a.pathToFlag && b.pathToFlag) return 1

          // If both have paths, prefer the shorter path
          if (a.pathToFlag && b.pathToFlag) {
            return a.pathToFlag.length - b.pathToFlag.length
          }

          // Otherwise sort by distance to red flag
          return a.distanceToRedFlag - b.distanceToRedFlag
        })
      }

      return diceWithPaths[0].die
    }

    // Otherwise, prioritize offense (capturing red flag)
    console.log("Low threat to blue flag. Prioritizing offense.")

    // Sort by best offensive position
    diceWithPaths.sort((a, b) => {
      // Prefer dice with paths to the flag
      if (a.pathToFlag && !b.pathToFlag) return -1
      if (!a.pathToFlag && b.pathToFlag) return 1

      // If both have paths, prefer the shorter path
      if (a.pathToFlag && b.pathToFlag) {
        return a.pathToFlag.length - b.pathToFlag.length
      }

      // Otherwise sort by distance to red flag
      return a.distanceToRedFlag - b.distanceToRedFlag
    })

    return diceWithPaths[0].die
  }

  // Find paths to intercept red dice that are moving toward the blue flag
  private findInterceptionPaths(blueDie: Die): PathNode[][] {
    const interceptionPaths: PathNode[][] = []

    // Check each red die
    for (const redDie of this.redDice) {
      // Only consider red dice that are a threat (moving toward blue flag)
      if (this.calculateDistanceToBlueFlag(redDie) <= 6) {
        // Calculate potential interception points
        const interceptionPoints = this.calculateInterceptionPoints(redDie)

        for (const point of interceptionPoints) {
          // Find path from blue die to interception point
          const path = this.findPath(
            this.gridPositionFromWorld(blueDie.mesh.position),
            { x: point.x, z: point.z },
            true, // Allow interception of red dice
          )

          if (path) {
            interceptionPaths.push(path)
          }
        }
      }
    }

    return interceptionPaths
  }

  // Calculate potential points where a blue die could intercept a red die
  private calculateInterceptionPoints(redDie: Die): { x: number; z: number }[] {
    const points: { x: number; z: number }[] = []
    const redPos = this.gridPositionFromWorld(redDie.mesh.position)
    const blueFlag = this.gridPositionFromWorld(this.blueFlag.mesh.position)

    // Calculate direction from red die to blue flag
    const dx = blueFlag.x - redPos.x
    const dz = blueFlag.z - redPos.z

    // Normalize direction
    const length = Math.sqrt(dx * dx + dz * dz)
    const ndx = dx / length
    const ndz = dz / length

    // Add points along the path from red die to blue flag
    for (let i = 1; i <= 3; i++) {
      const x = Math.round(redPos.x + ndx * i)
      const z = Math.round(redPos.z + ndz * i)

      // Check if point is within board boundaries
      if (this.isPositionWithinBoundaries({ x, z })) {
        points.push({ x, z })
      }
    }

    // Also add points adjacent to the red die's current position
    const adjacentPoints = [
      { x: redPos.x + 1, z: redPos.z },
      { x: redPos.x - 1, z: redPos.z },
      { x: redPos.x, z: redPos.z + 1 },
      { x: redPos.x, z: redPos.z - 1 },
    ]

    for (const point of adjacentPoints) {
      if (this.isPositionWithinBoundaries(point)) {
        points.push(point)
      }
    }

    return points
  }

  // Find path to a target position using A* algorithm
  private findPathToTarget(die: Die, targetPosition: THREE.Vector3): PathNode[] | null {
    const start = this.gridPositionFromWorld(die.mesh.position)
    const goal = this.gridPositionFromWorld(targetPosition)

    return this.findPath(start, goal, false)
  }

  // Convert world position to grid position
  private gridPositionFromWorld(worldPos: THREE.Vector3): { x: number; z: number } {
    return {
      x: Math.round(worldPos.x / this.gameBoard.cellSize),
      z: Math.round(worldPos.z / this.gameBoard.cellSize),
    }
  }

  // Convert grid position to world position
  private worldPositionFromGrid(gridPos: { x: number; z: number }): THREE.Vector3 {
    return new THREE.Vector3(
      gridPos.x * this.gameBoard.cellSize,
      this.gameBoard.cellSize / 2, // Y position at half die height
      gridPos.z * this.gameBoard.cellSize,
    )
  }

  // Check if a grid position is within board boundaries
  private isPositionWithinBoundaries(pos: { x: number; z: number }): boolean {
    const worldPos = this.worldPositionFromGrid(pos)
    return this.gameBoard.isWithinBoundaries(worldPos)
  }

  // Check if a grid position is occupied by a die of the same color
  private isPositionOccupiedBySameColor(pos: { x: number; z: number }, isBlue: boolean): boolean {
    const worldPos = this.worldPositionFromGrid(pos)
    const diceArray = isBlue ? this.blueDice : this.redDice

    return diceArray.some(
      (die) => Math.abs(die.mesh.position.x - worldPos.x) < 0.1 && Math.abs(die.mesh.position.z - worldPos.z) < 0.1,
    )
  }

  // A* pathfinding algorithm
  private findPath(
    start: { x: number; z: number },
    goal: { x: number; z: number },
    allowRedDiceInterception = false,
  ): PathNode[] | null {
    // Create start and goal nodes
    const startNode: PathNode = {
      x: start.x,
      z: start.z,
      g: 0,
      h: this.calculateManhattanDistance(start, goal),
      f: 0,
      parent: null,
    }
    startNode.f = startNode.g + startNode.h

    const openSet: PathNode[] = [startNode]
    const closedSet: Set<string> = new Set()

    // Maximum iterations to prevent infinite loops
    const maxIterations = 100
    let iterations = 0

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++

      // Find node with lowest f score
      openSet.sort((a, b) => a.f - b.f)
      const current = openSet.shift()!

      // Check if we've reached the goal
      if (current.x === goal.x && current.z === goal.z) {
        // Reconstruct path
        return this.reconstructPath(current)
      }

      // Add current to closed set
      closedSet.add(`${current.x},${current.z}`)

      // Check all neighbors
      const neighbors = this.getNeighbors(current, goal, allowRedDiceInterception)

      for (const neighbor of neighbors) {
        // Skip if in closed set
        if (closedSet.has(`${neighbor.x},${neighbor.z}`)) continue

        // Calculate tentative g score
        const tentativeG = current.g + 1

        // Find if neighbor is already in open set
        const existingNeighbor = openSet.find((n) => n.x === neighbor.x && n.z === neighbor.z)

        if (!existingNeighbor) {
          // Add to open set
          neighbor.g = tentativeG
          neighbor.h = this.calculateManhattanDistance({ x: neighbor.x, z: neighbor.z }, goal)
          neighbor.f = neighbor.g + neighbor.h
          neighbor.parent = current
          openSet.push(neighbor)
        } else if (tentativeG < existingNeighbor.g) {
          // Update existing neighbor
          existingNeighbor.g = tentativeG
          existingNeighbor.f = existingNeighbor.g + existingNeighbor.h
          existingNeighbor.parent = current
        }
      }
    }

    // No path found
    return null
  }

  // Get valid neighbors for a node
  private getNeighbors(node: PathNode, goal: { x: number; z: number }, allowRedDiceInterception: boolean): PathNode[] {
    const neighbors: PathNode[] = []
    const directions = [
      { x: 0, z: -1 }, // Forward
      { x: -1, z: 0 }, // Left
      { x: 1, z: 0 }, // Right
      { x: 0, z: 1 }, // Backward
    ]

    for (const dir of directions) {
      const x = node.x + dir.x
      const z = node.z + dir.z

      // Check if position is within boundaries
      if (!this.isPositionWithinBoundaries({ x, z })) continue

      // Check if position is the goal
      const isGoal = x === goal.x && z === goal.z

      // Check if position is occupied by a blue die (can't move there)
      if (this.isPositionOccupiedBySameColor({ x, z }, true)) continue

      // Check if position is occupied by a red die
      const worldPos = this.worldPositionFromGrid({ x, z })
      const hasRedDie = this.redDice.some(
        (die) => Math.abs(die.mesh.position.x - worldPos.x) < 0.1 && Math.abs(die.mesh.position.z - worldPos.z) < 0.1,
      )

      // If position has a red die, only allow if we're intercepting or it's the goal
      if (hasRedDie && !allowRedDiceInterception && !isGoal) continue

      // Check if position is a flag
      const isBlueFlag =
        Math.abs(worldPos.x - this.blueFlag.mesh.position.x) < 0.1 &&
        Math.abs(worldPos.z - this.blueFlag.mesh.position.z) < 0.1

      // Can't move to own flag
      if (isBlueFlag) continue

      // Add valid neighbor
      neighbors.push({
        x,
        z,
        g: 0, // Will be calculated later
        h: 0, // Will be calculated later
        f: 0, // Will be calculated later
        parent: null, // Will be set later
      })
    }

    return neighbors
  }

  // Reconstruct path from goal node to start node
  private reconstructPath(goalNode: PathNode): PathNode[] {
    const path: PathNode[] = []
    let current: PathNode | null = goalNode

    while (current) {
      path.unshift(current)
      current = current.parent
    }

    return path
  }

  // Calculate threat level to blue flag
  private calculateThreatToBlueFlag(): number {
    let threatLevel = 0
    const blueFlagPos = this.blueFlag.mesh.position

    // Check each red die's distance to blue flag
    this.redDice.forEach((die) => {
      const distance = this.calculateManhattanDistance(
        this.gridPositionFromWorld(die.mesh.position),
        this.gridPositionFromWorld(blueFlagPos),
      )

      // Closer dice pose a greater threat
      if (distance <= 2) {
        threatLevel += 3 // Very close - major threat
      } else if (distance <= 4) {
        threatLevel += 2 // Moderately close - medium threat
      } else if (distance <= 6) {
        threatLevel += 1 // Somewhat close - minor threat
      }

      // Higher value dice pose a greater threat
      threatLevel += die.topFace / 6 // Add 0.17 to 1.0 based on die value
    })

    console.log(`Current threat level to blue flag: ${threatLevel}`)
    return threatLevel
  }

  // Calculate distance to blue flag
  private calculateDistanceToBlueFlag(die: Die): number {
    const diePos = this.gridPositionFromWorld(die.mesh.position)
    const flagPos = this.gridPositionFromWorld(this.blueFlag.mesh.position)

    // Use Manhattan distance (grid-based)
    return this.calculateManhattanDistance(diePos, flagPos)
  }

  // Calculate distance to red flag
  private calculateDistanceToRedFlag(die: Die): number {
    const diePos = this.gridPositionFromWorld(die.mesh.position)
    const flagPos = this.gridPositionFromWorld(this.redFlag.mesh.position)

    // Use Manhattan distance (grid-based)
    return this.calculateManhattanDistance(diePos, flagPos)
  }

  // Helper method for Manhattan distance calculation
  private calculateManhattanDistance(pos1: { x: number; z: number }, pos2: { x: number; z: number }): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.z - pos2.z)
  }

  // Check if die is stuck in a loop
  private isDieStuckInLoop(die: Die): boolean {
    // Get move history for this die
    const history = this.blueDiceMoveHistory.get(die)

    // If no history or not enough moves, die is not stuck
    if (!history || history.length < 4) return false

    // Check for a pattern of moving back and forth between positions
    // We'll look at the last 4 positions
    const lastFour = history.slice(-4)

    // Check if position 0 matches position 2 AND position 1 matches position 3
    // This would indicate a back-and-forth pattern like A->B->A->B
    const isOscillating = this.positionsEqual(lastFour[0], lastFour[2]) && this.positionsEqual(lastFour[1], lastFour[3])

    return isOscillating
  }

  // Helper method to check if two positions are equal
  private positionsEqual(pos1: THREE.Vector3, pos2: THREE.Vector3): boolean {
    return Math.abs(pos1.x - pos2.x) < 0.1 && Math.abs(pos1.z - pos2.z) < 0.1
  }

  // Record a die's move in its history
  private recordDieMove(die: Die): void {
    // Initialize history array if it doesn't exist
    if (!this.blueDiceMoveHistory.has(die)) {
      this.blueDiceMoveHistory.set(die, [])
    }

    // Get the current history
    const history = this.blueDiceMoveHistory.get(die)!

    // Add current position to history
    history.push(die.mesh.position.clone())

    // Keep only the last 6 positions to limit memory usage
    if (history.length > 6) {
      history.shift()
    }
  }

  // Check if a move would return to a recently visited position
  private wouldMoveToRecentPosition(die: Die, direction: THREE.Vector3): boolean {
    const history = this.blueDiceMoveHistory.get(die)

    // If no history, this move is fine
    if (!history || history.length < 2) return false

    // Calculate the new position
    const newPos = die.mesh.position.clone().add(direction.clone().multiplyScalar(die.size))

    // Check if this position matches any of the last 3 positions
    // Skip the most recent position (index -1) as that's the current position
    for (let i = 2; i <= Math.min(3, history.length); i++) {
      const pastPos = history[history.length - i]
      if (this.positionsEqual(newPos, pastPos)) {
        return true
      }
    }

    return false
  }

  // Choose the best direction for a die to move based on A* path
  private chooseBestDirection(die: Die): THREE.Vector3 | null {
    // First try to find a path to the red flag
    const pathToFlag = this.findPathToTarget(die, this.redFlag.mesh.position)

    // Check if any red dice are close to the blue flag (threat detection)
    const threatLevel = this.calculateThreatToBlueFlag()
    const isDefensiveMode =
      threatLevel > 1 && this.calculateDistanceToBlueFlag(die) < this.calculateDistanceToRedFlag(die)

    // If in defensive mode, try to find interception paths
    let defensivePath: PathNode[] | null = null
    if (isDefensiveMode) {
      const interceptionPaths = this.findInterceptionPaths(die)
      if (interceptionPaths.length > 0) {
        // Sort by path length (shortest first)
        interceptionPaths.sort((a, b) => a.length - b.length)
        defensivePath = interceptionPaths[0]
      }
    }

    // Choose which path to follow
    let pathToFollow: PathNode[] | null = null

    if (isDefensiveMode && defensivePath) {
      pathToFollow = defensivePath
      console.log("Following defensive interception path")
    } else if (pathToFlag) {
      pathToFollow = pathToFlag
      console.log("Following path to red flag")
    }

    // If we have a path, get the next step
    if (pathToFollow && pathToFollow.length > 1) {
      const currentPos = this.gridPositionFromWorld(die.mesh.position)
      const nextStep = pathToFollow[1] // Index 0 is current position

      // Calculate direction to next step
      const dx = nextStep.x - currentPos.x
      const dz = nextStep.z - currentPos.z

      // Convert to direction vector
      const direction = new THREE.Vector3(dx, 0, dz)

      // Check if this direction is a valid move
      if (this.canDieMoveFn(die, direction)) {
        return direction
      }
    }

    // Fallback to original direction selection if path is blocked or no path found
    const possibleDirections = [
      new THREE.Vector3(0, 0, -1), // Forward
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(1, 0, 0), // Right
      new THREE.Vector3(0, 0, 1), // Backward
    ]

    // Check if die is stuck in a loop
    const isStuck = this.isDieStuckInLoop(die)

    // Filter directions that are valid moves
    let validDirections = possibleDirections.filter((dir) => this.canDieMoveFn(die, dir))

    // If we have valid directions, filter out those that would move to a recent position
    // unless the die is stuck (in which case we need to try anything)
    if (validDirections.length > 1 && !isStuck) {
      const nonRepeatingDirections = validDirections.filter((dir) => !this.wouldMoveToRecentPosition(die, dir))

      // Only use non-repeating directions if we have some
      if (nonRepeatingDirections.length > 0) {
        validDirections = nonRepeatingDirections
      }
    }

    if (validDirections.length === 0) return null

    // Calculate scores for each direction
    const directionsWithScores = validDirections.map((dir) => {
      const newPos = die.mesh.position.clone().add(dir.clone().multiplyScalar(die.size))

      // Initialize score
      let score = 0

      // If in defensive mode, prioritize moving toward blue flag
      if (isDefensiveMode) {
        // Distance to blue flag (lower is better)
        score = this.calculateManhattanDistance(
          this.gridPositionFromWorld(newPos),
          this.gridPositionFromWorld(this.blueFlag.mesh.position),
        )

        // Check if this move would intercept a red die's path to the blue flag
        const wouldBlockRedPath = this.redDice.some((redDie) => {
          // Check if red die is heading toward blue flag
          if (this.calculateDistanceToBlueFlag(redDie) <= 6) {
            // Check if new position is between red die and blue flag
            const redToBlue = this.calculateManhattanDistance(
              this.gridPositionFromWorld(redDie.mesh.position),
              this.gridPositionFromWorld(this.blueFlag.mesh.position),
            )
            const redToNew = this.calculateManhattanDistance(
              this.gridPositionFromWorld(redDie.mesh.position),
              this.gridPositionFromWorld(newPos),
            )
            const newToBlue = this.calculateManhattanDistance(
              this.gridPositionFromWorld(newPos),
              this.gridPositionFromWorld(this.blueFlag.mesh.position),
            )

            // If new position is roughly on the path from red to blue flag
            return redToNew + newToBlue - redToBlue < 3
          }
          return false
        })

        // If this move would block a red die's path, give it a big bonus
        if (wouldBlockRedPath) {
          score -= 50
        }
      }
      // Otherwise, prioritize offense
      else {
        // Distance to red flag (lower is better)
        score = this.calculateManhattanDistance(
          this.gridPositionFromWorld(newPos),
          this.gridPositionFromWorld(this.redFlag.mesh.position),
        )
      }

      // Check if this move would capture a red die
      const wouldCaptureRedDie = this.redDice.some(
        (redDie) =>
          Math.abs(redDie.mesh.position.x - newPos.x) < 0.1 && Math.abs(redDie.mesh.position.z - newPos.z) < 0.1,
      )

      // If this move would capture a red die, give it a big bonus
      if (wouldCaptureRedDie) {
        score -= 100
      }

      // Check if this move would capture the red flag
      const wouldCaptureFlag =
        Math.abs(newPos.x - this.redFlag.mesh.position.x) < 0.1 &&
        Math.abs(newPos.z - this.redFlag.mesh.position.z) < 0.1

      // If this move would capture the flag, give it the highest priority
      if (wouldCaptureFlag) {
        score -= 1000
      }

      // If die is stuck in a loop, add randomness to break the pattern
      if (isStuck) {
        // Add significant random factor to break patterns
        score += (Math.random() - 0.5) * 50
        console.log("Die is stuck in a loop! Adding randomness to direction choice.")
      }

      // Penalize moves that would return to a recent position
      if (this.wouldMoveToRecentPosition(die, dir)) {
        score += 30 // Significant penalty
      }

      return { direction: dir, score }
    })

    // Sort by score (lower is better)
    directionsWithScores.sort((a, b) => a.score - b.score)

    // Log the best move for debugging
    if (directionsWithScores.length > 0) {
      const bestMove = directionsWithScores[0]
      console.log(`Best move score: ${bestMove.score}, direction: (${bestMove.direction.x}, ${bestMove.direction.z})`)
    }

    // Return the direction with the best score
    return directionsWithScores[0].direction
  }

  // Main method to perform an AI move
  public performAIMove(isRolling: boolean, gameOver: boolean): boolean {
    if (gameOver || isRolling || this.isAIMoving) {
      console.log("Cannot perform AI move - invalid state")
      return false
    }

    console.log("AI is thinking...")
    this.isAIMoving = true

    // Find blue dice with highest rank
    const { dice: highestBlueDice, rank } = this.findHighestRankBlueDice()
    console.log(`Found ${highestBlueDice.length} highest rank blue dice with rank ${rank}`)

    // Choose the best die to move
    const bestDie = this.chooseBestDie(highestBlueDice)
    if (!bestDie) {
      console.log("No best die found")
      this.isAIMoving = false
      return false
    }

    // Choose the best direction to move
    const bestDirection = this.chooseBestDirection(bestDie)
    if (!bestDirection) {
      console.log("No valid direction found for best die")
      this.isAIMoving = false
      return false
    }

    // Check if this move would capture the flag
    const newPos = bestDie.mesh.position.clone().add(bestDirection.clone().multiplyScalar(bestDie.size))
    const wouldCaptureFlag =
      Math.abs(newPos.x - this.redFlag.mesh.position.x) < 0.1 && Math.abs(newPos.z - this.redFlag.mesh.position.z) < 0.1

    if (wouldCaptureFlag) {
      this.createExplosionFn(bestDie.mesh.position.clone(), 0x0066ff)
      this.triggerWinFn("blue")
      this.isAIMoving = false
      return true
    }

    // Perform the move
    return this.moveAIDie(bestDie, bestDirection)
  }

  // Move an AI die in the specified direction
  private moveAIDie(die: Die, direction: THREE.Vector3): boolean {
    if (!this.blueDice.includes(die)) {
      console.log("Cannot move AI die - invalid die")
      this.isAIMoving = false
      return false
    }

    console.log(
      `AI moving die at (${die.mesh.position.x}, ${die.mesh.position.z}) in direction (${direction.x}, ${direction.z})`,
    )

    // Store old position
    const oldPosition = die.mesh.position.clone()

    // Calculate new position
    const newPosition = oldPosition.clone().add(direction.clone().multiplyScalar(die.size))

    // Roll the die
    const rollSuccessful = die.roll(direction, this.gameBoard.boundaryLimit, () => {
      // After rolling completes
      console.log("AI die roll complete")

      // Check for collisions
      const hadCollision = this.checkCollisionsFn(die, newPosition)

      if (!hadCollision) {
        // Remove old position from occupied list
        const oldIndex = this.occupiedPositions.findIndex(
          (pos) => Math.abs(pos.x - oldPosition.x) < 0.1 && Math.abs(pos.z - oldPosition.z) < 0.1,
        )
        if (oldIndex !== -1) {
          this.occupiedPositions.splice(oldIndex, 1)
        }

        // Add new position to occupied list
        this.occupiedPositions.push(newPosition.clone())

        // Record this move in the die's history
        this.recordDieMove(die)
      }

      // End AI turn
      this.isAIMoving = false
    })

    // If roll couldn't start, reset state
    if (!rollSuccessful) {
      console.log("AI die roll could not start")
      this.isAIMoving = false
      return false
    }

    return true
  }
}

