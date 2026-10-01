<script setup lang="ts">
import { useRouter, withBase } from "vitepress";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  buildPlaygroundRules,
  changePreset,
  createMatchDetails,
  createPlaygroundState,
  generatePlaygroundCode,
  type MatchDetail,
  parseAllowlist,
  PLAYGROUND_ACTIONS,
  PLAYGROUND_INPUT_LIMIT,
  PLAYGROUND_PRESETS,
  PLAYGROUND_SAMPLE_OUTPUT,
  type PlaygroundAction,
  type PlaygroundPreset,
  summarizeEntities,
  validatePlaygroundInput,
} from "./playground";
import {
  savePlaygroundHandoff,
  takePlaygroundHandoff,
} from "./playground-handoff";

interface DetectorDescription {
  readonly id: string;
  readonly entityType: string;
}

const props = defineProps<{
  mode: "compact" | "full";
}>();

const router = useRouter();
const initialState = createPlaygroundState();
const root = ref<HTMLElement>();
const input = ref(initialState.input);
const inputChanged = ref(false);
const preset = ref<PlaygroundPreset>(initialState.preset);
const action = ref<PlaygroundAction>(initialState.action);
const output = ref(PLAYGROUND_SAMPLE_OUTPUT);
const allowlist = ref<string[]>([]);
const allowlistDraft = ref("");
const disabledDetectorIds = ref<Set<string>>(new Set());
const nerEnabled = ref(false);
const nerLoading = ref(false);
const activeDetectors = ref<readonly DetectorDescription[]>([]);
const activePriorities = ref<Readonly<Record<string, number | undefined>>>({});
const details = ref<readonly MatchDetail[]>([]);
const error = ref<string>();
const loading = ref(false);
const ready = ref(false);
const copied = ref<"install" | "output" | "code">();
const detectorQuery = ref("");
const codeElement = ref<HTMLElement>();
const codePanelOpen = ref(false);

let core: typeof import("@sensored-core") | undefined;
let highlighterPromise:
  | Promise<typeof import("@speed-highlight/core")>
  | undefined;
let observer: IntersectionObserver | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let runId = 0;
let highlightRunId = 0;

const isFull = computed(() => props.mode === "full");
const entityTypes = computed(() => summarizeEntities(details.value));

const enabledCount = computed(() => {
  const activeCount = activeDetectors.value.filter(
    (detector) =>
      !disabledDetectorIds.value.has(detector.id) &&
      (!nerEnabled.value || detector.id !== "person_name_lite"),
  ).length;

  return activeCount + (nerEnabled.value ? 1 : 0);
});

const filteredDetectors = computed(() => {
  const query = detectorQuery.value.trim().toLowerCase();

  if (query.length === 0) {
    return activeDetectors.value;
  }

  return activeDetectors.value.filter(
    (detector) =>
      detector.id.toLowerCase().includes(query) ||
      detector.entityType.toLowerCase().includes(query),
  );
});

const generatedCode = computed(() =>
  generatePlaygroundCode(
    activeDetectors.value.map((detector) => detector.id),
    currentState(),
    activePriorities.value,
  ),
);

onMounted(() => {
  if (isFull.value) {
    const handoff = takePlaygroundHandoff();

    if (handoff !== undefined) {
      input.value = handoff.input;
      inputChanged.value = true;
      preset.value = handoff.preset;
      action.value = handoff.action;
    }
  }

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          void initialize();
        }
      },
      { rootMargin: "240px" },
    );

    if (root.value !== undefined) {
      observer.observe(root.value);
    }
  } else {
    void initialize();
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  highlightRunId++;

  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
  }
});

watch(input, scheduleRedaction);
watch(action, scheduleRedaction);
watch(allowlist, scheduleRedaction, { deep: true });
watch(disabledDetectorIds, scheduleRedaction);
watch(generatedCode, () => {
  if (codePanelOpen.value) {
    void highlightGeneratedCode();
  }
});

