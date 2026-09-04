// Waline 评论系统客户端脚本
// 文档: https://waline.js.org/
// 从 Twikoo 迁移，保留数据和表情包

(function() {
	'use strict';

	const CONFIG = {
		serverURL: 'https://waline.yujingblog.top', // Waline 服务端地址
		lang: 'zh-CN',
		locale: {
			placeholder: '欢迎留言交流～',
		},
		emoji: [
			'//unpkg.com/@waline/emojis@1.2.0/bilibili',
			'//unpkg.com/@waline/emojis@1.2.0/weibo',
		],
		meta: ['nick', 'mail', 'link'],
		requiredMeta: [],
		login: 'enable',
		wordLimit: [0, 2000],
		pageSize: 10,
		highlighter: false,
		imageUploader: false,
		texRenderer: false,
		search: false,
		reaction: false,
	};

	let observer = null;
	let walineLoaded = false;

	function getCurrentPath() {
		const pathname = window.location.pathname;
		return pathname.endsWith('/') && pathname.length > 1
			? pathname.slice(0, -1)
			: pathname;
	}

	function loadWalineScript() {
		if (walineLoaded || document.getElementById('waline-script')) {
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.id = 'waline-script';
			script.src = 'https://unpkg.com/@waline/client@v3/dist/waline.js';
			script.async = true;
			script.onload = () => {
				// 加载 Waline CSS
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = 'https://unpkg.com/@waline/client@v3/dist/waline.css';
				document.head.appendChild(link);
				walineLoaded = true;
				resolve();
			};
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function initWaline() {
		const commentEl = document.getElementById('waline');
		if (!commentEl) return;

		loadWalineScript().then(() => {
			if (typeof Waline === 'undefined') {
				console.warn('[Waline] 脚本加载失败');
				return;
			}
			commentEl.innerHTML = '';
			new Waline({
				el: '#waline',
				path: getCurrentPath(),
				...CONFIG,
			});
		}).catch(err => {
			console.error('[Waline] 初始化失败:', err);
		});
	}

	function cleanup() {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
		if (window.swup?.hooks) {
			window.swup.hooks.off('content:replace', initWaline);
		}
	}

	function setupLazyLoad() {
		const container = document.getElementById('waline-container');
		if (!container) return;

		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					observer.disconnect();
					observer = null;
					initWaline();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(container);
	}

	function setupSwupHooks() {
		if (window.swup?.hooks) {
			window.swup.hooks.on('content:replace', () => {
				setTimeout(setupLazyLoad, 200);
			});
		} else {
			document.addEventListener('swup:enable', () => {
				if (window.swup?.hooks) {
					window.swup.hooks.on('content:replace', () => {
						setTimeout(setupLazyLoad, 200);
					});
				}
			}, { once: true });
		}
	}

	document.addEventListener('mizuki:page:loaded', setupLazyLoad);
	window.addEventListener('beforeunload', cleanup);

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			setupLazyLoad();
			setupSwupHooks();
		});
	} else {
		setupLazyLoad();
		setupSwupHooks();
	}
})();