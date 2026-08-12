# 数据格式规范（DATA SCHEMA）

本项目的核心资产是 `data/regions-gd.json` 数据文件。贡献者请严格按照本规范编辑。

## 总体结构

```json
{
  "meta": {
    "title": "项目名",
    "version": "语义化版本",
    "updated": "YYYY-MM-DD",
    "scope": "收录范围说明",
    "license": "ODbL-1.0",
    "dataSources": ["数据来源列表"]
  },
  "regions": [ { Region }, ... ]
}
```

## Region（温泉区域/小镇）字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，格式 `gd-<市拼音>-<区县>-<地名>`，如 `gd-hz-huidong-andun` |
| `name` | string | ✅ | 区域名称，如「惠东安墩镇热汤村」 |
| `city` | string | ✅ | 地级市：广州/深圳/珠海/佛山/惠州/东莞/中山/江门/肇庆 |
| `district` | string | ✅ | 区县，如「惠东县」 |
| `lat` / `lng` | number | ✅ | 区域中心坐标（镇/片区级），仅作地图示意 |
| `approx` | boolean | ✅ | 坐标是否近似（非精确 POI），数据不全时填 `true` |
| `temp` | number \| null | ✅ | 代表泉口温度（℃），未知填 `null` |
| `springType` | string[] | ✅ | 泉质类型，见下方枚举；未知填 `[]` |
| `tags` | string[] | ✅ | 特色标签：亲子/网红/康养/禅意/田园/海景/历史名镇/温泉民宿集群 等 |
| `intro` | string | ✅ | 1~2 句区域介绍 |
| `hotelCount` | string | ✅ | 区域内温泉酒店/民宿数量（可用「6+」「100+民宿」「待核实」） |
| `hotels` | Hotel[] | ✅ | 区域内温泉酒店列表（可为空数组） |
| `source` | string | ✅ | 本区域数据来源（官方名单/政府网站/报道等） |
| `sourceUrl` | string | 否 | 可访问的来源链接；建议补充，不强制要求所有初始数据立即具备 |
| `checkedAt` | string | ✅ | 最近核实日期，格式 `YYYY-MM-DD` |
| `status` | enum | ✅ | `operating` 当前可泡；`needs_review` 待核实；`closed_or_recruiting` 停业/招商；`resource_only` 仅资源记录 |
| `verified` | boolean | ✅ | 数据是否已核实（不等同于当前营业状态） |
| `springAuthenticity` | enum | ✅ | 泉水真实性：`true` 实际真温泉（天然地热）；`mixed` 区域内真假混合；`uncertain` 待核实 |
| `poi` | object | 否 | 代表温泉酒店/泡池：`{ name, lat, lng, approx }`，用于高德地图导航跳转 |

## Hotel（区域内酒店）字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | ✅ | 酒店/度假村名称 |
| `cert` | string \| null | ✅ | 认证：`真温泉·第N批` / `医疗价值冷泉` / `持证开采` / `null` |
| `price` | string | ✅ | 门票价格区间（元），如 `100-250`；用「待开业」等文字 |
| `desc` | string | ✅ | 一句话特色 |
| `source` | string | ✅ | 本条数据来源 |
| `sourceUrl` | string | 否 | 可访问的来源链接 |
| `checkedAt` | string | ✅ | 最近核实日期，格式 `YYYY-MM-DD` |
| `verified` | boolean | ✅ | 本条酒店数据是否已核实 |
| `authenticity` | enum | 否 | 酒店泉水真实性（可选）：`true` 真温泉；`false` 假温泉/海泉SPA；`unknown` 待核实 |

## 泉质类型枚举（springType）

- `氡泉`（含氡弱碱性苏打泉，从化为代表）
- `偏硅酸泉`
- `氟泉`
- `氯化钠泉`（咸水温泉/海洋温泉）
- `硫磺泉`
- `碳酸氢钠泉`
- `碳酸泉`
- `热矿泥`
- 其他请先在 issue 中讨论后添加

## 贡献守则（重要）

1. **只收录公开事实信息**：位置、泉质、认证、营业状态。**禁止**从携程/大众点评/美团等平台爬取价格、评分、图片。
2. **价格是动态数据**，只写区间且注明「仅供参考，以门店为准」，不做精确比价。
3. 每条新增/修改必须填写 `source`（来源），无法注明来源的信息不要收录。
4. `verified: false` 的信息允许存在（社区后续核实），但 `name/city/lat/lng` 必须真实。
5. 提交前跑 `node scripts/validate.js`，通过后再提交 PR。

## 校验

```bash
node scripts/validate.js data/regions-gd.json
```
CI 会在每次 PR 自动运行该校验。
