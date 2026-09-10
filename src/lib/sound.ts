function speak(text: string, opts: { pitch: number; rate: number }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "id-ID";
  utter.pitch = opts.pitch;
  utter.rate = opts.rate;
  const voices = window.speechSynthesis.getVoices();
  const female =
    voices.find((v) => v.lang.startsWith("id") && /female|wanita|damayanti/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("id"));
  if (female) utter.voice = female;
  window.speechSynthesis.speak(utter);
}

function beep(freq: number, duration: number) {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.value = 0.12;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  osc.onended = () => void ctx.close();
}

/** Chime + voice confirmation after a successful Google Drive upload. */
export function playUploadSuccess() {
  beep(880, 0.14);
  setTimeout(() => beep(1320, 0.16), 150);
  setTimeout(() => speak("Data berhasil terkirim", { pitch: 1.6, rate: 1.05 }), 380);
}

/** Funny high-pitched female voice announcing new incoming data for an owner. */
export function announceIncoming(company: string) {
  beep(1046, 0.12);
  setTimeout(() => speak(`${company}, masuk!`, { pitch: 2, rate: 1.15 }), 220);
}
