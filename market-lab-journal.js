(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let books=[],loading=null,openDraft=null;
  const sameDay=(a,b)=>Math.abs((new Date(a)-new Date(b))/864e5)<=3;
  function outcome(e){
    const hits=[];
    for(const b of books){
      if(e.book&&b.book!==e.book)continue;
      for(const t of e.tickers||[]){
        const inst=(b.instances||[]).find(i=>i.ticker.toUpperCase()===String(t).toUpperCase()&&sameDay(i.entry,e.date));
        if(inst)hits.push(`${esc(inst.ticker)} ${inst.ret>0?'+':''}${inst.ret}%${inst.exit?' · exited':' · open'}`);
      }
    }
    return hits.length?`<p class="note">Outcome: ${hits.join(' · ')}</p>`:'';
  }
  function form(e){
    e=e||{};
    return `<form data-jform="${esc(e.id||'')}"><label>Date <input type="date" name="date" value="${esc(e.date||new Date().toISOString().slice(0,10))}" required></label> `+
      `<label>Book <select name="book"><option value="">—</option><option value="mycoverage"${e.book==='mycoverage'?' selected':''}>Mine</option><option value="fredcoverage"${e.book==='fredcoverage'?' selected':''}>Fred</option></select></label> `+
      `<label>Type <select name="kind"><option value="note"${e.kind!=='swap'?' selected':''}>Note</option><option value="swap"${e.kind==='swap'?' selected':''}>Swap</option></select></label><br>`+
      `<label>Tickers <input name="tickers" placeholder="MSFT, ORCL" value="${esc((e.tickers||[]).join(', '))}"></label><br>`+
      `<label>What you believed<br><textarea name="thesis" rows="3" required>${esc(e.thesis||'')}</textarea></label><br>`+
      `<button type="submit">Save</button> <button type="button" data-jcancel>Cancel</button></form>`;
  }
  function card(e){
    const tag=[e.book==='mycoverage'?'Mine':e.book==='fredcoverage'?'Fred':'',e.kind==='swap'?'swap':'note'].filter(Boolean).join(' · ');
    return `<article data-jentry="${esc(e.id)}"><p><b>${esc(e.date)}</b> <span class="note">${esc(tag)} · ${(e.tickers||[]).map(esc).join(', ')}</span></p>`+
      `<p>${esc(e.thesis)}</p>${outcome(e)}`+
      `<p><button type="button" data-jedit="${esc(e.id)}">Edit</button> <button type="button" data-jdel="${esc(e.id)}">Delete</button></p></article>`;
  }
  async function load(){
    const host=document.getElementById('journal');if(!host)return;
    const body=host.querySelector('.body');
    let entries=null;
    try{
      const r=await fetch('/api/journal',{cache:'no-store'});
      if(r.status===401){body.innerHTML=`<p class="note">Sign in to keep a journal.</p>`;return;}
      if(!r.ok)throw Error();
      entries=(await r.json()).entries||[];
    }catch(e){body.innerHTML=`<p class="note">Journal unavailable.</p>`;return;}
    const paint=()=>{
      body.innerHTML=`<p><button type="button" data-jadd>Add entry</button></p><div data-jform-host></div>`+
        (entries.length?entries.map(card).join(''):`<p class="note">No entries yet.</p>`);
    };
    paint();
    openDraft=e=>{
      const current=body.querySelector('[data-jform]');
      if(current?.elements.thesis.value&&!confirm('Replace the unsaved journal draft?'))return;
      host.open=true;
      body.querySelector('[data-jform-host]').innerHTML=form(e);
      body.querySelector('[data-jform-host] textarea').focus();
      host.scrollIntoView({behavior:'smooth',block:'nearest'});
    };
    body.onclick=async ev=>{
      const t=ev.target;
      if(t.hasAttribute('data-jadd')){body.querySelector('[data-jform-host]').innerHTML=form();return;}
      if(t.hasAttribute('data-jcancel')){paint();return;}
      const edit=t.getAttribute('data-jedit'),del=t.getAttribute('data-jdel');
      if(edit){const e=entries.find(x=>x.id===edit);const art=body.querySelector(`[data-jentry="${edit}"]`);if(e&&art)art.innerHTML=form(e);return;}
      if(del){if(!confirm('Delete this entry?'))return;
        try{const r=await fetch('/api/journal/'+encodeURIComponent(del),{method:'DELETE'});
          if(!r.ok)throw Error();entries=entries.filter(x=>x.id!==del);paint();}
        catch(_){alert('Could not delete. Your entry is still saved.');}return;}
    };
    body.onsubmit=async ev=>{
      ev.preventDefault();
      const f=ev.target;if(!f.hasAttribute('data-jform'))return;
      const id=f.getAttribute('data-jform');
      const payload={date:f.date.value,book:f.book.value,kind:f.kind.value,
        tickers:f.tickers.value.split(',').map(s=>s.trim()).filter(Boolean),thesis:f.thesis.value};
      let r;try{r=await fetch(id?'/api/journal/'+encodeURIComponent(id):'/api/journal',
        {method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      }catch(_){alert('Could not save. Your draft is still here.');return;}
      if(!r.ok){const err=await r.json().catch(()=>({}));alert(err.error||'Could not save.');return;}
      const saved=(await r.json()).entry;
      const i=entries.findIndex(x=>x.id===saved.id);
      if(i>=0)entries[i]=saved;else entries.unshift(saved);
      entries.sort((a,b)=>a.date<b.date?1:-1);
      paint();
    };
  }
  window.MarketLabJournal={init(bk){books=bk||[];openDraft=null;loading=load();},async openDraft(e){await loading;
    if(openDraft)openDraft(e);else{const host=document.getElementById('journal');host.open=true;host.scrollIntoView({behavior:'smooth'});}}};
})();
