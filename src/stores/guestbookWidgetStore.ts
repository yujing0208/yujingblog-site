/**
 * 留言板悬浮组件状态（FAB 按钮与抽屉面板共享）
 */

export interface GuestbookWidgetState {
	isOpen: boolean;
}

class GuestbookWidgetStore {
	private state: GuestbookWidgetState = { isOpen: false };
	private listeners = new Set<(state: GuestbookWidgetState) => void>();

	getState(): GuestbookWidgetState {
		return this.state;
	}

	subscribe(listener: (state: GuestbookWidgetState) => void): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private emit() {
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}

	open() {
		if (this.state.isOpen) return;
		this.state = { ...this.state, isOpen: true };
		this.emit();
	}

	close() {
		if (!this.state.isOpen) return;
		this.state = { ...this.state, isOpen: false };
		this.emit();
	}

	toggle() {
		this.state = { ...this.state, isOpen: !this.state.isOpen };
		this.emit();
	}
}

export const guestbookWidgetStore = new GuestbookWidgetStore();
