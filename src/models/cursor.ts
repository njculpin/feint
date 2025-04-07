import * as THREE from "three";
import type { Die } from "./die";

export class CursorManager {
  private cursorPosition = new THREE.Vector3(0, 0, 0);
  private cursorTargetPosition = new THREE.Vector3(0, 0, 0);
  private isCursorMoving = false;
  private animationId: number | null = null;

  // Animation properties
  private animationStartTime = 0;
  private animationDuration = 0;
  private animationStartPosition = new THREE.Vector3();
  private onAnimationComplete: (() => void) | null = null;

  constructor(_scene: THREE.Scene, _dieSize: number) {}

  // Update selected dice (no visual cursor)
  updateSelectedCursors(selectedDice: Die[]): void {
    // If there are selected dice, update cursor position
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

    // If animation is complete
    if (progress >= 1) {
      // Ensure cursor is exactly at target position
      this.cursorPosition.copy(this.cursorTargetPosition);
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
