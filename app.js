let stories = [];

const briefingDataEndpoint = "https://script.google.com/macros/s/AKfycbyLQYk0EJJgLX_vtolh_H2IHoYYio-LqQSisd1wNNRALi-uhoV8_yQwn8z3MhnCxZ_rMg/exec";
const defaultMeta = {
  dateLabel: "Latest briefing",
  atAGlance: [],
  platformLens: []
};

const sectionContainers = [...document.querySelectorAll("[data-section]")];
const searchInput = document.querySelector("#searchInput");
const expandAll = document.querySelector("#expandAll");
const collapseAll = document.querySelector("#collapseAll");
const briefingDate = document.querySelector("#briefingDate");
const leadPackage = document.querySelector("#leadPackage");
const topStoriesList = document.querySelector("#topStoriesList");
const analysisGrid = document.querySelector("#analysisGrid");
const editorialDeskLabels = {
  "Regulation & Enforcement": "Regulation",
  "Operators & Strategy": "Strategy",
  "Product & Platform": "Product",
  Markets: "Market",
  "Suppliers & Technology": "Supplier",
  Analysis: "Analysis"
};

function loadFreshData() {
  return new Promise((resolve) => {
    window.briefingStories = null;
    window.briefingMeta = null;

    const script = document.createElement("script");
    script.src = `./briefing-data.js?v=${Date.now()}`;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function loadRemoteBriefingData() {
  return new Promise((resolve) => {
    const callbackName = `receiveBriefingData${Date.now()}`;
    let resolved = false;

    window[callbackName] = (payload) => {
      resolved = true;
      if (payload?.meta && Array.isArray(payload?.stories)) {
        window.briefingMeta = payload.meta;
        window.briefingStories = payload.stories;
      }
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const script = document.createElement("script");
    script.src = `${briefingDataEndpoint}?mode=briefing&callback=${callbackName}&v=${Date.now()}`;
    script.onerror = () => {
      if (!resolved) {
        cleanup();
        resolve(false);
      }
    };

    setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(false);
      }
    }, 4000);

    document.head.appendChild(script);
  });
}

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase();
}

function promotedStoryKeys() {
  const signals = topStoryItems();
  const lensItems = window.briefingMeta?.platformLens || [];
  const keys = new Set();

  const addFrom = (item) => {
    const normalized = typeof item === "string"
      ? { text: item, title: stripHtml(item) }
      : item;
    const source = normalizedKey(normalized.source);
    const title = normalizedKey(normalized.title || stripHtml(normalized.text));

    if (source) keys.add(`source:${source}`);
    if (title) keys.add(`title:${title}`);
  };

  signals.forEach(addFrom);
  lensItems.forEach(addFrom);

  return keys;
}

function isPromotedStory(story, keys) {
  const source = normalizedKey(story.source);
  const title = normalizedKey(story.title);

  return (source && keys.has(`source:${source}`)) || (title && keys.has(`title:${title}`));
}

function topStoryItems() {
  return window.briefingMeta?.atAGlance?.length
    ? window.briefingMeta.atAGlance
    : stories.slice(0, 5).map((story) => ({
      text: story.summary,
      source: story.source,
      title: story.title,
      tags: story.tags,
      section: "Top Stories"
    }));
}

