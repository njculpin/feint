export interface UIManagerOptions {
  container: HTMLElement;
  onRestartGame: () => void;
}

export class UIManager {
  private container: HTMLElement;
  private instructionsElement: HTMLElement;
  private infoDisplay: HTMLElement;
  private gameStatusDisplay: HTMLElement;
  private onRestartGame: () => void;

  // Track previous game state to detect changes
  private previousGameOver = false;
  private previousWinner: "red" | "blue" | null = null;
  private previousRedDiceCount = 0;
  private previousBlueDiceCount = 0;

  constructor(options: UIManagerOptions) {
    this.container = options.container;
    this.onRestartGame = options.onRestartGame;

    // Create UI elements
    this.instructionsElement = this.createInstructions();
    this.infoDisplay = this.createInfoDisplay();
    this.gameStatusDisplay = this.createGameStatusDisplay();

    // Add event listeners
    this.setupEventListeners();
  }

  private createInstructions(): HTMLElement {
    const instructions = document.createElement("div");
    instructions.className = "instructions";
    instructions.innerHTML = `
        <h3>Dice Game Controls</h3>
        <p>WASD/Arrow Keys: Move selected dice</p>
        <p>Q/E: Rotate die in place</p>
        <p>Left-click: Select a die</p>
        <p>Ctrl + Left-click: Select multiple dice</p>
        <p>Space/Enter: Select die at cursor</p>
        <p>F: Recenter camera</p>
        <p>Right-click + drag: Pan camera</p>
      `;
    document.body.appendChild(instructions);
    return instructions;
  }

  private createInfoDisplay(): HTMLElement {
    const infoDisplay = document.createElement("div");
    infoDisplay.className = "info";
    document.body.appendChild(infoDisplay);
    return infoDisplay;
  }

  private createGameStatusDisplay(): HTMLElement {
    const gameStatusDisplay = document.createElement("div");
    gameStatusDisplay.className = "game-status";
    document.body.appendChild(gameStatusDisplay);
    return gameStatusDisplay;
  }

  private setupEventListeners(): void {
    // Add event listener to the game status display using event delegation
    this.gameStatusDisplay.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.id === "restart-button" || target.closest("#restart-button")) {
        console.log("Restart button clicked");
        this.onRestartGame();
      }
    });
  }

  public updateInfoDisplay(
    redDice: any[],
    blueDice: any[],
    selectedDice: any[],
    highestRank: number
  ): void {
    // Get all red dice top faces for debugging
    const redDiceFaces = redDice
      .map((die, index) => `Red Die ${index + 1}: ${die.topFace}`)
      .join("<br>");

    // Get all blue dice top faces for debugging
    const blueDiceFaces = blueDice
      .map((die, index) => `Blue Die ${index + 1}: ${die.topFace}`)
      .join("<br>");

    if (selectedDice.length === 0) {
      this.infoDisplay.innerHTML = `
          <strong>Game Status</strong><br>
          Highest Red Die Face: ${highestRank}<br>
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
    this.infoDisplay.innerHTML = `
        <strong>Game Status</strong><br>
        Highest Red Die Face: ${highestRank}<br>
        <br>
        ${redDiceFaces}<br>
        <br>
        ${blueDiceFaces}<br>
        <br>
        <strong>Selected Die</strong><br>
        Top Face: ${activeDie.topFace}
      `;
  }

  public updateGameStatusDisplay(
    gameOver: boolean,
    winner: "red" | "blue" | null,
    redDiceCount: number,
    blueDiceCount: number
  ): void {
    // Only update the display if the game state has changed
    const gameStateChanged =
      this.previousGameOver !== gameOver ||
      this.previousWinner !== winner ||
      this.previousRedDiceCount !== redDiceCount ||
      this.previousBlueDiceCount !== blueDiceCount;

    if (!gameStateChanged) {
      return;
    }

    // Update previous state
    this.previousGameOver = gameOver;
    this.previousWinner = winner;
    this.previousRedDiceCount = redDiceCount;
    this.previousBlueDiceCount = blueDiceCount;

    if (gameOver) {
      this.gameStatusDisplay.innerHTML = `
          <div class="game-over">
            <h2>Game Over!</h2>
            <h3>${winner === "red" ? "Red" : "Blue"} team wins!</h3>
            <button id="restart-button">Restart Game</button>
          </div>
        `;
    } else {
      this.gameStatusDisplay.innerHTML = `
          <div class="game-status-info">
            <p>Red Dice: ${redDiceCount}</p>
            <p>Blue Dice: ${blueDiceCount}</p>
          </div>
        `;
    }
  }

  public cleanup(): void {
    // Remove all UI elements from the DOM
    if (this.instructionsElement.parentNode) {
      this.instructionsElement.parentNode.removeChild(this.instructionsElement);
    }

    if (this.infoDisplay.parentNode) {
      this.infoDisplay.parentNode.removeChild(this.infoDisplay);
    }

    if (this.gameStatusDisplay.parentNode) {
      this.gameStatusDisplay.parentNode.removeChild(this.gameStatusDisplay);
    }

    // Remove event listeners
    this.gameStatusDisplay.removeEventListener("click", this.onRestartGame);
  }
}
