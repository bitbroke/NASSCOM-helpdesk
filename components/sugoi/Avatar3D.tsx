"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import gsap from "gsap";
import { useSugoiStore } from "@/store/useSugoiStore";

export type AvatarState = "greeting" | "idle" | "typing" | "loading" | "success" | "error" | "teased";

interface Avatar3DProps {
  appState?: "idle" | "typing" | "loading" | "success" | "error";
}

export function Avatar3D({ appState }: Avatar3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  
  // Track states in refs for the frame loop to avoid delays/stale closures
  const stateRef = useRef<AvatarState>("greeting");
  const pendingStateRef = useRef<AvatarState>("idle");
  const mousePosRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const isLoadedRef = useRef(false);
  const currentTargetRef = useRef<"sidebar" | "input" | "header">("header");
  const focusOutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActionRef = useRef<"focus" | "scroll">("scroll");

  // Inertia and winking timer refs
  const successStartTimeRef = useRef(0);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Derive appState from global Zustand store if not explicitly passed as a prop
  const storeMood = useSugoiStore((state) => state.persona.mood);
  const storeProcessing = useSugoiStore((state) => state.ml.isProcessing);
  const settings = useSugoiStore((state) => state.settings);
  const setMood = useSugoiStore((state) => state.setMood);

  const [uiState, setUiState] = useState<AvatarState>("greeting");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);

  // Ensure client-side only execution to avoid SSR mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Map Zustand store state or props to our AvatarState machine
  useEffect(() => {
    if (!isLoadedRef.current) return;

    let targetState: AvatarState = "idle";

    // 1. If prop is provided, respect it
    if (appState) {
      if (appState === "loading") targetState = "loading";
      else if (appState === "success") targetState = "success";
      else if (appState === "error") targetState = "error";
      else if (appState === "typing") targetState = "typing";
      else targetState = "idle";
    } else {
      // 2. Otherwise map from Zustand store
      if (storeProcessing) {
        targetState = "loading";
      } else if (storeMood === "happy") {
        if (stateRef.current === "loading") {
          targetState = "success";
        } else {
          targetState = "idle";
        }
      } else if (storeMood === "crying") {
        if (stateRef.current === "loading") {
          targetState = "error";
        } else {
          targetState = "idle";
        }
      } else {
        targetState = "idle";
      }
    }

    // Do not override active typing, greeting, or teased states with idle
    if (targetState === "idle" && (stateRef.current === "typing" || stateRef.current === "greeting" || stateRef.current === "teased")) {
      return;
    }

    transitionTo(targetState);
  }, [appState, storeMood, storeProcessing]);

  // Handle global textarea focus, click, and quick-issue events for the sitting animation
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.id === "describe-issue-input") {
        if (focusOutTimeoutRef.current) {
          clearTimeout(focusOutTimeoutRef.current);
          focusOutTimeoutRef.current = null;
        }
        lastActionRef.current = "focus";
        transitionTo("typing");
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.id === "describe-issue-input") {
        if (focusOutTimeoutRef.current) {
          clearTimeout(focusOutTimeoutRef.current);
        }
        // Delay the transition to idle to allow quick-issue events to cancel it
        focusOutTimeoutRef.current = setTimeout(() => {
          transitionTo("idle");
          focusOutTimeoutRef.current = null;
        }, 150);
      }
    };

    // Listen for quick issue selection — move avatar below the input
    const handleQuickIssue = () => {
      if (focusOutTimeoutRef.current) {
        clearTimeout(focusOutTimeoutRef.current);
        focusOutTimeoutRef.current = null;
      }
      lastActionRef.current = "focus";
      transitionTo("typing");
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.id === "describe-issue-input" || target.closest("#describe-issue-card"))) {
        lastActionRef.current = "focus";
        transitionTo("typing");
      }
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    window.addEventListener("sugoi-quick-issue", handleQuickIssue);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("sugoi-quick-issue", handleQuickIssue);
      window.removeEventListener("click", handleClick);
      if (focusOutTimeoutRef.current) clearTimeout(focusOutTimeoutRef.current);
    };
  }, []);

  // Track cursor positions for linear interpolation (lerp) eye/head tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // State Machine transition handler
  const transitionTo = (newState: AvatarState, force = false) => {
    if (!containerRef.current) return;

    // If teased, queue the next state and process it after the teased state expires
    if (!force && stateRef.current === "teased" && newState !== "teased") {
      pendingStateRef.current = newState;
      return;
    }

    stateRef.current = newState;
    setUiState(newState);

    if (newState !== "typing") {
      lastActionRef.current = "scroll";
    }

    if (newState === "success") {
      successStartTimeRef.current = clockRef.current.getElapsedTime();
      
      const onCompleteSuccess = () => {
        setTimeout(() => {
          if (stateRef.current === "success") {
            if (!appState) {
              setMood("idle");
            } else {
              transitionTo("idle");
            }
          }
        }, 3000);
      };
      onCompleteSuccess();
    } else if (newState === "error") {
      const onCompleteError = () => {
        setTimeout(() => {
          if (stateRef.current === "error") {
            if (!appState) {
              setMood("idle");
            } else {
              transitionTo("idle");
            }
          }
        }, 5000);
      };
      onCompleteError();
    } else if (newState === "greeting") {
      setTimeout(() => {
        if (stateRef.current === "greeting") {
          transitionTo("idle");
        }
      }, 3000);
    }

    // Update target position on state transition
    updatePosition(false);
  };

  // Function to compute and update the mascot element's viewport-relative position via GSAP
  const updatePosition = (instant = false) => {
    if (typeof window === "undefined" || !containerRef.current) return;

    const inputCard = document.getElementById("describe-issue-card");
    let isAtTop = true;
    if (inputCard) {
      const rect = inputCard.getBoundingClientRect();
      // The input card is below the fold (scrolled out of view at bottom) if its top is at/below the viewport boundary
      isAtTop = rect.top >= window.innerHeight - 50;
    } else {
      const scrollContainer = document.getElementById("main-scroll-container") || document.querySelector(".overflow-y-auto");
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      isAtTop = scrollTop < 100;
    }

    const activeState = stateRef.current;

    // Determine target based on active state, scroll position, and last user interaction
    let target: "sidebar" | "input" | "header" = "sidebar";
    if (lastActionRef.current === "focus" && activeState === "typing") {
      target = "input";
    } else {
      if (isAtTop) {
        target = "header";
      } else {
        target = "sidebar";
      }
    }

    currentTargetRef.current = target;

    let targetX = window.innerWidth / 2 - 175;
    let targetY = window.innerHeight / 2 - 175;

    if (target === "header") {
      const headerContainer = document.getElementById("header-mascot-container");
      if (headerContainer) {
        const rect = headerContainer.getBoundingClientRect();
        targetX = rect.left + rect.width / 2 - 175;
        targetY = rect.top + rect.height / 2 - 175 - 40;
      }
    } else if (target === "input") {
      const inputCard = document.getElementById("describe-issue-card");
      if (inputCard) {
        const rect = inputCard.getBoundingClientRect();
        targetX = rect.left + rect.width / 2 - 175;
        targetY = rect.bottom - 40;
      }
    } else {
      const sidebarContainer = document.getElementById("sidebar-mascot-container");
      if (sidebarContainer) {
        const rect = sidebarContainer.getBoundingClientRect();
        targetX = rect.left + rect.width / 2 - 175;
        const viewportTop = Math.max(80, rect.top);
        targetY = viewportTop + rect.height / 2 - 175 - 45;
      }
    }

    if (targetX !== 0 && targetY !== 0) {
      const duration = instant ? 0 : (settings.animationsEnabled ? 0.8 : 0);
      gsap.to(containerRef.current, {
        x: targetX,
        y: targetY,
        scale: 0.9,
        duration: duration,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  };

  // Teasing interactive reaction on clicked model
  const triggerTease = () => {
    if (stateRef.current === "teased") return;

    pendingStateRef.current = stateRef.current;
    stateRef.current = "teased";
    setUiState("teased");

    setTimeout(() => {
      if (stateRef.current === "teased") {
        transitionTo(pendingStateRef.current, true);
      }
    }, 2000);
  };

  // Three.js Raycaster click detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!vrmRef.current || !cameraRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
    const intersects = raycaster.intersectObjects(vrmRef.current.scene.children, true);

    if (intersects.length > 0) {
      triggerTease();
    }
  };

    // Setup ThreeJS and VRM loader
    useEffect(() => {
      if (!isClient || !canvasRef.current || !containerRef.current) return;
  
      const canvas = canvasRef.current;
      const container = containerRef.current;
      let animationFrameId: number;
  
      lastXRef.current = 0;
      lastYRef.current = 0;
      lastTimeRef.current = performance.now();

      // Initial positioning after component mount
      setTimeout(() => updatePosition(true), 100);

      // Recalculate offsets when window resizes
      const handleResize = () => {
        updatePosition(false);
      };

      let scrollTimeout: number | null = null;
      // Handle scroll events globally using capturing to guarantee we receive them
      const handleScroll = () => {
        lastActionRef.current = "scroll";
        if (scrollTimeout) {
          cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = requestAnimationFrame(() => {
          updatePosition(true);
        });
      };

      window.addEventListener("resize", handleResize, { passive: true });
      window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    // 1. Setup Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Setup Camera
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0.0, 1.3, 1.6);
    camera.lookAt(0.0, 1.25, 0.0);
    cameraRef.current = camera;

    // 3. Setup Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(1.0, 2.0, 1.5).normalize();
    scene.add(dirLight);

    // 4. Setup Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(350, 350);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Helper to smoothly slerp bone quaternions
    const lerpRotation = (vrm: VRM, boneName: string, tX: number, tY: number, tZ: number, lerpVal = 0.08) => {
      const bone = vrm.humanoid.getNormalizedBoneNode(boneName as any);
      if (bone) {
        const targetEuler = new THREE.Euler(tX, tY, tZ);
        const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);
        bone.quaternion.slerp(targetQuaternion, lerpVal);
      }
    };

    // Helper to smoothly interpolate facial expressions
    const lerpExpression = (vrm: VRM, name: string, targetValue: number, lerpVal = 0.1) => {
      if (!vrm.expressionManager) return;
      const currentVal = vrm.expressionManager.getValue(name) || 0;
      vrm.expressionManager.setValue(name, THREE.MathUtils.lerp(currentVal, targetValue, lerpVal));
    };

    // Helper to reset and fade all other expressions to 0
    const resetOtherExpressions = (vrm: VRM, activeName: string, lerpVal = 0.15) => {
      const expressionManager = vrm.expressionManager;
      if (!expressionManager) return;
      const allExpressions = ["joy", "sorrow", "angry", "surprised", "relaxed", "blink", "blinkLeft", "blinkRight"];
      allExpressions.forEach((exp) => {
        if (exp !== activeName) {
          const val = expressionManager.getValue(exp) || 0;
          if (val > 0.01) {
            expressionManager.setValue(exp, THREE.MathUtils.lerp(val, 0, lerpVal));
          } else {
            expressionManager.setValue(exp, 0);
          }
        }
      });
    };

    // 5. Load VRM File
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      "/L.vrm",
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        vrmRef.current = vrm;

        // Position VRM model
        vrm.scene.rotation.y = Math.PI; // Face the camera
        vrm.scene.position.set(0, 0, 0);
        scene.add(vrm.scene);

        // Disable automatic lookAt eye rotation so we can manually rotate eyeball bones
        if (vrm.lookAt) {
          vrm.lookAt.autoUpdate = false;
        }

        // Turn off frustrated console logs on load
        console.log("3D Mascot: VRM successfully loaded.", vrm);
        isLoadedRef.current = true;
        setLoadingProgress(100);

        // Initialize state machine
        transitionTo("greeting");

        // Position the mascot after a brief layout stabilization delay
        setTimeout(() => updatePosition(true), 100);
      },
      (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        setLoadingProgress(percent);
      },
      (error) => {
        console.error("3D Mascot: Error loading VRM model", error);
      }
    );

    // 6. Animation Frame Loop
    const tick = () => {
      animationFrameId = requestAnimationFrame(tick);

      const deltaTime = clockRef.current.getDelta();
      const time = clockRef.current.getElapsedTime();
      timeRef.current = time;

      const activeState = stateRef.current;

      const vrm = vrmRef.current;
      if (vrm) {
        // --- 3D SCENE JUMP / SHIVER ANIMATIONS ON VRM.SCENE.POSITION ---
        if (activeState === "success") {
          vrm.scene.position.set(0, 0, 0);
        } else if (activeState === "error") {
          if (settings.animationsEnabled) {
            vrm.scene.position.x = Math.sin(time * 50.0) * 0.02;
            vrm.scene.position.y = -0.08;
            vrm.scene.position.z = 0;
          } else {
            vrm.scene.position.set(0, 0, 0);
          }
        } else if (activeState === "teased") {
          if (settings.animationsEnabled) {
            vrm.scene.position.x = Math.sin(time * 40.0) * 0.03;
            vrm.scene.position.y = Math.cos(time * 40.0) * 0.02;
            vrm.scene.position.z = 0;
          } else {
            vrm.scene.position.set(0, 0, 0);
          }
        } else {
          vrm.scene.position.set(0, 0, 0);
        }

        // Velocity tracking & Inertia physics tilt (sways hair naturally during movement) without triggering layout reflow
        if (containerRef.current) {
          const currentX = parseFloat(gsap.getProperty(containerRef.current, "x") as string) || 0;
          const currentY = parseFloat(gsap.getProperty(containerRef.current, "y") as string) || 0;

          const now = performance.now();
          const dt = (now - lastTimeRef.current) / 1000;
          
          if (dt > 0.001) {
            const vx = (currentX - lastXRef.current) / dt;
            const vy = (currentY - lastYRef.current) / dt;
            
            // Tilt the model back in direction of movement (inertia)
            const targetTiltZ = THREE.MathUtils.clamp(-vx * 0.0003, -0.25, 0.25);
            const targetTiltX = THREE.MathUtils.clamp(vy * 0.0003, -0.25, 0.25);
            
            vrm.scene.rotation.z = THREE.MathUtils.lerp(vrm.scene.rotation.z, targetTiltZ, 0.1);
            vrm.scene.rotation.x = THREE.MathUtils.lerp(vrm.scene.rotation.x, targetTiltX, 0.1);
            
            lastXRef.current = currentX;
            lastYRef.current = currentY;
            lastTimeRef.current = now;
          }
        }

        // Update spring bones for physics (cloth, hair)
        vrm.update(deltaTime);

        // Global Natural Blinking (runs in all states except during success winking)
        const blinkCycle = time % 4.0;
        let blinkValue = 0.0;
        if (blinkCycle > 3.7) {
          blinkValue = Math.sin((blinkCycle - 3.7) * Math.PI * 3.3);
        }
        if (activeState !== "success") {
          lerpExpression(vrm, "blink", blinkValue, 0.25);
        }

        // State-specific bone & expression animations
        switch (activeState) {
          case "greeting":
            // Bowing spine & neck
            lerpRotation(vrm, "spine", 0.15, 0.0, 0.0);
            lerpRotation(vrm, "neck", 0.25, 0.0, 0.0);
            lerpRotation(vrm, "head", 0.05, 0.0, 0.0);

            // Wave right upper & lower arm
            lerpRotation(vrm, "rightUpperArm", 0.3, 0.0, -0.6);
            lerpRotation(vrm, "rightLowerArm", 0.8, Math.sin(time * 10) * 0.4, 0.0, 0.15);
            
            // Left arm hanging down naturally next to hips
            lerpRotation(vrm, "leftUpperArm", 0.1, 0.0, 1.35);
            lerpRotation(vrm, "leftLowerArm", 0.0, 0.0, 0.0);

            // Joy facial expression
            lerpExpression(vrm, "joy", 1.0);
            resetOtherExpressions(vrm, "joy");
            break;

          case "idle":
            // Standard breathing / posture
            lerpRotation(vrm, "spine", Math.sin(time * 1.8) * 0.02, 0.0, 0.0, 0.04);
            
            // Track cursor coordinates with head, neck, and eyeballs
            const targetHeadY = mousePosRef.current.x * 0.45;
            const targetHeadX = -mousePosRef.current.y * 0.25;
            const targetEyeY = mousePosRef.current.x * 0.35;
            const targetEyeX = -mousePosRef.current.y * 0.2;

            lerpRotation(vrm, "head", targetHeadX, targetHeadY, 0.0, 0.08);
            lerpRotation(vrm, "neck", targetHeadX * 0.4, targetHeadY * 0.4, 0.0, 0.08);
            lerpRotation(vrm, "leftEye", targetEyeX, targetEyeY, 0.0, 0.1);
            lerpRotation(vrm, "rightEye", targetEyeX, targetEyeY, 0.0, 0.1);

            // Idle break fidget animation system (every 20 seconds)
            const idleBreakTime = time % 20.0;
            const currentStoreMood = useSugoiStore.getState().persona.mood;

            if (idleBreakTime < 3.0) {
              // Gesture 1: Wave left hand and smile
              lerpRotation(vrm, "leftUpperArm", 0.3, 0.0, 0.6);
              lerpRotation(vrm, "leftLowerArm", 0.8, -Math.sin(time * 8.0) * 0.4, 0.0, 0.15);
              lerpRotation(vrm, "rightUpperArm", 0.1, 0.0, -1.35); // hanging down normally
              lerpRotation(vrm, "rightLowerArm", 0.0, 0.0, 0.0);

              lerpExpression(vrm, "joy", 0.85);
              resetOtherExpressions(vrm, "joy");
            } else if (idleBreakTime > 10.0 && idleBreakTime < 13.0) {
              // Gesture 2: Puzzled head tilt and think
              lerpRotation(vrm, "head", targetHeadX, targetHeadY, Math.sin(time * 2.5) * 0.12, 0.08);
              lerpRotation(vrm, "neck", targetHeadX * 0.4, targetHeadY * 0.4, Math.sin(time * 2.5) * 0.06, 0.08);

              lerpRotation(vrm, "leftUpperArm", 0.1, 0.0, 1.35);
              lerpRotation(vrm, "leftLowerArm", 0.0, 0.0, 0.0);
              lerpRotation(vrm, "rightUpperArm", 0.1, 0.0, -1.35);
              lerpRotation(vrm, "rightLowerArm", 0.0, 0.0, 0.0);

              lerpExpression(vrm, "relaxed", 0.7);
              resetOtherExpressions(vrm, "relaxed");
            } else {
              // Standard Relaxed Pose (hanging down naturally)
              lerpRotation(vrm, "leftUpperArm", 0.1, 0.0, 1.35);
              lerpRotation(vrm, "leftLowerArm", 0.0, 0.0, 0.0);
              lerpRotation(vrm, "rightUpperArm", 0.1, 0.0, -1.35);
              lerpRotation(vrm, "rightLowerArm", 0.0, 0.0, 0.0);

              // Expression updates based on global mood when not breaking
              if (currentStoreMood === "judging") {
                lerpExpression(vrm, "angry", 0.4);
                resetOtherExpressions(vrm, "angry");
              } else if (currentStoreMood === "glowing-eyes") {
                lerpExpression(vrm, "angry", 0.85);
                resetOtherExpressions(vrm, "angry");
              } else if (currentStoreMood === "dead-inside") {
                lerpExpression(vrm, "sorrow", 0.75);
                resetOtherExpressions(vrm, "sorrow");
              } else if (currentStoreMood === "crying") {
                lerpExpression(vrm, "sorrow", 0.95);
                resetOtherExpressions(vrm, "sorrow");
              } else if (currentStoreMood === "happy") {
                lerpExpression(vrm, "joy", 0.95);
                resetOtherExpressions(vrm, "joy");
              } else {
                resetOtherExpressions(vrm, "blink");
              }
            }
            break;

          case "typing":
            // Lean forward and look towards the input box (which is to the right of the sidebar)
            lerpRotation(vrm, "spine", 0.05, 0.0, 0.0);
            lerpRotation(vrm, "neck", 0.1, -0.25, 0.0);
            lerpRotation(vrm, "head", 0.15, -0.35, 0.0, 0.08);

            // Eyes focus towards the input area
            lerpRotation(vrm, "leftEye", 0.1, -0.3, 0.0, 0.1);
            lerpRotation(vrm, "rightEye", 0.1, -0.3, 0.0, 0.1);

            // Arms hanging down naturally next to hips (no wave movement)
            lerpRotation(vrm, "leftUpperArm", 0.1, 0.0, 1.35);
            lerpRotation(vrm, "leftLowerArm", 0.0, 0.0, 0.0);
            lerpRotation(vrm, "rightUpperArm", 0.1, 0.0, -1.35);
            lerpRotation(vrm, "rightLowerArm", 0.0, 0.0, 0.0);

            // Expression updates based on global mood when not breaking
            const currentTypingMood = useSugoiStore.getState().persona.mood;
            if (currentTypingMood === "judging") {
              lerpExpression(vrm, "angry", 0.4);
              resetOtherExpressions(vrm, "angry");
            } else if (currentTypingMood === "glowing-eyes") {
              lerpExpression(vrm, "angry", 0.85);
              resetOtherExpressions(vrm, "angry");
            } else if (currentTypingMood === "dead-inside") {
              lerpExpression(vrm, "sorrow", 0.75);
              resetOtherExpressions(vrm, "sorrow");
            } else if (currentTypingMood === "crying") {
              lerpExpression(vrm, "sorrow", 0.95);
              resetOtherExpressions(vrm, "sorrow");
            } else if (currentTypingMood === "happy") {
              lerpExpression(vrm, "joy", 0.95);
              resetOtherExpressions(vrm, "joy");
            } else {
              lerpExpression(vrm, "joy", 0.75);
              resetOtherExpressions(vrm, "joy");
            }
            break;

          case "loading":
            // Tilt head slightly
            lerpRotation(vrm, "spine", 0.0, 0.0, 0.0);
            lerpRotation(vrm, "neck", 0.1, 0.0, 0.05);
            lerpRotation(vrm, "head", 0.1, 0.0, 0.08);

            // Eyes look up and side in thought
            lerpRotation(vrm, "leftEye", -0.05, 0.05, 0.0, 0.1);
            lerpRotation(vrm, "rightEye", -0.05, 0.05, 0.0, 0.1);

            // Hand to chin (Right Arm raised forward and up)
            lerpRotation(vrm, "rightUpperArm", -0.5, -0.4, -0.8);
            lerpRotation(vrm, "rightLowerArm", 1.5, 0.8, 0.0, 0.12);

            // Left arm folded across the chest to support the right elbow
            lerpRotation(vrm, "leftUpperArm", 0.3, 0.2, 1.1);
            lerpRotation(vrm, "leftLowerArm", 1.2, 0.5, 0.0, 0.12);

            // Custom facial expression based on the store mood during processing
            const currentLoadingMood = useSugoiStore.getState().persona.mood;
            if (currentLoadingMood === "glowing-eyes") {
              lerpExpression(vrm, "angry", 0.9);
              resetOtherExpressions(vrm, "angry");
            } else if (currentLoadingMood === "judging") {
              lerpExpression(vrm, "angry", 0.4);
              lerpExpression(vrm, "sorrow", 0.3);
              resetOtherExpressions(vrm, "angry");
            } else if (currentLoadingMood === "dead-inside") {
              lerpExpression(vrm, "sorrow", 0.8);
              resetOtherExpressions(vrm, "sorrow");
            } else {
              lerpExpression(vrm, "relaxed", 0.9);
              resetOtherExpressions(vrm, "relaxed");
            }
            break;

          case "success":
            // Lean back in joy
            lerpRotation(vrm, "spine", -0.1, 0.0, 0.0);
            lerpRotation(vrm, "neck", -0.1, 0.0, 0.0);
            lerpRotation(vrm, "head", -0.15, 0.0, 0.0);

            // Wave arms in victory
            const successWaveL = Math.sin(time * 12.0) * 0.2;
            const successWaveR = -Math.sin(time * 12.0) * 0.2;
            lerpRotation(vrm, "leftUpperArm", 0.2, 0.0, 1.6 + successWaveL);
            lerpRotation(vrm, "leftLowerArm", 0.3, 0.0, 0.0);
            lerpRotation(vrm, "rightUpperArm", 0.2, 0.0, -1.6 + successWaveR);
            lerpRotation(vrm, "rightLowerArm", 0.3, 0.0, 0.0);

            // Joy facial expression + wink right eye for the first 1.5 seconds, then return to normal
            const successTime = time - successStartTimeRef.current;
            const targetWink = successTime < 1.5 ? 1.0 : 0.0;
            
            lerpExpression(vrm, "joy", 1.0);
            lerpExpression(vrm, "blinkRight", targetWink, 0.15);
            // Clear other expressions except joy and blinkRight
            const currentExpMgr = vrm.expressionManager;
            if (currentExpMgr) {
              const allExps = ["sorrow", "angry", "surprised", "relaxed", "blink", "blinkLeft"];
              allExps.forEach((exp) => {
                const val = currentExpMgr.getValue(exp) || 0;
                currentExpMgr.setValue(exp, THREE.MathUtils.lerp(val, 0, 0.15));
              });
            }
            break;

          case "error":
            // Slouch head and spine with rocking motion
            lerpRotation(vrm, "spine", 0.28 + Math.sin(time * 4.0) * 0.05, 0.0, 0.0);
            lerpRotation(vrm, "neck", 0.25, 0.0, 0.0);
            // Sobbing vibration shake
            lerpRotation(vrm, "head", 0.15, Math.sin(time * 16.0) * 0.03, 0.0);

            // Hands covering eyes/face
            lerpRotation(vrm, "leftUpperArm", -0.75, 0.2, 0.4);
            lerpRotation(vrm, "leftLowerArm", 1.35, 0.55, 0.0);
            lerpRotation(vrm, "rightUpperArm", -0.75, -0.2, -0.4);
            lerpRotation(vrm, "rightLowerArm", 1.35, -0.55, 0.0);

            // Sorrow expression
            lerpExpression(vrm, "sorrow", 1.0);
            resetOtherExpressions(vrm, "sorrow");
            break;

          case "teased":
            // Snap head back dramatically in surprise
            lerpRotation(vrm, "spine", -0.05, 0.0, 0.0);
            lerpRotation(vrm, "neck", -0.25, 0.0, 0.0);
            lerpRotation(vrm, "head", -0.45, 0.0, 0.0);

            // Flail arms rapidly in surprise/fluster
            const teasedFlailL = Math.sin(time * 30.0) * 0.15;
            const teasedFlailR = Math.cos(time * 30.0) * 0.15;
            lerpRotation(vrm, "leftUpperArm", 0.2, 0.0, 0.7 + teasedFlailL);
            lerpRotation(vrm, "leftLowerArm", 0.3, 0.0, 0.0);
            lerpRotation(vrm, "rightUpperArm", 0.2, 0.0, -0.7 + teasedFlailR);
            lerpRotation(vrm, "rightLowerArm", 0.3, 0.0, 0.0);

            // Angry or surprised expression
            lerpExpression(vrm, "angry", 1.0);
            resetOtherExpressions(vrm, "angry");
            break;
        }

        // Always update morph values in THREE.VRM
        if (vrm.expressionManager) {
          vrm.expressionManager.update();
        }
      }

      renderer.render(scene, camera);
    };

    tick();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, { capture: true } as any);
      if (scrollTimeout) {
        cancelAnimationFrame(scrollTimeout);
      }
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
      }
      renderer.dispose();
    };
  }, [isClient]);

  if (!isClient || !settings.mascotVisible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 w-[350px] h-[350px] pointer-events-none z-[100] select-none"
    >
      <div className="relative w-full h-full">
        {/* Transparent loading circle */}
        {loadingProgress < 100 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full border-4 border-taupe/20 border-t-honey animate-spin" />
            <span className="absolute text-[10px] font-black text-honey">{loadingProgress}%</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`w-full h-full cursor-pointer drop-shadow-[0_8px_32px_rgba(212,160,23,0.15)] ${
            (uiState === "idle" || uiState === "greeting") ? "pointer-events-auto" : "pointer-events-none"
          }`}
        />

        {/* State Badge for Debug/Visual Delight (hidden by default, shows on hover if required) */}
        {loadingProgress === 100 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-honey/20 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            <span className="text-[8px] font-black uppercase tracking-wider text-honey">{uiState}</span>
          </div>
        )}
      </div>
    </div>
  );
}
