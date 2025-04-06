import * as THREE from "three";

export interface ParticleOptions {
  count?: number;
  size?: number;
  color?: number | string;
  lifetime?: number;
  spread?: number;
  gravity?: number;
  opacity?: number;
  fadeRate?: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private sizes: Float32Array;
  private count: number;
  private gravity: number;
  private fadeRate: number;
  private isActive = false;
  private animationId: number | null = null;

  constructor(scene: THREE.Scene, options: ParticleOptions = {}) {
    this.scene = scene;
    this.count = options.count || 30;
    const size = options.size || 0.1;
    const color = options.color || 0xcccccc;
    this.gravity = options.gravity || 0.01;
    this.fadeRate = options.fadeRate || 0.02;

    // Create geometry
    this.geometry = new THREE.BufferGeometry();

    // Create arrays for particle attributes
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.lifetimes = new Float32Array(this.count);
    this.sizes = new Float32Array(this.count);

    // Initialize arrays with default values
    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = 0;

      this.velocities[i * 3] = 0;
      this.velocities[i * 3 + 1] = 0;
      this.velocities[i * 3 + 2] = 0;

      this.lifetimes[i] = 0;
      this.sizes[i] = size;
    }

    // Set attributes
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.geometry.setAttribute(
      "size",
      new THREE.BufferAttribute(this.sizes, 1)
    );

    // Create material
    this.material = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: size,
      transparent: true,
      opacity: options.opacity || 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      vertexColors: false,
    });

    // Create dust texture
    const texture = this.createDustTexture();
    this.material.map = texture;

    // Create points
    this.particles = new THREE.Points(this.geometry, this.material);
    this.particles.frustumCulled = false;
    this.particles.visible = false;

    // Add to scene
    this.scene.add(this.particles);
  }

  private createDustTexture(): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get canvas context");

    // Create radial gradient for dust particle
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.8)");
    gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.3)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
  }

  public emit(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    spread = 0.3,
    speed = 0.05
  ): void {
    // Make particles visible
    this.particles.visible = true;

    // Reset all particles
    for (let i = 0; i < this.count; i++) {
      // Position at emission point with minimal random offset
      this.positions[i * 3] = position.x + (Math.random() - 0.5) * 0.1;
      this.positions[i * 3 + 1] = 0.1; // Higher above ground for better visibility
      this.positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.1;

      // Calculate velocity ONLY in opposite direction of die movement
      // with a slight upward component
      const oppositeDir = direction.clone().negate();

      // Base velocity in opposite direction of movement, but slower than the die
      const baseSpeed = speed * 0.5; // 50% of die speed for better visibility

      // Add randomness to speed but keep direction consistent
      const randomFactor = 0.7 + Math.random() * 0.6; // 70-130% of base speed

      this.velocities[i * 3] = oppositeDir.x * baseSpeed * randomFactor;
      this.velocities[i * 3 + 1] = 0.05 + Math.random() * 0.05; // More upward velocity
      this.velocities[i * 3 + 2] = oppositeDir.z * baseSpeed * randomFactor;

      // Add a very small random spread perpendicular to movement direction
      // This creates a narrow cone of particles behind the die
      const perpX = -oppositeDir.z; // Perpendicular to movement direction
      const perpZ = oppositeDir.x;
      const spreadAmount = (Math.random() - 0.5) * spread * 0.5;

      this.velocities[i * 3] += perpX * spreadAmount;
      this.velocities[i * 3 + 2] += perpZ * spreadAmount;

      // Longer lifetime
      this.lifetimes[i] = 0.6 + Math.random() * 0.4; // Longer lifetime for visibility

      // Larger size
      this.sizes[i] = this.material.size * (1.2 + Math.random() * 0.8); // Larger particles
    }

    // Update geometry attributes
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    // Start animation if not already running
    if (!this.isActive) {
      this.isActive = true;
      this.animate();
    }
  }

  private animate(): void {
    if (!this.isActive) return;

    let allDead = true;

    // Update particles
    for (let i = 0; i < this.count; i++) {
      // Skip dead particles
      if (this.lifetimes[i] <= 0) continue;

      // Update lifetime
      this.lifetimes[i] -= this.fadeRate;

      // If still alive, update position
      if (this.lifetimes[i] > 0) {
        allDead = false;

        // Apply velocity
        this.positions[i * 3] += this.velocities[i * 3];
        this.positions[i * 3 + 1] += this.velocities[i * 3 + 1];
        this.positions[i * 3 + 2] += this.velocities[i * 3 + 2];

        // Apply gravity
        this.velocities[i * 3 + 1] -= this.gravity;

        // Kill particle if it hits the ground
        if (this.positions[i * 3 + 1] <= 0.01) {
          this.lifetimes[i] = 0;
          continue;
        }

        // Scale size based on lifetime
        this.sizes[i] =
          this.material.size *
          (0.8 + Math.random() * 0.4) *
          (this.lifetimes[i] / 0.4);
      }
    }

    // Update geometry attributes
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;

    // If all particles are dead, stop animation
    if (allDead) {
      this.isActive = false;
      this.particles.visible = false;
      return;
    }

    // Continue animation
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  public dispose(): void {
    // Stop animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Remove from scene
    this.scene.remove(this.particles);

    // Dispose resources
    this.geometry.dispose();
    this.material.dispose();
    if (this.material.map) {
      this.material.map.dispose();
    }
  }
}
