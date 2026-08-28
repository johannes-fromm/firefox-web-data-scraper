# Web Data Scraper for Firefox

A Firefox WebExtension for heuristic extraction of tables and repeated card/list elements. Data stays in the browser and can be saved as CSV or valid Excel `.xlsx` files.

## Development installation

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Select **Load Temporary Add-on**.
3. Select [`manifest.json`](./manifest.json).
4. Open a webpage and click the extension icon.

The detector supports HTML tables and repeated `article`, `li`, `.card`, `.item`, and ARIA row elements. Column names can be edited directly in the preview. Dynamic pages can be handled with **Load more** (infinite scroll) and **Next page**.

## Security considerations

This extension processes webpage content locally and does not send scraped data to an external server. However, users should understand the following risks:

- **CSV formula injection (medium risk):** Scraped values beginning with `=`, `+`, `-`, or `@` may be interpreted as formulas by Excel or LibreOffice when a CSV file is opened. Do not open CSV files from untrusted webpages in a spreadsheet application until these values have been reviewed or neutralized.
- **Broad host access:** The `<all_urls>` permission allows the extension to read pages on most websites. Do not use it on pages containing confidential, personal, or authentication-related information unless you trust the extension and its source code.
- **Untrusted webpage content:** The extension parses content supplied by arbitrary websites. It currently treats extracted values as text and does not intentionally execute webpage HTML, but malicious pages can still provide misleading or unwanted data.
- **Automatic next-page navigation:** The **Next page** feature may click a matching link or button on the current page. Review the detected page and destination before using it on unfamiliar websites.
- **Local export files:** Exported data is saved to the local filesystem. Protect exported files because they may contain personal, business, or otherwise sensitive information.

The permissions `activeTab`, `downloads`, and `<all_urls>` are used for page inspection and local export. Before publishing a signed add-on, review the permissions and address CSV formula injection in the export code.
