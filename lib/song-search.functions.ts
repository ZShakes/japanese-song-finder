import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];

const SongSchema = z.object({
  title: z.string(),
  titleRomaji: z.string().optional().default(""),
  artist: z.string(),
  anime: z.string().optional().default(""),
  role: z.string().optional().default(""),
  year: z.string().optional().default(""),
  reason: z.string().optional().default(""),
  source: z.enum(["musicbrainz", "jikan", "ai"]).optional(),
  sourceUrl: z.string().url().optional(),
});

const AnimeGroupSchema = z.object({
  title: z.string(),
  titleEnglish: z.string().optional().default(""),
  titleJapanese: z.string().optional().default(""),
  alternateTitles: z.array(z.string()).optional().default([]),
  releaseType: z.string().optional().default("Anime"),
  season: z.string().optional().default(""),
  year: z.string().optional().default(""),
  sourceUrl: z.string().url(),
  songs: z.array(SongSchema),
});

const ResultSchema = z.object({
  songs: z.array(SongSchema),
  animeGroups: z.array(AnimeGroupSchema).optional().default([]),
  notes: z.string().optional().default(""),
});

const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2/recording/";

type MusicBrainzRecording = {
  id: string;
  title: string;
  "artist-credit"?: Array<{ name?: string; artist?: { name?: string } } | string>;
  date?: string;
  "first-release-date"?: string;
  score?: number;
};

function escapeLucene(value: string) {
  return value
    .replace(/[+\-!(){}^"~*?:\\/]/g, "\\$&")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

async function searchMusicBrainz(query: string) {
  const params = new URLSearchParams({
    query: `recording:"${escapeLucene(query)}"`,
    fmt: "json",
    limit: "8",
  });
  const response = await fetch(`${MUSICBRAINZ_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": `Otomori/0.1.0 (${process.env.OTOMORI_CONTACT ?? "local development"})`,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`MusicBrainz request failed [${response.status}]`);
  }
  const data = (await response.json()) as { recordings?: MusicBrainzRecording[] };
  return (data.recordings ?? [])
    .map((recording) => {
      const credits = (recording["artist-credit"] ?? [])
        .map((credit) =>
          typeof credit === "string" ? credit : (credit.name ?? credit.artist?.name ?? ""),
        )
        .filter(Boolean);
      const releaseDate = recording["first-release-date"] ?? recording.date ?? "";
      return {
        title: recording.title,
        titleRomaji: "",
        artist: credits.join(""),
        anime: "",
        role: "",
        year: releaseDate.slice(0, 4),
        reason: `Recording catalog match${recording.score ? ` (search score ${recording.score})` : ""}. Verify the version and spelling before saving.`,
        source: "musicbrainz" as const,
        sourceUrl: `https://musicbrainz.org/recording/${recording.id}`,
      };
    })
    .filter((song) => song.title && song.artist);
}

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

  let lastError = "No Gemini model responded";

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await wait(750 * attempt);

      try {
        const res = await fetch(
          `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
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
            signal: AbortSignal.timeout(30000),
          },
        );

        if (!res.ok) {
          const body = await res.text();
          lastError = `AI request failed [${res.status}] using ${model}: ${body}`;
          if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
          if (res.status === 503 || res.status === 408) continue;
          throw new Error(lastError);
        }

        return await parseAIResponse(await res.json());
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Rate limit exceeded. Please try again shortly."
        ) {
          throw error;
        }
        lastError = error instanceof Error ? error.message : lastError;
      }
    }
  }

  throw new Error(lastError);
}

async function parseAIResponse(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}) {
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
  .validator((input: unknown) =>
    z.object({ query: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const query = data.query.trim();

    // First search a real recording catalog. MusicBrainz indexes metadata, not lyrics.
    try {
      const catalogSongs = await searchMusicBrainz(query);
      if (catalogSongs.length > 0) {
        return ResultSchema.parse({
          songs: catalogSongs,
          notes:
            "These are recording-metadata matches from MusicBrainz, not confirmed lyric matches. Alternate spellings, covers, and live versions may appear separately.",
        });
      }
    } catch (error) {
      // Keep discovery usable if the external catalog is temporarily unavailable.
      console.error("MusicBrainz search failed:", error);
    }

    const aiResults = await callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: `Suggest up to 8 Japanese songs that could match this search clue: "${query}". The clue may be a lyric fragment, romanized Japanese, a theme, mood, or remembered phrase. Do not claim an exact lyric match unless you are certain. Prefer fewer reliable candidates over guesses.`,
      },
    ]);

    return {
      ...aiResults,
      songs: aiResults.songs.map((song) => ({ ...song, source: "ai" as const })),
      notes: aiResults.notes
        ? `AI-generated candidates; no matching MusicBrainz recording was found. ${aiResults.notes}`
        : "AI-generated candidates; no matching MusicBrainz recording was found. These are suggestions, not verified lyric matches. A licensed lyrics index is needed for exact lyric search.",
    };
  });

export const searchByImage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
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

type JikanAnime = {
  mal_id: number;
  url: string;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  title_synonyms?: string[];
  titles?: Array<{ type?: string; title?: string }>;
  type?: string | null;
  season?: string | null;
  year?: number | null;
  aired?: { from?: string | null };
};

type JikanThemeResponse = {
  data?: {
    openings?: string[];
    endings?: string[];
  };
};

async function fetchJikan<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.jikan.moe/v4${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Jikan request failed [${response.status}]`);
  }
  return (await response.json()) as T;
}

