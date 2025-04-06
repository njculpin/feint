import * as THREE from "three";
import type { Die } from "./die";

export interface CursorOptions {
  dieSize: number;
  color?: number;
}

export class Cursor {
  mesh: THREE.Object3D;

  constructor(options: CursorOptions) {
    const { dieSize, color = 0xffff00 } = options;

    // Create a group to hold the cursor elements
    this.mesh = new THREE.Group();

    // Create an Into the Breach style cursor - a simple yellow square outline
    // Make the cursor exactly match the die size
    const cursorSize = dieSize;
    const halfSize = cursorSize / 2;

    // Create the cursor using LineSegments for the outline
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

    // Create a bright yellow material for the cursor outline with increased emissive properties
    const cursorMaterial = new THREE.LineBasicMaterial({
      color: color, // Bright yellow
      linewidth: 5, // Thicker lines for better visibility (note: this may not work in all browsers due to WebGL limitations)
    });

    const cursorOutline = new THREE.LineSegments(
      cursorGeometry,
      cursorMaterial
    );

    // Position the cursor slightly above the ground to avoid z-fighting
    cursorOutline.position.y = 0.05;
    this.mesh.add(cursorOutline);

    // Add a second, slightly larger outline for better visibility
    const outerCursorGeometry = new THREE.BufferGeometry();
    const outerSize = halfSize + 0.1; // Increased size difference for better visibility
    const outerVertices = new Float32Array([
      // Bottom edge
      -outerSize,
      0,
      -outerSize,
      outerSize,
      0,
      -outerSize,

      // Right edge
      outerSize,
      0,
      -outerSize,
      outerSize,
      0,
      outerSize,

      // Top edge
      outerSize,
      0,
      outerSize,
      -outerSize,
      0,
      outerSize,

      // Left edge
      -outerSize,
      0,
      outerSize,
      -outerSize,
      0,
      -outerSize,
    ]);

    outerCursorGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(outerVertices, 3)
    );

    // Create a darker outline for contrast
    const outerCursorMaterial = new THREE.LineBasicMaterial({
      color: 0x222222, // Dark outline
      linewidth: 3,
      transparent: true,
      opacity: 0.7,
    });

    const outerCursorOutline = new THREE.LineSegments(
      outerCursorGeometry,
      outerCursorMaterial
    );
    outerCursorOutline.position.y = 0.04; // Slightly below the yellow outline
    this.mesh.add(outerCursorOutline);

    // Add a glowing plane underneath for emissive effect
    const planeGeometry = new THREE.PlaneGeometry(
      cursorSize * 1.1,
      cursorSize * 1.1
    );
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });

    const glowPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    glowPlane.rotation.x = -Math.PI / 2; // Make it horizontal
    glowPlane.position.y = 0.02; // Just above the ground
    this.mesh.add(glowPlane);
  }

  // Set the cursor position
  setPosition(x: number, y: number, z: number): void {
    // Position the cursor exactly at the die's position
    this.mesh.position.set(x, y, z);
  }

  // Apply a subtle pulse animation
  pulse(factor: number): void {
    // Apply pulse to all children for a more noticeable effect
    if (this.mesh.children.length > 0) {
      // Pulse the yellow outline
      this.mesh.children[0].scale.set(factor, 1, factor);

      // Pulse the glow plane with a stronger effect
      if (this.mesh.children.length > 2) {
        const glowPlane = this.mesh.children[2];
        const strongerFactor = 1 + (factor - 1) * 1.5;
        glowPlane.scale.set(strongerFactor, strongerFactor, 1);

        // Also pulse the opacity for more emissive effect
        // Fix: Cast the object to Mesh to access its material property
        const glowPlaneMesh = glowPlane as THREE.Mesh;
        if (glowPlaneMesh.material) {
          const material = glowPlaneMesh.material as THREE.MeshBasicMaterial;
          material.opacity = 0.2 + 0.1 * Math.sin(Date.now() * 0.003);
          material.needsUpdate = true;
        }
      }
    }
  }

  // Add the cursor to a scene
  addToScene(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  // Remove the cursor from a scene
  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }
}

export class CursorManager {
  private scene: THREE.Scene;
  private dieSize: number;
  private selectedCursors: Cursor[] = [];
  private cursorPosition = new THREE.Vector3(0, 0, 0);
  private cursorTargetPosition = new THREE.Vector3(0, 0, 0);
  private isCursorMoving = false;
  private animationId: number | null = null;

