/**
 * FlatpaperTOC —— 照搬 hexo-theme-flatpaper 的目录卡逻辑
 *
 * 源码依据（原文已核对）：
 *   homulilly.com/js/main.js 「TOC scrollspy」段（1784-1931 行）
 *   homulilly.com/post/xxx.html 的目录 DOM
 *     <ol class="toc"><li class="toc-item toc-level-2">
 *       <a class="toc-link" href="#id"><span class="toc-text">…</span></a>
 *       <ol>…</ol>            ← 子级嵌套
 *     </li></ol>
 *
 * ⚠️ 类名加 fp- 前缀（fp-toc / fp-toc-item / fp-toc-link / fp-toc-text）：
 *   本站另有全局定义的 .toc / .toc-content / .toc-item（旧 CardTOC 样式表
 *   styles/toc.css 与 notebooks 页的目录样式），直接沿用原版类名会让
 *   .toc-item{display:flex} 命中目录条目，把「链接 + 子级 ol」排成一行。
 *   前缀化后与站内既有样式完全隔离，视觉与交互仍与原版逐条一致。
 *
 * 原版行为逐条对应：
 *   · 未展开时只显示 active 所在分支（li.is-open），其余子级 CSS 折叠
 *   · toggle-all 按钮切换 .toc-card.is-expanded + aria-pressed / aria-label
 *   · IntersectionObserver rootMargin '-90px 0px -65% 0px' 做 scrollspy
 *   · 滚动到页面底部时把 active 锁到最后一个标题
 *   · 滚动条带内无标题时按 offsetTop 兜底激活
 *   · active 链接滑出目录可视区时，目录自身平滑滚动把它带回来
 */

export interface FlatpaperTOCLabels {
	expand: string;
	collapse: string;
}

export interface FlatpaperTOCOptions {
	/** [data-card-toc-root] */
	root: HTMLElement;
	/** .toc-content */
	content: HTMLElement;
	/** .toc-card */
	card: HTMLElement;
	/** 展开/收起按钮文案（i18n 注入，避免脚本内再取一次语言包） */
	labels: FlatpaperTOCLabels;
	/** 目录最大层级（本博客 siteConfig.toc.depth） */
	maxLevel?: number;
}

const CONTENT_SELECTORS = [".markdown-content", ".custom-md", ".prose"];
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

export class FlatpaperTOC {
	private root: HTMLElement;
	private content: HTMLElement;
	private card: HTMLElement;
	private labels: FlatpaperTOCLabels;
	private maxLevel: number;

	private toggleAll: HTMLButtonElement | null = null;
	private links: HTMLAnchorElement[] = [];
	private byId = new Map<string, HTMLAnchorElement>();
	private headings: HTMLElement[] = [];
	private visible = new Set<HTMLElement>();
	private observer: IntersectionObserver | null = null;
	private activeId: string | null = null;
	private expanded = false;
	private nearBottom = false;
	private destroyed = false;
	private boundScroll: (() => void) | null = null;
	private boundToggle: (() => void) | null = null;

	constructor(options: FlatpaperTOCOptions) {
		this.root = options.root;
		this.content = options.content;
		this.card = options.card;
		this.labels = options.labels;
		this.maxLevel = options.maxLevel ?? 3;
	}

	/* ----------------------------------------------------------------- ---- */
	/* 初始化 / 销毁                                                          */
	/* ----------------------------------------------------------------- ---- */

	public init(): boolean {
		this.toggleAll = this.card.querySelector("[data-action='toggle-toc']");
		const built = this.build();
		if (!built) {
			return false;
		}
		this.bindToggle();
		this.bindScrollSpy();
		return true;
	}

	public destroy(): void {
		this.destroyed = true;
		this.observer?.disconnect();
		this.observer = null;
		if (this.boundScroll) {
			window.removeEventListener("scroll", this.boundScroll);
			this.boundScroll = null;
		}
		if (this.boundToggle && this.toggleAll) {
			this.toggleAll.removeEventListener("click", this.boundToggle);
			this.boundToggle = null;
		}
	}

	/* ----------------------------------------------------------------- ---- */
	/* 一、生成目录结构（嵌套 ol.toc）                                          */
	/* ----------------------------------------------------------------- ---- */

