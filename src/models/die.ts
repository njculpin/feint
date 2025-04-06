import * as THREE from "three";

export interface DieOptions {
  size: number;
  position?: THREE.Vector3;
  color?: string | number;
  pipColor?: string | number;
  initialTopFace?: number;
}

export class Die {
  mesh: THREE.Mesh;
  size: number;
  isRolling = false;
  topFace = 2; // Default top face is 2 (when die is created)
  baseColor: THREE.Color;

  // Track the complete orientation of the die
  // In standard orientation: top=2, front=3, right=1, left=6, back=4, bottom=5
  orientation = {
    top: 2,
    bottom: 5,
    front: 3,
    back: 4,
    right: 1,
    left: 6,
  };

  constructor(options: DieOptions) {
    this.size = options.size || 2;
    const position = options.position || new THREE.Vector3(0, this.size / 2, 0);
    const color = options.color || "#ff0000";
    const pipColor = options.pipColor || "#ffffff";

    // Store the base color for highlighting
    this.baseColor = new THREE.Color(color);

    // Create geometry and materials
    const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
    const materials = this.createMaterials(color, pipColor);

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.position.copy(position);
    this.mesh.rotation.set(0, 0, 0); // This will have the "2" face up

    // If an initial top face is specified, rotate the die to show that face
    if (options.initialTopFace !== undefined) {
      this.setTopFace(options.initialTopFace);
    }
  }

  // Set the top face by rotating the die appropriately
  setTopFace(faceValue: number): void {
    // Reset rotation first
    this.mesh.rotation.set(0, 0, 0);

    // Apply rotation based on desired top face
    switch (faceValue) {
      case 1: // Right face becomes top
        this.mesh.rotateZ(Math.PI / 2);
        break;
      case 2: // Already top, no rotation needed
        break;
      case 3: // Front face becomes top
        this.mesh.rotateX(-Math.PI / 2);
        break;
      case 4: // Back face becomes top
        this.mesh.rotateX(Math.PI / 2);
        break;
      case 5: // Bottom face becomes top
        this.mesh.rotateX(Math.PI);
        break;
      case 6: // Left face becomes top
        this.mesh.rotateZ(-Math.PI / 2);
        break;
    }

    // Update the orientation and top face
    this.updateTopFaceFromRotation();
  }

  // Create dice face textures
  private createDiceFaceTexture(
    number: number,
    color: string | number,
    pipColor: string | number
  ): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d")!;

    // Fill background with specified color
    context.fillStyle =
      typeof color === "string"
        ? color
        : `#${color.toString(16).padStart(6, "0")}`;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw dots with specified pip color
    context.fillStyle =
      typeof pipColor === "string"
        ? pipColor
        : `#${pipColor.toString(16).padStart(6, "0")}`;

