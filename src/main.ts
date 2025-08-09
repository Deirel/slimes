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
  const vw = Math.max(220, Math.min(520, Math.round(window.innerWidth / 5)));
  const vh = Math.max(140, Math.min(300, Math.round(window.innerHeight / 5)));
  return { w: vw, h: vh };
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
function canvasToFieldCoords(ev: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * field.width;
  const y = ((ev.clientY - rect.top) / rect.height) * field.height;
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

function handleTool(e: MouseEvent) {
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
