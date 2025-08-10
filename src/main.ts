import { Field } from './field';
import { AgentSystem } from './agents';
import { HUD } from './hud';
import type { Tool, SimParams } from './types';
import { GoalPlanner, type RenderOverlay, type UpdateResult } from './goals';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const hud = new HUD(hudEl);

const toolButtons = {
  attract: document.getElementById('tool-attract') as HTMLButtonElement,
  repel: document.getElementById('tool-repel') as HTMLButtonElement,
  wall: document.getElementById('tool-wall') as HTMLButtonElement,
  erase: document.getElementById('tool-erase') as HTMLButtonElement,
};
const tempoInput = document.getElementById('tempo') as HTMLInputElement;
const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
const resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
const reseedBtn = document.getElementById('btn-reseed') as HTMLButtonElement;

let tool: Tool = 'attract';
let isDrawing = false;
let paused = false;
let tempo = 1;

function setTool(t: Tool) {
  tool = t;
  for (const [k, btn] of Object.entries(toolButtons) as [Tool, HTMLButtonElement][]) {
    btn.classList.toggle('active', k === t);
  }
}

for (const [name, btn] of Object.entries(toolButtons) as [Tool, HTMLButtonElement][]) {
  btn.addEventListener('click', () => setTool(name));
}

window.addEventListener('keydown', (e) => {
  if (e.key === '1') setTool('attract');
  else if (e.key === '2') setTool('repel');
  else if (e.key === '3') setTool('wall');
  else if (e.key === '4') setTool('erase');
  else if (e.key.toLowerCase() === 'p') togglePause();
});

tempoInput.addEventListener('input', () => {
  tempo = parseFloat(tempoInput.value);
});

pauseBtn.addEventListener('click', () => togglePause());

function togglePause() {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Продолжить' : 'Пауза';
}

let field = new Field(320, 180);

function chooseAdaptiveResolution() {
  const cellSize = 5; // пикселей на клетку (сохраняем текущий размер клеток)
  
  // Вычесть высоту панели управления на мобильных
  const isMobile = window.innerWidth <= 768 || window.innerHeight <= 600;
  const toolbarHeight = isMobile ? 60 : 0;
  
  const w = Math.round(window.innerWidth / cellSize);  
  const h = Math.round((window.innerHeight - toolbarHeight) / cellSize);
  
  // Только минимальные ограничения для игрового процесса
  const minW = 60;  // минимум для интерфейса
  const minH = 60;  // минимум для интерфейса
  
  return { 
    w: Math.max(minW, w), 
    h: Math.max(minH, h) 
  };
}

function resizeFieldToAdaptive() {
  const { w, h } = chooseAdaptiveResolution();
  field = new Field(w, h);
}

resizeFieldToAdaptive();

const params: SimParams = {
  diffusionBase: 0.22,
  evaporationBase: 0.035,
  diffusionDriftAmp: 0.07,
  evaporationDriftAmp: 0.02,
  diffusionDriftPeriod: 23,
  evaporationDriftPeriod: 31,
  sensorOffset: 10,
  sensorAngle: 0.55,
  sensorRadius: 2,
  speed: 30,
  turnSpeed: 8,
  turnNoise: 0.25,
  depositPerStep: 1.1,
  fieldMin: -2.5,
  fieldMax: 2.5,
  // Iteration 01: hidden memory layer tuning
  memoryInfluence: 0.2,
  memoryDepositFactor: 0.25,
  memoryDecayPerSecond: 0.08,
  // Iteration 02 — latent flow tuning
  flowInfluence: 0.4,
  flowDepositPerSecond: 0.9,
  flowDecayPerSecond: 0.12,
  flowMaxMagnitude: 2.0,
};

const agents = new AgentSystem(field, params);

 // Removed random horizontal barriers generation

 function resetScene(keepWalls: boolean) {
   if (!keepWalls) field.clearWalls();
   else field.clearValues();
   // Start from a neutral field to avoid washed background
   field.clearValues();
   agents.reseedAgents();
 }

 function reseedAll() {
   field.clearWalls();
   field.clearValues();
   // Neutral field for clarity
   field.clearValues();
   agents.reseedAgents();
 }

resetBtn.addEventListener('click', () => resetScene(true));
reseedBtn.addEventListener('click', () => reseedAll());

 // Initial state: neutral field (dark), no random walls
 field.clearValues();
 agents.reseedAgents();

