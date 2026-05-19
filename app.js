let stories = [];

const ratingsEndpoint = "https://script.google.com/macros/s/AKfycbyLQYk0EJJgLX_vtolh_H2IHoYYio-LqQSisd1wNNRALi-uhoV8_yQwn8z3MhnCxZ_rMg/exec";
const briefingDataEndpoint = ratingsEndpoint;
const userName = "Robert Smith";
const defaultMeta = {
  dateLabel: "Latest briefing",
  atAGlance: [],
  platformLens: []
};

const sectionContainers = [...document.querySelectorAll("[data-section]")];
const searchInput = document.querySelector("#searchInput");
const expandAll = document.querySelector("#expandAll");
const collapseAll = document.querySelector("#collapseAll");
const copyScores = document.querySelector("#copyScores");
const briefingDate = document.querySelector("#briefingDate");
const leadPackage = document.querySelector("#leadPackage");
const topStoriesList = document.querySelector("#topStoriesList");
const analysisGrid = document.querySelector("#analysisGrid");
const ratingsKey = "igaming-briefing-relevance-v1";
const sectionImages = {
  Product: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=75",
  "Industry Notes": "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=75",
  Europe: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=900&q=75",
  "North America": "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=900&q=75",
  LatAm: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=900&q=75",
  Africa: "https://images.unsplash.com/photo-1489493887464-892be6d1daae?auto=format&fit=crop&w=900&q=75",
  "Asia / Oceania": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=900&q=75",
  "Other / Global": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=75"
};
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

function getRatings() {
  try {
    return JSON.parse(localStorage.getItem(ratingsKey) || "{}");
  } catch {
    return {};
  }
}

function setRating(storyId, rating) {
  const ratings = getRatings();
  ratings[storyId] = Number(rating);
  localStorage.setItem(ratingsKey, JSON.stringify(ratings));
}

function storyId(story) {
  return [story.section, story.title, story.source || story.meta].join("|");
}

function signalId(signal, index) {
  return ["Morning Signal", signal.text || signal, signal.source || index].join("|");
}

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase();
}

function promotedStoryKeys() {
  const signals = topStoryItems();
  const keys = new Set();

  signals.forEach((signal) => {
    const normalized = typeof signal === "string"
      ? { text: signal, title: stripHtml(signal) }
      : signal;
    const source = normalizedKey(normalized.source);
    const title = normalizedKey(normalized.title || stripHtml(normalized.text));

    if (source) keys.add(`source:${source}`);
    if (title) keys.add(`title:${title}`);
  });

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

function storyImage(story) {
  return story.image || sectionImages[story.section] || sectionImages["Other / Global"];
}

function leadTemplate(signal, index) {
  const normalized = typeof signal === "string"
    ? { text: signal, source: "", title: stripHtml(signal), tags: [], section: "Top Stories" }
    : signal;
  const linkedStory = matchingStoryForSignal(normalized) || stories[0] || {};
  const id = signalId(normalized, index);
  const title = normalized.title || linkedStory.title || stripHtml(normalized.text);
  const source = normalized.source || linkedStory.source || "";
  const deck = stripHtml(normalized.text || linkedStory.summary || "");
  const why = linkedStory.why || linkedStory.takeaway || linkedStory.summary || "A cross-market signal worth watching for operators, suppliers and product teams.";
  const tags = (normalized.tags || linkedStory.tags || [])
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  const sourceLink = source
    ? `<a class="source-button" href="${escapeAttribute(source)}">Read source</a>`
    : "";

  return `
    <article class="lead-story" data-signal-title="${escapeAttribute(title)}" data-signal-source="${escapeAttribute(source)}" data-signal-tags="${escapeAttribute((normalized.tags || linkedStory.tags || []).join(", "))}">
      <div class="lead-label">Lead story</div>
      <h3>${source ? `<a href="${escapeAttribute(source)}">${escapeHtml(title)}</a>` : escapeHtml(title)}</h3>
      <p class="lead-deck">${escapeHtml(deck)}</p>
      <p class="lead-read"><span class="label">Why it matters:</span> ${escapeHtml(why)}</p>
      <div class="lead-footer">
        <div class="tag-row">${tags}</div>
        <div class="lead-actions">
          ${ratingTemplate(normalized, id, true)}
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
      ${item.source ? `<a href="${escapeHtml(item.source)}">${escapeHtml(item.sourceLabel || "Source")}</a>` : ""}
    </article>
  `).join("");
}

