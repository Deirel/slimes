import { Field } from './field';
import { AgentSystem } from './agents';
import { HUD } from './hud';
import type { Tool, SimParams } from './types';

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
  memoryInfluence: 0.25,
  memoryDepositFactor: 0.35,
  memoryDecayPerSecond: 0.03,
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
  if (tool === 'attract') field.addCircle(x, y, 13, +0.9);
  else if (tool === 'repel') field.addCircle(x, y, 13, -0.9);
  else if (tool === 'wall') field.drawWallCircle(x, y, 8);
  else if (tool === 'erase') {
    field.eraseWallCircle(x, y, 10);
    field.halveCircle(x, y, 10);
  }
}

// Rendering setup
import { Renderer } from './render';
const renderer = new Renderer();

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

function drifted(paramBase: number, amp: number, period: number, t: number): number {
  return paramBase + amp * Math.sin((2 * Math.PI * t) / period);
}

// Main loop
function frame(now: number) {
  const dtRaw = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(0.05, dtRaw) * tempo;
  if (!paused) {
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
