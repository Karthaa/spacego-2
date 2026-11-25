import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { INITIAL_SPACES } from "@/lib/data/mockData";
import type { Space } from "@/types";

type Params = Promise<{ id: string }>;

/** The fields metadata needs, read defensively from untyped JSON. */
interface SpaceSummary {
  id: string;
  slug: string;
  title: string;
  headline: string;
  description: string;
  city: string;
  image: string | null;
}

const DESCRIPTION_LIMIT = 160;
const LOOKUP_TIMEOUT_MS = 3000;
// Ids and slugs are plain tokens; anything else is not looked up remotely so it
// can never alter the PostgREST filter.
const SAFE_KEY = /^[A-Za-z0-9_-]{1,200}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const valid = images.filter(
    (img): img is { url: string; is_cover?: boolean } =>
      Boolean(img) && typeof img === "object" && /^https?:\/\//i.test(text((img as { url?: unknown }).url))
  );
  const cover = valid.find((img) => img.is_cover) ?? valid[0];
  return cover ? cover.url.trim() : null;
}

function summarize(raw: unknown): SpaceSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<Record<keyof Space, unknown>>;
  const title = text(data.title);
  if (!title) return null;
  const location = data.location && typeof data.location === "object" ? (data.location as { city?: unknown }) : {};
  return {
    id: text(data.id),
    slug: text(data.slug),
    title,
    headline: text(data.headline),
    description: text(data.description),
    city: text(location.city),
    image: firstImage(data.images),
  };
}

async function fetchRemoteSpace(key: string): Promise<SpaceSummary | null> {
  if (!SAFE_KEY.test(key)) return null;
  const { url, key: apiKey } = getSupabaseConfig();
  const supabase = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase
    .from("spacego_public_spaces")
    .select("id,data")
    .or(`id.eq.${key},data->>slug.eq.${key}`)
    .limit(1)
    .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS));
  if (error || !data || data.length === 0) return null;
  return summarize((data[0] as { data: unknown }).data);
}

function findDemoSpace(key: string): SpaceSummary | null {
  const space = INITIAL_SPACES.find((s) => s.id === key || s.slug === key);
  return space ? summarize(space) : null;
}

async function loadSpace(key: string): Promise<SpaceSummary | null> {
  try {
    if (isSupabaseConfigured()) return await fetchRemoteSpace(key);
    return findDemoSpace(key);
  } catch (error) {
    console.error("SpaceGo: could not load workspace metadata", error);
    return null;
  }
}

function clip(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const { id } = await params;
    const key = decodeURIComponent(id);
    const space = await loadSpace(key);

    if (!space) {
      return {
        title: "Workspace",
        description: "View workspace details, pricing and availability on SpaceGo.",
      };
    }

    const description = clip(
      space.headline || space.description || `Book ${space.title} on SpaceGo.`,
      DESCRIPTION_LIMIT
    );
    const shareTitle = space.city ? `${space.title}, ${space.city}` : space.title;
    const path = `/spaces/${encodeURIComponent(space.id || key)}`;
    // Fall back to the site-wide generated share image when the space has none.
    const images = space.image
      ? [{ url: space.image, alt: space.title }]
      : [{ url: "/opengraph-image", width: 1200, height: 630, alt: "SpaceGo" }];

    return {
      title: space.title,
      description,
      alternates: { canonical: path },
      openGraph: {
        type: "website",
        siteName: "SpaceGo",
        url: path,
        title: `${shareTitle} · SpaceGo`,
        description,
        images,
      },
      twitter: {
        card: "summary_large_image",
        title: `${shareTitle} · SpaceGo`,
        description,
        images,
      },
    };
  } catch {
    return { title: "Workspace" };
  }
}

export default function SpaceDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