function ratingTemplate(item, id, compact = false) {
  const savedRating = getRatings()[id];
  const options = [5, 4, 3, 2, 1].map((score) => `
    <label class="rating-option ${Number(savedRating) === score ? "selected" : ""}">
      <input type="radio" name="rating-${escapeHtml(id)}" value="${score}" ${Number(savedRating) === score ? "checked" : ""}>
      <span aria-hidden="true">★</span>
      <span class="sr-only">${score}</span>
    </label>
  `).join("");

  return `
    <fieldset class="rating-control ${compact ? "rating-compact" : ""}" data-story-rating="${escapeAttribute(id)}">
      <legend>${compact ? "Rate" : "Relevance"}</legend>
      <div class="rating-options">${options}</div>
      <p class="rating-status" aria-live="polite">${savedRating ? "Saved locally" : ""}</p>
    </fieldset>
  `;
}

function signalTemplate(signal, index) {
  const normalized = typeof signal === "string"
    ? { text: signal, source: "", title: stripHtml(signal), tags: [], section: "Top Stories" }
    : signal;
  const id = signalId(normalized, index);
  const title = normalized.title || stripHtml(normalized.text);
  const source = normalized.source || "";
  const deck = stripHtml(normalized.text || title);
  const tags = (normalized.tags || []).map((tag) => `<span class="signal-tag">${escapeHtml(tag)}</span>`).join("");

  return `
    <li class="signal-item" data-signal-title="${escapeAttribute(title)}" data-signal-source="${escapeAttribute(source)}" data-signal-tags="${escapeAttribute((normalized.tags || []).join(", "))}">
      <div class="signal-content">
        <h3>${source ? `<a href="${escapeAttribute(source)}">${escapeHtml(title)}</a>` : escapeHtml(title)}</h3>
        <p>${escapeHtml(deck)}</p>
        <div class="signal-tags">${tags}</div>
      </div>
      ${ratingTemplate(normalized, id, true)}
    </li>
  `;
}

