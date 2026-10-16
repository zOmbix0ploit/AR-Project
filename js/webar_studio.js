import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import { saveRigToDB, deleteRigFromDB, getCachedTransforms } from './webar_db.js';

// DOM References
const openStudioBtn = document.getElementById("openStudioBtn");
const closeStudioBtn = document.getElementById("closeStudioBtn");
const studioModal = document.getElementById("studioModal");
const studioCanvas = document.getElementById("studioCanvas");
const studioPartsList = document.getElementById("studioPartsList");
const selectedPartTitle = document.getElementById("selectedPartTitle");

// Gizmo mode buttons
const gizmoTranslateBtn = document.getElementById("gizmoTranslateBtn");
const gizmoRotateBtn = document.getElementById("gizmoRotateBtn");
const gizmoScaleBtn = document.getElementById("gizmoScaleBtn");
const gizmoSpaceBtn = document.getElementById("gizmoSpaceBtn");

// Inspector numeric inputs
const inpPosX = document.getElementById("inpPosX");
const inpPosY = document.getElementById("inpPosY");
const inpPosZ = document.getElementById("inpPosZ");
const inpRotX = document.getElementById("inpRotX");
const inpRotY = document.getElementById("inpRotY");
const inpRotZ = document.getElementById("inpRotZ");
const inpScaleX = document.getElementById("inpScaleX");
const inpScaleY = document.getElementById("inpScaleY");
const inpScaleZ = document.getElementById("inpScaleZ");

// Action buttons
const studioApplyBtn = document.getElementById("studioApplyBtn");
const studioExportBtn = document.getElementById("studioExportBtn");
const studioCopyConfigBtn = document.getElementById("studioCopyConfigBtn");
const studioResetAllBtn = document.getElementById("studioResetAllBtn");
const resetPartTransformBtn = document.getElementById("resetPartTransformBtn");

// Snap buttons
const snapMoboTrayBtn = document.getElementById("snapMoboTrayBtn");
const snapCpuSocketBtn = document.getElementById("snapCpuSocketBtn");
const snapRamSlotsBtn = document.getElementById("snapRamSlotsBtn");
const snapCoolerMountBtn = document.getElementById("snapCoolerMountBtn");
const snapPcieSlotBtn = document.getElementById("snapPcieSlotBtn");
const snapPsuShroudBtn = document.getElementById("snapPsuShroudBtn");

// Three.js State
let renderer, scene, camera, orbit, transformControl, gridHelper;
let isInitialized = false;
let selectedObject = null;
let partsRegistry = {};
let isStudioActive = false;

const loader = new GLTFLoader();
const exporter = new GLTFExporter();

// Standard 1:1 Initial Hardware Configs
const PARTS_CONFIG = [
  { id: 'case',   name: 'PC Chassis',    model: 'models/case.glb',        pos: [0, 0, 0],               rot: [0, 0, 0],            scale: [1, 1, 1] },
  { id: 'mobo',   name: 'Motherboard',   model: 'models/motherboard.glb', pos: [-0.014, 0.006, -0.070], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1] },
  { id: 'cpu',    name: 'Core i9 CPU',   model: 'models/cpu.glb',         pos: [-0.014, 0.066, -0.050], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1] },
  { id: 'ram1',   name: 'DDR5 RAM #1',   model: 'models/ram.glb',         pos: [0.048, 0.066, -0.045],  rot: [0, 0, 0],            scale: [1, 1, 1] },
  { id: 'ram2',   name: 'DDR5 RAM #2',   model: 'models/ram.glb',         pos: [0.060, 0.066, -0.045],  rot: [0, 0, 0],            scale: [1, 1, 1] },
  { id: 'cooler', name: 'CPU Cooler',    model: 'models/cooler.glb',      pos: [-0.014, 0.066, -0.005], rot: [0, 0, 0],            scale: [1, 1, 1] },
  { id: 'gpu',    name: 'RTX 4080 GPU',  model: 'models/gpu.glb',         pos: [-0.014, -0.045, -0.015],rot: [0, Math.PI / 2, 0],  scale: [1, 1, 1] },
  { id: 'psu',    name: '1000W ATX PSU', model: 'models/psu.glb',         pos: [-0.040, -0.160, -0.040],rot: [0, 0, 0],            scale: [1, 1, 1] }
];

