import assert from "node:assert/strict";
import fs from "node:fs";
import { simulateStats } from "../lib/simulate.js";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const url = process.env.TEST_URL || "http://127.0.0.1:8804/bundle-lab/";
const out = process.env.EVIDENCE_DIR || "/tmp/bundle-browser";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function slider(name, value) {
  await page.getByRole("slider", { name, exact: true }).evaluate((e, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(e, String(v));
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
async function download(name, file) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const d = await pending;
  await d.saveAs(out + "/" + file);
  return fs.readFileSync(out + "/" + file, "utf8");
}
try {
  await page.goto(url + "bundles/");
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.locator(".nav a[aria-current=page]").innerText(),
    "组合发现",
  );
  await page.getByLabel("订单分群").selectOption("dinner");
  await page.getByLabel("组合排序").selectOption("support");
  await page.getByLabel("订单分群").selectOption("all");
  assert.equal(await page.locator(".combo-disclosure").count(), 10);
  await page.getByRole("button", { name: /再看10个/ }).click();
  assert.equal(await page.locator(".combo-disclosure").count(), 20);
  await slider("lift 下限", 10);
  await page.getByText("这个筛选下没有组合。", { exact: false }).waitFor();
  await slider("lift 下限", 1.2);
  await page.locator(".combo-disclosure").first().waitFor();
  await page.locator(".combo-disclosure").first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("link", { name: "带入收益推演 →", exact: true }).click();
  await page.waitForURL(u=>u.pathname.replace(/\/$/,'').endsWith('/simulate')&&u.searchParams.has('bundle'));
  await page.waitForLoadState("networkidle");
  const key = new URL(page.url()).searchParams.get("bundle");
  assert.equal(
    await page.getByLabel("选择组合", { exact: true }).inputValue(),
    key,
  );
  await slider("套餐折扣率", 0.2);
  await slider("食材成本率", 0.5);
  await slider("既有整套顾客领折扣率", 0.3);
  await slider("中档采纳率", 0.03);
  let d = JSON.parse(await download("导出本组推演", "scenario.json"));
  assert.equal(d.assumptions.discount, 0.2);
  assert.equal(d.assumptions.existingRedemption, 0.3);
  assert.equal(d.assumptions.adoption.conservative, 0.03);
  for (const b of d.results) {
    const expected = simulateStats(b, d.assumptions);
    assert.ok(
      Math.abs(
        expected.scenarios.neutral.marginLift - b.scenarios.neutral.marginLift,
      ) < 1e-9,
    );
  }
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page
      .getByRole("slider", { name: "套餐折扣率", exact: true })
      .inputValue(),
    "0.2",
  );
  await slider("中档采纳率", 0);
  await slider("既有整套顾客领折扣率", 1);
  d = JSON.parse(await download("导出本组推演", "zero-adoption.json"));
  const picked = d.results.find((b) => b.key === d.assumptions.pickKey);
  assert.ok(picked.scenarios.neutral.marginLift < 0);
  assert.equal(picked.scenarios.neutral.addedMargin, 0);
  await page.getByText(/^调整对比清单/).click();
  const checked = page.getByRole("checkbox", { checked: true });
  while (await checked.count()) await checked.first().uncheck();
  assert.match(await page.locator("main").innerText(), /尚未选择对比组合/);
  for (let i = 0; i < 3; i++) await page.getByRole("checkbox").nth(i).check();
  assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 3);
  assert.ok(await page.getByRole("checkbox").nth(3).isDisabled());
  await slider("套餐折扣率", 1);
  await page
    .getByRole("link", { name: "用当前假设生成建议 →", exact: true })
    .click();
  await page.waitForLoadState("networkidle");
  let report = JSON.parse(await download("导出结构化依据", "report.json"));
  assert.equal(report.assumptions.discount, 1);
  assert.equal(report.actions.length, 0);
  assert.equal(report.assumptions.adoption.neutral, 0);
  assert.match(await page.locator("main").innerText(), /当前没有同时满足/);
  await page.getByRole("button", { name: "恢复默认假设", exact: true }).click();
  report = JSON.parse(await download("导出结构化依据", "default-report.json"));
  assert.ok(report.actions.length > 0);
  const template = await download("导出 Markdown", "playbook.md");
  assert.match(template, /下一步验证/);
  assert.match(template, /two-population-v2/);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "复制规则建议", exact: true }).click();
  assert.match(await page.locator("main").innerText(), /浏览器未允许复制/);
  // A stubbed endpoint only: this test never contacts a model or consumes tokens.
  let requests = 0;
  await page.route("https://bundle-mock.invalid/**", async (route) => {
    requests++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        choices: [{ message: { content: "故意错误的数字 987654321" } }],
      }),
    });
  });
  await page.getByRole("button", { name: "设置模型", exact: true }).click();
  await page
    .getByLabel("HTTPS Base URL")
    .fill("https://bundle-mock.invalid/v1");
  await page
    .getByLabel("API Key", { exact: true })
    .fill("test-only-not-a-secret");
  await page.getByLabel("模型名", { exact: true }).fill("mock");
  await page.waitForTimeout(100);
  assert.equal(requests, 0);
  await page.getByRole("button", { name: "请求润色", exact: true }).click();
  await page
    .getByRole("heading", { name: "润色草稿 · 未核对", exact: true })
    .waitFor();
  assert.equal(requests, 1);
  const formal = await download("导出 Markdown", "formal-after-polish.md");
  assert.doesNotMatch(formal, /987654321/);
  const draft = await download("下载未核对草稿", "polish.md");
  assert.match(draft, /未核对/);
  assert.match(draft, /987654321/);
  await page.unroute("https://bundle-mock.invalid/**");
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("https://bundle-mock.invalid/**", async (route) => {
    requests++;
    await held;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [{ message: { content: "过期内容" } }],
        }),
      })
      .catch(() => {});
  });
  const waiting = page.waitForRequest(
    "https://bundle-mock.invalid/v1/chat/completions",
  );
  await page.getByRole("button", { name: "请求润色", exact: true }).click();
  await waiting;
  await page.getByRole("button", { name: "取消请求", exact: true }).click();
  release();
  assert.match(await page.locator("main").innerText(), /已取消润色/);
  assert.equal(
    await page
      .getByRole("heading", { name: "润色草稿 · 未核对", exact: true })
      .count(),
    0,
  );
  await page.unroute("https://bundle-mock.invalid/**");
  await page.route("https://bundle-mock.invalid/**", (route) => {
    requests++;
    return route.fulfill({
      status: 503,
      body: "server details must not appear",
    });
  });
  await page.getByRole("button", { name: "请求润色", exact: true }).click();
  await page.getByText(/润色失败（接口/).waitFor();
  assert.doesNotMatch(
    await page.locator("main").innerText(),
    /server details must not appear/,
  );
  assert.equal(
    await page.getByLabel("API Key", { exact: true }).getAttribute("type"),
    "password",
  );
  assert.ok(
    !(await page.evaluate(() => JSON.stringify(localStorage))).includes(
      "test-only-not-a-secret",
    ),
  );
  await page.getByRole("button", { name: "清除连接信息", exact: true }).click();
  assert.equal(
    await page.getByLabel("API Key", { exact: true }).inputValue(),
    "",
  );
  await page.getByRole("button", { name: "请求润色", exact: true }).click();
  assert.equal(requests, 3);
  assert.match(await page.locator("main").innerText(), /有效 HTTPS/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of [
    "",
    "bundles/",
    "simulate/",
    "playbook/",
    "validation/",
    "method/",
  ]) {
    await page.goto(url + route);
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".nav a").count(), 6);
    assert.equal(await page.locator(".nav a[aria-current=page]").count(), 1);
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth,
        {},
        { timeout: 2500 },
      );
      for (const nav of await page.locator(".nav a").all())
        assert.ok(await nav.isVisible());
    }
  }
  await page.goto(url + "simulate/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: out + "/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: out + "/desktop.png", fullPage: true });
  await page.evaluate(() =>
    localStorage.setItem("bundle-lab:scenario:v2", "{bad"),
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.match(await page.locator("main").innerText(), /草稿无法恢复/);
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  const p = await blocked.newPage();
  await p.goto(url + "playbook/");
  await p.waitForLoadState("networkidle");
  assert.match(await p.locator("main").innerText(), /保存不可用|无法恢复/);
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: discovery handoff, exact two-population export, shared assumptions/reload, zero-adoption loss, comparison cap/empty, no-action report, verified template vs mocked unverified polish, no stored key, six routes × four widths, storage recovery and reduced motion; no page errors.",
  );
} finally {
  await browser.close();
}
