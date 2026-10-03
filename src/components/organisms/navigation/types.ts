import type { NavBarLink } from "../../../types/config";

export interface NavMenuPanelProps {
	links: NavBarLink[];
}

export interface DropdownMenuProps {
	link: NavBarLink;
	class?: string;
}

export interface ProcessedNavBarLink extends Omit<NavBarLink, "children"> {
	children?: ProcessedNavBarLink[];
}
