// Chicharra de fin de período, sintetizada con Web Audio (sin archivos: funciona sin señal).
// Los navegadores móviles solo permiten sonido después de un toque del usuario: unlockAudio() se
// llama en el primer toque y deja el contexto de audio listo para cuando el reloj llegue a cero.

const PREF_KEY = 'pb-buzzer';
const DURATION_S = 1.5;
const VOLUME = 0.35;

let ctx = null;

function audioContext() {
  if (ctx) return ctx;
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch (e) { ctx = null; }
  return ctx;
}

/** Habilita el audio (llamar dentro de un toque del usuario). */
export function unlockAudio() {
  const c = audioContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function isBuzzerEnabled() {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch (e) { return true; }
}

export function setBuzzerEnabled(on) {
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch (e) { /* sin almacenamiento */ }
}

/** Toca la chicharra: tono grave y áspero, como la de un estadio. */
export function playBuzzer() {
  if (!isBuzzerEnabled()) return;
  const c = audioContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const t0 = c.currentTime;

  const out = c.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(VOLUME, t0 + 0.02);
  out.gain.setValueAtTime(VOLUME, t0 + DURATION_S - 0.08);
  out.gain.linearRampToValueAtTime(0, t0 + DURATION_S);

  // Suaviza los agudos para que suene a bocina y no a pitido.
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  tone.connect(out);
  out.connect(c.destination);

  // Dos ondas levemente desafinadas: el "batido" le da el carácter de chicharra.
  [[196, 'square'], [199, 'sawtooth'], [392, 'square']].forEach(([freq, type], i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = i === 2 ? 0.25 : 0.5;
    osc.connect(g);
    g.connect(tone);
    osc.start(t0);
    osc.stop(t0 + DURATION_S + 0.05);
  });
}
