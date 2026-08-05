declare global {
  interface Window {
    flashcardApi?: {
      baseUrl: string;
      getBaseUrl?: () => Promise<string>;
      openPath?: (path: string) => Promise<string>;
      getDataDirOverride?: () => Promise<string | null>;
      chooseDataDir?: () => Promise<string | null>;
      setDataDir?: (dir: string) => Promise<string>;
      resetDataDir?: () => Promise<string>;
      listBackups?: () => Promise<BackupInfo[]>;
      restoreBackup?: (filename: string) => Promise<string>;
    };
  }
}

export interface BackupInfo {
  filename: string;
  size_bytes: number;
  created_at: string;
}

export interface AppInfo {
  data_dir: string;
  db_path: string;
  images_dir: string;
}

let cachedBaseUrl: string =
  (typeof window !== "undefined" && window.flashcardApi?.baseUrl) ||
  "http://127.0.0.1:8123";

export function apiBaseUrl(): string {
  return cachedBaseUrl;
}

export function setApiBaseUrl(url: string) {
  if (url) cachedBaseUrl = url;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiBaseUrl() + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Subject {
  id: number;
  name: string;
  description: string;
  created_at: string;
  card_count: number;
}

export interface Tag {
  id: number;
  name: string;
  usage_count: number;
}

export interface Attempt {
  id: number;
  result: "correct" | "incorrect";
  created_at: string;
}

export interface CardSummary {
  id: number;
  subject_id: number;
  subject_name: string;
  front_md: string;
  back_md: string;
  tags: string[];
  /** Unfinished. Stays in the library but is held back from practice. */
  is_draft: boolean;
  updated_at: string;
}

export interface Card extends CardSummary {
  created_at: string;
  last10_attempts: Attempt[];
}

export interface UploadedImage {
  id: string;
  ext: string;
  filename: string;
}

export type MasteryLevel = "memorized" | "familiar" | "learning" | "new";

export interface MasteryCounts {
  memorized: number;
  familiar: number;
  learning: number;
  new: number;
}

export interface HomeTotals extends MasteryCounts {
  subjects: number;
  cards: number;
  /** Draft cards — excluded from `cards` and from the mastery buckets. */
  drafts: number;
}

export interface SubjectMastery extends MasteryCounts {
  id: number;
  name: string;
  card_count: number;
}

export interface ReviewCard {
  id: number;
  subject_id: number;
  subject_name: string;
  front_md: string;
  tags: string[];
  weight: number;
  mastery: MasteryLevel;
}

export interface HomeStats {
  totals: HomeTotals;
  subjects: SubjectMastery[];
  needs_review: ReviewCard[];
}

export const api = {
  info: () => request<AppInfo>("/api/info"),
  homeStats: () => request<HomeStats>("/api/stats/home"),

  // subjects
  listSubjects: () => request<Subject[]>("/api/subjects"),
  createSubject: (name: string, description: string = "") =>
    request<Subject>("/api/subjects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  updateSubject: (
    id: number,
    data: Partial<{ name: string; description: string }>,
  ) =>
    request<Subject>(`/api/subjects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSubject: (id: number) =>
    request<void>(`/api/subjects/${id}`, { method: "DELETE" }),

  // tags
  listTags: () => request<Tag[]>("/api/tags"),

  // cards
  listCards: (
    params: {
      subject_id?: number;
      tag_ids?: number[];
      q?: string;
      /** true = drafts only, false = finished only, omitted = both. */
      draft?: boolean;
    } = {},
  ) => {
    const search = new URLSearchParams();
    if (params.subject_id != null) search.set("subject_id", String(params.subject_id));
    if (params.tag_ids?.length) {
      for (const t of params.tag_ids) search.append("tag_ids", String(t));
    }
    if (params.q) search.set("q", params.q);
    if (params.draft != null) search.set("draft", String(params.draft));
    const qs = search.toString();
    return request<CardSummary[]>(`/api/cards${qs ? "?" + qs : ""}`);
  },
  getCard: (id: number) => request<Card>(`/api/cards/${id}`),
  createCard: (data: {
    subject_id: number;
    front_md: string;
    back_md: string;
    tag_names: string[];
    is_draft?: boolean;
  }) =>
    request<Card>("/api/cards", { method: "POST", body: JSON.stringify(data) }),
  updateCard: (
    id: number,
    data: Partial<{
      subject_id: number;
      front_md: string;
      back_md: string;
      tag_names: string[];
      is_draft: boolean;
    }>,
  ) =>
    request<Card>(`/api/cards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCard: (id: number) =>
    request<void>(`/api/cards/${id}`, { method: "DELETE" }),

  // images
  uploadImage: async (file: File | Blob): Promise<UploadedImage> => {
    const fd = new FormData();
    fd.append("file", file, "upload");
    const res = await fetch(apiBaseUrl() + "/api/images", { method: "POST", body: fd });
    if (!res.ok) throw new Error(`Image upload failed: ${res.status}`);
    return res.json();
  },
  uploadImageFromUrl: (url: string) =>
    request<UploadedImage>("/api/images/from-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  listOrphanImages: () =>
    request<{ count: number; filenames: string[] }>("/api/images/orphans"),
  cleanupOrphanImages: () =>
    request<{ deleted: number; filenames: string[] }>("/api/images/cleanup", {
      method: "POST",
    }),
  imageUrl: (filename: string) => `${apiBaseUrl()}/api/images/${filename}`,

  // practice
  nextCard: (params: {
    mode: "random" | "inorder" | "smart";
    subject_id?: number;
    subject_ids?: number[];
    tag_ids?: number[];
    cursor_id?: number;
    exclude_ids?: number[];
  }) => {
    const search = new URLSearchParams();
    search.set("mode", params.mode);
    if (params.subject_id != null) search.set("subject_id", String(params.subject_id));
    if (params.subject_ids?.length) {
      for (const s of params.subject_ids) search.append("subject_ids", String(s));
    }
    if (params.cursor_id != null) search.set("cursor_id", String(params.cursor_id));
    if (params.tag_ids?.length) {
      for (const t of params.tag_ids) search.append("tag_ids", String(t));
    }
    if (params.exclude_ids?.length) {
      for (const id of params.exclude_ids) search.append("exclude_ids", String(id));
    }
    return request<Card | null>(`/api/practice/next?${search.toString()}`);
  },
  recordAttempt: (card_id: number, result: "correct" | "incorrect") =>
    request<Card>("/api/practice/attempt", {
      method: "POST",
      body: JSON.stringify({ card_id, result }),
    }),
};
