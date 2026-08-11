// 足迹数据 —— 在内容仓库维护，Obsidian 可直接编辑。
// 字段说明（每项一条足迹）：
//   name        地点名称（必填）
//   coordinates 经纬度 [lng, lat]（必填，缺省会被忽略）；也支持 lat/lng 分开写法
//   categories  分类数组：用于地图左上角「分类筛选」；含「计划」的不会被省份高亮点亮
//   date        到访日期（可选）
//   description 简介（可选，弹窗内显示）
//   photos      照片 URL 数组（可选，弹窗内轮播；建议用图床外链）
//   markerColor 标记颜色预设：sunset/ocean/violet/forest/amber/citrus，或任意 CSS 颜色
//   url / urlLabel 弹窗内链接（可选）
// 经纬度可在高德坐标拾取器获取：https://lbs.amap.com/tools/picker
// 当前暂无足迹，待自行添加。
export const footprintsData = [];
