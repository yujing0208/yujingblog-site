import * as fs from "node:fs";
import * as path from "node:path";

import type { AlbumGroup, Photo } from "../types/album";

/**
 * 对损坏的 JSON 做“安全”修复，使其在二次解析时尽可能通过。
 * 设计原则：**绝不误伤合法 JSON**。只处理一类已知脏数据——数组/对象中
 * “逗号后开启的字符串未闭合即遇到 ] 或 }”（如 `"tags": ["学校", "回忆]`）。
 * 合法 JSON 的元素字符串自带闭合引号（"value" 与 ] 间有引号），不会被命中；
 * 其余情况（缺逗号、控制字符、单引号等）不做猜测式修复，以免把合法文件改坏。
 * 仅在严格 JSON.parse 失败时兜底使用；修复后仍失败才抛出，由调用方跳过该相册。
 * 目的：单张相册的脏数据绝不让整站构建中断。
 */
function repairLooseJson(raw: string): string {
	let s = raw;
	// 去掉字符串字面量之外的注释（低风险）
	s = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
	// 去除 BOM
	s = s.replace(/^\uFEFF/, "");
	// 安全修复：仅当“逗号后开启的字符串未闭合即遇到 ] 或 }”时补引号
	s = s.replace(/,\s*"([^"\n]*?)(\]|\})/g, ', "$1"$2');
	return s;
}

export async function scanAlbums(): Promise<AlbumGroup[]> {
	const albumsDir = path.join(process.cwd(), "public/images/albums");
	const albums: AlbumGroup[] = [];

	// 检查目录是否存在
	if (!fs.existsSync(albumsDir)) {
		console.warn("相册目录不存在:", albumsDir);
		return [];
	}

	// 获取所有子文件夹
	const albumFolders = fs
		.readdirSync(albumsDir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	// 处理每个相册文件夹
	for (const folder of albumFolders) {
		const albumPath = path.join(albumsDir, folder);
		const album = await processAlbumFolder(albumPath, folder);
		if (album) {
			albums.push(album);
		}
	}

	// 兜底：确保返回数组绝不含 null/undefined，彻底杜绝坏相册泄漏到路由导致构建失败
	return albums.filter(Boolean);
}

async function processAlbumFolder(
	folderPath: string,
	folderName: string,
): Promise<AlbumGroup | null> {
	// 相册 info.json 的结构（宽松字段，均可选）
	interface AlbumInfo {
		mode?: string;
		cover?: string;
		photos?: Record<string, unknown>[];
		hidden?: boolean;
		title?: string;
		description?: string;
		date?: string;
		location?: string;
		tags?: string[];
		password?: string;
		passwordHint?: string;
	}

	// 检查必要文件
	const infoPath = path.join(folderPath, "info.json");

	if (!fs.existsSync(infoPath)) {
		console.warn(`相册 ${folderName} 缺少 info.json 文件`);
		return null;
	}

	// 读取相册信息。整个解析与构建过程用 try/catch 兜底，
	// 任何一个相册的脏数据/异常都只导致该相册被跳过，绝不让整站构建中断。
	let info: AlbumInfo;
	try {
		const infoContent = fs.readFileSync(infoPath, "utf-8");
		try {
			info = JSON.parse(infoContent);
		} catch {
			// 严格解析失败 -> 宽松修复后再试一次（尽力自愈）
			info = JSON.parse(repairLooseJson(infoContent));
		}

		// 检查是否为外链模式
		const isExternalMode = info.mode === "external";
		let photos: Photo[] = [];
		let cover: string;

		if (isExternalMode) {
			// 外链模式：从 info.json 中获取封面和照片
			if (!info.cover) {
				console.warn(`相册 ${folderName} 外链模式缺少 cover 字段`);
				return null;
			}

			cover = info.cover as string;
			photos = processExternalPhotos(
				(info.photos ?? []) as Parameters<typeof processExternalPhotos>[0],
				folderName,
			);
		} else {
			// 本地模式：检查本地文件
			let coverPath = path.join(folderPath, "cover.webp");
			const hasWebpCover = fs.existsSync(coverPath);
			if (!hasWebpCover) {
				coverPath = path.join(folderPath, "cover.jpg");
				if (!fs.existsSync(coverPath)) {
					console.warn(`相册 ${folderName} 缺少 cover 文件`);
					return null;
				}
			}

			cover = hasWebpCover
				? `/images/albums/${folderName}/cover.webp`
				: `/images/albums/${folderName}/cover.jpg`;
			photos = scanPhotos(folderPath, folderName);
		}

		// 检查是否隐藏相册
		if (info.hidden === true) {
			console.log(`相册 ${folderName} 已设置为隐藏，跳过显示`);
			return null;
		}

		// 构建相册对象（title/cover 缺失时给安全兜底，避免 null 泄漏到 AlbumGroup）
		return {
			id: folderName,
			title: info.title || folderName,
			description: info.description || "",
			cover,
			date: info.date || new Date().toISOString().split("T")[0],
			location: info.location || "",
			tags: info.tags || [],
			photos,
			password: info.password || undefined,
			passwordHint: info.passwordHint || undefined,
		};
	} catch (error) {
		console.error(
			`[album-scanner] ⚠️ 相册 ${folderName} 处理失败，已跳过（不影响其他相册与整站构建）：`,
			error instanceof Error ? error.message : error,
		);
		return null;
	}
}

function scanPhotos(folderPath: string, albumId: string): Photo[] {
	const photos: Photo[] = [];
	const files = fs.readdirSync(folderPath);

	const imageExtensions = [
		".jpg",
		".jpeg",
		".png",
		".gif",
		".webp",
		".svg",
		".avif",
		".bmp",
		".tiff",
		".tif",
	];

	const imageFiles = files.filter((file) => {
		const ext = path.extname(file).toLowerCase();
		return (
			imageExtensions.includes(ext) &&
			file !== "cover.jpg" &&
			file !== "cover.webp"
		);
	});

	const fileWebpMap = new Map<string, string>();
	for (const file of imageFiles) {
		const baseName = path.basename(file, path.extname(file));
		const ext = path.extname(file).toLowerCase();
		if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
			if (imageFiles.includes(`${baseName}.webp`)) {
				fileWebpMap.set(file, `${baseName}.webp`);
			}
		}
	}

	imageFiles.forEach((file, index) => {
		const filePath = path.join(folderPath, file);
		const stats = fs.statSync(filePath);

		const { baseName, tags } = parseFileName(file);

		const src = fileWebpMap.has(file)
			? `/images/albums/${albumId}/${fileWebpMap.get(file)}`
			: `/images/albums/${albumId}/${file}`;

		photos.push({
			id: `${albumId}-photo-${index}`,
			src,
			alt: baseName,
			title: baseName,
			tags: tags,
			date: stats.mtime.toISOString().split("T")[0],
		});
	});

	return photos;
}

