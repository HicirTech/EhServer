/**
 * The strings a collector takes from a page, entities already decoded. Each collector fills these;
 * the shared assemblers decide what they mean, so the two collectors differ only in HTML access.
 */

export interface RawListRow {
  isHeader: boolean;
  message?: string | undefined;
  href?: string | undefined;
  title?: string | undefined;
  category?: string | undefined;
  posted?: string | undefined;
  ratingStyle?: string | undefined;
  thumbnail?: string | undefined;
  uploader?: string | undefined;
  pages?: string | undefined;
  tags: string[];
}

/** A pager entry is an `<a>` when the page exists and a `<span>` when it does not. */
export interface RawPagerLink {
  readonly tagName: string;
  readonly href?: string | undefined;
}

export interface RawListPage {
  tableClass?: string | undefined;
  rows: RawListRow[];
  searchText?: string | undefined;
  prev?: RawPagerLink | undefined;
  next?: RawPagerLink | undefined;
}

export interface RawMetadataRow {
  label?: string | undefined;
  value?: string | undefined;
  href?: string | undefined;
}

export interface RawTagGroup {
  namespace?: string | undefined;
  names: string[];
}

export interface RawComment {
  elementId?: string | undefined;
  header?: string | undefined;
  author?: string | undefined;
  score?: string | undefined;
  /** Text with each `<br>` turned into `\n`. */
  body: string;
  edited?: string | undefined;
}

export interface RawDetailPage {
  scripts: string[];
  paragraphs: string[];
  errorBox?: string | undefined;
  title?: string | undefined;
  titleJpn?: string | undefined;
  category?: string | undefined;
  uploader?: string | undefined;
  metadata: RawMetadataRow[];
  ratingLabel?: string | undefined;
  ratingCount?: string | undefined;
  tagGroups: RawTagGroup[];
  actionTexts: string[];
  showing?: string | undefined;
  previewHrefs: string[];
  comments: RawComment[];
}

export function newListRow(): RawListRow {
  return { isHeader: false, tags: [] };
}

export function newListPage(): RawListPage {
  return { rows: [] };
}

export function newDetailPage(): RawDetailPage {
  return {
    scripts: [],
    paragraphs: [],
    metadata: [],
    tagGroups: [],
    actionTexts: [],
    previewHrefs: [],
    comments: [],
  };
}
