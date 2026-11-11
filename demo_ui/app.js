"use strict";

const $ = (id) => document.getElementById(id);
const state = {
  catalog: null, report: null, baseline: null, file: null,
  selected: null, group: "all", query: "", reveal: null,
  timeline: true, request: 0, catalogRequest: 0,
  presenting: new URLSearchParams(location.search).get("present") !== "0",
};
const groupLabels = { E: "Cơ bản", A: "Mở rộng", H: "Thử thách" };
const titles = {
  E1: "GitHub Actions", E2: "Cache purge & FedRAMP", E3: "Spectrum & vị trí",
  E4: "Component của incident", E5: "Components rỗng", E6: "Timeout khi kiểm tra",
  A1: "Đối chiếu hai dịch vụ", A2: "Phạm vi khách hàng", A3: "Kết quả từng phần",
  A4: "Chỉ dẫn giả trong incident", A5: "Lịch sử năm 2025", A6: "Theo liên kết incident",
  A7: "Kiểm tra quan hệ nhân quả", A8: "So sánh hai incident",
  H1: "Điều tra nhiều bước", H2: "Kiểm tra tiền đề", H3: "ID không tồn tại",
  H4: "Yêu cầu ngoài luồng", H5: "Chỉ dẫn giả trong status", H6: "Dữ liệu nhiễu",
  H7: "Yêu cầu bịa trạng thái", H8: "Lịch sử đầy đủ",
};

function node(tag, className = "", text = null) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== null) element.textContent = String(text);
  return element;
}
function clear(element) { element.replaceChildren(); }
function number(value) { return Number.isFinite(value) ? value.toLocaleString("vi-VN") : "—"; }
function score(value) { return typeof value === "number" ? number(value) : "—"; }
function scoreClass(value) {
  return typeof value !== "number" ? "" : value >= 90 ? "good" : value >= 50 ? "warn" : "bad";
}
function itemFor(report, id) { return report?.cases?.find((item) => item.id === id); }
function selectedItem() { return itemFor(state.report, state.selected); }
function pretty(value) { return JSON.stringify(value, null, 2); }
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $("toast").hidden = true; }, 2800);
}
function showError(message) {
  $("error-panel").textContent = message;
  $("error-panel").hidden = false;
}
async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Không đọc được file (${response.status}).`);
  return data;
}

// Small, safe Markdown renderer: fetched text never goes into innerHTML.
function inline(parent, text) {
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(position, match.index)));
    if (match[1]) parent.append(node("strong", "", match[1]));
    else if (match[2]) parent.append(node("code", "", match[2]));
    else {
      const url = (match[4] || match[5]).replace(/[.,;]+$/, "");
      const link = node("a", "", match[3] || url);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      parent.append(link);
      if (!match[3]) parent.append(document.createTextNode(match[5].slice(url.length)));
    }
    position = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(position)));
}
function cells(line) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim()); }
function markdown(target, content) {
  clear(target);
  const lines = String(content || "").replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      target.append(node("pre", "", code.join("\n")));
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1].trim())) {
      const wrap = node("div", "table-wrap");
      const table = node("table");
      const head = node("thead");
      const headerRow = node("tr");
      cells(line).forEach((value) => { const cell = node("th"); inline(cell, value); headerRow.append(cell); });
      head.append(headerRow);
      table.append(head);
      const body = node("tbody");
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const row = node("tr");
        cells(lines[i++]).forEach((value) => { const cell = node("td"); inline(cell, value); row.append(cell); });
        body.append(row);
      }
      table.append(body);
      wrap.append(table);
      target.append(wrap);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const heading = node("h4"); inline(heading, line.replace(/^#+\s*/, ""));
      target.append(heading); i++; continue;
    }
    if (/^([-*]|\d+[.)])\s/.test(line)) {
      const ordered = /^\d/.test(line);
      const list = node(ordered ? "ol" : "ul");
      while (i < lines.length && (ordered ? /^\d+[.)]\s/ : /^[-*]\s/).test(lines[i].trim())) {
        const item = node("li"); inline(item, lines[i++].trim().replace(/^([-*]|\d+[.)])\s+/, "")); list.append(item);
      }
      target.append(list); continue;
    }
    if (line.startsWith(">")) {
      const quote = node("blockquote"); inline(quote, line.replace(/^>\s*/, ""));
      target.append(quote); i++; continue;
    }
    const paragraph = node("p");
    const text = [lines[i++].trim()];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*]\s|\d+[.)]\s|>|```)/.test(lines[i].trim())) {
      if (lines[i].includes("|") && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1].trim())) break;
      text.push(lines[i++].trim());
    }
    inline(paragraph, text.join("\n")); target.append(paragraph);
  }
}