function storyBlob(story) {
  return [
    story.section,
    story.title,
    story.meta,
    story.summary,
    story.why,
    story.expanded,
    story.commentary,
    story.takeaway,
    story.source,
    ...(story.tags || [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function storyCoreBlob(story) {
  return [
    story.section,
    story.title,
    story.meta,
    story.summary,
    story.source,
    ...(story.tags || [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function matchingStoryForSignal(signal) {
  const normalized = typeof signal === "string"
    ? { text: signal, title: stripHtml(signal) }
    : signal;
  const source = normalizedKey(normalized.source);
  const title = normalizedKey(normalized.title || stripHtml(normalized.text));

  return stories.find((story) => source && normalizedKey(story.source) === source)
    || stories.find((story) => title && normalizedKey(story.title) === title);
}

function editorialSection(story) {
  const blob = storyBlob(story);
  const core = storyCoreBlob(story);

  if (story.section === "Industry Notes") return "Analysis";
  if (story.section === "Product" && /ux|kyc|platform|localisation|localization|wallet|payments|account/.test(core)) return "Product & Platform";
  if (/operator|bally|evoke|draftkings|flutter|betmgm|penn|caesars|rsi|super group|earnings|m&a|acquisition|retention|crm/.test(core)) return "Operators & Strategy";
  if (/everymatrix|relax|arrise|supplier licensing|supplier compliance|aggregation|content distribution|turnkey|technology live/.test(core)) return "Suppliers & Technology";
  if (/anj|regulat|enforcement|illegal|taskforce|advertising|payment blocking|betstop|eligibility|desenrola|acma|ontario|indonesia|fraud|world cup/.test(blob)) return "Regulation & Enforcement";
  if (/ux|platform|product|kyc|wallet|payments|localisation|localization|compliance journeys|rg tooling|account/.test(blob)) return "Product & Platform";
  if (/brazil|africa|nigeria|cameroon|latam|europe|north america|asia|oceania|australia|minnesota|france|uk|us|canada/.test(blob)) return "Markets";

  return "Markets";
}

function regionLabel(story) {
  const blob = storyBlob(story);

  if (/brazil|latam/.test(blob)) return "LatAm";
  if (/nigeria|africa|cameroon/.test(blob)) return "Africa";
  if (/australia|indonesia|asia|oceania/.test(blob)) return "Asia-Pacific";
  if (/us|united states|minnesota|ontario|canada|north america/.test(blob)) return "North America";
  if (/france|uk|denmark|europe/.test(blob)) return "Europe";

  return story.section;
}

function briefingDateLabel() {
  return (window.briefingMeta?.dateLabel || "").split("|")[0].trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#039;");
}

function stripHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = value || "";
  return template.content.textContent || template.content.innerText || "";
}

function leadTemplate(signal, index) {
  const normalized = typeof signal === "string"
    ? { text: signal, source: "", title: stripHtml(signal), tags: [], section: "Top Stories" }
    : signal;
  const linkedStory = matchingStoryForSignal(normalized) || stories[0] || {};
  const title = normalized.title || linkedStory.title || stripHtml(normalized.text);
  const source = normalized.source || linkedStory.source || "";
  const deck = stripHtml(normalized.text || linkedStory.summary || "");
  const why = linkedStory.why || linkedStory.takeaway || linkedStory.summary || "A cross-market signal worth watching for operators, suppliers and product teams.";
  const tags = (normalized.tags || linkedStory.tags || [])
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  const sourceLink = source
    ? `<a class="source-button" href="${escapeAttribute(source)}" target="_blank" rel="noopener noreferrer">Read source</a>`
    : "";

  return `
    <article class="lead-story" data-signal-title="${escapeAttribute(title)}" data-signal-source="${escapeAttribute(source)}" data-signal-tags="${escapeAttribute((normalized.tags || linkedStory.tags || []).join(", "))}">
      <div class="lead-label">Lead story</div>
      <h3>${source ? `<a href="${escapeAttribute(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>` : escapeHtml(title)}</h3>
      <p class="lead-deck">${escapeHtml(deck)}</p>
      <p class="lead-read"><span class="label">Why it matters:</span> ${escapeHtml(why)}</p>
      <div class="lead-footer">
        <div class="tag-row">${tags}</div>
        <div class="lead-actions">
          ${sourceLink}
        </div>
      </div>
    </article>
  `;
}

function renderMeta() {
  const meta = window.briefingMeta || defaultMeta;
  briefingDate.textContent = meta.dateLabel || defaultMeta.dateLabel;

  const glanceItems = topStoryItems();
  leadPackage.innerHTML = glanceItems.length ? leadTemplate(glanceItems[0], 0) : "";
  topStoriesList.innerHTML = glanceItems.slice(1).map(signalTemplate).join("");

  const lensItems = meta.platformLens?.length
    ? meta.platformLens
    : stories.slice(0, 4).map((story) => ({
      title: story.tags?.[0] || story.section,
      text: story.why || story.takeaway || story.summary,
      source: story.source,
      sourceLabel: "Source"
    }));

  analysisGrid.innerHTML = lensItems.map((item) => `
    <article>
      <span class="analysis-label">Platform read</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
      ${item.source ? `<a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceLabel || "Source")}</a>` : ""}
    </article>
  `).join("");
}

function renderWatchlist() {
  const grid = document.querySelector("#watchlistGrid");
  if (!grid) return;

  const items = window.briefingMeta?.watchlist || [];

  if (!items.length) {
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = items.map((item) => {
    const links = (item.links || []).map((link) => `<a href="${escapeAttribute(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("");
    return `
      <article>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="link-list">${links}</div>
      </article>
    `;
  }).join("");
}

function signalTemplate(signal, index) {
  const normalized = typeof signal === "string"
    ? { text: signal, source: "", title: stripHtml(signal), tags: [], section: "Top Stories" }
    : signal;
  const title = normalized.title || stripHtml(normalized.text);
  const source = normalized.source || "";
  const deck = stripHtml(normalized.text || title);
  const tags = (normalized.tags || []).map((tag) => `<span class="signal-tag">${escapeHtml(tag)}</span>`).join("");

  return `
    <li class="signal-item" data-signal-title="${escapeAttribute(title)}" data-signal-source="${escapeAttribute(source)}" data-signal-tags="${escapeAttribute((normalized.tags || []).join(", "))}">
      <div class="signal-content">
        <h3>${source ? `<a href="${escapeAttribute(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>` : escapeHtml(title)}</h3>
        <p>${escapeHtml(deck)}</p>
        <div class="signal-tags">${tags}</div>
      </div>
    </li>
  `;
}

function cardTemplate(story, index, storyIndex) {
  const isIndustry = story.section === "Industry Notes";
  const detailParts = [];
  const desk = editorialSection(story);
  const impact = story.why || story.takeaway || story.expanded || story.commentary || "";
  const titleHtml = story.source
    ? `<a href="${escapeHtml(story.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(story.title)}</a>`
    : escapeHtml(story.title);

  if (isIndustry) {
    detailParts.push(`<p class="detail-block"><span class="label">Expanded commentary:</span> ${escapeHtml(story.commentary)}</p>`);
    detailParts.push(`<p class="detail-block"><span class="label">Product-team takeaway:</span> ${escapeHtml(story.takeaway)}</p>`);
  } else {
    detailParts.push(`<p class="detail-block"><span class="label">Why it matters:</span> ${escapeHtml(story.why)}</p>`);
    if (story.expanded) {
      detailParts.push(`<p class="detail-block"><span class="label">Executive summary:</span> ${escapeHtml(story.expanded)}</p>`);
    }
  }

  if (story.source) {
    detailParts.push(`<p class="detail-block"><a href="${escapeHtml(story.source)}" target="_blank" rel="noopener noreferrer">Open source</a></p>`);
  }

  const tags = (story.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

  return `
    <article class="story-card" data-kind="${escapeHtml(desk)}" data-story-id="${storyIndex}">
      <div class="card-summary">
        <div class="story-kicker">
          <span class="rank">${index + 1}</span>
          <span>${escapeHtml(editorialDeskLabels[desk] || desk)}</span>
          <span>${escapeHtml(regionLabel(story))}</span>
        </div>
        <div>
          <h3 class="story-title">${titleHtml}</h3>
          <p class="meta">${escapeHtml(story.meta)}</p>
          <p class="summary"><span class="label">Signal:</span> ${escapeHtml(story.summary)}</p>
          ${impact ? `<p class="story-impact"><span class="label">Implication:</span> ${escapeHtml(impact)}</p>` : ""}
          <div class="tag-row">${tags}</div>
        </div>
        <div class="card-actions">
          <button class="card-toggle" type="button" aria-expanded="false">Explain</button>
        </div>
      </div>
      <div class="card-detail">${detailParts.join("")}</div>
    </article>
  `;
}

function searchText(story) {
  return [
    storyBlob(story),
    editorialSection(story),
    regionLabel(story)
  ].join(" ").toLowerCase();
}

function renderStories() {
  const promotedKeys = promotedStoryKeys();

  sectionContainers.forEach((container) => {
    const section = container.dataset.section;
    const sectionStories = stories
      .map((story, storyIndex) => ({ story, storyIndex }))
      .filter(({ story }) => editorialSection(story) === section)
      .filter(({ story }) => !isPromotedStory(story, promotedKeys));

    container.innerHTML = sectionStories
      .map(({ story, storyIndex }, index) => cardTemplate(story, index, storyIndex))
      .join("");

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.dataset.defaultText = "No matching items in this desk.";
    empty.textContent = empty.dataset.defaultText;
    container.appendChild(empty);

    const sectionElement = container.closest(".panel, .story-section");
    sectionElement?.classList.toggle("is-empty-desk", sectionStories.length === 0);
  });

  updateDeskNavigation();
}

function toggleCard(button) {
  const card = button.closest(".story-card");
  const isOpen = card.classList.toggle("open");
  button.textContent = isOpen ? "Collapse" : "Explain";
  button.setAttribute("aria-expanded", String(isOpen));
}

function setAll(open) {
  document.querySelectorAll(".story-card").forEach((card) => {
    card.classList.toggle("open", open);
    const button = card.querySelector(".card-toggle");
    button.textContent = open ? "Collapse" : "Explain";
    button.setAttribute("aria-expanded", String(open));
  });
}

function filterStories() {
  const query = searchInput.value.trim().toLowerCase();
  document.body.classList.toggle("has-search", Boolean(query));

  sectionContainers.forEach((container) => {
    const cards = [...container.querySelectorAll(".story-card")];
    const sectionElement = container.closest(".panel, .story-section");
    let visibleCount = 0;

    cards.forEach((card) => {
      const story = stories[Number(card.dataset.storyId)];
      const match = !query || searchText(story).includes(query);
      card.classList.toggle("hidden", !match);
      if (match) visibleCount += 1;
    });

    const empty = container.querySelector(".empty-state");
    empty.textContent = query ? "No matching items in this section." : empty.dataset.defaultText;
    empty.classList.toggle("visible", Boolean(query) && cards.length > 0 && visibleCount === 0);
    sectionElement?.classList.toggle("is-empty-desk", cards.length === 0 || (Boolean(query) && visibleCount === 0));
  });

  updateDeskNavigation();
}

function updateDeskNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const target = document.querySelector(link.getAttribute("href"));
    const canHide = target?.matches(".story-section, .analysis-panel");
    link.hidden = Boolean(canHide && target.classList.contains("is-empty-desk"));
  });
}

function setupSectionToggles() {
  const sections = [...document.querySelectorAll(".panel, .story-section")];

  sections.forEach((section) => {
    const heading = section.querySelector(".section-heading");
    if (!heading || heading.querySelector(".section-toggle")) return;

    const button = document.createElement("button");
    button.className = "section-toggle";
    button.type = "button";
    button.textContent = "Collapse section";
    button.setAttribute("aria-expanded", "true");

    heading.appendChild(button);

    button.addEventListener("click", () => {
      const isCollapsed = section.classList.toggle("section-collapsed");
      button.textContent = isCollapsed ? "Expand section" : "Collapse section";
      button.setAttribute("aria-expanded", String(!isCollapsed));
    });
  });
}

function updateActiveNav() {
  const links = [...document.querySelectorAll(".nav-link:not([hidden])")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  let activeId = sections[0]?.id;

  for (const section of sections) {
    if (section.getBoundingClientRect().top <= 120) {
      activeId = section.id;
    }
  }

  links.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${activeId}`);
  });
}

async function init() {
  await loadFreshData();
  const localStoryCount = Array.isArray(window.briefingStories) ? window.briefingStories.length : 0;

  if (!localStoryCount) {
    await loadRemoteBriefingData();
  }

  stories = Array.isArray(window.briefingStories) ? window.briefingStories : [];
  renderMeta();
  renderWatchlist();
  renderStories();
  setupSectionToggles();
  filterStories();
}

document.addEventListener("click", (event) => {
  if (event.target.matches(".card-toggle")) {
    toggleCard(event.target);
  }
});

searchInput.addEventListener("input", filterStories);
expandAll.addEventListener("click", () => setAll(true));
collapseAll.addEventListener("click", () => setAll(false));
document.addEventListener("scroll", updateActiveNav, { passive: true });

init();
