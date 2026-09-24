const http=require('http');
const PORT=process.env.PORT||8080;
const KEY=process.env.GEMINI_API_KEY||'';
const MODELS=['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite'];
const VERSION='1.3.1';

const ISP_SUMMARY=`你是臺灣大專校院資源教室的 ISP 行政文字助理。只依使用者提供內容潤飾，不得新增未提供的學生資訊、診斷、原因、能力、需求、服務或事件。保留原意、日期、數字、程度與事件順序。使用正式、客觀、中性、適合 ISP 文件的繁體中文。只要按下 AI 潤飾就必須實質改寫，至少改善用詞、句型、語序、行政文體或標點其中一項，不得直接照返原文，也不得回覆「內容已經很好」或「無需修改」。原文有列點時，列點數量、順序、前綴與換行必須完全保留，不得合併、拆分、刪除或新增列點。原文沒有列點時不得自行新增列點。原則上整理為至少30個中文字；可延展原文已明確表達的意思，但不得虛構。每一句都必須完整收尾，不得以「且、並、以及、於……中、於……時」等尚未完成的語句結束。只輸出可直接貼回欄位的文字，不要標題、前言、說明、引號或 Markdown。`;
const ISP_NEEDS=`你是臺灣大專校院資源教室的 ISP 行政文字助理。依輸入的現況能力摘要、學生優弱勢與現況分析，產生「學生需求評估」。不得使用或推測姓名、障別、診斷、病史、證明、家庭資料、家長期望或自我期望。先辨識真正需要支持的困難，再轉化為具體服務需求，不要只是改寫摘要。使用阿拉伯數字逐點輸出。需求標題要依內容命名，例如「學業需求」「情緒支持需求」「溝通支持需求」「人際適應需求」「生活適應需求」「生涯／轉銜需求」，不可每點固定寫成「服務需求」。相同性質整合，不同需求分點。正常、穩定、與一般學生相當或不適用面向不列入。沒有資料不要補寫。原則上一至六項。若無明顯特殊需求，只輸出「1. 持續追蹤：目前整體適應尚可，暫無明顯特殊服務需求，後續依實際適應情形持續追蹤。」每一點都必須是完整句子。只輸出可直接貼入欄位的列點。`;
const ISP_SERVICE=`你是臺灣大專校院資源教室的 ISP 行政文字助理。依學生需求評估、八項現況能力摘要及老師填寫的具體說明，產生「服務評估摘要」。已勾選的支持策略與服務僅用來核對方向，不要逐項羅列。聚焦一至三項核心需求及其對就學、生活適應或人際互動的影響，整合成一段連貫文字，包含整體現況與主要需求、支持重點及後續追蹤方向。僅使用明確提供的事實，不得新增、猜測或推論。尚未實施的服務不可寫成已有成效。原則上80至160個中文字。每一句都必須完整收尾。只輸出可直接貼入欄位的文字。`;
const SERVICE_POLISH=`你是臺灣大專校院資源教室的「服務紀錄內容摘述」文字助理。只依老師提供的原文進行潤飾，不得新增原文沒有的學生資訊、診斷、原因、事件、服務、成效、人物、日期或判斷。保留原意、時間、對象、事件順序與程度。請將口語、零碎或不完整的敘述整理成正式、客觀、中性、自然且適合資源教室服務紀錄的繁體中文。可改善語序、用詞、標點與句型，使內容更清楚，但不得把推測寫成事實。若原文有列點或分行，盡量保留原本結構；若原文為一段文字，不要自行新增標題或固定格式。不得回覆「內容已經很好」「無需修改」等說明。每一句都必須完整收尾。只輸出可直接貼回「內容摘述」欄位的文字，不要標題、前言、引號、Markdown 或額外說明。`;

