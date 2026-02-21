import * as THREE from 'three';
import type { Visualizer3D, QualityLevel, AudioData } from '../types';

interface Node {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  freqBin: number;
  active: boolean;
  activation: number;
}

export class NeuralNetwork implements Visualizer3D {
  name = 'Neural Network';

  private nodes: Node[] = [];
  private connections!: THREE.LineSegments;
  private connectionPositions!: Float32Array;
  private connectionColors!: Float32Array;
  private maxConnections = 0;
  private camera!: THREE.PerspectiveCamera;
  private cameraAngle = 0;
  private smoothEnergy = 0;
  private beatPulse = 0;
  private travelParticles!: THREE.Points;
  private travelPositions!: Float32Array;
  private travelData: { from: number; to: number; t: number; alive: boolean }[] = [];
  private nodeCount = 120;
  private connectionDist = 6;

  init(scene: THREE.Scene, quality: QualityLevel): void {
    this.nodeCount = quality === 'low' ? 60 : quality === 'medium' ? 90 : 120;
    const particleCount = quality === 'low' ? 50 : quality === 'medium' ? 100 : 200;

    this.camera = scene.parent?.children.find(
      (c) => c instanceof THREE.PerspectiveCamera,
    ) as THREE.PerspectiveCamera;

    scene.background = new THREE.Color(0x030308);

    // Create nodes
    const nodeGeo = new THREE.SphereGeometry(0.15, 8, 6);
    for (let i = 0; i < this.nodeCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x4466ff,
        emissive: 0x2233aa,
        emissiveIntensity: 0.3,
        metalness: 0.5,
        roughness: 0.3,
      });