// Input drawing
function canvasToFieldCoords(ev: MouseEvent | TouchEvent) {
  const rect = canvas.getBoundingClientRect();
  let clientX: number, clientY: number;
  
  if (ev instanceof TouchEvent) {
    const touch = ev.touches[0] || ev.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = ev.clientX;
    clientY = ev.clientY;
  }
  
  const x = ((clientX - rect.left) / rect.width) * field.width;
  const y = ((clientY - rect.top) / rect.height) * field.height;
  return { x, y };
}

canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  handleTool(e);
});
window.addEventListener('mouseup', () => (isDrawing = false));
canvas.addEventListener('mouseleave', () => (isDrawing = false));
canvas.addEventListener('mousemove', (e) => {
  if (isDrawing) handleTool(e);
});

// Touch events support for mobile devices
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault(); // Prevent scrolling
  isDrawing = true;
  handleTool(e);
});
window.addEventListener('touchend', () => (isDrawing = false));
canvas.addEventListener('touchcancel', () => (isDrawing = false));
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault(); // Prevent scrolling
  if (isDrawing) handleTool(e);
});

function handleTool(e: MouseEvent | TouchEvent) {
  const { x, y } = canvasToFieldCoords(e);
  if (tool === 'attract') field.addCircle(x, y, 8, +0.9);
  else if (tool === 'repel') {
    field.addCircle(x, y, 8, -0.9);
    // Leave a short-lived negative memory to keep agents from immediately overwriting the path
    field.addMemoryCircle(x, y, 8, -0.6);
  }
  else if (tool === 'wall') field.drawWallCircle(x, y, 8);
  else if (tool === 'erase') {
    field.eraseWallCircle(x, y, 10);
    field.halveCircle(x, y, 10);
  }
}

// Rendering setup
import { Renderer } from './render';
const renderer = new Renderer();
const goals = new GoalPlanner();

type Pulse = { x: number; y: number; age: number; duration: number; startR: number; endR: number };
const pulses: Pulse[] = [];
let dashPhase = 0; // for marching-ants indication
let arrowPhase = 0; // for flowing direction chevrons
let progressSpeed = 0; // smoothed 0..1 for hint animation speed

function resizeCanvasToViewport() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

window.addEventListener('resize', () => {
  resizeCanvasToViewport();
  resizeFieldToAdaptive();
  agents.field = field;
  agents.reseedAgents();
});

resizeCanvasToViewport();

let lastTime = performance.now();
let acc = 0;
let simTimeSec = 0; // advances only when not paused (used by goals)

function drifted(paramBase: number, amp: number, period: number, t: number): number {
  return paramBase + amp * Math.sin((2 * Math.PI * t) / period);
}

