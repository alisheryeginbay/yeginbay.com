// The songs on /music: a public playlist in my Apple Music library, read
// from Apple's catalog on each request (cached for CACHE_SECONDS), so a song
// added in the Music app shows up without a rebuild.
//
// The Worker signs its own developer token with the MusicKit key in its
// secrets, so there's no token to renew:
//   APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY (the .p8)
// For `astro dev`, the same three go in .dev.vars.
import { env } from "cloudflare:workers";

// From the playlist's share link: music.apple.com/…/playlist/name/pl.u-…
export const PLAYLIST_ID = "pl.u-Ymb0vq5CDP2Jg9E";

// The country whose catalog the songs are looked up in. A song that isn't
// available there is left out.
const STOREFRONT = "us";

// How long, in seconds, the playlist and the page made from it are cached.
export const CACHE_SECONDS = 600;

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  // On music.apple.com.
  url: string;
  // A 30-second clip, played on the page. Some songs have none.
  preview: string | null;
  artwork: { template: string; bg: string | null };
}

export interface Playlist {
  name: string;
  description: string | null;
  url: string;
  updated: Date | null;
  songs: Song[];
}

// The artwork at a square size, in pixels.
export const artwork = (song: Song, size: number) =>
  song.artwork.template.replace("{w}", String(size)).replace("{h}", String(size));

// 3:07
export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export async function getPlaylist(): Promise<Playlist> {
  if (!PLAYLIST_ID) throw new Error("PLAYLIST_ID in src/lib/music.ts isn't set");

  // The Workers cache, keyed by a made-up URL. It isn't there in dev.
  const cache = (globalThis.caches as { default?: Cache } | undefined)?.default;
  // Bump the version when the shape of Playlist changes, so an old copy
  // isn't read as a new one.
  const key = new Request(`https://cache.yeginbay.com/music/v2/${STOREFRONT}/${PLAYLIST_ID}`);
  const cached = await cache?.match(key);
  if (cached) return revive(await cached.json());

  const playlist = await fetchPlaylist();
  await cache?.put(
    key,
    new Response(JSON.stringify(playlist), { headers: { "Cache-Control": `max-age=${CACHE_SECONDS}` } }),
  );
  return playlist;
}

const revive = (p: Playlist): Playlist => ({ ...p, updated: p.updated ? new Date(p.updated) : null });

// Apple's API: developer.apple.com/documentation/applemusicapi
const API = "https://api.music.apple.com";

interface Resource<A> {
  id: string;
  type: string;
  attributes?: A;
}

interface Page<T> {
  data: T[];
  next?: string;
}

interface PlaylistAttributes {
  name: string;
  url: string;
  lastModifiedDate?: string;
  description?: { standard?: string };
}

interface SongAttributes {
  name: string;
  artistName: string;
  albumName: string;
  durationInMillis: number;
  url: string;
  previews?: { url: string }[];
  artwork: { url: string; bgColor?: string };
}

type PlaylistResource = Resource<PlaylistAttributes> & {
  relationships: { tracks: Page<Resource<SongAttributes>> };
};

async function fetchPlaylist(): Promise<Playlist> {
  const token = await developerToken();
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Apple Music ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  };

  const { data } = await get<Page<PlaylistResource>>(`/v1/catalog/${STOREFRONT}/playlists/${PLAYLIST_ID}?include=tracks`);
  const playlist = data[0];
  // The playlist comes with its first 100 tracks; the rest are a page each.
  const tracks = [...playlist.relationships.tracks.data];
  for (let next = playlist.relationships.tracks.next; next; ) {
    const page = await get<Page<Resource<SongAttributes>>>(next);
    tracks.push(...page.data);
    next = page.next;
  }

  const a = playlist.attributes!;
  return {
    name: a.name,
    description: a.description?.standard ?? null,
    url: a.url,
    updated: a.lastModifiedDate ? new Date(a.lastModifiedDate) : null,
    // Music videos and songs not in this storefront's catalog are skipped.
    songs: tracks
      .filter((t): t is Resource<SongAttributes> & { attributes: SongAttributes } => t.type === "songs" && !!t.attributes)
      .map(({ id, attributes: s }) => ({
        id,
        title: s.name,
        artist: s.artistName,
        album: s.albumName,
        durationMs: s.durationInMillis,
        url: s.url,
        preview: s.previews?.[0]?.url ?? null,
        artwork: { template: s.artwork.url, bg: s.artwork.bgColor ? `#${s.artwork.bgColor}` : null },
      })),
  };
}

// A developer token: a JWT signed with the MusicKit key (ES256). Kept for a
// day while the Worker stays warm; Apple allows up to six months.
let token: { value: string; expires: number } | undefined;

async function developerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (token && token.expires - now > 60) return token.value;

  const { APPLE_MUSIC_TEAM_ID: team, APPLE_MUSIC_KEY_ID: kid, APPLE_MUSIC_PRIVATE_KEY: pem } = env;
  if (!team || !kid || !pem) throw new Error("The APPLE_MUSIC_* secrets aren't set");

  const expires = now + 24 * 60 * 60;
  const encode = (o: object) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${encode({ alg: "ES256", kid })}.${encode({ iss: team, iat: now, exp: expires })}`;

  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto gives the signature as r‖s, the form JWTs use.
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));

  token = { value: `${unsigned}.${base64url(new Uint8Array(signature))}`, expires };
  return token.value;
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