      const mesh = new THREE.Mesh(nodeGeo, mat);
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
      );
      // Constrain to a sphere of radius 15
      if (pos.length() > 15) pos.setLength(Math.random() * 15);

      mesh.position.copy(pos);
      scene.add(mesh);

      this.nodes.push({
        mesh,
        position: pos,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
        ),
        freqBin: i % 1024,
        active: false,
        activation: 0,
      });
    }

    // Connections (pre-allocate for maximum possible)
    this.maxConnections = this.nodeCount * 4;
    const connGeo = new THREE.BufferGeometry();
    this.connectionPositions = new Float32Array(this.maxConnections * 6);
    this.connectionColors = new Float32Array(this.maxConnections * 6);
    connGeo.setAttribute('position', new THREE.BufferAttribute(this.connectionPositions, 3));
    connGeo.setAttribute('color', new THREE.BufferAttribute(this.connectionColors, 3));

    const connMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.connections = new THREE.LineSegments(connGeo, connMat);
    scene.add(this.connections);

    // Travel particles
    const travelGeo = new THREE.BufferGeometry();
    this.travelPositions = new Float32Array(particleCount * 3);
    this.travelData = [];
    for (let i = 0; i < particleCount; i++) {
      this.travelPositions[i * 3 + 1] = -1000; // hidden initially
      this.travelData.push({ from: 0, to: 0, t: 0, alive: false });
    }
    travelGeo.setAttribute('position', new THREE.BufferAttribute(this.travelPositions, 3));

    const travelMat = new THREE.PointsMaterial({
      size: 0.2,
      color: 0x88aaff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.travelParticles = new THREE.Points(travelGeo, travelMat);
    scene.add(this.travelParticles);

    // Lighting
    const ambient = new THREE.AmbientLight(0x222244, 0.4);
    scene.add(ambient);
    const point = new THREE.PointLight(0x6688ff, 2, 60);
    point.position.set(0, 0, 0);
    scene.add(point);

    if (this.camera) {
      this.camera.position.set(0, 5, 30);
      this.camera.lookAt(0, 0, 0);
    }
  }

  update(data: AudioData, time: number): void {
    const bass = data.bass || 0;
    const energy = data.energy || 0;
    const isBeat = 'isBeat' in data && !!(data as { isBeat?: boolean }).isBeat;
    const freq = data.frequency;

    const lerp = THREE.MathUtils.lerp;
    this.smoothEnergy = lerp(this.smoothEnergy, energy, 0.1);

    if (isBeat) this.beatPulse = 1.0;
    this.beatPulse *= 0.9;

    // Activation threshold
    const threshold = 80 + (1 - this.smoothEnergy) * 80;

    // Update nodes
    for (const node of this.nodes) {
      // Check activation
      const freqVal = freq[node.freqBin] || 0;
      node.active = freqVal > threshold;
      node.activation = lerp(node.activation, node.active ? 1 : 0, 0.2);

      // Drift
      const driftSpeed = 0.3 + this.smoothEnergy * 0.5;
      node.position.add(node.velocity.clone().multiplyScalar(driftSpeed));

      // Contain within sphere
      if (node.position.length() > 15) {
        node.velocity.reflect(node.position.clone().normalize());
        node.position.setLength(14.5);
      }

      node.mesh.position.copy(node.position);

      // Scale and emission based on activation
      const scale = 1 + node.activation * 1.5 + this.beatPulse * 0.5;
      node.mesh.scale.setScalar(scale);

      const mat = node.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.2 + node.activation * 2.0;

      const hue = 0.55 + node.activation * 0.15;
      mat.emissive.setHSL(hue, 0.9, 0.3 + node.activation * 0.3);
      mat.color.setHSL(hue, 0.7, 0.3 + node.activation * 0.3);
    }

    // Update connections
    let connIdx = 0;
    const maxDist = this.connectionDist + this.smoothEnergy * 3;

    for (let i = 0; i < this.nodes.length && connIdx < this.maxConnections; i++) {
      for (let j = i + 1; j < this.nodes.length && connIdx < this.maxConnections; j++) {
        const d = this.nodes[i].position.distanceTo(this.nodes[j].position);
        if (d < maxDist) {
          const bothActive = this.nodes[i].activation * this.nodes[j].activation;
          const brightness = 0.1 + bothActive * 0.9;

          const ci = connIdx * 6;
          this.connectionPositions[ci] = this.nodes[i].position.x;
          this.connectionPositions[ci + 1] = this.nodes[i].position.y;
          this.connectionPositions[ci + 2] = this.nodes[i].position.z;
          this.connectionPositions[ci + 3] = this.nodes[j].position.x;
          this.connectionPositions[ci + 4] = this.nodes[j].position.y;
          this.connectionPositions[ci + 5] = this.nodes[j].position.z;

          // Color: blue to white based on activation
          this.connectionColors[ci] = brightness * 0.4;
          this.connectionColors[ci + 1] = brightness * 0.6;
          this.connectionColors[ci + 2] = brightness;
          this.connectionColors[ci + 3] = brightness * 0.4;
          this.connectionColors[ci + 4] = brightness * 0.6;
          this.connectionColors[ci + 5] = brightness;

          // Spawn travel particles along active connections
          if (bothActive > 0.5 && isBeat) {
            this.spawnTravel(i, j);
          }

          connIdx++;
        }
      }
    }

    // Hide remaining connections
    for (let i = connIdx; i < this.maxConnections; i++) {
      const ci = i * 6;
      this.connectionPositions[ci + 1] = -1000;
      this.connectionPositions[ci + 4] = -1000;
    }

    this.connections.geometry.setDrawRange(0, connIdx * 2);
    (this.connections.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.connections.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    // Update travel particles
    const travelAttr = this.travelParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.travelData.length; i++) {
      const td = this.travelData[i];
      if (!td.alive) continue;

      td.t += 0.03;
      if (td.t >= 1) {
        td.alive = false;
        this.travelPositions[i * 3 + 1] = -1000;
        continue;
      }

      const from = this.nodes[td.from].position;
      const to = this.nodes[td.to].position;
      this.travelPositions[i * 3] = lerp(from.x, to.x, td.t);
      this.travelPositions[i * 3 + 1] = lerp(from.y, to.y, td.t);
      this.travelPositions[i * 3 + 2] = lerp(from.z, to.z, td.t);
    }
    travelAttr.needsUpdate = true;

    // Camera
    this.cameraAngle += 0.004 + this.smoothEnergy * 0.003;
    const camDist = 25 + Math.sin(time * 0.3) * 5;
    if (this.camera) {
      this.camera.position.x = Math.cos(this.cameraAngle) * camDist;
      this.camera.position.z = Math.sin(this.cameraAngle) * camDist;
      this.camera.position.y = Math.sin(time * 0.2) * 8 + bass * 3;
      this.camera.lookAt(0, 0, 0);
    }
  }

  private spawnTravel(from: number, to: number): void {
    for (let i = 0; i < this.travelData.length; i++) {
      if (!this.travelData[i].alive) {
        this.travelData[i] = { from, to, t: 0, alive: true };
        return;
      }
    }
  }

  dispose(): void {
    const nodeGeo = this.nodes[0]?.mesh.geometry;
    nodeGeo?.dispose();
    for (const n of this.nodes) {
      (n.mesh.material as THREE.Material).dispose();
    }
    this.nodes = [];
    this.connections.geometry.dispose();
    (this.connections.material as THREE.Material).dispose();
    this.travelParticles.geometry.dispose();
    (this.travelParticles.material as THREE.Material).dispose();
  }
}