watch(preset, async () => {
  const state = changePreset(
    currentState(),
    preset.value,
    inputChanged.value,
  );

  input.value = state.input;
  disabledDetectorIds.value = state.disabledDetectors;
  nerEnabled.value = state.nerEnabled;

  if (ready.value) {
    await refreshDetectors();
    scheduleRedaction();
  }
});

async function initialize(): Promise<void> {
  if (ready.value || loading.value) {
    return;
  }

  loading.value = true;

  try {
    core = await import("@sensored-core");
    await refreshDetectors();
    ready.value = true;
    await runRedaction();
  } catch {
    error.value = "The local playground could not load. Try refreshing the page.";
  } finally {
    loading.value = false;
  }
}

async function refreshDetectors(): Promise<void> {
  if (core === undefined) {
    return;
  }

  const redactor = core.createRedactor({
    presets: [preset.value],
    rules: {},
  });

  activeDetectors.value = redactor.describe();

  activePriorities.value = Object.fromEntries(
    Object.entries(redactor.policy).map(([detectorId, setting]) => [
      detectorId,
      setting.action === "redact" ? setting.priority : undefined,
    ]),
  );
}

function scheduleRedaction(): void {
  if (!ready.value) {
    return;
  }

  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    void runRedaction();
  }, 140);
}

async function runRedaction(): Promise<void> {
  const currentRun = ++runId;
  const validationError = validatePlaygroundInput(input.value);

  if (validationError !== undefined) {
    error.value = validationError;
    return;
  }

  if (core === undefined) {
    return;
  }

  if (enabledCount.value === 0 && !nerEnabled.value) {
    error.value = "Enable at least one detector.";
    output.value = input.value;
    details.value = [];
    return;
  }

  try {
    if (nerEnabled.value) {
      nerLoading.value = true;
      await core.preloadPersonNameDetector();
    }

    if (currentRun !== runId) {
      return;
    }

    const rules = buildPlaygroundRules(
      activeDetectors.value.map((detector) => detector.id),
      currentState(),
      activePriorities.value,
    );

    const redactor = core.createRedactor({
      presets: [preset.value],
      rules,
      allowlist: allowlist.value,
      limits: { maxInputLength: PLAYGROUND_INPUT_LIMIT },
    });

    const inspection = redactor.inspect(input.value);

    output.value = inspection.text;
    details.value = createMatchDetails(inspection.groups);
    error.value = undefined;
  } catch {
    error.value =
      nerEnabled.value
        ? "NER could not load. Install or refresh the optional detector and try again."
        : "Redaction failed for this configuration.";
  } finally {
    nerLoading.value = false;
  }
}

function currentState() {
  return {
    input: input.value,
    preset: preset.value,
    action: action.value,
    allowlist: allowlist.value,
    disabledDetectors: disabledDetectorIds.value,
    nerEnabled: nerEnabled.value,
  };
}

function toggleDetector(detectorId: string): void {
  const next = new Set(disabledDetectorIds.value);

  if (next.has(detectorId)) {
    next.delete(detectorId);
  } else {
    next.add(detectorId);
  }

  disabledDetectorIds.value = next;
}

async function toggleNer(): Promise<void> {
  nerEnabled.value = !nerEnabled.value;
  scheduleRedaction();
}

function addAllowlistEntry(): void {
  const entries = parseAllowlist(allowlistDraft.value);

  if (entries.length === 0) {
    return;
  }

  allowlist.value = Array.from(new Set([...allowlist.value, ...entries]));
  allowlistDraft.value = "";
}

function removeAllowlistEntry(entry: string): void {
  allowlist.value = allowlist.value.filter((candidate) => candidate !== entry);
}

function resetPlayground(): void {
  const state = createPlaygroundState();
  input.value = state.input;
  inputChanged.value = false;
  preset.value = state.preset;
  action.value = state.action;
  allowlist.value = [];
  disabledDetectorIds.value = new Set();
  nerEnabled.value = false;
}

function clearInput(): void {
  input.value = "";
  inputChanged.value = true;
}

