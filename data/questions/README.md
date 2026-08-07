# TOEIC 练习题库

题库由 `question-bank.js` 根据现有 1000 词主词库与 `data/enrichment/` 的例句、固定搭配稳定生成。

## 数量

| 类型 | 400分 | 600分 | 700分 | 合计 |
|---|---:|---:|---:|---:|
| 词性判断 | 150 | 150 | 100 | 400 |
| 固定搭配 | 150 | 150 | 100 | 400 |

## 词性题

使用现有例句作为上下文，只选词性明确为 `n.` / `v.` / `adj.` / `adv.` 的单词。

题目示意：

- 例句：`Every employee must wear an identification badge.`
- 问题：句中 `employee` 是什么词性？
- 选项：名词 / 动词 / 形容词 / 副词
- 答案：名词

每题字段：`id`, `type`, `level`, `relatedWordId`, `relatedWord`, `sentence`, `sentenceTranslation`, `prompt`, `options`, `answer`, `explanation`。

## 固定搭配题

从 `data/enrichment/` 中读取固定搭配。正确答案来自当前目标词，三个干扰项来自其他词的真实常用搭配。

题目示意：

- 问题：下面哪一个是 `office` 的常用搭配？
- 正确答案：`head office`
- 解析：`head office：总部`

每题字段：`id`, `type`, `level`, `relatedWordId`, `relatedWord`, `prompt`, `options`, `answer`, `answerMeaning`, `explanation`。

## 稳定性

题目选择和选项顺序使用固定种子，因此相同版本的数据会生成相同题号和顺序。生成结束后代码会强制校验两类题都必须恰好为 400 题，并校验各等级数量为 150 / 150 / 100；数量不符时直接报错，不会静默生成残缺题库。
