(function(){
  'use strict';

  var POOL = window.HEADLINES || [];
  var DAILY_LEN = 8;
  var LIVES = 3;
  var EPOCH = new Date(2026, 9, 12); // Puzzle #001 = Oct 12, 2026 (local time)

  var app = document.getElementById('app');
  var streakEl = document.getElementById('streak');
  var mode = 'daily';
  var state = null;
  var keyHandler = null;

  // ---------- storage (always optional) ----------
  function get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function getNum(k){ return parseInt(get(k) || '0', 10) || 0; }
  function getJSON(k){ try{ return JSON.parse(get(k) || 'null'); }catch(e){ return null; } }

  // ---------- dates ----------
  function dayKey(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function today(){ return dayKey(new Date()); }
  function yesterday(){ var d = new Date(); d.setDate(d.getDate()-1); return dayKey(d); }
  function puzzleNo(){
    var n = new Date(); n.setHours(0,0,0,0);
    return Math.max(1, Math.round((n - EPOCH) / 86400000) + 1);
  }
  function pad(n){ return String(n).padStart(3,'0'); }

  // ---------- seeded shuffle ----------
  function hash(str){ var h = 2166136261; for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand){ var a = arr.slice(); for(var i=a.length-1;i>0;i--){ var j = Math.floor(rand()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

  function dailySet(){
    var rand = rng(hash('ror-'+puzzleNo()));
    var reals = shuffle(POOL.filter(function(x){return x.real;}), rand);
    var fakes = shuffle(POOL.filter(function(x){return !x.real;}), rand);
    var nReal = 3 + Math.floor(rand()*3); // 3-5 real ones, so you can't just count
    nReal = Math.min(nReal, reals.length, DAILY_LEN);
    return shuffle(reals.slice(0, nReal).concat(fakes.slice(0, DAILY_LEN - nReal)), rand);
  }

  // ---------- dom helpers ----------
  function el(tag, cls, text){ var n = document.createElement(tag); if(cls) n.className = cls; if(text != null) n.textContent = text; return n; }
  function clear(){ while(app.firstChild) app.removeChild(app.firstChild); }
  function onKey(fn){ if(keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = fn; if(fn) document.addEventListener('keydown', fn); }
  function showStreak(){ streakEl.textContent = getNum('ror-streak'); }

  // ---------- intro ----------
  function intro(){
    onKey(null); clear();
    var box = el('section','intro');
    box.appendChild(el('p',null,'Puzzle #'+pad(puzzleNo())));
    box.appendChild(el('h2',null,'Did this really happen in Florida?'));
    box.appendChild(el('p',null,'Some headlines are real news. Some were rendered for the game. Call it, then check the source.'));

    var tabs = el('div','tabs'); tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','Game mode');
    var tDaily = el('button','tab'); tDaily.type='button';
    tDaily.appendChild(el('b',null,'Daily')); tDaily.appendChild(el('span',null,DAILY_LEN+' headlines. Same for everyone today.'));
    var tEnd = el('button','tab'); tEnd.type='button';
    tEnd.appendChild(el('b',null,'Endless')); tEnd.appendChild(el('span',null,LIVES+' lives. How long can you last?'));
    tabs.appendChild(tDaily); tabs.appendChild(tEnd); box.appendChild(tabs);

    var go = el('button','next');
    function sync(){
      tDaily.setAttribute('aria-pressed', mode === 'daily');
      tEnd.setAttribute('aria-pressed', mode === 'endless');
      var done = getJSON('ror-daily-'+today());
      go.textContent = mode === 'daily' ? (done ? 'See today’s result' : 'Start today’s puzzle') : 'Start endless run';
    }
    tDaily.addEventListener('click', function(){ mode = 'daily'; sync(); });
    tEnd.addEventListener('click', function(){ mode = 'endless'; sync(); });
    go.addEventListener('click', start);
    sync();
    box.appendChild(go);
    app.appendChild(box);
    go.focus();
  }

  function start(){
    if(mode === 'daily'){
      var done = getJSON('ror-daily-'+today());
      var set_ = dailySet();
      if(done && done.answers && done.answers.length === set_.length){
        state = {mode:'daily', list:set_, i:set_.length, answers:done.answers, guesses:done.guesses || []};
        return finishDaily(true);
      }
      state = {mode:'daily', list:set_, i:0, answers:[], guesses:[]};
    } else {
      state = {mode:'endless', list:shuffle(POOL, Math.random), i:0, answers:[], guesses:[], lives:LIVES};
    }
    round();
  }

  // ---------- header bits ----------
  function progressBar(){
    var p = el('div','progress');
    p.style.setProperty('--n', state.list.length);
    p.setAttribute('aria-label','Headline '+(state.i+1)+' of '+state.list.length);
    for(var k=0;k<state.list.length;k++){
      var s = el('i');
      if(k < state.answers.length) s.className = state.answers[k] ? 'ok' : 'no';
      else if(k === state.i) s.className = 'now';
      p.appendChild(s);
    }
    return p;
  }
  function livesBar(){
    var row = el('div','progress-row');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-weight:700';
    row.appendChild(el('span',null,'Score: '+state.answers.filter(Boolean).length));
    var l = el('span','lives'); l.setAttribute('aria-label', state.lives+' lives left');
    for(var k=0;k<LIVES;k++){ l.appendChild(el('i', k < state.lives ? '' : 'lost')); }
    row.appendChild(l);
    return row;
  }
  function header(){ return state.mode === 'daily' ? progressBar() : livesBar(); }

  // ---------- one round ----------
  function round(){
    clear();
    if(state.mode === 'endless' && state.i >= state.list.length){
      // ran through the whole pool: reshuffle and keep going
      state.list = state.list.concat(shuffle(POOL, Math.random));
    }
    var r = state.list[state.i];
    var answered = false;
    app.appendChild(header());

    var clip = el('article','clip enter');
    var src = el('div','src');
    src.appendChild(el('span',null, state.mode === 'daily' ? 'Headline '+(state.i+1)+' of '+state.list.length : 'Headline '+(state.i+1)));
    src.appendChild(el('span',null,'Florida'));
    clip.appendChild(src);
    clip.appendChild(el('h2',null,r.h));
    app.appendChild(clip);

    var row = el('div','choices');
    var bReal = el('button','choice real'); bReal.type='button';
    bReal.appendChild(document.createTextNode('Real')); bReal.appendChild(el('small',null,'It made the news'));
    var bFake = el('button','choice fake'); bFake.type='button';
    bFake.appendChild(document.createTextNode('Rendered')); bFake.appendChild(el('small',null,'Made up'));
    row.appendChild(bReal); row.appendChild(bFake); app.appendChild(row);
    var keys = el('p','keys'); keys.innerHTML = 'Keys: <kbd>R</kbd> real &middot; <kbd>F</kbd> rendered';
    app.appendChild(keys);

    function pick(guess){
      if(answered) return; answered = true;
      var ok = guess === r.real;
      state.answers.push(ok); state.guesses.push(guess);
      if(state.mode === 'endless' && !ok) state.lives--;
      bReal.disabled = true; bFake.disabled = true;
      if(keys.parentNode) keys.parentNode.removeChild(keys);

      var st = el('div','stamp '+(r.real?'real':'fake'), r.real ? 'REAL' : 'RENDERED');
      st.setAttribute('aria-hidden','true'); clip.appendChild(st);

      var v = el('div','verdict'); v.setAttribute('role','status');
      v.appendChild(el('p','big', ok ? 'You got it.' : (r.real ? 'Fooled you. That one’s real.' : 'Fooled you. We made that up.')));
      var p = el('p',null,r.why);
      if(r.src){ p.appendChild(document.createTextNode(' ')); var a = el('a',null,'Read the source'); a.href = r.src; a.target = '_blank'; a.rel = 'noopener'; p.appendChild(a); }
      v.appendChild(p); app.appendChild(v);

      var over = state.mode === 'daily' ? state.i === state.list.length - 1 : state.lives <= 0;
      var nx = el('button','next', over ? 'See my score' : 'Next headline'); nx.type='button';
      function advance(){ if(over){ state.mode === 'daily' ? finishDaily(false) : finishEndless(); } else { state.i++; round(); } }
      nx.addEventListener('click', advance);
      app.appendChild(nx); nx.focus();
      app.replaceChild(header(), app.firstChild);
      onKey(function(e){ if(e.key === 'Enter' && document.activeElement !== nx){ e.preventDefault(); advance(); } });
    }
    bReal.addEventListener('click', function(){ pick(true); });
    bFake.addEventListener('click', function(){ pick(false); });
    onKey(function(e){
      if(e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if(k === 'r' || k === 'arrowleft'){ e.preventDefault(); pick(true); }
      else if(k === 'f' || k === 'arrowright'){ e.preventDefault(); pick(false); }
    });
  }

  // ---------- results ----------
  function rankFor(n, total){
    var f = n / total;
    if(f === 1) return 'Born and raised in Florida';
    if(f >= .75) return 'Snowbird with sharp instincts';
    if(f >= .5) return 'Tourist on Ocean Drive';
    return 'Just landed at the airport';
  }
  function siteURL(){ return location.origin + location.pathname.replace(/play(\.html)?$/, ''); }

  function shareBlock(box, text){
    var share = el('button','btn share','Share my result'); share.type='button';
    var toast = el('p','toast'); toast.setAttribute('role','status');
    share.addEventListener('click', function(){
      var done = function(){ toast.textContent = 'Copied. Paste it in your story or group chat.'; };
      var fail = function(){
        toast.textContent = 'Copy it from the box below.';
        if(!box.querySelector('textarea')){ var t = el('textarea','fallback'); t.value = text; t.rows = 4; t.setAttribute('aria-label','Your result'); box.insertBefore(t, toast.nextSibling); t.select(); }
      };
      if(navigator.share && /Mobi|Android/i.test(navigator.userAgent)){
        navigator.share({text:text}).catch(function(){});
        return;
      }
      try{ navigator.clipboard.writeText(text).then(done, fail); }catch(e){ fail(); }
    });
    box.appendChild(share); box.appendChild(toast);
  }

  function review(box){
    var wrap = el('div','review');
    wrap.appendChild(el('h3',null,'The headlines'));
    var ol = el('ol');
    state.list.slice(0, state.answers.length).forEach(function(r, k){
      var li = el('li');
      li.appendChild(el('span','tag '+(r.real?'real':'fake'), r.real ? 'REAL' : 'RENDERED'));
      li.appendChild(document.createTextNode((state.answers[k] ? '✓ ' : '✗ ') + r.h + ' '));
      if(r.src){ var a = el('a',null,'source'); a.href = r.src; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); }
      ol.appendChild(li);
    });
    wrap.appendChild(ol); box.appendChild(wrap);
  }

  function finishDaily(replay){
    onKey(null);
    var score = state.answers.filter(Boolean).length;
    if(!replay){
      set('ror-daily-'+today(), JSON.stringify({answers:state.answers, guesses:state.guesses}));
      var last = get('ror-last');
      if(last !== today()){
        var s = (last === yesterday()) ? getNum('ror-streak') + 1 : 1;
        set('ror-streak', String(s)); set('ror-last', today());
        if(s > getNum('ror-best')) set('ror-best', String(s));
        set('ror-played', String(getNum('ror-played') + 1));
      }
    }
    showStreak();

    clear();
    var box = el('section','result');
    box.appendChild(el('p',null,'Puzzle #'+pad(puzzleNo())));
    box.appendChild(el('div','score', score+'/'+state.list.length));
    box.appendChild(el('p','rank', rankFor(score, state.list.length)));
    var g = el('div','grid'); g.setAttribute('aria-label', score+' correct out of '+state.list.length);
    state.answers.forEach(function(ok){ g.appendChild(el('i', ok?'ok':'no')); });
    box.appendChild(g);

    var stats = el('div','stats');
    [['ror-streak','day streak'],['ror-best','best streak'],['ror-played','played']].forEach(function(p){
      var d = el('div'); d.appendChild(el('strong',null,String(getNum(p[0])))); d.appendChild(document.createTextNode(p[1])); stats.appendChild(d);
    });
    box.appendChild(stats);

    var text = 'Real or Rendered? #'+pad(puzzleNo())+'\n'+state.answers.map(function(ok){return ok?'🟨':'🟥';}).join('')+'\n'+score+'/'+state.list.length+' — can you tell?\n'+siteURL();
    shareBlock(box, text);

    var cd = el('p',null,''); box.appendChild(cd);
    function tick(){
      var n = new Date(), m = new Date(n); m.setHours(24,0,0,0);
      var s = Math.max(0, Math.floor((m - n)/1000));
      cd.textContent = 'Next puzzle in '+Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';
    }
    tick(); clearInterval(window.__rorTick); window.__rorTick = setInterval(tick, 30000);

    var endless = el('button','ghost','Keep playing: endless mode'); endless.type='button';
    endless.addEventListener('click', function(){ mode = 'endless'; start(); });
    box.appendChild(endless);
    review(box);
    app.appendChild(box);
    box.querySelector('.share').focus();
  }

  function finishEndless(){
    onKey(null);
    var score = state.answers.filter(Boolean).length;
    var best = getNum('ror-endless-best');
    var isBest = score > best;
    if(isBest) set('ror-endless-best', String(score));

    clear();
    var box = el('section','result');
    box.appendChild(el('p',null,'Endless run'));
    box.appendChild(el('div','score', String(score)));
    box.appendChild(el('p','rank', isBest ? 'New personal best!' : 'Best: '+best));
    var text = 'Real or Rendered? Endless\nI called '+score+' Florida headlines before running out of lives.\nBeat me: '+siteURL();
    shareBlock(box, text);
    var again = el('button','next','Run it back'); again.type='button';
    again.addEventListener('click', function(){ mode = 'endless'; start(); });
    box.appendChild(again);
    var home = el('button','ghost','Back to menu'); home.type='button';
    home.addEventListener('click', intro);
    box.appendChild(home);
    review(box);
    app.appendChild(box);
    again.focus();
  }

  // ---------- boot ----------
  if(/[?&]mode=endless/.test(location.search)) mode = 'endless';
  showStreak();
  if(/[?&]start=1/.test(location.search)) start(); else intro();
})();
