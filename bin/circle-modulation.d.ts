import { ValueMapping } from "./lib/mapping.js";
export declare class CircleModulation {
    private readonly mapping;
    private readonly element;
    private readonly canvas;
    private readonly context;
    private readonly resolution;
    private readonly width;
    private readonly height;
    private readonly centerX;
    private readonly centerY;
    private readonly radius;
    private readonly values;
    private readonly snapping;
    private devicePixelRatio;
    private recording;
    private angle;
    constructor(mapping: ValueMapping<any>, name: string);
    get domElement(): HTMLElement;
    createButtonSmooth(): HTMLButtonElement;
    setAngle(value: number): void;
    isRecording(): boolean;
    value(): number;
    smooth(): void;
    snapValue(x: number): number;
    clampIndex(index: number): number;
    paint(): void;
    initEvents(canvas: any): void;
}
