// End-to-end tests for the legal.xyz prototype. Run with `npm test`.
// Starts a local server, drives Chromium through the main journeys and exits non-zero
// on any failed check or page error.
import { chromium } from "playwright";
import { deflateSync, deflateRawSync } from "node:zlib";
import { serve } from "./serve.mjs";

const server = await serve(0);
const U = `http://127.0.0.1:${server.address().port}/`;
const PASSWORD = "correct horse battery";
const failures = [];
const pageErrors = [];
let passed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` (${detail})` : ""}`);
  }
}

// ---------- Fixtures ----------

function flatePdf(text) {
  const stream = deflateSync(Buffer.from(`BT /F1 12 Tf 72 720 Td (${text}) Tj ET`));
  const parts = [
    "%PDF-1.4\n",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n",
    `4 0 obj << /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`,
  ];
  return Buffer.concat([Buffer.from(parts.join("")), stream, Buffer.from("\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n")]);
}

// A one-file .docx: just enough zip structure for word/document.xml.
function docx(text) {
  const name = Buffer.from("word/document.xml");
  const xml = Buffer.from(`<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  const data = deflateRawSync(xml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + name.length + data.length;
  const cd = Buffer.concat([central, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, name, data, cd, end]);
}

// ---------- Helpers ----------

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  if (opts.blockIndexedDB) {
    await ctx.addInitScript(() => Object.defineProperty(window, "indexedDB", { get: () => ({ open() { throw new Error("blocked"); } }) }));
  }
  const p = await ctx.newPage();
  p.on("pageerror", (e) => pageErrors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/favicon|service worker|serviceworker/i.test(m.text()) && pageErrors.push(m.text()));
  return p;
}

const go = (p, hash) => p.evaluate((h) => { location.hash = h; }, hash).then(() => p.waitForTimeout(700));

// The home page has no sign-up link yet; the Demo panel opens the app.
async function start(p) {
  await p.click("[data-demo-toggle]");
  await p.click(".demo-action >> nth=0");
}

async function onboard(p) {
  await p.goto(U);
  await start(p);
  await p.fill("[name=company]", "Acme Development");
  await p.fill("[name=name]", "Jay Doe");
  await p.fill("[name=email]", "jay@acme.com");
  await p.fill("[name=password]", PASSWORD);
  await p.check("[name=terms]");
  await p.click("form[data-step=account] [type=submit]");
  await p.fill("[name=lawyerName]", "Dana Lee");
  await p.fill("[name=lawyerEmail]", "dana@leellp.com");
  await p.fill("[name=firm]", "Lee LLP");
  await p.check("[name=ack]");
  await p.click("form[data-step=lawyer] [type=submit]");
  await go(p, "sign");
  await p.fill("[name=bar]", "123456");
  await p.fill("[name=barState]", "NY");
  await p.check("[name=agree]");
  await p.click("[data-sign=form] [type=submit]");
  await p.waitForSelector("[data-sign=signed].is-active");
  await go(p, "");
  await p.waitForFunction(() => /-/.test(document.querySelector("[data-recovery]")?.textContent || ""), null, { timeout: 20000 });
  const code = await p.textContent("[data-recovery]");
  await p.check("[data-key-saved]");
  await p.click("[data-security-continue]");
  await p.click("[data-team-submit]");
  await p.click("[data-open-workspace]");
  await p.waitForTimeout(500);
  if (await p.isVisible("[data-tour]")) await p.click("[data-tour-skip]");
  return code;
}

async function newMatter(p, name, question = "Can we end the lease early?") {
  await p.click("[data-new-matter]");
  await p.fill("[name=matter]", name);
  await p.fill("[data-new-matter-form] [name=question]", question);
  await p.click("[data-new-matter-form] [type=submit]");
  await p.waitForTimeout(200);
}

async function sendMessage(p, text) {
  await p.fill("[data-composer] textarea", text);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(1300);
}

// ---------- Tests ----------

const browser = await chromium.launch();

