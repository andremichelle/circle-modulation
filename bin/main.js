var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { LimiterWorklet } from "./audio/limiter/worklet.js";
import { MeterWorklet, StereoMeterWorklet } from "./audio/meter/worklet.js";
import { MetronomeWorklet } from "./audio/metronome/worklet.js";
import { Fragmentation, Sequencer } from "./audio/sequencing.js";
import { CircleModulation } from "./circle-modulation.js";
import { Boot, newAudioContext, preloadImagesOfCssFile } from "./lib/boot.js";
import { NumericStepper, ObservableValueImpl, PrintMapping } from "./lib/common.js";
import { UIControllerLayout } from "./lib/controls.js";
import { HTML } from "./lib/dom.js";
import { Exp, Linear } from "./lib/mapping.js";
const showProgress = (() => {
    const progress = document.querySelector("svg.preloader");
    window.onerror = () => progress.classList.add("error");
    window.onunhandledrejection = () => progress.classList.add("error");
    return (percentage) => progress.style.setProperty("--percentage", percentage.toFixed(2));
})();
const context = newAudioContext();
const loadAudio = (path) => {
    return fetch(path).then(x => x.arrayBuffer()).then(x => context.decodeAudioData(x));
};
(() => __awaiter(void 0, void 0, void 0, function* () {
    console.debug("booting...");
    const boot = new Boot();
    boot.addObserver(boot => showProgress(boot.normalizedPercentage()));
    boot.registerProcess(preloadImagesOfCssFile("./bin/main.css"));
    boot.registerProcess(LimiterWorklet.loadModule(context));
    boot.registerProcess(MeterWorklet.loadModule(context));
    boot.registerProcess(MetronomeWorklet.loadModule(context));
    const impulse = boot.registerProcess(loadAudio('./files/impulse-reverb.wav'));
    const kick = boot.registerProcess(loadAudio('./files/kick.wav'));
    const ride = boot.registerProcess(loadAudio('./files/ride.wav'));
    yield boot.waitForCompletion();
    const meterWorklet = new StereoMeterWorklet(context);
    const limiterWorklet = new LimiterWorklet(context);
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    const masterGain = context.createGain();
    masterGain.gain.value = 0.0;
    const oscGain = context.createGain();
    oscGain.gain.value = 0.3;
    const reverb = context.createConvolver();
    reverb.buffer = impulse.get();
    const wet = context.createGain();
    const dry = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.start();
    oscillator.connect(lowpass);
    lowpass.connect(dry).connect(oscGain).connect(masterGain);
    lowpass.connect(reverb).connect(wet).connect(oscGain).connect(masterGain);
    masterGain.connect(limiterWorklet).connect(meterWorklet).connect(context.destination);
    const bpm = new ObservableValueImpl(120);
    const playing = new ObservableValueImpl(false);
    const kickEnabled = new ObservableValueImpl(true);
    const rideEnabled = new ObservableValueImpl(false);
    const main = HTML.query('main');
    const meter = meterWorklet.domElement;
    meter.style.left = '50%';
    meter.style.transform = 'translate(-50%, 24px)';
    meter.style.top = '0';
    meter.style.left = '50%';
    meter.style.position = 'absolute';
    main.appendChild(meter);
    const oscFreqMod = new CircleModulation(new Exp(20.0, 2000.0), "Frequency");
    const lowpassFreqMod = new CircleModulation(new Exp(200.0, 18000.0), "Lowpass");
    const lowpassResMod = new CircleModulation(new Linear(0.0, 20.0), "Q");
    const reverbMod = new CircleModulation(new Linear(0.0, 1.0), "Reverb");
    const modulations = [oscFreqMod, lowpassFreqMod, lowpassResMod, reverbMod];
    const modulationContainer = HTML.create('div', { class: 'modulations' });
    modulations.forEach(modulation => modulationContainer.appendChild(modulation.domElement));
    const controllerLayout = new UIControllerLayout();
    controllerLayout.createNumericStepper('bpm', PrintMapping.INTEGER, NumericStepper.Integer).with(bpm);
    controllerLayout.createCheckbox('play').with(playing);
    controllerLayout.createCheckbox('kick').with(kickEnabled);
    controllerLayout.createCheckbox('ride').with(rideEnabled);
    main.appendChild(controllerLayout.element());
    main.appendChild(modulationContainer);
    const sequencer = new Sequencer(context, bpm);
    const modulationFrag = new Fragmentation();
    modulationFrag.scale.set(1.0 / 128.0);
    modulationFrag.pulse.addObserver(() => {
        const endTime = sequencer.toSeconds(modulationFrag.pulseComplete);
        for (let modulation of modulations) {
            modulation.setAngle(modulationFrag.pulsePosition);
        }
        oscillator.frequency.exponentialRampToValueAtTime(oscFreqMod.value(), endTime);
        lowpass.frequency.exponentialRampToValueAtTime(lowpassFreqMod.value(), endTime);
        lowpass.Q.linearRampToValueAtTime(lowpassResMod.value(), endTime);
        const mix = reverbMod.value();
        dry.gain.linearRampToValueAtTime(1.0 - mix, endTime);
        wet.gain.linearRampToValueAtTime(mix, endTime);
    });
    const drumFrag = new Fragmentation();
    drumFrag.pulse.addObserver(() => {
        if (drumFrag.index % 4 === 0) {
            if (kickEnabled.get()) {
                const sourceNode = context.createBufferSource();
                sourceNode.buffer = kick.get();
                sourceNode.playbackRate.value = 0.75;
                sourceNode.start(sequencer.toSeconds(drumFrag.pulsePosition));
                sourceNode.connect(masterGain);
            }
            if (rideEnabled.get()) {
                const sourceNode = context.createBufferSource();
                sourceNode.buffer = ride.get();
                sourceNode.start(sequencer.toSeconds(drumFrag.pulsePosition));
                const gainNode = context.createGain();
                gainNode.gain.value = 0.1;
                const biquadFilter = context.createBiquadFilter();
                biquadFilter.type = "highpass";
                biquadFilter.frequency.value = 5000.0;
                sourceNode.connect(biquadFilter).connect(gainNode).connect(masterGain);
            }
        }
    });
    playing.addObserver(() => {
        const value = playing.get();
        masterGain.gain.value = value ? 1.0 : 0.0;
        sequencer.playMode(value);
    }, true);
    sequencer.moving.addObserver(() => modulationFrag.divide(sequencer));
    sequencer.moving.addObserver(() => drumFrag.divide(sequencer));
    const frame = () => {
        modulations.forEach(modulation => modulation.paint());
        requestAnimationFrame(frame);
    };
    frame();
    document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
    const resize = () => document.body.style.height = `${window.innerHeight}px`;
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(() => {
        document.querySelectorAll("body svg.preloader").forEach(element => element.remove());
        document.querySelectorAll("body main").forEach(element => element.classList.remove("invisible"));
    });
    console.debug("boot complete.");
}))();
//# sourceMappingURL=main.js.map