'use strict';
const $ = id => document.getElementById(id);
const PVP_PROTOCOL=9, CONNECTION_TIMEOUT_MS=18000;
let connectionEpoch=0, connectionTimer=null;
const heroes = {ngo:'Ngô Quyền',trung:'Hai Bà Trưng',an:'An Dương Vương',giong:'Thánh Gióng',tran:'Trần Hưng Đạo'};
const words = [
 ['substantial','đáng kể','considerable','reluctant','obsolete','candid'],['allocate','phân bổ','assign','worsen','inspect','agree'],['sustainable','bền vững','viable','vague','outdated','hesitant'],['inevitable','không thể tránh khỏi','unavoidable','precise','plentiful','profitable'],['meticulous','tỉ mỉ','thorough','vague','strong','outdated'],['ambiguous','mơ hồ','vague','precise','profitable','persistent'],['deteriorate','xấu đi','worsen','increase','agree','expand'],['augment','làm tăng thêm','increase','decline','inspect','reduce'],['obsolete','lỗi thời','outdated','viable','enduring','precise'],['resilient','kiên cường','tough','hesitant','vague','outdated'],['scrutinize','xem xét kỹ','inspect','increase','agree','reduce'],['lucrative','sinh lời','profitable','unavoidable','hesitant','outdated'],['mitigate','giảm nhẹ','reduce','expand','increase','assign'],['plausible','hợp lý','credible','outdated','persistent','tough'],['adversity','nghịch cảnh','hardship','proposal','profit','initiative'],['reluctant','miễn cưỡng','hesitant','plentiful','precise','strong'],['pivotal','then chốt','crucial','vague','outdated','hesitant'],['candid','thẳng thắn','frank','ambiguous','reluctant','perilous'],['abundant','dồi dào','plentiful','scarce','obsolete','candid'],['tenacious','ngoan cường','persistent','hesitant','vague','outdated'] ];
const canvas=$('canvas'),ctx=canvas.getContext('2d');
let peer=null,conn=null,mode='',side=0,players=['ngo','tran'],lives=[10,10],displayLives=[10,10],round=0,question=null,locked=true,ended=false,botTimer=null,nextTimer=null,impactTimer=null,fallTimer=null,fx=null,preview=null,poses=['idle','idle'],background=new Image();
const combatSound=new CombatAudio(), combatAnimator=new CombatAnimator(ctx);
document.addEventListener('pointerdown',()=>combatSound.unlock(),{passive:true});
const ARENA_MAPS=[{id:'palace',src:'assets/images/map_palace.png'},{id:'arena',src:'assets/images/map_arena.png'},{id:'plains',src:'assets/images/map_plains.png'},{id:'water_river',src:'assets/images/ancient_battlefield.png'}];
const mapImages=Object.fromEntries(ARENA_MAPS.map(m=>{const image=new Image();image.src=m.src;return [m.id,image]}));
let mapCursor=-1,currentMap='water_river',names=['P1','P2'],paused=false,pausedAt=0,actorSize=245;const scheduled=new Map(),pendingMessages=[];
function accountName(){return $('username').value.trim()}
function myName(){return accountName().slice(0,18)||'P1'}
function cancelTask(key){const item=scheduled.get(key);if(item)clearTimeout(item.id);scheduled.delete(key)}
function schedule(key,fn,delay){cancelTask(key);const task={fn,remaining:delay,id:null,due:0};scheduled.set(key,task);if(!paused)startTask(key,task)}
function startTask(key,task){task.due=performance.now()+task.remaining;task.id=setTimeout(()=>{scheduled.delete(key);task.fn()},task.remaining)}
function setPaused(value,announce=true){if(paused===value||$('battle').hidden)return;paused=value;const now=performance.now();if(value){pausedAt=now;for(const task of scheduled.values()){clearTimeout(task.id);task.remaining=Math.max(0,task.due-now)}}else{const delta=now-pausedAt;if(fx){fx.start+=delta;if(fx.deadStart)fx.deadStart+=delta;if(fx.lastHitAt)fx.lastHitAt+=delta;if(fx.victoryStart)fx.victoryStart+=delta}if(preview)preview.start+=delta;for(const [key,task] of scheduled)startTask(key,task)}$('pauseOverlay').hidden=!value;$('battle').classList.toggle('is-paused',value);$('pause').setAttribute('aria-label',value?'Trận đấu đang tạm dừng':'Tạm dừng');$('answers').inert=value;if(announce)send({type:'PAUSE',value});if(!value){for(const message of pendingMessages.splice(0))receiveData(message)}}
function clearTasks(){for(const key of scheduled.keys())cancelTask(key);pendingMessages.length=0;paused=false;$('battle').classList.remove('is-paused');$('pauseOverlay').hidden=true;$('answers').inert=false}

const sprites={};for(const name of Object.keys(heroes)){sprites[name]=new Image();sprites[name].src=`assets/images/heroes/${name}.png`;}