function initStudio() {
  if (isInitialized) return;

  const rect = studioCanvas.parentElement.getBoundingClientRect();
  const width = rect.width || window.innerWidth;
  const height = rect.height || (window.innerHeight - 52);

  // 1. Scene & Background
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1d);

  // 2. Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.position.set(0.65, 0.45, 0.75);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ canvas: studioCanvas, antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;

  // 4. Studio Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
  keyLight.position.set(2, 4, 3);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
  rimLight.position.set(0, -2, -3);
  scene.add(rimLight);

  // 5. Grid Helper & Ground Plane
  gridHelper = new THREE.GridHelper(2, 40, 0x3b82f6, 0x1e293b);
  gridHelper.position.y = -0.235; // base of the chassis
  scene.add(gridHelper);

  // 6. OrbitControls
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.05;
  orbit.target.set(0, 0, 0);

  // 7. TransformControls (3D Gizmo)
  transformControl = new TransformControls(camera, renderer.domElement);
  transformControl.size = 0.85;
  transformControl.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value;
  });
  transformControl.addEventListener('change', () => {
    if (selectedObject) updateInspectorFromObject(selectedObject);
  });
  scene.add(transformControl);

  // 8. Load All 8 Components into Scene
  loadAllParts();

  // 9. Viewport Click Raycaster for Direct 3D Selection
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  studioCanvas.addEventListener('pointerdown', (e) => {
    // Only raycast if left click and transformControl not active
    if (e.button !== 0 || transformControl.dragging) return;

    const bounds = studioCanvas.getBoundingClientRect();
    pointer.x = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((e.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const meshes = [];
    Object.values(partsRegistry).forEach(part => {
      if (part.visible) {
        part.traverse(child => { if (child.isMesh) meshes.push(child); });
      }
    });

    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      // Find top-level registered part
      let topObj = intersects[0].object;
      while (topObj.parent && topObj.parent !== scene) {
        if (topObj.userData && topObj.userData.partId) break;
        topObj = topObj.parent;
      }
      if (topObj && topObj.userData && topObj.userData.partId) {
        selectPart(topObj.userData.partId);
      }
    }
  });

  // 10. Animation Loop
  function animate() {
    if (!isStudioActive) return;
    requestAnimationFrame(animate);
    orbit.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  window.addEventListener('resize', handleResize);
  isInitialized = true;
}

function handleResize() {
  if (!studioModal || !studioModal.classList.contains('open') || !camera || !renderer) return;
  const rect = studioCanvas.parentElement.getBoundingClientRect();
  const width = rect.width || window.innerWidth;
  const height = rect.height || (window.innerHeight - 52);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function loadAllParts() {
  studioPartsList.innerHTML = '';
  const savedTransforms = getCachedTransforms();

  PARTS_CONFIG.forEach((cfg) => {
    // Create UI item
    const itemEl = document.createElement('div');
    itemEl.className = 'part-list-item';
    itemEl.dataset.partId = cfg.id;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = cfg.name;
    nameSpan.style.cursor = 'pointer';

    const visBtn = document.createElement('button');
    visBtn.className = 'part-vis-btn visible';
    visBtn.title = 'Toggle Visibility';
    visBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;

    itemEl.appendChild(nameSpan);
    itemEl.appendChild(visBtn);
    studioPartsList.appendChild(itemEl);

    // Click to select
    nameSpan.addEventListener('click', () => selectPart(cfg.id));

    // Visibility toggle
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const obj = partsRegistry[cfg.id];
      if (obj) {
        obj.visible = !obj.visible;
        visBtn.classList.toggle('visible', obj.visible);
        if (!obj.visible && selectedObject === obj) {
          deselectPart();
        }
      }
    });

    // Load 3D Asset
    loader.load(cfg.model, (gltf) => {
      const partRoot = gltf.scene;
      partRoot.name = `Studio_${cfg.id}`;
      partRoot.userData = { partId: cfg.id, config: cfg };

      // Apply saved position, rotation, scale if user previously customized it
      const saved = savedTransforms && savedTransforms[cfg.id];
      if (saved) {
        partRoot.position.set(...saved.pos);
        partRoot.rotation.set(...saved.rot);
        partRoot.scale.set(...saved.scale);
        if (typeof saved.visible === 'boolean') {
          partRoot.visible = saved.visible;
          visBtn.classList.toggle('visible', saved.visible);
        }
      } else {
        partRoot.position.set(...cfg.pos);
        partRoot.rotation.set(...cfg.rot);
        partRoot.scale.set(...cfg.scale);
      }

      scene.add(partRoot);
      partsRegistry[cfg.id] = partRoot;

      // Default select motherboard or chassis
      if (cfg.id === 'mobo' && !selectedObject) {
        selectPart('mobo');
      }
    });
  });
}

