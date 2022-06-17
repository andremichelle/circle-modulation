import {clamp, NumericStepper, ObservableValue, ObservableValueImpl, PrintMapping} from "./lib/common.js"
import {UIControllerLayout} from "./lib/controls.js"
import {HTML} from "./lib/dom.js"
import {ValueMapping} from "./lib/mapping.js"
import {TAU} from "./lib/math.js"

export class CircleModulation {
    private readonly element: HTMLElement = HTML.create('div', {class: 'circle-modulation'})
    private readonly canvas: HTMLCanvasElement = HTML.create('canvas')
    private readonly context: CanvasRenderingContext2D = this.canvas.getContext("2d")

    private readonly resolution: number = 128
    private readonly width: number = 256
    private readonly height: number = 256
    private readonly centerX: number = 128
    private readonly centerY: number = 128
    private readonly radius: number = 120
    private readonly values: Float32Array = new Float32Array(this.resolution)
    private readonly snapping: ObservableValue<number> = new ObservableValueImpl<number>(0)

    private devicePixelRatio: number = NaN
    private recording: number = NaN
    private angle: number = 0.0

    constructor(private readonly mapping: ValueMapping<any>, name: string) {
        this.angle = 0.0
        this.recording = NaN

        const layout = new UIControllerLayout()
        layout.createNumericStepper('Snap', PrintMapping.INTEGER, NumericStepper.Integer).with(this.snapping)

        const footer = HTML.create('footer')
        footer.appendChild(this.createButtonSmooth())
        footer.appendChild(layout.element())

        this.element.appendChild(HTML.create('label', {textContent: name}))
        this.element.appendChild(this.canvas)
        this.element.appendChild(footer)

        const update = (): void => {
            if (this.devicePixelRatio !== devicePixelRatio) {
                this.devicePixelRatio = devicePixelRatio
                this.canvas.width = this.width * devicePixelRatio
                this.canvas.height = this.height * devicePixelRatio
            }
            this.paint()
            window.requestAnimationFrame(update)
        }
        window.requestAnimationFrame(update)

        this.initEvents(this.canvas)
    }

    get domElement(): HTMLElement {
        return this.element
    }

    createButtonSmooth() {
        const buttonSmooth = document.createElement("button")
        buttonSmooth.textContent = "Smooth"
        buttonSmooth.addEventListener("pointerdown", ignore => {
            this.smooth()
        })
        return buttonSmooth
    }

    setAngle(value: number): void {
        this.angle = value - Math.floor(value)

        if (this.isRecording()) {
            this.values[Math.floor((this.angle - Math.floor(this.angle)) * this.resolution)] = 1.0 - this.snapValue(this.recording)
        }
    }

    isRecording(): boolean {
        return !isNaN(this.recording)
    }

    value(): number {
        const x = this.angle
        return this.mapping.y(this.values[Math.floor((x - Math.floor(x)) * this.resolution)])
    }

    smooth(): void {
        const values = this.values
        for (let i = 0; i < this.resolution; i++) {
            const target = (values[this.clampIndex(i - 1)] + values[this.clampIndex(i + 1)]) * 0.5
            values[i] += (target - values[i]) * 0.5
        }
    }

    snapValue(x: number): number {
        const value = this.snapping.get()
        if (0 === value) {
            return x
        }
        return Math.round(x * value) / value
    }

    clampIndex(index: number): number {
        return index < 0 ? index + this.resolution : index >= this.resolution ? index - this.resolution : index
    }

    paint(): void {
        this.context.save()
        this.context.scale(devicePixelRatio, devicePixelRatio)
        this.context.clearRect(0, 0, this.width, this.height)

        this.context.beginPath()
        this.context.strokeStyle = "#777"
        this.context.arc(this.centerX, this.centerY, this.radius + 1.0, 0.0, Math.PI * 2.0, false)
        this.context.stroke()

        const step = TAU / this.resolution
        const value = this.values[Math.floor(this.angle * this.values.length)]

        this.context.beginPath()
        this.context.fillStyle = "rgba(40, 229, 255, 0.1)"
        this.context.strokeStyle = "#28E5FF"
        const neg_angle = -this.angle * 2.0 * Math.PI
        {
            const r = this.radius * (1.0 - this.values[0])
            this.context.moveTo(this.centerX + Math.sin(neg_angle) * r, this.centerY + Math.cos(neg_angle) * r)
        }
        for (let i = 1; i < this.resolution; i++) {
            const a = neg_angle + i * step
            const r = this.radius * (1.0 - this.values[i])
            this.context.lineTo(this.centerX + Math.sin(a) * r, this.centerY + Math.cos(a) * r)
        }
        this.context.closePath()
        this.context.stroke()
        this.context.fill()

        this.context.beginPath()
        this.context.strokeStyle = "#28E5FF"
        this.context.setLineDash([1, 2])
        this.context.moveTo(this.centerX + 0.5, this.centerY)
        this.context.lineTo(this.centerX + 0.5, this.centerY + this.radius)
        this.context.closePath()
        this.context.stroke()
        this.context.setLineDash([])
        this.context.fillStyle = this.isRecording() ? "red" : "white"
        this.context.arc(this.centerX, this.centerY + this.radius - value * this.radius, 3, 0.0, 2.0 * Math.PI, false)
        this.context.fill()
        this.context.restore()
    }

    initEvents(canvas) {
        const onMove = (event: PointerEvent) => {
            const clientRect = canvas.getBoundingClientRect()
            this.recording = clamp(0.0, 1.0, (event.clientY - clientRect.y - this.centerY) / this.radius)
        }
        const onUp = () => {
            this.recording = NaN
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
        }
        const onDown = (event: PointerEvent) => {
            const clientRect = canvas.getBoundingClientRect()
            const value = (event.clientY - clientRect.y - this.centerY) / this.radius
            if (0.0 <= value) {
                this.recording = clamp(0.0, 1.0, value)
                window.addEventListener("pointermove", onMove)
                window.addEventListener("pointerup", onUp)
            }
        }
        canvas.addEventListener("pointerdown", onDown)
    }
}