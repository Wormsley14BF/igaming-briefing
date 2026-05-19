const feeds = [
  {
    name: "iGaming Business",
    url: "https://igamingbusiness.com/feed/",
    weight: 14
  },
  {
    name: "SBC News",
    url: "https://sbcnews.co.uk/feed/",
    weight: 11
  },
  {
    name: "Gambling Insider",
    url: "https://www.gamblinginsider.com/rss",
    weight: 10
  },
  {
    name: "NEXT.io",
    url: "https://next.io/feed/",
    weight: 10
  },
  {
    name: "Focus Gaming News",
    url: "https://focusgn.com/feed",
    weight: 8
  },
  {
    name: "GGRAsia",
    url: "https://www.ggrasia.com/feed/",
    weight: 8
  },
  {
    name: "Google News: iGaming",
    url: "https://news.google.com/rss/search?q=igaming%20OR%20%22online%20gambling%22%20OR%20%22sports%20betting%22%20when%3A2d&hl=en-GB&gl=GB&ceid=GB%3Aen",
    weight: 6
  },
  {
    name: "Google News: EveryMatrix watchlist",
    url: "https://news.google.com/rss/search?q=EveryMatrix%20OR%20Bally%27s%20OR%20Kindred%20OR%20%22White%20Hat%20Gaming%22%20OR%20ComeOn%20gambling%20when%3A7d&hl=en-GB&gl=GB&ceid=GB%3Aen",
    weight: 12
  },
  {
    name: "Google News: regulation",
    url: "https://news.google.com/rss/search?q=%22gambling%20regulation%22%20OR%20%22illegal%20gambling%22%20OR%20%22responsible%20gambling%22%20when%3A2d&hl=en-GB&gl=GB&ceid=GB%3Aen",
    weight: 10
  }
];

const maxStories = 26;
const today = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London"
}).format(new Date());

function decodeEntities(value = "") {
  const entities = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
    nbsp: " "
  };

  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, entity) => entities[entity] || `&${entity};`);
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\bThe post .+? appeared first on .+?\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value = "") {
  return stripHtml(value)
    .replace(/\s+-\s+(iGamingFuture|AffPapa|NEXT\.io|iGaming Business|SBC News|Gambling Insider|Yogonet|Focus Gaming News|GGRAsia|European Gaming)$/i, "")
    .trim();
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function linkValue(xml) {
  const rssLink = tagValue(xml, "link");
  if (rssLink) return rssLink;

  const atomLink = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return atomLink ? decodeEntities(atomLink[1]) : "";
}

function itemBlocks(xml) {
  const rssItems = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  if (rssItems.length) return rssItems;

  return [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
}

async function fetchFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "user-agent": "Localize-Gaming-Briefing/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return itemBlocks(xml).map((item) => {
      const title = cleanTitle(tagValue(item, "title"));
      const description = cleanTitle(tagValue(item, "description") || tagValue(item, "summary") || tagValue(item, "content:encoded"));
      const rawDate = tagValue(item, "pubDate") || tagValue(item, "updated") || tagValue(item, "published");
      const date = rawDate ? new Date(rawDate) : new Date();

      return {
        title,
        description,
        source: cleanGoogleNewsUrl(linkValue(item)),
        sourceLabel: feed.name,
        feedWeight: feed.weight,
        publishedAt: Number.isNaN(date.getTime()) ? new Date() : date
      };
    }).filter((item) => item.title && item.source);
  } catch (error) {
    console.warn(`Skipped ${feed.name}: ${error.message}`);
    return [];
  }
}

function cleanGoogleNewsUrl(url) {
  try {
    const parsed = new URL(url);
    const target = parsed.searchParams.get("url");
    return target || url;
  } catch {
    return url;
  }
}

