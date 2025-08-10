import { Field } from './field';
import { AgentSystem } from './agents';
import { HUD } from './hud';
import type { SimParams } from './types';
import { GoalPlanner, type UpdateResult } from './goals';
import { UI_CONFIG, ToolType } from './ui-config';
import { APP_CONFIG } from './app-config';
import { InputHandler } from './input-handler';
import { UIController } from './ui-controller';
import { UIBuilder } from './ui-builder';
import { VisualEffects } from './visual-effects';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const hud = new HUD(hudEl);

// Динамическое создание UI по новой row-based системе
const uiBuilder = new UIBuilder('ui-rows');
let uiElements = uiBuilder.render(UI_CONFIG, []);
const uiController = new UIController(uiElements);

// Debug: scroll/viewport diagnostics
function attachRowEventDebugging(rows: HTMLElement[]) {
  rows.forEach((row) => {
    if ((row as any)._debugHandlersAttached) return;
    (row as any)._debugHandlersAttached = true;
    const log = (type: string, ev: Event) => {
      const anyEv = ev as any;
      // eslint-disable-next-line no-console
      console.log(`[scroll-debug] event ${type}`, {
        type,
        target: (ev.target as HTMLElement)?.className,
        cancelable: ev.cancelable,
        defaultPrevented: ev.defaultPrevented,
        passive: anyEv?.passive ?? undefined,
        pointerType: anyEv?.pointerType,
        buttons: anyEv?.buttons,
        deltaX: anyEv?.deltaX,
        deltaY: anyEv?.deltaY,
        scrollLeft: (row as HTMLElement).scrollLeft,
      });
    };
    row.addEventListener('pointerdown', (e) => log('pointerdown', e), { passive: true });
    row.addEventListener('pointermove', (e) => log('pointermove', e), { passive: true });
    row.addEventListener('pointerup', (e) => log('pointerup', e), { passive: true });
    row.addEventListener('pointercancel', (e) => log('pointercancel', e), { passive: true });
    row.addEventListener('touchstart', (e) => log('touchstart', e), { passive: true });
    row.addEventListener('touchmove', (e) => log('touchmove', e), { passive: true });
    row.addEventListener('wheel', (e) => log('wheel', e), { passive: true });
    row.addEventListener('scroll', (e) => log('scroll', e));
  });
}

function logScrollDiagnostics(context: string) {
  try {
    const rowsContainer = document.getElementById('ui-rows');
    const rows = Array.from(document.querySelectorAll('.ui-row')) as HTMLElement[];
    const vp = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      docClientW: document.documentElement?.clientWidth,
      docClientH: document.documentElement?.clientHeight,
    };
    const env = {
      userAgent: navigator.userAgent,
      cssSupportsPanX: CSS.supports('touch-action', 'pan-x'),
      bodyTouchAction: getComputedStyle(document.body).getPropertyValue('touch-action') || (getComputedStyle(document.body) as any).touchAction,
      canvasZ: getComputedStyle(canvas).zIndex,
    };
    const canvasRect = canvas.getBoundingClientRect();
    const uiRect = rowsContainer?.getBoundingClientRect();
    // eslint-disable-next-line no-console
    console.group(`[scroll-debug] ${context}`);
    // eslint-disable-next-line no-console
    console.log('viewport', vp);
    // eslint-disable-next-line no-console
    console.log('env', env);
    // eslint-disable-next-line no-console
    console.log('canvas rect', canvasRect);
    // eslint-disable-next-line no-console
    console.log('ui-rows rect', uiRect);
    rows.forEach((row, idx) => {
      const cs = getComputedStyle(row);
      const info = {
        index: idx,
        clientWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
        offsetWidth: row.offsetWidth,
        overflowX: cs.overflowX,
        flexWrap: cs.flexWrap,
        gap: cs.columnGap || cs.gap,
        touchAction: (cs as any).touchAction || cs.getPropertyValue('touch-action'),
        hasOverflow: row.scrollWidth > row.clientWidth,
        childCount: row.children.length,
      } as const;
      // probe programmatic scroll
      const before = row.scrollLeft;
      row.scrollLeft = before + 40;
      const after = row.scrollLeft;
      row.scrollLeft = before;
      const childWidths = Array.from(row.children).map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return Math.round(r.width);
      });
      // eslint-disable-next-line no-console
      console.log(`row#${idx}`, info, { childWidths, programmaticScrollWorked: after !== before, before, after });
      // Try pointer capture toggle on the row's children to see if any capture prevents scroll
      const firstChild = row.children[0] as HTMLElement | undefined;
      if (firstChild) {
        const handler = (ev: PointerEvent) => {
          try {
            if ((ev.target as HTMLElement)?.hasPointerCapture?.(ev.pointerId)) {
              (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
            }
          } catch {}
        };
        firstChild.addEventListener('pointerdown', handler, { passive: true, once: true });
      }
    });
    // hit-test a point in the row area (if present)
    if (uiRect) {
      const testX = Math.round(uiRect.left + Math.min(30, uiRect.width / 3));
      const testY = Math.round(uiRect.top + uiRect.height / 2);
      const el = document.elementFromPoint(testX, testY) as HTMLElement | null;
      // eslint-disable-next-line no-console
      console.log('elementFromPoint in row area', { x: testX, y: testY, tag: el?.tagName, class: el?.className });
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[scroll-debug] failed', e);
  }
}

