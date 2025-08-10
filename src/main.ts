import { Field } from './field';
import { AgentSystem } from './agents';
import { HUD } from './hud';
import type { SimParams } from './types';
import { GoalPlanner, type UpdateResult } from './goals';
import { UI_CONFIG, ToolType } from './ui-config';
import { InputHandler } from './input-handler';
import { UIController } from './ui-controller';
import { VisualEffects } from './visual-effects';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const hud = new HUD(hudEl);

// UI Controller setup
const uiController = new UIController({
  toolButtons: {
    attract: document.getElementById('tool-attract') as HTMLButtonElement,
    repel: document.getElementById('tool-repel') as HTMLButtonElement,
    wall: document.getElementById('tool-wall') as HTMLButtonElement,
    erase: document.getElementById('tool-erase') as HTMLButtonElement,
  },
  pauseBtn: document.getElementById('btn-pause') as HTMLButtonElement,
  resetBtn: document.getElementById('btn-reset') as HTMLButtonElement,
  reseedBtn: document.getElementById('btn-reseed') as HTMLButtonElement,
  tempoInput: document.getElementById('tempo') as HTMLInputElement
});

let field = new Field(320, 180);

function chooseAdaptiveResolution() {
  const cellSize = UI_CONFIG.canvas.cellSize;
  
  // Вычесть высоту панели управления на мобильных
  const isMobile = window.innerWidth <= UI_CONFIG.mobile.breakpoint || window.innerHeight <= 600;
  const toolbarHeight = isMobile ? UI_CONFIG.mobile.toolbarHeight : 0;
  
  const w = Math.round(window.innerWidth / cellSize);  
  const h = Math.round((window.innerHeight - toolbarHeight) / cellSize);
  
  return { 
    w: Math.max(UI_CONFIG.canvas.minFieldWidth, w), 
    h: Math.max(UI_CONFIG.canvas.minFieldHeight, h) 
  };
}

function resizeFieldToAdaptive() {
  const { w, h } = chooseAdaptiveResolution();
  field = new Field(w, h);
}

resizeFieldToAdaptive();

// Input handler setup
const inputHandler = new InputHandler(canvas, field, (pos, tool) => {
  const config = UI_CONFIG.tools[tool];
  if (tool === 'attract') {
    field.addCircle(pos.x, pos.y, config.radius, config.strength);
  } else if (tool === 'repel') {
    field.addCircle(pos.x, pos.y, config.radius, config.strength);
    field.addMemoryCircle(pos.x, pos.y, config.radius, config.memoryStrength);
  } else if (tool === 'wall') {
    field.drawWallCircle(pos.x, pos.y, config.radius);
  } else if (tool === 'erase') {
    field.eraseWallCircle(pos.x, pos.y, config.radius);
    field.halveCircle(pos.x, pos.y, config.halveRadius);
  }
});

// UI Controller event handlers
uiController.on('toolChange', (tool) => {
  inputHandler.setTool(tool);
});

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

// Bind reset and reseed buttons
uiController.bindResetButton(() => resetScene(true));
uiController.bindReseedButton(() => reseedAll());

 // Initial state: neutral field (dark), no random walls
 field.clearValues();
 agents.reseedAgents();


// Rendering setup
import { Renderer } from './render';
const renderer = new Renderer();
const goals = new GoalPlanner();
const visualEffects = new VisualEffects();

function resizeCanvasToViewport() {
  const dpr = Math.max(1, Math.min(UI_CONFIG.canvas.maxDPR, window.devicePixelRatio || 1));
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
  inputHandler.updateField(field);
});

resizeCanvasToViewport();

let lastTime = performance.now();
let acc = 0;
let simTimeSec = 0; // advances only when not paused (used by goals)

function drifted(paramBase: number, amp: number, period: number, t: number): number {
  return paramBase + amp * Math.sin((2 * Math.PI * t) / period);
}

// Main loop
function frame(now: number) {
  const dtRaw = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(0.05, dtRaw) * uiController.currentTempo;
  if (!uiController.isPaused) {
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
  const dpr = Math.max(1, Math.min(UI_CONFIG.canvas.maxDPR, window.devicePixelRatio || 1));
  const scaleX = canvas.width / field.width;
  const scaleY = canvas.height / field.height;
  const ctx = (canvas.getContext('2d') as CanvasRenderingContext2D);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.drawImage((renderer as any).buffer, 0, 0);

  // Iteration 03: micro-goals planner and subtle hints overlay
  const nowSec = simTimeSec;
  const dtForGoals = uiController.isPaused ? 0 : dt;
  const result: UpdateResult = goals.update(nowSec, dtForGoals, field);
  
  // Update and render visual effects
  const targetSpeed = result.progressing ? Math.max(0, Math.min(1, result.progressRatio)) : 0;
  visualEffects.update(uiController.isPaused ? 0 : dt, targetSpeed);
  visualEffects.render(ctx, result.overlay, result.progressRatio);
  
  // Add pulses for completed goals
  if (result.completed && result.successTargets) {
    for (const t of result.successTargets) {
      visualEffects.addPulse(t.x, t.y);
    }
  }

  ctx.restore();

  hud.update(now, field, agents, UI_CONFIG.tools[uiController.currentTool].title);
  requestAnimationFrame(frame);
}


requestAnimationFrame(frame);
