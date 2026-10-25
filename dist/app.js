import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (s) => document.querySelector(s);
const host = $('#canvas-host');
const state = { mode: 'cut', view: 'perspective', room: 'all', furniture: true, labels: false, ready: false };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const worldPoint = (px, py) => new THREE.Vector3((px - 170) / 97.1 - 8.9, 0, 2.65 - (677 - py) / 97.1);
const roomData = {
  all: { title: 'Explore seu próximo olhar.', description: 'Três suítes, ambientes integrados e espaço para imaginar a vida acontecendo.', kicker: 'PENSADO EM CADA DETALHE', measures: [['03', 'suítes'], ['03', 'banheiros']], center: new THREE.Vector3(0, 0, 0) },
  queen: { title: 'Mais espaço para descansar.', description: 'Suíte com cama Queen e roupeiro com portas de correr, conforme o layout da planta.', kicker: 'SUÍTE QUEEN · 12,01 m²', measures: [['1,58 × 1,98', 'm · cama'], ['1,40 × 0,60', 'm · roupeiro']], center: worldPoint(447, 524), label: 'Suíte Queen · 12,01 m²', labelPoint: worldPoint(410, 485) },
  casal: { title: 'O seu lugar de pausa.', description: 'Cama de casal, roupeiro e banheiro privativo. Um ambiente para desacelerar.', kicker: 'SUÍTE CASAL · 9,50 m²', measures: [['1,38 × 1,88', 'm · cama'], ['1,40 × 0,60', 'm · roupeiro']], center: worldPoint(451, 285), label: 'Suíte Casal · 9,50 m²', labelPoint: worldPoint(475, 280) },
  solteirao: { title: 'Conforto na medida certa.', description: 'Uma cama de 1,20 m de largura e um roupeiro compacto compõem a terceira suíte.', kicker: 'SUÍTE SOLTEIRÃO · 7,02 m²', measures: [['1,20 × 1,88', 'm · cama'], ['1,00 × 0,60', 'm · roupeiro']], center: worldPoint(901, 542), label: 'Suíte Solteirão · 7,02 m²', labelPoint: worldPoint(886, 520) },
  living: { title: 'A vida acontece aqui.', description: 'Estar e jantar compartilham um ambiente aberto. Sofá, tapete e mesa redonda são uma proposta de mobiliário.', kicker: 'ESTAR E JANTAR', measures: [['04', 'lugares à mesa']], center: worldPoint(1410, 535), label: 'Estar e jantar', labelPoint: worldPoint(1410, 540) },
  kitchen: { title: 'Tudo no seu lugar.', description: 'Bancada, armários e equipamentos próximos à área de serviço. O mobiliário é uma interpretação do desenho.', kicker: 'COZINHA E SERVIÇO', measures: [], center: worldPoint(1708, 410), label: 'Cozinha e serviço', labelPoint: worldPoint(1690, 405) },
};

let renderer, scene, perspective, orthographic, camera, controls, model;
let meshes = [], labelEntries = [], framePending = false, transition = null, toastTimer, pointerStart;

function fail(error) {
  console.error('Visualizador 402:', error);
  $('#loading').hidden = true;
  $('#error').hidden = false;
  $('#error-text').textContent = 'O modelo não carregou. Confira a conexão e use um navegador com WebGL 2 habilitado.';
  host.dataset.ready = 'error';
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200);
}

function scheduleRender() {
  if (framePending || !renderer) return;
  framePending = true;
  requestAnimationFrame(draw);
}

function draw(now) {
  framePending = false;
  if (transition) {
    const t = Math.min(1, (now - transition.start) / transition.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, ease);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, ease);
    if (camera.isOrthographicCamera) {
      camera.zoom = THREE.MathUtils.lerp(transition.fromZoom, transition.toZoom, ease);
      camera.updateProjectionMatrix();
    }
    if (t === 1) transition = null;
    else scheduleRender();
  }
  controls.update();
  renderer.render(scene, camera);
  positionLabels();
  const v = camera.position.clone().sub(controls.target);
  $('#compass').setAttribute('transform', `rotate(${-THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z))} 25 25)`);
}

function moveTo(target, position, zoom = 1, animate = true) {
  transition = {
    fromPosition: camera.position.clone(), toPosition: position,
    fromTarget: controls.target.clone(), toTarget: target,
    fromZoom: camera.zoom, toZoom: zoom,
    start: performance.now(), duration: reducedMotion || !animate ? 1 : 680,
  };
  scheduleRender();
}

