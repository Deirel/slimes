import { Field } from './field';
import { UI_CONFIG, ToolType } from './ui-config';

export interface PointerPosition {
  x: number;
  y: number;
}

export type PointerHandler = (pos: PointerPosition, tool: ToolType) => void;

export class InputHandler {
  private isDrawing = false;
  private currentTool: ToolType = 'attract';
  
  constructor(
    private canvas: HTMLCanvasElement,
    private field: Field,
    private onDraw: PointerHandler
  ) {
    this.initListeners();
  }
  
  private initListeners() {
    // Pointer Events API - работает для mouse, touch, pen
    this.canvas.addEventListener('pointerdown', this.handleStart.bind(this));
    this.canvas.addEventListener('pointermove', this.handleMove.bind(this));
    this.canvas.addEventListener('pointerup', this.handleEnd.bind(this));
    this.canvas.addEventListener('pointercancel', this.handleEnd.bind(this));
    this.canvas.addEventListener('pointerleave', this.handleEnd.bind(this));
    
    // Предотвращение контекстного меню на долгое нажатие
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    // Отключение скроллинга на touch устройствах
    this.canvas.style.touchAction = 'none';
  }
  
  setTool(tool: ToolType) {
    this.currentTool = tool;
  }
  
  updateField(field: Field) {
    this.field = field;
  }
  
  private toFieldCoords(e: PointerEvent): PointerPosition {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * this.field.width;
    const y = ((e.clientY - rect.top) / rect.height) * this.field.height;
    return { x, y };
  }
  
  private handleStart(e: PointerEvent) {
    this.isDrawing = true;
    const pos = this.toFieldCoords(e);
    this.onDraw(pos, this.currentTool);
  }
  
  private handleMove(e: PointerEvent) {
    if (!this.isDrawing) return;
    const pos = this.toFieldCoords(e);
    this.onDraw(pos, this.currentTool);
  }
  
  private handleEnd() {
    this.isDrawing = false;
  }
}