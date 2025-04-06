import * as THREE from "three";

export interface SceneManagerOptions {
  container: HTMLElement;
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public initialCameraPosition: THREE.Vector3;
  public initialCameraTarget: THREE.Vector3;

  constructor(options: SceneManagerOptions) {
    const { container } = options;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    // Camera setup - 45-degree angle view
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.initialCameraPosition = new THREE.Vector3(0, 35, 35); // Position at 45-degree angle
    this.initialCameraTarget = new THREE.Vector3(0, 0, 0); // Look at center of board
    this.camera.position.copy(this.initialCameraPosition);
    this.camera.lookAt(this.initialCameraTarget);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Setup lights
    this.setupLights();

    // Handle window resize
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  private setupLights(): void {
    // Ambient light - provides overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Main directional light (sun-like)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Secondary directional light from the opposite direction to reduce shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Subtle blue-tinted light from below for more dimension
    const groundLight = new THREE.DirectionalLight(0xaaccff, 0.2);
    groundLight.position.set(0, -5, 0);
    this.scene.add(groundLight);
  }

  private handleResize(): void {
    // Update camera aspect ratio
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    // Update renderer size
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public resetCamera(): void {
    this.camera.position.copy(this.initialCameraPosition);
    this.camera.lookAt(this.initialCameraTarget);
  }

  public cleanup(): void {
    // Remove event listeners
    window.removeEventListener("resize", this.handleResize.bind(this));

    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