	private getContentContainer(): HTMLElement | null {
		for (const selector of CONTENT_SELECTORS) {
			const candidates = document.querySelectorAll<HTMLElement>(selector);
			for (const candidate of candidates) {
				if (candidate.querySelector(HEADING_SELECTOR)) {
					return candidate;
				}
			}
		}
		return null;
	}

	/** 取标题纯文本：剔除锚点 "#" 链接、脚本样式与尾部井号 */
	private getHeadingText(heading: HTMLElement): string {
		const clone = heading.cloneNode(true) as HTMLElement;
		clone.querySelectorAll(".anchor, .anchor-icon, script, style").forEach((el) => el.remove());
		return (clone.textContent ?? "").replace(/#+\s*$/, "").trim();
	}

	private levelOf(el: HTMLElement): number {
		return Number.parseInt(el.tagName.charAt(1), 10);
	}

	private build(): boolean {
		const container = this.getContentContainer();
		if (!container) {
			return false;
		}

		const all = Array.from(container.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).filter(
			(heading) => Boolean(heading.id),
		);
		if (all.length === 0) {
			return false;
		}

		const minDepth = all.reduce((min, h) => Math.min(min, this.levelOf(h)), 10);
		const items = all.filter((h) => this.levelOf(h) <= minDepth + this.maxLevel - 1);

		const rootList = document.createElement("ol");
		rootList.className = "fp-toc";

		// 用栈维护嵌套：stack[i].level 表示该层 ol 所属的标题层级
		const stack: Array<{ level: number; list: HTMLOListElement }> = [
			{ level: minDepth - 1, list: rootList },
		];
		const generated: HTMLAnchorElement[] = [];

		for (const heading of items) {
			const level = this.levelOf(heading);
			while (stack.length > 1 && level <= stack[stack.length - 1].level) {
				stack.pop();
			}

			const list = stack[stack.length - 1].list;
			const li = document.createElement("li");
			li.className = `fp-toc-item fp-toc-level-${level}`;

			const anchor = document.createElement("a");
			anchor.className = "fp-toc-link";
			anchor.href = `#${heading.id}`;
			anchor.setAttribute("data-heading-id", heading.id);

			const span = document.createElement("span");
			span.className = "fp-toc-text";
			const text = this.getHeadingText(heading);
			span.textContent = text || heading.id;

			anchor.appendChild(span);
			li.appendChild(anchor);

			const subList = document.createElement("ol");
			li.appendChild(subList);

			list.appendChild(li);
			stack.push({ level, list: subList });
			generated.push(anchor);
		}

		// 清掉没有子项的空 ol（原版 hexo 不会产出空列表）
		rootList.querySelectorAll("ol").forEach((ol) => {
			if (ol.children.length === 0) {
				ol.remove();
			}
		});

		this.links = generated;
		this.byId = new Map();
		generated.forEach((a) => {
			const id = a.getAttribute("data-heading-id");
			if (id) {
				this.byId.set(id, a);
			}
		});
		this.headings = items;

		this.content.replaceChildren(rootList);
		this.root.dataset.loaded = "true";
		return true;
	}

	/* ----------------------------------------------------------------- ---- */
	/* 二、展开 / 收起全部                                                     */
	/* ----------------------------------------------------------------- ---- */

	private setToggleLabel(): void {
		if (!this.toggleAll) {
			return;
		}
		const label = this.expanded ? this.labels.collapse : this.labels.expand;
		this.toggleAll.setAttribute("aria-label", label);
		this.toggleAll.setAttribute("title", label);
		this.toggleAll.setAttribute("aria-pressed", this.expanded ? "true" : "false");
	}

	private setExpanded(next: boolean): void {
		this.expanded = Boolean(next);
		this.card.classList.toggle("is-expanded", this.expanded);
		this.setToggleLabel();
	}

	private bindToggle(): void {
		this.setExpanded(false);
		if (!this.toggleAll) {
			return;
		}
		this.boundToggle = () => {
			this.setExpanded(!this.expanded);
			if (!this.expanded) {
				// 收起时只保留 active 所在分支
				const active = this.content.querySelector<HTMLAnchorElement>("a.is-active");
				if (active) {
					this.revealActiveBranch(active);
				}
			}
		};
		this.toggleAll.addEventListener("click", this.boundToggle);
	}

	/** 未展开状态下，展开 active 链路上的所有祖先 li（其余收起） */
	private revealActiveBranch(target: Element | null): void {
		if (this.expanded) {
			return;
		}
		this.content.querySelectorAll("li.is-open").forEach((li) => {
			li.classList.remove("is-open");
		});
		let li = target instanceof Element ? target.closest("li") : null;
		while (li && this.content.contains(li)) {
			li.classList.add("is-open");
			const parent = li.parentElement;
			li = parent ? parent.closest("li") : null;
		}
	}

	/* ----------------------------------------------------------------- ---- */
	/* 三、scrollspy                                                          */
	/* ----------------------------------------------------------------- ---- */

	private activate(id: string): void {
		if (id === this.activeId || this.destroyed) {
			return;
		}
		this.activeId = id;
		this.links.forEach((a) => a.classList.remove("is-active"));

		const target = this.byId.get(id);
		if (!target) {
			return;
		}
		target.classList.add("is-active");
		this.revealActiveBranch(target);

		// 让 active 项始终留在目录可视区内
		const contentRect = this.content.getBoundingClientRect();
		const linkRect = target.getBoundingClientRect();
		const linkTop = linkRect.top - contentRect.top + this.content.scrollTop;
		const linkBottom = linkTop + linkRect.height;
		const viewTop = this.content.scrollTop;
		const viewBottom = viewTop + this.content.clientHeight;

		if (linkTop < viewTop) {
			this.content.scrollTo({ top: Math.max(0, linkTop - 20), behavior: "smooth" });
		} else if (linkBottom > viewBottom) {
			this.content.scrollTo({
				top: linkBottom - this.content.clientHeight + 20,
				behavior: "smooth",
			});
		}
	}

	private pickActive(): void {
		if (this.visible.size === 0) {
			return;
		}
		let top: HTMLElement | null = null;
		this.visible.forEach((h) => {
			if (!top || h.getBoundingClientRect().top < top.getBoundingClientRect().top) {
				top = h;
			}
		});
		if (top) {
			this.activate((top as HTMLElement).id);
		}
	}

	private atPageEnd(): boolean {
		return (
			window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80
		);
	}

	private bindScrollSpy(): void {
		if (this.links.length === 0 || this.headings.length === 0) {
			return;
		}

		const last = this.headings[this.headings.length - 1];

		// 初次进入：优先跟随 URL hash，否则激活第一个标题
		const initialId = (() => {
			if (!location.hash) {
				return this.headings[0].id;
			}
			try {
				return decodeURIComponent(location.hash.slice(1));
			} catch {
				return location.hash.slice(1);
			}
		})();
		if (this.byId.has(initialId)) {
			this.activate(initialId);
		} else {
			this.activate(this.headings[0].id);
		}

		if (!("IntersectionObserver" in window)) {
			return;
		}

		this.observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						this.visible.add(entry.target as HTMLElement);
					} else {
						this.visible.delete(entry.target as HTMLElement);
					}
				});

				if (this.nearBottom) {
					this.activate(last.id);
					return;
				}
				this.pickActive();
			},
			{ rootMargin: "-90px 0px -65% 0px", threshold: 0 },
		);

		this.headings.forEach((h) => this.observer?.observe(h));

		this.boundScroll = () => {
			this.nearBottom = this.atPageEnd();
			if (this.nearBottom) {
				this.activate(last.id);
				return;
			}
			if (this.visible.size > 0) {
				return;
			}
			// 超长章节兜底：滚动带内没有任何标题时按位置激活
			const pos = window.scrollY + 100;
			let current: HTMLElement | null = null;
			this.headings.forEach((h) => {
				if (h.getBoundingClientRect().top + window.scrollY <= pos) {
					current = h;
				}
			});
			if (current) {
				this.activate((current as HTMLElement).id);
			}
		};
		window.addEventListener("scroll", this.boundScroll, { passive: true });
	}
}
