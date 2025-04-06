import * as THREE from "three";
import { CameraManager } from "./camera-manager";

export interface SceneManagerOptions {
  container: HTMLElement;
  enableShadows?: boolean;
  enableFog?: boolean;
}

export class SceneManager {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public cameraManager: CameraManager;

  // Store lights for potential updates
  private ambientLight!: THREE.AmbientLight;
  private hemisphereLight!: THREE.HemisphereLight;
  private mainLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private groundLight!: THREE.DirectionalLight;
  private redFlagLight!: THREE.PointLight;
  private blueFlagLight!: THREE.PointLight;

  private enableShadows: boolean;
  private enableFog: boolean;

  constructor(options: SceneManagerOptions) {
    const { container, enableShadows = true, enableFog = true } = options;

    this.enableShadows = enableShadows;
    this.enableFog = enableFog;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    // Add fog for depth
    if (this.enableFog) {
      this.scene.fog = new THREE.FogExp2(0x111111, 0.008);
    }

    // Initialize camera manager
    this.cameraManager = new CameraManager({
      container,
      initialPosition: new THREE.Vector3(0, 35, 35),
      initialTarget: new THREE.Vector3(0, 0, 0),
    });

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Enable shadows in renderer
    if (this.enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    container.appendChild(this.renderer.domElement);

    // Setup lights
    this.setupLights();

    // Handle window resize
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  private setupLights(): void {
    // Ambient light - provides overall illumination with a slight warm tint
    this.ambientLight = new THREE.AmbientLight(0xfff2e6, 0.4);
    this.scene.add(this.ambientLight);

    // Hemisphere light - simulates sky and ground reflection
    this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x554433, 0.5);
    this.scene.add(this.hemisphereLight);

    // Main directional light (sun-like)
    this.mainLight = new THREE.DirectionalLight(0xffffee, 1.0);
    this.mainLight.position.set(15, 25, 15);

    if (this.enableShadows) {
      this.mainLight.castShadow = true;

      // Improve shadow quality
      this.mainLight.shadow.mapSize.width = 2048;
      this.mainLight.shadow.mapSize.height = 2048;
      this.mainLight.shadow.camera.near = 0.5;
      this.mainLight.shadow.camera.far = 100;
      this.mainLight.shadow.camera.left = -30;
      this.mainLight.shadow.camera.right = 30;
      this.mainLight.shadow.camera.top = 30;
      this.mainLight.shadow.camera.bottom = -30;
      this.mainLight.shadow.bias = -0.0005;
    }

    this.scene.add(this.mainLight);

    // Secondary directional light from the opposite direction to reduce shadows
    this.fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
    this.fillLight.position.set(-15, 10, -15);
    this.scene.add(this.fillLight);

    // Subtle blue-tinted light from below for more dimension
    this.groundLight = new THREE.DirectionalLight(0x6688cc, 0.15);
    this.groundLight.position.set(0, -10, 0);
    this.scene.add(this.groundLight);

    // Add point lights near flag positions for local illumination
    // Red flag light
    this.redFlagLight = new THREE.PointLight(0xff6666, 0.7, 15);
    this.redFlagLight.position.set(0, 3, 8); // Position will be adjusted based on actual flag position
    this.scene.add(this.redFlagLight);

    // Blue flag light
    this.blueFlagLight = new THREE.PointLight(0x6666ff, 0.7, 15);
    this.blueFlagLight.position.set(0, 3, -8); // Position will be adjusted based on actual flag position
    this.scene.add(this.blueFlagLight);
  }

  // Method to update flag light positions based on actual flag positions
  public updateFlagLightPositions(
    redFlagPos: THREE.Vector3,
    blueFlagPos: THREE.Vector3
  ): void {
    if (this.redFlagLight && this.blueFlagLight) {
      this.redFlagLight.position.set(
        redFlagPos.x,
        redFlagPos.y + 3,
        redFlagPos.z
      );
      this.blueFlagLight.position.set(
        blueFlagPos.x,
        blueFlagPos.y + 3,
        blueFlagPos.z
      );
    }
  }

  // Method to adjust overall lighting brightness
  public adjustLightingBrightness(factor: number): void {
    this.ambientLight.intensity = 0.4 * factor;
    this.hemisphereLight.intensity = 0.5 * factor;
    this.mainLight.intensity = 1.0 * factor;
    this.fillLight.intensity = 0.4 * factor;
    this.groundLight.intensity = 0.15 * factor;
    this.redFlagLight.intensity = 0.7 * factor;
    this.blueFlagLight.intensity = 0.7 * factor;
  }

  private handleResize(): void {
    // Update renderer size
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  public resetCamera(): void {
    this.cameraManager.resetCamera();
  }

  public cleanup(): void {
    // Remove event listeners
    window.removeEventListener("resize", this.handleResize.bind(this));

    // Clean up camera manager
    this.cameraManager.cleanup();

    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