const CREDIT_CURRICULUM=`你是明新科技大學資源教室「學分檢核系統」的時序表辨識器。請只依圖片中可見資料辨識，不得猜測不存在的課程、學分或學期。輸出必須是 JSON，不要 Markdown。格式：{"curriculum":{"totalCredits":數字,"targets":{"校必修":數字,"院必修":數字,"專業必修":數字,"專業選修":數字},"courses":[{"term":"1-1","category":"校必修|院必修|專業必修|專業選修","name":"課程名稱","credits":數字}],"warnings":["需要人工確認的事項"]}}。term 只能使用 1-1、1-2、2-1、2-2…8-2。0 學分必修仍須保留。若原表使用「系必修／系選修」，請分別正規化為「專業必修／專業選修」。分類通識若能明確辨識，課名保留「分類通識」字樣；不要自行判定學生是否已通過。重複課程若屬不同學期請分別保留。無法確定時不要硬猜，請在 warnings 說明。`;
const CREDIT_TRANSCRIPT=`你是明新科技大學資源教室「學分檢核系統」的成績辨識器。只依圖片中實際可見的成績表格辨識，不得猜測、補課或省略看得見的列。

辨識流程必須遵守：
1. 先從表格最上方到最下方逐列掃描，包含表格線附近、最上方第一列、最下方最後一列；不可只挑容易辨識的課程。
2. 只要某一列看得到「課名、學分、成績、P/F、抵免狀態」任一部分，就必須保留該列。課名不清楚時 name 可留空，但 rowIndex、可見的學分/成績/狀態仍要輸出並 needsReview=true，不可整列丟掉。
3. 時序表參考課名只可用於校正 OCR，例如空白、括號、相近字或「心理學」等課名；只有圖片中確實看得到對應文字時才能校正。圖片沒有出現的課程絕對不得因參考清單而新增。
4. 輸出前再重新檢查一次整張圖片，特別核對最上方、最下方及表格線附近是否漏列，並估計 visibleRowCountEstimate。
5. 分類通識只辨識課名與成績，不要自行判定領域，名稱保留「分類通識」字樣。
6. external 只有圖片明確標示外系時才可為 true。

成績規則：
- 數字成績 >=60 才 passed=true；<60 必須 passed=false。
- 紅字成績、F、FAIL、不及格皆 passed=false。
- P、PASS、合格皆 passed=true。
- 學分抵免、抵免、免修視為已完成，passed=true，recognitionType="exemption"。
- 0 學分課程也必須保留並照實判定。
- 無法確定通過與否時 needsReview=true 且 passed=false，不可擅自判定通過。

輸出必須是 JSON，不要 Markdown。格式：{"transcript":{"academicTerm":"可辨識則填，否則空字串","visibleRowCountEstimate":數字,"courses":[{"rowIndex":1,"name":"課程名稱，真的看不清楚可空字串","credits":數字或null,"score":數字或null,"grade":"P/F/PASS/FAIL/合格/抵免等文字，沒有則空字串","passed":true或false,"needsReview":true或false,"external":true或false,"recognitionType":"","redScore":true或false}],"warnings":["需要人工確認或可能漏列的事項"]}}。`;

function allowed(origin){return !origin||origin.startsWith('https://f00931must-hash.github.io')||origin.startsWith('http://localhost')||origin.startsWith('http://127.0.0.1');}
function headers(origin){return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowed(origin)?(origin||'*'):'null','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin','Cache-Control':'no-store'};}
function send(res,status,data,origin=''){res.writeHead(status,headers(origin));res.end(JSON.stringify(data));}
function clean(s){return String(s||'').replace(/^```(?:text|markdown|json)?\s*/i,'').replace(/\s*```$/i,'').replace(/^(?:潤飾後(?:的)?內容|內容摘述)[：:]\s*/i,'').trim();}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function looksIncomplete(text,finishReason=''){const value=String(text||'').trim();if(!value)return true;if(finishReason&&finishReason!=='STOP')return true;const tail=value.replace(/[\s。！？；!?;]+$/g,'');if(/(?:且|並|及|與|或|於|在|因|而|但|故|使|讓|以|若|則|以及|並且|同時|仍|亦|例如|包括|包含|透過|藉由)$/.test(tail))return true;if(/(?:於|在)[^，。！？；]{0,14}(?:中|時|期間|方面|情況下)$/.test(tail))return true;return false;}
function isRetryable(error){return error?.name==='AbortError'||[429,500,502,503,504,598].includes(error?.status);}