function markInputChanged(): void {
  inputChanged.value = true;
}

function openFullPlayground(): void {
  savePlaygroundHandoff({
    input: input.value,
    preset: preset.value,
    action: action.value,
  });

  void router.go(withBase("/playground"));
}

async function copyText(
  value: string,
  target: "install" | "output" | "code",
): Promise<void> {
  await navigator.clipboard.writeText(value);
  copied.value = target;
  await nextTick();

  setTimeout(() => {
    if (copied.value === target) {
      copied.value = undefined;
    }
  }, 1_500);
}

function handleCodePanelToggle(event: Event): void {
  if (!(event.currentTarget instanceof HTMLDetailsElement)) {
    return;
  }

  codePanelOpen.value = event.currentTarget.open;

  if (codePanelOpen.value) {
    void highlightGeneratedCode();
  } else {
    highlightRunId++;
  }
}

async function highlightGeneratedCode(): Promise<void> {
  const currentRun = ++highlightRunId;

  await nextTick();

  const element = codeElement.value;

  if (
    element === undefined ||
    !codePanelOpen.value ||
    currentRun !== highlightRunId
  ) {
    return;
  }

  element.textContent = generatedCode.value;

  try {
    highlighterPromise ??= import("@speed-highlight/core");
    const { highlightElement } = await highlighterPromise;

    if (!codePanelOpen.value || currentRun !== highlightRunId) {
      return;
    }

    element.textContent = generatedCode.value;
    await highlightElement(element, "ts");

    if (currentRun !== highlightRunId && codePanelOpen.value) {
      void highlightGeneratedCode();
    }
  } catch {
    element.textContent = generatedCode.value;
  }
}
</script>

