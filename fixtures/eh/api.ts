/** Synthetic answers of the `api.php` methods, in the field names and types the documentation shows. */

export interface GdataTorrentEntry {
  readonly hash: string;
  readonly added: string;
  readonly name: string;
  readonly tsize: string;
  readonly fsize: string;
}

/** One `gmetadata` item. Lineage fields appear only for galleries that have them; their types are unconfirmed. */
export interface GdataEntry {
  readonly gid: number;
  readonly token: string;
  readonly title: string;
  readonly title_jpn: string;
  readonly category: string;
  readonly thumb: string;
  readonly uploader: string;
  readonly posted: string;
  readonly filecount: string;
  readonly filesize: number;
  readonly expunged: boolean;
  readonly rating: string;
  readonly torrentcount: string;
  readonly torrents: readonly GdataTorrentEntry[];
  readonly tags: readonly string[];
  readonly parent_gid?: string;
  readonly parent_key?: string;
  readonly first_gid?: string;
  readonly first_key?: string;
  readonly current_gid?: string;
  readonly current_key?: string;
}

export interface GdataErrorEntry {
  readonly gid: number;
  readonly error: string;
}

export function gdataEntry(overrides: Partial<GdataEntry> = {}): GdataEntry {
  return {
    gid: 9000001,
    token: "a1b2c3d4e5",
    title: `[Sample Circle] Tom & Jerry's "Example" Gallery [English]`,
    title_jpn: "[サンプル] 例のギャラリー",
    category: "Doujinshi",
    thumb:
      "https://ehgt.org/01/23/0123456789abcdef0123456789abcdef01234567-345678-1280-1810-jpg_250.jpg",
    uploader: "sample uploader",
    posted: "1788265440",
    filecount: "24",
    filesize: 13107200,
    expunged: false,
    rating: "4.46",
    torrentcount: "1",
    torrents: [
      {
        hash: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        added: "1788269040",
        name: "Example Gallery.zip",
        tsize: "2048",
        fsize: "13000000",
      },
    ],
    tags: ["language:english", "female:sample tag", "artist:example artist"],
    ...overrides,
  };
}

export function gdataErrorEntry(
  gid: number,
  error = "Key missing, or incorrect key provided.",
): GdataErrorEntry {
  return { gid, error };
}

export function gdataJson(entries: readonly (GdataEntry | GdataErrorEntry)[]): string {
  return JSON.stringify({ gmetadata: entries });
}
