"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import { animate, utils } from "animejs";
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
  const currentTargetRef = useRef<"sidebar" | "input" | "header">("sidebar");
  const focusOutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActionRef = useRef<"focus" | "scroll">("scroll");
  const themeBlinkTimerRef = useRef(0);
  const tabLookTimerRef = useRef(0);

  // Inertia and winking timer refs
  const successStartTimeRef = useRef(0);
  const errorStartTimeRef = useRef(0);
  const hasSubmittedRef = useRef(false);
  const loadingStartTimeRef = useRef(0);
  const deferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [repeatCount, setRepeatCount] = useState(0);

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
      if (appState === "loading") {
        hasSubmittedRef.current = true;
        targetState = "loading";
      }
      else if (appState === "success") targetState = "success";
      else if (appState === "error") targetState = "error";
      else if (appState === "typing") targetState = "typing";
      else targetState = "idle";
    } else {
      // 2. Otherwise map from Zustand store
      if (storeProcessing) {
        hasSubmittedRef.current = true;
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

    // Enforce a minimum duration of 2.5 seconds for the loading state to allow the animation to play
    if (targetState === "success" || targetState === "error") {
      const elapsed = Date.now() - loadingStartTimeRef.current;
      const minLoadingTime = 2500; // 2.5 seconds minimum
      if (elapsed < minLoadingTime) {
        if (deferTimerRef.current) clearTimeout(deferTimerRef.current);
        deferTimerRef.current = setTimeout(() => {
          transitionTo(targetState);
          deferTimerRef.current = null;
        }, minLoadingTime - elapsed);
        return;
      }
    }

    // Cancel any deferred transition if we enter loading again or reset
    if (targetState === "loading") {
      if (deferTimerRef.current) {
        clearTimeout(deferTimerRef.current);
        deferTimerRef.current = null;
      }
      loadingStartTimeRef.current = Date.now();
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

    const handleRepeatSubmit = (e: Event) => {
      const count = (e as CustomEvent).detail?.count || 0;
      setRepeatCount(count);
    };

    const handleThemeToggle = () => {
      themeBlinkTimerRef.current = timeRef.current;
    };

    const handleAirgapToggle = () => {
      triggerTease();
    };

    const handleClearForm = () => {
      hasSubmittedRef.current = false;
      transitionTo("greeting");
    };

    const handleTabChange = () => {
      tabLookTimerRef.current = timeRef.current;
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    window.addEventListener("sugoi-quick-issue", handleQuickIssue);
    window.addEventListener("click", handleClick);
    window.addEventListener("sugoi-repeat-submit", handleRepeatSubmit);
    window.addEventListener("sugoi-theme-toggle", handleThemeToggle);
    window.addEventListener("sugoi-airgap-toggle", handleAirgapToggle);
    window.addEventListener("sugoi-clear-form", handleClearForm);
    window.addEventListener("sugoi-tab-change", handleTabChange);
    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("sugoi-quick-issue", handleQuickIssue);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("sugoi-repeat-submit", handleRepeatSubmit);
      window.removeEventListener("sugoi-theme-toggle", handleThemeToggle);
      window.removeEventListener("sugoi-airgap-toggle", handleAirgapToggle);
      window.removeEventListener("sugoi-clear-form", handleClearForm);
      window.removeEventListener("sugoi-tab-change", handleTabChange);
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
        }, 3500);
      };
      onCompleteSuccess();
    } else if (newState === "error") {
      errorStartTimeRef.current = clockRef.current.getElapsedTime();
      const onCompleteError = () => {
        setTimeout(() => {
          if (stateRef.current === "error") {
            if (!appState) {
              setMood("idle");
            } else {
              transitionTo("idle");
            }
          }
        }, 3500);
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

  const getTarget = (): "sidebar" | "input" | "header" => {
    if (typeof window === "undefined") return "sidebar";

    const activeState = stateRef.current;

    const inputCard = document.getElementById("describe-issue-card");
    let isAtTop = true;
    if (inputCard) {
      const rect = inputCard.getBoundingClientRect();
      isAtTop = rect.top >= window.innerHeight - 50;
    } else {
      const scrollContainer = document.getElementById("main-scroll-container") || document.querySelector(".overflow-y-auto");
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      isAtTop = scrollTop < 100;
    }

    // When the result has come (success or error), position the mascot in the sidebar
    // so it doesn't overlap the tabs, resolution/comment section, or quick issues.
    if (activeState === "success" || activeState === "error") {
      return "sidebar";
    }

    // Position below the input card during loading state
    // but only if the user is at the top of the page. If they scroll down,
    // the mascot transitions to the sidebar.
    if (activeState === "loading") {
      return isAtTop ? "input" : "sidebar";
    }

    return isAtTop ? "header" : "sidebar";
  };

  // Mascot is stationary in sidebar
  const updatePosition = (instant = false) => {
    // No translation needed as it is rendered locally in the sidebar
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

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth || 480;
      const h = containerRef.current.clientHeight || 410;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize, { passive: true });
    setTimeout(handleResize, 100);

    // 1. Setup Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Setup Camera
    const initialWidth = container.clientWidth || 480;
    const initialHeight = container.clientHeight || 410;
    const camera = new THREE.PerspectiveCamera(55, initialWidth / initialHeight, 0.1, 20); // Focus on upper body, hiding legs
    camera.position.set(0.0, 1.30, 0.70); // Camera shifted up and closer to hide legs and prevent overlap
    camera.lookAt(0.0, 1.30, 0.0);
    camera.userData = { lookAtY: 1.30 };
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
    renderer.setSize(initialWidth, initialHeight);
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
            vrm.scene.position.x = Math.sin(time * 60.0) * 0.04;
            vrm.scene.position.y = -0.08 + Math.cos(time * 60.0) * 0.04;
            vrm.scene.position.z = Math.sin(time * 70.0) * 0.02;
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
          const currentX = parseFloat(utils.get(containerRef.current, "translateX") as string) || 0;
          const currentY = parseFloat(utils.get(containerRef.current, "translateY") as string) || 0;

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

        // Setup default skeletal targets for unified animation updates
        let targetSpineX = 0, targetSpineY = 0, targetSpineZ = 0;
        let targetNeckX = 0, targetNeckY = 0, targetNeckZ = 0;
        let targetHeadX = 0, targetHeadY = 0, targetHeadZ = 0;
        let targetLeftEyeX = 0, targetLeftEyeY = 0, targetLeftEyeZ = 0;
        let targetRightEyeX = 0, targetRightEyeY = 0, targetRightEyeZ = 0;
        let headLerp = 0.08;
        let eyeLerp = 0.1;

        // Global Natural Blinking / Theme Rapid Double-Blink Reaction
        if (time - themeBlinkTimerRef.current < 0.6) {
          const elapsed = time - themeBlinkTimerRef.current;
          let themeBlinkValue = 0.0;
          if (elapsed < 0.25) {
            themeBlinkValue = Math.sin((elapsed / 0.25) * Math.PI);
          } else if (elapsed >= 0.3 && elapsed < 0.55) {
            themeBlinkValue = Math.sin(((elapsed - 0.3) / 0.25) * Math.PI);
          }
          lerpExpression(vrm, "blink", themeBlinkValue, 0.4);
        } else {
          const blinkCycle = time % 4.0;
          let blinkValue = 0.0;
          if (blinkCycle > 3.7) {
            blinkValue = Math.sin((blinkCycle - 3.7) * Math.PI * 3.3);
          }
          if (activeState !== "success") {
            lerpExpression(vrm, "blink", blinkValue, 0.25);
          }
        }

        // State-specific bone & expression animations
        switch (activeState) {
          case "greeting":
            targetSpineX = 0.15;
            targetNeckX = 0.25;
            targetHeadX = 0.05;

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
            if (repeatCount > 0) {
              // Disappointed side-eye look left (towards the input field area)
              targetHeadX = 0.15; targetHeadY = -0.65;
              targetNeckX = 0.05; targetNeckY = -0.3;
              targetLeftEyeX = 0.1; targetLeftEyeY = -0.45;
              targetRightEyeX = 0.1; targetRightEyeY = -0.45;

              // Disappointed side-eye face
              lerpExpression(vrm, "angry", 0.35);
              resetOtherExpressions(vrm, "angry");

              // Arms relaxed
              lerpRotation(vrm, "leftUpperArm", 0.1, 0.0, 1.35);
              lerpRotation(vrm, "leftLowerArm", 0.0, 0.0, 0.0);
              lerpRotation(vrm, "rightUpperArm", 0.1, 0.0, -1.35);
              lerpRotation(vrm, "rightLowerArm", 0.0, 0.0, 0.0);
            } else {
              // Standard breathing / posture
              targetSpineX = Math.sin(time * 1.8) * 0.02;

              // Idle break fidget animation system (every 20 seconds)
              const idleBreakTime = time % 20.0;
              const currentStoreMood = useSugoiStore.getState().persona.mood;

              if (idleBreakTime < 3.0) {
                // Gesture 1: Wave left hand and smile
                lerpRotation(vrm, "leftUpperArm", 0.3, 0.0, 0.6);
                lerpRotation(vrm, "leftLowerArm", 0.8, -Math.sin(time * 8.0) * 0.4, 0.0, 0.15);
                lerpRotation(vrm, "rightUpperArm", 0.1, 0.0, -1.35); // hanging down naturally
                lerpRotation(vrm, "rightLowerArm", 0.0, 0.0, 0.0);

                lerpExpression(vrm, "joy", 0.85);
                resetOtherExpressions(vrm, "joy");
              } else if (idleBreakTime > 10.0 && idleBreakTime < 13.0) {
                // Gesture 2: Puzzled head tilt and think
                targetHeadZ = Math.sin(time * 2.5) * 0.12;
                targetNeckZ = Math.sin(time * 2.5) * 0.06;

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
            }
            break;

          case "typing":
            // Lean forward
            targetSpineX = 0.05;
            targetNeckX = 0.1; targetNeckY = -0.25;
            targetHeadX = 0.15; targetHeadY = -0.35;
            targetLeftEyeX = 0.1; targetLeftEyeY = -0.3;
            targetRightEyeX = 0.1; targetRightEyeY = -0.3;

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
            // Head and neck looking forward/tilted slightly to presentation
            targetSpineX = 0.05;
            targetNeckX = 0.05; targetNeckY = -0.1;
            targetHeadX = 0.1; targetHeadY = -0.25;
            targetLeftEyeX = 0.05; targetLeftEyeY = -0.25;
            targetRightEyeX = 0.05; targetRightEyeY = -0.25;

            // Right arm presenting (forward, palm open facing up/out)
            lerpRotation(vrm, "rightUpperArm", -0.6, -0.2, -0.8);
            lerpRotation(vrm, "rightLowerArm", 0.4, 0.5, -0.8);

            // Left arm relaxed next to body
            lerpRotation(vrm, "leftUpperArm", 0.1, 0.0, 1.35);
            lerpRotation(vrm, "leftLowerArm", 0.0, 0.0, 0.0);

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
              lerpExpression(vrm, "joy", 0.8);
              resetOtherExpressions(vrm, "joy");
            }
            break;

          case "success":
            // Lean back in joy
            targetSpineX = -0.1;
            targetNeckX = -0.1;
            targetHeadX = -0.15;

            // Wave arms in victory
            const successWaveL = Math.sin(time * 12.0) * 0.2;
            const successWaveR = -Math.sin(time * 12.0) * 0.2;
            lerpRotation(vrm, "leftUpperArm", 0.2, 0.0, 1.6 + successWaveL);
            lerpRotation(vrm, "leftLowerArm", 0.3, 0.0, 0.0);
            lerpRotation(vrm, "rightUpperArm", 0.2, 0.0, -1.6 + successWaveR);
            lerpRotation(vrm, "rightLowerArm", 0.3, 0.0, 0.0);

            // Joy facial expression + wink right eye for the first 2.5 seconds, then return to normal
            const successTime = time - successStartTimeRef.current;
            const targetWink = successTime < 2.5 ? 1.0 : 0.0;

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
            // "Cracked" pose: high frequency rocking neck/head/limbs
            targetSpineX = 0.2 + Math.sin(time * 40.0) * 0.12;
            targetNeckX = 0.15 + Math.cos(time * 50.0) * 0.1;
            targetHeadX = 0.2 + Math.sin(time * 50.0) * 0.15;
            targetHeadY = Math.cos(time * 40.0) * 0.1;

            // Cracked flailing arm postures
            lerpRotation(vrm, "leftUpperArm", 0.5 + Math.sin(time * 45.0) * 0.2, 0.0, 0.8);
            lerpRotation(vrm, "leftLowerArm", 1.0, 0.0, 0.0);
            lerpRotation(vrm, "rightUpperArm", 0.5 + Math.cos(time * 45.0) * 0.2, 0.0, -0.8);
            lerpRotation(vrm, "rightLowerArm", 1.0, 0.0, 0.0);

            // Sorrow expression + wink right eye for the first 2.5 seconds (then return to regular sorrow)
            const errorTime = time - errorStartTimeRef.current;
            const targetErrorWink = errorTime < 2.5 ? 1.0 : 0.0;

            lerpExpression(vrm, "sorrow", 1.0);
            lerpExpression(vrm, "blinkRight", targetErrorWink, 0.15);

            // Clear other expressions except sorrow and blinkRight
            const currentExpMgrError = vrm.expressionManager;
            if (currentExpMgrError) {
              const allExps = ["joy", "angry", "surprised", "relaxed", "blink", "blinkLeft"];
              allExps.forEach((exp) => {
                const val = currentExpMgrError.getValue(exp) || 0;
                currentExpMgrError.setValue(exp, THREE.MathUtils.lerp(val, 0, 0.15));
              });
            }
            break;

          case "teased":
            // Snap head back dramatically in surprise
            targetSpineX = -0.05;
            targetNeckX = -0.25;
            targetHeadX = -0.45;

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

        // Apply mouse cursor tracking globally to valid states
        const isTrackingCursor = ["idle", "typing", "loading", "success", "greeting"].includes(activeState);
        if (isTrackingCursor) {
          const mouseHeadX = -mousePosRef.current.y * 0.25;
          const mouseHeadY = mousePosRef.current.x * 0.45;
          const mouseEyeX = -mousePosRef.current.y * 0.2;
          const mouseEyeY = mousePosRef.current.x * 0.35;

          targetHeadX += mouseHeadX;
          targetHeadY += mouseHeadY;
          targetNeckX += mouseHeadX * 0.4;
          targetNeckY += mouseHeadY * 0.4;
          targetLeftEyeX += mouseEyeX;
          targetLeftEyeY += mouseEyeY;
          targetRightEyeX += mouseEyeX;
          targetRightEyeY += mouseEyeY;

          // Apply tab change look offset if active (downwards and context-aware left/right)
          if (time - tabLookTimerRef.current < 1.5) {
            const elapsed = time - tabLookTimerRef.current;
            const intensity = Math.sin((elapsed / 1.5) * Math.PI);

            const tabOffsetHeadX = 0.25; // Look down
            let tabOffsetHeadY = 0.0;    // Look sideways depending on layout target position

            if (currentTargetRef.current === "sidebar") {
              tabOffsetHeadY = 0.3; // Look right
            } else if (currentTargetRef.current === "header") {
              tabOffsetHeadY = -0.25; // Look left
            }

            targetHeadX += tabOffsetHeadX * intensity;
            targetHeadY += tabOffsetHeadY * intensity;
            targetNeckX += tabOffsetHeadX * 0.4 * intensity;
            targetNeckY += tabOffsetHeadY * 0.4 * intensity;

            targetLeftEyeX += tabOffsetHeadX * 0.8 * intensity;
            targetLeftEyeY += tabOffsetHeadY * 0.8 * intensity;
            targetRightEyeX += tabOffsetHeadX * 0.8 * intensity;
            targetRightEyeY += tabOffsetHeadY * 0.8 * intensity;
          }
        }

        // Apply the calculated skeletal target rotations
        lerpRotation(vrm, "spine", targetSpineX, targetSpineY, targetSpineZ, 0.04);
        lerpRotation(vrm, "neck", targetNeckX, targetNeckY, targetNeckZ, headLerp);
        lerpRotation(vrm, "head", targetHeadX, targetHeadY, targetHeadZ, headLerp);
        lerpRotation(vrm, "leftEye", targetLeftEyeX, targetLeftEyeY, targetLeftEyeZ, eyeLerp);
        lerpRotation(vrm, "rightEye", targetRightEyeX, targetRightEyeY, targetRightEyeZ, eyeLerp);

        // Always update morph values in THREE.VRM
        if (vrm.expressionManager) {
          vrm.expressionManager.update();
        }
      }

      let targetCamY = 1.30;
      let targetCamZ = 0.70; // Focus on upper body, hiding legs and scaling up mascot size
      let targetLookY = 1.30;

      if (cameraRef.current) {
        cameraRef.current.position.y = THREE.MathUtils.lerp(cameraRef.current.position.y, targetCamY, 0.05);
        cameraRef.current.position.z = THREE.MathUtils.lerp(cameraRef.current.position.z, targetCamZ, 0.05);
        const currentLookAtY = THREE.MathUtils.lerp(cameraRef.current.userData?.lookAtY ?? 1.26, targetLookY, 0.05);
        if (!cameraRef.current.userData) {
          cameraRef.current.userData = {};
        }
        cameraRef.current.userData.lookAtY = currentLookAtY;
        cameraRef.current.lookAt(0.0, currentLookAtY, 0.0);
      }

      renderer.render(scene, camera);
    };

    tick();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
      }
      renderer.dispose();
      if (deferTimerRef.current) {
        clearTimeout(deferTimerRef.current);
      }
    };
  }, [isClient]);

  if (!isClient || !settings.mascotVisible) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none flex items-center justify-center"
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
          className={`w-full h-full cursor-pointer drop-shadow-[0_8px_32px_rgba(212,160,23,0.15)] ${(uiState === "idle" || uiState === "greeting") ? "pointer-events-auto" : "pointer-events-none"
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
