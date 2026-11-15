'use strict';
// Separate chess transport: vocabulary PvP protocol13 and combat remain unchanged.
(()=>{
 const bridge=window.QuickDrawnChessBridge;if(!bridge||typeof ChessSession==='undefined')return;
 const $=id=>document.getElementById(id),node=s=>document.querySelector(s),now=()=>performance.now();
 const screen=node('[data-chess-screen]'),settings=node('[data-chess-time]'),board=node('[data-chess-board]');
 const original={host:$('host').onclick,join:$('join').onclick,close:$('closePvpMenu').onclick,pvp:$('openPvpMenu').onclick};
 const reasons={checkmate:'Chiếu hết',stalemate:'Hết nước đi hợp lệ',repetition:'Lặp lại thế cờ 3 lần','fifty-move':'Luật 50 nước',material:'Không đủ quân chiếu hết',agreement:'Hai bên đồng ý hòa',resign:'Xin thua',timeout:'Hết giờ'};
 const pieceNames={k:'Vua',q:'Hậu',b:'Tượng',n:'Mã',r:'Xe',p:'Tốt'};
 const unicode={wk:'♔',wq:'♕',wb:'♗',wn:'♘',wr:'♖',wp:'♙',bk:'♚',bq:'♛',bb:'♝',bn:'♞',br:'♜',bp:'♟'};
 let enabled=false,role='',epoch=0,peer=null,conn=null,room=null,session=null,myProfile=null,localSide=0,localReady=false,linked=false,selected=null,promotion=null,pendingMove=false,disconnected=false,handshakeTimer=null,savePromise=Promise.resolve(),settled=new Set(),lastSync=0,lastClock='',drawnRevision=-1;
 let chosenTime={minutes:5,increment:0};
 const timeLabel=t=>t.minutes+' phút'+(t.increment?' + '+t.increment+' giây/nước':'');
 const setStatus=text=>{$('status').textContent=text};
 function packet(type,body={}){if(conn?.open)conn.send({channel:'quickdrawn-chess',version:1,type,...body})}
 function clearHandshake(){clearTimeout(handshakeTimer);handshakeTimer=null}
 function handshake(){clearHandshake();const current=epoch;handshakeTimer=setTimeout(()=>{if(current===epoch)loseConnection('Kết nối quá lâu. Hãy tạo hoặc vào phòng lại.')},18000)}
 function destroy(){epoch++;clearHandshake();const c=conn,p=peer;conn=null;peer=null;room=null;session=null;role='';localReady=false;linked=false;selected=null;promotion=null;pendingMove=false;disconnected=false;drawnRevision=-1;c?.close();p?.destroy();node('[data-chess-promotion]').hidden=true;screen.hidden=true;document.body.classList.remove('in-chess');node('[data-pvp-room]').hidden=true;for(const id of ['host','join','code'])$(id).disabled=false}
 function menu(active){enabled=active;settings.hidden=!active;$('pvpMenu').classList.toggle('is-chess-menu',active);$('pvpTitle').textContent=active?'Cờ vua · Song đấu':'Song đấu';node('[data-chess-room-note]').hidden=!active;renderTime()}
 function open(){destroy();bridge.clean();menu(true);$('pvpMenu').hidden=false;$('closePvpMenu').focus();setStatus('Chọn thời gian rồi tạo phòng, hoặc nhập mã để vào phòng của bạn.');renderRoom()}
 function readTime(){const minutes=Number(node('[data-chess-minutes]').value),increment=Number(node('[data-chess-increment]').value);return validChessTime({minutes,increment})?{minutes,increment}:null}
 function renderTime(){node('[data-chess-minutes]').value=chosenTime.minutes;node('[data-chess-increment]').value=chosenTime.increment;const locked=!!role&&(role!=='host'||!room?.editable||room.starting);for(const input of settings.querySelectorAll('input'))input.disabled=locked;node('[data-chess-apply-time]').disabled=locked;node('[data-chess-time-note]').textContent=role==='guest'?'Thời gian do chủ phòng chọn.':room&&!room.editable?'Đã khóa thời gian. Có thể đổi sau khi kết thúc ván.':'Mỗi bên có thời gian riêng. Giây cộng được thêm sau mỗi nước hợp lệ.'}
 function editTime(){const value=readTime();if(!value){setStatus('Thời gian: 1–180 phút; giây cộng: 0–60.');return}if(role&&(role!=='host'||!room?.editable||room.starting)){renderTime();return}chosenTime=value;if(room){room.time={...value};room.config++;room.ready=[false,false];localReady=false;sendRoom();renderRoom()}}
 for(const input of settings.querySelectorAll('input'))input.addEventListener('change',editTime);
 function validRoom(data){return data&&typeof data.id==='string'&&/^chess-[a-z0-9-]+$/i.test(data.id)&&data.id.length<150&&validChessTime(data.time)&&Number.isSafeInteger(data.config)&&data.config>=0&&Array.isArray(data.profiles)&&data.profiles.length===2&&data.profiles.every(bridge.validProfile)&&data.profiles[0].id!==data.profiles[1].id&&Array.isArray(data.heroes)&&data.heroes.length===2&&data.heroes.every(bridge.validHero)&&Array.isArray(data.ready)&&data.ready.length===2&&data.ready.every(v=>typeof v==='boolean')&&typeof data.editable==='boolean'}
 function sendRoom(){packet('ROOM',{room})}
 function renderRoom(){
  const panel=node('[data-pvp-room]'),cards=node('[data-pvp-room-players]'),ready=node('[data-pvp-ready]');
  panel.hidden=!room||!!session;for(const id of ['host','join','code'])$(id).disabled=!!role;renderTime();if(!room||session)return;
  node('[data-pvp-room-label]').textContent='Phòng '+room.code+' · Cờ vua · '+timeLabel(room.time);cards.replaceChildren();
  room.profiles.forEach((profile,i)=>{const card=document.createElement('article');card.className='pvp-room-player'+(i===localSide?' is-you':'');const art=bridge.portrait(room.heroes[i]);art.classList.add('pvp-room-portrait');card.append(art);for(const [tag,text]of [['small',(i===localSide?'Bạn · ':'')+(i===0?'Chủ phòng · Trắng':'Đối thủ · Đen')],['strong',profile.name],['span',bridge.heroName(room.heroes[i])+' · '+profile.elo+' Elo'],['b',room.ready[i]?'Đã sẵn sàng':'Chưa sẵn sàng']]){const el=document.createElement(tag);el.textContent=text;if(tag==='b'&&room.ready[i])el.className='is-ready';card.append(el)}cards.append(card)});
  ready.disabled=!linked||localReady||!validChessTime(room.time);ready.textContent=localReady?'ĐÃ SẴN SÀNG':'SẴN SÀNG';setStatus(localReady?'Bạn đã sẵn sàng. Đang chờ đối thủ…':'Kiểm tra đối thủ và thời gian. Cả hai bấm Sẵn sàng mới bắt đầu.');
 }
 function ready(){if(!room||session||!linked||localReady||!conn?.open)return;if(role==='host'&&room.editable){const value=readTime();if(!value){setStatus('Chọn 1–180 phút và 0–60 giây cộng.');return}if(value.minutes!==room.time.minutes||value.increment!==room.time.increment)editTime()}localReady=true;room.ready[localSide]=true;renderRoom();if(role==='host'){sendRoom();tryStart()}else packet('READY',{id:room.id,config:room.config,profile:bridge.latest(myProfile)})}
 function tryStart(){if(role!=='host'||session||room.starting||!linked||!localReady||!room.ready.every(Boolean)||!conn?.open)return;room.starting=true;renderTime();packet('START',{id:room.id,config:room.config});handshake()}
 function showScreen(){screen.hidden=false;$('lobby').hidden=true;$('pvpMenu').hidden=true;document.body.classList.add('in-chess');const arena=board.parentElement;arena.insertBefore(node('[data-chess-player="'+(1-localSide)+'"]'),board);arena.append(node('[data-chess-player="'+localSide+'"]'));selected=null;promotion=null;drawnRevision=-1;lastClock='';node('[data-chess-promotion]').hidden=true;for(const el of screen.querySelectorAll('[data-chess-profile]')){const i=Number(el.dataset.chessProfile);node('[data-chess-avatar="'+i+'"]').replaceChildren(bridge.portrait(room.heroes[i]));const name=document.createElement('strong');name.textContent=room.profiles[i].name;const rating=document.createElement('small');rating.textContent=room.profiles[i].elo+' Elo'+(i===localSide?' · Bạn':'');el.replaceChildren(name,rating);node('[data-chess-captured="'+i+'"]').setAttribute('aria-label','Quân '+room.profiles[i].name+' đã ăn')}node('[data-chess-control]').textContent=timeLabel(room.time);node('[data-chess-result]').textContent='';render()}
 function broadcast(){if(role==='host'&&session){packet('STATE',{id:room.id,state:session.snapshot(now())});lastSync=now()}}
 function loseConnection(text){clearHandshake();disconnected=true;pendingMove=false;if(session){session.clocks=session.remaining(now());session.running=false;node('[data-chess-status]').textContent=session.result?text+' Kết quả ván đã hoàn tất được giữ nguyên.':text+' Ván chưa hoàn tất không tính Elo.';render()}else{const c=conn;conn=null;room=null;localReady=false;linked=false;role='';c?.close();renderRoom();setStatus(text)} }
 function listen(c,current){conn=c;c.on('data',data=>{if(current!==epoch||conn!==c)return;try{receive(data)}catch(error){console.warn('Ignored invalid chess message:',error.message)}});c.on('close',()=>{if(current===epoch&&conn===c){conn=null;loseConnection('Đối thủ đã mất kết nối.')}});c.on('error',()=>{if(current===epoch&&conn===c){conn=null;loseConnection('Lỗi kết nối.')}})}
 async function create(attempt=0){
  if(typeof Peer==='undefined'){setStatus('Không tải được kết nối phòng. Hãy kiểm tra mạng.');return}
  const time=readTime();if(!time){setStatus('Chọn 1–180 phút và 0–60 giây cộng trước khi tạo phòng.');return}chosenTime=time;destroy();role='host';localSide=0;const current=epoch;renderRoom();setStatus('Đang chuẩn bị hồ sơ…');
  myProfile=await bridge.profile();if(current!==epoch||!enabled)return;if(!bridge.validProfile(myProfile)){destroy();renderRoom();setStatus('Tài khoản đã thay đổi. Hãy tạo phòng lại.');return}
  function attemptHost(n){if(current!==epoch)return;const code=String(Math.floor(1000+Math.random()*9000)),candidate=new Peer('anhhung-chess-'+code);peer=candidate;
   candidate.on('open',()=>{if(current!==epoch||peer!==candidate)return;room={id:'chess-'+bridge.uid(),code,config:0,time:{...chosenTime},profiles:[myProfile],heroes:[bridge.selectedHero()],ready:[false,false],editable:false};renderTime();setStatus('Mã phòng cờ vua: '+code+' · '+timeLabel(chosenTime)+' · Đang chờ đối thủ.');});
   candidate.on('connection',c=>{if(current!==epoch||peer!==candidate||conn||!room||session){c.close();return}listen(c,current);handshake();setStatus('Đang xác minh đối thủ…')});
   candidate.on('error',error=>{if(current!==epoch||peer!==candidate)return;if(error.type==='unavailable-id'&&n<8){candidate.destroy();peer=null;attemptHost(n+1)}else loseConnection('Không tạo được phòng. Hãy thử lại.')});
  }attemptHost(attempt);
 }
 async function join(){
  const code=$('code').value.trim();if(!/^\d{4}$/.test(code)){setStatus('Nhập mã phòng cờ vua gồm 4 số.');return}if(typeof Peer==='undefined'){setStatus('Không tải được kết nối phòng. Hãy kiểm tra mạng.');return}
  destroy();role='guest';localSide=1;const current=epoch;renderRoom();setStatus('Đang chuẩn bị hồ sơ…');myProfile=await bridge.profile();if(current!==epoch||!enabled)return;if(!bridge.validProfile(myProfile)){destroy();renderRoom();setStatus('Tài khoản đã thay đổi. Hãy vào phòng lại.');return}
  const candidate=new Peer();peer=candidate;handshake();candidate.on('open',()=>{if(current!==epoch||peer!==candidate)return;const c=candidate.connect('anhhung-chess-'+code,{reliable:true});listen(c,current);c.on('open',()=>{if(current!==epoch||conn!==c)return;packet('HELLO',{profile:myProfile,hero:bridge.selectedHero()});setStatus('Đang vào phòng cờ vua…')})});candidate.on('error',()=>{if(current===epoch&&peer===candidate)loseConnection('Không tìm thấy phòng cờ vua. Kiểm tra mã hoặc thử lại.')});
 }
 function receive(data){
  if(!data||data.channel!=='quickdrawn-chess'||data.version!==1||typeof data.type!=='string')return;
  if(data.type==='ERROR'){loseConnection('Không thể vào phòng: '+(data.code==='same-profile'?'hai người cần dùng hai tài khoản khác nhau.':'phiên bản hoặc dữ liệu không hợp lệ.'));return}
  if(role==='host'&&data.type==='HELLO'){
   if(!room||room.profiles.length!==1||session)return;if(!bridge.validProfile(data.profile)||!bridge.validHero(data.hero))return;
   if(data.profile.id===myProfile.id){packet('ERROR',{code:'same-profile'});return}
   room.profiles.push({...data.profile});room.heroes.push(data.hero);clearHandshake();sendRoom();renderRoom();handshake();return;
  }
  if(role==='guest'&&data.type==='ROOM'){
   if(!validRoom(data.room)||data.room.profiles[1].id!==myProfile?.id||!/^\d{4}$/.test(data.room.code))return;
   if(room&&data.room.id===room.id){if(session||data.room.config<room.config)return;if(data.room.config!==room.config)localReady=false;if(data.room.ready[1]&&!localReady)return}
   else{if(room&&session&&!session.result)return;session=null;localReady=false;disconnected=false;}
   room=JSON.parse(JSON.stringify(data.room));room.ready[1]=localReady;chosenTime={...room.time};linked=true;clearHandshake();screen.hidden=true;$('lobby').hidden=false;$('pvpMenu').hidden=false;document.body.classList.remove('in-chess');renderRoom();packet('LINKED',{id:room.id,config:room.config});return;
  }
  if(!room||data.id!==room.id)return;
  if(data.type==='LINKED'&&role==='host'&&!session){linked=true;clearHandshake();renderRoom();tryStart();return}
  if(data.type==='READY'&&role==='host'&&!session&&data.config===room.config&&linked&&bridge.validProfile(data.profile)&&data.profile.id===room.profiles[1].id){room.profiles[1]={...data.profile};room.ready[1]=true;renderRoom();sendRoom();tryStart();return}
  if(data.type==='START'&&role==='guest'&&!session&&data.config===room.config&&localReady&&room.ready.every(Boolean)){packet('START_ACK',{id:room.id,config:room.config});handshake();return}
  if(data.type==='START_ACK'&&role==='host'&&!session&&room.starting&&data.config===room.config&&localReady&&room.ready.every(Boolean)){clearHandshake();session=new ChessSession(room.id,room.time);session.start(now());showScreen();broadcast();return}
  if(data.type==='STATE'&&role==='guest'){
   if(!localReady||!room.ready.every(Boolean)||data.state?.id!==room.id||data.state.time?.minutes!==room.time.minutes||data.state.time?.increment!==room.time.increment)return;
   if(session&&data.state.revision<session.revision)return;if(session?.result)return;
   const next=ChessSession.restore(data.state,now());if(session&&next.revision===session.revision&&next.game.fen()!==session.game.fen())return;
   const first=!session,changed=first||next.revision!==session.revision;session=next;pendingMove=false;if(changed){selected=null;promotion=null;node('[data-chess-promotion]').hidden=true}clearHandshake();if(first)showScreen();else render();settle();return;
  }
  if(data.type==='REMATCH'&&role==='host'&&session?.result){resetRoom();return}
  if(!session||session.result||disconnected)return;
  if(role==='host'){
   if(data.type==='MOVE'&&data.revision===session.revision){const moved=session.move(1,data.from,data.to,data.promotion,now());if(moved)bridge.sound();broadcast();render();settle()}
   else if(data.type==='RESIGN'){session.finish(0,'resign',now());broadcast();render();settle()}
   else if(data.type==='DRAW_OFFER'){offerDraw(1)}
   else if(data.type==='DRAW_REPLY'&&typeof data.accept==='boolean'){replyDraw(1,data.accept)}
  }
 }
 async function settle(){
  if(!session?.result||settled.has(session.id))return;const current=session,id=session.id;settled.add(id);const actual=current.result.winner===null?.5:current.result.winner===localSide?1:0;
  node('[data-chess-result]').textContent='Đang lưu kết quả…';
  savePromise=bridge.finish({id,profiles:room.profiles},localSide,actual);
  try{const result=await savePromise;if(session!==current)return;node('[data-chess-result]').textContent=(result.appliedDeltaElo>=0?'+':'')+result.appliedDeltaElo+' Elo · '+(actual===1?'Thắng':actual===0?'Thua':'Hòa')}catch(_){if(session===current)node('[data-chess-result]').textContent='Chưa lưu được kết quả. Vui lòng giữ trang mở.'}
 }
 function submitMove(from,to,promote){if(!session||session.result||disconnected||pendingMove||session.turn!==localSide)return;selected=null;promotion=null;node('[data-chess-promotion]').hidden=true;
  if(role==='host'){session.move(0,from,to,promote,now());bridge.sound();broadcast();render();settle()}else{pendingMove=true;packet('MOVE',{id:room.id,revision:session.revision,from,to,...(promote?{promotion:promote}:{})});render()}
 }
 function chooseSquare(square){if(!session||session.result||disconnected||pendingMove||session.turn!==localSide)return;const game=session.game,piece=game.get(square);
  if(selected){const moves=game.moves({square:selected,verbose:true}).filter(m=>m.to===square);if(moves.length){if(moves.some(m=>m.promotion)){promotion={from:selected,to:square};node('[data-chess-promotion]').hidden=false;node('[data-chess-promote="q"]').focus()}else submitMove(selected,square);return}}
  selected=piece?.color===(localSide===0?'w':'b')?(selected===square?null:square):null;drawnRevision=-1;render();
 }
 for(const button of screen.querySelectorAll('[data-chess-promote]'))button.onclick=()=>{if(promotion)submitMove(promotion.from,promotion.to,button.dataset.chessPromote)};
 node('[data-chess-cancel-promotion]').onclick=()=>{promotion=null;node('[data-chess-promotion]').hidden=true};
 function offerDraw(actor){if(!session||session.result||session.tick(now())){broadcast();render();settle();return}if(session.drawOffer!==null)return;session.drawOffer=actor;session.revision++;broadcast();render()}
 function replyDraw(actor,accept){if(!session||session.result||session.drawOffer===null||session.drawOffer===actor)return;if(session.tick(now())){broadcast();render();settle();return}if(accept)session.finish(null,'agreement',now());else{session.drawOffer=null;session.revision++}broadcast();render();settle()}
 node('[data-chess-draw]').onclick=()=>{if(!session||session.result||disconnected)return;const accept=session.drawOffer!==null&&session.drawOffer!==localSide;if(role==='host'){if(accept)replyDraw(0,true);else offerDraw(0)}else packet(accept?'DRAW_REPLY':'DRAW_OFFER',{id:room.id,...(accept?{accept:true}:{})})};
 node('[data-chess-decline]').onclick=event=>{event?.preventDefault();if(role==='host')replyDraw(0,false);else packet('DRAW_REPLY',{id:room.id,accept:false})};
 function resign(){if(!session||session.result||disconnected)return;if(role==='host'){if(!session.tick(now()))session.finish(1,'resign',now());broadcast();render();settle()}else packet('RESIGN',{id:room.id})}
 node('[data-chess-resign]').onclick=resign;
 async function resetRoom(){
  if(role!=='host'||!session?.result||!conn?.open)return;const previous=session,current=epoch;await savePromise;if(epoch!==current||session!==previous)return;
  const profiles=room.profiles.map(p=>bridge.latest(p));room={...room,id:'chess-'+bridge.uid(),profiles,ready:[false,false],config:0,editable:true};delete room.starting;session=null;localReady=false;selected=null;disconnected=false;screen.hidden=true;$('lobby').hidden=false;$('pvpMenu').hidden=false;document.body.classList.remove('in-chess');renderRoom();sendRoom();
 }
 node('[data-chess-rematch]').onclick=()=>{if(!session?.result||!conn?.open)return;if(role==='host')resetRoom();else{packet('REMATCH',{id:room.id});node('[data-chess-status]').textContent='Đang chờ chủ phòng mở lại phòng chờ…'}};
 node('[data-chess-leave]').onclick=()=>{if(session&&!session.result&&!disconnected){resign();node('[data-chess-status]').textContent='Đã xin thua. Khi kết quả hiện ra, bấm Thoát.';return}destroy();menu(false);$('lobby').hidden=false;$('pvpMenu').hidden=true;bridge.refresh()};
 node('[data-chess-pgn]').onclick=event=>{event?.preventDefault();if(!session)return;const result=session.result?(session.result.winner===null?'1/2-1/2':session.result.winner===0?'1-0':'0-1'):'*';session.game.header('Event','Anh Hung Hao Kiet - Chess','White',room.profiles[0].name,'Black',room.profiles[1].name,'TimeControl',String(room.time.minutes*60)+'+'+room.time.increment,'Result',result);const text=session.game.pgn();const url=URL.createObjectURL(new Blob([text],{type:'application/x-chess-pgn;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='quickdrawn-chess.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 function pieceElement(key){const el=document.createElement('span');el.className='chess-piece';el.style.backgroundImage='var(--chess-'+key+',none)';el.textContent=unicode[key];el.setAttribute('aria-hidden','true');return el}
 function recentMoveRows(history,playerSide){
  const pairs=Math.ceil(history.length/2),start=Math.max(0,pairs-5),ownColor=playerSide===0?'w':'b';
  return Array.from({length:5},(_,offset)=>{const index=start+offset,white=history[index*2],black=history[index*2+1],own=ownColor==='w'?white:black,opponent=ownColor==='w'?black:white;return {number:index+1,own:own?.san||'',opponent:opponent?.san||''}});
 }
 function renderRecentMoves(history){
  const moves=node('[data-chess-moves]');moves.replaceChildren();
  for(const pair of recentMoveRows(history,localSide)){
   const row=document.createElement('div');row.className='chess-move-pair';
   for(const [actor,value]of [['opponent',pair.opponent],['player',pair.own]]){const cell=document.createElement('span');cell.dataset.chessMoveActor=actor;cell.textContent=value?pair.number+'. '+value:'—';if(!value)cell.className='is-empty';row.append(cell)}
   moves.append(row);
  }
 }
 function capturedGroups(history,playerSide){
  const ownColor=playerSide===0?'w':'b',victimColor=playerSide===0?'b':'w',counts={};
  for(const move of history)if(move.color===ownColor&&move.captured)counts[move.captured]=(counts[move.captured]||0)+1;
  return Array.from('qrbnp').filter(piece=>counts[piece]).map(piece=>({key:victimColor+piece,piece,count:counts[piece]}));
 }
 function renderCapturedPieces(history){
  for(const playerSide of [0,1]){
   const tray=node('[data-chess-captured="'+playerSide+'"]'),groups=capturedGroups(history,playerSide),below=playerSide===localSide;
   tray.replaceChildren();tray.dataset.boardSide=below?'below':'above';
   const pawns=document.createElement('div'),pieces=document.createElement('div');
   pawns.className=pieces.className='chess-capture-row';pawns.dataset.captureRow='pawns';pieces.dataset.captureRow='pieces';
   pawns.setAttribute('aria-label','Tốt đã ăn');pieces.setAttribute('aria-label','Hậu, xe, tượng, mã đã ăn');
   if(below){tray.append(pieces);tray.append(pawns)}else{tray.append(pawns);tray.append(pieces)}
   if(!groups.length){const empty=document.createElement('span');empty.className='chess-captured-empty';empty.textContent='Chưa ăn quân';pieces.append(empty);continue}
   for(const {key,piece,count}of groups){const group=document.createElement('span');group.className='chess-capture-group';group.dataset.piece=key;group.dataset.count=String(count);group.setAttribute('aria-label',count+' '+pieceNames[piece]+' '+(key[0]==='w'?'trắng':'đen'));group.append(pieceElement(key));if(count>1){const badge=document.createElement('span');badge.className='chess-capture-count';badge.textContent=String(count);badge.setAttribute('aria-hidden','true');group.append(badge)}(piece==='p'?pawns:pieces).append(group)}
  }
 }

 function render(){
  if(!session||screen.hidden)return;const g=session.game,history=g.history({verbose:true}),last=history.at(-1),legal=selected?new Set(g.moves({square:selected,verbose:true}).map(m=>m.to)):new Set();
  if(drawnRevision!==session.revision||board.dataset.selected!==(selected||'')){
   const focusSquare=document.activeElement?.dataset.chessSquare;board.replaceChildren();const ranks=localSide?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1],files=localSide?'hgfedcba':'abcdefgh';
   ranks.forEach((rank,r)=>Array.from(files).forEach((file,c)=>{const sq=file+rank,p=g.get(sq),button=document.createElement('button');button.type='button';button.dataset.chessSquare=sq;button.className='chess-square '+(((file.charCodeAt(0)-97+rank)%2===0)?'light':'dark');if(legal.has(sq))button.classList.add('is-legal');if(selected===sq)button.classList.add('is-selected');if(last&&(last.from===sq||last.to===sq))button.classList.add('is-last');if(p?.type==='k'&&p.color===g.turn()&&g.isCheck())button.classList.add('is-check');button.setAttribute('role','gridcell');button.setAttribute('aria-label',sq+(p?' · '+(p.color==='w'?'Trắng ':'Đen ')+pieceNames[p.type]:''));button.setAttribute('aria-selected',selected===sq?'true':'false');button.tabIndex=sq===(focusSquare||'e2')?0:-1;if(r===7)button.dataset.file=file;if(c===0)button.dataset.rank=rank;if(p)button.append(pieceElement(p.color+p.type));button.onclick=()=>chooseSquare(sq);button.onkeydown=event=>{const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];if(offset===undefined)return;event.preventDefault();const target=board.children[Math.max(0,Math.min(63,r*8+c+offset))];for(const b of board.children)b.tabIndex=-1;target.tabIndex=0;target.focus()};board.append(button)}));
   board.dataset.selected=selected||'';drawnRevision=session.revision;if(focusSquare)board.querySelector('[data-chess-square="'+focusSquare+'"]')?.focus();
   renderRecentMoves(history);renderCapturedPieces(history);
  }
  node('[data-chess-resign]').disabled=!!session.result||disconnected;node('[data-chess-draw]').disabled=!!session.result||disconnected||session.drawOffer===localSide;const accepting=session.drawOffer!==null&&session.drawOffer!==localSide;node('[data-chess-action-label="draw"]').textContent=accepting?'Đồng ý':'Hòa';node('[data-chess-draw]').setAttribute('aria-label',accepting?'Chấp nhận hòa':'Xin hòa');node('[data-chess-draw]').setAttribute('title',accepting?'Chấp nhận hòa':'Xin hòa');node('[data-chess-decline]').hidden=session.result||session.drawOffer===null||session.drawOffer===localSide;node('[data-chess-rematch]').hidden=false;node('[data-chess-rematch]').disabled=!session.result||disconnected;node('[data-chess-leave]').setAttribute('aria-label',session.result||disconnected?'Thoát về sảnh':'Thoát ván (xin thua)');
  if(!disconnected)node('[data-chess-status]').textContent=session.result?(session.result.winner===null?'HÒA':session.result.winner===localSide?'BẠN THẮNG':'BẠN THUA')+' · '+reasons[session.result.reason]:pendingMove?'Đang gửi nước đi…':session.drawOffer!==null&&session.drawOffer!==localSide?'Đối thủ đề nghị hòa.':(session.turn===localSide?'Lượt của bạn':'Lượt đối thủ')+(g.isCheck()?' · CHIẾU!':'');
  renderClocks();
 }
 function renderClocks(){if(!session)return;const clocks=session.remaining(now()),key=clocks.map(n=>Math.ceil(n/1000)).join(':')+session.turn+!!session.result;if(key===lastClock)return;lastClock=key;for(let i=0;i<2;i++){const seconds=Math.ceil(clocks[i]/1000),el=node('[data-chess-clock="'+i+'"]');el.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');el.classList.toggle('is-ticking',!session.result&&session.turn===i);el.classList.toggle('is-low',seconds<=30)}}
 setInterval(()=>{if(!enabled||!session||disconnected||session.result)return;if(role==='host'){if(session.tick(now())){broadcast();render();settle()}else if(now()-lastSync>=1000)broadcast()}renderClocks()},100);
 node('[data-chess-apply-time]').onclick=editTime;
 node('[data-open-chess]').onclick=open;
 $('openPvpMenu').onclick=()=>{destroy();menu(false);original.pvp()};
 $('host').onclick=()=>enabled?create():original.host();$('join').onclick=()=>enabled?join():original.join();
 $('closePvpMenu').onclick=()=>{if(!enabled){original.close();return}destroy();menu(false);$('pvpMenu').hidden=true;node('[data-open-chess]').focus()};
 node('[data-pvp-ready]').addEventListener('click',()=>{if(enabled)ready()});
 window.addEventListener('pagehide',()=>{if(enabled){const c=conn,p=peer;conn=null;peer=null;c?.close();p?.destroy()}});
 // Atlas rectangles include padding; source dimensions are validated before extraction.
 (async()=>{try{const base=new URL('../assets/images/chess/',document.currentScript?.src||new URL('./js/chess.js',location.href)),manifest=await(await fetch(new URL('chess_viet_sprites.json',base))).json(),image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=new URL(manifest.file,base)});if(image.naturalWidth!==manifest.width||image.naturalHeight!==manifest.height)throw Error('Chess atlas dimensions');for(const [key,rect]of Object.entries({...manifest.pieces,...manifest.tiles})){const [x,y,w,h]=rect;if(!rect.every(Number.isInteger)||x<0||y<0||w<1||h<1||x+w>image.naturalWidth||y+h>image.naturalHeight)throw Error('Chess rectangle');const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,Math.floor(x),Math.floor(y),w,h,0,0,w,h);screen.style.setProperty('--chess-'+key,'url("'+c.toDataURL('image/png')+'")')}screen.classList.add('chess-sprites-ready')}catch(error){console.warn('Chess sprites unavailable; using readable chess symbols.',error.message)}})();
})();
