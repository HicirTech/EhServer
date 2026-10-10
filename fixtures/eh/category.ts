/** Each category label with the colour class and URL slug the site prints next to it. */
const Categories: Readonly<Record<string, { readonly colour: string; readonly slug: string }>> = {
  Doujinshi: { colour: "ct2", slug: "doujinshi" },
  Manga: { colour: "ct3", slug: "manga" },
  "Artist CG": { colour: "ct4", slug: "artistcg" },
  "Game CG": { colour: "ct5", slug: "gamecg" },
  Western: { colour: "cta", slug: "western" },
  "Non-H": { colour: "ct9", slug: "non-h" },
  "Image Set": { colour: "ct6", slug: "imageset" },
  Cosplay: { colour: "ct7", slug: "cosplay" },
  "Asian Porn": { colour: "ct8", slug: "asianporn" },
  Misc: { colour: "ct1", slug: "misc" },
};

/** An unknown label gets a made-up class, so tests can feed a category the site does not have. */
export function categoryDiv(label: string, kind: "cn" | "cs", base: string): string {
  const category = Categories[label] ?? { colour: "ctx", slug: "unknown" };
  return `<div class="${kind} ${category.colour}" onclick="document.location='${base}${category.slug}'">${label}</div>`;
}