// Visible ground contact within each 229px atlas cell. Mounted units have
// larger transparent margins than standing units, so cell bottoms differ.
const SPRITE_FEET={
 an:[[222,221,216,222,221,221],[218,218,218],[217,216,216],[218,218,218],[218,216,216]],
 ngo:[[219,219,219,219,219,219],[219,219,219],[218,218,217],[218,218,218],[216,212,215]],
 tran:[[219,219,219,219,219,219],[217,217,217],[212,212,213],[217,217,217],[215,213,215]],
 trung:[[209,209,209,210,209,209],[207,206,207],[204,204,204],[205,206,206],[208,206,209]],
 giong:[[211,211,211,211,211,211],[214,214,214],[201,201,201],[199,199,199],[201,200,200]]
};
const SPRITE_CENTERS={an:116,ngo:118,tran:115,trung:114,giong:121};
function spriteSize(hero){return (hero==='trung'||hero==='giong')?actorSize*1.18:actorSize}
function desktopApproach(hero,opponent){return Math.max(0,520-(spriteSize(hero)+spriteSize(opponent))*.24)}

let score=0,questionPool=[],questionBag=[],lastQuestionKey='',vocabSource='starter',matchId=1,myRematchReady=false,peerRematchReady=false;
function makeQuestions(entries){
 const fallback=words.flatMap(item=>item.slice(2));
 const pool=entries.flatMap(item=>item.synonyms||[]),seenWords=new Set();
 return entries.flatMap(item=>{const wordKey=String(item.word||'').trim().toLocaleLowerCase();if(!wordKey||seenWords.has(wordKey))return [];seenWords.add(wordKey);const candidates=[...new Set((item.synonyms||[]).filter(Boolean))];if(!item.word||!item.meaning||!candidates.length)return [];const answer=candidates[0],blocked=new Set([item.word,...candidates].map(v=>v.toLowerCase().trim()));const distractors=[];for(const value of shuffle([...pool,...fallback])){const k=value.toLowerCase().trim();if(!k||blocked.has(k))continue;blocked.add(k);distractors.push(value);if(distractors.length===3)break}return distractors.length===3?[{word:item.word,meaning:item.meaning,answer,options:[answer,...distractors]}]:[]});
}
async function prepareVocabulary(){questionBag=[];const user=accountName();if(!user){questionPool=[];vocabSource='starter';$('vocabNotice').textContent='Chưa chọn tài khoản; đang dùng bộ từ mẫu.';return}const loaded=await tryLoadFromIndexedDB(user,{masteredOnly:false});questionPool=makeQuestions(loaded.words||[]);vocabSource=questionPool.length?'lexical':'starter';$('vocabNotice').textContent=questionPool.length?`Đã nạp ${questionPool.length} từ thuộc tài khoản ${user}.`:`Không tìm thấy từ phù hợp của ${user} trên nguồn này; dùng bộ từ mẫu.`;}
const detected=detectStoredUsername();if(detected)$('username').value=detected;discoverLocalUsers().then(users=>{const list=$('lexicalUsers');for(const name of users){const option=document.createElement('option');option.value=name;list.append(option)}$('vocabNotice').textContent=detected?`Tài khoản: ${detected}. Từ sẽ được nạp khi vào trận.`:'Chọn tài khoản Lexical Space; nếu chưa có sẽ dùng bộ từ mẫu.'}).catch(()=>{$('vocabNotice').textContent='Không đọc được danh sách tài khoản; có thể dùng bộ từ mẫu.'});