function normalise(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalTitle(value = "") {
  return normalise(value)
    .replace(/\b(the|a|an|to|of|for|and|in|on|with|from|by)\b/g, " ")
    .replace(/\b(next io|affpapa|igamingfuture|igaming business|sbc news|gambling insider|yogonet|focus gaming news|ggrasia|european gaming)\b$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value = "", limit = 230) {
  const text = stripHtml(value);
  if (text.length <= limit) return text;

  return `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}...`;
}

function has(text, pattern) {
  return pattern.test(text);
}

function priority(item) {
  const text = normalise(`${item.title} ${item.description} ${item.sourceLabel}`);
  let score = item.feedWeight;

  if (has(text, /everymatrix|bally|kindred|white hat|comeon/)) score += 50;
  if (has(text, /prediction market|kalshi|polymarket|cftc|sports integrity/)) score += 36;
  if (has(text, /regulat|illegal|black market|enforcement|fine|ban|tax|licen[cs]|safer gambling|responsible gambling/)) score += 30;
  if (has(text, /payment|wallet|cashier|kyc|aml|fraud|affordability|self exclusion|deposit|withdrawal/)) score += 28;
  if (has(text, /platform|pam|supplier|aggregation|content|technology|data|ai|crm|ux|app|mobile/)) score += 22;
  if (has(text, /brazil|uk|united kingdom|france|germany|netherlands|sweden|us|united states|canada|ontario|africa|nigeria|india|philippines|australia/)) score += 14;

  const ageHours = (Date.now() - item.publishedAt.getTime()) / 36e5;
  score -= Math.max(0, ageHours - 24) * 0.8;

  return score;
}

function sectionFor(item) {
  const text = normalise(`${item.title} ${item.description}`);

  if (has(text, /brazil|argentina|colombia|mexico|peru|chile|latam|latin america/)) return "LatAm";
  if (has(text, /africa|nigeria|kenya|south africa|ghana|cameroon|tanzania|uganda/)) return "Africa";
  if (has(text, /macau|philippines|pagcor|india|japan|australia|new zealand|asia|oceania|vietnam|thailand|singapore/)) return "Asia / Oceania";
  if (has(text, /united states| usa | us |canada|ontario|new york|california|colorado|minnesota|tennessee|rhode island|alberta|cftc|kalshi|fanduel|draftkings/)) return "North America";
  if (has(text, /uk|united kingdom|britain|ireland|france|anj|germany|spain|italy|sweden|denmark|netherlands|europe|malta|belgium/)) return "Europe";
  if (has(text, /ai|ux|platform|product|crm|mobile|app|kyc|wallet|payments|gamification|acquisition|retention/)) return "Product";

  return "Other / Global";
}

function tagsFor(item) {
  const text = normalise(`${item.title} ${item.description}`);
  const tags = [];
  const candidates = [
    ["EveryMatrix", /everymatrix/],
    ["Bally's", /bally/],
    ["Kindred", /kindred/],
    ["Prediction markets", /prediction market|kalshi|polymarket|cftc/],
    ["Regulation", /regulat|licen[cs]|fine|ban|enforcement/],
    ["Black market", /black market|illegal/],
    ["RG", /responsible gambling|safer gambling|self exclusion|affordability|harm/],
    ["Payments", /payment|wallet|cashier|deposit|withdrawal/],
    ["KYC", /kyc|aml|fraud|identity/],
    ["AI", /\bai\b|artificial intelligence/],
    ["CRM", /crm|retention|loyalty|bonus|promotion/],
    ["Brazil", /brazil/],
    ["UK", /uk|united kingdom|britain/],
    ["US", /united states| usa | us |new york|colorado|minnesota|tennessee|rhode island/],
    ["Africa", /africa|nigeria|kenya|south africa/],
    ["Asia", /macau|philippines|india|pagcor|asia/]
  ];

  candidates.forEach(([label, pattern]) => {
    if (pattern.test(text)) tags.push(label);
  });

  return [...new Set(tags)].slice(0, 5);
}

function whyFor(item) {
  const text = normalise(`${item.title} ${item.description}`);

  if (has(text, /payment|wallet|cashier|deposit|withdrawal/)) {
    return "Relevant to platform and wallet teams because regulation is increasingly expressed through payment routing, deposit controls, refunds and transaction evidence.";
  }

  if (has(text, /kyc|aml|fraud|affordability|responsible gambling|safer gambling|self exclusion|harm/)) {
    return "Relevant to PAM, KYC and RG tooling because more markets are turning customer-risk checks into auditable product workflows.";
  }

  if (has(text, /prediction market|kalshi|polymarket|cftc|sports integrity/)) {
    return "Relevant because prediction markets are becoming a live competitive and regulatory threat model for sportsbooks, data suppliers and compliance teams.";
  }

  if (has(text, /ai|ux|crm|acquisition|retention|app|mobile|gamification/)) {
    return "Relevant to product teams because acquisition, retention and compliance outcomes increasingly depend on the quality of lifecycle tooling and customer journeys.";
  }

  if (has(text, /supplier|platform|technology|aggregation|content/)) {
    return "Relevant to B2B platform strategy because supplier differentiation is moving toward stronger content, data, distribution and operational control.";
  }

  return "Worth tracking for operator strategy, regulated-market entry, competitor positioning and product roadmap implications.";
}

function storyFromItem(item) {
  const summary = compact(item.description || item.title, 230);

  return {
    section: sectionFor(item),
    title: item.title,
    meta: `${item.sourceLabel} | ${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London"
    }).format(item.publishedAt)}`,
    summary,
    why: whyFor(item),
    expanded: summary && summary !== item.title
      ? `${summary} ${whyFor(item)}`
      : whyFor(item),
    source: item.source,
    tags: tagsFor(item)
  };
}

function dedupe(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = canonicalTitle(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function platformLens(stories) {
  const lens = [
    {
      test: /payment|wallet|cashier|deposit|withdrawal|black market|illegal/i,
      title: "Payments and channelisation",
      text: "Payment flows, illegal-market blocking and cashier restrictions remain core platform-control areas.",
      sourceLabel: "Source"
    },
    {
      test: /responsible gambling|safer gambling|self exclusion|affordability|kyc|aml|fraud|harm/i,
      title: "Risk checks are becoming product workflows",
      text: "Regulatory pressure is moving risk detection, eligibility and intervention evidence directly into account journeys.",
      sourceLabel: "Source"
    },
    {
      test: /prediction market|kalshi|polymarket|cftc|sports integrity/i,
      title: "Prediction markets need active tracking",
      text: "US event-contract disputes are now relevant to sportsbook strategy, data partnerships and market access.",
      sourceLabel: "Source"
    },
    {
      test: /ai|ux|crm|acquisition|retention|app|mobile|gamification|platform/i,
      title: "Product quality is a commercial control",
      text: "Acquisition, retention and compliance are increasingly dependent on mobile UX, CRM, AI-assisted operations and configurable platform rules.",
      sourceLabel: "Source"
    }
  ];

  return lens.map((item) => {
    const match = stories.find((story) => item.test.test(`${story.title} ${story.summary} ${(story.tags || []).join(" ")}`)) || stories[0];

    return {
      title: item.title,
      text: item.text,
      source: match?.source || "",
      sourceLabel: match?.meta?.split("|")[0]?.trim() || item.sourceLabel
    };
  });
}

function atAGlance(stories) {
  return stories.slice(0, 5).map((story) => ({
    title: story.title,
    text: story.summary,
    source: story.source,
    tags: story.tags || []
  }));
}

function renderJs(meta, stories) {
  return `window.briefingMeta = ${JSON.stringify(meta, null, 2)};\n\nwindow.briefingStories = ${JSON.stringify(stories, null, 2)};\n`;
}

const rawItems = (await Promise.all(feeds.map(fetchFeed))).flat();
const ranked = dedupe(rawItems)
  .map((item) => ({ item, score: priority(item) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, maxStories)
  .map(({ item }) => storyFromItem(item));

if (!ranked.length) {
  throw new Error("No briefing stories were fetched from the configured feeds.");
}

const meta = {
  dateLabel: `${today} | automated public-site edition`,
  atAGlance: atAGlance(ranked),
  platformLens: platformLens(ranked)
};

const { writeFile } = await import("node:fs/promises");
await writeFile("briefing-data.js", renderJs(meta, ranked));

console.log(`Wrote ${ranked.length} stories to briefing-data.js`);
