// 设备数据配置文件

export interface Device {
	name: string;
	image: string;
	specs: string;
	description: string;
	link: string;
}

// 设备类别类型，支持品牌和自定义类别
export type DeviceCategory = Record<string, Device[]> & {
	自定义?: Device[];
};

export const devicesData: DeviceCategory = {
	手机: [
		{
			name: "vivo Y300i",
			image: "https://wwwstatic.vivo.com.cn/vivoportal/files/image/detail/20250304/69059603d206f7aa05345607de9c4cf2.png",
			specs: "墨玉黑/ 12G + 256G",
			description: "轻薄6500mAh(呃...充话费送的)",
			link: "https://www.vivo.com.cn/vivo/y300i/",
		},
	],
	智能穿戴: [
		{
			name: "小米手环10NFC版",
			image: "https://cdn.cnbj0.fds.api.mi-img.com/b2c-shopapi-pms/pms_1750932901.51348731.png",
			specs: "带NFC&麦克风",
			description: "2.0mm超窄四等边，满屏高光|睡眠健康管理|全天心率监测",
			link: "https://www.mi.com/shop/buy/detail?product_id=21404",
		},
	],
	存储: [
		{
			name: "闪迪至尊超极速双接口闪存盘",
			image: "https://www.sandisk.com/content/dam/store/en-us/assets/products/usb-flash-drives/extreme-pro-dual-drive-usb/gallery/sandisk-extreme-pro-dual-drive-usb-front.png.wdthumb.1280.1280.webp",
			specs: "USB 3.2 Gen 2/256 GB",
			description: "闪迪至尊超极速™双接口硬盘具备高达 1,000MB/秒2读取速度和高达 900MB/秒2的写入速度，可增强数据管理能力。在您的 USB-C™ 和 USB-A 设备之间无缝传输数据，高达 2TB1 的容量还可存储大量内容。闪迪至尊超极速™双接口硬盘将坚固的构造与先进的数据保护和便利性加以结合，专为需要高性能和便携性来随时随地工作的专业人士打造。",
			link: "https://www.sandisk.com/zh-cn/products/usb-flash-drives/sandisk-extreme-pro-dual-drive-usb?sku=SDDDE1-256G-Z46",
		},
		{
			name: "WD10EZEX",
			image: "https://tse3-mm.cn.bing.net/th/id/OIP-C.161_kDw7CvET4J0uR5Uj0AHaHa?w=166&h=180&c=7&r=0&o=7&pid=1.7&rm=3",
			specs: "1TB",
			description: "WD10EZEX 是西部数据蓝盘系列的 1TB 台式机机械硬盘，以 7200 转、64MB 缓存和 CMR 技术为核心卖点，最大的标签是“稳定耐用”，适合作为仓储盘使用。",
			link: "https://www.westerndigital.com/zh-cn",
		},
	],
};