<template>
  <section
    ref="root"
    class="sensored-playground"
    :class="{ 'is-full': isFull }"
    aria-labelledby="playground-title"
  >
    <header class="playground-header">
      <div>
        <p class="eyebrow">Runs locally in your browser</p>
        <h2 id="playground-title">
          {{ isFull ? "Redaction playground" : "Paste text. Remove sensitive data." }}
        </h2>
        <p class="subtitle">
          Nothing leaves this page. Input is never stored or sent over the network.
        </p>
      </div>
      <div class="window-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </header>

    <div class="toolbar">
      <label>
        <span>Preset</span>
        <div class="select-control">
          <select v-model="preset" :disabled="!ready">
            <option v-for="name in PLAYGROUND_PRESETS" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
          <svg
            class="select-caret"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m3.5 6 4.5 4.5L12.5 6" />
          </svg>
        </div>
      </label>

      <label>
        <span>Action</span>
        <div class="select-control">
          <select v-model="action" :disabled="!ready">
            <option v-for="name in PLAYGROUND_ACTIONS" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
          <svg
            class="select-caret"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m3.5 6 4.5 4.5L12.5 6" />
          </svg>
        </div>
      </label>

      <div class="toolbar-actions">
        <button type="button" class="quiet-button" @click="resetPlayground">
          Reset
        </button>
        <button type="button" class="quiet-button" @click="clearInput">
          Clear
        </button>
      </div>
    </div>

    <div v-if="isFull" class="advanced-grid">
      <section class="control-panel">
        <div class="control-heading">
          <div>
            <h3>Detectors</h3>
            <p>{{ enabledCount }} of {{ activeDetectors.length }} enabled</p>
          </div>
          <input
            v-model="detectorQuery"
            type="search"
            placeholder="Search detectors"
            aria-label="Search detectors"
          />
        </div>

        <div class="detector-list" aria-label="Active detectors">
          <label v-for="detector in filteredDetectors" :key="detector.id">
            <input
              type="checkbox"
              :checked="!disabledDetectorIds.has(detector.id)"
              @change="toggleDetector(detector.id)"
            />
            <span>{{ detector.id }}</span>
            <small>{{ detector.entityType }}</small>
          </label>
        </div>

        <label class="ner-toggle">
          <input
            type="checkbox"
            :checked="nerEnabled"
            :disabled="nerLoading"
            @change="toggleNer"
          />
          <span>
            <strong>Higher-recall name NER</strong>
            <small>
              Replaces person_name_lite.
            </small>
          </span>
          <em v-if="nerLoading">Loading…</em>
        </label>
      </section>

      <section class="control-panel">
        <div class="control-heading">
          <div>
            <h3>Allowlist</h3>
            <p>Case-sensitive exact values</p>
          </div>
        </div>
        <form class="allowlist-form" @submit.prevent="addAllowlistEntry">
          <textarea
            v-model="allowlistDraft"
            class="allowlist-input"
            rows="3"
            placeholder="One exact value per line"
            aria-label="Allowlist values, one per line"
          />
          <button type="submit">Add values</button>
        </form>
        <div v-if="allowlist.length > 0" class="chips" aria-label="Allowlisted values">
          <button
            v-for="entry in allowlist"
            :key="entry"
            type="button"
            :aria-label="`Remove ${entry} from allowlist`"
            @click="removeAllowlistEntry(entry)"
          >
            {{ entry }} <span aria-hidden="true">×</span>
          </button>
        </div>
        <p v-else class="empty-state">No values allowlisted.</p>
      </section>
    </div>

    <div class="editor-grid">
      <section class="editor">
        <div class="editor-label">
          <label for="playground-input">Input</label>
          <span
            :class="{ over: input.length > PLAYGROUND_INPUT_LIMIT }"
            aria-live="polite"
          >
            {{ input.length.toLocaleString() }} / {{ PLAYGROUND_INPUT_LIMIT.toLocaleString() }}
          </span>
        </div>
        <textarea
          id="playground-input"
          v-model="input"
          spellcheck="false"
          :maxlength="PLAYGROUND_INPUT_LIMIT + 1"
          @input="markInputChanged"
        />
      </section>

      <section class="editor">
        <div class="editor-label">
          <span>Redacted</span>
          <button
            type="button"
            class="copy-button"
            :disabled="output.length === 0"
            @click="copyText(output, 'output')"
          >
            {{ copied === "output" ? "Copied" : "Copy" }}
          </button>
        </div>
        <textarea
          :value="output"
          readonly
          spellcheck="false"
          aria-label="Redacted output"
        />
      </section>
    </div>

    <p v-if="error" class="error-message" role="alert">{{ error }}</p>

    <footer class="result-footer" aria-live="polite">
      <span v-if="loading">Loading local redactor…</span>
      <span v-else-if="!ready">Playground loads when it enters view.</span>
      <span v-else>
        {{ details.length }} {{ details.length === 1 ? "match" : "matches" }}
        <template v-if="entityTypes.length > 0">
          · {{ entityTypes.join(" · ") }}
        </template>
      </span>
      <span class="local-badge">No uploads</span>
    </footer>

    <template v-if="isFull">
      <details class="result-details">
        <summary>Match details ({{ details.length }})</summary>
        <p class="details-note">
          Values are fully masked here so sensitive text is not duplicated.
        </p>
        <ul v-if="details.length > 0">
          <li v-for="(detail, index) in details" :key="`${detail.start}-${index}`">
            <code>{{ detail.ruleId }}</code>
            <span>{{ detail.preview }}</span>
            <small>
              {{ detail.start }}–{{ detail.end }} · {{ detail.reason }}
            </small>
          </li>
        </ul>
        <p v-else class="empty-state">No matches.</p>
      </details>

      <details class="code-panel" @toggle="handleCodePanelToggle">
        <summary>Use this configuration in TypeScript</summary>
        <div class="code-heading">
          <code>bun add sensored</code>
          <button type="button" @click="copyText(generatedCode, 'code')">
            {{ copied === "code" ? "Copied" : "Copy code" }}
          </button>
        </div>
        <pre><code
          ref="codeElement"
          class="generated-code"
          aria-label="Generated TypeScript configuration"
        >{{ generatedCode }}</code></pre>
      </details>
    </template>

    <div v-else class="conversion-row">
      <button
        type="button"
        class="install-command"
        @click="copyText('bun add sensored', 'install')"
      >
        <code>{{ copied === "install" ? "Copied" : "bun add sensored" }}</code>
      </button>
      <button type="button" class="primary-button" @click="openFullPlayground">
        Open full playground
      </button>
      <a href="./guide/quick-start">Quick Start</a>
    </div>
  </section>
