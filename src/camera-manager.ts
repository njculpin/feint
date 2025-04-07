import * as THREE from "three";

export interface CameraManagerOptions {
  container: HTMLElement;
  aspectRatio?: number;
  fov?: number;
  near?: number;
  far?: number;
  initialPosition?: THREE.Vector3;
  initialTarget?: THREE.Vector3;
}

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  public initialPosition: THREE.Vector3;
  public initialTarget: THREE.Vector3;

  // Remove the unused container variable
  private isAnimating = false;
  private animationId: number | null = null;

  constructor(options: CameraManagerOptions) {
    const {
      // Remove unused container variable
      aspectRatio = window.innerWidth / window.innerHeight,
      fov = 45,
      near = 0.1,
      far = 1000,
      initialPosition = new THREE.Vector3(0, 35, 35),
      initialTarget = new THREE.Vector3(0, 0, 0),
    } = options;

    this.initialPosition = initialPosition;
    this.initialTarget = initialTarget;

    // Create the camera
    this.camera = new THREE.PerspectiveCamera(fov, aspectRatio, near, far);

    // Set initial position and orientation
    this.resetCamera();

    // Handle window resize
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  /**
   * Reset the camera to its initial position and orientation
   */
  public resetCamera(): void {
    this.camera.position.copy(this.initialPosition);
    this.camera.lookAt(this.initialTarget);
  }

  /**
   * Set the camera to a top-down view
   */
  public setTopDownView(height = 40): void {
    this.animateCamera(
      new THREE.Vector3(0, height, 0.001), // Slight offset on Z to avoid gimbal lock
      new THREE.Vector3(0, 0, 0),
      1000
    );
  }

  /**
   * Set the camera to an isometric-style view
   */
  public setIsometricView(distance = 40): void {
    const position = new THREE.Vector3(distance, distance * 0.8, distance);
    this.animateCamera(position, new THREE.Vector3(0, 0, 0), 1000);
  }

  /**
   * Set the camera to a front view
   */
  public setFrontView(distance = 40): void {
    this.animateCamera(
      new THREE.Vector3(0, 15, distance),
      new THREE.Vector3(0, 0, 0),
      1000
    );
  }

  /**
   * Animate the camera to a new position and target
   */
  public animateCamera(
    targetPosition: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    duration = 1000,
    onComplete?: () => void
  ): void {
    // Cancel any ongoing animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.isAnimating = true;

    // Store starting position and target
    const startPosition = this.camera.position.clone();
    const startRotation = this.camera.quaternion.clone();

    // Create a temporary camera to calculate the target rotation
    const tempCamera = this.camera.clone();
    tempCamera.position.copy(targetPosition);
    tempCamera.lookAt(targetLookAt);
    const targetRotation = tempCamera.quaternion.clone();

    // Animation variables
    const startTime = performance.now();

    const animate = () => {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;

      // Calculate progress (0 to 1)
      let progress = Math.min(elapsed / duration, 1);

      // Apply easing function for smoother movement (ease-out cubic)
      progress = 1 - Math.pow(1 - progress, 3);

      // Interpolate position
      this.camera.position.lerpVectors(startPosition, targetPosition, progress);

      // Interpolate rotation (using quaternion slerp)
      this.camera.quaternion.slerpQuaternions(
        startRotation,
        targetRotation,
        progress
      );

      // If animation is complete
      if (progress >= 1) {
        // Ensure camera is exactly at target
        this.camera.position.copy(targetPosition);
        this.camera.lookAt(targetLookAt);

        this.isAnimating = false;
        this.animationId = null;

        if (onComplete) onComplete();
        return;
      }

      // Continue animation
      this.animationId = requestAnimationFrame(animate);
    };

    // Start animation
    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Pan the camera by the given delta
   */
  public panCamera(deltaX: number, deltaY: number, panSpeed = 0.05): void {
    // Apply panning without changing the camera's height (Y position)
    this.camera.position.x += -deltaX * panSpeed;
    this.camera.position.z += deltaY * panSpeed;

    // Always look at the center of the board (adjusted for the new position)
    const target = this.initialTarget.clone();
    target.x += this.camera.position.x - this.initialPosition.x;
    target.z += this.camera.position.z - this.initialPosition.z;
    this.camera.lookAt(target);
  }

  /**
   * Zoom the camera in or out
   */
  public zoomCamera(delta: number, zoomSpeed = 0.1): void {
    // Calculate direction vector from camera to target
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.initialTarget);

    // Scale the direction vector based on zoom delta
    const scaleFactor = 1 - delta * zoomSpeed;
    direction.multiplyScalar(scaleFactor);

    // Set new camera position
    this.camera.position.copy(this.initialTarget).add(direction);
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    window.removeEventListener("resize", this.handleResize.bind(this));

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Check if camera is currently animating
   */
  public isCurrentlyAnimating(): boolean {
    return this.isAnimating;
  }
}
