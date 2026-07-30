---
name: explain-diff-html
description: Use when the user asks for a rich explanation of a code change, diff, branch, or PR. Produces HTML output.
---

# Explain Diff

Please make a rich, interactive explanation of the specified code change.

It should have these sections:

- Background: Explain the existing system relevant to this change. Broadly explore surrounding code. Include deep beginner background that can be skipped, then narrow background directly relevant to the change.
- Intuition: Explain the core intuition for the code change using concrete examples with toy data. Use figures and diagrams liberally.
- Code: Give a high-level walkthrough of the changes, grouped and ordered so their relationship is clear.
- Verification: Explain the important automated checks, safety properties, remaining manual validation, and known limits. Distinguish observed behavior from planned behavior.

## Output

- Produce one self-contained HTML file with inline CSS and JavaScript.
- Make it one long responsive page with a table of contents and section headers. Do not use top-level tabs.
- Write outside the repository at `/tmp/YYYY-MM-DD-explanation-<slug>.html`, using the current date and a descriptive slug.
- Use smooth, clear prose with a classic technical-explanation style.
- Use a small reusable family of HTML/CSS diagrams. Prefer a simplified UI view and a system/data-flow view with example data where relevant.
- Add lightweight interactions only when they improve comprehension, such as expandable implementation details, linked navigation, or a before/after comparison control. Do not add a quiz.
- Do not use ASCII diagrams. Use HTML structures for diagrams and HTML lists for lists.
- Use callouts for definitions, key concepts, and important edge cases.
- Use `<pre>` for code blocks. Before saving, inspect every code block and confirm its CSS gives `<pre>` `white-space: pre` or `white-space: pre-wrap`.

## Workflow

1. Inspect the relevant diff and broadly explore the affected code paths, tests, and contracts before writing.
2. Separate beginner background from change-specific background so readers can choose their depth.
3. Build the HTML around the requested narrative sections and reusable diagrams.
4. Add a verification section grounded in actual tests, acceptance evidence, and remaining risks.
5. Validate that the output is a single HTML file, CSS/JavaScript are inline, the table of contents links to sections, quiz controls work in a browser, and every `<pre>` has the required whitespace styling.