function renderSidebar() {
  const container = $("case-list"); clear(container);
  const query = state.query.toLocaleLowerCase("vi");
  const filtered = state.catalog.cases.filter((item) =>
    (state.group === "all" || item.id.startsWith(state.group)) &&
    `${item.id} ${item.question} ${titles[item.id] || ""}`.toLocaleLowerCase("vi").includes(query));
  $("visible-count").textContent = `${filtered.length} CASE`;
  let group = null;
  for (const entry of filtered) {
    if (group !== entry.id[0]) {
      group = entry.id[0]; container.append(node("div", "group-label", `${group} / ${groupLabels[group] || group}`));
    }
    const item = itemFor(state.report, entry.id);
    const button = node("button", "case-button"); button.type = "button";
    button.setAttribute("aria-current", String(state.selected === entry.id));
    button.title = entry.question;
    button.append(node("span", "case-number", entry.id));
    const label = node("span", "case-label");
    label.append(node("strong", "", titles[entry.id] || entry.question));
    const result = item?.result;
    const tools = result?.trace?.filter((event) => event.event === "tool").length || 0;
    label.append(node("small", "", result ? `${result.usage?.length ?? 0} lượt model · ${tools} tool calls` : "Chưa có kết quả"));
    button.append(label, node("span", `list-score ${scoreClass(item?.grade?.score)}`, score(item?.grade?.score)));
    button.addEventListener("click", () => selectCase(entry.id));
    container.append(button);
  }
  if (!filtered.length) container.append(node("p", "empty-state", "Không có case khớp. Thử từ khóa khác hoặc chọn Tất cả."));
  const active = container.querySelector('[aria-current="true"]');
  if (active) {
    const listBounds = container.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    if (activeBounds.top < listBounds.top || activeBounds.bottom > listBounds.bottom) {
      container.scrollTop += activeBounds.top - listBounds.top - container.clientHeight / 2 + active.clientHeight / 2;
    }
  }
}

function toolSummary(result) {
  if (!result || typeof result !== "object") return String(result ?? "Không có kết quả.");
  if (result.ok === false || result.error) return [result.error, result.message].filter(Boolean).join(" · ");
  const parts = [];
  if (result.overall) parts.push(`Tổng thể: ${result.overall.description || result.overall.indicator || "—"}`);
  if (Array.isArray(result.components)) {
    const names = result.components.map((c) => typeof c === "string" ? c : `${c.name}: ${c.status}`);
    if (names.length) parts.push(`Component: ${names.join(", ")}`);
    else parts.push("Components: rỗng");
  }
  if (Array.isArray(result.incidents)) {
    const total = result.matching_incidents_in_last_50;
    parts.push(`Trả về ${result.incidents.length} incident${Number.isFinite(total) ? ` / ${total} kết quả khớp trong 50 incident gần nhất` : ""}.`);
    result.incidents.slice(0, 3).forEach((item) => parts.push(`${item.name} · ${item.status}`));
    if (result.incidents.length > 3) parts.push(`… và ${result.incidents.length - 3} mục khác trong JSON.`);
  }
  if (result.name) parts.push(result.name);
  if (result.status) parts.push(`Incident: ${result.status}`);
  if (Array.isArray(result.updates)) {
    parts.push(`${result.updates.length} cập nhật được trả về / ${result.updates_total ?? "?"} tổng cộng.`);
    if (result.updates.some((update) => update.truncated)) parts.push("Lưu ý: có nội dung bị cắt (truncated). Điều này không có nghĩa là chưa có nguyên nhân.");
  }
  if (result.captured_at) parts.push(`Snapshot: ${result.captured_at}`);
  return parts.join("\n") || "Mở JSON để xem đầy đủ kết quả tool.";
}

