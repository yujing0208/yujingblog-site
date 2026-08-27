import type { LicenseConfig } from "../types/config";

// 文章许可协议配置
export const licenseConfig: LicenseConfig = {
	enable: true,
	// 文章未单独填写许可协议时的全局默认值
	name: "Unlicensed",
	url: "",
};
