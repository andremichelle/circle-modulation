import { clamp, NumericStepper, ObservableValueImpl, PrintMapping } from "./lib/common.js";
import { UIControllerLayout } from "./lib/controls.js";
import { HTML } from "./lib/dom.js";
import { TAU } from "./lib/math.js";
export class CircleModulation {
    constructor(mapping, name) {
        this.mapping = mapping;
        this.element = HTML.create('div', { class: 'circle-modulation' });
        this.canvas = HTML.create('canvas');
        this.context = this.canvas.getContext("2d");
        this.resolution = 128;
        this.width = 256;
        this.height = 256;
        this.centerX = 128;
        this.centerY = 128;
        this.radius = 120;
        this.values = new Float32Array(this.resolution);
        this.snapping = new ObservableValueImpl(0);
        this.devicePixelRatio = NaN;
        this.recording = NaN;
        this.angle = 0.0;
        this.angle = 0.0;
        this.recording = NaN;
        const layout = new UIControllerLayout();
        layout.createNumericStepper('Snap', PrintMapping.INTEGER, NumericStepper.Integer).with(this.snapping);
        const footer = HTML.create('footer');
        footer.appendChild(this.createButtonSmooth());
        footer.appendChild(layout.element());
        this.element.appendChild(HTML.create('label', { textContent: name }));
        this.element.appendChild(this.canvas);
        this.element.appendChild(footer);
        const update = () => {
            if (this.devicePixelRatio !== devicePixelRatio) {
                this.devicePixelRatio = devicePixelRatio;
                this.canvas.width = this.width * devicePixelRatio;
                this.canvas.height = this.height * devicePixelRatio;
            }
            this.paint();
            window.requestAnimationFrame(update);
        };
        window.requestAnimationFrame(update);
        this.initEvents(this.canvas);
    }
    get domElement() {
        return this.element;
    }
    createButtonSmooth() {
        const buttonSmooth = document.createElement("button");
        buttonSmooth.textContent = "Smooth";
        buttonSmooth.addEventListener("pointerdown", ignore => {
            this.smooth();
        });
        return buttonSmooth;
    }
    setAngle(value) {
        this.angle = value - Math.floor(value);
        if (this.isRecording()) {
            this.values[Math.floor((this.angle - Math.floor(this.angle)) * this.resolution)] = 1.0 - this.snapValue(this.recording);
        }
    }
    isRecording() {
        return !isNaN(this.recording);
    }
    value() {
        const x = this.angle;
        return this.mapping.y(this.values[Math.floor((x - Math.floor(x)) * this.resolution)]);
    }
    smooth() {
        const values = this.values;
        for (let i = 0; i < this.resolution; i++) {
            const target = (values[this.clampIndex(i - 1)] + values[this.clampIndex(i + 1)]) * 0.5;
            values[i] += (target - values[i]) * 0.5;
        }
    }
    snapValue(x) {
        const value = this.snapping.get();
        if (0 === value) {
            return x;
        }
        return Math.round(x * value) / value;
    }
    clampIndex(index) {
        return index < 0 ? index + this.resolution : index >= this.resolution ? index - this.resolution : index;
    }
    paint() {
        this.context.save();
        this.context.scale(devicePixelRatio, devicePixelRatio);
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.beginPath();
        this.context.strokeStyle = "#777";
        this.context.arc(this.centerX, this.centerY, this.radius + 1.0, 0.0, Math.PI * 2.0, false);
        this.context.stroke();
        const step = TAU / this.resolution;
        const value = this.values[Math.floor(this.angle * this.values.length)];
        this.context.beginPath();
        this.context.fillStyle = "rgba(40, 229, 255, 0.1)";
        this.context.strokeStyle = "#28E5FF";
        const neg_angle = -this.angle * 2.0 * Math.PI;
        {
            const r = this.radius * (1.0 - this.values[0]);
            this.context.moveTo(this.centerX + Math.sin(neg_angle) * r, this.centerY + Math.cos(neg_angle) * r);
        }
        for (let i = 1; i < this.resolution; i++) {
            const a = neg_angle + i * step;
            const r = this.radius * (1.0 - this.values[i]);
            this.context.lineTo(this.centerX + Math.sin(a) * r, this.centerY + Math.cos(a) * r);
        }
        this.context.closePath();
        this.context.stroke();
        this.context.fill();
        this.context.beginPath();
        this.context.strokeStyle = "#28E5FF";
        this.context.setLineDash([1, 2]);
        this.context.moveTo(this.centerX + 0.5, this.centerY);
        this.context.lineTo(this.centerX + 0.5, this.centerY + this.radius);
        this.context.closePath();
        this.context.stroke();
        this.context.setLineDash([]);
        this.context.fillStyle = this.isRecording() ? "red" : "white";
        this.context.arc(this.centerX, this.centerY + this.radius - value * this.radius, 3, 0.0, 2.0 * Math.PI, false);
        this.context.fill();
        this.context.restore();
    }
    initEvents(canvas) {
        const onMove = (event) => {
            const clientRect = canvas.getBoundingClientRect();
            this.recording = clamp(0.0, 1.0, (event.clientY - clientRect.y - this.centerY) / this.radius);
        };
        const onUp = () => {
            this.recording = NaN;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        const onDown = (event) => {
            const clientRect = canvas.getBoundingClientRect();
            const value = (event.clientY - clientRect.y - this.centerY) / this.radius;
            if (0.0 <= value) {
                this.recording = clamp(0.0, 1.0, value);
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
            }
        };
        canvas.addEventListener("pointerdown", onDown);
    }
}
//# sourceMappingURL=circle-modulation.js.map