function promptFor(mode,section){
  if(mode==='service-polish')return {instruction:SERVICE_POLISH,task:'請潤飾以下資源教室服務紀錄「內容摘述」，保留原意並直接輸出可使用結果：',temperature:0.25,maxOutputTokens:900};
  if(mode==='needs-assessment')return {instruction:ISP_NEEDS,task:'請依下列資料產生學生需求評估列點：',temperature:0.2,maxOutputTokens:1100};
  if(mode==='service-evaluation')return {instruction:ISP_SERVICE,task:'請依下列資料產生服務評估摘要：',temperature:0.2,maxOutputTokens:1100};
  return {instruction:ISP_SUMMARY,task:`請潤飾以下 ISP「${section||'現況能力摘要'}」內容，務必實質改寫並直接給可使用結果：`,temperature:0.3,maxOutputTokens:700};
}
async function callGemini(text,mode,section,model,timeoutMs=12000){
  const p=promptFor(mode,section),c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':KEY},signal:c.signal,body:JSON.stringify({systemInstruction:{parts:[{text:p.instruction}]},contents:[{role:'user',parts:[{text:`${p.task}\n\n${text}`}]}],generationConfig:{temperature:p.temperature,topP:0.8,maxOutputTokens:p.maxOutputTokens}})});const data=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(data?.error?.message||`Gemini API error ${r.status}`);e.status=r.status;throw e;}const candidate=data?.candidates?.[0],out=clean(candidate?.content?.parts?.map(x=>x?.text||'').join(''));if(!out)throw new Error('AI 未回傳可用文字');if(looksIncomplete(out,candidate?.finishReason||'')){const e=new Error('AI 回傳內容疑似未完整結束');e.status=598;throw e;}return out;}finally{clearTimeout(timer);}
}
async function callWithFallback(text,mode,section){
  const attempts=[];
  let lastError=null;
  let backoffStep=0;

  for(let i=0;i<MODELS.length;i++){
    const model=MODELS[i];
    const maxTries=2;

    for(let tryNo=1;tryNo<=maxTries;tryNo++){
      try{
        return {text:await callGemini(text,mode,section,model,i===0?12000:15000),model,attempts};
      }catch(error){
        lastError=error;
        attempts.push({model,tryNo,status:error?.status||0,message:String(error?.message||'').slice(0,160)});
        console.warn('AI attempt failed',{
          model,
          tryNo,
          status:error?.status||0,
          name:error?.name||'',
          message:String(error?.message||'').slice(0,160)
        });

        if(!isRetryable(error))throw error;

        const hasAnotherTry=tryNo<maxTries;
        const hasAnotherModel=i<MODELS.length-1;
        if(hasAnotherTry||hasAnotherModel){
          const waits=[1000,2000,4000];
          const delay=waits[Math.min(backoffStep,waits.length-1)];
          backoffStep++;
          await sleep(delay);
        }
      }
    }
  }

  const e=lastError||new Error('AI 服務暫時無法使用');
  e.attempts=attempts;
  throw e;
}
async function handle(body,forcedMode=''){const text=String(body?.text||'').trim(),mode=forcedMode||(['summary','needs-assessment','service-evaluation'].includes(body?.mode)?body.mode:'summary'),section=String(body?.section||'').trim();if(!text)return [400,{success:false,error:'內容不可空白'}];if(text.length>6000)return [400,{success:false,error:'內容過長，目前上限為 6000 字'}];try{const result=await callWithFallback(text,mode,section);return [200,{success:true,polished:result.text,model:result.model}];}catch(e){return aiError(e);}}
function aiError(e){const m=String(e?.message||'').toLowerCase();if(e?.status===598)return [502,{success:false,error:'AI 回傳內容不完整，系統已嘗試備援模型；請再試一次，原始內容不會遺失。'}];if(m.includes('location is not supported')||m.includes('user location'))return [502,{success:false,error:'AI 服務目前受到地區限制，請稍後再試；原始內容不會遺失。'}];if(e?.status===429)return [429,{success:false,error:'AI 目前使用量較高，系統已自動嘗試其他模型；請稍後再試，原始內容不會遺失。'}];if(e?.status===503||m.includes('high demand')||m.includes('unavailable'))return [503,{success:false,error:'Google AI 目前忙碌，系統已自動切換備援模型但仍無法完成；請稍後再試，原始內容不會遺失。'}];if(e?.name==='AbortError')return [504,{success:false,error:'AI 多模型嘗試皆逾時，請稍後再試；原始內容不會遺失。'}];return [502,{success:false,error:e?.message||'AI 服務暫時無法使用，請稍後再試；原始內容不會遺失。'}];}

