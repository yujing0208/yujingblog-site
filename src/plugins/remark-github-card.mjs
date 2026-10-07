import { visit } from "unist-util-visit";

/**
 * Remark plugin to convert ::github{repo="..."} directives to raw HTML cards.
 *
 * This bypasses the remark-directive → parseDirectiveNode → rehype-components
 * pipeline because remarkSectionize was consuming the directive nodes before
 * they could be processed.
 */
export function remarkGithubCard() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined) return;

      // Check for directive in text nodes
      if (node.type === "text" || node.type === "html") {
        const value = node.value;
        const match = value.match(
          /^::github\{[^}]*repo\s*=\s*["\u201C\u201D]([^}"\u201C\u201D]+)["\u201C\u201D][^}]*\}$/,
        );
        if (match) {
          const repo = match[1].trim();
          if (repo.includes("/")) {
            const cardHtml = `<a class="card-github fetch-waiting no-styling" href="https://github.com/${repo}" target="_blank" rel="noopener noreferrer">
  <div class="gc-titlebar">
    <div class="gc-titlebar-left">
      <div class="gc-owner">
        <div class="gc-avatar"></div>
        <div class="gc-user">${repo.split("/")[0]}</div>
      </div>
      <div class="gc-divider">/</div>
      <div class="gc-repo">${repo.split("/")[1]}</div>
    </div>
    <div class="github-logo"></div>
  </div>
  <div class="gc-description">Loading...</div>
  <div class="gc-infobar">
    <div class="gc-stars">—</div>
    <div class="gc-forks">—</div>
    <div class="gc-license">—</div>
    <span class="gc-language">—</span>
  </div>
</a>`;
            parent.children[index] = { type: "html", value: cardHtml };
          }
        }
      }

      // Check for directive as sole content in a paragraph
      if (node.type === "paragraph" && node.children?.length === 1) {
        const child = node.children[0];
        if (child.type === "text") {
          const match = child.value.match(
            /^::github\{[^}]*repo\s*=\s*["\u201C\u201D]([^}"\u201C\u201D]+)["\u201C\u201D][^}]*\}$/,
          );
          if (match) {
            const repo = match[1].trim();
            if (repo.includes("/")) {
              const cardHtml = `<a class="card-github fetch-waiting no-styling" href="https://github.com/${repo}" target="_blank" rel="noopener noreferrer">
  <div class="gc-titlebar">
    <div class="gc-titlebar-left">
      <div class="gc-owner">
        <div class="gc-avatar"></div>
        <div class="gc-user">${repo.split("/")[0]}</div>
      </div>
      <div class="gc-divider">/</div>
      <div class="gc-repo">${repo.split("/")[1]}</div>
    </div>
    <div class="github-logo"></div>
  </div>
  <div class="gc-description">Loading...</div>
  <div class="gc-infobar">
    <div class="gc-stars">—</div>
    <div class="gc-forks">—</div>
    <div class="gc-license">—</div>
    <span class="gc-language">—</span>
  </div>
</a>`;
              parent.children[index] = { type: "html", value: cardHtml };
            }
          }
        }
      }
    });
  };
}
