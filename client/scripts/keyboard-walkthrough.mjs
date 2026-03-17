#!/usr/bin/env node

const sections = [
  {
    title: "Global Navigation",
    steps: [
      "Press Ctrl/Cmd+K and verify Command Palette opens with focus in the command search input.",
      "Press Escape and verify Command Palette closes and focus returns to trigger.",
      "Use / from non-input context and verify search input receives focus.",
    ],
  },
  {
    title: "Mobile Drawer",
    steps: [
      "Resize to mobile width, activate Open navigation button, and verify focus moves into drawer.",
      "Press Tab repeatedly and verify focus loops within drawer controls.",
      "Press Shift+Tab at first focusable and verify focus wraps to last focusable.",
      "Press Escape and verify drawer closes and focus returns to nav trigger.",
    ],
  },
  {
    title: "Modal Focus Trap",
    steps: [
      "Open Add to Template modal and verify initial focus is inside modal.",
      "Tab through controls and confirm focus never escapes the modal.",
      "Open template delete confirmation and verify Escape closes it.",
      "Open Customer modal and verify table controls remain keyboard-reachable.",
    ],
  },
  {
    title: "Template Composer (P4 E3)",
    steps: [
      "Open Templates, then Open Composer for a template.",
      "Create an add-on module and verify it appears with Add-on badge.",
      "Add catalog content to template and verify item appears in Core module.",
      "Open Customer assignment and verify module column appears in object table.",
    ],
  },
  {
    title: "Saved Views and Pinned Filters (P4 E4)",
    steps: [
      "In Explorer or content view, set query/category/page size and click Save View.",
      "Apply saved view from workspace chips and confirm filters are restored.",
      "Click Pin Filter, then apply pinned filter from workspace chip.",
      "Open Command Palette and run Open Saved View and Apply Pinned Filter actions.",
    ],
  },
  {
    title: "Pagination Persistence",
    steps: [
      "Set different page/page-size in two content views (for example Explorer and Docs).",
      "Switch views and verify each restores its own pagination state.",
      "Reload app and verify persisted per-view pagination is retained.",
    ],
  },
];

console.log("SiteNavigator Keyboard Walkthrough Script");
console.log("Date:", new Date().toISOString());
console.log("\nRun each section and mark PASS/FAIL manually.\n");

for (const section of sections) {
  console.log(`## ${section.title}`);
  section.steps.forEach((step, index) => {
    console.log(`${index + 1}. [ ] ${step}`);
  });
  console.log("");
}