</template>

<style scoped>
.sensored-playground {
  margin: 48px auto;
  max-width: 1152px;
  overflow: hidden;
  color: var(--vp-c-text-1);
  background:
    radial-gradient(circle at 80% -20%, color-mix(in srgb, var(--vp-c-brand-1) 16%, transparent), transparent 36%),
    var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  box-shadow: var(--vp-shadow-3);
}

.playground-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.playground-header h2,
.control-panel h3 {
  margin: 0;
  border: 0;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.subtitle,
.control-heading p,
.empty-state,
.details-note {
  margin: 4px 0 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.window-dots {
  display: flex;
  gap: 7px;
  order: -1;
  align-items: flex-start;
  padding-top: 7px;
}

.window-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff5f57;
}

.window-dots span:nth-child(2) {
  background: #febc2e;
}

.window-dots span:nth-child(3) {
  background: #28c840;
}

.toolbar {
  display: flex;
  align-items: end;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.toolbar label {
  display: grid;
  gap: 6px;
  min-width: 180px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
}

select,
input,
textarea,
button {
  font: inherit;
}

select,
input {
  min-height: 38px;
  padding: 7px 10px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.select-control {
  position: relative;
}

.select-control select {
  width: 100%;
  padding-right: 38px;
  appearance: none;
}

.select-caret {
  position: absolute;
  top: 50%;
  right: 13px;
  width: 16px;
  height: 16px;
  color: var(--vp-c-text-2);
  pointer-events: none;
  transform: translateY(-50%);
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.select-control select:disabled + .select-caret {
  opacity: 0.55;
}

select:focus-visible,
input:focus-visible,
textarea:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.quiet-button,
.copy-button {
  padding: 7px 11px;
  color: var(--vp-c-text-2);
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.advanced-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  border-bottom: 1px solid var(--vp-c-divider);
}

.control-panel {
  min-width: 0;
  padding: 20px 24px;
}

.control-panel + .control-panel {
  border-left: 1px solid var(--vp-c-divider);
}

.control-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.control-heading input {
  max-width: 210px;
}

.detector-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  max-height: 210px;
  overflow: auto;
}

.detector-list label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 8px;
  padding: 7px;
  border-radius: 7px;
}

.detector-list label:hover {
  background: var(--vp-c-bg-mute);
}

.detector-list input {
  grid-row: 1 / span 2;
  min-height: auto;
}

.detector-list span,
.detector-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detector-list small {
  color: var(--vp-c-text-3);
}

.ner-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
  padding: 12px;
  background: var(--vp-c-bg-mute);
  border-radius: 10px;
}

.ner-toggle input {
  min-height: auto;
  margin-top: 4px;
}

.ner-toggle span {
  display: grid;
}

.ner-toggle small {
  color: var(--vp-c-text-2);
}

.ner-toggle em {
  margin-left: auto;
  color: var(--vp-c-brand-1);
  font-size: 12px;
}

.allowlist-form {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.allowlist-input {
  min-width: 0;
  min-height: 78px;
  flex: 1;
  padding: 8px 10px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-family: inherit;
  line-height: 1.4;
}

.allowlist-form button,
.code-heading button {
  padding: 7px 12px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border: 0;
  border-radius: 8px;
  font-weight: 600;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
}

.chips button {
  max-width: 100%;
  overflow: hidden;
  padding: 5px 9px;
  color: var(--vp-c-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
}

.editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.editor {
  min-width: 0;
  padding: 16px 24px 20px;
}

.editor + .editor {
  border-left: 1px solid var(--vp-c-divider);
}

.editor-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  margin-bottom: 8px;
  color: var(--vp-c-text-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.editor-label .over {
  color: var(--vp-c-danger-1);
}

textarea {
  display: block;
  width: 100%;
  min-height: 245px;
  resize: vertical;
  padding: 14px;
  color: var(--vp-c-text-1);
  line-height: 1.55;
  background: color-mix(in srgb, var(--vp-c-bg) 88%, transparent);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

textarea[readonly] {
  color: var(--vp-c-success-1);
}

.error-message {
  margin: 0;
  padding: 10px 24px;
  color: var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
  border-top: 1px solid var(--vp-c-danger-2);
}

.result-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  color: var(--vp-c-text-2);
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12px;
}

.local-badge {
  flex: none;
  padding: 3px 8px;
  color: var(--vp-c-success-1);
  background: var(--vp-c-success-soft);
  border-radius: 999px;
}

.result-details,
.code-panel {
  padding: 14px 24px;
  border-top: 1px solid var(--vp-c-divider);
}

summary {
  cursor: pointer;
  font-weight: 650;
}

.result-details ul {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.result-details li {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) minmax(100px, 0.5fr) 1.5fr;
  gap: 12px;
  align-items: center;
  padding: 9px 11px;
  background: var(--vp-c-bg-mute);
  border-radius: 8px;
}

.result-details small {
  color: var(--vp-c-text-2);
}

.code-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}

.code-panel pre {
  max-height: 430px;
  overflow: auto;
  margin: 10px 0 0;
  padding: 16px;
  background: var(--vp-code-block-bg);
  border-radius: 10px;
}

.generated-code {
  display: block;
  min-width: max-content;
  color: var(--vp-code-color);
}

.generated-code :deep(.shj-syn-cmnt) {
  color: var(--vp-c-text-3);
  font-style: italic;
}

.generated-code :deep(.shj-syn-err),
.generated-code :deep(.shj-syn-kwd),
.generated-code :deep(.shj-syn-deleted) {
  color: var(--vp-c-danger-1);
}

.generated-code :deep(.shj-syn-num),
.generated-code :deep(.shj-syn-class) {
  color: var(--vp-c-warning-1);
}

.generated-code :deep(.shj-syn-insert),
.generated-code :deep(.shj-syn-str) {
  color: var(--vp-c-success-1);
}

.generated-code :deep(.shj-syn-bool),
.generated-code :deep(.shj-syn-type),
.generated-code :deep(.shj-syn-oper) {
  color: var(--vp-c-brand-1);
}

.generated-code :deep(.shj-syn-section),
.generated-code :deep(.shj-syn-func) {
  color: var(--vp-c-brand-2);
}

.generated-code :deep(.shj-syn-var) {
  color: var(--vp-c-danger-2);
}

.conversion-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--vp-c-divider);
}

.install-command,
.primary-button {
  min-height: 42px;
  padding: 9px 15px;
  border-radius: 9px;
}

.install-command {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}

.primary-button {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  border: 1px solid var(--vp-button-brand-border);
  font-weight: 650;
}

.conversion-row a {
  margin-left: auto;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

@media (max-width: 760px) {
  .sensored-playground {
    margin: 32px 0;
    border-radius: 12px;
  }

  .playground-header,
  .toolbar,
  .conversion-row {
    align-items: stretch;
    flex-direction: column;
  }

  .playground-header {
    gap: 12px;
  }

  .window-dots {
    order: 0;
  }

  .toolbar label {
    min-width: 0;
  }

  .toolbar-actions {
    margin-left: 0;
  }

  .advanced-grid,
  .editor-grid {
    grid-template-columns: 1fr;
  }

  .control-panel + .control-panel,
  .editor + .editor {
    border-top: 1px solid var(--vp-c-divider);
    border-left: 0;
  }

  .detector-list {
    grid-template-columns: 1fr;
  }

  .control-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .control-heading input {
    max-width: none;
  }

  .result-details li {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .conversion-row a {
    margin-left: 0;
    text-align: center;
  }
}
</style>
