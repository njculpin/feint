import * as THREE from "three";
import { Flag } from "./flag";

export interface GameBoardOptions {
  cellSize: number;
  gridSize: number;
  color?: string | number;
  borderColor?: string | number;
  gridColor?: string | number;
  startMarkerColor?: string | number;
  receiveShadows?: boolean;
}

export class GameBoard {
  tablePlane: THREE.Mesh;
  border: THREE.LineSegments;
  gridHelper: THREE.GridHelper;
  startFlag: Flag;
  endFlag: Flag;
  cellSize: number;
  gridSize: number;
  boardSize: number;
  boundaryLimit: number;

  constructor(options: GameBoardOptions) {
    this.cellSize = options.cellSize;
    this.gridSize = options.gridSize;
    this.boardSize = this.cellSize * this.gridSize;
    this.boundaryLimit = this.boardSize / 2 - this.cellSize / 2;

    const color = options.color || 0x222222;
    const borderColor = options.borderColor || 0x444444;
    const gridColor = options.gridColor || 0x444444;
    const receiveShadows =
      options.receiveShadows !== undefined ? options.receiveShadows : true;

    // Create table plane
    this.tablePlane = this.createTablePlane(color, receiveShadows);

    // Create border
    this.border = this.createBorder(borderColor);

    // Create grid helper
    this.gridHelper = this.createGridHelper(gridColor);

    // Create start flag
    const startPos = this.getStartPosition(this.cellSize);
    this.startFlag = new Flag({
      position: new THREE.Vector3(startPos.x, 0, startPos.z),
      poleHeight: this.cellSize * 2.5, // Much taller pole (2.5x the cell size)
      poleRadius: this.cellSize * 0.08, // Much thicker pole (8% of cell size)
      flagWidth: this.cellSize * 1.0, // Flag as wide as a cell
      flagHeight: this.cellSize * 0.6, // Flag 60% as tall as a cell
      flagColor: 0x0066ff, // Blue flag
      poleColor: 0x8b4513, // Brown pole
    });

    const endPos = this.getEndPosition(this.cellSize);
    this.endFlag = new Flag({
      position: new THREE.Vector3(endPos.x, 0, endPos.z),
      poleHeight: this.cellSize * 2.5, // Much taller pole (2.5x the cell size)
      poleRadius: this.cellSize * 0.08, // Much thicker pole (8% of cell size)
      flagWidth: this.cellSize * 1.0, // Flag as wide as a cell
      flagHeight: this.cellSize * 0.6, // Flag 60% as tall as a cell
      flagColor: 0xff0000, // Red flag
      poleColor: 0x8b4513, // Brown pole
    });
  }

  private createTablePlane(
    color: string | number,
    receiveShadows: boolean
  ): THREE.Mesh {
    // Create a more interesting board texture
    const textureSize = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = textureSize;
    canvas.height = textureSize;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Fill with base color
      ctx.fillStyle =
        typeof color === "string"
          ? color
          : `#${color.toString(16).padStart(6, "0")}`;
      ctx.fillRect(0, 0, textureSize, textureSize);

      // Add a subtle grid pattern
      const gridSize = textureSize / this.gridSize;
      ctx.strokeStyle = "rgba(80, 80, 80, 0.3)";
      ctx.lineWidth = 2;

      // Draw grid lines
      for (let i = 0; i <= this.gridSize; i++) {
        const pos = i * gridSize;

        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(textureSize, pos);
        ctx.stroke();

        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, textureSize);
        ctx.stroke();
      }

      // Add some noise for texture
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * textureSize;
        const y = Math.random() * textureSize;
        const size = Math.random() * 2 + 1;
        const alpha = Math.random() * 0.1;

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, size, size);
      }
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);

    // Create material with the texture
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.2,
    });

    const tablePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.boardSize, this.boardSize),
      material
    );

    tablePlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    tablePlane.position.y = 0; // Position at y=0
    tablePlane.receiveShadow = receiveShadows;

    return tablePlane;
  }

  private createBorder(color: string | number): THREE.LineSegments {
    const borderGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(this.boardSize, 0.1, this.boardSize)
    );
    const borderMaterial = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    border.position.y = 0.05;

    return border;
  }

  private createGridHelper(color: string | number): THREE.GridHelper {
    // For GridHelper, we need to ensure we have a numeric color value
    const colorValue =
      typeof color === "string" ? new THREE.Color(color).getHex() : color;
    const gridHelper = new THREE.GridHelper(
      this.boardSize,
      this.gridSize,
      colorValue,
      colorValue
    );
    gridHelper.position.y = 0.1; // Slightly above the ground to avoid z-fighting

    return gridHelper;
  }

  // Add all board elements to the scene
  addToScene(scene: THREE.Scene): void {
    scene.add(this.tablePlane);
    scene.add(this.border);
    // scene.add(this.gridHelper);

    // Remove these lines to prevent adding the flags twice
    // this.startFlag.addToScene(scene)
    // this.endFlag.addToScene(scene)
  }

  // Get the starting position for a die (middle column, one cell in from the edge)
  getStartPosition(dieSize: number): THREE.Vector3 {
    const startX = 0; // Middle column
    const startZ = (this.gridSize / 2 - 1) * this.cellSize; // One cell in from the edge closest to the camera
    return new THREE.Vector3(startX, dieSize / 2, startZ);
  }

  getEndPosition(dieSize: number): THREE.Vector3 {
    const startX = 0;
    const startZ = 0;
    return new THREE.Vector3(startX, dieSize / 2, startZ);
  }

  // Check if a position is within the board boundaries
  isWithinBoundaries(position: THREE.Vector3): boolean {
    return (
      Math.abs(position.x) <= this.boundaryLimit &&
      Math.abs(position.z) <= this.boundaryLimit
    );
  }
}
