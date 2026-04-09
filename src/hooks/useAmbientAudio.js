import { useEffect, useRef, useState } from "react";

export function useAmbientAudio() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const audioStateRef = useRef({
    audioContext: null,
    masterGain: null,
    nodes: [],
  });

  useEffect(() => {
    return () => {
      const state = audioStateRef.current;

      state.nodes.forEach((node) => {
        if (typeof node.stop === "function") {
          try {
            node.stop();
          } catch (error) {
            // Nodes may already be stopped during teardown.
          }
        }
      });

      state.audioContext?.close().catch(() => {});
    };
  }, []);

  async function toggle() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      setSupported(false);
      return;
    }

    const state = audioStateRef.current;

    if (!state.audioContext) {
      const audioContext = new AudioContextClass();
      const masterGain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();

      masterGain.gain.value = 0.0001;
      filter.type = "lowpass";
      filter.frequency.value = 950;
      filter.Q.value = 0.8;

      masterGain.connect(filter);
      filter.connect(audioContext.destination);

      [196, 293.66, 392].forEach((tone, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = index === 1 ? "triangle" : "sine";
        oscillator.frequency.value = tone;
        oscillator.detune.value = index === 0 ? -4 : index === 2 ? 5 : 0;
        gain.gain.value = index === 1 ? 0.05 : 0.03;

        oscillator.connect(gain);
        gain.connect(masterGain);
        oscillator.start();
        state.nodes.push(oscillator);
      });

      const shimmer = audioContext.createOscillator();
      const shimmerGain = audioContext.createGain();

      shimmer.type = "sine";
      shimmer.frequency.value = 0.08;
      shimmerGain.gain.value = 0.018;
      shimmer.connect(shimmerGain);
      shimmerGain.connect(masterGain.gain);
      shimmer.start();

      state.nodes.push(shimmer);
      state.audioContext = audioContext;
      state.masterGain = masterGain;
    }

    if (!enabled) {
      await state.audioContext.resume();
      state.masterGain.gain.cancelScheduledValues(state.audioContext.currentTime);
      state.masterGain.gain.linearRampToValueAtTime(0.045, state.audioContext.currentTime + 0.8);
      setEnabled(true);
      return;
    }

    state.masterGain.gain.cancelScheduledValues(state.audioContext.currentTime);
    state.masterGain.gain.linearRampToValueAtTime(0.0001, state.audioContext.currentTime + 0.45);
    window.setTimeout(() => {
      state.audioContext?.suspend().catch(() => {});
    }, 500);
    setEnabled(false);
  }

  return { enabled, supported, toggle };
}
