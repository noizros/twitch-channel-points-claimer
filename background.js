const KEY='noizros_claims', ATT='noizros_attempts';
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender)=>{
 if(!['CLAIM_ATTEMPT','CLAIM_UI_SUCCESS'].includes(message?.type) || !sender.url?.startsWith('https://www.twitch.tv/'))return;
 const channel=message.channel;
 if(typeof channel!=='string'||!/^[a-z0-9_]{1,25}$/.test(channel))return;
 queue=queue.then(async()=>{
  const key=message.type==='CLAIM_ATTEMPT'?ATT:KEY;
  const data=await chrome.storage.local.get(key);
  const stats=data[key]||{};stats[channel]=(stats[channel]||0)+1;
  await chrome.storage.local.set({[key]:stats});
 }).catch(()=>{});
});