function selectPart(partId) {
  const obj = partsRegistry[partId];
  if (!obj) return;

  selectedObject = obj;
  transformControl.attach(obj);

  // Update UI list highlight
  document.querySelectorAll('.part-list-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.partId === partId);
  });

  const cfg = PARTS_CONFIG.find(c => c.id === partId);
  selectedPartTitle.textContent = cfg ? cfg.name : partId.toUpperCase();

  updateInspectorFromObject(obj);
}

function deselectPart() {
  selectedObject = null;
  transformControl.detach();
  document.querySelectorAll('.part-list-item').forEach(el => el.classList.remove('selected'));
  selectedPartTitle.textContent = 'Select a Component';
}

function updateInspectorFromObject(obj) {
  if (!obj) return;
  inpPosX.value = obj.position.x.toFixed(3);
  inpPosY.value = obj.position.y.toFixed(3);
  inpPosZ.value = obj.position.z.toFixed(3);

  inpRotX.value = Math.round(THREE.MathUtils.radToDeg(obj.rotation.x));
  inpRotY.value = Math.round(THREE.MathUtils.radToDeg(obj.rotation.y));
  inpRotZ.value = Math.round(THREE.MathUtils.radToDeg(obj.rotation.z));

  inpScaleX.value = obj.scale.x.toFixed(2);
  inpScaleY.value = obj.scale.y.toFixed(2);
  inpScaleZ.value = obj.scale.z.toFixed(2);
}

function updateObjectFromInspector() {
  if (!selectedObject) return;
  selectedObject.position.set(
    parseFloat(inpPosX.value) || 0,
    parseFloat(inpPosY.value) || 0,
    parseFloat(inpPosZ.value) || 0
  );
  selectedObject.rotation.set(
    THREE.MathUtils.degToRad(parseFloat(inpRotX.value) || 0),
    THREE.MathUtils.degToRad(parseFloat(inpRotY.value) || 0),
    THREE.MathUtils.degToRad(parseFloat(inpRotZ.value) || 0)
  );
  selectedObject.scale.set(
    parseFloat(inpScaleX.value) || 1,
    parseFloat(inpScaleY.value) || 1,
    parseFloat(inpScaleZ.value) || 1
  );
}

// Bind numeric input listeners
[inpPosX, inpPosY, inpPosZ, inpRotX, inpRotY, inpRotZ, inpScaleX, inpScaleY, inpScaleZ].forEach(inp => {
  inp.addEventListener('input', updateObjectFromInspector);
});

// Gizmo mode switchers
gizmoTranslateBtn.addEventListener('click', () => {
  transformControl.setMode('translate');
  setActiveGizmoBtn(gizmoTranslateBtn);
});
gizmoRotateBtn.addEventListener('click', () => {
  transformControl.setMode('rotate');
  setActiveGizmoBtn(gizmoRotateBtn);
});
gizmoScaleBtn.addEventListener('click', () => {
  transformControl.setMode('scale');
  setActiveGizmoBtn(gizmoScaleBtn);
});
gizmoSpaceBtn.addEventListener('click', () => {
  const nextSpace = transformControl.space === 'local' ? 'world' : 'local';
  transformControl.setSpace(nextSpace);
  gizmoSpaceBtn.textContent = `Space: ${nextSpace.charAt(0).toUpperCase() + nextSpace.slice(1)}`;
});