    const dotPositions: Record<number, [number, number][]> = {
      1: [[0.5, 0.5]],
      2: [
        [0.25, 0.25],
        [0.75, 0.75],
      ],
      3: [
        [0.25, 0.25],
        [0.5, 0.5],
        [0.75, 0.75],
      ],
      4: [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ],
      5: [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.5, 0.5],
        [0.25, 0.75],
        [0.75, 0.75],
      ],
      6: [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.5],
        [0.75, 0.5],
        [0.25, 0.75],
        [0.75, 0.75],
      ],
    };

    const positions = dotPositions[number] || [];
    const dotRadius = canvas.width * 0.08;

    positions.forEach(([x, y]) => {
      context.beginPath();
      context.arc(
        x * canvas.width,
        y * canvas.height,
        dotRadius,
        0,
        Math.PI * 2
      );
      context.fill();
    });

    // Add the face number as text in the corner
    context.font = "bold 72px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "black";
    context.fillText(
      number.toString(),
      canvas.width * 0.85,
      canvas.height * 0.15
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return texture;
  }

  // Create materials for each face
  // Standard die arrangement: opposite faces sum to 7
  // 1 opposite 6, 2 opposite 5, 3 opposite 4
  private createMaterials(
    color: string | number,
    pipColor: string | number
  ): THREE.MeshStandardMaterial[] {
    return [
      new THREE.MeshStandardMaterial({
        map: this.createDiceFaceTexture(1, color, pipColor),
      }), // Right face (X+)
      new THREE.MeshStandardMaterial({
        map: this.createDiceFaceTexture(6, color, pipColor),
      }), // Left face (X-)
      new THREE.MeshStandardMaterial({
        map: this.createDiceFaceTexture(2, color, pipColor),
      }), // Top face (Y+)
      new THREE.MeshStandardMaterial({
        map: this.createDiceFaceTexture(5, color, pipColor),
      }), // Bottom face (Y-)
      new THREE.MeshStandardMaterial({
        map: this.createDiceFaceTexture(3, color, pipColor),
      }), // Front face (Z+)
      new THREE.MeshStandardMaterial({
        map: this.createDiceFaceTexture(4, color, pipColor),
      }), // Back face (Z-)
    ];
  }

  // Set maximum anisotropy for all textures
  setAnisotropy(maxAnisotropy: number): void {
    const materials = this.mesh.material as THREE.MeshStandardMaterial[];
    materials.forEach((material) => {
      if (material.map) {
        material.map.anisotropy = maxAnisotropy;
      }
    });
  }

  // Check if rolling would take the die out of bounds
  wouldGoOutOfBounds(direction: THREE.Vector3, boundaryLimit: number): boolean {
    const newPosition = this.mesh.position
      .clone()
      .add(direction.clone().multiplyScalar(this.size));
    return (
      Math.abs(newPosition.x) > boundaryLimit ||
      Math.abs(newPosition.z) > boundaryLimit
    );
  }

  // Roll the die in a direction
  roll(
    direction: THREE.Vector3,
    boundaryLimit: number,
    onComplete?: () => void
  ): boolean {
    if (this.isRolling) return false;

    // Check if rolling would take the die out of bounds
    if (this.wouldGoOutOfBounds(direction, boundaryLimit)) {
      return false;
    }

    this.isRolling = true;

    // Store the starting position
    const startPosition = this.mesh.position.clone();

    // Calculate the target position (exactly one grid space away)
    const targetPosition = startPosition
      .clone()
      .add(direction.clone().multiplyScalar(this.size));

    // Calculate the axis of rotation (perpendicular to direction and up vector)
    const axis = new THREE.Vector3();
    axis.crossVectors(new THREE.Vector3(0, 1, 0), direction);
    axis.normalize();

    // Store the initial rotation
    const initialRotation = this.mesh.rotation.clone();

    // Use performance.now() for smoother animation timing
    const startTime = performance.now();
    const duration = 300; // Match the cursor movement duration (300ms)

    const animateRoll = () => {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;

      // If animation is complete
      if (elapsed >= duration) {
        // Snap to exact target position
        this.mesh.position.copy(targetPosition);

        // Ensure the die has rotated exactly 90 degrees around the axis
        this.mesh.rotation.copy(initialRotation);
        this.mesh.rotateOnWorldAxis(axis, Math.PI / 2); // Rotate 90 degrees

        // Update the orientation based on the direction of roll
        this.updateOrientationAfterRoll(direction);

        // Calculate which face is now on top
        this.updateTopFaceFromRotation();

        this.isRolling = false;

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

      // Update the die position
      this.mesh.position.copy(currentPosition);

      // Calculate the rotation angle based on progress (0 to 90 degrees)
      const rotationAngle = (Math.PI / 2) * easedProgress;

      // Apply rotation - reset to initial rotation first, then apply the new rotation
      this.mesh.rotation.copy(initialRotation);
      this.mesh.rotateOnWorldAxis(axis, rotationAngle);

      requestAnimationFrame(animateRoll);
    };

    animateRoll();
    return true;
  }

  // Rotate the die in place
  rotateInPlace(direction: "left" | "right", onComplete?: () => void): boolean {
    if (this.isRolling) return false;

    this.isRolling = true;

    // Always use world Y axis for rotation relative to camera
    const worldYAxis = new THREE.Vector3(0, 1, 0);

    // Calculate rotation angle in radians (90 degrees)
    const rotationAngle = ((direction === "left" ? 1 : -1) * Math.PI) / 2;

    // Store the initial rotation
    const initialRotation = this.mesh.rotation.clone();

    // Use performance.now() for smoother animation timing
    const startTime = performance.now();
    const duration = 300; // Match the cursor movement duration (300ms)

    const animateRotation = () => {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;

      // If animation is complete
      if (elapsed >= duration) {
        // Ensure the die has rotated exactly 90 degrees
        this.mesh.rotation.copy(initialRotation);
        this.mesh.rotateOnWorldAxis(worldYAxis, rotationAngle);

        // Update the orientation based on the direction of rotation
        this.updateOrientationAfterRotation(direction);

        // Calculate which face is now on top
        this.updateTopFaceFromRotation();

        this.isRolling = false;

        if (onComplete) onComplete();
        return;
      }

      // Calculate progress (0 to 1)
      const progress = elapsed / duration;

      // Apply easing function for smoother movement (ease-out cubic)
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      // Calculate the angle to rotate based on progress
      const currentAngle = rotationAngle * easedProgress;

      // Reset to initial rotation and apply the new rotation
      this.mesh.rotation.copy(initialRotation);
      this.mesh.rotateOnWorldAxis(worldYAxis, currentAngle);

      requestAnimationFrame(animateRotation);
    };

    animateRotation();
    return true;
  }

  // Update the orientation after rotating in place
  private updateOrientationAfterRotation(direction: "left" | "right"): void {
    // Create a temporary copy of the current orientation
    const oldOrientation = { ...this.orientation };

    if (direction === "left") {
      // Left rotation (Q key) - counterclockwise when viewed from above
      // Front becomes right, right becomes back, back becomes left, left becomes front
      this.orientation.front = oldOrientation.right;
      this.orientation.right = oldOrientation.back;
      this.orientation.back = oldOrientation.left;
      this.orientation.left = oldOrientation.front;
    } else {
      // Right rotation (E key) - clockwise when viewed from above
      // Front becomes left, left becomes back, back becomes right, right becomes front
      this.orientation.front = oldOrientation.left;
      this.orientation.left = oldOrientation.back;
      this.orientation.back = oldOrientation.right;
      this.orientation.right = oldOrientation.front;
    }

    // The top and bottom faces remain in the same physical position during Y-axis rotation
    // No need to update topFace since it's still the same face (orientation.top)
  }

  // Update the orientation after rolling
  private updateOrientationAfterRoll(direction: THREE.Vector3): void {
    // Create a temporary copy of the current orientation
    const oldOrientation = { ...this.orientation };

    if (direction.z < 0) {
      // Forward roll (W key or ArrowUp)
      // When rolling forward, the top face becomes the back face,
      // the front face becomes the top face, etc.
      this.orientation.top = oldOrientation.front;
      this.orientation.front = oldOrientation.bottom;
      this.orientation.bottom = oldOrientation.back;
      this.orientation.back = oldOrientation.top;
      // Left and right faces stay in the same position
    } else if (direction.z > 0) {
      // Backward roll (S key or ArrowDown)
      // When rolling backward, the top face becomes the front face,
      // the back face becomes the top face, etc.
      this.orientation.top = oldOrientation.back;
      this.orientation.back = oldOrientation.bottom;
      this.orientation.bottom = oldOrientation.front;
      this.orientation.front = oldOrientation.top;
      // Left and right faces stay in the same position
    } else if (direction.x < 0) {
      // Left roll (A key or ArrowLeft)
      // When rolling left, the top face becomes the right face,
      // the left face becomes the top face, etc.
      this.orientation.top = oldOrientation.right;
      this.orientation.right = oldOrientation.bottom;
      this.orientation.bottom = oldOrientation.left;
      this.orientation.left = oldOrientation.top;
      // Front and back faces stay in the same position
    } else if (direction.x > 0) {
      // Right roll (D key or ArrowRight)
      // When rolling right, the top face becomes the left face,
      // the right face becomes the top face, etc.
      this.orientation.top = oldOrientation.left;
      this.orientation.left = oldOrientation.bottom;
      this.orientation.bottom = oldOrientation.right;
      this.orientation.right = oldOrientation.top;
      // Front and back faces stay in the same position
    }
  }

  // Calculate which face is on top based on the die's rotation
  updateTopFaceFromRotation(): void {
    // Get the die's rotation matrix
    const matrix = new THREE.Matrix4();
    this.mesh.updateMatrixWorld();
    matrix.extractRotation(this.mesh.matrixWorld);

    // The Y+ direction in object space
    const objUp = new THREE.Vector3(0, 1, 0);

    // Transform to world space
    objUp.applyMatrix4(matrix);

    // Find which face normal is most aligned with world up
    const worldUp = new THREE.Vector3(0, 1, 0);

    // Face normals in object space
    const faceNormals = [
      new THREE.Vector3(1, 0, 0), // Right (1)
      new THREE.Vector3(-1, 0, 0), // Left (6)
      new THREE.Vector3(0, 1, 0), // Top (2)
      new THREE.Vector3(0, -1, 0), // Bottom (5)
      new THREE.Vector3(0, 0, 1), // Front (3)
      new THREE.Vector3(0, 0, -1), // Back (4)
    ];

    // Face values corresponding to the normals
    const faceValues = [1, 6, 2, 5, 3, 4];

    // Find which face is most aligned with world up
    let maxAlignment = Number.NEGATIVE_INFINITY;
    let topFaceIndex = -1;

    for (let i = 0; i < faceNormals.length; i++) {
      // Transform normal to world space
      const normal = faceNormals[i].clone();
      normal.applyMatrix4(matrix);

      // Calculate alignment with world up (dot product)
      const alignment = normal.dot(worldUp);

      if (alignment > maxAlignment) {
        maxAlignment = alignment;
        topFaceIndex = i;
      }
    }

    // Update top face
    if (topFaceIndex !== -1) {
      this.topFace = faceValues[topFaceIndex];
      this.orientation.top = this.topFace;
      this.orientation.bottom = 7 - this.topFace; // Opposite face
    }
  }

  // Highlight this die with a specific color
  highlight(isHighlighted = true, isSelected = false): void {
    // We no longer use emissive properties on the die itself
    // The cursor will handle the visual highlighting
  }
}
