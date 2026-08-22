const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function extent(values){
  const nums=values.filter(Number.isFinite); if(!nums.length)return [0,1];
  let min=Math.min(...nums),max=Math.max(...nums); if(min===max){min-=1;max+=1;}
  const pad=(max-min)*.12; return [min-pad,max+pad];
}
function xPos(i,n,w,p){return n<=1?w/2:p+i*(w-2*p)/(n-1)}
function yPos(v,min,max,h,p){return h-p-(v-min)/(max-min)*(h-2*p)}

export function lineChart(series,{height=180,valueKey='value',avgKey=null,unit='',empty='Not enough data yet.'}={}){
  if(!series||series.length<2)return `<div class="alert">${esc(empty)}</div>`;
  const w=700,p=30,h=height, vals=series.flatMap(x=>[Number(x[valueKey]),avgKey?Number(x[avgKey]):NaN]);
  const [min,max]=extent(vals);
  const points=series.map((x,i)=>`${xPos(i,series.length,w,p)},${yPos(Number(x[valueKey]),min,max,h,p)}`).join(' ');
  const avg=avgKey?series.map((x,i)=>`${xPos(i,series.length,w,p)},${yPos(Number(x[avgKey]),min,max,h,p)}`).join(' '):'';
  const first=series[0],last=series.at(-1);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend chart">
    <line class="axis" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/>
    <line class="axis" x1="${p}" y1="${p}" x2="${p}" y2="${h-p}"/>
    <polyline class="line" points="${points}"/>${avgKey?`<polyline class="avg" points="${avg}"/>`:''}
    <text x="${p}" y="${h-6}">${esc(first.date)}</text><text x="${w-p}" y="${h-6}" text-anchor="end">${esc(last.date)}</text>
    <text x="${p+4}" y="${p+10}">${max.toFixed(1)}${esc(unit)}</text><text x="${p+4}" y="${h-p-5}">${min.toFixed(1)}${esc(unit)}</text>
  </svg>`;
}

export function barChart(series,{height=180,unit='',empty='Not enough data yet.'}={}){
  if(!series||!series.length)return `<div class="alert">${esc(empty)}</div>`;
  const w=700,p=30,h=height,max=Math.max(1,...series.map(x=>Number(x.value)||0));
  const gap=4, inner=w-2*p, bw=Math.max(3,(inner-gap*(series.length-1))/series.length);
  const bars=series.map((x,i)=>{const val=Number(x.value)||0,bh=(val/max)*(h-2*p),xx=p+i*(bw+gap),yy=h-p-bh;return `<rect class="bar-rect" x="${xx}" y="${yy}" width="${bw}" height="${bh}" rx="2"/>`;}).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Training load chart"><line class="axis" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/>${bars}<text x="${p}" y="${h-6}">${esc(series[0].date)}</text><text x="${w-p}" y="${h-6}" text-anchor="end">${esc(series.at(-1).date)}</text><text x="${p+4}" y="${p+10}">${Math.round(max)}${esc(unit)}</text></svg>`;
}
