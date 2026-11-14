'use strict';
// Only metadata is read; only game-scoped standings/result documents are written.
class SharedStandingService{
 constructor(config){this.config=config;this.db=null;this.profileCache=new Map();this.listeners=[];this.seen=new Set();this.state='offline'}
 async start(onRows){
  if(typeof firebase==='undefined')throw new Error('Firebase SDK unavailable');
  const app=firebase.apps.find(app=>app.name==='quickdrawn-shared')||firebase.initializeApp(this.config,'quickdrawn-shared');
  this.db=app.firestore();this.db.settings({ignoreUndefinedProperties:true,merge:true});
  // Firestore's cache is separate from the externally owned LexicalSpaceDB.
  await this.db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  this.unsubscribe=this.db.collection('standings').where('gameId','==','quickdrawn').onSnapshot({includeMetadataChanges:true},snapshot=>{
   const rows=snapshot.docs.map(doc=>doc.data()).filter(row=>row.gameId==='quickdrawn'&&typeof row.id==='string');
   this.state=snapshot.metadata.fromCache?'cached':'online';onRows(rows,this.state);
  },()=>{this.state='offline';onRows(null,'offline')});
  const profiles=await this.deadline(this.db.collection('metadata').get());
  profiles.docs.forEach(doc=>{const data=doc.data();if(typeof data.username==='string'&&data.username.trim()){const name=data.username.trim();this.profileCache.set(name,{username:name})}});
  return [...this.profileCache.keys()].sort((a,b)=>a.localeCompare(b));
 }
 deadline(promise,ms=6000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Cloud timeout')),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})})}
 async profile(name){
  if(!this.db||!name)return null;
  if(this.profileCache.has(name))return this.profileCache.get(name);
  const snapshot=await this.deadline(this.db.collection('metadata').where('username','==',name).limit(1).get());
  if(snapshot.empty)return null;
  const username=snapshot.docs[0].data().username;if(typeof username!=='string'||username.trim()!==name)return null;
  const profile={username:name};this.profileCache.set(name,profile);return profile;
 }
 ref(id){return this.db.collection('standings').doc('quickdrawn__'+id)}
 async player(id){const snapshot=await this.deadline(this.ref(id).get());return snapshot.exists?snapshot.data():null}
 async sync(result,profile){
  const key=profile.id+':'+result.id;if(this.seen.has(key))return;
  if(!await this.profile(profile.name))throw new Error('Profile not found in Homepage metadata');
  const ref=this.ref(profile.id),event=ref.collection('results').doc(result.matchId);
  await this.deadline(this.db.runTransaction(async transaction=>{
   const [saved,current]=await Promise.all([transaction.get(event),transaction.get(ref)]);if(saved.exists)return;
   const row=current.exists?current.data():{id:profile.id,name:profile.name,elo:1000,wins:0,losses:0,matchesPlayed:0,maxDeckSize:0,bestSurvivalScore:0};
   if(!Number.isSafeInteger(row.elo)||row.elo<100||!['wins','losses','matchesPlayed','maxDeckSize'].every(key=>Number.isSafeInteger(row[key])&&row[key]>=0))throw new Error('Invalid remote standing');
   const elo=Math.max(100,row.elo+result.deltaElo),win=result.outcome==='win',time=firebase.firestore.FieldValue.serverTimestamp();
   const player={id:profile.id,username:profile.name,name:profile.name,gameId:'quickdrawn',elo,wins:row.wins+(win?1:0),losses:row.losses+(win?0:1),matchesPlayed:row.matchesPlayed+1,maxDeckSize:Math.max(row.maxDeckSize,result.deckSize),bestSurvivalScore:Math.max(row.bestSurvivalScore||0,result.mode==='pvc'?result.correctCount:0),updatedAt:time};
   transaction.set(ref,player,{merge:true});transaction.set(event,{...result,gameId:'quickdrawn',username:profile.name,serverEloBefore:row.elo,serverEloAfter:elo,syncedAt:time});
  }));this.seen.add(key);
 }
}
