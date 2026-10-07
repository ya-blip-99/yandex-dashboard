const SHEET_ID="1GwmyHfJ5bYTpIScloetzE4dlQjtO5C5-VkRwFhoxY5c";
const DIRECT_URL="https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?tqx=out:csv&gid=1099101464";
const AMO_URL="https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?tqx=out:csv&gid=2000000004";

let direct=[],amo=[],spendChart=null,leadChart=null,tableMode="all";
const $=id=>document.getElementById(id);
const rub=n=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(n||0);
const int=n=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(n||0);
const pct=n=>new Intl.NumberFormat("ru-RU",{style:"percent",minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day};
const num=v=>Number(String(v??"").replace(/\s/g,"").replace(",",".").replace(/[^\d.-]/g,""))||0;

function csv(text){
  const rows=[];let row=[],cell="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c=='"'&&q&&n=='"'){cell+='"';i++;continue}
    if(c=='"'){q=!q;continue}
    if(c==","&&!q){row.push(cell);cell="";continue}
    if((c=="\n"||c=="\r")&&!q){
      if(c=="\r"&&n=="\n")i++;
      row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";continue
    }
    cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows;
}
async function load(url){
  const r=await fetch(url+"&_="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const t=await r.text();
  if(!t||t.includes("<html")||t.includes("accounts.google"))throw Error("Google Sheets returned HTML");
  const rows=csv(t);
  if(!rows.length)throw Error("Пустой CSV");
  return rows;
}
function parseDate(s){
  const d=new Date(s);if(!isNaN(d))return new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const m=String(s).match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  return m?new Date(+m[3],+m[2]-1,+m[1]):null;
}
function mapDirect(rows){
  const h=rows[0]||[],ix=n=>h.indexOf(n);
  return rows.slice(1).map(r=>({
    account:String(r[ix("Account ID")]||"").trim(),
    date:parseDate(r[ix("Day")]),
    campaignId:String(r[ix("Campaign ID")]||"").trim(),
    campaignName:String(r[ix("Campaign Name")]||"").trim(),
    impressions:num(r[ix("Impressions")]),
    clicks:num(r[ix("Clicks")]),
    cost:num(r[ix("Cost")]),
    conversions:num(r[ix("Conversions")])
  })).filter(x=>x.date&&x.campaignId);
}
function mapAmo(rows){
  if(!rows.length)return[];
  const h=rows[0],ix=n=>h.indexOf(n),hasCampaignId=ix("Campaign ID")>=0;
  return rows.slice(1).map(r=>({
    date:parseDate(r[ix("Date")]),
    account:String(r[ix("Account ID")]||"").trim(),
    campaignId:String(r[hasCampaignId?ix("Campaign ID"):ix("Campaign Name")]||"").trim(),
    qualified:num(r[ix("Qualified Leads")])
  })).filter(x=>x.date&&x.campaignId);
}
function filter(src,a,b,acc,cam){
  return src.filter(x=>x.date>=a&&x.date<=b&&(acc==="ALL"||x.account===acc)&&(cam==="ALL"||x.campaignId===cam));
}
function sum(rows,qrows){
  const s=rows.reduce((a,x)=>({cost:a.cost+x.cost,conv:a.conv+x.conversions,clicks:a.clicks+x.clicks,imp:a.imp+x.impressions}),{cost:0,conv:0,clicks:0,imp:0});
  s.qual=qrows.reduce((a,x)=>a+x.qualified,0);
  s.cpa=s.conv?s.cost/s.conv:0;
  s.cql=s.qual?s.cost/s.qual:0;
  s.ctr=s.imp?s.clicks/s.imp:0;
  s.cpc=s.clicks?s.cost/s.clicks:0;
  s.cr=s.clicks?s.conv/s.clicks:0;
  s.qualRate=s.conv?s.qual/s.conv:0;
  return s;
}
function comparison(a,b,invert=false){
  if(!b)return["Сравнение недоступно",""];
  const d=(a-b)/Math.abs(b),good=invert?d<=0:d>=0;
  return[(d>=0?"+":"")+new Intl.NumberFormat("ru-RU",{style:"percent",minimumFractionDigits:1,maximumFractionDigits:1}).format(d)+" к предыдущему периоду",good?"up":"down"];
}
function setDelta(id,a,b,invert=false){
  const e=$(id);if(!e)return;
  const [t,c]=comparison(a,b,invert);e.textContent=t;e.className=c;
}
function range(){
  const a=new Date($("fromA").value+"T00:00:00"),b=new Date($("toA").value+"T23:59:59");
  const days=Math.floor((b-a)/86400000)+1;
  const d=new Date(a);d.setMilliseconds(-1);
  const c=new Date(d);c.setDate(d.getDate()-days+1);c.setHours(0,0,0,0);
  return {a,b,c,d};
}
function populateAccounts(){
  const x=[...new Set(direct.map(r=>r.account))].sort();
  $("account").innerHTML='<option value="ALL">Все кабинеты</option>'+x.map(v=>'<option value="'+v+'">'+v+'</option>').join("");
}
function populateCampaigns(){
  const acc=$("account").value||"ALL",old=$("campaign").value;
  const x=[...new Set(direct.filter(r=>acc==="ALL"||r.account===acc).map(r=>r.campaignId))].sort((a,b)=>Number(a)-Number(b));
  $("campaign").innerHTML='<option value="ALL">Все РК</option>'+x.map(v=>'<option value="'+v+'">'+v+'</option>').join("");
  $("campaign").value=x.includes(old)?old:"ALL";
}
function defaults(){
  const ds=direct.map(x=>x.date).sort((a,b)=>a-b),max=ds.at(-1),min=ds[0];if(!max)return;
  const a=new Date(max);a.setDate(a.getDate()-29);
  $("fromA").value=iso(a<min?min:a);$("toA").value=iso(max);
  $("periodPreset").value="";
}
function startOfWeek(date){
  const d=new Date(date);d.setHours(0,0,0,0);
  const day=d.getDay(),diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);return d;
}
function setPeriodPreset(value){
  if(!value)return;
  const today=new Date();today.setHours(0,0,0,0);
  let from=new Date(today),to=new Date(today);
  if(value==="yesterday"){from.setDate(from.getDate()-1);to=new Date(from)}
  else if(value==="lastWeek"){const m=startOfWeek(today);to=new Date(m);to.setDate(to.getDate()-1);from=new Date(to);from.setDate(from.getDate()-6)}
  else if(value==="lastMonth"){from=new Date(today.getFullYear(),today.getMonth()-1,1);to=new Date(today.getFullYear(),today.getMonth(),0)}
  else if(value==="thisWeek"){from=startOfWeek(today)}
  else if(value==="thisMonth"){from=new Date(today.getFullYear(),today.getMonth(),1)}
  else if(value==="last7"){from.setDate(from.getDate()-6)}
  else if(value==="last30"){from.setDate(from.getDate()-29)}
  else if(value==="last90"){from.setDate(from.getDate()-89)}
  else if(value==="last365"){from.setDate(from.getDate()-364)}
  $("fromA").value=iso(from);$("toA").value=iso(to);render();
}
function points(rows,qrows){
  const m=new Map;
  rows.forEach(x=>{const k=iso(x.date),v=m.get(k)||{cost:0,conv:0,qual:0};v.cost+=x.cost;v.conv+=x.conversions;m.set(k,v)});
  qrows.forEach(x=>{const k=iso(x.date),v=m.get(k)||{cost:0,conv:0,qual:0};v.qual+=x.qualified;m.set(k,v)});
  return [...m].sort((a,b)=>a[0].localeCompare(b[0]));
}
function chart(old,id,type,labels,datasets){
  if(old)old.destroy();
  return new Chart($(id),{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#9aa8b9"}}},scales:{x:{ticks:{color:"#7f8b9b"},grid:{color:"#182433"}},y:{ticks:{color:"#7f8b9b"},grid:{color:"#182433"}}}}});
}

function targetKey(){return "yd-targets-"+($("account").value||"ALL")}
function loadTargets(){
  let t={};
  try{t=JSON.parse(localStorage.getItem(targetKey())||"{}")}catch{}
  $("targetCPA").value=t.cpa||"";
  $("targetCQL").value=t.cql||"";
  $("targetCR").value=t.cr||"";
  $("targetHint").textContent=$("account").value==="ALL"?"Для всех кабинетов":"Для кабинета "+$("account").value;
}
function saveTargets(){
  const t={cpa:num($("targetCPA").value),cql:num($("targetCQL").value),cr:num($("targetCR").value)};
  localStorage.setItem(targetKey(),JSON.stringify(t));
  render();
  const b=$("saveTargets");const old=b.textContent;b.textContent="Сохранено ✓";setTimeout(()=>b.textContent=old,1000);
}
function currentTargets(a){
  return {
    cpa:num($("targetCPA").value)||a.cpa||0,
    cql:num($("targetCQL").value)||a.cql||0,
    cr:(num($("targetCR").value)/100)||a.cr||0,
    customCPA:!!num($("targetCPA").value),
    customCQL:!!num($("targetCQL").value),
    customCR:!!num($("targetCR").value)
  };
}
function classifyCampaign(v,t){
  const issues=[];let severity=0;
  const spendThreshold=t.cpa||1000;

  if(v.cost>=spendThreshold&&v.conv===0){
    issues.push("расход "+rub(v.cost)+", конверсий 0");severity=2;
  }
  if(v.conv>0&&t.cpa>0&&v.cpa>t.cpa){
    const over=v.cpa/t.cpa-1;
    issues.push("CPA "+rub(v.cpa)+" при цели "+rub(t.cpa));
    severity=Math.max(severity,over>=0.2?2:1);
  }
  if(t.cr>0&&v.clicks>=30&&v.cr<t.cr){
    issues.push("CR "+pct(v.cr)+" при цели ≥ "+pct(t.cr));
    severity=Math.max(severity,1);
  }
  if(amo.length&&v.qual>0&&t.cql>0&&v.cql>t.cql){
    const over=v.cql/t.cql-1;
    issues.push("CQL "+rub(v.cql)+" при цели "+rub(t.cql));
    severity=Math.max(severity,over>=0.2?2:1);
  }
  return {issues,severity,status:severity===2?"🔴 Проблема":severity===1?"🟡 Проверить":"🟢 Норма"};
}

function render(){
  const r=range(),acc=$("account").value,cam=$("campaign").value;
  const A=filter(direct,r.a,r.b,acc,cam),B=filter(direct,r.c,r.d,acc,cam);
  const QA=filter(amo,r.a,r.b,acc,cam),QB=filter(amo,r.c,r.d,acc,cam);
  const a=sum(A,QA),b=sum(B,QB);
  const benchmarkA=filter(direct,r.a,r.b,acc,"ALL"),benchmarkQA=filter(amo,r.a,r.b,acc,"ALL");
  const benchmark=sum(benchmarkA,benchmarkQA),targets=currentTargets(benchmark);

  $("spend").textContent=rub(a.cost);
  $("conversions").textContent=int(a.conv);
  $("qualified").textContent=amo.length?int(a.qual):"—";
  $("cpa").textContent=rub(a.cpa);
  $("cql").textContent=amo.length&&a.qual?rub(a.cql):"—";
  $("qualRate").textContent=amo.length?pct(a.qualRate):"—";

  setDelta("spendDelta",a.cost,b.cost);
  setDelta("conversionsDelta",a.conv,b.conv);
  if(amo.length)setDelta("qualifiedDelta",a.qual,b.qual);else{$("qualifiedDelta").textContent="amoCRM не подключена";$("qualifiedDelta").className=""}
  setDelta("cpaDelta",a.cpa,b.cpa,true);
  if(amo.length)setDelta("qualRateDelta",a.qualRate,b.qualRate);else{$("qualRateDelta").textContent="amoCRM не подключена";$("qualRateDelta").className=""}
  if(amo.length&&a.qual&&b.qual)setDelta("cqlDelta",a.cql,b.cql,true);else{$("cqlDelta").textContent=amo.length?"Сравнение недоступно":"amoCRM не подключена";$("cqlDelta").className=""}

  $("funnelClicks").textContent=int(a.clicks);
  $("funnelConversions").textContent=int(a.conv);
  $("funnelQualified").textContent=amo.length?int(a.qual):"—";
  $("funnelCr").textContent="CR "+pct(a.cr);
  $("funnelQualRate").textContent=amo.length?"Квалификация "+pct(a.qualRate):"amoCRM не подключена";

  const p=points(A,QA),labels=p.map(x=>x[0]);
  spendChart=chart(spendChart,"spendChart","bar",labels,[{label:"Расход",data:p.map(x=>x[1].cost),backgroundColor:"rgba(59,130,246,.60)",borderColor:"#60a5fa",borderWidth:1}]);
  const leadSets=[{label:"Конверсии",data:p.map(x=>x[1].conv),borderColor:"#60a5fa",backgroundColor:"#60a5fa",tension:.3}];
  if(amo.length)leadSets.push({label:"Квал-лиды",data:p.map(x=>x[1].qual),borderColor:"#31d17c",backgroundColor:"#31d17c",tension:.3});
  leadChart=chart(leadChart,"leadChart","line",labels,leadSets);

  const m=new Map;
  A.forEach(x=>{const v=m.get(x.campaignId)||{cost:0,conv:0,clicks:0,imp:0,qual:0};v.cost+=x.cost;v.conv+=x.conversions;v.clicks+=x.clicks;v.imp+=x.impressions;m.set(x.campaignId,v)});
  QA.forEach(x=>{const v=m.get(x.campaignId)||{cost:0,conv:0,clicks:0,imp:0,qual:0};v.qual+=x.qualified;m.set(x.campaignId,v)});

  let campaigns=[...m].map(([id,v])=>{
    v.ctr=v.imp?v.clicks/v.imp:0;
    v.cpc=v.clicks?v.cost/v.clicks:0;
    v.cr=v.clicks?v.conv/v.clicks:0;
    v.cpa=v.conv?v.cost/v.conv:0;
    v.cql=v.qual?v.cost/v.qual:0;
    v.qualRate=v.conv?v.qual/v.conv:0;
    const cls=classifyCampaign(v,targets);
    return {id,...v,...cls,problem:cls.severity>0};
  }).sort((x,y)=>y.cost-x.cost);

  const problemCampaigns=campaigns.filter(v=>v.problem);
  $("attentionCount").textContent=problemCampaigns.length;
  $("attentionList").innerHTML=problemCampaigns.length
    ? problemCampaigns.slice(0,6).map(v=>'<div class="attention-item '+(v.severity===2?'critical':'warning')+'"><strong>РК '+v.id+'</strong><span>'+v.issues.join(" · ")+'</span></div>').join("")
    : '<div class="attention-ok">Все кампании укладываются в заданные ориентиры.</div>';

  const visible=tableMode==="problems"?problemCampaigns:campaigns;
  $("campaignRows").innerHTML=visible.map(v=>
    '<tr class="'+(v.severity===2?'critical-row':v.severity===1?'warning-row':'')+'">'+
    '<td>'+v.id+'</td><td>'+rub(v.cost)+'</td><td>'+int(v.imp)+'</td><td>'+int(v.clicks)+'</td>'+
    '<td>'+pct(v.ctr)+'</td><td>'+rub(v.cpc)+'</td><td>'+int(v.conv)+'</td><td>'+pct(v.cr)+'</td>'+
    '<td>'+rub(v.cpa)+'</td><td>'+(amo.length?int(v.qual):"—")+'</td>'+
    '<td>'+(amo.length&&v.conv?pct(v.qualRate):"—")+'</td><td>'+(amo.length&&v.qual?rub(v.cql):"—")+'</td>'+
    '<td class="status-cell">'+v.status+'</td></tr>'
  ).join("")||'<tr><td colspan="13">Нет данных</td></tr>';
}

async function init(){
  try{
    const d=await load(DIRECT_URL);direct=mapDirect(d);
    try{
      const amoRaw=mapAmo(await load(AMO_URL));
      const knownCampaigns=new Set(direct.map(x=>x.campaignId));
      amo=amoRaw.filter(x=>knownCampaigns.has(x.campaignId));
      const unmatched=amoRaw.length-amo.length;
      if(unmatched)console.warn("Исключено несопоставленных amoCRM строк:",unmatched);
    }catch{amo=[]}
    populateAccounts();populateCampaigns();defaults();loadTargets();render();
    $("status").textContent="Данные загружены · "+int(direct.length)+" строк";
  }catch(e){
    console.error(e);
    $("status").textContent="Ошибка загрузки данных";
    $("setup").classList.remove("hidden");
    $("setup").querySelector("h2").textContent="Не удалось загрузить данные";
    $("setup").querySelector("p").innerHTML='Google Sheets временно не ответил. <button id="retryLoad" class="retry-btn">Повторить загрузку</button>';
    setTimeout(()=>{const b=$("retryLoad");if(b)b.onclick=()=>location.reload()},0);
  }
}
$("account").addEventListener("change",()=>{populateCampaigns();loadTargets();render()});
$("periodPreset").addEventListener("change",e=>setPeriodPreset(e.target.value));
$("fromA").addEventListener("change",()=>{$("periodPreset").value=""});
$("toA").addEventListener("change",()=>{$("periodPreset").value=""});
$("apply").addEventListener("click",render);
$("saveTargets").addEventListener("click",saveTargets);
$("reset").addEventListener("click",()=>{tableMode="all";populateAccounts();populateCampaigns();defaults();loadTargets();$("showAll").classList.add("active");$("showProblems").classList.remove("active");render()});
$("showAll").addEventListener("click",()=>{tableMode="all";$("showAll").classList.add("active");$("showProblems").classList.remove("active");render()});
$("showProblems").addEventListener("click",()=>{tableMode="problems";$("showProblems").classList.add("active");$("showAll").classList.remove("active");render()});
init();