function parseJsonText(text){const cleaned=clean(text);try{return JSON.parse(cleaned);}catch{const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');if(start>=0&&end>start)return JSON.parse(cleaned.slice(start,end+1));throw new Error('AI 回傳格式不是有效 JSON');}}
function normalizeImages(body,max){const images=Array.isArray(body?.images)?body.images:[];if(!images.length)throw Object.assign(new Error('請至少提供一張圖片'),{status:400});if(images.length>max)throw Object.assign(new Error(`一次最多處理 ${max} 張圖片`),{status:400});return images.map(x=>({mimeType:String(x?.mimeType||'image/jpeg'),data:String(x?.data||'')})).filter(x=>x.data);}
function transcriptReferenceText(context){const targetTerm=String(context?.targetTerm||'').trim(),courses=[...new Set((Array.isArray(context?.referenceCourses)?context.referenceCourses:[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,120);if(!targetTerm&&!courses.length)return '';return `\n\n【本次辨識參考資訊】\n學生選擇的年級／學期：${targetTerm||'未提供'}\n該學期時序表課名參考：${courses.length?courses.join('、'):'未提供'}\n注意：這份清單只能協助 OCR 校正。圖片中沒有出現的課程不得新增，也不得因清單存在就判定學生有修課。`;}
async function callVisionModel(images,kind,model,timeoutMs,context={}){
  const instruction=(kind==='curriculum'?CREDIT_CURRICULUM:CREDIT_TRANSCRIPT)+(kind==='transcript'?transcriptReferenceText(context):''),c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{const parts=[{text:instruction},...images.map(x=>({inlineData:{mimeType:x.mimeType,data:x.data}}))];const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':KEY},signal:c.signal,body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0.05,topP:0.8,maxOutputTokens:kind==='curriculum'?8192:7168,responseMimeType:'application/json'}})});const data=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(data?.error?.message||`Gemini API error ${r.status}`);e.status=r.status;throw e;}const candidate=data?.candidates?.[0],raw=candidate?.content?.parts?.map(x=>x?.text||'').join('')||'';if(!raw){const e=new Error('AI 未回傳可用結果');e.status=598;throw e;}if(candidate?.finishReason&&candidate.finishReason!=='STOP'){const e=new Error('AI 回傳結果未完整結束');e.status=598;throw e;}try{return parseJsonText(raw);}catch(error){error.status=598;throw error;}}finally{clearTimeout(timer);}
}
function rawTranscriptCompleteness(payload){const src=payload?.transcript||payload||{},rows=Array.isArray(src.courses)?src.courses.length:0,estimate=Number(src.visibleRowCountEstimate);return {rows,estimate:Number.isFinite(estimate)&&estimate>=0?estimate:rows};}
async function callVisionFallback(images,kind,context={}){let lastError=null,best=null;for(let i=0;i<MODELS.length;i++){const model=MODELS[i];try{const data=await callVisionModel(images,kind,model,i===0?17000:20000,context);if(kind!=='transcript')return {data,model};const check=rawTranscriptCompleteness(data);if(!best||check.rows>best.check.rows)best={data,model,check};if(check.estimate<=check.rows)return {data,model};console.warn('Credit transcript completeness retry',{model,visibleRowCountEstimate:check.estimate,returnedRows:check.rows});if(i<MODELS.length-1){await sleep(250);continue;}return {data:best.data,model:best.model,completenessWarning:true};}catch(error){lastError=error;console.warn('Credit AI attempt failed',{kind,model,status:error?.status||0,name:error?.name||'',message:String(error?.message||'').slice(0,120)});if(!isRetryable(error)&&error?.status!==400)throw error;if(error?.status===400)throw error;if(i<MODELS.length-1)await sleep(250);}}if(best)return {data:best.data,model:best.model,completenessWarning:true};throw lastError||new Error('AI 服務暫時無法使用');}
function normalizeCurriculum(payload){const src=payload?.curriculum||payload||{},allowed=new Set(['校必修','院必修','專業必修','專業選修']),mapCategory=v=>v==='系必修'?'專業必修':v==='系選修'?'專業選修':v;const courses=(Array.isArray(src.courses)?src.courses:[]).map((c,i)=>({term:String(c?.term||'').trim(),category:mapCategory(String(c?.category||'').trim()),name:String(c?.name||'').trim(),credits:Number(c?.credits)})).filter(c=>/^([1-8])-[12]$/.test(c.term)&&allowed.has(c.category)&&c.name&&Number.isFinite(c.credits)&&c.credits>=0);const t=src.targets||{};return {totalCredits:Number(src.totalCredits)||0,targets:{'校必修':Number(t['校必修'])||0,'院必修':Number(t['院必修'])||0,'專業必修':Number(t['專業必修']??t['系必修'])||0,'專業選修':Number(t['專業選修']??t['系選修'])||0},courses,warnings:Array.isArray(src.warnings)?src.warnings.map(String):[]};}
function normalizeTranscript(payload,{completenessWarning=false}={}){const src=payload?.transcript||payload||{},warnings=Array.isArray(src.warnings)?src.warnings.map(String):[],rawCourses=Array.isArray(src.courses)?src.courses:[],courses=rawCourses.map((c,index)=>{const rowIndex=Number(c?.rowIndex)||index+1,name=String(c?.name||'').trim(),creditsRaw=c?.credits,creditsNumber=creditsRaw===null||creditsRaw===''||creditsRaw===undefined?null:Number(creditsRaw),score=c?.score===null||c?.score===''||c?.score===undefined?null:Number(c.score),grade=String(c?.grade||'').trim().toUpperCase(),redScore=c?.redScore===true;let recognitionType=String(c?.recognitionType||''),passed=!!c?.passed,needsReview=!!c?.needsReview;const gradeCompact=grade.replace(/\s+/g,'');if(Number.isFinite(score)){passed=score>=60;needsReview=false;}if(redScore){passed=false;needsReview=false;}if(['F','FAIL','不及格'].includes(gradeCompact)){passed=false;needsReview=false;}if(['P','PASS','合格'].includes(gradeCompact)){passed=true;needsReview=false;}if(['學分抵免','抵免','免修'].includes(gradeCompact)){passed=true;needsReview=false;recognitionType='exemption';}const hasVisibleData=!!name||Number.isFinite(creditsNumber)||Number.isFinite(score)||!!grade;if(!name&&hasVisibleData){needsReview=true;warnings.push(`第${rowIndex}列課名無法確認，已保留可見成績資料供人工確認。`);}const safeName=name||`待人工確認課程（第${rowIndex}列）`;if(!Number.isFinite(score)&&!grade){needsReview=true;passed=false;}return {rowIndex,name:safeName,credits:Number.isFinite(creditsNumber)&&creditsNumber>=0?creditsNumber:0,score:Number.isFinite(score)?score:null,grade,passed,needsReview,external:c?.external===true,recognitionType,redScore,academicTerm:String(c?.academicTerm||'')};}).filter(c=>c.name);const estimateRaw=Number(src.visibleRowCountEstimate),visibleRowCountEstimate=Number.isFinite(estimateRaw)&&estimateRaw>=0?estimateRaw:courses.length;if(visibleRowCountEstimate>courses.length)warnings.push(`完整性檢查：圖片約有 ${visibleRowCountEstimate} 列課程，AI 回傳 ${courses.length} 列，系統已嘗試備援模型，請人工確認表格邊界是否仍有漏列。`);if(completenessWarning&&!warnings.some(x=>x.includes('完整性檢查')))warnings.push('完整性檢查未完全通過，系統已採用三個模型中辨識列數最多的結果，請人工確認。');return {academicTerm:String(src.academicTerm||''),visibleRowCountEstimate,courses,warnings:[...new Set(warnings)]};}
async function handleCredit(body,kind){try{const images=normalizeImages(body,kind==='curriculum'?12:6),context=kind==='transcript'?{targetTerm:String(body?.targetTerm||''),referenceCourses:Array.isArray(body?.referenceCourses)?body.referenceCourses:[]}:{},result=await callVisionFallback(images,kind,context);if(kind==='curriculum')return [200,{success:true,curriculum:normalizeCurriculum(result.data),model:result.model}];return [200,{success:true,transcript:normalizeTranscript(result.data,{completenessWarning:result.completenessWarning===true}),model:result.model}];}catch(e){if(e?.status===400)return [400,{success:false,error:e.message}];return aiError(e);}}

http.createServer((req,res)=>{
  const origin=req.headers.origin||'',url=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='OPTIONS'){if(!allowed(origin))return send(res,403,{success:false,error:'不允許的網站來源'},origin);res.writeHead(204,headers(origin));return res.end();}
  const routes=['/ai/isp-summary','/ai/polish','/ai/curriculum-parse','/ai/transcript-parse'];
  if(req.method==='GET'&&url.pathname==='/')return send(res,200,{success:true,service:'MUST Resource AI Cloud Run',version:VERSION,region:'asia-east1',routes:routes.map(x=>`POST ${x}`),models:MODELS,outputCompletenessCheck:true,transcriptReferenceCourses:true},origin);
  if(req.method!=='POST'||!routes.includes(url.pathname))return send(res,404,{success:false,error:'找不到此 API 路徑'},origin);
  if(!allowed(origin))return send(res,403,{success:false,error:'不允許的網站來源'},origin);
  if(!KEY)return send(res,500,{success:false,error:'尚未設定 GEMINI_API_KEY'},origin);
  let raw='';req.on('data',x=>raw+=x);req.on('end',async()=>{let body;try{body=JSON.parse(raw||'{}');}catch{return send(res,400,{success:false,error:'請求格式錯誤'},origin);}let status,data;if(url.pathname==='/ai/curriculum-parse')[status,data]=await handleCredit(body,'curriculum');else if(url.pathname==='/ai/transcript-parse')[status,data]=await handleCredit(body,'transcript');else [status,data]=await handle(body,url.pathname==='/ai/polish'?'service-polish':'');send(res,status,data,origin);});
}).listen(PORT,()=>console.log(`MUST Resource AI Cloud Run ${VERSION} listening on ${PORT}`));