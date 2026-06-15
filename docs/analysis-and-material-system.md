# 自动价值判断与素材沉淀系统设计

更新日期：2026-05-28

当前状态：设计阶段冻结。主系统继续完善采集、订阅、热点、来源健康和数据归档；本模块暂不继续扩展为默认执行链路。

## 目标

未来分析层负责把采集层拿到的真实信号转成可判断、可沉淀、可人工删除的素材卡。第一版产品想法如下：

- 价值判断：判断热点是否和 VisionTree 的认知增强、判断力、结构化思考相关。
- 总结分析：记录来源、抓取时间、热度、风险、可写角度。
- 沉淀卡片：生成候选素材卡和 content-system asset mapping。
- 人工去留：素材进入素材池后，人工通过删除低质量素材卡完成审核。

## 设计边界

- 不自动发布内容。
- 不把 LLM 分析结果当事实来源。
- 不在采集链路中强依赖分析结果。
- 不因人工删除而自动重建素材卡，除非显式开启强制重建。

## 未来分层

```text
collectors
  -> raw snapshots
  -> normalized items
  -> source health

material analyzer
  -> relevance score
  -> evidence level
  -> risk notes
  -> VisionTree angle
  -> candidate asset cards

sync package
  -> ready-for-prep
  -> ready-for-content-system
  -> synced / skipped

content-system
  -> human keeps useful cards
  -> human deletes low-quality cards
```

## 后续增强候选

1. 增加 `reviewStatus`: `keep` / `delete` / `needs-evidence` / `merge`。
2. 对同主题热点做聚类，而不是只按标题合并。
3. 为每张素材卡生成可写角度、不可写边界、需要补证据。
4. 加入 LLM 辅助评分，但评分只作为建议，不直接发布内容。
