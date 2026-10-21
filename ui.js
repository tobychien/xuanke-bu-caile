if (top !== self && /github\.io$/.test(location.hostname)) document.documentElement.style.display = "none"; // 防點擊劫持（meta CSP 無法設 frame-ancestors）
/* 僅負責視覺輔助：年級大按鈕、修課進度摘要、匯入狀態色點。不改動 app.js 的邏輯。 */
(function(){
  var $=function(s){return document.querySelector(s)};
  // 年級大按鈕：同步 #onGrade
  var sel=$('#onGrade'),seg=$('#onGradeSeg'),fld=$('#onGradeFld');
  if(sel&&seg){
    seg.innerHTML=[].map.call(sel.options,function(o){return '<button type="button" data-v="'+o.value+'" aria-pressed="false">'+o.text+'</button>'}).join('');
    seg.hidden=false;fld.classList.add('sr-only');
    var sync=function(){[].forEach.call(seg.children,function(b){var on=b.dataset.v===sel.value;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})};
    seg.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;sel.value=b.dataset.v;sel.dispatchEvent(new Event('change',{bubbles:true}));sync()});
    sel.addEventListener('change',sync);
    new MutationObserver(sync).observe($('#onb'),{attributes:true,attributeFilter:['hidden']});
    sync();
  }
  // 修課進度摘要
  var body=$('#recBody'),sum=$('#recSum');
  function upSum(){
    var all=body.querySelectorAll('input[data-done]');
    if(!all.length){sum.hidden=true;return}
    var n=0;[].forEach.call(all,function(c){if(c.checked)n++});
    var p=Math.round(n/all.length*100);
    sum.hidden=false;
    sum.innerHTML='<div class="rs-top"><span>已修進度</span><b>'+n+'<small> / '+all.length+' 門</small></b></div><div class="rs-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p+'"><i style="width:'+p+'%"></i></div><div class="rs-sub">勾選的課，排課時會自動跳過</div>';
  }
  new MutationObserver(upSum).observe(body,{childList:true});
  // 匯入預覽狀態
  var imp=$('#recImport');
  function upImp(){
    var rows=imp.querySelectorAll('.rk'),c={yes:0,unknown:0,no:0};
    [].forEach.call(rows,function(r){
      var t=(r.querySelector('small')||{}).textContent||'';
      var st=t.indexOf('未通過')>-1?'no':t.indexOf('無法判斷')>-1?'unknown':t.indexOf('已通過')>-1?'yes':'';
      if(st){r.dataset.st=st;c[st]++}
    });
    var box=imp.querySelector('.imp');
    if(box&&rows.length&&!box.querySelector('.imp-leg')){
      var d=document.createElement('div');d.className='imp-leg';
      d.innerHTML='<span data-st="yes">已通過 '+c.yes+'</span><span data-st="unknown">無法判斷 '+c.unknown+'</span><span data-st="no">未通過 '+c.no+'</span>';
      var h=box.querySelector('.hint');(h||box.firstChild).after(d);
    }
  }
  new MutationObserver(upImp).observe(imp,{childList:true});
  // 拖放
  var drop=$('.drop'),file=$('#recFile');
  ['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over')})});
  ['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over')})});
  drop.addEventListener('drop',function(e){var f=e.dataTransfer&&e.dataTransfer.files;if(f&&f.length){file.files=f;file.dispatchEvent(new Event('change',{bubbles:true}))}});
})();
