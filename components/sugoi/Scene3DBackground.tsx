"use client";

import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useSugoiStore } from "@/store/useSugoiStore";

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  baseOpacity: number;
  size: number;
  phase: number;
}

export function Scene3DBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const burstRef = useRef(false);
  const errorFlashRef = useRef(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameIdRef = useRef<number>(0);

  const mood = useSugoiStore((s) => s.persona.mood);
  const animationsEnabled = useSugoiStore((s) => s.settings.animationsEnabled);
  const prevMoodRef = useRef(mood);

  // Detect mood transitions for burst/flash effects
  useEffect(() => {
    if (prevMoodRef.current !== mood) {
      if (mood === "happy") {
        burstRef.current = true;
      }
      if (mood === "crying") {
        errorFlashRef.current = 1.0;
      }
      prevMoodRef.current = mood;
    }
  }, [mood]);

  const initScene = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, 30);

    // --- Particles ---
    const PARTICLE_COUNT = 180;
    const particles: Particle[] = [];
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 30 - 5;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const size = Math.random() * 2.5 + 0.5;
      sizes[i] = size;

      // Honey-gold palette
      const hue = 0.08 + Math.random() * 0.06; // 30-50 degree range
      const color = new THREE.Color().setHSL(hue, 0.8, 0.55 + Math.random() * 0.2);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      particles.push({
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008 + 0.003,
          (Math.random() - 0.5) * 0.004
        ),
        baseOpacity: 0.15 + Math.random() * 0.35,
        size,
        phase: Math.random() * Math.PI * 2,
      });
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
    particlesRef.current = particles;

    // --- Wireframe Icosahedron ---
    const icoGeometry = new THREE.IcosahedronGeometry(4, 1);
    const icoMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xd4a017),
      wireframe: true,
      transparent: true,
      opacity: 0.07,
    });
    const icoMesh = new THREE.Mesh(icoGeometry, icoMaterial);
    icoMesh.position.set(12, -3, -10);
    scene.add(icoMesh);

    // --- Secondary wireframe (smaller octahedron) ---
    const octGeometry = new THREE.OctahedronGeometry(2.2, 0);
    const octMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xf5a623),
      wireframe: true,
      transparent: true,
      opacity: 0.05,
    });
    const octMesh = new THREE.Mesh(octGeometry, octMaterial);
    octMesh.position.set(-14, 5, -8);
    scene.add(octMesh);

    // --- Connecting Lines (constellation effect) ---
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(PARTICLE_COUNT * 2 * 3); // pairs
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xd4a017,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
    });
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineSegments);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Resize handler
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation loop
    const clock = new THREE.Clock();

    const tick = () => {
      frameIdRef.current = requestAnimationFrame(tick);
      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Speed multiplier based on mood
      const currentMood = useSugoiStore.getState().persona.mood;
      const isLoading = currentMood === "thinking" || currentMood === "judging" || currentMood === "dead-inside" || currentMood === "glowing-eyes";
      const speedMul = isLoading ? 3.0 : 1.0;

      // Update particles
      const posAttr = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = particleGeometry.getAttribute("color") as THREE.BufferAttribute;

      let lineIdx = 0;
      const linePosAttr = lineGeometry.getAttribute("position") as THREE.BufferAttribute;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Movement
        p.position.x += p.velocity.x * speedMul;
        p.position.y += p.velocity.y * speedMul;
        p.position.z += p.velocity.z * speedMul;

        // Breathing oscillation
        p.position.y += Math.sin(elapsed * 0.5 + p.phase) * 0.003;

        // Mouse repulsion (subtle)
        const dx = p.position.x - mx * 15;
        const dy = p.position.y - my * 10;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8) {
          const force = (8 - dist) * 0.0008;
          p.position.x += dx * force;
          p.position.y += dy * force;
        }

        // Success burst effect
        if (burstRef.current) {
          const burstForce = 0.15;
          p.velocity.x += (Math.random() - 0.5) * burstForce;
          p.velocity.y += (Math.random() - 0.5) * burstForce;
          p.velocity.z += (Math.random() - 0.5) * burstForce * 0.5;
        }

        // Dampen velocities back to normal
        p.velocity.x *= 0.998;
        p.velocity.y *= 0.998;
        p.velocity.z *= 0.998;

        // Wrap around boundaries
        if (p.position.x > 32) p.position.x = -32;
        if (p.position.x < -32) p.position.x = 32;
        if (p.position.y > 22) p.position.y = -22;
        if (p.position.y < -22) p.position.y = 22;
        if (p.position.z > 10) p.position.z = -15;
        if (p.position.z < -20) p.position.z = 10;

        posAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);

        // Error flash — temporarily tint particles red
        if (errorFlashRef.current > 0) {
          const flash = errorFlashRef.current;
          colAttr.setXYZ(i, 0.86 * flash + (1 - flash) * colAttr.getX(i), 0.15 * flash, 0.15 * flash);
        }

        // Draw connection lines between nearby particles
        if (i < particles.length - 1 && lineIdx < PARTICLE_COUNT * 2) {
          const next = particles[i + 1];
          const d = p.position.distanceTo(next.position);
          if (d < 6) {
            linePosAttr.setXYZ(lineIdx, p.position.x, p.position.y, p.position.z);
            lineIdx++;
            linePosAttr.setXYZ(lineIdx, next.position.x, next.position.y, next.position.z);
            lineIdx++;
          }
        }
      }

      // Clear remaining line segments
      for (let j = lineIdx; j < PARTICLE_COUNT * 2; j++) {
        linePosAttr.setXYZ(j, 0, 0, 0);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      linePosAttr.needsUpdate = true;

      // Reset burst after one frame
      if (burstRef.current) burstRef.current = false;

      // Decay error flash
      if (errorFlashRef.current > 0) {
        errorFlashRef.current = Math.max(0, errorFlashRef.current - 0.02);
        if (errorFlashRef.current <= 0) {
          // Reset colors to gold
          for (let i = 0; i < particles.length; i++) {
            const hue = 0.08 + (i / particles.length) * 0.06;
            const c = new THREE.Color().setHSL(hue, 0.8, 0.55 + (i / particles.length) * 0.2);
            colAttr.setXYZ(i, c.r, c.g, c.b);
          }
          colAttr.needsUpdate = true;
        }
      }

      // Rotate wireframes
      icoMesh.rotation.x += 0.001 * speedMul;
      icoMesh.rotation.y += 0.0015 * speedMul;
      icoMesh.rotation.z += 0.0005 * speedMul;

      octMesh.rotation.x -= 0.0012 * speedMul;
      octMesh.rotation.y += 0.001 * speedMul;

      // Mouse parallax on camera
      camera.position.x += (mx * 2 - camera.position.x) * 0.02;
      camera.position.y += (my * 1.5 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      // Dynamic opacity based on loading state
      particleMaterial.opacity = isLoading ? 0.6 : 0.35;
      icoMaterial.opacity = isLoading ? 0.12 : 0.07;

      // Check dark mode
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        icoMaterial.color.setHex(0xf5a623);
        octMaterial.color.setHex(0xfbbf24);
        lineMaterial.opacity = 0.05;
      } else {
        icoMaterial.color.setHex(0xd4a017);
        octMaterial.color.setHex(0xf5a623);
        lineMaterial.opacity = 0.03;
      }

      renderer.render(scene, camera);
    };

    tick();

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      icoGeometry.dispose();
      icoMaterial.dispose();
      octGeometry.dispose();
      octMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    };
  }, []);

  useEffect(() => {
    if (!animationsEnabled) return;
    const cleanup = initScene();
    return cleanup;
  }, [animationsEnabled, initScene]);

  if (!animationsEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  );
}