function parseJikanTheme(theme: string) {
  // Jikan theme strings commonly look like: 1: "Song Title" by Artist Name
  const withoutNumber = theme.replace(/^\s*\d+\s*:\s*/, "").trim();
  const match = withoutNumber.match(/^['"“”]?(.+?)['"“”]?\s+by\s+(.+)$/i);
  if (!match) {
    return { title: withoutNumber || theme, artist: "Artist not listed" };
  }
  return {
    title: match[1].replace(/^['"“”]|['"“”]$/g, "").trim(),
    artist: match[2].trim(),
  };
}

function normalizeAnimeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function animeTitleAliases(anime: JikanAnime) {
  return [
    anime.title,
    anime.title_english,
    anime.title_japanese,
    ...(anime.title_synonyms ?? []),
    ...(anime.titles ?? []).map((entry) => entry.title),
  ].filter((value): value is string => Boolean(value?.trim()));
}

function isRelatedAnimeResult(anime: JikanAnime, query: string) {
  const normalizedQuery = normalizeAnimeTitle(query);
  if (!normalizedQuery) return false;
  return animeTitleAliases(anime).some((alias) => {
    const normalizedAlias = normalizeAnimeTitle(alias);
    return (
      normalizedAlias === normalizedQuery ||
      normalizedAlias.startsWith(`${normalizedQuery} `) ||
      normalizedAlias.includes(` ${normalizedQuery} `) ||
      normalizedQuery.startsWith(`${normalizedAlias} `)
    );
  });
}

function getAnimeReleaseLabel(anime: JikanAnime) {
  const type = anime.type || "Anime";
  const season = anime.season
    ? `${anime.season.charAt(0).toUpperCase()}${anime.season.slice(1)}`
    : "";
  const year = anime.year ?? anime.aired?.from?.slice(0, 4) ?? "";
  if (type.toLowerCase() === "tv" && season && year) return `${season} ${year}`;
  if (season && year) return `${season} ${year}`;
  return year ? `${type} · ${year}` : type;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const searchByAnime = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ title: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const query = data.title.trim();
    try {
      const search = await fetchJikan<{ data?: JikanAnime[] }>(
        `/anime?q=${encodeURIComponent(query)}&limit=10&sfw=true`,
      );
      const candidates = (search.data ?? []).filter((anime) => isRelatedAnimeResult(anime, query));
      const exact = candidates.filter((anime) =>
        animeTitleAliases(anime).some(
          (alias) => normalizeAnimeTitle(alias) === normalizeAnimeTitle(query),
        ),
      );
      const orderedCandidates = [...exact, ...candidates.filter((anime) => !exact.includes(anime))]
        .filter(
          (anime, index, all) => all.findIndex((item) => item.mal_id === anime.mal_id) === index,
        )
        .slice(0, 6);

      const animeGroups = [];
      for (const anime of orderedCandidates) {
        // Jikan asks clients to keep request rates low. Fetch theme lists sequentially.
        await wait(400);
        try {
          const themeResponse = await fetchJikan<JikanThemeResponse>(
            `/anime/${anime.mal_id}/themes`,
          );
          const themes = themeResponse.data;
          const releaseYear = anime.year ?? anime.aired?.from?.slice(0, 4) ?? "";
          const groupSongs = [
            ...(themes?.openings ?? []).map((theme) => ({ theme, role: "Opening" })),
            ...(themes?.endings ?? []).map((theme) => ({ theme, role: "Ending" })),
          ].map(({ theme, role }) => {
            const parsed = parseJikanTheme(theme);
            return {
              title: parsed.title,
              titleRomaji: "",
              artist: parsed.artist,
              anime: anime.title_english || anime.title,
              role,
              year: releaseYear ? String(releaseYear) : "",
              reason: `Listed as an ${role.toLowerCase()} theme for this ${anime.type || "anime"} release in Jikan.`,
              source: "jikan" as const,
              sourceUrl: anime.url,
            };
          });

          const aliases = [...new Set(animeTitleAliases(anime))].filter(
            (alias) =>
              normalizeAnimeTitle(alias) !== normalizeAnimeTitle(anime.title) &&
              normalizeAnimeTitle(alias) !== normalizeAnimeTitle(anime.title_english || "") &&
              normalizeAnimeTitle(alias) !== normalizeAnimeTitle(anime.title_japanese || ""),
          );

          animeGroups.push({
            title: anime.title,
            titleEnglish: anime.title_english || "",
            titleJapanese: anime.title_japanese || "",
            alternateTitles: aliases,
            releaseType: anime.type || "Anime",
            season: getAnimeReleaseLabel(anime),
            year: releaseYear ? String(releaseYear) : "",
            sourceUrl: anime.url,
            songs: groupSongs,
          });
        } catch (error) {
          console.error(`Jikan themes failed for anime ${anime.mal_id}:`, error);
        }
      }

      const groupsWithThemes = animeGroups.filter((group) => group.songs.length > 0);
      const songs = groupsWithThemes.flatMap((group) => group.songs);
      if (songs.length) {
        const selectedTitles = groupsWithThemes.map((group) => group.titleEnglish || group.title);
        return ResultSchema.parse({
          songs,
          animeGroups: groupsWithThemes,
          notes: `Opening and ending themes retrieved from Jikan (MyAnimeList) for ${selectedTitles.length} matching release${selectedTitles.length === 1 ? "" : "s"}. Results are separated by TV season, movie, OVA, special, or other release type where Jikan provides that information. Alternate titles are shown when available. Jikan may omit insert songs and character songs.`,
        });
      }
    } catch (error) {
      console.error("Jikan anime search failed:", error);
    }

    // Keep the feature useful when Jikan has no matching release/theme data or is unavailable.
    const aiResults = await callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: `Suggest known opening and ending themes for the anime/TV show "${query}". Separate different seasons, movies, OVAs, and specials in the role field where known. Include alternate titles if useful in the anime field. Do not invent songs; return fewer results if uncertain.`,
      },
    ]);
    return {
      ...aiResults,
      songs: aiResults.songs.map((song) => ({ ...song, source: "ai" as const })),
      notes:
        `Jikan did not return usable release-specific theme data for "${query}". The following are AI-generated suggestions, not verified tracklist entries. ${aiResults.notes ?? ""}`.trim(),
    };
  });

export const searchByGame = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ title: z.string().min(1).max(200) }).parse(input))
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
  .validator((input: unknown) => z.object({ name: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    return callAI([
      { role: "system", content: SYSTEM_TEXT },
      {
        role: "user",
        content: `List as many songs as you reliably know by the Japanese artist "${data.name.trim().toLowerCase()}" (singles, album tracks, notable collaborations, tie-ins). For each, put the album or single name plus any tie-in (e.g. "Album: Vivid Vice — OP of Jujutsu Kaisen") in "role", the release year in "year", and leave "anime" empty unless the song was used as an anime/TV/film tie-in. Aim for breadth without inventing songs.`,
      },
    ]);
  });
