(() => {
  const clean = (value) => value.replace(/\s+/g, " ").trim();

  const rowsFromTable = (table) => {
    const rows = [...table.querySelectorAll("tr")]
      .map((row) => [...row.querySelectorAll("th,td")].map((cell) => clean(cell.innerText)))
      .filter((row) => row.some(Boolean));
    if (rows.length < 2) return null;
    const header = rows[0].length > 1 ? rows[0] : rows[1];
    const body = rows[0].length > 1 ? rows.slice(1) : rows.slice(2);
    return { header, rows: body };
  };

  const rowsFromRepeatingElements = () => {
    const candidates = [...document.querySelectorAll("article, li, [role='row'], .card, .item")];
    const groups = new Map();
    candidates.forEach((element) => {
      const key = `${element.parentElement?.tagName}:${element.className}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(element);
    });
    const group = [...groups.values()]
      .filter((items) => items.length >= 3)
      .sort((a, b) => b.length - a.length)[0];
    if (!group) return null;

    const rows = group.map((item) =>
      [...item.querySelectorAll("h1,h2,h3,h4,p,span,a,time,[data-label]")]
        .map((node) => clean(node.innerText || node.textContent || ""))
        .filter(Boolean)
    ).filter((row) => row.length);
    if (rows.length < 3) return null;
    const width = Math.max(...rows.map((row) => row.length));
    return {
      header: Array.from({ length: width }, (_, index) => `Spalte ${index + 1}`),
      rows: rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""))
    };
  };

  const detect = () => {
    const tables = [...document.querySelectorAll("table")]
      .map(rowsFromTable)
      .filter(Boolean)
      .sort((a, b) => b.rows.length - a.rows.length);
    return tables[0] || rowsFromRepeatingElements() || {
      header: ["Text"],
      rows: [[clean(document.body.innerText || "")]]
    };
  };

  const nextLink = () => [...document.querySelectorAll("a,button")]
    .find((element) => /^(next|weiter|nächste|›|»|>|mehr)$/i.test(clean(element.innerText)));

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "detect") {
      const result = detect();
      return Promise.resolve({
        ...result,
        nextAvailable: Boolean(nextLink()),
        url: location.href,
        title: document.title
      });
    }
    if (message.type === "scroll") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return new Promise((resolve) => setTimeout(() => resolve(detect()), message.wait || 1500));
    }
    if (message.type === "next") {
      const link = nextLink();
      if (!link) return Promise.resolve({ error: "Kein nächster Seitenlink gefunden." });
      link.click();
      return Promise.resolve({ clicked: true });
    }
    return undefined;
  });
})();
