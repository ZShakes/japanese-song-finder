import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  searchByText,
  searchByImage,
  searchByAnime,
  searchByArtist,
  searchByGame,
} from "@/lib/song-search.functions";

export const Route = createFileRoute("/")({
  component: Home,
});

type Song = {
  title: string;
  titleRomaji?: string;
  artist: string;
  anime?: string;
  role?: string;
  year?: string;
  reason?: string;
};
type Result = { songs: Song[]; notes?: string };
type Mode = "text" | "image" | "anime" | "artist" | "game";

function Home() {
  const [mode, setMode] = useState<Mode>("text");
  const [query, setQuery] = useState("");
  const [anime, setAnime] = useState("");
  const [artist, setArtist] = useState("");
  const [game, setGame] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const textFn = useServerFn(searchByText);
  const imageFn = useServerFn(searchByImage);
  const animeFn = useServerFn(searchByAnime);
  const artistFn = useServerFn(searchByArtist);
  const gameFn = useServerFn(searchByGame);

  const textMut = useMutation<Result, Error, string>({
    mutationFn: (q) => textFn({ data: { query: q } }),
  });
  const imageMut = useMutation<Result, Error, string>({
    mutationFn: (url) => imageFn({ data: { imageDataUrl: url } }),
  });
  const animeMut = useMutation<Result, Error, string>({
    mutationFn: (t) => animeFn({ data: { title: t } }),
  });
  const artistMut = useMutation<Result, Error, string>({
    mutationFn: (n) => artistFn({ data: { name: n } }),
  });
  const gameMut = useMutation<Result, Error, string>({
    mutationFn: (t) => gameFn({ data: { title: t } }),
  });

  const active =
    mode === "text"
      ? textMut
      : mode === "image"
        ? imageMut
        : mode === "anime"
          ? animeMut
          : mode === "artist"
            ? artistMut
            : gameMut;

  async function onImageChosen(file: File) {
    if (file.size > 6 * 1024 * 1024) {
      alert("Please choose an image under 6 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImagePreview(url);
      imageMut.mutate(url);
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "text" && query.trim()) textMut.mutate(query.trim());
    if (mode === "anime" && anime.trim()) animeMut.mutate(anime.trim());
    if (mode === "artist" && artist.trim()) artistMut.mutate(artist.trim());
    if (mode === "game" && game.trim()) gameMut.mutate(game.trim());
  }

  return (
    <main className="relative min-h-screen bg-hero">
      {/* Vertical kanji accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-24 right-6 hidden select-none text-vertical text-[10rem] leading-none font-display text-primary/10 md:block"
      >
        音森
      </div>

      <div className="mx-auto max-w-3xl px-6 pt-16 pb-24 md:pt-24">
        <header className="animate-float-in">
          <div className="flex items-center gap-3 text-xs tracking-[0.3em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-primary/60" />
            Otomori · 音森
          </div>
          <h1 className="mt-4 text-5xl leading-[1.05] font-bold md:text-6xl">
            Find any Japanese song.
            <br />
            <span className="text-primary">From a word, an image,</span>
            <br />
            an anime, an artist, or a game.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Search by a phrase you half-remember, upload a scene from an anime,
            list every opening and ending of a show, look up an artist's whole
            discography, or find the Japanese vocal tracks from a Japanese game.
          </p>
        </header>

        <section className="glass mt-10 rounded-2xl p-2 animate-float-in">
          <div className="flex flex-wrap gap-1 rounded-xl bg-secondary/40 p-1 text-sm">
            {(
              [
                ["text", "Word or lyric"],
                ["image", "Image"],
                ["anime", "Anime tracklist"],
                ["artist", "Artist tracklist"],
                ["game", "Game songs"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="p-4 pt-5">
            {mode === "text" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. “kimi no na wa”, “sayonara”, a lyric fragment…"
                  className="flex-1 rounded-lg border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={textMut.isPending || !query.trim()}
                  className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {textMut.isPending ? "Searching…" : "Search"}
                </button>
              </div>
            )}

            {mode === "image" && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImageChosen(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-input/50 px-6 py-10 text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Uploaded preview"
                      className="max-h-56 rounded-lg"
                    />
                  ) : (
                    <>
                      <span className="text-3xl">画</span>
                      <span className="font-medium">Upload an image</span>
                      <span className="text-xs">
                        Anime screenshots, album art, or any evocative photo
                      </span>
                    </>
                  )}
                </button>
                {imageMut.isPending && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    Looking at your image…
                  </p>
                )}
              </div>
            )}

            {mode === "anime" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={anime}
                  onChange={(e) => setAnime(e.target.value)}
                  placeholder="e.g. Attack on Titan, 進撃の巨人, Bocchi the Rock!"
                  className="flex-1 rounded-lg border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={animeMut.isPending || !anime.trim()}
                  className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {animeMut.isPending ? "Listing…" : "List songs"}
                </button>
              </div>
            )}

            {mode === "artist" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Kenshi Yonezu, YOASOBI, 米津玄師, Ado"
                  className="flex-1 rounded-lg border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={artistMut.isPending || !artist.trim()}
                  className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {artistMut.isPending ? "Listing…" : "List songs"}
                </button>
              </div>
            )}
            {mode === "game" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={game}
                  onChange={(e) => setGame(e.target.value)}
                  placeholder="e.g. Persona 5, NieR: Automata, Kingdom Hearts, Xenoblade"
                  className="flex-1 rounded-lg border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={gameMut.isPending || !game.trim()}
                  className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {gameMut.isPending ? "Listing…" : "List songs"}
                </button>
              </div>
            )}
          </form>
        </section>

        {active.error && (
          <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {active.error.message}
          </p>
        )}

        {active.data && <Results result={active.data} />}

        {!active.data && !active.isPending && (
          <ExampleChips
            onPick={(m, v) => {
              setMode(m);
              if (m === "text") {
                setQuery(v);
                textMut.mutate(v);
              } else if (m === "anime") {
                setAnime(v);
                animeMut.mutate(v);
              } else if (m === "artist") {
                setArtist(v);
                artistMut.mutate(v);
              } else if (m === "game") {
                setGame(v);
                gameMut.mutate(v);
              }
            }}
          />
        )}
      </div>

      <footer className="pb-10 text-center text-xs text-muted-foreground">
        Powered by Lovable AI · results are AI-generated, please verify
      </footer>
    </main>
  );
}

function Results({ result }: { result: Result }) {
  if (!result.songs.length) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-card/60 p-6 text-muted-foreground animate-float-in">
        {result.notes || "No matches found. Try a different phrase or image."}
      </div>
    );
  }
  return (
    <section className="mt-10 animate-float-in">
      <h2 className="mb-4 text-sm tracking-[0.25em] text-muted-foreground uppercase">
        {result.songs.length} result{result.songs.length === 1 ? "" : "s"}
      </h2>
      <ul className="space-y-3">
        {result.songs.map((s, i) => (
          <li
            key={i}
            className="glass group rounded-xl p-5 transition hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display text-xl leading-tight font-semibold text-foreground">
                  {s.title}
                </div>
                {s.titleRomaji && s.titleRomaji !== s.title && (
                  <div className="text-sm text-muted-foreground italic">
                    {s.titleRomaji}
                  </div>
                )}
                <div className="mt-1.5 text-sm text-foreground/90">
                  {s.artist}
                </div>
                {(s.anime || s.role || s.year) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.anime && (
                      <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs text-accent-foreground">
                        {s.anime}
                      </span>
                    )}
                    {s.role && (
                      <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs text-foreground">
                        {s.role}
                      </span>
                    )}
                    {s.year && (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                        {s.year}
                      </span>
                    )}
                  </div>
                )}
                {s.reason && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {s.reason}
                  </p>
                )}
              </div>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                  `${s.title} ${s.artist}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                Listen ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
      {result.notes && (
        <p className="mt-5 text-xs text-muted-foreground">{result.notes}</p>
      )}
    </section>
  );
}

function ExampleChips({
  onPick,
}: {
  onPick: (mode: Mode, value: string) => void;
}) {
  const examples: Array<[Mode, string, string]> = [
    ["text", "song about cherry blossoms", "🌸 cherry blossoms"],
    ["anime", "Bocchi the Rock!", "🎸 Bocchi the Rock!"],
    ["artist", "Kenshi Yonezu", "🎤 Kenshi Yonezu"],
    ["artist", "YOASOBI", "🎧 YOASOBI"],
    ["anime", "Your Lie in April", "🎻 Your Lie in April"],
    ["game", "Persona 5", "🎮 Persona 5"],
    ["game", "NieR: Automata", "🕹️ NieR: Automata"],
    ["text", "namida ga koboreru", "涙 “namida ga koboreru”"],
  ];
  return (
    <div className="mt-10">
      <p className="mb-3 text-xs tracking-[0.25em] text-muted-foreground uppercase">
        Try
      </p>
      <div className="flex flex-wrap gap-2">
        {examples.map(([m, v, label]) => (
          <button
            key={label}
            onClick={() => onPick(m, v)}
            className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}