console.log("Home page");
{
  const p = await newPage(browser);
  await p.goto(U);
  check("headline", (await p.textContent(".home-line.is-on")) === "legal.xyz gives your legal conversations real privacy");
  check("three links", (await p.locator('[data-screen="hero"] .home-links > *').count()) === 3);
  await p.click("[data-how]");
  await p.waitForTimeout(1800);
  check("How? types the answer", (await p.textContent(".home-line.is-on [data-typed-head]")) === "How?\nBy giving your chats privilege");
  await p.waitForTimeout(1000);
  check("How? fades in the detail", (await p.evaluate(() => getComputedStyle(document.querySelector("[data-how-sub]")).opacity)) === "1");
  await p.click("[data-how]");
  await p.waitForTimeout(600);
  check("How? again fades back", (await p.textContent(".home-line.is-on")).startsWith("legal.xyz gives") && !(await p.isVisible("[data-how-sub]")));
  await p.click(".home-links a[href='#contact']");
  check("contact page shows the email", (await p.textContent('[data-screen="contact"].is-active .home-title')).includes("contact@legal.xyz"));
  await p.click('[data-screen="contact"] a[href="#"]');
  await p.waitForTimeout(300);
  check("back returns home", await p.isVisible('[data-screen="hero"]'));
  await p.click("[data-get-access]");
  await p.waitForTimeout(200);
  check("Get access opens the application", await p.isVisible("[data-apply-form]"));
  check("nav item reads Back", (await p.textContent("[data-get-access]")) === "Back");
  await p.click("[data-get-access]");
  await p.waitForTimeout(200);
  check("Back returns home", !(await p.isVisible("[data-apply-form]")) && (await p.textContent("[data-get-access]")) === "Get access");
  await p.click("[data-get-access]");
  await p.click(".apply-submit");
  check("required fields are enforced", (await p.locator(".apply-field-error:not(:empty)").count()) === 5);
  await p.fill("[name=fullName]", "Jay Doe");
  await p.fill("[name=workEmail]", "jay@gmail.com");
  await p.fill("[name=companyName]", "Acme");
  await p.selectOption("[name=seats]", "3-5");
  await p.check("[name=wants][value='Contract drafting and redlines']");
  await p.click("[data-add-want]");
  await p.fill("[name=wantsCustom]", "Board minutes");
  await p.keyboard.press("Enter");
  check("Enter adds another custom option", (await p.locator("[name=wantsCustom]").count()) === 2);
  await p.click(".apply-custom >> nth=1 >> button");
  await p.click(".apply-submit");
  check("personal email is rejected", (await p.textContent("#ap-email ~ .apply-field-error")).includes("work email"));
  await p.fill("[name=workEmail]", "jay@acme.com");
  await p.check("[name=consent]");
  await p.click(".apply-submit");
  await p.waitForTimeout(200);
  check("success replaces the form", (await p.textContent("[data-apply-done]")).startsWith("Application received.") && !(await p.isVisible("[data-apply-form]")));
  check("nav item reads Get access again", (await p.textContent("[data-get-access]")) === "Get access");
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("legalxyz.applications")));
  check("application is kept with a timestamp", saved.length === 1 && saved[0].company === "Acme" && saved[0].wants.join() === "Contract drafting and redlines" && saved[0].wantsOther.join() === "Board minutes" && !Number.isNaN(Date.parse(saved[0].submittedAt)) && saved[0].contactConsent === true);
  // With an endpoint set, the application is posted there.
  let posted = null;
  await p.route("https://apply.example/submit", (r) => { posted = JSON.parse(r.request().postData()); r.fulfill({ status: 200, body: "{}" }); });
  await p.click("[data-get-access]");
  await p.evaluate(() => { document.querySelector("[data-apply-form]").dataset.applyEndpoint = "https://apply.example/submit"; });
  await p.fill("[name=fullName]", "Ann Lee");
  await p.fill("[name=workEmail]", "ann@corp.io");
  await p.fill("[name=companyName]", "Corp");
  await p.selectOption("[name=seats]", "25+");
  await p.click("[data-add-want]");
  await p.fill("[name=wantsCustom]", "Cap table questions");
  await p.click(".apply-submit");
  await p.waitForTimeout(400);
  check("application posts to the endpoint", posted?.email === "ann@corp.io" && posted?.seats === "25+" && posted?.wantsOther?.[0] === "Cap table questions" && Boolean(posted?.submittedAt));
  // Admin page: applications from this browser (prototype), then from the endpoint.
  await p.goto(U + "admin.html");
  await p.waitForTimeout(400);
  check("admin lists the prototype application", (await p.locator(".app").count()) === 1 && (await p.textContent(".app .who")) === "Jay Doe");
  check("admin tallies what people want", (await p.textContent("[data-wants]")).includes("Contract drafting and redlines") && (await p.textContent("[data-wants]")).includes("Board minutes"));
  await p.click(".app > button");
  check("admin shows the full application", (await p.textContent(".detail")).includes("jay@acme.com"));
  let auth = null;
  await p.route("https://apply.example/applications", (r) => {
    auth = r.request().headers().authorization;
    r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ applications: [{ id: "1", name: "Ann Lee", email: "ann@corp.io", company: "Corp", seats: "25+", wants: [], wantsOther: ["Cap table questions"], receivedAt: new Date().toISOString() }] }) });
  });
  await p.click("[data-toggle-settings]");
  await p.fill("[data-settings] [name=endpoint]", "https://apply.example");
  await p.fill("[data-settings] [name=token]", "s3cret");
  await p.click("[data-settings] [type=submit]");
  await p.waitForTimeout(400);
  check("admin loads from the endpoint with the token", auth === "Bearer s3cret" && (await p.textContent(".app .who")) === "Ann Lee");
  const [download] = await Promise.all([p.waitForEvent("download"), p.click("[data-export]")]);
  check("admin exports CSV", download.suggestedFilename().endsWith(".csv"));
  await p.goto(U + "#pricing");
  check("pricing page shows $497 per seat", (await p.textContent("[data-page-body]")).includes("$497 / seat / month"));
  await p.goto(U + "#privilege");
  check("privilege page has the comparison table", (await p.locator("[data-page-body] .compare tbody tr").count()) === 6);
  const m = await newPage(browser, { viewport: { width: 390, height: 844 } });
  await m.goto(U);
  const [title, links] = await m.evaluate(() => [".home-title", '[data-screen="hero"] .home-links'].map((q) => document.querySelector(q).getBoundingClientRect()));
  check("links sit under the line on phones", links.top - title.bottom < 60);
  check("no sideways scroll on phones", (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
}

console.log("Sign-up");
{
  const p = await newPage(browser);
  await p.goto(U);
  await start(p);
  await p.fill("[name=company]", "Acme");
  await p.fill("[name=name]", "Jay");
  await p.fill("[name=email]", "jay@acme.com");
  await p.fill("[name=password]", PASSWORD);
  check("password meter rates a passphrase", /Good|Strong|Fair/.test(await p.textContent(".meter-label")));
  await p.click("form[data-step=account] [type=submit]");
  check("terms must be accepted", /Terms of Service/.test(await p.textContent("form[data-step=account] [data-error]")));
  await p.click("[data-policy=terms]");
  check("terms open in place", (await p.isVisible("[data-overlay=policy]")) && (await p.textContent("[data-policy-body] h1")) === "Terms of Service");
  await p.click("[data-policy-close]");
}

console.log("Workspace, lawyer and documents");
const p = await newPage(browser);
const recovery = await onboard(p);
check("recovery code shown", /^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}$/.test(recovery.trim()));
check("a new account starts at the first-matter box", await p.isVisible(".first-matter"));
await p.click(".first-matter");
await p.fill("[name=matter]", "Main St. lease dispute");
await p.click("[data-new-matter-form] [type=submit]");
check("a matter needs its legal question", (await p.textContent("[data-new-matter-form] [data-error]")).includes("legal question"));
await p.fill("[data-new-matter-form] [name=question]", "Can we end the lease early for non-payment?");
await p.click("[data-new-matter-form] [type=submit]");
await p.waitForTimeout(300);
if (await p.isVisible("[data-tour]")) await p.click("[data-tour-skip]");
check("new matters are shared by default", await p.isChecked("[data-share-counsel]"));
check("matter is labeled as prepared for counsel", (await p.textContent("[data-direction-label]")).startsWith("Prepared at the direction of counsel for"));
check("matter waits for the lawyer's direction", (await p.textContent("[data-matter-badges]")).includes("Waiting for lawyer's direction"));
check("access defaults to only you", (await p.textContent("[data-matter-badges]")).includes("Only you"));

