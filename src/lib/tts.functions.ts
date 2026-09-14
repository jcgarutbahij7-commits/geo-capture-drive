import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  text: z.string().min(1).max(600),
  voice: z.string().min(1).max(40).optional(),
});

/** Natural-sounding Indonesian female voice via Lovable AI (returns base64 mp3). */
export const speakNatural = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { audio: null as string | null, error: "no_key" };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text,
        voice: data.voice ?? "coral",
        response_format: "mp3",
        stream_format: "audio",
        instructions:
          "Speak Indonesian as a warm, friendly young woman. Natural human intonation, clear and calm, moderate pace, no robotic or exaggerated tone.",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`TTS failed [${res.status}]: ${body}`);
      return { audio: null as string | null, error: `status_${res.status}` };
    }

    const buf = await res.arrayBuffer();
    return { audio: Buffer.from(buf).toString("base64"), error: null as string | null };
  });