const collectionKeys={selected:'selected_hero',skins:'selected_hero_skins'};
function readStorage(key){try{return localStorage.getItem(key)}catch(_){return null}}
function writeStorage(key,value){try{localStorage.setItem(key,value);return true}catch(_){return false}}
function readJson(key,fallback){try{return JSON.parse(readStorage(key))||fallback}catch(_){return fallback}}
let owned=Object.keys(heroes),skinSelections=readJson(collectionKeys.skins,{}),selected=readStorage(collectionKeys.selected),galleryHero=null;
if(!skinSelections||typeof skinSelections!=='object'||Array.isArray(skinSelections))skinSelections={};
if(!Object.hasOwn(heroes,selected))selected='ngo';
function setSelected(id){if(!Object.hasOwn(heroes,id))return;selected=id;$('hero').value=id;writeStorage(collectionKeys.selected,id);$('selectedHeroName').textContent=heroes[id];}
setSelected(selected);
function portrait(id){const el=document.createElement('div');el.className='hero-portrait';el.style.backgroundImage=`url("assets/images/heroes/${id}.png")`;return el}
function drawGallery(id){galleryHero=id;$('skinTitle').textContent=`Trang phục · ${heroes[id]}`;$('heroGrid').replaceChildren();$('skinGrid').replaceChildren();
 for(const heroId of Object.keys(heroes)){const btn=document.createElement('button');btn.type='button';btn.className=`hero-card ${heroId===id?'is-selected':''}`;btn.setAttribute('aria-label',heroes[heroId]);btn.append(portrait(heroId));const label=document.createElement('span');label.textContent=heroes[heroId];btn.append(label);btn.onclick=()=>{setSelected(heroId);drawGallery(heroId)};$('heroGrid').append(btn)}
 for(let index=0;index<3;index++){const unlocked=index===0,btn=document.createElement('button');btn.type='button';btn.className=`skin-card ${!unlocked?'locked':''} ${unlocked&&selected===id?'is-selected':''}`;btn.setAttribute('aria-label',`${index===0?'Skin mặc định':`Skin ${index}`}${unlocked?'':' — chưa mở khóa'}`);btn.append(portrait(id));if(!unlocked){const lock=document.createElement('span');lock.className='lock-icon';lock.textContent='🔒';btn.append(lock)}const label=document.createElement('span');label.textContent=index===0?'Mặc định':`Skin ${index}`;btn.append(label);btn.onclick=()=>{if(!unlocked){$('skinTitle').textContent='Trang phục này chưa được mở khóa';return}skinSelections[id]=0;writeStorage(collectionKeys.skins,JSON.stringify(skinSelections));setSelected(id);$('galleryModal').hidden=true;$('openGallery').focus()};$('skinGrid').append(btn)}
}
function openGallery(){drawGallery(selected);$('galleryModal').hidden=false;$('closeGallery').focus()}
$('openGallery').onclick=openGallery;$('closeGallery').onclick=()=>{$('galleryModal').hidden=true;$('openGallery').focus()};
$('openBotMenu').onclick=async()=>{const button=$('openBotMenu');button.disabled=true;try{await prepareVocabulary();clean();setup('bot');players[1]='tran';beginRound()}finally{button.disabled=false}};
$('openPvpMenu').onclick=()=>{$('pvpMenu').hidden=false;$('closePvpMenu').focus()};$('closePvpMenu').onclick=()=>{clean();$('pvpMenu').hidden=true;status('Chia sẻ mã phòng với đối thủ.');$('openPvpMenu').focus()};
for(const element of document.querySelectorAll('.simple-corners, .pause-card, .ba-vuong-container, #battle .arena, #battle .question, #battle'))for(const position of ['tl','tr','bl','br']){const c=document.createElement('span');c.className='corner corner-'+position;c.setAttribute('aria-hidden','true');element.append(c)}
const lobbyCanvas=$('lobbyHero'),lobbyCtx=lobbyCanvas.getContext('2d');function renderLobby(now){if(!$('lobby').hidden&&selected){const im=sprites[selected];lobbyCtx.clearRect(0,0,229,229);if(im?.complete&&im.naturalWidth){const w=im.naturalWidth/6,h=im.naturalHeight/5;const frame=Math.floor(now/166.667)%6;lobbyCtx.imageSmoothingEnabled=false;lobbyCtx.drawImage(im,frame*w,0,w,h,0,0,229,229)}}requestAnimationFrame(renderLobby)}requestAnimationFrame(renderLobby);

