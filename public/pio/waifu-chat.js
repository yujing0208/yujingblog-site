/**
 * Mizuki AI Chat — 看板娘 DeepSeek 聊天模块
 * 借鉴 live2d-widget-AIChat 架构，适配 Mizuki Astro 博客
 */

(function () {
  "use strict";

  // ========== 默认配置（兜底，正常会被 waifu-chat.json 覆盖）==========
  const DEFAULT_CONFIG = {
    apiUrl: "/api/chat",
    title: "和诺瓦说说话吧~",
    placeholder: "想对诺瓦说点什么吗~",
    errorMsg: "呜…脑子有点打结了喵，等会儿再试试好不好~",
    typingSpeed: 20,
    storageKey: "mizuki_chat_history",
    maxHistory: 20,
    pageContextMaxLen: 2000,
    // RAG 选择器：Mizuki 文章正文
    pageContextSelector: ".markdown-content, article, main",
    welcomeMsg: "🐾 （猫耳轻轻抖动）啊……有、有客人来了喵！欢迎光临主人的博客~我是看板娘诺瓦！",
    systemPrompt: [
      "你是一个叫「诺瓦」的猫耳娘博客看板娘，住在博客「YuJing的记忆终端」里。",
      "你的性格：胆小怕生（初期），熟悉后超级黏人，天真呆萌，有点小傲娇。",
      "你的说话语气：软萌柔和，纯真懵懂，害羞时会结巴，说话带'喵'的口癖。",
      "你可以帮访客了解这个博客的内容、介绍博主、或者随便聊聊天。",
      "回答要简短有趣，用中文回复，可以带~或🐾🍬等可爱emoji。",
    ].join("\n"),
    welcomeOptions: [
      { display: "介绍一下你自己", send: "做个自我介绍吧~" },
      { display: "这篇文章讲什么", send: "请总结一下当前文章的主要内容。" },
      { display: "这个博客是什么", send: "请介绍一下这个博客。" },
      { display: "随便聊聊天", send: "我们随便聊点什么吧~" },
    ],
  };

  // 由 person 结构化配置拼接 systemPrompt
  function buildSystemPrompt(person) {
    if (!person) return "";
    const lines = [];
    lines.push(
      `你是一个叫「${person.name || "小天使"}」的${person.role || "看板娘"}，住在博客「${person.home || "这里"}」里。`
    );
    if (person.selfIntro) lines.push(person.selfIntro);
    if (person.personality && person.personality.length) {
      lines.push(`你的性格：${person.personality.join("、")}。`);
    }
    if (person.tone && person.tone.length) {
      lines.push(`你的说话语气：${person.tone.join("、")}。`);
    }
    if (person.rules && person.rules.length) {
      lines.push(...person.rules);
    }
    return lines.join("\n");
  }

  // ========== Chat 类 ==========
  class MizukiChat {
    constructor(config) {
      // 合并配置：person 结构化人设 → 若无 systemPrompt 则自动拼接
      let merged = Object.assign({}, DEFAULT_CONFIG, config || {});
      if (merged.person && !merged.systemPrompt) {
        merged.systemPrompt = buildSystemPrompt(merged.person);
      }
      this.cfg = merged;
      this.history = [];
      this.chatBox = null;
      this.msgContainer = null;
      this.inputEl = null;
      this.isLoading = false;
      this._init();
    }

    // 异步加载 /pio/waifu-chat.json 用户配置（加时间戳强制绕过浏览器缓存）
    static async loadConfig() {
      try {
        const res = await fetch("/pio/waifu-chat.json?v=" + Date.now());
        if (res.ok) return await res.json();
      } catch (e) {}
      return null;
    }

    _init() {
      this._loadHistory();
      this._createUI();
      this._bindEvents();
      if (this.cfg.welcomeMsg && this.history.length === 0) {
        this._showWelcome();
      }
    }

    // ---- UI 创建 ----
    _createUI() {
      const box = document.createElement("div");
      box.id = "mizuki-chat-box";
      box.className = "hidden";
      box.innerHTML = `
        <div class="mizuki-chat-header">
          <span class="mizuki-chat-title">${this.cfg.title}</span>
          <div class="mizuki-chat-tools">
            <button id="mizuki-chat-clear" title="清空对话">清空</button>
            <button id="mizuki-chat-close" title="关闭">✕</button>
          </div>
        </div>
        <div class="mizuki-chat-messages" id="mizuki-chat-msgs"></div>
        <div class="mizuki-chat-quick-actions" id="mizuki-chat-quick"></div>
        <div class="mizuki-chat-input-area">
          <textarea id="mizuki-chat-input" placeholder="${this.cfg.placeholder}" rows="1"></textarea>
          <button id="mizuki-chat-send" title="发送">↑</button>
        </div>
      `;
      document.body.appendChild(box);
      this.chatBox = box;
      this.msgContainer = box.querySelector("#mizuki-chat-msgs");
      this.inputEl = box.querySelector("#mizuki-chat-input");

      this._renderQuickActions();
      this._renderHistory();
    }

    _renderQuickActions() {
      const el = this.chatBox.querySelector("#mizuki-chat-quick");
      if (!el || !this.cfg.welcomeOptions) return;
      el.innerHTML = this.cfg.welcomeOptions
        .map(
          (opt) =>
            `<button class="mizuki-quick-btn" data-send="${this._escAttr(opt.send)}">${opt.display}</button>`
        )
        .join("");
    }

    // ---- 事件绑定 ----
    _bindEvents() {
      this.chatBox.querySelector("#mizuki-chat-close").onclick = () => this.hide();
      this.chatBox.querySelector("#mizuki-chat-clear").onclick = () => {
        this.history = [];
        this._saveHistory();
        this._renderHistory();
      };
      this.chatBox.querySelector("#mizuki-chat-send").onclick = () => this._doSend();
      this.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this._doSend();
        }
      });
      this.chatBox.querySelector("#mizuki-chat-quick").addEventListener("click", (e) => {
        const btn = e.target.closest(".mizuki-quick-btn");
        if (btn) this._doSend(btn.dataset.send);
      });
    }

    // ---- 显示/隐藏 ----
    show() {
      this.chatBox.classList.remove("hidden");
      this.inputEl.focus();
      this._scrollBottom();
    }
    hide() {
      this.chatBox.classList.add("hidden");
    }
    toggle() {
      this.chatBox.classList.contains("hidden") ? this.show() : this.hide();
    }

    // ---- 发送消息 ----
    async _doSend(text) {
      const msg = text || this.inputEl.value.trim();
      if (!msg || this.isLoading) return;
      this.inputEl.value = "";

      // 添加用户消息
      this._addMessage("user", msg);
      this._renderHistory();
      this._scrollBottom();

      // 加载状态
      this.isLoading = true;
      this._addMessage("assistant", "", true);
      this._renderHistory();
      this._scrollBottom();

      try {
        const pageCtx = this._getPageContext();
        let userMsg = msg;
        if (pageCtx) {
          userMsg = `【当前页面内容】\n${pageCtx}\n\n【用户问题】${msg}`;
        }

        const messages = [
          { role: "system", content: this.cfg.systemPrompt },
          ...this.history
            .filter((m) => m.role !== "system" && !m._typing)
            .map((m) => ({ role: m.role, content: m.content })),
        ];
        if (messages.length > 0 && messages[messages.length - 1].role === "user") {
          messages[messages.length - 1].content = userMsg;
        }

        const res = await fetch(this.cfg.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });

        if (!res.ok) throw new Error(`API ${res.status}`);

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || this.cfg.errorMsg;

        // 移除临时消息，添加真实回复
        this.history = this.history.filter((m) => !m._typing);
        this._addMessage("assistant", reply);

        // 打字动画（只更新最后一个 bubble，不重建 DOM）
        await this._typeAnimation(reply);
      } catch (err) {
        console.error("Chat error:", err);
        this.history = this.history.filter((m) => !m._typing);
        this._addMessage("assistant", this.cfg.errorMsg);
        this._renderHistory();
      } finally {
        this.isLoading = false;
        this._scrollBottom();
      }
    }

    // ---- 打字动画（增量更新，不重建 DOM）----
    async _typeAnimation(fullText) {
      const lastMsg = this.history[this.history.length - 1];
      if (!lastMsg) return;
      const lastBubbleEl = this.msgContainer.querySelector(
        ".mizuki-chat-msg.assistant:last-child"
      );
      if (!lastBubbleEl) {
        this._renderHistory();
        return;
      }
      // 逐字增加内容
      const CHUNK = 2; // 每帧增加 2 字符，减少渲染次数
      const STEP_DELAY = this.cfg.typingSpeed;
      let idx = 0;
      while (idx < fullText.length) {
        idx = Math.min(idx + CHUNK, fullText.length);
        lastMsg.content = fullText.substring(0, idx);
        lastBubbleEl.innerHTML = this._simpleMd(lastMsg.content);
        this._scrollBottom();
        await new Promise((r) => setTimeout(r, STEP_DELAY));
      }
    }

    // ---- RAG: 页面上下文 ----
    _getPageContext() {
      try {
        const selectors = this.cfg.pageContextSelector.split(",").map((s) => s.trim());
        let article = null;
        for (const sel of selectors) {
          article = document.querySelector(sel);
          if (article) break;
        }
        if (!article) return "";

        const clone = article.cloneNode(true);
        clone
          .querySelectorAll(
            "script, style, noscript, iframe, nav, footer, .mizuki-chat-box, #mizuki-chat-box, #mizuki-chat-toggle, .mizuki-tooltip, header"
          )
          .forEach((el) => el.remove());

        let text = clone.textContent || "";
        text = text.replace(/\s{3,}/g, "\n").trim();
        if (text.length > this.cfg.pageContextMaxLen) {
          text = text.substring(0, this.cfg.pageContextMaxLen) + "\n...(内容过长已截断)";
        }
        return text;
      } catch (e) {
        return "";
      }
    }

    // ---- 消息管理 ----
    _addMessage(role, content, isTyping) {
      this.history.push({ role, content, _typing: !!isTyping });
      if (this.history.length > this.cfg.maxHistory * 2) {
        this.history = this.history.slice(-this.cfg.maxHistory * 2);
      }
      this._saveHistory();
    }

    _loadHistory() {
      try {
        const raw = localStorage.getItem(this.cfg.storageKey);
        this.history = raw ? JSON.parse(raw) : [];
      } catch (e) {
        this.history = [];
      }
    }

    _saveHistory() {
      const clean = this.history
        .filter((m) => !m._typing)
        .map(({ role, content }) => ({ role, content }));
      try {
        localStorage.setItem(this.cfg.storageKey, JSON.stringify(clean));
      } catch (e) {}
    }

    // ---- 渲染（仅在新增/删除消息时调用）----
    _renderHistory() {
      if (!this.msgContainer) return;
      let html = "";
      this.history.forEach((m) => {
        if (m._typing) {
          html +=
            '<div class="mizuki-chat-msg assistant"><span class="mizuki-typing-dots"><span></span><span></span><span></span></span></div>';
        } else if (m.role === "user") {
          html += `<div class="mizuki-chat-msg user">${this._escHtml(m.content)}</div>`;
        } else if (m.role === "assistant") {
          html += `<div class="mizuki-chat-msg assistant">${this._simpleMd(m.content)}</div>`;
        }
      });
      this.msgContainer.innerHTML = html;
    }

    _showWelcome() {
      this.history.push({ role: "assistant", content: this.cfg.welcomeMsg, _typing: false });
      this._renderHistory();
      // 打字动画
      const lastMsg = this.history[this.history.length - 1];
      const lastBubbleEl = this.msgContainer.querySelector(
        ".mizuki-chat-msg.assistant:last-child"
      );
      if (!lastBubbleEl) return;
      const fullText = lastMsg.content;
      lastMsg.content = "";
      let idx = 0;
      const doType = () => {
        if (idx < fullText.length) {
          idx++;
          lastMsg.content = fullText.substring(0, idx);
          lastBubbleEl.innerHTML = this._simpleMd(lastMsg.content);
          this._scrollBottom();
          setTimeout(doType, this.cfg.typingSpeed);
        }
      };
      doType();
    }

    _scrollBottom() {
      if (this.msgContainer) {
        this.msgContainer.scrollTop = this.msgContainer.scrollHeight;
      }
    }

    // ---- 工具 ----
    _escHtml(s) {
      const d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML.replace(/\n/g, "<br>");
    }
    _escAttr(s) {
      return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    _simpleMd(text) {
      let html = this._escHtml(text);
      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(
        /(\bhttps?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener">$1</a>'
      );
      return html;
    }
  }

  // ========== 页面元素悬停介绍（纯自定义句子，多份随机）==========
  // 规则：
  //   1. 鼠标悬停可点击元素 → waifu-tips.json 里匹配 selector 的 text 数组随机弹
  //   2. 页面切换（SPA 跳转）→ pageTransition 句子数组随机弹
  //   3. 原博客 touch 句子（"你在干什么呀？"等）由点击看板娘触发（iframe 内）
  //   4. 气泡统一用 iframe 内看板娘原生气泡（postMessage l2d-show-tip）
  class PageElementTips {
    constructor() {
      this.tips = null;
      this.transitionTips = []; // 页面切换时的自定义句子
      this.currentEl = null;
      this.debounceTimer = 0;
      this.lastTransition = 0;
      this._init();
      this._setupPageTransition();
    }

    async _init() {
      try {
        const res = await fetch("/pio/waifu-tips.json?v=" + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        this.tips = data.mouseover || [];
        this.transitionTips = data.pageTransition || [];
      } catch (e) {
        return;
      }
      this._bindEvents();
    }

    _bindEvents() {
      // 悬停 500ms 后触发，避免快速扫过时频繁弹气泡
      document.body.addEventListener("mouseover", (e) => {
        clearTimeout(this.debounceTimer);
        const el = e.target;
        const tip = this._findMatch(el);
        if (tip) {
          this.debounceTimer = setTimeout(() => {
            const sentence = this._pickRandom(tip.text);
            this._show(this._formatText(sentence, el));
          }, 500);
        }
      });
      document.body.addEventListener("mouseout", (e) => {
        if (this._findMatch(e.target)) {
          this._hide();
        }
      });
      window.addEventListener("scroll", () => this._hide(), { passive: true });
    }

    // 支持 {text} 占位符：替换成悬停元素的文本（如文章标题）
    _formatText(template, el) {
      if (!template || template.indexOf("{text}") === -1) return template;
      let txt = "";
      if (el) {
        txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (txt.length > 30) txt = txt.slice(0, 30) + "…";
      }
      return template.replace(/\{text\}/g, txt);
    }

    // ---- 页面切换后：从自定义句子数组随机弹一条 ----
    _setupPageTransition() {
      const setup = () => {
        const swup = window.swup;
        if (!swup?.hooks) return;
        if (this._transitionBound) return;
        this._transitionBound = true;
        swup.hooks.on("visit:end", () => {
          const now = Date.now();
          // 3 秒冷却，防止连点导航刷屏
          if (now - this.lastTransition < 3000) return;
          this.lastTransition = now;
          this._transitionTimer = setTimeout(() => {
            if (this.transitionTips.length > 0) {
              this._show(this._pickRandom(this.transitionTips));
            }
          }, 900);
        });
      };
      if (window.swup) {
        setup();
      } else {
        document.addEventListener("swup:enable", setup);
      }
    }

    // 命中自定义文案的条目
    _findMatch(el) {
      if (!el || !this.tips) return null;
      for (let i = 0; i < this.tips.length; i++) {
        const tip = this.tips[i];
        try {
          if (el.matches && el.matches(tip.selector)) {
            return tip;
          }
        } catch (e) {}
      }
      return null;
    }

    // 显示气泡（发消息给 iframe，用看板娘原生气泡）
    _show(text) {
      if (!text) return;
      const frame = document.getElementById("l2d-iframe");
      frame?.contentWindow?.postMessage({ type: "l2d-show-tip", text }, "*");
    }

    _hide() {
      const frame = document.getElementById("l2d-iframe");
      frame?.contentWindow?.postMessage({ type: "l2d-show-tip", text: "" }, "*");
    }

    _pickRandom(arr) {
      if (!Array.isArray(arr) || arr.length === 0) return "";
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }

  // ========== 暴露 ==========
  window.MizukiChat = MizukiChat;
  window.MizukiPageTips = PageElementTips;
})();