// Off-topic warning
await p.fill("[data-composer] textarea", "Draft our Q3 marketing campaign plan");
await p.keyboard.press("Enter");
await p.waitForTimeout(200);
check("business talk gets an off-topic warning", await p.isVisible("[data-offtopic]"));
check("nothing is sent until confirmed", (await p.locator("[data-thread] .msg-user").count()) === 0);
await p.click("[data-offtopic-edit]");
await p.fill("[data-composer] textarea", "");

// Tools
await p.click("[data-tool=timeline]");
await p.fill("[data-tool-panel] [name=date]", "2026-07-01");
await p.fill("[data-tool-panel] [name=text]", "Tenant missed July rent");
await p.click("[data-tool-panel] .tool-form [type=submit]");
await p.waitForTimeout(150);
check("timeline adds events", (await p.textContent(".timeline")).includes("Tenant missed July rent"));
await p.click("[data-tool=people]");
await p.fill("[data-tool-panel] [name=name]", "Oakline Retail LLC");
await p.selectOption("[data-tool-panel] [name=role]", "Opposing party");
await p.click("[data-tool-panel] .tool-form [type=submit]");
await p.waitForTimeout(150);
check("people adds the other side", (await p.textContent("[data-tool-panel] .rows")).includes("Oakline Retail LLC"));
await p.click("[data-tool=notes]");
await p.click("[data-tool-panel] >> text=New note");
await p.fill(".note-title", "What the landlord said");
await p.fill(".note-body", "He called on July 3 and said we could leave in September.");
await p.waitForTimeout(600);
await p.click("text=← All notes");
check("notes are saved", (await p.textContent(".note-cards")).includes("What the landlord said"));
check("tool tabs show counts", (await p.textContent("[data-tool=notes]")).includes("1"));
await p.click("[data-tool=assistant]");
await sendMessage(p, "Can we terminate the lease for non-payment?");
await p.click(".conv-new");
await sendMessage(p, "What notice period applies to commercial tenants?");
check("second conversation titled from first message", (await p.locator(".conv-tab").allTextContents()).some((t) => t.startsWith("What notice period")));
check("conversations keep separate messages", (await p.locator("[data-thread] .msg-user").count()) === 1);