uiController.on('openPathChange', (openPath) => {
  uiElements = uiBuilder.render(UI_CONFIG, openPath);
  uiController.setElements(uiElements);
  attachRowEventDebugging(Array.from(document.querySelectorAll('.ui-row')) as HTMLElement[]);
  logScrollDiagnostics('after openPathChange render');
});

let field = new Field(320, 180);

function chooseAdaptiveResolution() {
  const cellSize = APP_CONFIG.canvas.cellSize;
  // Вычесть фактическую высоту UI строк
  const uiEl = document.getElementById('ui-rows');
  const toolbarHeight = uiEl ? uiEl.getBoundingClientRect().height : 0;
  
  const w = Math.round(window.innerWidth / cellSize);  
  const h = Math.round((window.innerHeight - toolbarHeight) / cellSize);
  
  return { 
    w: Math.max(APP_CONFIG.canvas.minFieldWidth, w), 
    h: Math.max(APP_CONFIG.canvas.minFieldHeight, h) 
  };
}

function resizeFieldToAdaptive() {
  const { w, h } = chooseAdaptiveResolution();
  field = new Field(w, h);
}

resizeFieldToAdaptive();

// Input handler setup
const inputHandler = new InputHandler(canvas, field, (pos, tool) => {
  const config: any = (APP_CONFIG.tools as any)[tool];
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
uiController.on('toolChange', (tool) => { inputHandler.setTool(tool); });

// Popup event handlers
uiController.on('popupAction', (action, popupId, itemId) => {
  if (popupId === 'root') {
    if (itemId === 'reset') resetScene(true);
    if (itemId === 'reseed') reseedAll();
    return;
  }
  if (popupId === 'advanced') {
    if (itemId === 'save') console.log('Save state requested');
    if (itemId === 'load') console.log('Load state requested');
  }
  if (popupId === 'effects') {
    if (itemId === 'rainbow') console.log('Rainbow mode toggled');
    if (itemId === 'trails') console.log('Long trails mode toggled');
  }
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

 // Initial state: neutral field (dark), no random walls
 field.clearValues();
 agents.reseedAgents();


// Rendering setup
import { Renderer } from './render';
const renderer = new Renderer();
const goals = new GoalPlanner();
const visualEffects = new VisualEffects();

function resizeCanvasToViewport() {
  const dpr = Math.max(1, Math.min(APP_CONFIG.canvas.maxDPR, window.devicePixelRatio || 1));
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
  attachRowEventDebugging(Array.from(document.querySelectorAll('.ui-row')) as HTMLElement[]);
  logScrollDiagnostics('after resize');
});

resizeCanvasToViewport();
attachRowEventDebugging(Array.from(document.querySelectorAll('.ui-row')) as HTMLElement[]);
logScrollDiagnostics('initial');

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
  const dpr = Math.max(1, Math.min(APP_CONFIG.canvas.maxDPR, window.devicePixelRatio || 1));
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

  // Show current tool id as title for now; can be mapped via UI_CONFIG if needed
  hud.update(now, field, agents, uiController.currentTool);
  requestAnimationFrame(frame);
}


requestAnimationFrame(frame);