function processExternalPhotos(
	externalPhotos: {
		src: string;
		id?: string;
		thumbnail?: string;
		alt?: string;
		title?: string;
		description?: string;
		tags?: string[];
		date?: string;
		location?: string;
		width?: number;
		height?: number;
	}[],
	albumId: string,
): Photo[] {
	const photos: Photo[] = [];

	externalPhotos.forEach((photo, index) => {
		if (!photo.src) {
			console.warn(`相册 ${albumId} 的第 ${index + 1} 张照片缺少 src 字段`);
			return;
		}

		photos.push({
			id: photo.id || `${albumId}-external-photo-${index}`,
			src: photo.src,
			thumbnail: photo.thumbnail,
			alt: photo.alt || photo.title || `Photo ${index + 1}`,
			title: photo.title,
			description: photo.description,
			tags: photo.tags || [],
			date: photo.date || new Date().toISOString().split("T")[0],
			location: photo.location,
			width: photo.width,
			height: photo.height,
			// camera: photo.camera,
			// lens: photo.lens,
			// settings: photo.settings,
		});
	});

	return photos;
}

function parseFileName(fileName: string): { baseName: string; tags: string[] } {
	// 匹配文件名中的标签，格式为：文件名_标签1_标签2.扩展名
	const parts = path.basename(fileName, path.extname(fileName)).split("_");

	if (parts.length >= 3) {
		// 前 N-2 部分作为基本名称，最后 2 部分作为标签
		const baseName = parts.slice(0, -2).join("_");
		const tags = parts.slice(-2);
		return { baseName, tags };
	}

	if (parts.length === 2) {
		// 第一部分作为基本名称，第二部分作为标签
		return { baseName: parts[0], tags: [parts[1]] };
	}

	// 如果没有标签，返回不带扩展名的文件名
	const baseName = path.basename(fileName, path.extname(fileName));
	return { baseName, tags: [] };
}
