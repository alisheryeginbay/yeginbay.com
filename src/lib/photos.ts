// The photos on /photos. They and their manifest live in R2, at
// photos.yeginbay.com, uploaded by a separate script; the manifest is read on
// each request, so a new photo shows up without a rebuild.
import { thumbHashToDataURL } from "thumbhash";
import { SITE } from "../site.ts";
import { longDate } from "./dates.ts";

export const MANIFEST_URL = "https://photos.yeginbay.com/photos.json";

// How long, in seconds, the manifest and the pages made from it are cached.
export const CACHE_SECONDS = 300;

export interface Photo {
  // Stable once published; the page's URL.
  slug: string;
  // Null when the photo has none; the date is shown instead.
  title: string | null;
  // My own words, shown under the photo; never written by AI.
  caption: string | null;
  // For screen readers; always written by AI, null only if that failed.
  alt: string | null;
  // 2026-07-14, the day it was taken.
  date: string;
  // "Seoul, South Korea"
  location: string | null;
  width: number;
  height: number;
  thumbhash: string;
  // The full-size original. It changes when a photo is re-edited, so it's
  // always read from here.
  url: string;
  ai: { title: boolean; alt: boolean; model: string | null };
}

// Every photo, newest first.
export async function getPhotos(): Promise<Photo[]> {
  // `cf` caches the manifest at Cloudflare's edge; outside Workers it's ignored.
  const res = await fetch(MANIFEST_URL, { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } } as RequestInit);
  if (!res.ok) throw new Error(`Fetching ${MANIFEST_URL} failed: ${res.status}`);
  const { photos } = (await res.json()) as { photos: Photo[] };
  return photos.toSorted((a, b) => b.date.localeCompare(a.date));
}

// The photo's date as a Date, at midnight UTC, for src/lib/dates.ts.
export const photoDate = (photo: Photo) => new Date(`${photo.date}T00:00:00Z`);

// The title, or the date when the photo has none.
export const photoTitle = (photo: Photo) => photo.title ?? longDate(photoDate(photo));

// Text for <img alt>: the description, or else the title.
export const photoAlt = (photo: Photo) => photo.alt ?? photo.title ?? "";

// A blurred preview shown while the photo loads.
export function placeholder(photo: Photo): string {
  const hash = Uint8Array.from(atob(photo.thumbhash), (c) => c.charCodeAt(0));
  return thumbHashToDataURL(hash);
}

// The photo resized by Cloudflare (developers.cloudflare.com/images). In dev
// the resizing happens on the live site, since it only runs at Cloudflare.
const RESIZE = `${import.meta.env.DEV ? SITE.url : ""}/cdn-cgi/image`;

export function resized(photo: Photo, options: Record<string, string | number>): string {
  const opts = Object.entries({ format: "auto", ...options })
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return `${RESIZE}/${opts}/${photo.url}`;
}

// A square crop for the grid, at each width in `widths`.
export const thumbSrcset = (photo: Photo, widths: number[]) =>
  widths.map((w) => `${resized(photo, { width: w, height: w, fit: "cover", quality: 80 })} ${w}w`).join(", ");

// The whole photo, never enlarged past its own size.
export const fullSrcset = (photo: Photo, widths: number[]) =>
  widths
    .filter((w, i) => w <= photo.width || i === 0)
    .map((w) => `${resized(photo, { width: Math.min(w, photo.width), fit: "scale-down", quality: 85 })} ${Math.min(w, photo.width)}w`)
    .join(", ");

// The name that ties a photo in the grid to the same photo on its own page,
// so the browser can animate between them.
export const transitionName = (photo: Photo) => `photo-${photo.slug}`;
