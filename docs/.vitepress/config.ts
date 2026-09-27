import { defineConfig } from "vitepress";
import llmstxt, {
  copyOrDownloadAsMarkdownButtons,
} from "vitepress-plugin-llms";

export default defineConfig({
  lang: "en-US",
  title: "sensored",
  description: "Streaming-first PII redaction library for TypeScript",
  base: "/sensored/",
  cleanUrls: true,
  lastUpdated: true,
  vite: {
    plugins: [llmstxt()],
  },
  markdown: {
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Detectors", link: "/detectors/overview" },
      { text: "API", link: "/api/reference" },
      { text: "About", link: "/about/changelog" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Installation", link: "/guide/getting-started" },
            { text: "Quick Start", link: "/guide/quick-start" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Presets", link: "/guide/presets" },
            { text: "Transformations", link: "/guide/transformations" },
            { text: "Configuration", link: "/guide/configuration" },
          ],
        },
        {
          text: "Advanced",
          items: [
            { text: "Custom Detectors", link: "/guide/custom-detectors" },
            {
              text: "AI Confirmation",
              link: "/guide/semantic-confirmation",
            },
            { text: "LLM Steering", link: "/guide/llm-steering" },
            { text: "Streaming", link: "/guide/streaming" },
            { text: "Restoration", link: "/guide/restoration" },
            { text: "Errors", link: "/guide/errors" },
          ],
        },
      ],
      "/detectors/": [
        {
          text: "Overview",
          items: [{ text: "All Detectors", link: "/detectors/overview" }],
        },
        {
          text: "By Domain",
          items: [
            { text: "Contact", link: "/detectors/contact" },
            { text: "Financial", link: "/detectors/financial" },
            { text: "National ID", link: "/detectors/national-id" },
            { text: "Identity", link: "/detectors/identity" },
            { text: "Person Names", link: "/detectors/person" },
            { text: "Network", link: "/detectors/network" },
            { text: "Cloud Keys", link: "/detectors/cloud" },
            { text: "Tokens & Keys", link: "/detectors/token" },
            { text: "Healthcare", link: "/detectors/healthcare" },
            { text: "HR", link: "/detectors/hr" },
            { text: "Legal", link: "/detectors/legal" },
            { text: "Crypto", link: "/detectors/crypto" },
            { text: "Logistics", link: "/detectors/logistics" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Reference",
          items: [{ text: "API Reference", link: "/api/reference" }],
        },
      ],
      "/about/": [
        {
          text: "About",
          items: [{ text: "Changelog", link: "/about/changelog" }],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/atomicpages/sensored" },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Dennis Thompson",
    },
  },
});