  // Animation properties
  private animationStartTime = 0;
  private animationDuration = 0;
  private animationStartPosition = new THREE.Vector3();
  private onAnimationComplete: (() => void) | null = null;

  constructor(scene: THREE.Scene, dieSize: number) {
    this.scene = scene;
    this.dieSize = dieSize;
  }

  // Update all cursors for selected dice
  updateSelectedCursors(selectedDice: Die[]): void {
    // Remove all existing selected cursors from scene
    this.selectedCursors.forEach((cursor) =>
      cursor.removeFromScene(this.scene)
    );
    this.selectedCursors = [];

    // Create new cursors for each selected die
    selectedDice.forEach((die) => {
      const selCursor = new Cursor({ dieSize: this.dieSize, color: 0xffff00 });

      // Position cursor exactly at the die's position
      // The y position is set to 0 to ensure it's at ground level
      const diePosition = die.mesh.position;
      selCursor.setPosition(diePosition.x, 0, diePosition.z);

      selCursor.addToScene(this.scene);
      this.selectedCursors.push(selCursor);
    });

    // Update cursor position if there are selected dice
    if (selectedDice.length > 0) {
      const diePosition = selectedDice[0].mesh.position;
      this.cursorPosition.x = diePosition.x;
      this.cursorPosition.z = diePosition.z;
    }
  }

  // Animate cursor movement with smooth easing
  animateCursorMovement(
    targetX: number,
    targetZ: number,
    duration = 300,
    onComplete?: () => void
  ): void {
    // Cancel any ongoing animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Set target position
    this.cursorTargetPosition.x = targetX;
    this.cursorTargetPosition.z = targetZ;

    // Start cursor movement animation
    this.isCursorMoving = true;

    // Store animation properties
    this.animationStartTime = performance.now();
    this.animationDuration = duration;
    this.animationStartPosition.copy(this.cursorPosition);
    this.onAnimationComplete = onComplete || null;

    // Start the animation
    this.animateStep();
  }

  // Animation step using requestAnimationFrame for smoother animation
  private animateStep(): void {
    const currentTime = performance.now();
    const elapsed = currentTime - this.animationStartTime;

    // Calculate progress (0 to 1)
    let progress = Math.min(elapsed / this.animationDuration, 1);

    // Apply easing function for smoother movement (ease-out cubic)
    // This makes the animation start fast and slow down at the end
    progress = 1 - Math.pow(1 - progress, 3);

    // Update cursor position using interpolation with easing
    this.cursorPosition.x =
      this.animationStartPosition.x +
      (this.cursorTargetPosition.x - this.animationStartPosition.x) * progress;
    this.cursorPosition.z =
      this.animationStartPosition.z +
      (this.cursorTargetPosition.z - this.animationStartPosition.z) * progress;

    // Update cursor positions
    this.selectedCursors.forEach((cursor) => {
      cursor.setPosition(this.cursorPosition.x, 0, this.cursorPosition.z);
    });

    // If animation is complete
    if (progress >= 1) {
      // Ensure cursor is exactly at target position
      this.cursorPosition.copy(this.cursorTargetPosition);
      this.selectedCursors.forEach((cursor) => {
        cursor.setPosition(
          this.cursorTargetPosition.x,
          0,
          this.cursorTargetPosition.z
        );
      });

      this.isCursorMoving = false;
      this.animationId = null;

      // Call completion callback if provided
      if (this.onAnimationComplete) {
        this.onAnimationComplete();
        this.onAnimationComplete = null;
      }

      return;
    }

    // Continue animation
    this.animationId = requestAnimationFrame(() => this.animateStep());
  }

  // Update cursor animations
  update(): void {
    // More pronounced pulse for the cursor
    const pulseFactor = 0.1 * Math.sin(Date.now() * 0.003) + 1.05;

    // Apply the pulse to the cursors
    this.selectedCursors.forEach((cursor) => {
      cursor.pulse(pulseFactor);
    });
  }

  // Get cursor position
  getCursorPosition(): THREE.Vector3 {
    return this.cursorPosition.clone();
  }

  // Get cursor target position
  getCursorTargetPosition(): THREE.Vector3 {
    return this.cursorTargetPosition.clone();
  }

  // Check if cursor is moving
  isMoving(): boolean {
    return this.isCursorMoving;
  }
}