// Documents: text, Flate-compressed PDF, Word
await p.setInputFiles("[data-file]", [
  { name: "lease.pdf", mimeType: "application/pdf", buffer: flatePdf("Tenant shall pay rent on the first day of each month") },
  { name: "memo.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx("Holdover tenancy converts to month to month") },
  { name: "ledger.txt", mimeType: "text/plain", buffer: Buffer.from("July rent unpaid, August rent unpaid") },
]);
await sendMessage(p, "Here are the documents.");
for (const [q, file] of [["first day of each month", "lease.pdf"], ["month to month", "memo.docx"], ["august rent", "ledger.txt"]]) {
  await p.fill("[data-search]", q);
  await p.waitForTimeout(150);
  check(`search finds text inside ${file}`, (await p.textContent("[data-matters] .matter-meta")).includes(file));
}
await p.fill("[data-search]", "");
await p.click(".msg-user .file-chip >> text=ledger.txt");
await p.waitForSelector(".viewer-text");
check("document viewer decrypts and shows the file", (await p.textContent(".viewer-text")).includes("August"));
await p.click("[data-overlay=viewer] [data-close]");

// Send to lawyer, edit, delete
await p.hover(".msg-user >> nth=0");
await p.click(".msg-user >> nth=0 >> .msg-actions >> text=Send to lawyer");
await p.waitForTimeout(300);
await p.hover(".msg-user >> nth=0");
await p.click(".msg-user >> nth=0 >> .msg-actions >> text=Edit");
await p.fill(".edit-area", "What notice period applies to commercial tenants in New York?");
await p.click(".msg-user >> nth=0 >> text=Save");
check("messages can be edited", (await p.textContent(".msg-user >> nth=0")).includes("in New York") && (await p.textContent(".msg-user >> nth=0 >> .msg-meta")).includes("edited"));

// Lawyer tab
await p.click(".conv-lawyer");
await sendMessage(p, "Dana, can we talk tomorrow?");

// Counsel side
await go(p, "counsel");
check("counsel sees the shared matter", (await p.locator("[data-cp-matters] .matter").count()) === 1);
const counselText = await p.textContent("[data-cp-thread]");
check("counsel sees the conversation", counselText.includes("terminate the lease"));
check("counsel sees the item sent for review", counselText.includes("Flagged by client for your review"));
check("counsel sees the direct message", counselText.includes("can we talk tomorrow"));
check("counsel sees the matter's question", counselText.includes("Can we end the lease early for non-payment?"));
check("counsel sees the client's timeline", counselText.includes("Timeline (1)"));
await p.click("[data-cp-thread] >> text=Sign direction");
check("counsel signs the direction", (await p.textContent(".direction-card")).includes("Signed"));
await p.fill("[data-cp-note-form] [name=note]", "Please send the signed lease.");
await p.click("[data-cp-note-form] [value=request]");
await p.fill("[data-cp-note-form] [name=note]", "Do not contact the tenant yet.");
await p.click("[data-cp-note-form] [value=comment]");
await p.click(".matter-hold .switch-track");
await p.click("[data-cp-tab=log]");
const pdf = p.waitForEvent("download");
await p.click("[data-cp-log-pdf]");
const pdfBytes = await (await (await pdf).createReadStream()).toArray();
check("privilege log exports as a PDF", Buffer.concat(pdfBytes).subarray(0, 5).toString() === "%PDF-");

// Back to client: notes, request, hold
await go(p, "");
check("lawyer's note raises a notification", Number(await p.textContent("[data-bell-count]")) >= 2);
check("open document request is shown", (await p.locator(".request-card").count()) === 1);
check("matter hold is visible to the client", (await p.textContent("[data-matter-strip]")).includes("Legal hold"));
check("signed matters show as directed by counsel", (await p.textContent("[data-matter-badges]")).includes("Directed by counsel"));
check("no check-in warning right after signing", !(await p.textContent("[data-matter-badges]")).includes("overdue"));
await p.click("[data-demo-toggle]");
await p.click(".demo-action >> text=Skip ahead 31 days");
await p.waitForTimeout(200);
check("a lawyer who hasn't checked in triggers a warning", (await p.textContent("[data-matter-badges]")).includes("Lawyer check-in overdue"));
check("the warning explains why on hover", (await p.getAttribute(".tag-warn.has-tip", "data-tip")).includes("since"));
await p.click(".demo-action >> text=Lawyer: check in on this matter");
await p.waitForTimeout(200);
check("a check-in clears the warning", !(await p.textContent("[data-matter-badges]")).includes("overdue"));
await p.click("body", { position: { x: 5, y: 5 } });
await p.click("[data-tool=documents]");
check("documents lists every file in the matter", (await p.locator("[data-tool-panel] .doc-row").count()) === 3);
await p.click("[data-tool=assistant]");
await p.click(".conv-tab >> nth=0");
await p.hover(".msg-user >> nth=0");
check("deleting is blocked during a legal hold", await p.isDisabled(".msg-user >> nth=0 >> .msg-actions >> text=Delete"));
await p.click(".conv-lawyer");
check("lawyer tab shows counsel's note", (await p.textContent("[data-thread]")).includes("Do not contact the tenant"));

// Settings: theme, lock
await p.click("[data-open-settings]");
await p.selectOption("[data-set-theme]", "light");
check("light appearance applies", (await p.evaluate(() => document.documentElement.dataset.theme)) === "light");
await p.selectOption("[data-set-theme]", "dark");
await p.click("[data-tab=security]");
await p.click("[data-lock-now]");
check("lock now locks the workspace", await p.isVisible("[data-overlay=unlock]"));
await p.reload();
await start(p);
await p.waitForTimeout(500);
check("lock survives a reload", await p.isVisible("[data-overlay=unlock]"));
await p.fill("[data-unlock-form] [name=secret]", PASSWORD);
await p.click("[data-unlock-submit]");
await p.waitForSelector("[data-overlay=unlock]", { state: "hidden", timeout: 20000 });
check("password unlocks again", (await p.locator("[data-matters] .matter").count()) >= 1);

// Shortcuts
await p.click("body", { position: { x: 900, y: 500 } });
await p.keyboard.press("?");
check("? opens keyboard shortcuts", await p.isVisible("[data-overlay=shortcuts]"));
await p.keyboard.press("Escape");

console.log("Browsers that block IndexedDB");
{
  const q = await newPage(browser, { blockIndexedDB: true });
  await onboard(q);
  await newMatter(q, "Zoning variance");
  await sendMessage(q, "Do we need a variance for a fence?");
  await go(q, "counsel");
  check("counsel view still works without IndexedDB", (await q.textContent("[data-cp-thread]")).includes("variance for a fence"));
}

console.log("Demo controls");
{
  await go(p, "");
  await p.click("[data-demo-toggle]");
  check("demo panel lists actions", (await p.locator(".demo-action").count()) >= 2);
}

check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