function cardTemplate(story, index, storyIndex, includeImage = false) {
  const isIndustry = story.section === "Industry Notes";
  const id = storyId(story);
  const detailParts = [];
  const desk = editorialSection(story);
  const sourceLabel = isIndustry ? "Read analysis" : "Read source";
  const sourceLink = story.source
    ? `<a class="source-button" href="${escapeHtml(story.source)}">${sourceLabel}</a>`
    : "";
  const image = storyImage(story);
  const impact = story.why || story.takeaway || story.expanded || story.commentary || "";

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
    detailParts.push(`<p class="detail-block"><a href="${escapeHtml(story.source)}">Open source</a></p>`);
  }

  const tags = (story.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

  return `
    <article class="story-card ${includeImage ? "has-image" : ""}" data-kind="${escapeHtml(desk)}" data-story-id="${storyIndex}">
      ${includeImage ? `<img class="story-image" src="${escapeAttribute(image)}" alt="">` : ""}
      <div class="card-summary">
        <div class="story-kicker">
          <span class="rank">${index + 1}</span>
          <span>${escapeHtml(editorialDeskLabels[desk] || desk)}</span>
          <span>${escapeHtml(regionLabel(story))}</span>
        </div>
        <div>
          <h3 class="story-title">${escapeHtml(story.title)}</h3>
          <p class="meta">${escapeHtml(story.meta)}</p>
          <p class="summary"><span class="label">Signal:</span> ${escapeHtml(story.summary)}</p>
          ${impact ? `<p class="story-impact"><span class="label">Implication:</span> ${escapeHtml(impact)}</p>` : ""}
          <div class="tag-row">${tags}</div>
          ${ratingTemplate(story, id, true)}
        </div>
        <div class="card-actions">
          ${sourceLink}
          <button class="card-toggle" type="button" aria-expanded="false">Expand</button>
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
      .map(({ story, storyIndex }, index) => cardTemplate(story, index, storyIndex, index === 0))
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
  button.textContent = isOpen ? "Collapse" : "Expand";
  button.setAttribute("aria-expanded", String(isOpen));
}

function setAll(open) {
  document.querySelectorAll(".story-card").forEach((card) => {
    card.classList.toggle("open", open);
    const button = card.querySelector(".card-toggle");
    button.textContent = open ? "Collapse" : "Expand";
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

async function handleRatingChange(input) {
  const fieldset = input.closest("[data-story-rating]");
  const storyIdValue = fieldset.dataset.storyRating;
  const card = input.closest(".story-card");
  const signal = input.closest(".signal-item, .lead-story");
  const story = card
    ? stories[Number(card.dataset.storyId)]
    : {
      section: "Top Stories",
      title: signal?.dataset.signalTitle || "Top story",
      source: signal?.dataset.signalSource || "",
      tags: (signal?.dataset.signalTags || "").split(", ").filter(Boolean)
    };
  const status = fieldset.querySelector(".rating-status");

  setRating(storyIdValue, input.value);
  fieldset.querySelectorAll(".rating-option").forEach((option) => {
    option.classList.toggle("selected", option.querySelector("input").checked);
  });
  status.textContent = "Saving...";

  try {
    await fetch(ratingsEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        user: userName,
        briefingDate: briefingDateLabel(),
        section: story.section,
        title: story.title,
        source: story.source || "",
        tags: story.tags || [],
        score: Number(input.value)
      })
    });
    status.textContent = "Saved to feedback sheet";
  } catch {
    status.textContent = "Saved locally only";
  }
}

async function copyRatings() {
  const ratings = getRatings();
  const ratedStories = stories
    .map((story) => ({ story, rating: ratings[storyId(story)] }))
    .filter(({ rating }) => rating);

  const text = ratedStories.length
    ? ratedStories.map(({ story, rating }) => [
      `Score: ${rating}/5`,
      `Section: ${story.section}`,
      `Title: ${story.title}`,
      `Tags: ${(story.tags || []).join(", ")}`,
      `Source: ${story.source || ""}`
    ].join("\n")).join("\n\n")
    : "No relevance scores selected yet.";

  try {
    await navigator.clipboard.writeText(text);
    copyScores.textContent = "Copied";
    setTimeout(() => {
      copyScores.textContent = "Copy scores";
    }, 1600);
  } catch {
    copyScores.textContent = "Copy failed";
    setTimeout(() => {
      copyScores.textContent = "Copy scores";
    }, 1600);
  }
}

async function init() {
  await loadFreshData();
  const localStoryCount = Array.isArray(window.briefingStories) ? window.briefingStories.length : 0;

  if (!localStoryCount) {
    await loadRemoteBriefingData();
  }

  stories = Array.isArray(window.briefingStories) ? window.briefingStories : [];
  renderMeta();
  renderStories();
  setupSectionToggles();
  filterStories();
}

document.addEventListener("click", (event) => {
  if (event.target.matches(".card-toggle")) {
    toggleCard(event.target);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches(".rating-control input")) {
    handleRatingChange(event.target);
  }
});

searchInput.addEventListener("input", filterStories);
expandAll.addEventListener("click", () => setAll(true));
collapseAll.addEventListener("click", () => setAll(false));
copyScores.addEventListener("click", copyRatings);
document.addEventListener("scroll", updateActiveNav, { passive: true });

init();
