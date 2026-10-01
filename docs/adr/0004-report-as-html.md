# A Report is HTML first; the PDF is a print of it

The previous tool built its PDF with about 3,500 lines of jsPDF drawing commands, which made the PDF hard to change and unable to show some characters (`≥`, `→`). In this tool, each Template is a responsive HTML page rendered from Report Data. The PDF is produced by printing that same page in headless Chromium (Playwright), so the on-screen Report and the PDF can never drift apart. Because headless Chromium is a heavy dependency, it runs only in the worker.
