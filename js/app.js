(function () {
  const root = document.getElementById("resourceRoot");
  const pathKey = document.body?.dataset?.path;

  // Only run resource rendering on path pages
  if (!root || !pathKey) return;

  const searchInput = document.getElementById("searchInput");
  const expandAllBtn = document.getElementById("expandAllBtn");
  const collapseAllBtn = document.getElementById("collapseAllBtn");

  let rawData = null;
  let query = "";

  function normalize(s) {
    return String(s || "").toLowerCase().trim();
  }

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

  // Match against an item AND its descendants
  function itemOrDescendantMatches(item, q) {
    if (!q) return true;

    const hay = [
      item.title,
      item.description,
      ...(item.tags || []),
      ...((item.links || []).map(l => l.label)),
      ...((item.links || []).map(l => l.url))
    ].map(normalize).join(" ");

    if (hay.includes(q)) return true;

    const kids = item.children || [];
    return kids.some(child => itemOrDescendantMatches(child, q));
  }

  // Filter an item tree: keep item if it matches or has matching descendants; recurse into children
  function filterItemTree(item, q) {
    const kids = item.children || [];
    const filteredKids = kids
      .map(child => filterItemTree(child, q))
      .filter(Boolean);

    const selfMatches = itemOrDescendantMatches(
      { ...item, children: [] }, // only self fields
      q
    );

    if (!q) {
      // no query: keep full tree as-is
      return { ...item };
    }

    if (selfMatches || filteredKids.length > 0) {
      return { ...item, children: filteredKids };
    }
    return null;
  }

  function linkButtons(links) {
    if (!links || links.length === 0) return null;

    const wrap = el("div", { class: "item-links" }, []);
    links.forEach(link => {
      if (!link?.url) return;
      wrap.appendChild(
        el("a", {
          class: "linkbtn",
          href: link.url,
          target: "_blank",
          rel: "noopener noreferrer"
        }, [
          el("img", { src: "../assets/icons/external-link.svg", alt: "" }),
          link.label || "Open"
        ])
      );
    });

    return wrap.childNodes.length ? wrap : null;
  }

  // Render one item; if it has children, render them nested (collapsible)
  function renderItem(item, depth = 0) {
    const tagsNode = el(
      "div",
      { class: "item-tags" },
      (item.tags || []).map(t => el("span", { class: "tag" }, [t]))
    );

    const titleRow = el("div", { class: "item-top" }, [
      el("p", { class: "item-title" }, [item.title || "Untitled"]),
      tagsNode
    ]);

    const content = [
      titleRow,
      item.description ? el("p", { class: "item-desc" }, [item.description]) : el("div")
    ];

    const linksNode = linkButtons(item.links);
    if (linksNode) content.push(linksNode);

    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    // Leaf item
    if (!hasChildren) {
      const box = el("div", { class: "item" }, content);
      if (depth > 0) box.style.marginLeft = `${Math.min(depth * 14, 56)}px`;
      return box;
    }

    // Parent item: show as a details/summary so it can collapse/expand
    const details = el("details", { class: "section", open: null }, []);
    const summary = el("summary", {}, [
      el("div", { class: "section-title" }, [item.title || "Untitled"]),
      el("div", { class: "section-meta" }, [`${item.children.length} subitem${item.children.length === 1 ? "" : "s"}`])
    ]);
    details.appendChild(summary);

    const body = el("div", { class: "section-body" }, []);
    if (item.description) body.appendChild(el("p", { class: "muted" }, [item.description]));

    // keep tags + links visible inside body too (optional but useful)
    if ((item.tags || []).length) {
      body.appendChild(el("div", { class: "item-tags" }, (item.tags || []).map(t => el("span", { class: "tag" }, [t]))));
    }
    if (linksNode) body.appendChild(linksNode);

    const kidsWrap = el("div", { class: "items" }, []);
    item.children.forEach(child => kidsWrap.appendChild(renderItem(child, depth + 1)));
    body.appendChild(kidsWrap);

    details.appendChild(body);

    if (depth > 0) details.style.marginLeft = `${Math.min(depth * 14, 56)}px`;
    return details;
  }

  function render() {
    const path = rawData?.paths?.[pathKey];
    root.innerHTML = "";

    if (!path) {
      root.appendChild(el("div", { class: "note" }, [
        el("h3", {}, ["No data found"]),
        el("p", { class: "muted" }, [
          "This page is wired correctly, but no matching path key exists in data/resources.json."
        ])
      ]));
      return;
    }

    const q = normalize(query);

    const sections = (path.sections || []).map(section => {
      // Filter tree within this section
      const filteredItems = (section.items || [])
        .map(item => filterItemTree(item, q))
        .filter(Boolean);

      if (filteredItems.length === 0) return null;

      const details = el("details", { class: "section", open: q.length > 0 ? "open" : null });
      const summary = el("summary", {}, [
        el("div", { class: "section-title" }, [section.title]),
        el("div", { class: "section-meta" }, [`${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"}`])
      ]);
      details.appendChild(summary);

      const body = el("div", { class: "section-body" }, []);
      if (section.description) {
        body.appendChild(el("p", { class: "muted" }, [section.description]));
      }

      const itemsWrap = el("div", { class: "items" }, []);
      filteredItems.forEach(item => itemsWrap.appendChild(renderItem(item, 0)));

      body.appendChild(itemsWrap);
      details.appendChild(body);
      return details;
    }).filter(Boolean);

    if (sections.length === 0) {
      root.appendChild(el("div", { class: "note" }, [
        el("h3", {}, ["No matches"]),
        el("p", { class: "muted" }, ["Try a different search term."])
      ]));
      return;
    }

    sections.forEach(s => root.appendChild(s));
  }

  function setAll(open) {
    // Expand/collapse all details (both sections and nested items)
    document.querySelectorAll("details").forEach(d => {
      d.open = !!open;
    });
  }

  fetch("../data/resources.json", { cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      rawData = data;
      render();
    })
    .catch(() => {
      root.innerHTML = "";
      root.appendChild(el("div", { class: "note" }, [
        el("h3", {}, ["Could not load data/resources.json"]),
        el("p", { class: "muted" }, [
          "If you're opening files directly (file://), some browsers block fetch(). ",
          "Run a simple local server instead (e.g., python -m http.server)."
        ])
      ]));
    });

  searchInput?.addEventListener("input", (e) => {
    query = e.target.value;
    render();
  });

  expandAllBtn?.addEventListener("click", () => setAll(true));
  collapseAllBtn?.addEventListener("click", () => setAll(false));
})();
