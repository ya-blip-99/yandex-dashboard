const SHEET_ID="1GwmyHfJ5bYTpIScloetzE4dlQjtO5C5-VkRwFhoxY5c";
const DIRECT_URL="https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?tqx=out:csv&gid=1099101464";
const AMO_URL="https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?tqx=out:csv&gid=2000000004";

let direct=[],amo=[],spendChart=null,leadChart=null;
const $=id=>document.getElementById(id);
const rub=n=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(n||0);
const int=n=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(n||0);
const pct=n=>new Intl.NumberFormat("ru-RU",{style:"percent",minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const iso=d=>d.toISOString().slice(0,10);
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
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const t=await r.text();
  if(t.includes("<html")||t.includes("accounts.google"))throw Error("private");
  return csv(t);
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
    campaign:String(r[ix("Campaign Name")]||"").trim(),
    impressions:num(r[ix("Impressions")]),
    clicks:num(r[ix("Clicks")]),
    cost:num(r[ix("Cost")]),
    conversions:num(r[ix("Conversions")])
  })).filter(x=>x.date&&x.campaign);
}
function mapAmo(rows){
  if(!rows.length)return[];
  const h=rows[0],ix=n=>h.indexOf(n);
  return rows.slice(1).map(r=>({
    date:parseDate(r[ix("Date")]),
    account:String(r[ix("Account ID")]||"").trim(),
    campaign:String(r[ix("Campaign Name")]||"").trim(),
    qualified:num(r[ix("Qualified Leads")])
  })).filter(x=>x.date&&x.campaign);
}
function filter(src,a,b,acc,cam){
  return src.filter(x=>x.date>=a&&x.date<=b&&(acc==="ALL"||x.account===acc)&&(cam==="ALL"||x.campaign===cam));
}
function sum(rows,qrows){
  const s=rows.reduce((a,x)=>({cost:a.cost+x.cost,conv:a.conv+x.conversions,clicks:a.clicks+x.clicks,imp:a.imp+x.impressions}),{cost:0,conv:0,clicks:0,imp:0});
  s.qual=qrows.reduce((a,x)=>a+x.qualified,0);s.cpa=s.conv?s.cost/s.conv:0;s.ctr=s.imp?s.clicks/s.imp:0;return s;
}
function comparison(a,b,invert=false){
  if(!b)return["Сравнение недоступно",""];
  const d=(a-b)/Math.abs(b),good=invert?d<=0:d>=0;
  return[(d>=0?"+":"")+new Intl.NumberFormat("ru-RU",{style:"percent",minimumFractionDigits:1,maximumFractionDigits:1}).format(d)+" к периоду B",good?"up":"down"];
}
function setDelta(id,a,b,invert=false){const [t,c]=comparison(a,b,invert),e=$(id);e.textContent=t;e.className=c}
function range(){
  return {
    a:new Date($("fromA").value+"T00:00:00"),b:new Date($("toA").value+"T23:59:59"),
    c:new Date($("fromB").value+"T00:00:00"),d:new Date($("toB").value+"T23:59:59")
  };
}
function populateAccounts(){
  const x=[...new Set(direct.map(r=>r.account))].sort();
  $("account").innerHTML='<option value="ALL">Все кабинеты</option>'+x.map(v=>'<option value="'+v+'">'+v+'</option>').join("");
}
function populateCampaigns(){
  const acc=$("account").value||"ALL";
  const old=$("campaign").value;
  const x=[...new Set(direct.filter(r=>acc==="ALL"||r.account===acc).map(r=>r.campaign))].sort((a,b)=>a.localeCompare(b,"ru"));
  $("campaign").innerHTML='<option value="ALL">Все РК</option>'+x.map(v=>'<option value="'+escape(v)+'">'+escape(v)+'</option>').join("");
  $("campaign").value=x.includes(old)?old:"ALL";
}
function defaults(){
  const ds=direct.map(x=>x.date).sort((a,b)=>a-b),max=ds.at(-1),min=ds[0];if(!max)return;
  const a=new Date(max);a.setDate(a.getDate()-29);
  const d=new Date(a);d.setDate(d.getDate()-1);
  const c=new Date(d);c.setDate(c.getDate()-29);
  $("fromA").value=iso(a<min?min:a);$("toA").value=iso(max);
  $("fromB").value=iso(c<min?min:c);$("toB").value=iso(d<min?min:d);
}
function bucket(d,mode){return mode==="month"?d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"):iso(d)}
function points(rows,qrows,mode){
  const m=new Map;
  rows.forEach(x=>{const k=bucket(x.date,mode),v=m.get(k)||{cost:0,conv:0,qual:0};v.cost+=x.cost;v.conv+=x.conversions;m.set(k,v)});
  qrows.forEach(x=>{const k=bucket(x.date,mode),v=m.get(k)||{cost:0,conv:0,qual:0};v.qual+=x.qualified;m.set(k,v)});
  return [...m].sort((a,b)=>a[0].localeCompare(b[0]));
}
function chart(old,id,type,labels,datasets){
  if(old)old.destroy();
  return new Chart($(id),{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#9aa8b9"}}},scales:{x:{ticks:{color:"#7f8b9b"},grid:{color:"#182433"}},y:{ticks:{color:"#7f8b9b"},grid:{color:"#182433"}}}}});
}
function render(){
  const r=range(),acc=$("account").value,cam=$("campaign").value,mode=$("aggregation").value;
  const A=filter(direct,r.a,r.b,acc,cam),B=filter(direct,r.c,r.d,acc,cam);
  const QA=filter(amo,r.a,r.b,acc,cam),QB=filter(amo,r.c,r.d,acc,cam);
  const a=sum(A,QA),b=sum(B,QB);
  $("spend").textContent=rub(a.cost);$("conversions").textContent=int(a.conv);$("qualified").textContent=int(a.qual);$("cpa").textContent=rub(a.cpa);$("ctr").textContent=pct(a.ctr);
  setDelta("spendDelta",a.cost,b.cost);setDelta("conversionsDelta",a.conv,b.conv);setDelta("qualifiedDelta",a.qual,b.qual);setDelta("cpaDelta",a.cpa,b.cpa,true);setDelta("ctrDelta",a.ctr,b.ctr);
  const p=points(A,QA,mode),labels=p.map(x=>x[0]);
  spendChart=chart(spendChart,"spendChart","bar",labels,[{label:"Расход",data:p.map(x=>x[1].cost),backgroundColor:"rgba(59,130,246,.60)",borderColor:"#60a5fa",borderWidth:1}]);
  leadChart=chart(leadChart,"leadChart","line",labels,[{label:"Конверсии",data:p.map(x=>x[1].conv),borderColor:"#60a5fa",backgroundColor:"#60a5fa",tension:.3},{label:"Квал-лиды",data:p.map(x=>x[1].qual),borderColor:"#31d17c",backgroundColor:"#31d17c",tension:.3}]);
  const m=new Map;
  A.forEach(x=>{const v=m.get(x.campaign)||{cost:0,conv:0,clicks:0,imp:0,qual:0};v.cost+=x.cost;v.conv+=x.conversions;v.clicks+=x.clicks;v.imp+=x.impressions;m.set(x.campaign,v)});
  QA.forEach(x=>{const v=m.get(x.campaign)||{cost:0,conv:0,clicks:0,imp:0,qual:0};v.qual+=x.qualified;m.set(x.campaign,v)});
  $("campaignRows").innerHTML=[...m].sort((a,b)=>b[1].cost-a[1].cost).map(([n,v])=>'<tr><td>'+escape(n)+'</td><td>'+rub(v.cost)+'</td><td>'+int(v.conv)+'</td><td>'+int(v.qual)+'</td><td>'+rub(v.conv?v.cost/v.conv:0)+'</td><td>'+pct(v.imp?v.clicks/v.imp:0)+'</td></tr>').join("")||'<tr><td colspan="6">Нет данных</td></tr>';
}
function escape(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function init(){
  try{
    const d=await load(DIRECT_URL);direct=mapDirect(d);
    try{amo=mapAmo(await load(AMO_URL))}catch{amo=[]}
    populateAccounts();populateCampaigns();defaults();render();
    $("status").textContent="Данные загружены · "+int(direct.length)+" строк";
  }catch(e){
    console.error(e);$("status").textContent="Нужно открыть Google Sheets для чтения";$("setup").classList.remove("hidden");
  }
}
$("account").addEventListener("change",populateCampaigns);
$("apply").addEventListener("click",render);
$("reset").addEventListener("click",()=>{populateAccounts();populateCampaigns();defaults();render()});
init();