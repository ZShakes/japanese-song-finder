import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SongSchema = z.object({
  title: z.string(),
  titleRomaji: z.string().optional().default(""),
  artist: z.string(),
  anime: z.string().optional().default(""),
  role: z.string().optional().default(""),
  year: z.string().optional().default(""),
  reason: z.string().optional().default(""),
});

const ResultSchema = z.object({
  songs: z.array(SongSchema),
  notes: z.string().optional().default(""),
});

type AIMessage = {
  role: "system" | "user";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

async function callAI(messages: AIMessage[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const systemMessage = messages.find((message) => message.role === "system");
  const userMessages = messages.filter((message) => message.role === "user");
  const contents = userMessages.map((message) => ({
    role: "user",
    parts: toGeminiParts(message.content),
  }));

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: systemMessage
        ? { parts: [{ text: systemMessage.content as string }] }
        : undefined,
      contents,
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    throw new Error(`AI request failed [${res.status}]: ${body}`);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");
  if (!content) throw new Error("Empty AI response");
  try {
    const parsed = JSON.parse(content);
    return ResultSchema.parse(parsed);
  } catch {
    return { songs: [], notes: "The AI returned an unparseable response. Try rephrasing." };
  }
}

function toGeminiParts(content: AIMessage["content"]) {
  if (typeof content === "string") return [{ text: content }];

  return content.map((part) => {
    if (part.type === "text") return { text: part.text ?? "" };
    const imageUrl = part.image_url?.url ?? "";
    const [metadata, data] = imageUrl.split(",", 2);
    const mimeType = metadata?.match(/^data:(.*?);base64$/)?.[1];
    if (!data || !mimeType) throw new Error("Invalid image data");
    return { inlineData: { mimeType, data } };
  });
}

const SYSTEM_TEXT = `You are an expert on Japanese music (J-pop, city pop, anime openings/endings, vocaloid, enka, J-rock, idol, etc.).
Return STRICT JSON only, matching:
{
  "songs": [
    { "title": string, "titleRomaji": string, "artist": string, "anime": string, "role": string, "year": string, "reason": string }
  ],
  "notes": string
}
- "title" is the original Japanese title (kanji/kana) when it exists; otherwise the official title.
- "titleRomaji" is a romanized reading (empty if same as title).
- "role" is e.g. "OP1", "ED2", "insert song", "character song" for anime; empty for non-anime.
- "reason" briefly says why this matches the query (lyrics phrase, mood, visual clue, etc.).
- Never invent songs. If unsure, return fewer results or empty songs with a helpful "notes".`;

export const searchByText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    return callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: `Find up to 8 Japanese songs matching this word, phrase, or lyric snippet: "${data.query.trim().toLowerCase()}". Prefer exact lyric matches when the query looks like a lyric.`,
      },
    ]);
  });

export const searchByImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ imageDataUrl: z.string().startsWith("data:image/") }).parse(input),
  )
  .handler(async ({ data }) => {
    return callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Identify Japanese songs that this image evokes or that come from a scene like this. If it's a screenshot from an anime, identify the anime and its likely OP/ED/insert songs. Return up to 6 candidates.",
          },
          { type: "image_url", image_url: { url: data.imageDataUrl } },
        ],
      },
    ]);
  });

export const searchByAnime = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ title: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    return callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: `List every known song (openings, endings, insert songs, notable character songs) from the anime/TV show "${data.title.trim().toLowerCase()}". Include season/role details in "role" (e.g. "S1 OP1", "S2 ED"). Aim for completeness.`,
      },
    ]);
  });

export const searchByGame = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ title: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    return callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: `List songs from the Japanese-origin video game "${data.title.trim().toLowerCase()}". STRICT RULES: (1) Only include the game if it originated in Japan (developed by a Japanese studio like Square Enix, Nintendo, Capcom, Konami, Sega, Bandai Namco, FromSoftware, Atlus, Falcom, Type-Moon, miHoYo is NOT Japanese so exclude, etc.). If the game is not Japanese in origin, return empty songs and explain in "notes". (2) Only include songs whose lyrics are in Japanese — exclude purely instrumental tracks and songs with English/other-language lyrics. Include vocal theme songs, character songs, and vocal insert tracks. Put the role (e.g. "Main theme", "Opening", "Ending", "Character song — <name>") in "role" and the release year in "year". Leave "anime" empty unless there is a direct anime tie-in.`,
      },
    ]);
  });

export const searchByArtist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ name: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    return callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: `List as many songs as you reliably know by the Japanese artist "${data.name.trim().toLowerCase()}" (singles, album tracks, notable collaborations, tie-ins). For each, put the album or single name plus any tie-in (e.g. "Album: Vivid Vice — OP of Jujutsu Kaisen") in "role", the release year in "year", and leave "anime" empty unless the song was used as an anime/TV/film tie-in. Aim for breadth without inventing songs.`,
      },
    ]);
  });