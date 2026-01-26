(function () {
  const root = document.getElementById("resourceRoot");
  const pathKey = document.body?.dataset?.path;
  if (!root || !pathKey) return;

  const searchInput = document.getElementById("searchInput");
  const expandAllBtn = document.getElementById("expandAllBtn");
  const collapseAllBtn = document.getElementById("collapseAllBtn");
  const sideNavEl = document.getElementById("sideNav");
  const sideNavList = document.getElementById("sideNavList");
  const sideNavToggle = document.getElementById("sideNavToggle");

  let rawData = null;
  let query = "";

  const LABEL_MAP = {
    "video": "Video", "videos": "Video", "youtube": "Video",
  
    "course": "Course", "courses": "Course",
  
    "doc": "Docs", "docs": "Docs", "documentation": "Docs",
  
    "exercise": "Exercise", "lab": "Exercise", "exercise/lab": "Exercise",
  
    "article": "Article", "articles": "Article", "blog": "Article", "post": "Article"
  };
  
  const CANONICAL_BADGES = new Set(["Video", "Course", "Docs", "Exercise", "Article"]);
  

  function normalizeLabelRaw(s) {
    if (!s) return null;
    const clean = String(s).trim().toLowerCase();
    const exact = LABEL_MAP[clean];
    if (exact) return exact;
    const collapsed = clean.replace(/\s+/g, "");
    if (LABEL_MAP[collapsed]) return LABEL_MAP[collapsed];
    const found = Object.keys(LABEL_MAP).find(k => clean.includes(k));
    if (found) return LABEL_MAP[found];
    if (!clean) return null;
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  function normalizeTag(t) {
    if (!t) return null;
    const c = String(t).trim().toLowerCase();
    if (c.includes("video")) return "Video";
    if (c.includes("course")) return "Course";
    if (c.includes("doc") || c.includes("documentation")) return "Docs";
    if (c.includes("exercise") || c.includes("lab")) return "Exercise";
    if (c.includes("sql")) return "SQL";
    if (c.includes("fhir")) return "FHIR";
    if (c.includes("hl7")) return "HL7";
    if (c.includes("dtl")) return "DTL";
    if (c.includes("sda")) return "SDA";
    if (c.includes("api")) return "API";
    return t;
  }

  function normalize(s) { return String(s || "").toLowerCase().trim(); }
  function slugify(s) { return String(s || "").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9\-]/g,"").replace(/\-+/g,"-").replace(/^\-+|\-+$/g,""); }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || typeof v === "undefined") continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return node;
  }

  function itemOrDescendantMatches(item, q) {
    if (!q) return true;
    const hay = [ item.title, item.description, ...(item.tags||[]), ...((item.links||[]).map(l=>l.label)), ...((item.links||[]).map(l=>l.url)) ].map(normalize).join(" ");
    if (hay.includes(q)) return true;
    const kids = item.children || [];
    return kids.some(child => itemOrDescendantMatches(child, q));
  }

  function filterItemTree(item, q) {
    const kids = item.children || [];
    const filteredKids = kids.map(child => filterItemTree(child, q)).filter(Boolean);
    const selfMatches = itemOrDescendantMatches({ ...item, children: [] }, q);
    if (!q) return { ...item };
    if (selfMatches || filteredKids.length > 0) return { ...item, children: filteredKids };
    return null;
  }

  // Replace existing secondaryLinkButtons with this function
