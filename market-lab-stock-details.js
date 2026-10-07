/* Direct access to the same ticker detail tabs shown below the comparison chart. */
(()=>{
  const start=()=>{
    const host=document.getElementById('stock-detail-actions'),grid=document.getElementById('ddgrid');
    if(!host||!grid)return;
    const select=host.querySelector('select');
    const cards=()=>Array.from(grid.querySelectorAll('.ticker-card[data-id]'));
    function sync(){
      const list=cards(),previous=select.value;
      select.replaceChildren(...list.map(card=>{const o=document.createElement('option');o.value=card.dataset.id;o.textContent=card.querySelector('.nm').textContent;return o;}));
      if(list.some(c=>c.dataset.id===previous))select.value=previous;
      select.hidden=list.length<2;
      const card=list.find(c=>c.dataset.id===select.value);
      host.querySelectorAll('[data-open-detail]').forEach(b=>{
        const available=!!card?.querySelector('[data-cardtab="'+b.dataset.openDetail+'"]');
        b.disabled=!available;b.hidden=b.dataset.openDetail==='company'&&!available;
      });
    }
    select.onchange=sync;
    host.querySelectorAll('[data-open-detail]').forEach(b=>b.onclick=()=>{
      const card=cards().find(c=>c.dataset.id===select.value),tab=card?.querySelector('[data-cardtab="'+b.dataset.openDetail+'"]');
      if(!tab)return;
      tab.click();card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});tab.focus({preventScroll:true});
    });
    new MutationObserver(sync).observe(grid,{childList:true});sync();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