function setActiveGizmoBtn(btn) {
  [gizmoTranslateBtn, gizmoRotateBtn, gizmoScaleBtn].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Smart Alignment / Snap Mount Handlers
function snapSelected(pos, rotDeg) {
  if (!selectedObject) return;
  selectedObject.position.set(...pos);
  if (rotDeg) {
    selectedObject.rotation.set(
      THREE.MathUtils.degToRad(rotDeg[0]),
      THREE.MathUtils.degToRad(rotDeg[1]),
      THREE.MathUtils.degToRad(rotDeg[2])
    );
  }
  updateInspectorFromObject(selectedObject);
}

snapMoboTrayBtn.addEventListener('click', () => snapSelected([-0.014, 0.006, -0.070], [90, 0, 0]));
snapCpuSocketBtn.addEventListener('click', () => snapSelected([-0.014, 0.066, -0.050], [90, 0, 0]));
snapRamSlotsBtn.addEventListener('click', () => snapSelected([0.048, 0.066, -0.045], [0, 0, 0]));
snapCoolerMountBtn.addEventListener('click', () => snapSelected([-0.014, 0.066, -0.005], [0, 0, 0]));
snapPcieSlotBtn.addEventListener('click', () => snapSelected([-0.014, -0.045, -0.015], [0, 90, 0]));
snapPsuShroudBtn.addEventListener('click', () => snapSelected([-0.040, -0.160, -0.040], [0, 0, 0]));

resetPartTransformBtn.addEventListener('click', () => {
  if (!selectedObject || !selectedObject.userData || !selectedObject.userData.config) return;
  const cfg = selectedObject.userData.config;
  selectedObject.position.set(...cfg.pos);
  selectedObject.rotation.set(...cfg.rot);
  selectedObject.scale.set(...cfg.scale);
  updateInspectorFromObject(selectedObject);
});

// Keyboard Hotkeys
window.addEventListener('keydown', (e) => {
  if (!isStudioActive) return;
  if (e.target.tagName === 'INPUT') return;

  if (e.key === 'w' || e.key === 'W') {
    transformControl.setMode('translate');
    setActiveGizmoBtn(gizmoTranslateBtn);
  } else if (e.key === 'e' || e.key === 'E') {
    transformControl.setMode('rotate');
    setActiveGizmoBtn(gizmoRotateBtn);
  } else if (e.key === 'r' || e.key === 'R') {
    transformControl.setMode('scale');
    setActiveGizmoBtn(gizmoScaleBtn);
  } else if (e.key === 'q' || e.key === 'Q') {
    gizmoSpaceBtn.click();
  } else if (e.key === 'Escape') {
    deselectPart();
  }
});

// Export Clean Combined Scene
function getExportableScene() {
  const exportGroup = new THREE.Group();
  exportGroup.name = 'Custom_Nethuna_WebAR_Rig';

  Object.values(partsRegistry).forEach(part => {
    if (part.visible) {
      exportGroup.add(part.clone(true));
    }
  });
  return exportGroup;
}

// APPLY & PERMANENTLY SAVE TO WEBAR (IndexedDB + LocalStorage)
studioApplyBtn.addEventListener('click', async () => {
  const origText = studioApplyBtn.innerHTML;
  studioApplyBtn.innerHTML = 'SAVING PERMANENT RIG...';
  studioApplyBtn.disabled = true;

  try {
    const exportScene = getExportableScene();
    exporter.parse(
      exportScene,
      async (gltfBinary) => {
        const blob = new Blob([gltfBinary], { type: 'model/gltf-binary' });
        const blobUrl = URL.createObjectURL(blob);

        // Collect all transforms across parts
        const currentTransforms = {};
        Object.entries(partsRegistry).forEach(([id, obj]) => {
          currentTransforms[id] = {
            pos: [obj.position.x, obj.position.y, obj.position.z],
            rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z],
            visible: obj.visible
          };
        });

        // Save into IndexedDB & localStorage
        await saveRigToDB(blob, currentTransforms);

        // Broadcast to main page & viewer
        window.__customRigBlobUrl = blobUrl;
        window.dispatchEvent(new CustomEvent('custom-rig-updated', { detail: { blobUrl, transforms: currentTransforms } }));

        closeStudio();
        studioApplyBtn.innerHTML = origText;
        studioApplyBtn.disabled = false;

        const toastBanner = document.getElementById("toastBanner");
        const toastMsg = document.getElementById("toastMsg");
        if (toastBanner && toastMsg) {
          toastMsg.textContent = "CUSTOM RIG SAVED PERMANENTLY IN BROWSER!";
          toastBanner.classList.add("show");
          setTimeout(() => toastBanner.classList.remove("show"), 4000);
        }
      },
      (err) => {
        console.error("Studio GLTF export error:", err);
        studioApplyBtn.innerHTML = origText;
        studioApplyBtn.disabled = false;
        alert("Failed to export 3D Rig: " + err.message);
      },
      { binary: true }
    );
  } catch (err) {
    studioApplyBtn.innerHTML = origText;
    studioApplyBtn.disabled = false;
    alert("Export error: " + err.message);
  }
});

