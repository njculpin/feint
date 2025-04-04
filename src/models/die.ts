import * as THREE from "three";

export interface DieOptions {
  size: number;
  position?: THREE.Vector3;
  color?: string | number;
  pipColor?: string | number;
}

export class Die {
  mesh: THREE.Mesh;
  size: number;
  isRolling = false;
  topFace = 2; // Default top face is 2 (when die is created)

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

    // Create geometry and materials
    const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
    const materials = this.createMaterials(color, pipColor);

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.position.copy(position);
    this.mesh.rotation.set(0, 0, 0); // This will have the "2" face up
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
      console.log("Can't roll: would go out of bounds");
      return false;
    }

    // Calculate the anchor point (edge of the die in the direction of movement)
    const anchor = new THREE.Vector3();
    anchor.copy(this.mesh.position);
    anchor.y -= this.size / 2; // Move to bottom of die
    anchor.add(direction.clone().multiplyScalar(this.size / 2)); // Move in the direction to the edge

    // Calculate the axis of rotation (perpendicular to direction and up vector)
    const axis = new THREE.Vector3();
    axis.crossVectors(new THREE.Vector3(0, 1, 0), direction);
    axis.normalize();

    // Start the rolling animation
    let remainingAngle = 90; // We want to roll exactly 90 degrees
    const rollSpeed = 3; // Degrees per frame

    this.isRolling = true;
    const oldOrientation = { ...this.orientation };

    const animateRoll = () => {
      if (remainingAngle <= 0) {
        this.isRolling = false;

        // Snap to exact grid position
        this.mesh.position.x =
          Math.round(this.mesh.position.x / this.size) * this.size;
        this.mesh.position.z =
          Math.round(this.mesh.position.z / this.size) * this.size;
        this.mesh.position.y = this.size / 2; // Ensure it's exactly at y=size/2

        // Update the orientation based on the direction of roll
        this.updateOrientationAfterRoll(direction);

        if (onComplete) onComplete();
        return;
      }

      const angleToRotate = Math.min(rollSpeed, remainingAngle);
      remainingAngle -= angleToRotate;

      // Apply rotation around anchor point
      // 1. Create a matrix for the rotation around the axis
      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.makeRotationAxis(axis, (angleToRotate * Math.PI) / 180);

      // 2. Translate dice position to origin, rotate, then translate back
      this.mesh.position.sub(anchor); // Translate to origin relative to anchor
      this.mesh.position.applyMatrix4(rotationMatrix); // Apply rotation
      this.mesh.position.add(anchor); // Translate back

      // 3. Apply the same rotation to the dice's orientation
      this.mesh.rotateOnWorldAxis(axis, (angleToRotate * Math.PI) / 180);

      requestAnimationFrame(animateRoll);
    };

    animateRoll();
    return true;
  }

  // Update the orientation after rolling in a direction
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

    // Update the topFace property to match the orientation
    this.topFace = this.orientation.top;

    console.log(`Die rolled to face: ${this.topFace}`);
  }

  // Highlight this die (make it glow or raise it)
  highlight(isHighlighted = true): void {
    if (isHighlighted) {
      // Add a glow effect by making the die slightly emissive
      const materials = this.mesh.material as THREE.MeshStandardMaterial[];
      materials.forEach((material) => {
        material.emissive = new THREE.Color(0xffff00); // Yellow glow
        material.emissiveIntensity = 0.3;
      });
    } else {
      // Remove glow
      const materials = this.mesh.material as THREE.MeshStandardMaterial[];
      materials.forEach((material) => {
        material.emissive = new THREE.Color(0x000000);
        material.emissiveIntensity = 0;
      });
    }
  }
}
