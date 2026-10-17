# 离线内容生产流水线

本目录独立于用户学习过程。首批通过 `build-bank.mjs` 从固定提交的 `ERRRC/xingcezhenti` 资料分析 Markdown 生成私人题库；`check-bank.mjs` 验证发布包。题目答案直接采用上游答案，不做图片识别或独立验算。

| 目录      | 职责与输出条件                                             |
| --------- | ---------------------------------------------------------- |
| sources   | 来源清单、出处、适用年份和许可依据；明确可以使用才进入生产 |
| extract   | 提取获准使用的材料，保留原文位置和来源关联                 |
| normalize | 转换为统一内容结构，保留稳定 ID 与版本                     |
| classify  | 关联自建教学知识点，区分官方模块与教学分类                 |
| generate  | 原创/AI辅助草稿；计算题优先程序验证，不直接发布            |
| validate  | Schema、引用、答案、解析、重复与歧义校验及结果             |
| review    | 人工审核记录；审核通过与答案验证分开记录                   |
| output    | 按发布范围生成版本化内容包，并记录来源、许可与校验状态     |

当前私人题库是上述通用流程的特例：输出位置为 `public/content/bank/`，来源许可保持 `unknown`，审核状态为 `source-provided`。这表示答案由来源提供、未经独立核验，仅可在本人可访问的应用中使用，不能当作已获许可或已验证内容公开发布。`content-pipeline/output/report.json` 记录生成数量，临时图片清单不入库。

## 复现首批私人题库

来源固定在提交 `278984401124db40da5163a31275b8deb9c282f4`。准备该提交的仓库目录后运行：

```sh
node content-pipeline/build-bank.mjs /path/to/xingcezhenti plan
# 将 content-pipeline/output/asset-paths.txt 所列图片放入上游仓库原路径
node content-pipeline/build-bank.mjs /path/to/xingcezhenti build
pnpm content:check
```

`plan` 预留约 100 道题的图片，以便跳过上游缺图题组；`build` 选满至少 1000 道单选，优先湖北卷，再按年份和试卷排序补入其他地区。按完整材料组取题，保留上游 `qid`、试卷出处、图片及答案；无法解析选项、答案标记冲突或所需图片缺失的题组不发布。发布包分成 JSON 块及独立图片，启动时验证并以单一 IndexedDB 事务导入。已存在题目版本内容不同会整体回滚，不能覆盖旧作答历史。

上游表格和公式常是图片。首批只展示原图，未将图中数值转换为结构化表格；脚本不调用 AI。生成的题目难度标为 `unrated`，只关联资料分析综合知识点，后续细分需要单独的数据质量工作。

来源和许可规则见 [内容依据](../docs/content.md)，实体结构见 [架构契约](../docs/architecture.md)。题目至少保存题型、题干、选项、答案、解析、知识点、难度、来源、地区、年份、许可、审核和版本。修改已发布内容新增版本，保留旧版本供历史引用。

## 复现六模块课程与题包

在同一固定提交准备完整六模块 Markdown 和 `90-图片` 后运行：

```sh
python3 content-pipeline/build-all-bank.py /path/to/xingcezhenti
python3 content-pipeline/build-courses.py
pnpm content:check
```

`build-all-bank.py` 跳过首期已有的 1001 个稳定题目 ID，去重并筛出结构完整、图片齐全的单选题；输出按模块分包到 `public/content/all-bank`，图片放在共同的 `assets` 目录，跳过原因写入 `content-pipeline/output/all-bank-report.json`。标题小类、题干关键词与 `src/content/example-selection.json` 用于知识点关联；自动关联未经人工确认。`build-courses.py` 把 `src/content/course-outlines.json` 的 46 份教学提纲和上游例题编译到 `src/content/all-courses.json`。课程正式可见，审核状态如实标记为 `source-derived`，答案不做独立核验。新题包在首次练习对应模块时按分包事务增量导入，重复导入幂等。
