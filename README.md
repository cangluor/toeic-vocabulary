# TOEIC Vocabulary

面向中文学习者的 TOEIC 核心词库和个人背词网页。

## 网页功能

- 400、600、700分累计词库切换
- 单词、音标、词性、中文释义和主题显示
- 认识、模糊、不认识三档判断
- 模糊和不认识自动进入复习库
- 学习进度、已掌握数和待复习数统计
- 本地保存，并可通过 Cloudflare Worker + KV 在手机和电脑间同步
- 不需要注册账号；使用自设同步码读取同一份进度

网页文件位于仓库根目录：

- `index.html`
- `styles.css`
- `app.js`

Cloudflare Worker 位于 `worker/`：

- `worker/src/index.js`
- `worker/wrangler.jsonc`
- `worker/package.json`

Cloudflare连接仓库时使用：

- Root directory：`worker`
- Deploy command：`npx wrangler deploy`

部署后，在网页的“同步设置”中填写 Worker 地址和至少8位同步码。手机与电脑填写相同内容即可读取同一份进度。

## 词库进度

- 400分词库：400词
- 600分新增词库：350词
- 700分新增词库：250词
- 累计词数：1000词
- 已包含：英文单词、美式IPA候选音标、词性、中文核心释义、等级、主题
- 例句和例句翻译：尚未补充

## 数据文件

- `data/400/`：编号1–400
- `data/600/`：编号401–750
- `data/700/`：编号751–1000

## 等级规则

- 400分：读取编号1–400
- 600分：读取编号1–750
- 700分：读取编号1–1000

## 字段

| 字段 | 说明 |
|---|---|
| id | 连续编号 |
| word | 英文单词 |
| phonetic | 美式IPA候选音标 |
| partOfSpeech | 词性 |
| meaning | 中文核心释义 |
| level | 初次加入的等级 |
| topic | TOEIC场景主题 |

音标属于候选数据，后续仍需逐词复核。
