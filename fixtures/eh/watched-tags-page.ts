import { escapeHtml, pageShell, type Site, siteBase } from "./page-shell";

/** One entry of My Tags. */
export interface UserTag {
  readonly id: number;
  /** As the preview's `title` shows it: `namespace:name`. */
  readonly tag: string;
  readonly watched: boolean;
  readonly hidden: boolean;
  /** `#rrggbb`, or empty for the default colour. */
  readonly color: string;
  readonly weight: number;
}

export interface WatchedTagsPage {
  readonly site: Site;
  readonly tags: readonly UserTag[];
  /** The number of tags the tag set select states; the number of `tags` when left out. */
  readonly tagSetCount?: number;
}

/** The colours the preview of a watched tag with the default colour is drawn in. */
const WatchedPreviewStyle =
  "color:#f1f1f1;border-color:#1357df;background:radial-gradient(#1357df,#3377FF) !important";

export function userTag(overrides: Partial<UserTag> = {}): UserTag {
  return {
    id: 101,
    tag: "female:sample tag",
    watched: true,
    hidden: false,
    color: "",
    weight: 10,
    ...overrides,
  };
}

export function watchedTagsPageHtml(overrides: Partial<WatchedTagsPage> = {}): string {
  const page: WatchedTagsPage = { site: "eh", tags: [userTag()], ...overrides };
  const base = siteBase(page.site);
  const count = page.tagSetCount ?? page.tags.length;
  return pageShell(
    page.site,
    `<div class="stuffbox" id="outer">${tagSetForm(count)}<form id="usertag_form" action="" method="post"><input type="hidden" id="usertag_action" name="usertag_action" value="" /><div id="usertags_outer">${newTagRow()}${page.tags.map((tag) => tagRow(tag, base)).join("")}</div><div id="usertags_mass"><div><input id="usertags_button" type="button" onclick="do_usertags_mass()" value="Delete Selected" /></div><div><select id="usertag_target" name="usertag_target"><option value="delete" selected="selected">Delete Selected</option></select></div></div></form></div>`,
  );
}

function tagSetForm(count: number): string {
  return `<form id="tagset_form" action="" method="post"><div id="tagset_outer"><div><input type="button" onclick="do_tagset_rename()" value="Rename" /></div><div><input type="hidden" id="tagset_action" name="tagset_action" value="" /><input type="hidden" id="tagset_name" name="tagset_name" value="" /><select onchange="change_tagset(this.value)"><option value="1" selected="selected">Tagset #1 (${count})</option></select></div><div><label class="lc"><input type="checkbox" name="tagset_enable" id="tagset_enable" checked="checked" onchange="allow_tagsave(-1)" /><span></span> Enable</label></div><div><input type="text" name="tagset_color" id="tagcolor" value="" placeholder="#default" size="7" maxlength="7" /></div></div></form>`;
}

/** The form for a new tag, which the page prints first, as `usertag_0`. */
function newTagRow(): string {
  return `<div id="usertag_0"><div><div class="tagcomplete"><input type="text" id="tagname_new" name="tagname_new" value="" placeholder="Enter a single tag to flag, watch or hide" size="80" maxlength="200" /></div></div>${checkbox("tagwatch", 0, false, "Watched")}${checkbox("taghide", 0, false, "Hidden")}<div><input type="text" id="tagcolor_0" name="tagcolor_new" class="tagcolor" value="" placeholder="#default" size="7" maxlength="7" /></div><div><input type="text" id="tagweight_0" name="tagweight_new" value="10" placeholder="10" size="3" maxlength="3" /></div><div><input type="submit" id="tagsave_0" value="Save" disabled="disabled" /></div></div>`;
}

function tagRow(entry: UserTag, base: string): string {
  const title = escapeHtml(entry.tag);
  const name = escapeHtml(entry.tag.slice(entry.tag.indexOf(":") + 1));
  const style = entry.watched ? ` style="${WatchedPreviewStyle}"` : "";
  return `<div id="usertag_${entry.id}"><div><a href="${base}tag/${entry.tag.replaceAll(" ", "+")}"><div id="tagpreview_${entry.id}" class="gt"${style} title="${title}">${name}</div></a></div>${checkbox("tagwatch", entry.id, entry.watched, "Watched")}${checkbox("taghide", entry.id, entry.hidden, "Hidden")}<div><input type="text" id="tagcolor_${entry.id}" class="tagcolor" value="${entry.color}" placeholder="#default" size="7" maxlength="7" /></div><div><input type="text" id="tagweight_${entry.id}" value="${entry.weight}" placeholder="10" size="3" maxlength="3" /></div><div id="selector_${entry.id}"><label class="lc"><input type="checkbox" name="modify_usertags[]" value="${entry.id}" /><span></span></label></div></div>`;
}

function checkbox(
  kind: "tagwatch" | "taghide",
  id: number,
  isChecked: boolean,
  label: string,
): string {
  const checked = isChecked ? ' checked="checked"' : "";
  return `<div><label class="lc"><input type="checkbox" id="${kind}_${id}"${checked} /><span></span> ${label}</label></div>`;
}
