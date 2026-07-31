import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { DielineTemplate } from "../types";

/* ---------------------------------------------------------------------------
   ThreeBoxCanvas — renderiza a caixa em 3D com Three.js.
   - Constrói fundo + 4 paredes que dobram (0% plano → 100% montado)
   - Mapeia a estampa como textura sobre as faces
   - Iluminação de estúdio + rotação por arraste e zoom por scroll
--------------------------------------------------------------------------- */

interface ThreeBoxCanvasProps {
  template: DielineTemplate;
  foldPct: number;
  textureDataUrl?: string | null;
}

export default function ThreeBoxCanvas({ template, foldPct, textureDataUrl }: ThreeBoxCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const foldGroupsRef = useRef<THREE.Object3D[]>([]);
  const foldTargetRef = useRef(foldPct);
  const orbitRef = useRef({ rotX: -0.5, rotY: -0.6, dist: 0, dragging: false, lastX: 0, lastY: 0 });

  foldTargetRef.current = foldPct;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 480;
    const height = mount.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#efe9df");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    mount.appendChild(renderer.domElement);

    // Iluminação de estúdio.
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff2e0, 0.4);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const model = new THREE.Group();
    scene.add(model);

    // Textura da estampa (ou papel liso).
    let texture: THREE.Texture | null = null;
    if (textureDataUrl) {
      texture = new THREE.TextureLoader().load(textureDataUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    const paperMat = new THREE.MeshStandardMaterial({ color: "#fcfaf7", roughness: 0.9, side: THREE.DoubleSide });
    const artMat = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: "#d9c7ae", roughness: 0.85, side: THREE.DoubleSide });

    const box = template.box3D;
    const foldGroups: THREE.Object3D[] = [];

    if (box) {
      // Normaliza para caber na cena.
      const maxDim = Math.max(box.width, box.height, box.depth);
      const s = 3 / maxDim;
      const W = box.width * s;
      const H = box.height * s;
      const D = box.depth * s;

      // Fundo.
      const bottom = new THREE.Mesh(new THREE.PlaneGeometry(W, D), paperMat);
      bottom.rotation.x = -Math.PI / 2;
      model.add(bottom);

      // Paredes: [edgeLen, hinge position, baseY].
      const walls: { edge: number; pos: THREE.Vector3; baseY: number }[] = [
        { edge: W, pos: new THREE.Vector3(0, 0, -D / 2), baseY: Math.PI }, // norte
        { edge: W, pos: new THREE.Vector3(0, 0, D / 2), baseY: 0 }, // sul (frente)
        { edge: D, pos: new THREE.Vector3(W / 2, 0, 0), baseY: Math.PI / 2 }, // leste
        { edge: D, pos: new THREE.Vector3(-W / 2, 0, 0), baseY: -Math.PI / 2 }, // oeste
      ];

      walls.forEach((wall, i) => {
        const outer = new THREE.Object3D();
        outer.position.copy(wall.pos);
        outer.rotation.y = wall.baseY;

        const fold = new THREE.Object3D();
        outer.add(fold);

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wall.edge, H), i === 1 ? artMat : paperMat);
        mesh.position.y = H / 2;
        fold.add(mesh);

        model.add(outer);
        foldGroups.push(fold);
      });

      model.position.y = -H / 4;
      camera.position.set(0, 2.5, 6);
    } else {
      // Item plano (convite, tag, pillow): plano único texturizado.
      const aspect = template.widthMM / template.heightMM;
      const planeW = aspect >= 1 ? 4 : 4 * aspect;
      const planeH = aspect >= 1 ? 4 / aspect : 4;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), artMat);
      model.add(plane);
      camera.position.set(0, 0, 6);
    }

    foldGroupsRef.current = foldGroups;
    camera.lookAt(0, 0, 0);
    orbitRef.current.dist = camera.position.length();

    // Interação: arraste rotaciona, scroll aproxima.
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      orbitRef.current.dragging = true;
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      const o = orbitRef.current;
      if (!o.dragging) return;
      o.rotY += (e.clientX - o.lastX) * 0.01;
      o.rotX += (e.clientY - o.lastY) * 0.01;
      o.rotX = Math.max(-1.4, Math.min(1.4, o.rotX));
      o.lastX = e.clientX;
      o.lastY = e.clientY;
    };
    const onUp = () => {
      orbitRef.current.dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const o = orbitRef.current;
      o.dist = Math.max(3, Math.min(14, o.dist + e.deltaY * 0.005));
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = foldTargetRef.current / 100;
      for (const g of foldGroupsRef.current) {
        // Interpola suavemente até o alvo de dobra.
        const target = (Math.PI / 2) * (1 - t);
        g.rotation.x += (target - g.rotation.x) * 0.2;
      }
      const o = orbitRef.current;
      model.rotation.y = o.rotY;
      model.rotation.x = o.rotX;
      const dir = new THREE.Vector3(0, 2.5, 6).normalize();
      camera.position.copy(dir.multiplyScalar(o.dist));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      texture?.dispose();
      paperMat.dispose();
      artMat.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [template, textureDataUrl]);

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
}
