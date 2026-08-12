# 湾区温泉大全

一个以「温泉区域」为第一层数据的开源地图项目：先回答“去哪个温泉小镇/温泉区”，再查看区域内有哪些温泉酒店和民宿。

> 当前是小程序风格网页版原型，后续可迁移为微信小程序。项目只收录粤港澳大湾区内的广州、深圳、珠海、佛山、惠州、东莞、中山、江门、肇庆 9 市；港澳暂不展示。

## 当前状态

- 34 个温泉区域/温泉小镇级条目
- 72 家代表性酒店/民宿条目
- 地图、列表、关键词搜索、城市筛选、温度/酒店数量排序
- 收藏、去过记录（浏览器本地保存）
- 浏览器定位后按距离排序
- 插画地图 + 可选 Leaflet/OpenStreetMap 在线地图
- 泡汤注意事项
- JSON 数据校验与 GitHub Actions
- GitHub Pages/PWA 静态部署结构

### 数据范围说明

“区域层”是当前第一阶段的重点，酒店层目前是代表性清单，不声称已经收全。像龙门高沙、惠东安墩热汤等区域存在大量温泉民宿，后续会持续补充。

数据中 `verified: false` 表示需要社区继续核实，不代表该区域一定不存在；所有坐标当前以镇/片区级近似值为主，地图只作找区域的示意，不作为导航坐标。

## 本地运行

需要通过 HTTP 服务器打开，不能直接双击 `app/index.html`，因为浏览器会限制 `fetch` 读取 JSON/SVG。

```bash
./start-server.sh
# 浏览器打开 http://localhost:8000/
```

提交前检查：

```bash
node scripts/validate.js data/regions-gd.json
node scripts/smoke-test.js
node scripts/unit-test.js
```

也可以运行：

```bash
python3 -m http.server 8000
# 然后打开 http://localhost:8000/
```

## GitHub Pages

1. 将仓库推送到 GitHub。
2. 在 **Settings → Pages** 中选择 `GitHub Actions` 或 `Deploy from a branch`。
3. 如果选择分支部署，目录选择仓库根目录，访问根路径即可。
4. 在线地图需要网络；插画地图和已缓存的数据可以离线使用。

目前仓库已包含 `manifest.webmanifest` 和 `sw.js`。首次打开需要联网完成缓存，数据更新采用网络优先策略。

## 数据来源与许可证

初始数据整理自公开资料，包括：

- 广东温泉行业协会“真温泉”泉质认证名单（公开报道整理）
- 惠州市地热田/温泉开发利用公开报道
- 广东省情网、江门市及恩平市地方志/政府公开页面
- 肇庆、东莞、中山等地政府或景区官方公开页面

每个区域和酒店均应在 `source` 中标注来源；建议后续补充 `sourceUrl` 和核实日期。价格只作参考，出发前请向门店确认。

- **代码**：MIT，见 [`LICENSE`](LICENSE)
- **数据**：ODbL 1.0，见 [`data/LICENSE`](data/LICENSE)
- **数据格式**：见 [`docs/DATA_SCHEMA.md`](docs/DATA_SCHEMA.md)
- **贡献方式**：见 [`CONTRIBUTING.md`](CONTRIBUTING.md)

项目不复制第三方平台的图片、评分或大段文案，也不暗示与任何温泉景区存在官方合作关系。
