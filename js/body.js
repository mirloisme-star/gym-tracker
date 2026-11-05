// The rotating 3D figure, a single baked mesh whose vertices know which muscle they belong to.
// One renderer is kept and its canvas moves between page renders.
let THREE;
let renderer;
let scene;
let camera;
let figure;
let raycaster;
let mesh;
let shading; // region, muscle weight and openness for each vertex
let onPick = () => {};
let selected = null;

let angle = 0.5;
let targetAngle = null;
let spinLeft = Math.PI * 2; // one slow turn on first view, then it holds still
let running = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Same order as tools/build-body.mjs. Index 0 is the part of the body that isn't a muscle.
const REGION_ORDER = [null, 'chest', 'frontDelt', 'sideDelt', 'rearDelt', 'biceps', 'triceps', 'forearm', 'abs', 'obliques', 'traps', 'lats', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves'];

async function buildFigure() {
  const data = await (await fetch(new URL('../assets/body.bin', import.meta.url))).arrayBuffer();
  const [vCount, iCount] = new Uint32Array(data, 0, 2);
  const raw = new Int16Array(data, 8, vCount * 3);
  const positions = new Float32Array(vCount * 3);
  for (let i = 0; i < raw.length; i++) positions[i] = raw[i] / 8192;
  shading = new Uint8Array(data, 8 + vCount * 6, vCount * 3);
  const indexStart = 8 + vCount * 9 + ((vCount * 9) % 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(data, indexStart, iCount), 1));
  geometry.computeVertexNormals();
  mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.05 }));

  figure = new THREE.Group();
  figure.add(mesh);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 32),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  figure.add(shadow);
  scene.add(figure);
}

async function setup() {
  THREE = await import('../vendor/three.module.min.js');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.78, 7.9);
  camera.lookAt(0, 1.68, 0);
  raycaster = new THREE.Raycaster();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.15));
  const light = (intensity, x, y, z) => {
    const d = new THREE.DirectionalLight(0xffffff, intensity);
    d.position.set(x, y, z);
    scene.add(d);
  };
  light(2.1, 2, 4, 5);
  light(0.7, -3, 2, 3);
  light(1.3, 0, 3, -5);
  await buildFigure();
  bindPointer(renderer.domElement);
}

function draw() {
  figure.rotation.y = angle;
  renderer.render(scene, camera);
}

function loop() {
  const canvas = renderer.domElement;
  let moving = false;
  if (canvas.isConnected) {
    if (targetAngle != null) {
      const delta = targetAngle - angle;
      if (Math.abs(delta) < 0.01) {
        angle = targetAngle;
        targetAngle = null;
      } else {
        angle += delta * 0.14;
        moving = true;
      }
    } else if (spinLeft > 0 && !reducedMotion) {
      angle += 0.009;
      spinLeft -= 0.009;
      moving = true;
    }
    draw();
  }
  // Nothing runs while the figure is still, so an open stats page doesn't drain the battery.
  running = moving && canvas.isConnected;
  if (running) requestAnimationFrame(loop);
}

function kick() {
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

function bindPointer(canvas) {
  let start = null;
  canvas.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, angle, moved: false };
    spinLeft = 0;
    targetAngle = null;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 5) start.moved = true;
    angle = start.angle + dx * 0.012;
    draw();
  });
  const finish = (e) => {
    if (start && !start.moved && Math.abs(e.clientY - start.y) < 8) {
      const box = canvas.getBoundingClientRect();
      const point = new THREE.Vector2(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
      raycaster.setFromCamera(point, camera);
      const hit = raycaster.intersectObject(mesh)[0];
      onPick(hit ? pickedRegion(hit.face) : null);
    }
    start = null;
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', () => (start = null));
}

// Tendons and joints have little muscle weight, so a tap there selects nothing.
function pickedRegion(face) {
  const best = [face.a, face.b, face.c].reduce((a, b) => (shading[b * 3 + 1] > shading[a * 3 + 1] ? b : a));
  return shading[best * 3 + 1] > 80 ? REGION_ORDER[shading[best * 3]] : null;
}

function paint(host, levels) {
  const css = getComputedStyle(host);
  const color = (name) => new THREE.Color(css.getPropertyValue(name).trim());
  const base = color('--body-base');
  const palette = REGION_ORDER.map((region) => {
    if (!region) return base;
    const c = color(`--heat-${levels[region] || 0}`);
    return region === selected ? color('--body-select') : c;
  });
  const colors = mesh.geometry.getAttribute('color');
  for (let i = 0; i < colors.count; i++) {
    const c = palette[shading[i * 3]];
    const w = shading[i * 3 + 1] / 255;
    const ao = 0.28 + 0.72 * (shading[i * 3 + 2] / 255) ** 1.4;
    colors.setXYZ(i, (base.r + (c.r - base.r) * w) * ao, (base.g + (c.g - base.g) * w) * ao, (base.b + (c.b - base.b) * w) * ao);
  }
  colors.needsUpdate = true;
}

// Puts the figure into host. Returns false if this device can't draw it.
export async function syncBody(host, { levels, picked, pick }) {
  onPick = pick;
  selected = picked;
  try {
    if (!renderer) await setup();
  } catch (err) {
    console.error(err);
    return false;
  }
  if (!host.isConnected) return true;
  const canvas = renderer.domElement;
  if (canvas.parentElement !== host) host.prepend(canvas);
  renderer.setSize(host.clientWidth, host.clientHeight);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  paint(host, levels);
  draw();
  kick();
  return true;
}

export function faceBody(front) {
  spinLeft = 0;
  const turn = Math.PI * 2;
  const base = front ? 0 : Math.PI;
  targetAngle = base + Math.round((angle - base) / turn) * turn;
  kick();
}
