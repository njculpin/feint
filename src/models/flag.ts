import * as THREE from "three";

export interface FlagOptions {
  position?: THREE.Vector3;
  poleHeight?: number;
  poleRadius?: number;
  flagWidth?: number;
  flagHeight?: number;
  poleColor?: string | number;
  flagColor?: string | number;
}

export class Flag {
  mesh: THREE.Group;
  position: THREE.Vector3;

  constructor(options: FlagOptions = {}) {
    // Set default values
    this.position = options.position || new THREE.Vector3(0, 0, 0);
    const poleHeight = options.poleHeight || 4.0; // Even taller pole
    const poleRadius = options.poleRadius || 0.15; // Much thicker pole
    const flagWidth = options.flagWidth || 2.0; // Much wider flag
    const flagHeight = options.flagHeight || 1.2; // Much taller flag
    const poleColor = options.poleColor || 0x8b4513; // Brown
    const flagColor = options.flagColor || 0xff0000; // Red

    // Create a group to hold all parts of the flag
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);

    // Create the flag pole (cylinder)
    const poleGeometry = new THREE.CylinderGeometry(
      poleRadius,
      poleRadius * 1.3,
      poleHeight,
      12
    );
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: poleColor,
      roughness: 0.7,
      metalness: 0.2,
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);

    // Position the pole so its bottom is at y=0
    pole.position.y = poleHeight / 2;
    pole.castShadow = true;
    pole.receiveShadow = true;
    this.mesh.add(pole);

    // Add edge highlight to the pole
    this.addEdgeHighlight(pole);

    // Create a triangular flag using an extruded shape for thickness
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(flagWidth, flagHeight / 2);
    flagShape.lineTo(0, flagHeight);
    flagShape.lineTo(0, 0);

    // Extrude the shape to give it thickness
    const extrudeSettings = {
      steps: 1,
      depth: 0.05, // Thickness of the flag
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    };

    const flagGeometry = new THREE.ExtrudeGeometry(flagShape, extrudeSettings);

    // Add a slight wave to the flag
    const vertices = flagGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < vertices.length; i += 3) {
      // Only modify z-coordinates for points away from the pole
      if (vertices[i] > 0.1) {
        // Add a sine wave effect that increases with distance from pole
        const xPos = vertices[i];
        const yPos = vertices[i + 1];
        vertices[i + 2] +=
          Math.sin(xPos * 3 + yPos * 2) * 0.1 * (xPos / flagWidth);
      }
    }

    // Update normals for proper lighting
    flagGeometry.computeVertexNormals();

    const flagMaterial = new THREE.MeshStandardMaterial({
      color: flagColor,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide, // Visible from both sides
    });
    const flag = new THREE.Mesh(flagGeometry, flagMaterial);

    // Position the flag near the top of the pole
    flag.position.set(0, poleHeight - flagHeight - 0.2, 0);
    flag.castShadow = true;
    flag.receiveShadow = true;

    // Rotate the flag to face the camera (perpendicular to the camera view)
    // Assuming camera is at positive Z looking toward origin
    flag.rotation.y = 0; // This makes the flag face the positive Z direction

    this.mesh.add(flag);

    // Add edge highlight to the flag
    this.addEdgeHighlight(flag);

    // Add a larger sphere at the top of the pole
    const topSphereGeometry = new THREE.SphereGeometry(
      poleRadius * 2.5,
      16,
      16
    );
    const topSphereMaterial = new THREE.MeshStandardMaterial({
      color: poleColor,
      roughness: 0.7,
      metalness: 0.3,
    });
    const topSphere = new THREE.Mesh(topSphereGeometry, topSphereMaterial);
    topSphere.position.y = poleHeight;
    topSphere.castShadow = true;
    topSphere.receiveShadow = true;
    this.mesh.add(topSphere);

    // Add edge highlight to the top sphere
    this.addEdgeHighlight(topSphere);
  }

  // Add edge highlighting to a mesh
  private addEdgeHighlight(targetMesh: THREE.Mesh): void {
    // Create edges geometry from the target mesh's geometry
    const edgeGeometry = new THREE.EdgesGeometry(targetMesh.geometry);

    // Create a material for the edges
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      linewidth: 1,
    });

    // Create the edge highlight mesh
    const edgeHighlight = new THREE.LineSegments(edgeGeometry, edgeMaterial);

    // Make the edge highlight slightly larger than the target mesh
    edgeHighlight.scale.set(1.01, 1.01, 1.01);

    // Add the edge highlight as a child of the target mesh
    targetMesh.add(edgeHighlight);
  }

  // Set the position of the flag
  setPosition(position: THREE.Vector3): void {
    this.position.copy(position);
    this.mesh.position.copy(position);
  }

  // Add the flag to a scene
  addToScene(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  // Remove the flag from a scene
  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }
}
