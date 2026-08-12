# 项目结构与迁移路线

## 当前网页版

```text
根目录 index.html        GitHub Pages 入口，跳转到 app/index.html
app/index.html            小程序风格界面与样式
app/utils.js              纯工具函数（esc/投影/距离/hotelCount），浏览器与 Node 共用
app/app.js                页面状态、地图、筛选、收藏、定位
app/map/gd-map.svg        离线插画地图底图
 data/regions-gd.json     区域优先数据，ODbL
scripts/validate.js       数据校验
scripts/unit-test.js      纯函数单元测试
sw.js                     PWA 缓存
manifest.webmanifest      PWA 安装信息
```

页面按小程序的四个 tab 组织：地图、列表、收藏、攻略；区域详情使用底部 Sheet，后续迁移微信小程序时对应为 `pages/detail`。

## 数据层级

```text
温泉区域/温泉小镇
└── 酒店/度假村/民宿（区域内经营点）
```

地图只显示区域点，不把同一小镇的每家酒店堆成几十个点。酒店数量多的区域（例如高沙村、热汤村）使用 `hotelCount` 概括，具体经营点通过社区逐步补充。

## 迁移微信小程序

数据文件可以直接迁移为小程序 `data/regions-gd.json`。页面拆分建议：

- `pages/map`：微信 `<map>` 组件 + 区域 marker
- `pages/list`：搜索、城市筛选、排序
- `pages/detail`：区域档案与酒店列表
- `pages/favorites`：收藏与去过
- `pages/guide`：泡汤攻略
- `utils/geo.js`：当前位置距离计算

网页版本先验证信息架构和数据质量，再迁移到 WXML/WXSS，避免先做小程序壳、后发现收录单位不对。
