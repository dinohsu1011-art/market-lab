/* Same-origin private Sites APIs. Durable data never falls back to browser storage. */
(() => {
  const url = 'https://dino-theme-returns.dino-hsu1011.chatgpt.site';
  const state = {baskets:[], favorites:[], available:false, favoritesAvailable:false,
    loading:true, signInRequired:false, error:'', favoritesError:''};
  let inFlight=null, favoriteGeneration=0, basketGeneration=0;
  // Off the cloud workspace (GitHub Pages, local preview) baskets come from
  // my-baskets.json, which Claude edits in the repo, and favorites stay in
  // this browser. Nothing can be written back to the file from the page.
  const STATIC = window.location.hostname !== new URL(url).hostname;
  const FAV_KEY = 'market-lab.favorites';
  function readFavorites(){ try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (_) { return []; } }
  async function staticRequest(path, options={}){
    const method=(options.method||'GET').toUpperCase();
    if (path==='baskets' && method==='GET'){
      const response=await fetch('my-baskets.json',{cache:'no-store'});
      if(!response.ok)throw Error('Basket file missing.');
      return {baskets:(await response.json()).baskets||[]};
    }
    if (path==='favorites' && method==='GET') return {favorites:readFavorites()};
    if (path==='favorites' && method==='PUT'){
      const {scope,itemId,enabled}=JSON.parse(options.body);
      const next=readFavorites().filter(f=>!(f.scope===scope && f.item_id===itemId));
      if(enabled)next.push({scope,item_id:itemId});
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch (_) {}
      return {favorites:next};
    }
    throw Error('Baskets on this site are read-only. Ask Claude to add, edit or delete them.');
  }
  async function request(path, options={}){
    if (STATIC) return staticRequest(path, options);
    const response = await fetch('/api/'+path, {credentials:'same-origin', cache:'no-store',
      signal:AbortSignal.timeout(15000), ...options, headers:{'Content-Type':'application/json', ...options.headers}});
    let body; try { body = await response.json(); } catch (_) {}
    if (!response.ok) { const error = new Error(body?.error || (response.status===404
      ? 'Cloud sync is available in the private cloud workspace, not this local preview.'
      : 'Cloud sync unavailable. Please sign in or retry.'));
      error.status=response.status; throw error; }
    return body;
  }
  const changed = () => window.dispatchEvent(new Event('ml:cloudchange'));
  function refresh(){
    if(inFlight)return inFlight;
    state.loading=true;
    const favoriteVersion=favoriteGeneration;
    const basketVersion=basketGeneration;
    const baskets=request('baskets').then(body=>{
      if(basketVersion!==basketGeneration)return;
      if(!Array.isArray(body?.baskets))throw Error('Invalid basket response.');
      state.baskets=body.baskets;state.available=true;state.error='';state.signInRequired=false;
    }).catch(error=>{
      if(basketVersion!==basketGeneration)return;
      state.available=false;state.signInRequired=error.status===401;
      state.error=error.name==='TimeoutError'?'Basket request timed out. Please retry.':error.message;
      if(state.signInRequired)state.baskets=[];
    }).finally(()=>{state.loading=false;changed();});
    const favorites=request('favorites').then(body=>{
      if(favoriteVersion!==favoriteGeneration)return;
      if(!Array.isArray(body?.favorites))throw Error('Invalid favorites response.');
      state.favorites=body.favorites;state.favoritesAvailable=true;state.favoritesError='';
    }).catch(error=>{
      if(favoriteVersion!==favoriteGeneration)return;
      state.favoritesAvailable=false;state.favoritesError=error.message;
      if(error.status===401)state.favorites=[];
    }).finally(changed);
    inFlight=Promise.all([baskets,favorites]).then(()=>state).finally(()=>{inFlight=null;});
    return inFlight;
  }
  function basketNotice(){
    if(state.available)return STATIC
      ? '<p class="ml-search-message">My baskets · Ask Claude to add one.</p>'
      : '<p class="ml-search-message">My baskets · Save a chart to create one.</p>';
    if(window.location.hostname!==new URL(url).hostname)
      return `<a class="ml-cloud-entry" href="${url}/market-lab-themes.html" target="_top">My baskets <span>Open cloud Charts ↗</span></a>`;
    if(state.signInRequired)
      return '<a class="ml-cloud-entry" href="/signin-with-chatgpt?return_to=%2Fmarket-lab-themes.html" target="_top">Sign in to load baskets</a>';
    return `<p class="ml-search-message">${state.loading?'Loading baskets…':'Baskets unavailable'} <button type="button" data-cloud-retry ${state.loading?'disabled':''}>Retry</button></p>`;
  }
  const favorite = (scope,id) => state.favorites.some(f=>f.scope===scope && f.item_id===id);
  async function deleteBasket(id){
    ++basketGeneration;
    await request('baskets/'+encodeURIComponent(id),{method:'DELETE'});
    ++basketGeneration;
    state.baskets=state.baskets.filter(b=>b.id!==id);
    changed();
  }
  async function setFavorite(scope,id,enabled){
    ++favoriteGeneration;
    await request('favorites',{method:'PUT',body:JSON.stringify({scope,itemId:id,enabled})});
    ++favoriteGeneration;
    state.favorites=state.favorites.filter(f=>!(f.scope===scope && f.item_id===id));
    if(enabled)state.favorites.push({scope,item_id:id}); changed();
  }
  window.MarketLabCloud={url,static:STATIC,state,request,refresh,favorite,setFavorite,deleteBasket,basketNotice,ready:refresh()};
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-cloud-retry]');
    if(button){button.disabled=true;refresh();}
  });
  // Reconcile another machine's edits when this tab becomes active again.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
