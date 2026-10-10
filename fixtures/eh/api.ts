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
    rating: "4.12",
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

/** A `showpage` answer in the keys a 2019 capture has; the original link sits in `i6` since 2023-10. */
export interface ShowpageAnswer {
  readonly gid: number;
  readonly galleryToken: string;
  readonly number: number;
  readonly pageToken: string;
  readonly imageUrl: string;
  readonly reloadKey: string;
  readonly width: number;
  readonly height: number;
  readonly originalIn: "i6" | "i7" | null;
  readonly originalKey: string;
}

export function showpageAnswer(overrides: Partial<ShowpageAnswer> = {}): ShowpageAnswer {
  return {
    gid: 9000001,
    galleryToken: "a1b2c3d4e5",
    number: 3,
    pageToken: "0a0a0a0a03",
    imageUrl:
      "http://198.51.100.7:2688/h/0123456789abcdef0123456789abcdef01234567-345678-1280-1810-jpg/keystamp=1788265440-0a1b2c3d4e;fileindex=1234567;xres=1280/sample_003.jpg",
    reloadKey: "12345-678901",
    width: 1280,
    height: 1810,
    originalIn: "i6",
    originalKey: "0a1b2c3d4e5",
    ...overrides,
  };
}

export function showpageJson(overrides: Partial<ShowpageAnswer> = {}): string {
  const answer = showpageAnswer(overrides);
  const site = "https://e-hentai.org/";
  const original = `<img src="https://ehgt.org/g/mr.gif" class="mr" /> <a href="${site}fullimg.php?gid=${answer.gid}&amp;page=${answer.number}&amp;key=${answer.originalKey}">Download original 2560 x 3620 2.4 MB source</a>`;
  const next = `${site}s/0a0a0a0a04/${answer.gid}-${answer.number + 1}`;
  return JSON.stringify({
    p: answer.number,
    s: `s/${answer.pageToken}/${answer.gid}-${answer.number}`,
    n: `<div class="sn"><a id="next" onclick="return load_image(${answer.number + 1}, '0a0a0a0a04')" href="${next}"><img src="https://ehgt.org/g/n.png" /></a></div>`,
    i: `<div>sample_003.jpg :: ${answer.width} x ${answer.height} :: 337.6 KB</div>`,
    k: answer.pageToken,
    i3: `<a onclick="return load_image(${answer.number + 1}, '0a0a0a0a04')" href="${next}"><img id="img" src="${answer.imageUrl}" style="width:${answer.width}px;height:${answer.height}px" onerror="this.onerror=null; nl('${answer.reloadKey}')" /></a>`,
    i5: `<div class="sb"><a href="${site}g/${answer.gid}/${answer.galleryToken}/"><img src="https://ehgt.org/g/b.png" referrerpolicy="no-referrer" /></a></div>`,
    i6: ` &nbsp; <img src="https://ehgt.org/g/mr.gif" class="mr" /> <a href="${site}?f_shash=0123456789abcdef0123456789abcdef01234567">Show all galleries with this file</a>${answer.originalIn === "i6" ? ` &nbsp; ${original}` : ""} &nbsp; <img src="https://ehgt.org/g/mr.gif" class="mr" /> <a href="#" id="loadfail" onclick="return nl('${answer.reloadKey}')">Click here if the image fails loading</a>`,
    i7: answer.originalIn === "i7" ? ` &nbsp; ${original}` : null,
    si: 12345,
    x: String(answer.width),
    y: String(answer.height),
  });
}

/** A `gtoken` answer: one item per requested page, a gallery token or the site's error. */
export function gtokenJson(
  items: readonly ({ readonly gid: number; readonly token: string } | { readonly error: string })[],
): string {
  return JSON.stringify({ tokenlist: items });
}
