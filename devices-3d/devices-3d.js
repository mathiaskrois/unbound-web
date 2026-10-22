// Real-time 3D iPhone 16 Pro and Apple Watch Series 10, rendered with three.js.
// Bundled by scripts/build-site.mjs into dist/assets/devices-3d.js and loaded on demand by
// landing.js, which keeps owning the choreography: it passes the same poses it writes to the
// CSS devices (stage px, CSS rotation conventions), and this module draws them.
// Units are stage pixels on the 540×680 device stage; proportions follow the real hardware.
import {
  ACESFilmicToneMapping, AddOperation, AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color,
  CylinderGeometry, DirectionalLight, ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PCFSoftShadowMap, PerspectiveCamera,
  PMREMGenerator, RepeatWrapping, Scene, Shape, ShapeGeometry, SRGBColorSpace, Vector3,
  WebGLRenderer, CatmullRomCurve3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const STAGE = { width: 540, height: 680, perspective: 1300 };
const MARGIN = 170;
const PHONE = { width: 274, height: 577, depth: 30, radius: 46, cx: 203, cy: 320.5 };
const WATCH = { width: 192, height: 232, depth: 44, radius: 52, cx: 410, cy: 481 };

function roundedRect(width, height, radius) {
  const x = -width / 2, y = -height / 2, r = Math.min(radius, width / 2, height / 2);
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// A rounded slab whose front face sits at z = depth / 2. The bevel rounds the flanks.
function slab(width, height, depth, radius, bevelSize, bevelThickness, bevelSegments) {
  const geometry = new ExtrudeGeometry(roundedRect(width - 2 * bevelSize, height - 2 * bevelSize, radius - bevelSize), {
    depth: depth - 2 * bevelThickness, bevelEnabled: true, bevelSize, bevelThickness, bevelSegments, curveSegments: 48,
  });
  geometry.translate(0, 0, -(depth - 2 * bevelThickness) / 2);
  geometry.computeVertexNormals();
  return geometry;
}

// A flat rounded-rectangle face with 0–1 UVs across its bounds.
function face(width, height, radius) {
  const geometry = new ShapeGeometry(roundedRect(width, height, radius), 48);
  const position = geometry.attributes.position;
  const uv = [];
  for (let i = 0; i < position.count; i++) uv.push(position.getX(i) / width + .5, position.getY(i) / height + .5);
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

function canvasTexture(canvas, renderer) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function pill(context, x, y, width, height) {
  const r = height / 2;
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

// The Library capture with the same branding patch the CSS device applies.
function phoneScreen(capture, icon) {
  const canvas = document.createElement('canvas');
  canvas.width = capture.naturalWidth;
  canvas.height = capture.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(capture, 0, 0);
  const k = canvas.width / (PHONE.width - 13.6);
  const x = canvas.width * .038, y = canvas.height * .0705, width = canvas.width * .338, height = canvas.height * .052;
  pill(context, x, y, width, height);
  context.fillStyle = '#1b1e2c';
  context.fill();
  context.lineWidth = k;
  context.strokeStyle = '#383b53';
  context.stroke();
  const iconSize = width * .24;
  context.drawImage(icon, x + 4 * k, y + (height - iconSize) / 2, iconSize, iconSize);
  context.fillStyle = '#f2f3ff';
  context.font = `700 ${12 * k}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.textBaseline = 'middle';
  if ('letterSpacing' in context) context.letterSpacing = `${-.5 * k}px`;
  context.fillText('unbound', x + 4 * k + iconSize + 3 * k, y + height / 2 + .5 * k);
  return canvas;
}

// watchOS Now Playing, drawn at 4× in the 168×208 layout the CSS illustration uses.
function watchScreen(icon, colors) {
  const canvas = document.createElement('canvas');
  const k = 4;
  canvas.width = 168 * k;
  canvas.height = 208 * k;
  const context = canvas.getContext('2d');
  const font = (weight, size) => `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const skip = new Path2D('M8 7a10 10 0 1 1-3 7M8 3v5H3');
  const skipForward = new Path2D('M22 7a10 10 0 1 0 3 7M22 3v5h5');
  return {
    canvas,
    draw(seconds) {
      const c = context;
      c.setTransform(1, 0, 0, 1, 0, 0);
      const background = c.createRadialGradient(.3 * canvas.width, 0, 0, .3 * canvas.width, 0, canvas.height * .62);
      background.addColorStop(0, '#121118');
      background.addColorStop(1, '#000');
      c.fillStyle = background;
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.scale(k, k);
      c.textBaseline = 'alphabetic';
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      // Status row: app name in violet, the time on the right.
      c.drawImage(icon, 23, 13, 11, 11);
      c.font = font(600, 9);
      c.fillStyle = colors.violet;
      c.fillText('unbound', 37, 22);
      c.fillStyle = '#f3f1ff';
      c.textAlign = 'right';
      c.fillText('9:41', 141, 22);
      c.textAlign = 'left';
      // Now Playing label with a small waveform.
      c.fillStyle = colors.mint;
      [3, 6, 4, 7, 3].forEach((h, i) => c.fillRect(14 + i * 2, 36 - h / 2, 1.2, h));
      c.font = font(600, 6);
      if ('letterSpacing' in c) c.letterSpacing = '.6px';
      c.fillText('NOW PLAYING', 27, 38.2);
      if ('letterSpacing' in c) c.letterSpacing = '-.66px';
      c.fillStyle = '#f3f1ff';
      c.font = font(650, 19);
      c.fillText('The Secret', 13, 61);
      c.fillText('Garden', 13, 81);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      c.font = font(400, 7);
      c.fillStyle = '#b6b0c6';
      c.fillText('Frances Hodgson Burnett', 13, 95);
      // Progress and times.
      const total = 22 * 60 + 4;
      c.fillStyle = '#33313b';
      pill(c, 13, 104, 142, 2.5);
      c.fill();
      c.fillStyle = colors.mint;
      pill(c, 13, 104, Math.max(2.5, 142 * Math.min(1, seconds / total)), 2.5);
      c.fill();
      c.font = font(400, 6);
      c.fillStyle = '#aaa6b7';
      c.fillText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, 13, 116);
      c.textAlign = 'right';
      c.fillText('22:04', 155, 116);
      c.textAlign = 'left';
      // Transport: skip back 15, pause, skip forward 30.
      const row = 172;
      c.strokeStyle = '#f3f1ff';
      c.lineWidth = 1.6 * 27 / 30;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const [path, x, label] of [[skip, 17, '15'], [skipForward, 123, '30']]) {
        c.save();
        c.translate(x, row - 13.5);
        c.scale(.9, .9);
        c.lineWidth = 1.6;
        c.stroke(path);
        c.restore();
        c.font = font(600, 7.5);
        c.fillStyle = '#f3f1ff';
        c.textAlign = 'center';
        c.fillText(label, x + 13.5, row + 2.6);
        c.textAlign = 'left';
      }
      c.shadowColor = '#beb0f966';
      c.shadowBlur = 14;
      c.fillStyle = '#beb0f9';
      c.beginPath();
      c.arc(84, row, 17, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#141221';
      c.fillRect(84 - 3.5 - 1.5, row - 5.5, 3, 11);
      c.fillRect(84 + 3.5 - 1.5, row - 5.5, 3, 11);
    },
  };
}

// Knurling for the Digital Crown: fine ridges used as a bump map around the cylinder.
function knurl() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 8;
  const context = canvas.getContext('2d');
  for (let x = 0; x < 256; x += 4) {
    const gradient = context.createLinearGradient(x, 0, x + 4, 0);
    gradient.addColorStop(0, '#000');
    gradient.addColorStop(.5, '#fff');
    gradient.addColorStop(1, '#000');
    context.fillStyle = gradient;
    context.fillRect(x, 0, 4, 8);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

// The sport band as one loop around an invisible wrist: it leaves the case at both lugs and
// meets behind it. A rounded-rectangle profile is swept along the loop in the watch's y–z plane.
function bandGeometry(width, thickness) {
  const h = WATCH.height / 2;
  const curve = new CatmullRomCurve3([
    [0, h - 16, -6], [0, h + 22, -9], [0, h + 56, -28], [0, h + 80, -70], [0, h + 86, -128], [0, h + 70, -184],
    [0, h + 30, -220], [0, h - 30, -236], [0, -h + 30, -236], [0, -h - 30, -220], [0, -h - 70, -184],
    [0, -h - 86, -128], [0, -h - 80, -70], [0, -h - 56, -28], [0, -h - 22, -9], [0, -h + 16, -6],
  ].map(([x, y, z]) => new Vector3(x, y, z)), true, 'centripetal');
  const profile = [];
  const r = thickness / 2;
  // Profile in (n, x): n across the thickness, x across the width, with fully rounded edges.
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 10; profile.push([Math.sin(a) * r, width / 2 - r + Math.cos(a) * r, Math.sin(a), Math.cos(a)]); }
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + Math.PI * i / 10; profile.push([Math.sin(a) * r, -width / 2 + r + Math.cos(a) * r, Math.sin(a), Math.cos(a)]); }
  const steps = 320;
  const positions = [], normals = [], uvs = [], indices = [];
  const ring = profile.length;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const point = curve.getPointAt(t % 1);
    const tangent = curve.getTangentAt(t % 1);
    const outward = new Vector3(0, -tangent.z, tangent.y).normalize();
    profile.forEach(([n, x, nn, nx], j) => {
      positions.push(point.x + x, point.y + outward.y * n, point.z + outward.z * n);
      const normal = new Vector3(nx, outward.y * nn, outward.z * nn).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(j / (ring - 1), t);
    });
  }
  for (let s = 0; s < steps; s++) for (let j = 0; j < ring; j++) {
    const a = s * ring + j, b = s * ring + (j + 1) % ring, c = (s + 1) * ring + j, d = (s + 1) * ring + (j + 1) % ring;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return { geometry, curve };
}

function buildPhone(materials, screenTexture) {
  const { width: W, height: H, depth: D, radius: R } = PHONE;
  const group = new Group();
  const body = new Mesh(slab(W, H, D, R, 2, 2.2, 5), materials.titanium);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const front = D / 2;
  const glass = new Mesh(face(W - 4.4, H - 4.4, R - 2.2), materials.coverGlass);
  glass.position.z = front + .35;
  group.add(glass);
  const screen = new Mesh(face(W - 13.6, H - 13.6, 39), new MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.position.z = front + .5;
  group.add(screen);
  const reflection = new Mesh(face(W - 4.4, H - 4.4, R - 2.2), materials.reflection);
  reflection.position.z = front + .8;
  group.add(reflection);
  const back = new Mesh(face(W - 4.4, H - 4.4, R - 2.2), materials.backGlass);
  back.position.z = -front - .35;
  back.rotation.y = Math.PI;
  group.add(back);
  // Keys sit on the flat titanium sides; positions follow the CSS model (top edge offsets).
  const key = (side, top, length, material = materials.titanium, protrude = 1.6, depth = 9) => {
    const mesh = new Mesh(slab(protrude * 2 + 2, length, depth, Math.min(4.5, depth / 2), .8, .8, 3), material);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(side * (W / 2 + protrude - 1), H / 2 - top - length / 2, -1);
    mesh.castShadow = true;
    group.add(mesh);
  };
  key(-1, 101, 20);
  key(-1, 147, 38);
  key(-1, 194, 38);
  key(1, 156, 58);
  key(1, 338, 36, materials.sapphire, .45, 11);
  // Antenna bands break the titanium near each corner.
  for (const [x, y, w, h] of [[-W / 2, H / 2 - 70, .9, 3.2], [W / 2, H / 2 - 70, .9, 3.2], [-W / 2, -H / 2 + 70, .9, 3.2], [W / 2, -H / 2 + 70, .9, 3.2], [-W / 2 + 72, H / 2, 3.2, .9], [W / 2 - 72, -H / 2, 3.2, .9]]) {
    const band = new Mesh(new BoxGeometry(w, h, D - 7), materials.antenna);
    band.position.set(x, y, 0);
    group.add(band);
  }
  return { group, screen };
}

function buildWatch(materials, screenTexture) {
  const { width: W, height: H, depth: D, radius: R } = WATCH;
  const group = new Group();
  const caseMesh = new Mesh(slab(W, H, D, R, 9, 11, 12), materials.aluminium);
  caseMesh.castShadow = caseMesh.receiveShadow = true;
  group.add(caseMesh);
  const front = D / 2;
  const crystal = new Mesh(face(W - 18, H - 18, R - 9), materials.coverGlass);
  crystal.position.z = front + .3;
  group.add(crystal);
  const screen = new Mesh(face(W - 32, H - 32, R - 16), new MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.position.z = front + .45;
  group.add(screen);
  const reflection = new Mesh(face(W - 17, H - 17, R - 8.5), materials.reflection);
  reflection.position.z = front + .9;
  group.add(reflection);
  const sensor = new Mesh(new CircleGeometry(56, 64), materials.backGlass);
  sensor.position.z = -front - .4;
  sensor.rotation.y = Math.PI;
  group.add(sensor);
  // Digital Crown: knurled sides, polished end cap.
  const crown = new Mesh(new CylinderGeometry(17, 17, 15, 96, 1), [materials.crownSide, materials.aluminium, materials.aluminium]);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(W / 2 + 4.5, H / 2 - 69, 2);
  crown.castShadow = true;
  group.add(crown);
  const button = new Mesh(slab(3.2, 46, 20, 9, 1, 1, 3), materials.aluminium);
  button.rotation.y = Math.PI / 2;
  button.position.set(W / 2 - 2.2, H / 2 - 134, -2);
  group.add(button);
  // Plum sport band with pin holes on the lower strap.
  const { geometry, curve } = bandGeometry(118, 9);
  const band = new Mesh(geometry, materials.band);
  band.castShadow = band.receiveShadow = true;
  group.add(band);
  // Pin holes on the outside of the lower strap, 6 mm apart, starting just below the case.
  const length = curve.getLength();
  for (const distance of [62, 92, 122, 152, 182]) {
    const t = 1 - distance / length;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const outward = new Vector3(0, -tangent.z, tangent.y).normalize();
    const hole = new Mesh(new CircleGeometry(3.6, 32), materials.hole);
    hole.position.copy(point).addScaledVector(outward, 4.65);
    hole.lookAt(hole.position.clone().add(outward));
    group.add(hole);
  }
  return { group, screen };
}

function detectSoftware(renderer) {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? `${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}` : '';
  return /swiftshader|llvmpipe|software|basic render/i.test(name);
}

export async function createDevices3D({ host, capture, icon, colors, onLost }) {
  const width = STAGE.width + MARGIN * 2, height = STAGE.height + MARGIN * 2;
  const canvas = document.createElement('canvas');
  canvas.className = 'device-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
  if (detectSoftware(renderer)) { renderer.dispose(); throw new Error('Software WebGL'); }
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .9;
  pmrem.dispose();

  const camera = new PerspectiveCamera(2 * Math.atan(height / 2 / STAGE.perspective) * 180 / Math.PI, width / height, 20, 5000);
  camera.position.set(0, 0, STAGE.perspective);

  const key = new DirectionalLight(0xffffff, 2.1);
  key.position.set(-520, 640, 900);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -600, right: 600, top: 600, bottom: -600, near: 200, far: 3000 });
  key.shadow.radius = 6;
  key.shadow.bias = -.0004;
  key.shadow.normalBias = 1.2;
  scene.add(key);
  const rim = new DirectionalLight(new Color('#c9bbff'), 1.4);
  rim.position.set(700, 220, -500);
  scene.add(rim);
  scene.add(new HemisphereLight(0xdcd8ff, 0x0b0d16, .35));

  const [captureImage, iconImage] = await Promise.all([loadImage(capture), loadImage(icon)]);
  const phoneTexture = canvasTexture(phoneScreen(captureImage, iconImage), renderer);
  const watchFace = watchScreen(iconImage, colors);
  const watchTexture = canvasTexture(watchFace.canvas, renderer);
  let watchSeconds = -1;

  const materials = {
    titanium: new MeshPhysicalMaterial({ color: '#b8b3aa', metalness: 1, roughness: .33 }),
    aluminium: new MeshPhysicalMaterial({ color: '#dcdee2', metalness: 1, roughness: .24 }),
    coverGlass: new MeshPhysicalMaterial({ color: '#040405', metalness: 0, roughness: .1, clearcoat: 1, clearcoatRoughness: .04 }),
    backGlass: new MeshPhysicalMaterial({ color: '#2a2926', metalness: 0, roughness: .55 }),
    // Glass reflections come only from the studio environment, so the key light never glares across a screen.
    reflection: new MeshBasicMaterial({ color: '#000', envMap: scene.environment, combine: AddOperation, reflectivity: .1, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    sapphire: new MeshPhysicalMaterial({ color: '#1c1c20', metalness: .2, roughness: .12, clearcoat: 1 }),
    antenna: new MeshPhysicalMaterial({ color: '#6d6a65', metalness: 0, roughness: .6 }),
    crownSide: new MeshPhysicalMaterial({ color: '#dcdee2', metalness: 1, roughness: .3, bumpMap: knurl(), bumpScale: 2.2 }),
    band: new MeshPhysicalMaterial({ color: '#33263f', metalness: 0, roughness: .74, sheen: .25, sheenColor: new Color('#7d6896'), sheenRoughness: .6, envMapIntensity: .3, specularIntensity: .5 }),
    hole: new MeshBasicMaterial({ color: '#120c18' }),
  };
  const phone = buildPhone(materials, phoneTexture);
  const watch = buildWatch(materials, watchTexture);
  scene.add(phone.group, watch.group);

  let state = null;
  let scale = 1;
  let active = false;
  let frame = 0;
  let lost = false;
  const start = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let ratio = dpr * scale;
    const budget = 3.6e6;
    if (width * height * ratio * ratio > budget) ratio = Math.sqrt(budget / (width * height));
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
  }

  // CSS stage pose → three.js transform: y and z rotations flip because CSS y points down.
  function place(group, base, pose, floatY) {
    group.position.set(base.cx - STAGE.width / 2 + pose.x, -(base.cy - STAGE.height / 2 + pose.y + floatY), pose.z);
    group.rotation.set(-pose.rx * Math.PI / 180, pose.ry * Math.PI / 180, -pose.rz * Math.PI / 180, 'XYZ');
    group.scale.setScalar(pose.s);
  }

  function draw(now) {
    if (!state || lost) return;
    const t = (now - start) / 1000;
    // The same idle float the CSS devices use: 5px over 6.5 s and 6px over 7.4 s.
    const float = (amplitude, period, offset) => state.float ? -amplitude * (.5 - .5 * Math.cos(2 * Math.PI * (t + offset) / period)) : 0;
    place(phone.group, PHONE, state.phone, float(5, 6.5, 0));
    place(watch.group, WATCH, state.watch, float(6, 7.4, 2.6));
    const dim = 1 - .82 * (state.phone.dim || 0);
    phone.screen.material.color.setScalar(dim);
    if (state.seconds !== watchSeconds) {
      watchSeconds = state.seconds;
      watchFace.draw(watchSeconds);
      watchTexture.needsUpdate = true;
    }
    // The composition keeps the watch in front of the phone (as the CSS stage does): the full scene
    // renders first, so the watch still shadows the phone, then the watch again over a cleared depth.
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    phone.group.visible = false;
    renderer.render(scene, camera);
    phone.group.visible = true;
  }

  function loop(now) {
    frame = 0;
    draw(now);
    if (active) frame = requestAnimationFrame(loop);
  }
  function request() { if (!frame) frame = requestAnimationFrame(loop); }

  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); onLost?.(); });

  resize();
  host.prepend(canvas);
  renderer.compile(scene, camera);

  return {
    canvas,
    update(next) { state = next; request(); },
    setActive(value) { active = value; if (active) request(); },
    setScale(value) { if (Math.abs(value - scale) > .01) { scale = value; resize(); request(); } },
    renderNow() { draw(performance.now()); },
  };
}
