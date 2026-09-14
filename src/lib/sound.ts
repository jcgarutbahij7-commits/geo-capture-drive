import { speakNatural } from "./tts.functions";

const cache = new Map<string, string>();

function speakFallback(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "id-ID";
  utter.pitch = 1.05;
  utter.rate = 0.98;
  const voices = window.speechSynthesis.getVoices();
  const female =
    voices.find((v) => v.lang.startsWith("id") && /female|wanita|damayanti|gadis/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("id"));
  if (female) utter.voice = female;
  window.speechSynthesis.speak(utter);
}

/** Play a natural human-like Indonesian female voice, falling back to the device voice. */
async function say(text: string) {
  if (typeof window === "undefined") return;
  try {
    let b64 = cache.get(text);
    if (!b64) {
      const res = await speakNatural({ data: { text } });
      if (!res.audio) throw new Error(res.error ?? "no_audio");
      b64 = res.audio;
      if (cache.size > 40) cache.clear();
      cache.set(text, b64);
    }
    const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
    audio.volume = 1;
    await audio.play();
  } catch {
    speakFallback(text);
  }
}

function beep(freq: number, duration: number) {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.value = 0.1;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  osc.onended = () => void ctx.close();
}

/** Chime + voice confirmation after a successful upload. */
export function playUploadSuccess() {
  beep(880, 0.14);
  setTimeout(() => beep(1320, 0.16), 150);
  setTimeout(() => void say("Data berhasil terkirim."), 400);
}

/** Voice announcing new incoming data for an owner. */
export function announceIncoming(company: string) {
  beep(1046, 0.12);
  setTimeout(() => void say(`${company}, data masuk.`), 240);
}

/** "PT <perusahaan>, data diterima dari <petugas>." */
export function announceOwnerData(companyName: string, officerName: string) {
  beep(1046, 0.12);
  setTimeout(() => void say(`PT ${companyName}, data diterima dari ${officerName}.`), 240);
}
