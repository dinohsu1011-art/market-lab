(function(global){
  "use strict";
  const NS="http://www.w3.org/2000/svg";
  const el=(name,attrs,text)=>{const n=document.createElementNS(NS,name);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));if(text!=null)n.textContent=text;return n;};
  const extent=values=>{let lo=Math.min(...values),hi=Math.max(...values);if(lo===hi){lo-=1;hi+=1;}const pad=(hi-lo)*.08;return[lo-pad,hi+pad];};
  function chart(container,series,options={}){
    container.innerHTML="";
    const dual=series.some(s=>s.axis==='right');
    const width=Math.max(280,container.clientWidth||900),height=options.height||340,m={top:24,right:dual?64:22,bottom:38,left:58};
    const svg=el("svg",{viewBox:`0 0 ${width} ${height}`,role:"img","aria-label":options.label||"Macro time series"});
    svg.style.width="100%";svg.style.height="auto";container.appendChild(svg);
    const all=series.flatMap(s=>s.points||[]), dates=all.map(p=>Date.parse(p.date)), vals=all.map(p=>p.value).filter(Number.isFinite);
    if(!dates.length||!vals.length){svg.appendChild(el("text",{x:width/2,y:height/2,"text-anchor":"middle",fill:"#78716c"},"No accepted observations for this selection"));return svg;}
    const primary=series.filter(s=>s.axis!=='right').flatMap(s=>s.points.map(p=>p.value)).filter(Number.isFinite);
    const secondary=series.filter(s=>s.axis==='right').flatMap(s=>s.points.map(p=>p.value)).filter(Number.isFinite);
    const x0=Math.min(...dates),x1=Math.max(...dates),[y0,y1]=options.domain||extent(primary.length?primary:vals),x=d=>m.left+(Date.parse(d)-x0)/(x1-x0||1)*(width-m.left-m.right),y=v=>m.top+(y1-v)/(y1-y0)*(height-m.top-m.bottom);
    const [r0,r1]=secondary.length?extent(secondary):[0,1],ry=v=>m.top+(r1-v)/(r1-r0)*(height-m.top-m.bottom);
    for(let i=0;i<5;i++){const v=y0+(y1-y0)*i/4,yy=y(v);svg.appendChild(el("line",{x1:m.left,x2:width-m.right,y1:yy,y2:yy,stroke:"#e7e5e4"}));svg.appendChild(el("text",{x:m.left-9,y:yy+4,"text-anchor":"end",fill:"#78716c","font-size":"11"},options.format?options.format(v):v.toFixed(1)));}
    if(dual&&secondary.length)for(let i=0;i<5;i++){const v=r0+(r1-r0)*i/4;svg.appendChild(el('text',{x:width-m.right+8,y:ry(v)+4,fill:options.rightColor||'#78716c','font-size':'11'},options.rightFormat?options.rightFormat(v):v.toFixed(0)));}
    const tickCount=width<480?3:5;
    for(let i=0;i<tickCount;i++){const d=new Date(x0+(x1-x0)*i/(tickCount-1)),xx=x(d);svg.appendChild(el("text",{x:xx,y:height-12,"text-anchor":i===0?"start":i===tickCount-1?"end":"middle",fill:"#78716c","font-size":"11"},d.toLocaleDateString(undefined,{year:"numeric",month:"short"})));}
    const colors=["#1d7fc4","#d97706","#059669","#7c3aed"];
    series.forEach((s,idx)=>{
      const Y=s.axis==='right'?ry:y;
      const color=s.color||colors[idx%colors.length],segments=[];let segment=[];
      for(const p of s.points){
        if(Number.isFinite(p.value)){segment.push(p);}
        else if(segment.length){segments.push(segment);segment=[];}
      }
      if(segment.length)segments.push(segment);
      for(const pts of segments){
        const d=pts.map((p,i)=>(i?'L':'M')+x(p.date).toFixed(1)+','+Y(p.value).toFixed(1)).join('');
        if(options.area&&s.axis!=='right')svg.appendChild(el('path',{d:d+`L${x(pts.at(-1).date)},${y(y0)}L${x(pts[0].date)},${y(y0)}Z`,fill:color,'fill-opacity':'.09',stroke:'none'}));
        svg.appendChild(el('path',{d,fill:'none',stroke:color,'stroke-width':'1.7','stroke-linejoin':'round','stroke-linecap':'round'}));
        if(pts.length<180&&!options.area)pts.forEach(p=>svg.appendChild(el('circle',{cx:x(p.date),cy:Y(p.value),r:2.1,fill:color})));
      }
      const last=segments.at(-1)?.at(-1);
      if(last&&!options.hideEndLabels){const lx=x(last.date),right=lx>width-m.right-120;svg.appendChild(el('text',{x:right?lx-7:lx+7,y:Y(last.value)-5,'text-anchor':right?'end':'start',fill:color,'font-size':'11','font-weight':'600'},s.title));}
    });
    const cursor=el("line",{y1:m.top,y2:height-m.bottom,stroke:"#78716c","stroke-dasharray":"3 3",visibility:"hidden"});svg.appendChild(cursor);
    const hit=el("rect",{x:m.left,y:m.top,width:width-m.left-m.right,height:height-m.top-m.bottom,fill:"transparent",tabindex:"0"});svg.appendChild(hit);
    hit.addEventListener("mousemove",event=>{const box=svg.getBoundingClientRect(),mx=(event.clientX-box.left)*width/box.width,at=x0+(mx-m.left)/(width-m.left-m.right)*(x1-x0),rows=[];series.forEach(s=>{const candidates=s.points.filter(p=>Date.parse(p.date)<=at);const p=candidates[candidates.length-1];if(p)rows.push({title:s.title,date:p.date,value:p.value,color:s.color});});if(!rows.length)return;const px=x(rows[0].date);cursor.setAttribute("x1",px);cursor.setAttribute("x2",px);cursor.setAttribute("visibility","visible");options.onCursor&&options.onCursor(rows,event);});
    hit.addEventListener("mouseleave",()=>{cursor.setAttribute("visibility","hidden");options.onCursor&&options.onCursor(null);});
    return svg;
  }
  function png(svg,filename,footer){
    const palette=MarketLab.colors(),styled=MarketLab.styledSVG(svg);
    const xml=new XMLSerializer().serializeToString(styled),img=new Image();
    const url=URL.createObjectURL(new Blob([xml],{type:"image/svg+xml"}));
    img.onload=()=>{
      const box=svg.viewBox.baseVal,canvas=document.createElement("canvas");
      canvas.width=box.width*2;canvas.height=(box.height+40)*2;
      const ctx=canvas.getContext("2d");ctx.scale(2,2);
      ctx.fillStyle=palette.bg;ctx.fillRect(0,0,box.width,box.height+40);
      ctx.drawImage(img,0,0,box.width,box.height);
      ctx.fillStyle=palette.muted;ctx.font="10px system-ui";
      let caption=footer||"";
      while(ctx.measureText(caption).width>box.width-32)caption=caption.slice(0,-2);
      ctx.fillText(caption,16,box.height+25);
      canvas.toBlob(out=>{if(!out)return;const a=document.createElement("a");a.href=URL.createObjectURL(out);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
      URL.revokeObjectURL(url);
    };
    img.onerror=()=>URL.revokeObjectURL(url);img.src=url;
  }
  global.MarketLabChart={chart,png};
})(window);
