const LEVEL_FILES={400:["data/400/words-001-100.csv","data/400/words-101-200.csv","data/400/words-201-300.csv","data/400/words-301-400.csv"],600:["data/400/words-001-100.csv","data/400/words-101-200.csv","data/400/words-201-300.csv","data/400/words-301-400.csv","data/600/words-401-500.csv","data/600/words-501-600.csv","data/600/words-601-700.csv","data/600/words-701-750.csv"],700:["data/400/words-001-100.csv","data/400/words-101-200.csv","data/400/words-201-300.csv","data/400/words-301-400.csv","data/600/words-401-500.csv","data/600/words-501-600.csv","data/600/words-601-700.csv","data/600/words-701-750.csv","data/700/words-751-850.csv","data/700/words-851-950.csv","data/700/words-951-1000.csv"]};
const el=id=>document.getElementById(id);
const ui={progressText:el("progressText"),masteredText:el("masteredText"),reviewText:el("reviewText"),progressBar:el("progressBar"),card:el("card"),modeBadge:el("modeBadge"),wordIndex:el("wordIndex"),wordText:el("wordText"),phoneticText:el("phoneticText"),answer:el("answer"),partText:el("partText"),meaningText:el("meaningText"),topicText:el("topicText"),revealBtn:el("revealBtn"),ratingButtons:el("ratingButtons"),donePanel:el("donePanel"),doneTitle:el("doneTitle"),doneText:el("doneText"),reviewBtn:el("reviewBtn"),restartBtn:el("restartBtn"),resetBtn:el("resetBtn"),errorText:el("errorText")};
let level=400,words=[],queue=[],cursor=0,mode="study",revealed=false;
const stateKey=()=>`toeic-progress-${level}`;
const defaultState=()=>({ratings:{},studyOrder:[],studyCursor:0,reviewOrder:[],reviewCursor:0});
let state=defaultState();
function parseCsv(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){cell+='"';i++;continue}if(c==='"'){quoted=!quoted;continue}if(c===','&&!quoted){row.push(cell);cell="";continue}if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v!==""))rows.push(row);row=[];cell="";continue}cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}const headers=rows.shift().map(v=>v.trim());return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||"").trim()]))) }
async function loadWords(){try{const parts=await Promise.all(LEVEL_FILES[level].map(async path=>{const r=await fetch(path);if(!r.ok)throw new Error(path);return parseCsv(await r.text())}));words=parts.flat().map(w=>({...w,id:Number(w.id),level:Number(w.level)}));if(!words.length)throw new Error("词库为空");loadState();startSavedMode();hideError()}catch(err){showError(`词库读取失败：${err.message}`)}}
function loadState(){try{state={...defaultState(),...JSON.parse(localStorage.getItem(stateKey())||"{}")}}catch{state=defaultState()}state.ratings=state.ratings||{}}
function saveState(){localStorage.setItem(stateKey(),JSON.stringify(state))}
function allIds(){return words.map(w=>w.id)}
function reviewIds(){return words.filter(w=>state.ratings[w.id]&&state.ratings[w.id]!=="know").map(w=>w.id)}
function startSavedMode(){if(state.studyOrder.length!==words.length||!state.studyOrder.every(id=>words.some(w=>w.id===id))){state.studyOrder=allIds();state.studyCursor=0}mode="study";queue=[...state.studyOrder];cursor=Math.min(state.studyCursor,queue.length);render()}
function startStudy(reset=false){if(reset){state.studyOrder=allIds();state.studyCursor=0;saveState()}mode="study";queue=[...state.studyOrder];cursor=state.studyCursor;render()}
function startReview(){const ids=reviewIds();state.reviewOrder=ids;state.reviewCursor=0;saveState();mode="review";queue=ids;cursor=0;render()}
function currentWord(){const id=queue[cursor];return words.find(w=>w.id===id)}
function render(){updateStats();revealed=false;ui.answer.classList.add("hidden");ui.ratingButtons.classList.add("hidden");ui.revealBtn.classList.remove("hidden");ui.donePanel.classList.add("hidden");ui.card.classList.remove("hidden");if(cursor>=queue.length){renderDone();return}const w=currentWord();if(!w){renderDone();return}ui.modeBadge.textContent=mode==="review"?"复习":"学习";ui.wordIndex.textContent=`${cursor+1} / ${queue.length} · 总编号 ${w.id}`;ui.wordText.textContent=w.word;ui.phoneticText.textContent=w.phonetic;ui.partText.textContent=w.partOfSpeech;ui.meaningText.textContent=w.meaning;ui.topicText.textContent=w.topic}
function updateStats(){const completed=words.filter(w=>state.ratings[w.id]).length;const mastered=words.filter(w=>state.ratings[w.id]==="know").length;const review=reviewIds().length;ui.progressText.textContent=`${completed} / ${words.length}`;ui.masteredText.textContent=mastered;ui.reviewText.textContent=review;ui.progressBar.style.width=`${words.length?completed/words.length*100:0}%`}
function reveal(){if(cursor>=queue.length)return;revealed=true;ui.answer.classList.remove("hidden");ui.ratingButtons.classList.remove("hidden");ui.revealBtn.classList.add("hidden")}
function rate(value){if(!revealed||cursor>=queue.length)return;const id=queue[cursor];state.ratings[id]=value;cursor++;if(mode==="study")state.studyCursor=cursor;else state.reviewCursor=cursor;saveState();render()}
function renderDone(){ui.card.classList.add("hidden");ui.ratingButtons.classList.add("hidden");ui.donePanel.classList.remove("hidden");const count=reviewIds().length;ui.doneTitle.textContent=mode==="review"?"复习完成":"本轮完成";ui.doneText.textContent=count?`还有 ${count} 个词在复习库。`:"当前档位没有待复习单词。";ui.reviewBtn.disabled=count===0;ui.reviewBtn.textContent=count?`复习 ${count} 个词`:"没有待复习词"}
function switchLevel(next){level=Number(next);document.querySelectorAll(".level-btn").forEach(b=>b.classList.toggle("active",Number(b.dataset.level)===level));words=[];queue=[];cursor=0;ui.wordText.textContent="加载中…";loadWords()}
function resetCurrent(){if(!confirm(`确定重置 ${level} 分档的全部学习记录吗？`))return;localStorage.removeItem(stateKey());state=defaultState();startStudy(true)}
function showError(msg){ui.errorText.textContent=msg;ui.errorText.classList.remove("hidden")}
function hideError(){ui.errorText.classList.add("hidden")}
document.querySelectorAll(".level-btn").forEach(b=>b.addEventListener("click",()=>switchLevel(b.dataset.level)));
ui.revealBtn.addEventListener("click",reveal);
ui.card.addEventListener("click",e=>{if(e.target===ui.card||e.target===ui.wordText||e.target===ui.phoneticText)reveal()});
ui.card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();reveal()}});
document.querySelectorAll(".rating").forEach(b=>b.addEventListener("click",()=>rate(b.dataset.rating)));
ui.reviewBtn.addEventListener("click",startReview);
ui.restartBtn.addEventListener("click",()=>startStudy(true));
ui.resetBtn.addEventListener("click",resetCurrent);
loadWords();