function homeDistance() {
  const aspect = host.clientWidth / host.clientHeight;
  const halfFov = THREE.MathUtils.degToRad(perspective.fov / 2);
  const direction = homeDirection();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const projectedSize = v => Math.abs(v.x) * 18.4 + Math.abs(v.y) * 3.1 + Math.abs(v.z) * 6.0;
  return Math.max(projectedSize(right) / (2 * Math.tan(halfFov) * aspect), projectedSize(up) / (2 * Math.tan(halfFov))) * 1.10 + 2;
}

function homeDirection() {
  return (host.clientWidth < 600 ? new THREE.Vector3(1, 1.5, .22) : new THREE.Vector3(.12, 1.1, .95)).normalize();
}

function focusRoom(id, animate = true) {
  if (!roomData[id]) return;
  state.room = id;
  const data = roomData[id];
  document.querySelectorAll('[data-room]').forEach(button => {
    const selected = button.dataset.room === id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('#detail-kicker').textContent = data.kicker;
  $('#detail-title').textContent = data.title;
  $('#detail-description').textContent = data.description;
  $('#detail-measures').replaceChildren(...data.measures.map(([value, label]) => {
    const span = document.createElement('span');
    const strong = document.createElement('b');
    strong.textContent = value;
    span.append(strong, document.createTextNode(` ${label}`));
    return span;
  }));
  $('#detail-measures').classList.toggle('dimensions', id !== 'all');
  if (!state.ready) return;
  const target = data.center.clone();
  const distance = id === 'all' ? homeDistance() : Math.max(7.8, 5.9 / (host.clientWidth / host.clientHeight));
  const direction = id === 'all' ? homeDirection() : new THREE.Vector3(.12, 1.1, .95).normalize();
  const position = camera.isOrthographicCamera
    ? target.clone().add(new THREE.Vector3(0, 30, .001))
    : target.clone().add(direction.multiplyScalar(distance));
  moveTo(target, position, id === 'all' ? 1 : 2.65, animate);
}

function setView(view) {
  state.view = view;
  transition = null;
  camera = view === 'top' ? orthographic : perspective;
  controls.object = camera;
  controls.enableRotate = view !== 'top';
  document.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === view;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  focusRoom(state.room, false);
  resize();
}

function applyLayers() {
  for (const mesh of meshes) {
    mesh.visible = !(mesh.userData.webUpper && state.mode === 'cut') &&
      (state.furniture || mesh.userData.webCategory !== 'furniture');
  }
  $('#scene-caption').textContent = state.mode === 'cut' ? 'MAQUETE INTERATIVA' : 'ARQUITETURA COMPLETA';
  host.dataset.mode = state.mode;
  host.dataset.furniture = String(state.furniture);
  scheduleRender();
}

function resize() {
  if (!renderer) return;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  perspective.aspect = w / h;
  perspective.updateProjectionMatrix();
  const width = Math.max(20.4, 9 * w / h);
  orthographic.left = -width / 2;
  orthographic.right = width / 2;
  orthographic.top = width / 2 * h / w;
  orthographic.bottom = -orthographic.top;
  orthographic.updateProjectionMatrix();
  // Refit the overview when switching between portrait and landscape layouts.
  if (state.ready && state.room === 'all') focusRoom('all', false);
  scheduleRender();
}

function positionLabels() {
  for (const { element, point } of labelEntries) {
    if (!state.labels || !state.ready) { element.hidden = true; continue; }
    const p = point.clone().add(new THREE.Vector3(0, .30, 0)).project(camera);
    element.hidden = p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
    element.style.left = `${(p.x + 1) / 2 * host.clientWidth}px`;
    element.style.top = `${(1 - p.y) / 2 * host.clientHeight}px`;
  }
}

function zoom(factor) {
  if (!state.ready) return;
  transition = null;
  if (camera.isOrthographicCamera) {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, .5, 10);
    camera.updateProjectionMatrix();
  } else {
    const direction = camera.position.clone().sub(controls.target);
    direction.setLength(THREE.MathUtils.clamp(direction.length() * factor, 3, 65));
    camera.position.copy(controls.target).add(direction);
  }
  controls.update();
  scheduleRender();
}

async function boot() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('WebGL indisponível')); });
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#ecebe5');
  perspective = new THREE.PerspectiveCamera(38, 1, .1, 150);
  perspective.position.set(2, 20, 18);
  orthographic = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 150);
  orthographic.position.set(0, 30, .001);
  orthographic.up.set(0, 0, -1);
  camera = perspective;
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.minDistance = 3;
  controls.maxDistance = 65;
  controls.minZoom = .5;
  controls.maxZoom = 10;
  controls.maxPolarAngle = Math.PI / 2 - .07;
  controls.minPolarAngle = .02;
  controls.screenSpacePanning = true;
  controls.addEventListener('change', scheduleRender);
  controls.addEventListener('start', () => { transition = null; });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environment = pmrem.fromScene(roomEnvironment, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .6;
  roomEnvironment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fffbec', '#8e9c83', 1.6));
  const sun = new THREE.DirectionalLight('#fff6e4', 3.0);
  sun.position.set(-5, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 11, bottom: -11, near: 1, far: 40 });
  sun.shadow.normalBias = .025;
  sun.shadow.bias = -.0003;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#eff5ff', 1.1);
  fill.position.set(9, 9, -8);scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#ecebe5', roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;ground.position.y = -.385;ground.receiveShadow = true;scene.add(ground);
  new ResizeObserver(resize).observe(host);
  resize();
  scheduleRender();
  const gltf = await new GLTFLoader().loadAsync('./assets/unidade-402.glb', event => {
    if (event.total) {
      const percent = Math.round(event.loaded / event.total * 100);
      $('#loading-bar').style.width = `${percent}%`;
      $('#loading-text').textContent = percent < 100 ? `Carregando o modelo… ${percent}%` : 'Organizando os ambientes…';
    }
  });
  model = gltf.scene;
  model.position.set(-8.9, 0, 2.65);
  model.traverse(object => {
    if (!object.isMesh) return;
    meshes.push(object);
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material.name.includes('Vidro')) {
        material.transmission = 0;
        material.transparent = true;
        material.opacity = .23;
        material.depthWrite = false;
        object.castShadow = false;
      }
    }
  });
  scene.add(model);
  for (const data of Object.values(roomData)) {
    if (!data.label) continue;
    const element = document.createElement('span');
    element.className = 'room-label';element.textContent = data.label;element.hidden = true;
    $('#labels').append(element);
    labelEntries.push({ element, point: data.labelPoint });
  }
  state.ready = true;
  host.dataset.ready = 'true';
  host.dataset.meshes = String(meshes.length);
  applyLayers();
  focusRoom('all', false);
  $('#loading-bar').style.width = '100%';
  $('#loading').classList.add('done');
  setTimeout(() => { $('#loading').hidden = true; }, reducedMotion ? 0 : 400);
  setupPicking();
}

