/* A local 3D developer workbench. Every response is an illustrative offline demo. */
(() => {
  'use strict';
  const t = window.portfolioI18n?.t || (value => value);
  const root = document.querySelector('.developer-lab');
  if (!root) return;
  const stage = root.querySelector('.developer-stage');
  const canvas = root.querySelector('#developer-canvas');
  const viewButtons = [...root.querySelectorAll('[data-lab-view]')];
  const runButton = root.querySelector('[data-lab-run]');
  const resetButton = root.querySelector('[data-lab-reset]');
  const motionButton = root.querySelector('[data-lab-motion]');
  const status = root.querySelector('.developer-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const T = window.THREE;
  let renderer, scene, camera, workbench, laptop, api, database;
  let environment, screenTexture, apiTexture, databaseTexture;
  let lidMaterial, deckMaterial, keyMaterial, apiMaterial, diskMaterial, accentMaterial;
  let screenMaterial, apiFaceMaterial, shadowMaterial, packet, returnPacket;
  let resizeObserver, intersectionObserver, themeObserver;
  let frame = 0, lastTime = 0, ready = false, lost = false, disposed = false, visible = true;
  let view = 'code', running = false, completed = false, elapsed = 0, time = 0, motion = !reduced.matches;
  let dragging = null, environmentScene;
  const curves = [], wires = [], resources = new Set(), textures = new Set();
  const pose = {x: 0, y: 0, targetX: 0, targetY: 0};
  const pointer = {x: 0, y: 0, targetX: 0, targetY: 0};
  const viewAngles = {code: {x: 0, y: 0}, api: {x: -0.025, y: -0.09}, data: {x: 0.035, y: 0.065}};
  const viewDescriptions = {
    code: 'Java + Spring Boot · from request to response.',
    api: 'REST API · requests and responses.',
    data: 'Database + SQL · structured data.'
  };
  try { if (localStorage.getItem('aditya-portfolio-developer-motion') === 'paused') motion = false; } catch {}

  let lastAnnouncement = viewDescriptions.code;
  function announce(value) { lastAnnouncement = value; if (status) status.textContent = t(value); }
  function buttonText(button, value) {
    if (!button) return;
    const label = button.querySelector('[data-control-label], .control-label, .motion-label');
    if (label) label.textContent = t(value);
    else button.textContent = t(value);
  }
  function moving() { return motion && !reduced.matches; }
  function controls() {
    root.dataset.view = view;
    root.dataset.running = String(running);
    root.dataset.motion = moving() ? 'playing' : 'paused';
    for (const button of viewButtons) {
      button.disabled = !ready || running;
      button.setAttribute('aria-pressed', String(button.dataset.labView === view));
    }
    if (runButton) {
      runButton.disabled = !ready || running;
      runButton.setAttribute('aria-label', t(running ? 'Request demo is running' : 'Run request demo'));
      buttonText(runButton, running ? 'Running demo…' : 'Run demo');
    }
    if (resetButton) resetButton.disabled = !ready;
    if (motionButton) {
      motionButton.disabled = !ready || reduced.matches;
      motionButton.setAttribute('aria-pressed', String(moving()));
      motionButton.setAttribute('aria-label', t(reduced.matches ? 'Motion disabled by your reduced-motion preference' : moving() ? 'Pause ambient motion' : 'Play ambient motion'));
      buttonText(motionButton, reduced.matches ? 'Motion off' : moving() ? 'Pause motion' : 'Play motion');
    }
  }
  window.addEventListener('portfolio:languagechange', () => {
    controls(); announce(lastAnnouncement);
    if (ready && !lost && !disposed) { refreshTextures(); schedule(); }
  });
  function fail(message) {
    ready = false;
    running = false;
    root.dataset.renderer = 'fallback';
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    controls();
    announce(message || 'A still developer illustration is shown because 3D rendering is unavailable.');
  }
  if (!T || !canvas || !stage) { fail(); return; }

  function keep(value) { resources.add(value); return value; }
  function material(options) { return keep(new T.MeshStandardMaterial(options)); }
  function roundedGeometry(width, height, depth, radius = 0.05) {
    const x = -width / 2, y = -height / 2;
    const r = Math.min(radius, height / 2 - 0.001, width / 2 - 0.001);
    const shape = new T.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const geometry = new T.ExtrudeGeometry(shape, {depth, bevelEnabled: false, steps: 1, curveSegments: 5});
    geometry.translate(0, 0, -depth / 2);
    return keep(geometry);
  }
  function mesh(geometry, appearance, parent, position = [0, 0, 0]) {
    const item = new T.Mesh(geometry, appearance);
    item.position.set(...position);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function box(width, height, depth, appearance, parent, position, radius = 0.05) {
    return mesh(roundedGeometry(width, height, depth, radius), appearance, parent, position);
  }
  function makeTexture(width, height, paint) {
    const surface = document.createElement('canvas');
    surface.width = width; surface.height = height;
    const context = surface.getContext('2d');
    if (!context) throw new Error('Canvas textures unavailable');
    paint(context, width, height);
    const texture = new T.CanvasTexture(surface);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture);
    return texture;
  }
  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(ctx, value, x, y, color, size = 43, weight = 500) {
    ctx.font = `${weight} ${size}px Consolas, 'Courier New', monospace`;
    ctx.fillStyle = color; ctx.fillText(t(value), x, y, Math.max(1, ctx.canvas.width - x - 24));
  }
  function pieces(ctx, entries, x, y, size = 48) {
    let cursor = x;
    ctx.font = `500 ${size}px Consolas, 'Courier New', monospace`;
    for (const [value, color] of entries) {
      ctx.fillStyle = color; ctx.fillText(value, cursor, y);
      cursor += ctx.measureText(value).width;
    }
  }
  function paintScreen(ctx, width, height) {
    const dark = document.documentElement.dataset.theme === 'dark';
    const p = {bg: '#101a28', bar: '#1d2b3c', ink: '#eaf2ff', muted: '#8295ad', blue: dark ? '#a8d8ff' : '#8fc8ff', violet: '#c3a8ff', mint: '#8bdbc5', gold: '#e9c78a'};
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = p.bar; ctx.fillRect(0, 0, width, 102);
    ['#ef8589', '#edc778', '#8bc8ba'].forEach((color, index) => { ctx.beginPath(); ctx.arc(39 + index * 34, 51, 9, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
    const titles = {code: 'AccountController.java', api: 'accounts.http', data: 'accounts.sql'};
    line(ctx, titles[view], 205, 66, p.ink, 38, 600);
    line(ctx, 'AD / WORKBENCH', 1170, 66, p.muted, 25);
    ctx.fillStyle = '#142234'; ctx.fillRect(0, 102, 87, height - 160);
    // A narrow editor rail and line numbers keep the recognizable IDE frame quiet.
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i === 0 ? p.blue : '#51667e'; ctx.lineWidth = 4;
      ctx.strokeRect(27, 151 + i * 91, 32, 36);
      ctx.beginPath(); ctx.moveTo(37, 164 + i * 91); ctx.lineTo(51, 164 + i * 91); ctx.stroke();
    }
    let rows;
    if (view === 'code') rows = [
      [['@RestController', p.gold]],
      [['@RequestMapping', p.gold], ['("/api")', p.mint]],
      [['class ', p.violet], ['AccountController {', p.ink]],
      [['  @PostMapping', p.gold], ['("/accounts")', p.mint]],
      [['  ResponseEntity ', p.blue], ['create() {', p.ink]],
      [['    return ', p.violet], ['service.create();', p.ink]],
      [['  }', p.ink]],
      [['}', p.ink]]
    ];
    else if (view === 'api') rows = [
      [['POST ', p.blue], ['/api/accounts', p.ink]],
      [['Content-Type: ', p.muted], ['application/json', p.mint]],
      [['', p.ink]],
      [['HTTP/1.1 ', p.muted], [completed ? '200 OK' : '200 OK · example', p.mint]],
      [['{', p.ink]],
      [['  "status"', p.blue], [': ', p.ink], ['"success",', p.mint]],
      [['  "source"', p.blue], [': ', p.ink], ['"local demo"', p.gold]],
      [['}', p.ink]]
    ];
    else rows = [
      [['-- SQL / active accounts', p.muted]],
      [['SELECT ', p.violet], ['account_id,', p.ink]],
      [['       account_status', p.ink]],
      [['FROM ', p.violet], ['accounts', p.blue]],
      [['WHERE ', p.violet], ['account_status = ', p.ink], ["'ACTIVE'", p.mint]],
      [['ORDER BY ', p.violet], ['created_at ', p.ink], ['DESC;', p.violet]],
      [['', p.ink]],
      [['-- No connection. Demo data only.', p.muted]]
    ];
    rows.forEach((row, index) => {
      line(ctx, String(index + 1), 113, 195 + index * 84, '#60768f', 31);
      pieces(ctx, row, 174, 195 + index * 84, view === 'data' ? 45 : 46);
    });
    ctx.fillStyle = '#213b58'; ctx.fillRect(0, height - 59, width, 59);
    line(ctx, 'main', 29, height - 19, '#dceeff', 27);
    line(ctx, running ? 'DEMO RUNNING' : completed ? 'DEMO COMPLETE' : 'LOCAL DEMO', 215, height - 19, '#a9d6f5', 27);
    line(ctx, 'Java  ·  Spring Boot  ·  SQL', 856, height - 19, '#b9ccdf', 25);
  }
  function paintApi(ctx, width, height) {
    const dark = document.documentElement.dataset.theme === 'dark';
    const bg = dark ? '#1b2b3d' : '#f2f7ff', ink = dark ? '#edf5ff' : '#172e4e', muted = dark ? '#9aafc6' : '#59718c';
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = dark ? '#2b435d' : '#dceaff'; ctx.fillRect(0, 0, width, 115);
    line(ctx, 'API RESPONSE', 49, 75, ink, 42, 700);
    line(ctx, 'POST', 50, 179, dark ? '#a6d1fa' : '#1d5dde', 37, 700);
    line(ctx, '/api/accounts', 50, 241, ink, 43, 600);
    roundRect(ctx, 48, 281, 294, 77, 20, dark ? '#244a4b' : '#d8eee7');
    line(ctx, running ? 'PROCESSING' : '200 OK', 69, 334, dark ? '#a9e1cc' : '#215d4a', running ? 30 : 42, 700);
    line(ctx, '{', 49, 429, muted, 40);
    pieces(ctx, [['  "status": ', muted], ['"success"', dark ? '#abd9c5' : '#2a735a']], 49, 493, 35);
    line(ctx, '}', 49, 556, muted, 40);
    ctx.fillStyle = dark ? '#32465c' : '#d1ddea'; ctx.fillRect(49, 601, width - 98, 2);
    line(ctx, 'REQUEST / RESPONSE', 49, 662, muted, 29, 500);
  }
  function paintDatabase(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#142941'; ctx.fillRect(0, 0, width, height);
    line(ctx, 'DATABASE', 23, 88, '#e4f2ff', 60, 700);
    line(ctx, 'SQL / DATA', 25, 145, '#97bedf', 32, 500);
  }
  function refreshTextures() {
    if (screenTexture) { paintScreen(screenTexture.image.getContext('2d'), screenTexture.image.width, screenTexture.image.height); screenTexture.needsUpdate = true; }
    if (apiTexture) { paintApi(apiTexture.image.getContext('2d'), apiTexture.image.width, apiTexture.image.height); apiTexture.needsUpdate = true; }
    if (databaseTexture) { paintDatabase(databaseTexture.image.getContext('2d'), databaseTexture.image.width, databaseTexture.image.height); databaseTexture.needsUpdate = true; }
  }
  function environmentLighting() {
    environmentScene = new T.Scene();
    environmentScene.background = new T.Color('#71859e');
    const panel = (width, height, position, intensity) => {
      const light = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({color: new T.Color(intensity, intensity * 1.035, intensity * 1.11), side: T.DoubleSide}));
      light.position.set(...position); light.lookAt(0, 0, 0); environmentScene.add(light);
    };
    panel(7, 10, [-5, 4, 5], 3.6);
    panel(8, 5, [0, 7, 0], 5);
    panel(3, 8, [6, 2, -2], 2.8);
    const generator = new T.PMREMGenerator(renderer);
    environment = generator.fromScene(environmentScene, 0.12, 0.1, 100);
    scene.environment = environment.texture;
    generator.dispose();
    environmentScene.traverse(item => { item.geometry?.dispose(); item.material?.dispose(); });
  }
  function buildLaptop() {
    laptop = new T.Group();
    laptop.position.set(-0.88, 0, 0.08);
    workbench.add(laptop);
    // Full depth chassis, recessed keyboard, individual raised keycaps and a trackpad.
    const base = box(3.61, 2.42, 0.16, deckMaterial, laptop, [0, 0.18, 0.54], 0.11);
    base.rotation.x = -Math.PI / 2;
    const underside = box(3.49, 2.30, 0.07, lidMaterial, laptop, [0, 0.095, 0.54], 0.12);
    underside.rotation.x = -Math.PI / 2;
    const keyboardWell = box(3.21, 1.22, 0.018, material({color: '#142539', metalness: 0.3, roughness: 0.52}), laptop, [0, 0.270, 0.19], 0.08);
    keyboardWell.rotation.x = -Math.PI / 2;
    const keys = [];
    for (let row = 0; row < 4; row++) for (let column = 0; column < 12; column++) keys.push({x: (column - 5.5) * 0.253, z: -0.267 + row * 0.225, width: 0.216});
    for (const x of [-1.3915, -1.1385, -0.8855, 0.8855, 1.1385, 1.3915]) keys.push({x, z: 0.633, width: 0.216});
    keys.push({x: 0, z: 0.633, width: 1.41});
    const instancedKeys = new T.InstancedMesh(keep(new T.BoxGeometry(1, 0.047, 0.181)), keyMaterial, keys.length);
    const dummy = new T.Object3D();
    keys.forEach((key, index) => {
      dummy.position.set(key.x, 0.31, key.z); dummy.scale.set(key.width, 1, 1); dummy.updateMatrix();
      instancedKeys.setMatrixAt(index, dummy.matrix);
    });
    instancedKeys.castShadow = true; instancedKeys.receiveShadow = true; laptop.add(instancedKeys);
    const legendTexture = makeTexture(1536, 576, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#b8cce2'; ctx.font = '500 30px Consolas, monospace'; ctx.textAlign = 'center';
      const legends = ['1234567890−=', 'QWERTYUIOP[]', 'ASDFGHJKL;\'↵', 'ZXCVBNM,./↑↓'];
      legends.forEach((row, rowIndex) => [...row].forEach((letter, column) => ctx.fillText(letter, (column + 0.5) * (w / 12), 74 + rowIndex * 106)));
      ctx.fillStyle = '#6f8aaa'; ctx.fillRect(532, 518, 470, 3);
    });
    const legends = mesh(keep(new T.PlaneGeometry(3.036, 1.222)), keep(new T.MeshBasicMaterial({map: legendTexture, transparent: true, depthWrite: false, toneMapped: false})), laptop, [0, 0.335, 0.19]);
    legends.rotation.x = -Math.PI / 2; legends.castShadow = false;
    const trackBorder = box(1.24, 0.66, 0.011, material({color: '#b3c8de', metalness: 0.78, roughness: 0.3}), laptop, [0, 0.272, 1.231], 0.055);
    trackBorder.rotation.x = -Math.PI / 2;
    const track = box(1.205, 0.625, 0.013, deckMaterial, laptop, [0, 0.281, 1.231], 0.045);
    track.rotation.x = -Math.PI / 2;
    box(0.48, 0.025, 0.022, material({color: '#475e78', metalness: 0.6, roughness: 0.5}), laptop, [0, 0.249, 1.755], 0.01);
    const hinge = mesh(keep(new T.CylinderGeometry(0.105, 0.105, 2.82, 24)), lidMaterial, laptop, [0, 0.293, -0.596]);
    hinge.rotation.z = Math.PI / 2;
    const lid = new T.Group(); lid.position.set(0, 0.31, -0.61); lid.rotation.x = -0.13; laptop.add(lid);
    box(3.61, 2.40, 0.145, lidMaterial, lid, [0, 1.175, 0], 0.10);
    box(3.48, 2.28, 0.014, material({color: '#0b1624', metalness: 0.28, roughness: 0.36}), lid, [0, 1.179, 0.081], 0.065);
    screenTexture = makeTexture(1536, 960, paintScreen);
    screenMaterial = keep(new T.MeshBasicMaterial({map: screenTexture, toneMapped: false}));
    const screen = mesh(keep(new T.PlaneGeometry(3.31, 2.069)), screenMaterial, lid, [0, 1.202, 0.092]);
    screen.castShadow = false; screen.receiveShadow = false;
    const lens = mesh(keep(new T.CircleGeometry(0.017, 12)), keep(new T.MeshBasicMaterial({color: '#60798c'})), lid, [0, 2.304, 0.094]);
    lens.castShadow = false;
    // Speaker slots and physical side ports lend the laptop a familiar silhouette.
    const slotMaterial = material({color: '#24374c', metalness: 0.2, roughness: 0.7});
    for (let side of [-1, 1]) for (let i = 0; i < 6; i++) box(0.035, 0.012, 0.068, slotMaterial, laptop, [side * 1.682, 0.269, -0.25 + i * 0.155], 0.004);
    box(0.012, 0.036, 0.21, slotMaterial, laptop, [1.811, 0.175, 0.18], 0.007);
    box(0.012, 0.031, 0.12, slotMaterial, laptop, [1.811, 0.175, 0.53], 0.007);
  }
  function buildApi() {
    api = new T.Group(); api.position.set(2.075, 2.09, -0.65); api.rotation.y = -0.12; api.rotation.x = -0.035; workbench.add(api);
    box(1.99, 1.60, 0.12, apiMaterial, api, [0, 0, 0], 0.09);
    box(1.92, 1.53, 0.026, accentMaterial, api, [0, 0, 0.059], 0.062);
    apiTexture = makeTexture(900, 720, paintApi);
    apiFaceMaterial = keep(new T.MeshBasicMaterial({map: apiTexture, toneMapped: false}));
    const face = mesh(keep(new T.PlaneGeometry(1.86, 1.488)), apiFaceMaterial, api, [0, 0, 0.08]);
    face.castShadow = false; face.receiveShadow = false;
    const stand = box(0.25, 0.44, 0.10, lidMaterial, api, [0, -0.98, -0.055], 0.035);
    stand.visible = false;
  }
  function buildDatabase() {
    database = new T.Group(); database.position.set(2.14, 0.035, 0.99); workbench.add(database);
    const groove = material({color: '#192d45', metalness: 0.55, roughness: 0.4});
    for (let index = 0; index < 3; index++) {
      mesh(keep(new T.CylinderGeometry(0.56, 0.56, 0.235, 48)), diskMaterial, database, [0, 0.255 + index * 0.292, 0]);
      mesh(keep(new T.CylinderGeometry(0.535, 0.535, 0.055, 48)), groove, database, [0, 0.115 + index * 0.292, 0]);
      const edge = mesh(keep(new T.TorusGeometry(0.545, 0.014, 8, 48)), accentMaterial, database, [0, 0.369 + index * 0.292, 0]);
      edge.rotation.x = Math.PI / 2;
    }
    mesh(keep(new T.CylinderGeometry(0.43, 0.43, 0.012, 48)), material({color: '#9dbbdd', metalness: 0.74, roughness: 0.3}), database, [0, 0.970, 0]);
    databaseTexture = makeTexture(430, 183, paintDatabase);
    const name = mesh(keep(new T.PlaneGeometry(0.80, 0.34)), keep(new T.MeshBasicMaterial({map: databaseTexture, toneMapped: false})), database, [0, 0.579, 0.562]);
    name.castShadow = false;
    const ledMaterial = keep(new T.MeshBasicMaterial({color: '#a0dfd1'}));
    mesh(keep(new T.SphereGeometry(0.025, 12, 8)), ledMaterial, database, [0.325, 0.282, 0.486]);
  }
  function buildPaths() {
    const points = [
      [[0.94, 0.29, 0.60], [1.27, 0.40, 0.49], [1.31, 1.03, 0.01], [1.53, 1.46, -0.49]],
      [[2.58, 1.33, -0.61], [2.95, 1.01, -0.32], [2.96, 0.62, 0.47], [2.58, 0.59, 0.89]],
      [[1.78, 0.29, 1.12], [1.35, 0.072, 1.53], [0.75, 0.075, 1.73], [0.34, 0.28, 1.76]]
    ];
    points.forEach(values => {
      const curve = new T.CatmullRomCurve3(values.map(point => new T.Vector3(...point)));
      curves.push(curve);
      const wireMaterial = material({color: '#679cd6', emissive: '#497fbb', emissiveIntensity: 0.16, metalness: 0.45, roughness: 0.4, transparent: true, opacity: 0.68});
      wires.push(wireMaterial);
      const tube = mesh(keep(new T.TubeGeometry(curve, 36, 0.016, 7, false)), wireMaterial, workbench);
      tube.castShadow = false;
    });
    const packetMaterial = keep(new T.MeshBasicMaterial({color: '#b9e9ff'}));
    packet = mesh(keep(new T.SphereGeometry(0.065, 16, 12)), packetMaterial, workbench);
    packet.visible = false; packet.castShadow = false;
    returnPacket = mesh(keep(new T.SphereGeometry(0.038, 12, 8)), packetMaterial, workbench);
    returnPacket.visible = false; returnPacket.castShadow = false;
  }
  function buildScene() {
    renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'low-power'});
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
    scene = new T.Scene();
    camera = new T.OrthographicCamera(-4, 4, 3, -3, 0.1, 50);
    camera.position.set(4.35, 4.25, 10.2); camera.lookAt(0.12, 1.15, 0.08);
    environmentLighting();
    scene.add(new T.HemisphereLight(0xe8f2ff, 0x385676, 2.5));
    const key = new T.DirectionalLight(0xffffff, 3.1); key.position.set(-3, 9, 5); key.castShadow = true;
    key.shadow.mapSize.set(512, 512); key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5; key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.0001; key.shadow.radius = 5; scene.add(key);
    const rim = new T.DirectionalLight(0x7fb7ff, 2.1); rim.position.set(5, 3, -3); scene.add(rim);
    const front = new T.DirectionalLight(0xe1edff, 0.85); front.position.set(1, 2, 8); scene.add(front);
    lidMaterial = material({color: '#879db5', metalness: 0.75, roughness: 0.30, envMapIntensity: 0.8});
    deckMaterial = material({color: '#c0cddd', metalness: 0.65, roughness: 0.39, envMapIntensity: 0.7});
    keyMaterial = material({color: '#284260', metalness: 0.22, roughness: 0.56});
    apiMaterial = material({color: '#c5d7e9', metalness: 0.72, roughness: 0.33});
    diskMaterial = material({color: '#7194bc', metalness: 0.72, roughness: 0.33, emissive: '#1c4165', emissiveIntensity: 0.08});
    accentMaterial = material({color: '#669eda', metalness: 0.45, roughness: 0.3, emissive: '#4c9ff5', emissiveIntensity: 0.25});
    workbench = new T.Group(); scene.add(workbench);
    buildLaptop(); buildApi(); buildDatabase(); buildPaths();
    shadowMaterial = keep(new T.ShadowMaterial({color: '#10253e', opacity: 0.21}));
    const floor = mesh(keep(new T.PlaneGeometry(12, 9)), shadowMaterial, scene, [0, -0.014, 0]);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false; floor.receiveShadow = true;
    applyTheme(); resize(); positionScene(0); renderer.render(scene, camera);
    if (renderer.getContext().isContextLost()) throw new Error('3D context unavailable');
    ready = true; root.dataset.renderer = 'webgl'; controls();
    announce(viewDescriptions[view]); schedule();
  }
  function applyTheme() {
    if (!renderer || !deckMaterial) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    lidMaterial.color.set(dark ? '#556f8b' : '#879db5');
    deckMaterial.color.set(dark ? '#7890aa' : '#c0cddd');
    keyMaterial.color.set(dark ? '#243c58' : '#284260');
    apiMaterial.color.set(dark ? '#45627e' : '#c5d7e9');
    diskMaterial.color.set(dark ? '#6387ad' : '#7194bc');
    accentMaterial.color.set(dark ? '#93c3eb' : '#5c96d8');
    accentMaterial.emissive.set(dark ? '#689acc' : '#377dd1');
    if (shadowMaterial) shadowMaterial.opacity = dark ? 0.22 : 0.13;
    wires.forEach(wire => { wire.color.set(dark ? '#8fbde2' : '#6394c7'); wire.emissive.set(dark ? '#6c9cc5' : '#356a9c'); });
    renderer.toneMappingExposure = dark ? 0.93 : 1.04;
    refreshTextures(); highlight(); schedule();
  }
  function resize() {
    if (!renderer || lost) return;
    const width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight), aspect = width / height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.75 : 2));
    renderer.setSize(width, height, false);
    const worldHeight = Math.max(4.6, 6.65 / aspect);
    camera.left = -worldHeight * aspect / 2; camera.right = worldHeight * aspect / 2;
    camera.top = worldHeight / 2; camera.bottom = -worldHeight / 2; camera.updateProjectionMatrix();
    schedule();
  }
  function highlight() {
    if (!apiMaterial) return;
    apiMaterial.emissive.set(view === 'api' || running ? '#498bc2' : '#15273a');
    apiMaterial.emissiveIntensity = view === 'api' || running ? 0.26 : 0.02;
    diskMaterial.emissiveIntensity = view === 'data' || running ? 0.37 : 0.08;
    lidMaterial.emissive.set(view === 'code' ? '#345d84' : '#122338');
    lidMaterial.emissiveIntensity = view === 'code' ? 0.13 : 0.025;
  }
  function switchView(next, speak = true) {
    if (!ready || !viewAngles[next]) return;
    view = next;
    pose.targetX = viewAngles[view].x; pose.targetY = viewAngles[view].y;
    if (reduced.matches || !moving()) { pose.x = pose.targetX; pose.y = pose.targetY; }
    refreshTextures(); highlight(); controls();
    if (speak) announce(viewDescriptions[view]);
    schedule();
  }
  function finishDemo() {
    running = false; completed = true; elapsed = 4;
    packet.visible = returnPacket.visible = false;
    wires.forEach(wire => { wire.emissiveIntensity = 0.16; });
    refreshTextures(); highlight(); controls(); announce('Demo complete · 200 OK.');
  }
  function updateDemo(dt) {
    if (!running) return;
    if (reduced.matches) { finishDemo(); return; }
    elapsed = Math.min(4, elapsed + dt);
    if (elapsed >= 4) { finishDemo(); return; }
    const phase = Math.min(2, Math.floor(elapsed / (4 / 3)));
    const position = Math.min(1, (elapsed - phase * (4 / 3)) / (4 / 3));
    packet.visible = true; returnPacket.visible = position > 0.12;
    packet.position.copy(curves[phase].getPointAt(position));
    returnPacket.position.copy(curves[phase].getPointAt(Math.max(0, position - 0.10)));
    wires.forEach((wire, index) => { wire.emissiveIntensity = index === phase ? 0.9 : 0.16; });
    const label = phase === 0 ? 'Demo: Java controller → REST API' : phase === 1 ? 'Demo: service → database' : 'Demo: response → application';
    if (root.dataset.demoPhase !== String(phase)) { root.dataset.demoPhase = String(phase); announce(label); }
  }
  function positionScene(dt) {
    if (moving()) time += dt;
    const follow = reduced.matches || !moving() ? 1 : 1 - Math.exp(-dt * 8);
    pose.x += (pose.targetX - pose.x) * follow; pose.y += (pose.targetY - pose.y) * follow;
    pointer.x += (pointer.targetX - pointer.x) * follow; pointer.y += (pointer.targetY - pointer.y) * follow;
    workbench.rotation.x = pose.x + pointer.y * 0.015;
    workbench.rotation.y = pose.y + pointer.x * 0.035;
    api.position.y = 2.09 + (moving() ? Math.sin(time * 1.15) * 0.025 : 0);
  }
  function canRender() { return ready && !lost && !disposed && visible && !document.hidden; }
  function schedule() { if (!frame && canRender()) frame = requestAnimationFrame(tick); }
  function tick(now) {
    frame = 0;
    if (!canRender()) { lastTime = 0; return; }
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.045) : 1 / 60;
    lastTime = now;
    try {
      updateDemo(dt); positionScene(dt); renderer.render(scene, camera);
      const settling = Math.abs(pointer.x - pointer.targetX) + Math.abs(pointer.y - pointer.targetY) + Math.abs(pose.x - pose.targetX) + Math.abs(pose.y - pose.targetY) > 0.0005;
      if (moving() || running || settling) schedule();
      else lastTime = 0;
    } catch { fail(); }
  }
  function suspend() {
    if (!canRender()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; lastTime = 0;
    } else schedule();
  }
  function endDrag(event) {
    if (!dragging || (event && event.pointerId !== dragging.id)) return;
    const id = dragging.id; dragging = null; stage.classList.remove('is-dragging');
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  viewButtons.forEach(button => button.addEventListener('click', () => { if (!running) switchView(button.dataset.labView); }));
  runButton?.addEventListener('click', () => {
    if (!ready || running) return;
    running = true; completed = false; elapsed = 0; delete root.dataset.demoPhase;
    refreshTextures(); highlight(); controls();
    if (reduced.matches) finishDemo();
    else announce('Demo: Java controller → REST API');
    schedule();
  });
  resetButton?.addEventListener('click', () => {
    if (!ready) return;
    endDrag(); running = false; completed = false; elapsed = 0; time = 0;
    delete root.dataset.demoPhase;
    packet.visible = returnPacket.visible = false;
    wires.forEach(wire => { wire.emissiveIntensity = 0.16; });
    pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
    pose.x = pose.y = pose.targetX = pose.targetY = 0;
    switchView('code', false); announce('Workbench reset · Java + Spring Boot.');
  });
  motionButton?.addEventListener('click', () => {
    if (!ready || reduced.matches) return;
    motion = !motion;
    if (!motion) {
      pointer.targetX = pointer.targetY = 0;
      pose.x = pose.targetX; pose.y = pose.targetY;
    }
    try { localStorage.setItem('aditya-portfolio-developer-motion', motion ? 'playing' : 'paused'); } catch {}
    controls(); announce(motion ? 'Ambient motion on.' : 'Ambient motion paused. The demo and views remain available.'); schedule();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!ready || reduced.matches || event.pointerType !== 'mouse' || event.button !== 0 || !fine.matches) return;
    dragging = {id: event.pointerId, x: event.clientX, y: event.clientY, angleX: pose.targetX, angleY: pose.targetY};
    canvas.setPointerCapture(event.pointerId); stage.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (!ready || reduced.matches || event.pointerType !== 'mouse' || !fine.matches) return;
    if (dragging && dragging.id === event.pointerId) {
      pose.targetX = Math.max(-0.095, Math.min(0.14, dragging.angleX + (event.clientY - dragging.y) * 0.001));
      pose.targetY = Math.max(-0.25, Math.min(0.22, dragging.angleY + (event.clientX - dragging.x) * 0.0014));
      schedule();
    } else if (moving()) {
      const bounds = canvas.getBoundingClientRect();
      pointer.targetX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
      pointer.targetY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      schedule();
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!dragging) { pointer.targetX = pointer.targetY = 0; schedule(); } });
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; endDrag();
    fail('The 3D workbench is temporarily unavailable. A still illustration is shown.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    try {
      environment?.dispose(); environmentLighting();
      textures.forEach(texture => { texture.needsUpdate = true; });
      packet.visible = returnPacket.visible = false;
      wires.forEach(wire => { wire.emissiveIntensity = 0.16; });
      refreshTextures(); highlight(); resize(); renderer.render(scene, camera);
      if (renderer.getContext().isContextLost()) throw new Error('Context still unavailable');
      ready = true; root.dataset.renderer = 'webgl'; controls();
      announce('The interactive developer workbench has been restored.'); schedule();
    } catch { fail(); }
  });
  reduced.addEventListener('change', () => {
    endDrag();
    if (reduced.matches && ready) {
      pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
      pose.x = pose.targetX; pose.y = pose.targetY;
      if (running) finishDemo();
    }
    controls(); schedule();
  });
  document.addEventListener('visibilitychange', suspend);
  try {
    buildScene();
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; suspend(); }, {threshold: 0.01});
      intersectionObserver.observe(stage);
    }
    themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  } catch { fail(); }
  window.addEventListener('pagehide', event => {
    if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (!event.persisted) {
      disposed = true;
      resizeObserver?.disconnect(); intersectionObserver?.disconnect(); themeObserver?.disconnect();
      resources.forEach(resource => resource.dispose?.()); textures.forEach(texture => texture.dispose());
      environment?.dispose(); renderer?.dispose();
    }
  });
  window.addEventListener('pageshow', () => { if (!disposed) { lastTime = 0; schedule(); } });
})();
