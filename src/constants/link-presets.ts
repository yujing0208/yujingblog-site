import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

import { LinkPreset, type NavBarLink } from "@/types/config";

export const LinkPresets: Record<LinkPreset, NavBarLink> = {
	[LinkPreset.Home]: {
		name: i18n(I18nKey.home),
		url: "/",
		icon: "lucide:house",
	},
	[LinkPreset.About]: {
		name: i18n(I18nKey.about),
		url: "/about/",
		icon: "lucide:user",
	},
	[LinkPreset.Archive]: {
		name: i18n(I18nKey.archive),
		url: "/archive/",
		icon: "lucide:archive",
	},
	[LinkPreset.Friends]: {
		name: i18n(I18nKey.friends),
		url: "/friends/",
		icon: "lucide:users",
	},
	[LinkPreset.Anime]: {
		name: i18n(I18nKey.anime),
		url: "/anime/",
		icon: "lucide:clapperboard",
	},
	[LinkPreset.Diary]: {
		name: i18n(I18nKey.diary),
		url: "/diary/",
		icon: "lucide:book",
	},
	[LinkPreset.Albums]: {
		name: i18n(I18nKey.albums),
		url: "/albums/",
		icon: "lucide:images",
	},
	[LinkPreset.Projects]: {
		name: i18n(I18nKey.projects),
		url: "/projects/",
		icon: "lucide:briefcase",
	},
	[LinkPreset.Skills]: {
		name: i18n(I18nKey.skills),
		url: "/skills/",
		icon: "lucide:brain",
	},
	[LinkPreset.Timeline]: {
		name: i18n(I18nKey.timeline),
		url: "/timeline/",
		icon: "lucide:chart-line",
	},
	[LinkPreset.AITools]: {
		name: i18n(I18nKey.aiTools),
		url: "/ai-tools/",
		icon: "lucide:bot",
	},
};