function secondaryLinkButtons(links, primaryUrl) {
  if (!links || links.length <= 1) return null;
  const wrap = el("div", { class: "item-links" }, []);
  links.forEach(link => {
    if (!link?.url) return;
    if (primaryUrl && link.url.trim() === primaryUrl.trim()) return; // skip primary

    const label = normalizeLabelRaw(link.label) || link.label || "Open";

    // create a button (not an <a>) so it's valid inside an outer anchor
    const btn = el("button", {
      class: "linkbtn",
      type: "button",
      // data-url can be used for debugging; not strictly required
      "data-url": link.url
    }, [
      el("img", { src: "../assets/icons/external-link.svg", alt: "" }),
      label
    ]);

    // open URL in new tab on click and prevent outer anchor from firing
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      // open in new tab safely
      try {
        window.open(link.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        // fallback: set location (shouldn't happen)
        window.location.href = link.url;
      }
    }, { passive: false });

    wrap.appendChild(btn);
  });

  return wrap.childNodes.length ? wrap : null;
}


  function createBadge(label) {
    if (!label) return null;
    const lower = String(label || "").toLowerCase();
    const cls = "badge-left badge--" + lower;
    return el("div", { class: cls }, [label]);
  }

  function renderItem(item, depth = 0) {
    const normTags = (item.tags || []).map(t => normalizeTag(t)).filter(Boolean);
    const tagsNode = el("div", { class: "item-tags" }, normTags.map(t => el("span", { class: "tag" }, [t])));
    const titleRow = el("div", { class: "item-top" }, [ el("p", { class: "item-title" }, [item.title || "Untitled"]), tagsNode ]);
    const descNode = item.description ? el("p", { class: "item-desc" }, [item.description]) : el("div");

    const links = (item.links || []).map(l => {
      if (!l) return l;
      const normalizedLabel = normalizeLabelRaw(l.label) || l.label || (l.url ? "Open" : null);
      return { ...l, label: normalizedLabel };
    });

    const primary = (links || []).find(l => l && l.url && l.url.trim());
    const primaryUrl = primary ? primary.url.trim() : null;

    let badgeLabel = null;
    if (primary && primary.label && CANONICAL_BADGES.has(primary.label)) badgeLabel = primary.label;
    if (!badgeLabel) {
      const found = normTags.find(t => CANONICAL_BADGES.has(t));
      if (found) badgeLabel = found;
    }
    const badgeEl = createBadge(badgeLabel);
    const secondaryLinksNode = secondaryLinkButtons(links, primaryUrl);
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    // -- CASE A: leaf with primary link -> create outer <a class="item linkable" ...> wrapping inner
    if (!hasChildren && primaryUrl) {
      const innerChildren = [ titleRow, descNode ];
      if (secondaryLinksNode) innerChildren.push(secondaryLinksNode);
      const innerBox = el("div", { class: "item-inner" }, innerChildren);
      if (badgeEl) innerBox.appendChild(badgeEl);
      const outerAnchor = el("a", { href: primaryUrl, target: "_blank", rel: "noopener noreferrer", class: "item linkable" }, [ innerBox ]);
      if (depth > 0) outerAnchor.style.marginLeft = `${Math.min(depth * 14, 56)}px`;
      return outerAnchor;
    }

    // -- CASE B: parent with children -> details with optional primary link button; badge inside body
    if (hasChildren) {
      const details = el("details", { class: "section", open: null }, []);
      const summary = el("summary", {}, [ el("div", { class: "section-title" }, [item.title || "Untitled"]), el("div", { class: "section-meta" }, [`${item.children.length} subitem${item.children.length === 1 ? "" : "s"}`]) ]);
      details.appendChild(summary);

      const body = el("div", { class: "section-body" }, []);
      if (item.description) body.appendChild(el("p", { class: "muted" }, [item.description]));
      if (normTags.length) body.appendChild(el("div", { class: "item-tags" }, normTags.map(t => el("span", { class: "tag" }, [t]))));

      if (primaryUrl) {
        body.appendChild(el("div", { class: "item-links" }, [ el("a", { class: "linkbtn", href: primaryUrl, target: "_blank", rel: "noopener noreferrer" }, [ el("img", { src: "../assets/icons/external-link.svg", alt: "" }), primary.label || "Open" ]) ]));
      }

      if (badgeEl) body.insertBefore(badgeEl, body.firstChild);

      const kidsWrap = el("div", { class: "items" }, []);
      item.children.forEach(child => kidsWrap.appendChild(renderItem(child, depth + 1)));
      body.appendChild(kidsWrap);

      details.appendChild(body);
      if (depth > 0) details.style.marginLeft = `${Math.min(depth * 14, 56)}px`;
      return details;
    }

    // -- CASE C: leaf without primary link -> plain .item (div) containing .item-inner and badge
    const innerChildren = [ titleRow, descNode ];
    if (secondaryLinksNode) innerChildren.push(secondaryLinksNode);
    const innerBox = el("div", { class: "item-inner" }, innerChildren);
    if (badgeEl) innerBox.appendChild(badgeEl);
    const box = el("div", { class: "item" }, [ innerBox ]);
    if (depth > 0) box.style.marginLeft = `${Math.min(depth * 14, 56)}px`;
    return box;
  }

  function buildSideNav(sections) {
    if (!sideNavEl || !sideNavList) return;
    sideNavList.innerHTML = "";
    sideNavList.appendChild(el("li", {}, [el("a", { href: "#top", class: "side-link" }, ["Top"])]));
    sections.forEach(section => { const id = "section-" + slugify(section.title); sideNavList.appendChild(el("li", {}, [el("a", { href: `#${id}`, class: "side-link" }, [section.title])])) });

    sideNavList.querySelectorAll("a.side-link").forEach(a => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("#")) return;
        const target = document.querySelector(href);
        if (target) { target.scrollIntoView({ behavior: "smooth", block: "start" }); history.replaceState(null, "", href); }
        if (sideNavEl) sideNavEl.classList.remove("open");
        document.body.classList.remove("side-nav-active");
        if (sideNavToggle) sideNavToggle.setAttribute("aria-expanded", "false");
      });
    });

    const linkMap = new Map();
    sideNavList.querySelectorAll("a.side-link").forEach(a => { const href = a.getAttribute("href") || ""; if (!href.startsWith("#")) return; linkMap.set(href, a); });

    const mainEl = document.querySelector("main.container");
    if (mainEl && !document.getElementById("top")) { const topAnchor = document.createElement("div"); topAnchor.id = "top"; mainEl.insertAdjacentElement("afterbegin", topAnchor); }

    const observeTargets = [];
    (sections || []).forEach(section => {
      const id = "section-" + slugify(section.title);
      const elToObserve = document.getElementById(id);
      if (elToObserve) observeTargets.push({ id: `#${id}`, el: elToObserve });
    });
    if (document.getElementById("top")) observeTargets.unshift({ id: "#top", el: document.getElementById("top") });

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(en => en.isIntersecting);
      if (visible.length === 0) return;
      visible.sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
      const topEntry = visible[0];
      const id = "#"+topEntry.target.id;
      sideNavList.querySelectorAll("a.side-link").forEach(a=>a.classList.remove("active"));
      const link = linkMap.get(id);
      if (link) link.classList.add("active");
    }, { root: null, rootMargin: "-20% 0% -60% 0%", threshold: [0,0.1,0.25,0.5,0.75] });

    observeTargets.forEach(t => observer.observe(t.el));
  }

  function render() {
    const path = rawData?.paths?.[pathKey];
    root.innerHTML = "";
    if (!path) {
      root.appendChild(el("div", { class: "note" }, [ el("h3", {}, ["No data found"]), el("p", { class: "muted" }, ["This page is wired correctly, but no matching path key exists in data/resources.json."]) ]));
      return;
    }

    if (Array.isArray(path.sections)) buildSideNav(path.sections);

    const q = normalize(query);
    const sections = (path.sections || []).map(section => {
      const filteredItems = (section.items || []).map(item => filterItemTree(item, q)).filter(Boolean);
      if (filteredItems.length === 0) return null;
      const sectionId = "section-" + slugify(section.title);
      const details = el("details", { class: "section", open: q.length > 0 ? "open" : null, id: sectionId });
      const summary = el("summary", {}, [ el("div", { class: "section-title" }, [section.title]), el("div", { class: "section-meta" }, [`${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"}`]) ]);
      details.appendChild(summary);
      const body = el("div", { class: "section-body" }, []);
      if (section.description) body.appendChild(el("p", { class: "muted" }, [section.description]));
      const itemsWrap = el("div", { class: "items" }, []);
      filteredItems.forEach(item => itemsWrap.appendChild(renderItem(item, 0)));
      body.appendChild(itemsWrap);
      details.appendChild(body);
      return details;
    }).filter(Boolean);

    if (sections.length === 0) {
      root.appendChild(el("div", { class: "note" }, [ el("h3", {}, ["No matches"]), el("p", { class: "muted" }, ["Try a different search term."]) ]));
      return;
    }

    sections.forEach(s => root.appendChild(s));
  }

  function setAll(open) { document.querySelectorAll("details").forEach(d => d.open = !!open); }

  function openSideNavSmall() { if (!sideNavEl) return; sideNavEl.classList.add("open"); document.body.classList.add("side-nav-active"); if (sideNavToggle) sideNavToggle.setAttribute("aria-expanded", "true"); const firstLink = sideNavEl.querySelector("a"); if (firstLink) firstLink.focus(); }
  function closeSideNavSmall() { if (!sideNavEl) return; sideNavEl.classList.remove("open"); document.body.classList.remove("side-nav-active"); if (sideNavToggle) sideNavToggle.setAttribute("aria-expanded", "false"); }

  function setupSideNavInteractions() {
    document.addEventListener("click", (ev) => {
      if (!sideNavEl) return;
      if (!sideNavEl.classList.contains("open")) return;
      const withinSide = sideNavEl.contains(ev.target);
      const withinToggle = sideNavToggle && sideNavToggle.contains(ev.target);
      if (!withinSide && !withinToggle) closeSideNavSmall();
    });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeSideNavSmall(); });
    sideNavToggle?.addEventListener("click", (e) => { e.stopPropagation(); if (!sideNavEl) return; if (sideNavEl.classList.contains("open")) closeSideNavSmall(); else openSideNavSmall(); });
  }

  fetch("../data/resources.json", { cache: "no-store" })
    .then(r => r.json())
    .then(data => { rawData = data; render(); setupSideNavInteractions(); })
    .catch(() => {
      root.innerHTML = "";
      root.appendChild(el("div", { class: "note" }, [ el("h3", {}, ["Could not load data/resources.json"]), el("p", { class: "muted" }, ["If you're opening files directly (file://), some browsers block fetch(). Run a simple local server instead (e.g., python -m http.server)."]) ]));
    });

  searchInput?.addEventListener("input", (e) => { query = e.target.value; render(); });
  expandAllBtn?.addEventListener("click", () => setAll(true));
  collapseAllBtn?.addEventListener("click", () => setAll(false));
})();
