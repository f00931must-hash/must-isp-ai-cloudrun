const http=require('http');
const PORT=process.env.PORT||8080;
const KEY=process.env.GEMINI_API_KEY||'';
const MODELS=['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite'];

const ISP_SUMMARY=`你是臺灣大專校院資源教室的 ISP 行政文字助理。只依使用者提供內容潤飾，不得新增未提供的學生資訊、診斷、原因、能力、需求、服務或事件。保留原意、日期、數字、程度與事件順序。使用正式、客觀、中性、適合 ISP 文件的繁體中文。只要按下 AI 潤飾就必須實質改寫，至少改善用詞、句型、語序、行政文體或標點其中一項，不得直接照返原文，也不得回覆「內容已經很好」或「無需修改」。原文有列點時，列點數量、順序、前綴與換行必須完全保留，不得合併、拆分、刪除或新增列點。原文沒有列點時不得自行新增列點。原則上整理為至少30個中文字；可延展原文已明確表達的意思，但不得虛構。只輸出可直接貼回欄位的文字，不要標題、前言、說明、引號或 Markdown。`;

const ISP_NEEDS=`你是臺灣大專校院資源教室的 ISP 行政文字助理。依輸入的現況能力摘要、學生優弱勢與現況分析，產生「學生需求評估」。不得使用或推測姓名、障別、診斷、病史、證明、家庭資料、家長期望或自我期望。先辨識真正需要支持的困難，再轉化為具體服務需求，不要只是改寫摘要。使用阿拉伯數字逐點輸出，格式為「1. 服務需求：簡要說明」。相同性質整合，不同需求分點。正常、穩定、與一般學生相當或不適用面向不列入。沒有資料不要補寫。原則上一至六項。若無明顯特殊需求，只輸出「1. 持續追蹤：目前整體適應尚可，暫無明顯特殊服務需求，後續依實際適應情形持續追蹤。」只輸出可直接貼入欄位的列點。`;

const ISP_SERVICE=`你是臺灣大專校院資源教室的 ISP 行政文字助理。依學生需求評估、八項現況能力摘要及老師填寫的具體說明，產生「服務評估摘要」。已勾選的支持策略與服務僅用來核對方向，不要逐項羅列。聚焦一至三項核心需求及其對就學、生活適應或人際互動的影響，整合成一段連貫文字，包含整體現況與主要需求、支持重點及後續追蹤方向。僅使用明確提供的事實，不得新增、猜測或推論。尚未實施的服務不可寫成已有成效。原則上80至160個中文字。只輸出可直接貼入欄位的文字。`;

function allowed(origin){return !origin||origin.startsWith('https://f00931must-hash.github.io')||origin.startsWith('http://localhost')||origin.startsWith('http://127.0.0.1');}
function headers(origin){return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowed(origin)?(origin||'*'):'null','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin','Cache-Control':'no-store'};}
function send(res,status,data,origin=''){res.writeHead(status,headers(origin));res.end(JSON.stringify(data));}
function clean(s){return String(s||'').replace(/^```(?:text|markdown)?\s*/i,'').replace(/\s*```$/i,'').replace(/^(?:潤飾後(?:的)?內容|內容摘述)[：:]\s*/i,'').trim();}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function callGemini(text,mode,section,model,timeoutMs=12000){
  const instruction=mode==='needs-assessment'?ISP_NEEDS:mode==='service-evaluation'?ISP_SERVICE:ISP_SUMMARY;
  const task=mode==='needs-assessment'?'請依下列資料產生學生需求評估列點：':mode==='service-evaluation'?'請依下列資料產生服務評估摘要：':`請潤飾以下 ISP「${section||'現況能力摘要'}」內容，務必實質改寫並直接給可使用結果：`;
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':KEY},
      signal:c.signal,
      body:JSON.stringify({
        systemInstruction:{parts:[{text:instruction}]},
        contents:[{role:'user',parts:[{text:`${task}\n\n${text}`}]}],
        generationConfig:{temperature:mode==='summary'?0.3:0.2,topP:0.8,maxOutputTokens:mode==='summary'?600:1000}
      })
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(data?.error?.message||`Gemini API error ${r.status}`);e.status=r.status;throw e;}
    const out=clean(data?.candidates?.[0]?.content?.parts?.map(x=>x?.text||'').join(''));
    if(!out)throw new Error('AI 未回傳可用文字');
    return out;
  }finally{clearTimeout(timer);}
}