function shuffle(a){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function status(t){$('status').textContent=t}
function clean(){connectionEpoch++;clearTimeout(connectionTimer);connectionTimer=null;clearTasks();myRematchReady=false;peerRematchReady=false;$('rematchPanel').hidden=true;$('answers').hidden=false;clearTimeout(botTimer);clearTimeout(nextTimer);clearTimeout(impactTimer);clearTimeout(fallTimer);fx=null;preview=null;$('victoryBanner').hidden=true;const oldConn=conn,oldPeer=peer;conn=null;peer=null;if(oldConn)oldConn.close();if(oldPeer)oldPeer.destroy();mode='';locked=true;ended=true}
function send(v){if(conn&&conn.open)conn.send(v)}
function setup(m){mode=m;side=0;matchId=1;myRematchReady=false;peerRematchReady=false;$('rematchPanel').hidden=true;$('answers').hidden=false;players=[$('hero').value,m==='bot'?'tran':null];names=[myName(),m==='bot'?'Máy':'Đang kết nối'];score=0;$('scoreValue').textContent='0';$('scorePanel').hidden=m!=='bot';lives=[10,10];displayLives=[10,10];if(m!=='guest'){mapCursor=(mapCursor+1)%ARENA_MAPS.length;currentMap=ARENA_MAPS[mapCursor].id;}round=0;question=null;ended=false;locked=true;fx=null;preview=null;poses=['idle','idle'];$('word').textContent='—';$('meaning').textContent='';$('answers').replaceChildren();$('roundStatus').textContent=m==='bot'?'Đang chuẩn bị câu hỏi…':'Đang đồng bộ trận đấu…';$('battleMessage').textContent='';$('victoryBanner').hidden=true;$('battle').hidden=false;$('lobby').hidden=true;$('pvpMenu').hidden=true;document.body.classList.add('in-battle');updateHUD()}
function updateHUD(){for(let i=0;i<2;i++){ $('name'+i).textContent=`${names[i]} - ${heroes[players[i]]||'Danh tướng'}`;const hp=$('lives'+i),container=hp.querySelector('.hp-pips');if(mode==='bot'&&i===1){container.innerHTML='<span class="hp-infinity" aria-hidden="true">∞</span>';hp.removeAttribute('aria-valuenow');hp.setAttribute('aria-valuetext','Máu vô hạn');continue}if(container.querySelector('.hp-infinity'))container.replaceChildren();const value=Math.max(0,Math.min(10,displayLives[i]));if(!container.children.length){for(let n=0;n<10;n++){const pip=document.createElement('span');pip.className='hp-pip';pip.setAttribute('aria-hidden','true');pip.addEventListener('animationend',()=>pip.classList.remove('breaking'));container.append(pip)}}const prev=Number(hp.dataset.value||10);for(let n=0;n<10;n++){const pip=container.children[n],remaining=i===0?n<value:n>=10-value,oldRemaining=i===0?n<prev:n>=10-prev;const healthIndex=i===0?n:9-n,breaking=pip.classList.contains('breaking')&&!remaining;pip.className='hp-pip '+(healthIndex<3?'red':healthIndex<6?'yellow':'green')+(remaining?'':' depleted')+(breaking?' breaking':'');if(oldRemaining&&!remaining){void pip.offsetWidth;pip.classList.add('breaking')}}hp.dataset.value=String(value);hp.setAttribute('aria-valuenow',String(value));hp.setAttribute('aria-valuetext',`${value} trên 10 máu`)}}
function nextQuestion(){
 if(!questionBag.length){const source=questionPool.length?questionPool:words.map(w=>({word:w[0],meaning:w[1],answer:w[2],options:w.slice(2)}));questionBag=shuffle(source);if(questionBag.length>1&&questionBag[questionBag.length-1].word.trim().toLocaleLowerCase()===lastQuestionKey){[questionBag[0],questionBag[questionBag.length-1]]=[questionBag[questionBag.length-1],questionBag[0]]}}
 const item=questionBag.pop();lastQuestionKey=item.word.trim().toLocaleLowerCase();return {...item,options:shuffle(item.options)};
}
function beginRound(){if(ended)return;round++;const q=nextQuestion();question=q;send({type:'ROUND',match:matchId,round,question,players,lives,names,map:currentMap,vocabSource,poolSize:questionPool.length||words.length});showRound(round,question,players,lives,names,currentMap,questionPool.length||words.length);if(mode==='bot'){const delay=Math.max(1750,7000-(round-1)*200);$('botSpeed').textContent=`Máy: ${(delay/1000).toFixed(2).replace(/0$/,'')} giây`;schedule('bot',()=>resolveHit(1),delay)}}
function showRound(n,q,p,l,newNames,newMap,poolSize){round=n;question=q;players=p;lives=l;if(Array.isArray(newNames)&&newNames.length===2)names=newNames.map(v=>String(v).slice(0,18));if(ARENA_MAPS.some(m=>m.id===newMap))currentMap=newMap;displayLives=[...l];locked=false;poses=['idle','idle'];fx=null;preview=null;$('victoryBanner').hidden=true;$('rematchPanel').hidden=true;$('answers').hidden=false;updateHUD();$('word').textContent=q.word;$('meaning').textContent=`(${q.meaning})`;$('battleMessage').textContent='';$('roundStatus').textContent=poolSize===1?'Bộ từ chỉ có một câu phù hợp nên câu sẽ lặp.':'Chọn đáp án đúng trước đối thủ!';$('answers').replaceChildren();q.options.forEach((opt,i)=>{let b=document.createElement('button');b.textContent=opt;b.dataset.key=String(i+1);b.setAttribute('aria-keyshortcuts',String(i+1));b.onclick=()=>answer(i);$('answers').append(b)})}
function disableAnswers(){locked=true;document.querySelectorAll('#answers button').forEach(b=>b.disabled=true)}
function answer(i){if(locked||ended||paused)return;combatSound.play('tap_click');const correct=question.options[i]===question.answer;disableAnswers();if(!correct){$('roundStatus').textContent='Sai! Đối thủ phản đòn.';if(mode==='guest')send({type:'MISS',match:matchId,round,choice:i});else resolveHit(1);return}poses[side]='attack';$('roundStatus').textContent='Đã ra đòn!';if(mode==='guest'){const hero=players[side];preview={start:performance.now(),winner:side,hero,impact:CombatAnimator.impactMs(hero)};combatSound.play(hero==='an'?'bow_shot':hero==='trung'?'elephant_charge':'shout_attack');send({type:'HIT',match:matchId,round,choice:i,hero,timestamp:performance.now()})}else resolveHit(0)}
function resolveHit(winner){if(ended||!question||fx)return;cancelTask('bot');disableAnswers();let loser=1-winner;if(mode==='bot'&&winner===0){score++;}else lives[loser]=Math.max(0,lives[loser]-1);const final=lives[loser]===0;let result={type:'RESULT',match:matchId,round,winner,lives:[...lives],final};send(result);applyResult(result);if(!final)schedule('next',beginRound,1300)}
function applyResult(result){
 if(result.round!==round||ended||fx)return;
 disableAnswers();lives=[...result.lives];const winner=result.winner,loser=1-winner,hero=players[winner],hitTimes=CombatAnimator.hitTimes(hero);
 const alreadyPlayed=preview&&preview.winner===winner;preview=null;fx={start:performance.now(),winner,final:result.final,hero,impact:hitTimes[0],impacted:false,lastHitAt:0,deadStart:0};
 poses[winner]='attack';poses[loser]='idle';
 if(!alreadyPlayed)combatSound.play(hero==='an'?'bow_shot':hero==='trung'?'elephant_charge':'shout_attack');
 $('battleMessage').textContent='';$('roundStatus').textContent='Đòn đánh đang tới…';
 const currentFx=fx;
 if(hero==='an')schedule('secondBow',()=>{if(fx===currentFx)combatSound.play('bow_shot')},250);
 hitTimes.forEach((time,index)=>schedule('impact'+index,()=>{
  if(fx!==currentFx)return;
  currentFx.impacted=true;const wasAlive=displayLives[loser]>0;
  if(wasAlive){if(index===0&&!(mode==='bot'&&loser===1))displayLives[loser]=Math.max(0,displayLives[loser]-1);currentFx.lastHitAt=performance.now();poses[loser]='hit'}
  if(index===0){displayLives=[...result.lives];if(mode==='bot')$('scoreValue').textContent=String(score)}
  combatSound.play(hero==='an'?'impact':'sword_slash');$('canvas').classList.remove('shake');void $('canvas').offsetWidth;$('canvas').classList.add('shake');updateHUD();
  $('battleMessage').textContent=result.final&&displayLives[loser]===0?(winner===side?'CHIẾN THẮNG!':'THẤT BẠI!'):(winner===side?'TRÚNG ĐÒN!':'ĐỐI THỦ RA ĐÒN!');
  $('roundStatus').textContent=result.final&&displayLives[loser]===0?'Trận đấu kết thúc.':'Chuẩn bị câu tiếp theo…';
  if(wasAlive&&displayLives[loser]===0)schedule('fall',()=>{if(fx!==currentFx)return;poses[loser]='dead';currentFx.deadStart=performance.now();combatSound.play('fall_defeat')},250);
 },time));
 if(result.final){ended=true;schedule('victory',()=>{if(fx===currentFx){currentFx.victoryStart=performance.now();$('victoryBanner').hidden=false;$('battleMessage').textContent='';showRematchPanel()}},1100)}
}
function clearConnectionTimer(){clearTimeout(connectionTimer);connectionTimer=null}
function connectionFailed(message){
 clearConnectionTimer();
 if($('battle').hidden){status(message);return}
 clearTasks();ended=true;disableAnswers();$('battleMessage').textContent='MẤT KẾT NỐI';$('roundStatus').textContent=message;showRematchPanel();$('rematch').disabled=true;$('rematchStatus').textContent='Về sảnh để kết nối lại.';
}
function startConnectionTimer(message){clearConnectionTimer();const current=connectionEpoch;connectionTimer=setTimeout(()=>{if(current!==connectionEpoch)return;const c=conn;conn=null;if(c)c.close();connectionFailed(message)},CONNECTION_TIMEOUT_MS)}
function peerErrorMessage(error){switch(error?.type){case 'peer-unavailable':return 'Không tìm thấy phòng. Kiểm tra mã và đảm bảo chủ phòng vẫn mở sảnh.';case 'unavailable-id':return 'Mã phòng đang được sử dụng. Hãy tạo lại phòng.';case 'browser-incompatible':return 'Trình duyệt không hỗ trợ kết nối PvP. Hãy thử Chrome hoặc Edge mới.';default:return 'Không kết nối được. Kiểm tra mạng, thử lại hoặc đổi mạng.'}}
function receiveData(data){
 if(!data||typeof data!=='object')return;
 if(data.type==='PROTOCOL_ERROR'){const c=conn;conn=null;if(c)c.close();connectionFailed('Hai máy đang dùng khác phiên bản. Cả hai hãy cập nhật và tải lại trò chơi.');return}
 if(mode==='host'&&data.type==='HELLO'){
  if(!$('battle').hidden)return;
  if(data.version!==PVP_PROTOCOL||!Object.hasOwn(heroes,data.hero)){const c=conn;if(c?.open)c.send({type:'PROTOCOL_ERROR',version:PVP_PROTOCOL});clearConnectionTimer();conn=null;if(c)setTimeout(()=>c.close(),150);status('Hai máy đang dùng khác phiên bản. Cả hai hãy cập nhật và tải lại trò chơi.');return}
  clearConnectionTimer();setup('host');players[1]=data.hero;names[1]=typeof data.name==='string'?data.name.slice(0,18)||'P2':'P2';updateHUD();send({type:'WELCOME',version:PVP_PROTOCOL,players,names});$('roundStatus').textContent='Đã kết nối, đang đồng bộ câu hỏi…';startConnectionTimer('Đối thủ chưa xác nhận trận đấu. Cả hai hãy cập nhật và thử lại.');return
 }
 if(mode==='guest'&&data.type==='WELCOME'){
  if(!$('battle').hidden)return;
  if(data.version!==PVP_PROTOCOL||!Array.isArray(data.players)||data.players.length!==2||!data.players.every(id=>Object.hasOwn(heroes,id))||!Array.isArray(data.names)||data.names.length!==2){const c=conn;conn=null;if(c)c.close();connectionFailed('Hai máy đang dùng khác phiên bản. Cả hai hãy cập nhật và tải lại trò chơi.');return}
  clearConnectionTimer();setup('guest');side=1;players=[...data.players];names=data.names.map(n=>typeof n==='string'?n.slice(0,18):'Người chơi');updateHUD();$('roundStatus').textContent='Đã kết nối, đang đồng bộ câu hỏi…';send({type:'READY',version:PVP_PROTOCOL});startConnectionTimer('Không nhận được câu hỏi từ chủ phòng. Hãy kiểm tra mạng và thử lại.');return
 }
 if(mode==='host'&&data.type==='READY'&&data.version===PVP_PROTOCOL&&round===0&&!ended){clearConnectionTimer();beginRound();return}
 if(paused&&['HIT','MISS','RESULT','ROUND','REMATCH_READY','REMATCH_START'].includes(data.type)){pendingMessages.push(data);return;}
 if(['HIT','MISS','RESULT','ROUND'].includes(data.type)&&data.match!==matchId)return;
 if(data.type==='REMATCH_READY'){if(ended&&data.match===matchId){peerRematchReady=true;updateRematchStatus();if(mode==='host'&&myRematchReady)startRematch()}return}
 if(data.type==='REMATCH_START'){if(mode==='guest'&&ended&&myRematchReady&&data.match===matchId+1)startRematch(false);return}
 if(data.type==='PAUSE'&&typeof data.value==='boolean'){setPaused(data.value,false)}
 else if(mode==='guest'&&data.type==='ROUND'&&data.round>round&&data.question&&Array.isArray(data.question.options)&&data.question.options.length===4){clearConnectionTimer();showRound(data.round,data.question,data.players,data.lives,data.names,data.map,data.poolSize)}
 else if(mode==='host'&&data.type==='MISS'&&data.round===round&&!locked&&Number.isInteger(data.choice)&&data.choice>=0&&data.choice<question.options.length&&question.options[data.choice]!==question.answer){resolveHit(0)}
 else if(mode==='host'&&data.type==='HIT'&&data.round===round&&!locked&&Number.isInteger(data.choice)&&question.options[data.choice]===question.answer){resolveHit(1)}
 else if(mode==='guest'&&data.type==='RESULT'&&data.round===round&&[0,1].includes(data.winner)&&Array.isArray(data.lives)){applyResult(data)}
}
function listen(c){
 conn=c;c.on('data',data=>{if(conn===c)receiveData(data)});
 c.on('close',()=>{if(conn!==c)return;conn=null;connectionFailed('Kết nối với đối thủ đã ngắt. Hãy thử tạo hoặc vào phòng lại.')});
 c.on('error',()=>{if(conn!==c)return;conn=null;connectionFailed('Lỗi kết nối với đối thủ. Hãy kiểm tra mạng và thử lại.')});
}
function createHost(attempt,epoch){
 if(epoch!==connectionEpoch)return;
 const code=String(Math.floor(1000+Math.random()*9000)),candidate=new Peer('anhhung-duel-'+code);peer=candidate;
 candidate.on('open',()=>{if(peer!==candidate||epoch!==connectionEpoch)return;status(`Mã phòng: ${code} — đang chờ đối thủ. ${vocabSource==='lexical'?`Bộ từ của ${accountName()}`:'Đang dùng bộ từ mẫu.'}`)});
 candidate.on('connection',c=>{if(peer!==candidate||epoch!==connectionEpoch||conn||!$('battle').hidden){c.close();return}listen(c);status('Đang kết nối và xác minh đối thủ…');startConnectionTimer('Kết nối quá lâu. Hãy kiểm tra mạng và thử vào phòng lại.')});
 candidate.on('error',e=>{if(peer!==candidate||epoch!==connectionEpoch)return;if(e.type==='unavailable-id'&&attempt<8){peer=null;candidate.destroy();status('Đang chọn mã phòng khác…');createHost(attempt+1,epoch);return}connectionFailed(peerErrorMessage(e))});
 candidate.on('disconnected',()=>{if(peer===candidate&&epoch===connectionEpoch&&!conn)status('Mất kết nối máy chủ phòng. Hãy tạo lại phòng.')});
}
$('host').onclick=async()=>{
 if(typeof Peer==='undefined'){status('Không tải được PeerJS. Kiểm tra mạng rồi tải lại trang.');return}
 clean();mode='host';const epoch=connectionEpoch,button=$('host');button.disabled=true;status('Đang nạp bộ từ của chủ phòng…');try{await prepareVocabulary()}finally{button.disabled=false}if(epoch!==connectionEpoch||$('pvpMenu').hidden)return;status('Đang tạo phòng…');createHost(0,epoch)
};
$('join').onclick=()=>{
 const code=$('code').value.trim();if(!/^\d{4}$/.test(code)){status('Vui lòng nhập đúng 4 chữ số.');return}if(typeof Peer==='undefined'){status('Không tải được PeerJS. Kiểm tra mạng rồi tải lại trang.');return}
 clean();mode='guest';const epoch=connectionEpoch;status('Đang kết nối với chủ phòng…');const candidate=new Peer();peer=candidate;
 startConnectionTimer('Kết nối quá lâu. Kiểm tra mã phòng, mạng và thử lại.');
 candidate.on('open',()=>{if(peer!==candidate||epoch!==connectionEpoch)return;const c=candidate.connect('anhhung-duel-'+code,{reliable:true});listen(c);c.on('open',()=>{if(conn!==c||epoch!==connectionEpoch)return;status('Đã kết nối, đang xác minh phiên bản…');send({type:'HELLO',version:PVP_PROTOCOL,hero:$('hero').value,name:myName()});startConnectionTimer('Chủ phòng không phản hồi. Cả hai hãy cập nhật và tải lại trò chơi.')})});
 candidate.on('error',e=>{if(peer!==candidate||epoch!==connectionEpoch)return;connectionFailed(peerErrorMessage(e))});
};
function showRematchPanel(){$('answers').hidden=true;$('rematchPanel').hidden=false;$('rematch').disabled=false;$('rematch').textContent='TÁI ĐẤU';updateRematchStatus()}
function updateRematchStatus(){if(mode==='bot'){$('rematchStatus').textContent='Chơi tiếp với máy và bộ từ hiện tại.';return}if(!conn?.open){$('rematch').disabled=true;$('rematchStatus').textContent='Kết nối đã ngắt. Hãy về sảnh để tạo phòng mới.';return}$('rematchStatus').textContent=myRematchReady?'Đang chờ đối thủ đồng ý tái đấu.':peerRematchReady?'Đối thủ đã sẵn sàng tái đấu.':'Cả hai người cần đồng ý tái đấu.'}
function startRematch(announce=true){if(!ended)return;clearTasks();if(mode==='host'&&announce)send({type:'REMATCH_START',match:matchId+1});matchId++;round=0;question=null;score=0;lives=[10,10];displayLives=[10,10];ended=false;locked=true;fx=null;preview=null;poses=['idle','idle'];myRematchReady=false;peerRematchReady=false;$('scoreValue').textContent='0';$('rematchPanel').hidden=true;$('answers').hidden=false;$('victoryBanner').hidden=true;$('battleMessage').textContent='';$('roundStatus').textContent='Đang chuẩn bị trận mới…';if(mode!=='guest'){mapCursor=(mapCursor+1)%ARENA_MAPS.length;currentMap=ARENA_MAPS[mapCursor].id}updateHUD();if(mode!=='guest')beginRound()}
$('rematch').onclick=()=>{if(!ended||paused)return;if(mode==='bot'){startRematch();return}if(!conn?.open){updateRematchStatus();return}if(myRematchReady)return;myRematchReady=true;$('rematch').disabled=true;send({type:'REMATCH_READY',match:matchId});updateRematchStatus();if(mode==='host'&&peerRematchReady)startRematch()};
$('returnLobby').onclick=()=>{$('leave').click()};
document.addEventListener('keydown',event=>{if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||$('battle').hidden||paused||ended||locked)return;if(event.target instanceof HTMLElement&&(event.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)))return;if(!/^[1-4]$/.test(event.key))return;const button=$('answers').children[Number(event.key)-1];if(button&&!button.disabled){event.preventDefault();button.click()}});
$('pause').onclick=()=>setPaused(true);$('resume').onclick=()=>setPaused(false);
$('leave').onclick=()=>{clean();$('battle').hidden=true;$('lobby').hidden=false;document.body.classList.remove('in-battle');status('Chọn chế độ để bắt đầu.')};
function drawHero(x,y,hero,pose,flip,now,elapsed=0){
 ctx.save();ctx.translate(x,y);ctx.scale(flip?-1:1,1);if(pose==='hit')ctx.translate(-10,0);
 const sheet=sprites[hero],size=spriteSize(hero);
 if(sheet&&sheet.complete&&sheet.naturalWidth){let row=pose==='dead'?4:pose==='victory'?3:pose==='hit'?2:pose==='attack'?1:0;
 let frame=row===0?Math.floor(now/166.667)%6:Math.min(2,Math.max(0,Math.floor(elapsed/(row===4?160:83.333))));
 ctx.imageSmoothingEnabled=false;if(pose==='hit'&&elapsed<90)ctx.filter='brightness(0) invert(1)';const foot=SPRITE_FEET[hero]?.[row]?.[frame]||229,center=SPRITE_CENTERS[hero]||114.5;ctx.drawImage(sheet,frame*229,row*229,229,229,-size*center/229,-size*.70+(229-foot)*size/229,size,size)
 }else{ctx.fillStyle=hero==='tran'?'#325b88':'#8b1e1e';ctx.fillRect(-25,-45,50,100);ctx.fillStyle='#d4af37';ctx.fillRect(-20,-55,40,12)}ctx.restore();
}
function render(now){
 const bg=mapImages[currentMap];const rect=canvas.getBoundingClientRect();if(rect.width>0&&rect.height>0){const h=Math.max(200,Math.round(960*rect.height/rect.width));if(canvas.height!==h)canvas.height=h;}const height=canvas.height;actorSize=Math.min(400,Math.max(245,height*.30));const floor=height*(window.innerWidth>=900?.82:.8);ctx.clearRect(0,0,960,height);if(bg&&bg.complete&&bg.naturalWidth){const scale=Math.max(960/bg.naturalWidth,height/bg.naturalHeight),w=bg.naturalWidth*scale,h=bg.naturalHeight*scale;ctx.drawImage(bg,(960-w)/2,(height-h)/2,w,h)}else{ctx.fillStyle='#514037';ctx.fillRect(0,0,960,height)}
 if(paused)now=pausedAt;
 if(fx&&fx.victoryStart){const elapsed=Math.max(0,now-fx.victoryStart),progress=Math.min(1,elapsed/500),zoom=1+.6*progress;const grad=ctx.createRadialGradient(480,height*.54,Math.min(height,960)*.10,480,height*.54,Math.max(height,960)*.70);grad.addColorStop(0,'rgba(8,12,18,.35)');grad.addColorStop(1,'rgba(4,7,12,.87)');ctx.fillStyle=grad;ctx.fillRect(0,0,960,height);ctx.save();ctx.translate(480,height*.67);ctx.scale(zoom,zoom);const savedSize=actorSize;actorSize=Math.min(actorSize,height/(zoom*.95));drawHero(0,0,players[fx.winner],'victory',false,now,elapsed);actorSize=savedSize;ctx.restore();requestAnimationFrame(render);return}
 const active=fx||preview,t=active?Math.max(0,now-active.start):0;
 for(let i=0;i<2;i++){
  let x=i?740:220,pose=poses[i],elapsed=0;
  if(active&&i===active.winner){const base=CombatAnimator.displacement(active.hero,t),d=window.innerWidth>=900?base*desktopApproach(active.hero,players[1-i])/510:base;x+=(i?-1:1)*d;pose=active.hero==='an'?(t<500?'attack':'idle'):(t>=120&&t<870?'attack':'idle');elapsed=active.hero==='an'?t%250:Math.max(0,t-120)%250}
  if(fx&&i!==fx.winner){pose=fx.impacted?(fx.final&&fx.deadStart?'dead':'hit'):'idle';elapsed=pose==='dead'?now-fx.deadStart:Math.max(0,now-fx.lastHitAt)}
  const size=spriteSize(players[i]);drawHero(x,floor-size*.3,players[i],pose,!!i,now,elapsed);
 }
 if(active){const target=active.winner?220:740;
 if(active.hero==='an'){for(const launch of [0,250])if(t>=launch&&t<launch+100){const arrow=new Projectile(active.winner?740:220,target,launch);combatAnimator.drawProjectile(arrow.position(t),floor-actorSize*.45,!!active.winner)}}
 if(fx&&fx.hero!=='an'){for(const hit of CombatAnimator.hitTimes(fx.hero))if(t>=hit&&t<hit+165){combatAnimator.drawSlash(target,floor-actorSize*.4,t-hit);if(fx.hero==='giong'){ctx.save();ctx.strokeStyle='#bceeff';ctx.lineWidth=6;ctx.shadowColor='#46baff';ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(target+40,floor-actorSize);ctx.lineTo(target-16,floor-actorSize*.55);ctx.lineTo(target+8,floor-actorSize*.48);ctx.lineTo(target-28,floor-actorSize*.15);ctx.stroke();ctx.restore()}}}}
 requestAnimationFrame(render)
}requestAnimationFrame(render);
