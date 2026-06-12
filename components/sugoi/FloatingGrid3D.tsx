"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useSugoiStore } from "@/store/useSugoiStore";

export function FloatingGrid3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  const animationsEnabled = useSugoiStore((s) => s.settings.animationsEnabled);

  useEffect(() => {
    if (!animationsEnabled || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 0, -20);

    // Create grid
    const gridSize = 80;
    const gridDivisions = 40;
    const isDark = document.documentElement.classList.contains("dark");
    const gridColor = isDark ? 0xf5a623 : 0xd4a017;

    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
    gridHelper.position.y = -2;
    gridHelper.position.z = -20;

    // Make grid semi-transparent
    const gridMat = gridHelper.material as THREE.Material;
    if (Array.isArray(gridMat)) {
      gridMat.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.06;
        (m as THREE.LineBasicMaterial).blending = THREE.AdditiveBlending;
      });
    } else {
      gridMat.transparent = true;
      gridMat.opacity = 0.06;
      (gridMat as THREE.LineBasicMaterial).blending = THREE.AdditiveBlending;
    }

    scene.add(gridHelper);

    // --- Drifting Particles ---
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * gridSize;
      particlePositions[i * 3 + 1] = Math.random() * 20 - 2;
      particlePositions[i * 3 + 2] = -Math.random() * gridSize;
      particleSpeeds.push(0.05 + Math.random() * 0.1);
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    // Circular glowing particle texture
    const createParticleTexture = () => {
      const matCanvas = document.createElement("canvas");
      matCanvas.width = 16;
      matCanvas.height = 16;
      const matCtx = matCanvas.getContext("2d");
      if (matCtx) {
        const gradient = matCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.3, isDark ? "rgba(245, 166, 35, 0.8)" : "rgba(212, 160, 23, 0.8)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        matCtx.fillStyle = gradient;
        matCtx.fillRect(0, 0, 16, 16);
      }
      return new THREE.CanvasTexture(matCanvas);
    };

    const particleTexture = createParticleTexture();
    const particleMat = new THREE.PointsMaterial({
      size: 0.6,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.7,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Scan-line (a bright line sweeping across the grid)
    const scanLineGeo = new THREE.PlaneGeometry(gridSize, 0.15);
    const scanLineMat = new THREE.MeshBasicMaterial({
      color: gridColor,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const scanLine = new THREE.Mesh(scanLineGeo, scanLineMat);
    scanLine.rotation.x = -Math.PI / 2;
    scanLine.position.y = -1.95;
    scanLine.position.z = -20;
    scene.add(scanLine);

    // Second scan-line perpendicular
    const scanLine2Geo = new THREE.PlaneGeometry(0.15, gridSize);
    const scanLine2Mat = new THREE.MeshBasicMaterial({
      color: gridColor,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const scanLine2 = new THREE.Mesh(scanLine2Geo, scanLine2Mat);
    scanLine2.rotation.x = -Math.PI / 2;
    scanLine2.position.y = -1.95;
    scanLine2.position.z = -20;
    scene.add(scanLine2);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const handleResize = () => {
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const clock = new THREE.Clock();

    const tick = () => {
      frameIdRef.current = requestAnimationFrame(tick);
      const elapsed = clock.getElapsedTime();

      // Animate scan lines
      const scanPos = ((elapsed * 3) % gridSize) - gridSize / 2;
      scanLine.position.z = -20 + scanPos;
      scanLine.material.opacity = 0.08 + Math.sin(elapsed * 2) * 0.04;

      const scanPos2 = ((elapsed * 2.3) % gridSize) - gridSize / 2;
      scanLine2.position.x = scanPos2;
      scanLine2.material.opacity = 0.06 + Math.sin(elapsed * 1.7) * 0.03;

      // Animate particles (drift upwards and float)
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        // float upwards
        positions[i * 3 + 1] += particleSpeeds[i] * 0.15;
        // subtle horizontal drift
        positions[i * 3] += Math.sin(elapsed + i) * 0.005;

        // if it goes too high, reset to bottom
        if (positions[i * 3 + 1] > 18) {
          positions[i * 3 + 1] = -2;
          positions[i * 3] = (Math.random() - 0.5) * gridSize;
          positions[i * 3 + 2] = -Math.random() * gridSize;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Mouse parallax on camera
      camera.position.x += (mouseRef.current.x * 3 - camera.position.x) * 0.015;
      camera.position.y += (8 + mouseRef.current.y * 1.5 - camera.position.y) * 0.015;
      camera.lookAt(0, 0, -20);

      // Check dark mode and update colors
      const dark = document.documentElement.classList.contains("dark");
      const color = dark ? 0xf5a623 : 0xd4a017;
      scanLineMat.color.setHex(color);
      scanLine2Mat.color.setHex(color);

      renderer.render(scene, camera);
    };

    tick();

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      scanLineGeo.dispose();
      scanLineMat.dispose();
      scanLine2Geo.dispose();
      scanLine2Mat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      particleTexture.dispose();
    };
  }, [animationsEnabled]);

  if (!animationsEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        maskImage: "linear-gradient(to top, rgba(0,0,0,1) 5%, rgba(0,0,0,0) 70%)",
        WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 5%, rgba(0,0,0,0) 70%)",
      }}
    />
  );
}