function isRetryable(error){
  return error?.name==='AbortError'||[429,500,502,503,504].includes(error?.status);
}

async function callWithFallback(text,mode,section){
  const attempts=[];
  let lastError=null;
  for(let i=0;i<MODELS.length;i++){
    const model=MODELS[i];
    try{
      const out=await callGemini(text,mode,section,model,i===0?10000:12000);
      return {text:out,model,attempts};
    }catch(error){
      lastError=error;
      attempts.push({model,status:error?.status||0,message:String(error?.message||'').slice(0,120)});
      if(!isRetryable(error))throw error;
      if(i<MODELS.length-1)await sleep(250);
    }
  }
  const e=lastError||new Error('AI 服務暫時無法使用');
  e.attempts=attempts;
  throw e;
}

async function handle(body){
  const text=String(body?.text||'').trim();
  const mode=['summary','needs-assessment','service-evaluation'].includes(body?.mode)?body.mode:'summary';
  const section=String(body?.section||'').trim();
  if(!text)return [400,{success:false,error:'內容不可空白'}];
  if(text.length>6000)return [400,{success:false,error:'內容過長，目前上限為 6000 字'}];
  try{
    const result=await callWithFallback(text,mode,section);
    return [200,{success:true,polished:result.text,model:result.model}];
  }catch(e){
    const m=String(e?.message||'').toLowerCase();
    if(m.includes('location is not supported')||m.includes('user location'))return [502,{success:false,error:'AI 服務目前受到地區限制，請稍後再試；原始內容不會遺失。'}];
    if(e?.status===429)return [429,{success:false,error:'AI 目前使用量較高，系統已自動嘗試其他模型；請稍後再試，原始內容不會遺失。'}];
    if(e?.status===503||m.includes('high demand')||m.includes('unavailable'))return [503,{success:false,error:'Google AI 目前忙碌，系統已自動切換備援模型但仍無法完成；請稍後再試，原始內容不會遺失。'}];
    if(e?.name==='AbortError')return [504,{success:false,error:'AI 多模型嘗試皆逾時，請稍後再試；原始內容不會遺失。'}];
    return [502,{success:false,error:e?.message||'AI 服務暫時無法使用，請稍後再試；原始內容不會遺失。'}];
  }
}

http.createServer((req,res)=>{
  const origin=req.headers.origin||'';
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='OPTIONS'){
    if(!allowed(origin))return send(res,403,{success:false,error:'不允許的網站來源'},origin);
    res.writeHead(204,headers(origin));return res.end();
  }
  if(req.method==='GET'&&url.pathname==='/')return send(res,200,{success:true,service:'MUST ISP AI Cloud Run',version:'1.0.5',region:'asia-east1',route:'POST /ai/isp-summary',models:MODELS},origin);
  if(req.method!=='POST'||url.pathname!=='/ai/isp-summary')return send(res,404,{success:false,error:'找不到此 API 路徑'},origin);
  if(!allowed(origin))return send(res,403,{success:false,error:'不允許的網站來源'},origin);
  if(!KEY)return send(res,500,{success:false,error:'尚未設定 GEMINI_API_KEY'},origin);
  let raw='';
  req.on('data',x=>raw+=x);
  req.on('end',async()=>{
    let body;try{body=JSON.parse(raw||'{}');}catch{return send(res,400,{success:false,error:'請求格式錯誤'},origin);}
    const [status,data]=await handle(body);send(res,status,data,origin);
  });
}).listen(PORT,()=>console.log(`MUST ISP AI Cloud Run listening on ${PORT}`));