// Main loop
function drawOverlay(ctx: CanvasRenderingContext2D, overlay: RenderOverlay, progressRatio: number) {
  // Draw in field pixel space (caller ensures scaling)
  ctx.save();
  ctx.lineWidth = 1;
  for (const c of overlay.circles) {
    ctx.beginPath();
    const a = Math.max(0, Math.min(1, c.alpha * (0.35 + 0.65 * progressRatio)));
    ctx.strokeStyle = `rgba(180,220,255,${a})`;
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const l of overlay.lines) {
    ctx.beginPath();
    const a = Math.max(0, Math.min(1, l.alpha * (0.35 + 0.65 * progressRatio)));
    ctx.strokeStyle = `rgba(180,220,255,${a})`;
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPulses(ctx: CanvasRenderingContext2D, dt: number) {
  ctx.save();
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.age += dt;
    const t = Math.max(0, Math.min(1, p.age / p.duration));
    const r = p.startR + (p.endR - p.startR) * t;
    const alpha = (1 - t) * 0.9;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(210,240,255,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (p.age >= p.duration) pulses.splice(i, 1);
  }
  ctx.restore();
}

function drawProgressingStyle(ctx: CanvasRenderingContext2D, dt: number, overlay: RenderOverlay) {
  if (dt <= 0 || progressSpeed <= 0) return;
  // advance smoothly without modulo to avoid visible wrap-back
  dashPhase += dt * 60 * progressSpeed; // field-space units
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.lineDashOffset = dashPhase;
  ctx.lineWidth = 1;
  const alpha = Math.max(0, Math.min(1, 0.95 * progressSpeed));
  if (alpha <= 0.01) { ctx.restore(); return; }
  ctx.strokeStyle = `rgba(220,250,255,${alpha})`;
  for (const c of overlay.circles) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const l of overlay.lines) {
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDirectionHints(ctx: CanvasRenderingContext2D, dt: number, overlay: RenderOverlay, progressRatio: number) {
  // Always show subtle direction on lines (connect_nodes), brighter with progress
  if (dt > 0 && progressSpeed > 0) arrowPhase += dt * 40 * progressSpeed;
  ctx.save();
  for (const l of overlay.lines) {
    const vx = l.x2 - l.x1;
    const vy = l.y2 - l.y1;
    const len = Math.hypot(vx, vy) || 1;
    const nx = vx / len; const ny = vy / len;
    const spacing = 12; // px along field
    const size = 2.5;   // chevron size in px
    const baseAlpha = 0.28;
    const a = Math.max(0, Math.min(1, (baseAlpha + 0.55 * progressRatio)));
    const offset = (arrowPhase % spacing);
    for (let d = offset; d < len; d += spacing) {
      const px = l.x1 + nx * d;
      const py = l.y1 + ny * d;
      // Build a tiny triangle pointing along (nx, ny)
      const tx = -ny; const ty = nx; // perpendicular
      ctx.beginPath();
      ctx.moveTo(px + nx * size, py + ny * size);
      ctx.lineTo(px - nx * size + tx * size * 0.7, py - ny * size + ty * size * 0.7);
      ctx.lineTo(px - nx * size - tx * size * 0.7, py - ny * size - ty * size * 0.7);
      ctx.closePath();
      ctx.fillStyle = `rgba(200,235,255,${a})`;
      ctx.fill();
    }
  }
  ctx.restore();
}

function frame(now: number) {
  const dtRaw = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(0.05, dtRaw) * tempo;
  if (!paused) {
    simTimeSec += dt;
    // do two substeps for stability
    const subDt = dt / 2;

    const timeSec = now / 1000;
    const diffusion = drifted(params.diffusionBase, params.diffusionDriftAmp, params.diffusionDriftPeriod, timeSec);
    const evaporation = drifted(params.evaporationBase, params.evaporationDriftAmp, params.evaporationDriftPeriod, timeSec);

    for (let i = 0; i < 2; i++) {
      agents.update(subDt);
      field.diffuseAndEvaporate(diffusion * subDt, evaporation * subDt, 1);
      // Iteration 01: decay memory slowly over time (exp-style)
      field.decayMemory(Math.min(0.95, params.memoryDecayPerSecond * subDt));
      // Iteration 02: decay latent flow vectors over time
      field.decayFlow(Math.min(0.95, params.flowDecayPerSecond * subDt));
    }
  }

  // render field to image at field resolution then draw scaled
  renderer.resize(field.width, field.height);
  renderer.renderField(field, agents.agents, now);

  // upscale to full view
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const scaleX = canvas.width / field.width;
  const scaleY = canvas.height / field.height;
  const ctx = (canvas.getContext('2d') as CanvasRenderingContext2D);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.drawImage((renderer as any).buffer, 0, 0);

  // Iteration 03: micro-goals planner and subtle hints overlay
  const nowSec = simTimeSec;
  const dtForGoals = paused ? 0 : dt;
  const result: UpdateResult = goals.update(nowSec, dtForGoals, field);
  drawOverlay(ctx, result.overlay, result.progressRatio);
  // Direction chevrons along connect_nodes line — help discover required flow direction
  drawDirectionHints(ctx, paused ? 0 : dt, result.overlay, result.progressRatio);
  // Smooth the animation speed to avoid jitter due to fluctuating progress
  if (!paused) {
    const targetSpeed = result.progressing ? Math.max(0, Math.min(1, result.progressRatio)) : 0;
    progressSpeed += (targetSpeed - progressSpeed) * 0.2; // exponential smoothing
  }
  drawProgressingStyle(ctx, paused ? 0 : dt, result.overlay);
  if (result.completed && result.successTargets) {
    for (const t of result.successTargets) {
      pulses.push({ x: t.x, y: t.y, age: 0, duration: 0.8, startR: 4, endR: 22 });
    }
  }
  drawPulses(ctx, paused ? 0 : dt);

  ctx.restore();

  hud.update(now, field, agents, toolName(tool));
  requestAnimationFrame(frame);
}

function toolName(t: Tool): string {
  switch (t) {
    case 'attract': return 'Притяжение';
    case 'repel': return 'Отталкивание';
    case 'wall': return 'Стена';
    case 'erase': return 'Ластик';
  }
}

requestAnimationFrame(frame);
