# TOEIC Vocabulary

面向中文学习者的 TOEIC 核心词库。

## 当前进度

- 已建立 400 分档候选词清单
- 第一批公开数据：100 个
- 已包含：单词、候选美式 IPA、词性、中文释义、等级、主题
- 例句和例句翻译将在词表审核后补充
- 600 分和 700 分词库尚未加入

## 数据文件

- `data/words.json`：供网页直接读取
- 后续将补充 `data/words.csv`：供 Excel 检查和修改

## 等级规则

词库采用累计式等级：

- 400 分：`level <= 400`
- 600 分：`level <= 600`
- 700 分：`level <= 700`

## 字段

| 字段 | 说明 |
|---|---|
| id | 连续编号 |
| word | 英文单词 |
| phonetic | 美式 IPA 候选音标 |
| partOfSpeech | 词性 |
| meaning | 中文核心释义 |
| example | 英文例句 |
| exampleTranslation | 例句中文翻译 |
| level | 初次加入的等级 |
| topic | TOEIC 场景主题 |
| status | 数据审核状态 |

## 数据状态

当前 `status` 为 `candidate`，表示词汇、分档和音标仍需逐项复核。完成审核后会改为 `reviewed`。