function setupPicking() {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  host.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
  host.addEventListener('dblclick', event => {
    if (!state.ready || !pointerStart) return;
    const bounds = host.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes.filter(mesh => mesh.visible), false)[0];
    if (!hit) return;
    let nearest = 'all', distance = Infinity;
    for (const [id, data] of Object.entries(roomData)) {
      if (id === 'all') continue;
      const d = Math.hypot(hit.point.x - data.center.x, hit.point.z - data.center.z);
      if (d < distance) { distance = d; nearest = id; }
    }
    focusRoom(nearest);
  });
}

document.querySelectorAll('[data-room]').forEach(button => button.addEventListener('click', () => focusRoom(button.dataset.room)));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { if (state.ready) setView(button.dataset.view); }));
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(other => {
    const selected = other === button;
    other.classList.toggle('selected', selected);other.setAttribute('aria-pressed', String(selected));
  });
  applyLayers();
}));
$('#reset').addEventListener('click', () => { if (state.ready) { setView('perspective'); focusRoom('all'); } });
$('#zoom-in').addEventListener('click', () => zoom(.8));
$('#zoom-out').addEventListener('click', () => zoom(1.25));
$('#furniture-toggle').addEventListener('change', event => { state.furniture = event.target.checked; applyLayers(); });
$('#labels-toggle').addEventListener('change', event => { state.labels = event.target.checked; scheduleRender(); });
for (const name of ['layers', 'about']) {
  const dialog = $(`#${name}-dialog`);
  $(`#${name}-open`).addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
}
$('#snapshot').addEventListener('click', () => {
  if (!state.ready) return;
  renderer.render(scene, camera);
  const link = document.createElement('a');
  link.download = `unidade-402-${state.view}-${state.mode}.png`;
  link.href = renderer.domElement.toDataURL('image/png');link.click();
  toast('Imagem salva. Um novo olhar para guardar.');
});
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('Para ampliar, use o modo tela cheia do navegador.');
  } catch { toast('O navegador não permitiu a tela cheia.'); }
});
host.addEventListener('keydown', event => {
  if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(.8); }
  if (event.key === '-') { event.preventDefault(); zoom(1.25); }
  if (event.key.toLowerCase() === 'r') focusRoom('all');
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(); });
boot().catch(fail);