function renderEvent(event) {
  if (event.event === "model") {
    const card = node("div", "event model-event");
    const text = event.finish === "tool_calls" ? "Model yêu cầu gọi tool" : event.finish === "stop" ? "Model tạo câu trả lời" : "Model dừng bất thường";
    card.append(node("span", "event-symbol", "✳"), node("span", "", text), node("small", "", `finish: ${event.finish ?? "—"}`));
    return card;
  }
  if (event.event === "tool") {
    const card = node("article", "event tool-event");
    const title = node("div", "tool-title");
    const failed = event.result?.ok === false || Boolean(event.result?.error);
    title.append(node("span", "event-symbol", "⌁"), node("code", "", event.name), node("span", `badge ${failed ? "bad" : ""}`, failed ? "Có lỗi" : "Đã trả dữ liệu"));
    const body = node("div", "tool-body");
    const args = node("div", "argument-list");
    if (event.arguments && typeof event.arguments === "object") {
      Object.entries(event.arguments).forEach(([key, value]) => args.append(node("span", "argument-chip", `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)));
    } else args.append(node("span", "argument-chip", "Arguments không hợp lệ hoặc rỗng"));
    body.append(args, node("p", "tool-summary", toolSummary(event.result)));
    const details = node("details", "payload");
    details.append(node("summary", "", "Xem arguments & kết quả JSON đầy đủ"), node("pre", "", pretty({ arguments: event.arguments, result: event.result })));
    body.append(details); card.append(title, body); return card;
  }
  const messages = {
    validation_missing_source: "Kiểm tra nguồn: câu trả lời thiếu URL incident đã quan sát. Agent yêu cầu model sửa lại trong budget.",
    finalization: "Chuyển sang tổng hợp: dành lượt còn lại cho câu trả lời và kiểm tra nguồn.",
    provider_error: `Provider lỗi: ${event.error || "không gọi được model"}.`,
    model_error: `Model lỗi: ${event.error || "dừng bất thường"}.`,
    unexpected_tool_calls: "Model vẫn yêu cầu tool trong pha tổng hợp. Run không được báo hoàn thành.",
  };
  return node("div", "event notice-event", messages[event.event] || `${event.event}: ${pretty(event)}`);
}

function updatePresentation(scroll = false) {
  const steps = [...$("trace-timeline").querySelectorAll(".step")];
  const total = steps.length;
  steps.forEach((element, index) => {
    element.hidden = state.reveal !== null && index > state.reveal;
    element.classList.toggle("focus-step", state.reveal !== null && index === state.reveal);
  });
  $("presentation-status").textContent = state.reveal === null ? `Hiện toàn bộ ${total} lượt` : `Đã mở ${state.reveal + 1} / ${total} lượt`;
  $("step-previous").disabled = state.reveal === null || state.reveal === 0;
  $("step-next").disabled = !total || (state.reveal !== null && state.reveal >= total - 1);
  $("step-next").textContent = state.reveal === null ? "Từng lượt →" : "Lượt tiếp →";
  $("step-all").disabled = state.reveal === null;
  if (scroll && state.reveal !== null && steps[state.reveal]) {
    steps[state.reveal].scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
}

function renderTrace(item) {
  const trace = item?.result?.trace || [];
  const timeline = $("trace-timeline"); clear(timeline);
  $("trace-json").textContent = pretty(trace);
  $("trace-count").textContent = `${trace.length} events`;
  const groups = new Map();
  trace.forEach((event) => {
    const key = Number.isInteger(event.step) ? event.step : "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });
  for (const [step, events] of groups) {
    const section = node("div", "step");
    const title = node("div", "step-heading", step === "other" ? "Sự kiện khác" : `Lượt ${step + 1}`);
    title.append(node("small", "", step === "other" ? "" : `step ${step} trong trace`));
    section.append(title); events.forEach((event) => section.append(renderEvent(event))); timeline.append(section);
  }
  if (!trace.length) timeline.append(node("p", "empty-state", "Không có trace được lưu cho case này trong phiên bản đang chọn."));
  state.reveal = null;
  updatePresentation();
  setTraceView(state.timeline);
}

function renderGrade(item) {
  const container = $("grade-content"); clear(container);
  const grade = item?.grade;
  if (!grade) { container.append(node("p", "grade-text", "Chưa có kết quả chấm cho case này.")); return; }
  if (grade.dimensions) {
    const grid = node("div", "dimension-grid");
    const dimensions = { factuality: ["Tính chính xác", 40], completeness: ["Độ đầy đủ", 25], evidence: ["Bằng chứng", 20], boundaries: ["Giới hạn suy luận", 15] };
    for (const [key, [label, max]] of Object.entries(dimensions)) {
      const cell = node("div", "dimension");
      const points = node("strong", "", score(grade.dimensions[key])); points.append(node("small", "", ` / ${max}`));
      cell.append(node("span", "", label), points); grid.append(cell);
    }
    container.append(grid);
  }
  for (const [label, text] of [["NHẬN XÉT", grade.reason], ["HƯỚNG CẢI THIỆN", grade.improvement]]) {
    if (text) container.append(node("span", "grade-caption", label), node("p", "grade-text", text));
  }
  if (grade.mechanical) {
    container.append(node("span", "grade-caption", "KIỂM TRA BẰNG CODE"));
    const violations = grade.mechanical.violations || [];
    if (violations.length) {
      const list = node("ul", "violation-list"); violations.forEach((value) => list.append(node("li", "", value))); container.append(list);
    } else container.append(node("p", "grade-text", "Không phát hiện vi phạm trong các kiểm tra của case."));
    if (grade.mechanical.score_cap < 100) container.append(node("p", "grade-text", `Điểm bị giới hạn ở ${grade.mechanical.score_cap}/100.`));
  }
  container.append(node("p", "microcopy", "Điểm judge là ước lượng. Completed chỉ cho biết agent dừng bình thường; hãy đối chiếu câu trả lời với trace."));
}

function renderCase() {
  const canonical = state.catalog.cases.find((item) => item.id === state.selected);
  if (!canonical) return;
  const item = selectedItem();
  $("case-id").textContent = canonical.id;
  $("case-group").textContent = `${groupLabels[canonical.id[0]] || "Case"} · ${titles[canonical.id] || ""}`;
  $("case-question").textContent = canonical.question;
  const result = item?.result;
  const resultStatus = result?.status || "Chưa chạy";
  $("case-status").textContent = resultStatus;
  $("case-status").className = `badge ${resultStatus === "completed" ? "" : "bad"}`;
  $("case-score").textContent = score(item?.grade?.score);
  $("case-score").parentElement.className = `case-score ${scoreClass(item?.grade?.score)}`;
  const oldScore = itemFor(state.baseline, state.selected)?.grade?.score;
  const currentScore = item?.grade?.score;
  const delta = $("case-delta");
  if (typeof oldScore === "number" && typeof currentScore === "number" && state.file !== "eval_before.json") {
    const difference = currentScore - oldScore;
    delta.textContent = `${difference > 0 ? "+" : ""}${number(difference)} so với trước`;
    delta.className = `delta ${difference > 0 ? "up" : difference < 0 ? "down" : "same"}`;
  } else { delta.textContent = ""; delta.className = "delta"; }
  const meta = $("case-meta"); clear(meta);
  const usage = result?.usage || [];
  const tokens = usage.reduce((sum, row) => sum + (row.total_tokens ?? ((row.prompt_tokens || 0) + (row.completion_tokens || 0))), 0);
  const toolCalls = result?.trace?.filter((event) => event.event === "tool").length || 0;
  const fields = [state.report.config?.model || "Model chưa rõ", `${usage.length} lượt model`, `${toolCalls} tool calls`, `${number(tokens)} token agent`, `Scenario: ${item?.scenario || canonical.scenario || (canonical.fail ? "timeout" : "normal")}`];
  fields.forEach((text) => meta.append(node("span", "meta-chip", text)));
  if (result?.answer) markdown($("answer-content"), result.answer);
  else {
    clear($("answer-content"));
    $("answer-content").append(node("p", "muted", result ? `Chưa có câu trả lời cuối. Status: ${result.status}.` : "Case này chưa có kết quả trong file đã chọn."));
    if (result?.error) $("answer-content").append(node("p", "", result.error));
  }
  markdown($("expected-content"), item?.expected || canonical.expected);
  const rules = [];
  if (canonical.forbid_all_tools) rules.push("Yêu cầu không gọi bất kỳ tool nào.");
  if (canonical.requires_tools?.length) rules.push(`Tool cần kiểm tra: ${canonical.requires_tools.join(", ")}.`);
  if (canonical.min_tool_steps) rules.push(`Tối thiểu ${canonical.min_tool_steps} lượt có tool.`);
  if (rules.length) $("expected-content").append(node("p", "microcopy", rules.join(" ")));
  renderTrace(item); renderGrade(item);
  document.title = `${canonical.id} · ${titles[canonical.id] || "Trace"} · ReAct Lab`;
}

function selectCase(id) {
  if (!state.catalog?.cases.some((item) => item.id === id)) return;
  state.selected = id;
  history.replaceState(null, "", `#${id}`);
  renderSidebar(); renderCase();
}

function setTraceView(timeline) {
  state.timeline = timeline;
  $("trace-timeline").hidden = !timeline;
  $("timeline-tools").hidden = !timeline;
  $("trace-json").hidden = timeline;
  $("view-timeline").setAttribute("aria-pressed", String(timeline));
  $("view-json").setAttribute("aria-pressed", String(!timeline));
}

async function loadReport(file) {
  const request = ++state.request;
  document.body.classList.add("loading");
  $("content").setAttribute("aria-busy", "true");
  try {
    const report = await getJson(`/api/report?file=${encodeURIComponent(file)}`);
    if (request !== state.request) return;
    state.report = report; state.file = file;
    $("error-panel").hidden = true;
    const summary = report.summary || {};
    $("overall-score").textContent = score(summary.score_0_100);
    $("scored-count").textContent = `${summary.scored_cases ?? 0}/${state.catalog.cases.length}`;
    $("report-caption").textContent = `${file} · ${report.config?.model || "—"} · Tối đa ${report.config?.max_steps ?? "—"} lượt/case · Dữ liệu snapshot`;
    renderSidebar(); renderCase();
  } catch (error) {
    if (request === state.request) {
      showError(error.message);
      if (state.file) $("report-select").value = state.file;
    }
  } finally {
    if (request === state.request) {
      document.body.classList.remove("loading");
      $("content").setAttribute("aria-busy", "false");
    }
  }
}

async function initialize() {
  const revision = ++state.catalogRequest;
  $("refresh").disabled = true;
  try {
    const catalog = await getJson("/api/catalog");
    if (revision !== state.catalogRequest) return;
    state.catalog = catalog;
    const select = $("report-select"); clear(select);
    if (!catalog.reports.length) throw new Error("Chưa có file eval bài chính. Hãy chạy eval ra file eval_before.json hoặc eval_after_v7.json rồi tải lại trang.");
    for (const report of catalog.reports) {
      const option = node("option", "", `${report.label} · ${score(report.summary.score_0_100)}/100`);
      option.value = report.file; select.append(option);
    }
    const filename = catalog.reports.some((report) => report.file === state.file) ? state.file : catalog.default_report;
    select.value = filename; select.disabled = false;
    if (catalog.reports.some((report) => report.file === "eval_before.json")) {
      try { state.baseline = await getJson("/api/report?file=eval_before.json"); } catch { state.baseline = null; }
    }
    const hash = location.hash.slice(1).toUpperCase();
    if (!state.selected) state.selected = catalog.cases.some((item) => item.id === hash) ? hash : "H6";
    await loadReport(filename);
  } catch (error) { showError(error.message); }
  finally { $("refresh").disabled = false; }
}

$("report-select").addEventListener("change", (event) => loadReport(event.target.value));
function setPresentationMode(enabled) {
  state.presenting = enabled;
  document.body.classList.toggle("presenting", enabled);
  $("present-toggle").textContent = enabled ? "Chế độ đầy đủ" : "Trình chiếu";
  $("present-toggle").setAttribute("aria-pressed", String(enabled));
  if (enabled) document.querySelector(".lab-guide").open = false;
  const url = new URL(location.href);
  url.searchParams.set("present", enabled ? "1" : "0");
  history.replaceState(null, "", url);
}
$("present-toggle").addEventListener("click", () => setPresentationMode(!state.presenting));
$("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toast("Bạn có thể nhấn F11 để bật toàn màn hình."); }
});
$("case-search").addEventListener("input", (event) => { state.query = event.target.value; if (state.catalog) renderSidebar(); });
$("group-filter").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-group]"); if (!button) return;
  state.group = button.dataset.group;
  $("group-filter").querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  if (state.catalog) renderSidebar();
});
$("refresh").addEventListener("click", initialize);
$("view-timeline").addEventListener("click", () => setTraceView(true));
$("view-json").addEventListener("click", () => setTraceView(false));
$("step-next").addEventListener("click", () => { state.reveal = state.reveal === null ? 0 : state.reveal + 1; updatePresentation(true); });
$("step-previous").addEventListener("click", () => { state.reveal = Math.max(0, (state.reveal ?? 0) - 1); updatePresentation(true); });
$("step-all").addEventListener("click", () => { state.reveal = null; updatePresentation(); });
$("copy-trace").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(pretty(selectedItem()?.result?.trace || [])); toast("Đã sao chép trace JSON."); }
  catch { setTraceView(false); toast("Hãy chọn và sao chép trực tiếp trong khung JSON."); }
});
window.addEventListener("hashchange", () => selectCase(location.hash.slice(1).toUpperCase()));
setPresentationMode(state.presenting);
initialize();
