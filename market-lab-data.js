/* Supports ordinary local exports and losslessly compressed hosted histories. */
(()=>{
  async function json(url){
    const response=await fetch(url);
    if(!response.ok)throw Error('Price history could not be loaded. Please try again.');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes[0]===31&&bytes[1]===139){
      if(typeof DecompressionStream==='undefined')throw Error('Please update your browser to read the compressed price histories.');
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  window.MarketLabData={json};
})();