// DOWNLOAD ASSEMBLED_PC GLB BUTTON
studioExportBtn.addEventListener('click', () => {
  const origText = studioExportBtn.innerHTML;
  studioExportBtn.innerHTML = 'EXPORTING...';
  studioExportBtn.disabled = true;

  try {
    const exportScene = getExportableScene();
    exporter.parse(
      exportScene,
      (gltfBinary) => {
        const blob = new Blob([gltfBinary], { type: 'model/gltf-binary' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'assembled_pc.glb';
        link.click();
        URL.revokeObjectURL(link.href);

        studioExportBtn.innerHTML = origText;
        studioExportBtn.disabled = false;
      },
      (err) => {
        console.error("Studio export error:", err);
        studioExportBtn.innerHTML = origText;
        studioExportBtn.disabled = false;
      },
      { binary: true }
    );
  } catch (e) {
    studioExportBtn.innerHTML = origText;
    studioExportBtn.disabled = false;
  }
});

// COPY CONFIG JSON BUTTON
if (studioCopyConfigBtn) {
  studioCopyConfigBtn.addEventListener('click', () => {
    const exportData = PARTS_CONFIG.map(cfg => {
      const obj = partsRegistry[cfg.id];
      if (obj) {
        return {
          id: cfg.id,
          name: cfg.name,
          pos: [+obj.position.x.toFixed(4), +obj.position.y.toFixed(4), +obj.position.z.toFixed(4)],
          rotDeg: [
            +THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1),
            +THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1),
            +THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)
          ],
          scale: [+obj.scale.x.toFixed(3), +obj.scale.y.toFixed(3), +obj.scale.z.toFixed(3)],
          visible: obj.visible
        };
      }
      return cfg;
    });

    const jsonStr = JSON.stringify(exportData, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        const toastBanner = document.getElementById("toastBanner");
        const toastMsg = document.getElementById("toastMsg");
        if (toastBanner && toastMsg) {
          toastMsg.textContent = "CALIBRATION CONFIG COPIED TO CLIPBOARD!";
          toastBanner.classList.add("show");
          setTimeout(() => toastBanner.classList.remove("show"), 3000);
        }
      }).catch(() => {
        prompt("Copy Calibration JSON:", jsonStr);
      });
    } else {
      prompt("Copy Calibration JSON:", jsonStr);
    }
  });
}

// RESET ALL PARTS TO FACTORY POSITIONS
if (studioResetAllBtn) {
  studioResetAllBtn.addEventListener('click', async () => {
    if (!confirm("Reset all 3D hardware components back to original factory positions?")) return;

    PARTS_CONFIG.forEach(cfg => {
      const obj = partsRegistry[cfg.id];
      if (obj) {
        obj.position.set(...cfg.pos);
        obj.rotation.set(...cfg.rot);
        obj.scale.set(...cfg.scale);
        obj.visible = true;
      }
    });

    await deleteRigFromDB();
    window.__customRigBlobUrl = null;
    window.dispatchEvent(new CustomEvent('custom-rig-cleared'));
    if (selectedObject) updateInspectorFromObject(selectedObject);

    const toastBanner = document.getElementById("toastBanner");
    const toastMsg = document.getElementById("toastMsg");
    if (toastBanner && toastMsg) {
      toastMsg.textContent = "STUDIO RESET TO FACTORY POSITIONS";
      toastBanner.classList.add("show");
      setTimeout(() => toastBanner.classList.remove("show"), 3000);
    }
  });
}

function openStudio() {
  studioModal.classList.add('open');
  isStudioActive = true;
  initStudio();
  setTimeout(handleResize, 100);

  // If already initialized, synchronize parts with latest saved positions
  const saved = getCachedTransforms();
  if (saved && isInitialized) {
    Object.entries(saved).forEach(([id, t]) => {
      const obj = partsRegistry[id];
      if (obj) {
        obj.position.set(...t.pos);
        obj.rotation.set(...t.rot);
        obj.scale.set(...t.scale);
        if (typeof t.visible === 'boolean') obj.visible = t.visible;
      }
    });
    if (selectedObject) updateInspectorFromObject(selectedObject);
  }

  const arViewer = document.getElementById("arViewer");
  if (arViewer) arViewer.autoRotate = false;
}

function closeStudio() {
  studioModal.classList.remove('open');
  isStudioActive = false;
}

openStudioBtn.addEventListener('click', openStudio);
closeStudioBtn.addEventListener('click', closeStudio);
