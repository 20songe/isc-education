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
  
    function matches(item, q) {
      if (!q) return true;
      const hay = [
        item.title,
        item.description,
        ...(item.tags || []),
        ...((item.links || []).map(l => l.label)),
        ...((item.links || []).map(l => l.url))
      ].map(normalize).join(" ");
      return hay.includes(q);
    }
  
    function el(tag, attrs = {}, children = []) {
      const node = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
      for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      return node;
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
        const filteredItems = (section.items || []).filter(item => matches(item, q));
  
        // Hide whole section if nothing matches
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
  
        filteredItems.forEach(item => {
          const tags = el("div", { class: "item-tags" },
            (item.tags || []).map(t => el("span", { class: "tag" }, [t]))
          );
  
          const titleRow = el("div", { class: "item-top" }, [
            el("p", { class: "item-title" }, [item.title]),
            tags
          ]);
  
          const box = el("div", { class: "item" }, [
            titleRow,
            item.description ? el("p", { class: "item-desc" }, [item.description]) : el("div"),
          ]);
  
          const linksWrap = el("div", { class: "item-links" }, []);
          (item.links || []).forEach(link => {
            if (!link.url) return;
            linksWrap.appendChild(
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
  
          if ((item.links || []).length > 0) box.appendChild(linksWrap);
          itemsWrap.appendChild(box);
        });
  
        body.appendChild(itemsWrap);
        details.appendChild(body);
        return details;
      }).filter(Boolean);
  
      if (sections.length === 0) {
        root.appendChild(el("div", { class: "note" }, [
          el("h3", {}, ["No matches"]),
          el("p", { class: "muted" }, [
            "Try a different search term."
          ])
        ]));
        return;
      }
  
      sections.forEach(s => root.appendChild(s));
    }
  
    function setAll(open) {
      document.querySelectorAll("details.section").forEach(d => {
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
  