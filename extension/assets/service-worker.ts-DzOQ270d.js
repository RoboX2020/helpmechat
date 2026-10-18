import{a as W,f as Y,b as H}from"./conversation-JZAHGSK4.js";import{f as G,p as K}from"./parser-DWo8a-Cu.js";const y={apiBaseUrl:"https://helpmechat-api-prep.prajval-2029.workers.dev",replyModels:["gpt-4.1-mini-2025-04-14","gpt-4.1-mini-2025-04-14"],profileModels:["gpt-4.1-mini-2025-04-14","gpt-4.1-mini-2025-04-14"]};function D(t,e){const a=e.filter(l=>l.contactName===t).slice(-15);if(a.length<2)return"";const r=a.slice(-6),n=r.reduce((l,c)=>l+c.pickedIndex,0)/r.length,s=r.reduce((l,c)=>l+c.pickedText.split(/\s+/).filter(Boolean).length,0)/r.length,i=[`LEARNED (soft hint — adapt, don't copy blindly): In chats with ${t}, user picked ${r.length} suggestions recently.`];n>=3?i.push("They often choose bolder/creative options (4th–5th) — lean creative but stay natural."):n>=1.8?i.push("They mix safe and bold — keep variety with slight lean toward mid/bold options."):i.push("They often pick direct/safe early options — keep #1–2 strong and concise."),i.push(`Picked messages run ~${Math.round(s)} words.`);const o=r.slice(-2).map(l=>l.pickedText.slice(0,70)).filter(Boolean);return o.length&&i.push(`Tone they actually sent: ${o.map(l=>`'${l}'`).join(" · ")}`),i.join(" ")}function J(t,e){return[...t.filter(r=>!(r.contactName===e.contactName&&r.triggerKey===e.triggerKey&&r.pickedIndex===e.pickedIndex)),e].slice(-15*3)}function z(t,e){return t.filter(a=>a.contactName===e).slice(-15)}const Q={dataConsent:!1,backendToken:"",myDisplayName:"",profile:null,contactContexts:{},suggestionPicks:[]};async function m(){const e=(await chrome.storage.local.get("settings")).settings;return{...Q,...e,suggestionPicks:(e==null?void 0:e.suggestionPicks)??[]}}async function w(t){const a={...await m(),...t};return await chrome.storage.local.set({settings:a}),a}async function q(t){await w({profile:t})}async function X(t){const e=await m();await w({suggestionPicks:J(e.suggestionPicks,t)})}function P(t,e){return D(e,z(t.suggestionPicks,e))}const V=/(a|i|ya|ika|een|vi|ni|sha|ita|priya|devi|bai|ben)$/i,Z=/\b(bhai|bro|yaar|bhaiya|dada|tau|chacha|mama|fufa|jija|devr|bhanja|beta|putter)\b/i,ee=/\b(didi|behen|ben|aunty|mummy|maa|nani|dadi|bhabhi|nanad|beti|gudiya|jaan|jaanu)\b/i,te=/\b(mummy|papa|maa|dad|mom|bhai|behen|didi|bhabhi|chacha|mama|nani|dadi|family|ghar|gharpe|rishtedaar|relative|beta|beti)\b/i,ae=/\b(gussa|angry|annoyed|naraz|khafa|uthao mat|chup|bakwas|stupid|hate|block|ignore)\b|mat kar|mat bol|seriously\?|\?{2,}|!{2,}/i,re=/\b(jaan|jaanu|baby|babe|miss you|cute|handsome|beautiful|date|milte|single|crush|love you|pyaar|❤|😘|🥰|😍)\b/i;function ne(t){const e=t.trim().split(/\s+/)[0].toLowerCase();if(!e)return"unknown";const a=/^(priya|pooja|neha|anjali|kavya|shreya|aisha|sana|riya|diya|nisha|simran|kiran|meera|tanya|ishita|aditi|pari|muskan|sakshi|divya|ananya|radha|sita|geeta|lakshmi|swati|palak|ishani|navya|aarti|kajal|sonam|deepika|kareena|aliya|fatima|zara|heena|ruhi|suhana|myra|anvi|aadhya|kiara|naina|rhea|siya|trisha|vani|yamini|zoya)/,r=/^(rahul|rohan|amit|arjun|vikram|raj|karan|aditya|nikhil|varun|siddharth|rohit|manish|suresh|ramesh|ajay|vijay|sanjay|deepak|anil|vinod|prakash|akash|dev|kunal|harsh|yash|aarav|vihaan|advait|ishaan|krishna|shiv|om|aryan|devesh|gautam|hardik|jatin|lokesh|mohit|naveen|pankaj|ravi|sachin|tarun|uday|vivek)/;return a.test(e)?"likely_female":r.test(e)?"likely_male":V.test(e)&&e.length>2?"likely_female":"unknown"}function ie(t){const e=t.slice(-12),a=e.filter(s=>!s.isMe).map(s=>s.text).join(" ").toLowerCase(),r=e.map(s=>s.text).join(" ").toLowerCase(),n=[];return ae.test(a)&&n.push("angry_or_upset"),re.test(r)&&n.push("flirty"),/\b(kal|aaj|shaam|subah|mil|plan|movie|coffee|dinner|kab|time|free|available|pick|drop)\b/i.test(r)&&n.push("planning"),/\b(sorry|maaf|galti|my bad|didn't mean|won't happen|forgive)\b/i.test(r)&&n.push("apology_needed"),/\b(kahan|kya kar|reply|seen|online|itna time|late|busy|phone)\b/i.test(a)&&n.push("ghosted_or_late_reply"),/\b(feel|sad|stress|anxious|problem|help|advice|life|family issue)\b/i.test(r)&&n.push("deep_talk"),n.length===0&&n.push("casual_banter"),[...new Set(n)]}function se(t,e){const a=ne(t),n=e.slice(-20).map(o=>o.text).join(" ").toLowerCase(),s=ie(e),i=[`Contact name (from chat header): "${t}"`,`Name gender hint: ${a}`];return a==="likely_male"?i.push("If tone is bro-y/casual → likely friend or brother/cousin. If formal/respectful → elder relative or colleague."):a==="likely_female"&&i.push("If family words (mummy, didi, rishtedaar vibe, very normal/platonic) → relative. If casual/flirty/late-night banter → friend or crush. Read the chat — don't assume crush unless vibe supports it."),te.test(n)&&i.push("Chat mentions family/home — lean relative/family dynamic."),Z.test(n)&&a==="likely_male"&&i.push("Uses bhai/yaar — close male friend or brother energy."),ee.test(n)&&i.push("Uses didi/behen/jaan — check if familial or romantic from context."),i.push(`Situation signals: ${s.join(", ")}`),i.join(`
`)}function oe(t){const e=t.slice(-15).map(s=>s.text).join(" ").toLowerCase(),r=/\b(haan|nahi|na|acha|accha|arre|yaar|bhai|mat|kya|hai|hoon|tha|thi|nhi|kyu|kyun|sun|bol|mil|kab|kal|aaj|shaam|subah|bohot|bahut|thik|theek|gussa|maaf|rishtedaar|ghar|yaad|sach|jhoot|pakka|scene|mast|badiya|chill|bas|dekh|sunna|bata|samjha|samajh|liye|tere|mera|meri|tera|teri|tu|tum|aap|ji)\b/i.test(e),n=/\b(the|you|what|how|why|sorry|please|thanks|love|hate|busy|meeting)\b/i.test(e);return r&&n?"hinglish":r?"hindi":n?"english":"mixed"}function T(t){let e=t.trim();const a=e.match(/^```(?:json)?\s*([\s\S]*?)```$/i);return a&&(e=a[1].trim()),e.replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'")}function k(t){return t.replace(/,\s*([}\]])/g,"$1")}function S(t){let e=t.trim();if(e.startsWith("{")&&!e.endsWith("}")){const a=(e.match(/\[/g)??[]).length-(e.match(/\]/g)??[]).length,r=(e.match(/\{/g)??[]).length-(e.match(/\}/g)??[]).length;(e.endsWith('"')||/[^\\]"[^"]*$/.test(e))&&(e+='"');for(let n=0;n<a;n++)e+="]";for(let n=0;n<r;n++)e+="}"}return e}function A(t){if(!t)return[];if(typeof t=="string"&&t.trim())return[t.trim()];if(!Array.isArray(t))return[];const e=[];for(const a of t){if(typeof a=="string"&&a.trim()){e.push(a.trim());continue}if(a&&typeof a=="object"){const r=a;for(const n of["text","reply","message","content","suggestion"])if(typeof r[n]=="string"&&r[n].trim()){e.push(r[n].trim());break}}}return e}function le(t){for(const e of["replies","suggestions","messages","options","responses"]){const a=A(t[e]);if(a.length>0)return a}return[]}function _(t,e){const r=new RegExp(`"${e}"\\s*:\\s*\\[`,"i").exec(t);if(!r)return[];let n=r.index+r[0].length;const s=[];let i="",o=!1,l=!1;for(;n<t.length;){const c=t[n];if(!o){if(c==="]")break;c==='"'&&(o=!0,i=""),n++;continue}if(l){c==="n"?i+=`
`:c==="t"?i+="	":c==="r"?i+="\r":c==='"'?i+='"':i+=c,l=!1,n++;continue}if(c==="\\"){l=!0,n++;continue}if(c==='"'){i.trim()&&s.push(i.trim()),o=!1,i="",n++;continue}if(c===`
`||c==="\r"){i+=" ",n++;continue}i+=c,n++}return o&&i.trim()&&s.push(i.trim()),s}function B(t){const e=t.search(/"replies"\s*:/i);if(e===-1)return[];const a=t.slice(e,e+4e3),r=[],n=/"((?:\\.|[^"\\]){2,})"/g;let s,i=!1;for(;(s=n.exec(a))!==null&&r.length<8;){const o=s[1].replace(/\\n/g," ").replace(/\\"/g,'"').trim();if(!i){i=!0;continue}o.length>1&&!/^(relationship|situation|coach|link|fact|gif|sticker|idea|excuse)$/i.test(o)&&r.push(o)}return r}function E(t,e){const a=new RegExp(`"${e}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,"i"),r=t.match(a);if(r)return r[1].replace(/\\n/g,`
`).replace(/\\"/g,'"').trim()}function ce(t){const e=[],a=t.search(/"coach"\s*:/i);if(a===-1)return e;const r=t.slice(a,a+2500),n=/\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"content"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/g;let s;for(;(s=n.exec(r))!==null&&e.length<3;)e.push({type:s[1],label:s[2].replace(/\\n/g,`
`),content:s[3].replace(/\\n/g,`
`)});return e}function he(t){const e=[t,k(t),S(t),S(k(t))];for(const a of e)try{const r=JSON.parse(a);if(Array.isArray(r)){const n=A(r);if(n.length)return{replies:n}}if(r&&typeof r=="object"){const n=r,s=le(n);if(s.length)return{relationship:typeof n.relationship=="string"?n.relationship:void 0,situation:typeof n.situation=="string"?n.situation:void 0,replies:s,coach:Array.isArray(n.coach)?n.coach:void 0,media:Array.isArray(n.media)?n.media:void 0}}}catch{}return null}function x(t){var n;const e=T(t),a=he(e);if((n=a==null?void 0:a.replies)!=null&&n.length)return a;const r=_(e,"replies").length>0?_(e,"replies"):B(e);return{relationship:E(e,"relationship"),situation:E(e,"situation"),replies:r,coach:ce(e),media:ue(e)}}function ue(t){var i;const e=[],a=t.search(/"media"\s*:/i);if(a===-1)return e;const r=t.slice(a,a+3e3),n=/\{\s*"type"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"(?:\s*,\s*"previewUrl"\s*:\s*"((?:\\.|[^"\\])*)")?\s*\}/g;let s;for(;(s=n.exec(r))!==null&&e.length<4;)e.push({type:s[1],label:s[2].replace(/\\n/g," "),url:s[3].replace(/\\n/g," "),previewUrl:(i=s[4])==null?void 0:i.replace(/\\n/g," ")});return e}const p={tone:"casual and friendly",vocabulary:"everyday language",emojiUsage:"moderate",messageLength:"short to medium",humorStyle:"playful",formality:"casual"};function pe(t){const e=t&&typeof t=="object"?t:{},a=e.myStyle&&typeof e.myStyle=="object"?e.myStyle:{},r={tone:String(a.tone||p.tone),vocabulary:String(a.vocabulary||p.vocabulary),emojiUsage:String(a.emojiUsage||p.emojiUsage),messageLength:String(a.messageLength||p.messageLength),humorStyle:String(a.humorStyle||p.humorStyle),formality:String(a.formality||p.formality)},n=Array.isArray(e.situationalPatterns)?e.situationalPatterns.filter(o=>o&&typeof o=="object").map(o=>{const l=o;return{context:String(l.context||"general"),toneShift:String(l.toneShift||""),examplePhrases:Array.isArray(l.examplePhrases)?l.examplePhrases.map(String).filter(Boolean).slice(0,5):[]}}).slice(0,12):[],s=typeof e.analysisSummary=="string"&&e.analysisSummary.trim()?e.analysisSummary.trim():"Your communication profile was built from uploaded WhatsApp exports.",i=Array.isArray(e.participants)?e.participants.map(String).filter(Boolean).slice(0,50):[];return{myStyle:r,situationalPatterns:n,analysisSummary:s,participants:i}}function me(t){const e=T(t);for(const a of[e,k(e),S(e)])try{return pe(JSON.parse(a))}catch{}throw new Error("Could not parse profile JSON")}function U(t){const e=T(t);for(const r of[e,k(e),S(e)])try{const n=JSON.parse(r),s=typeof n.reply=="string"?n.reply.trim():typeof n.replies=="object"&&Array.isArray(n.replies)?String(n.replies[0]??"").trim():"";if(s)return{reply:s,situation:typeof n.situation=="string"?n.situation.trim():void 0}}catch{}const a=E(e,"reply")||B(e)[0];if(a!=null&&a.trim())return{reply:a.trim(),situation:E(e,"situation")||void 0};throw new Error("Could not parse quick chat reply")}async function ye(t,e,a,r,n=.92){var I,L,$,R,j,C;const s=await m();if(!s.dataConsent)throw new Error("Agree to AI data processing in settings first.");const{apiBaseUrl:i}=y;if(!s.backendToken)throw new Error("The hosted AI service is not connected yet.");const o=`${i.replace(/\/$/,"")}/v1/generate`;if(!o.startsWith("https://"))throw new Error("AI service must use HTTPS.");const l={temperature:n,responseMimeType:"application/json"};r&&(l.maxOutputTokens=r);const c=new AbortController,v=setTimeout(()=>c.abort(),45e3);let u;try{u=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${s.backendToken}`},body:JSON.stringify({model:a,systemInstruction:{parts:[{text:t}]},contents:[{role:"user",parts:[{text:e}]}],generationConfig:l}),signal:c.signal})}catch(d){throw d instanceof Error&&d.name==="AbortError"?new Error("AI request timed out — tap refresh to try again"):d}finally{clearTimeout(v)}const f=await u.json();if(!u.ok){const d=((I=f.error)==null?void 0:I.message)??`Gemini API error ${u.status}`,O=new Error(d);throw O.status=u.status,O}const h=(L=f.candidates)==null?void 0:L[0],b=(C=(j=(R=($=h==null?void 0:h.content)==null?void 0:$.parts)==null?void 0:R[0])==null?void 0:j.text)==null?void 0:C.trim(),M=(h==null?void 0:h.finishReason)??"";if(M==="SAFETY"||M==="BLOCKLIST")throw new Error("Response blocked — try a different chat");if(!b)throw new Error("Empty response from AI service");return b}async function g(t,e,a,r,n=.92){return ye(t,e,a[0],r,n)}const fe=`You are a communication analyst. Analyze exported chat logs and extract ONLY the user's general texting style.

STRICT PRIVACY RULES (these override everything else):
- Describe STYLE ONLY: tone, message-length habits, vocabulary and slang habits, emoji habits, humor TYPE, formality.
- NEVER output people's names or nicknames, specific messages or quotes, inside jokes, events, places, dates, relationships, or any detail that identifies a person or a specific conversation.
- Never copy any line from the chats into the output, not even short or generic-looking ones. Every phrase you output must be invented by you.
- Do not reference real plans, activities, places, debts, gifts, or events from the chats, even paraphrased. Invent unrelated examples that only demonstrate the style.
- If a pattern can only be shown by quoting private content, describe it generically instead (for example "uses short teasing one-liners" - never the actual lines).

Return JSON with this exact structure:
{
  "myStyle": {
    "tone": "overall tone description, style only",
    "vocabulary": "word-choice style, slang frequency, formality level, no quoted phrases",
    "emojiUsage": "how and when they use emojis",
    "messageLength": "short bursts vs paragraphs",
    "humorStyle": "type of humor, never the jokes themselves",
    "formality": "casual/formal spectrum"
  },
  "situationalPatterns": [
    {
      "context": "ONE generic label from this fixed list: joking around, making plans, catching up, asking for help, apologizing, sharing news, celebrating, resolving a disagreement",
      "toneShift": "how their tone shifts in that situation, described generically"
    }
  ],
  "analysisSummary": "2-3 paragraphs on texting personality: how they come across, strengths, awkward spots. Style only, no names and no specific content."
}

This powers a reply assistant. It must capture HOW they talk, never WHAT was said or WHO said it.`;async function de(t){const e=t.map(r=>`=== Chat: ${r.chatName} (participants: ${r.participants.join(", ")}, you are: ${r.myName}) ===
${G(r.messages,150)}`).join(`

`),a=await g(fe,`Analyze these WhatsApp exports. The user's name in chats is one of the participants — infer who "ME" is from context.

${e}`,y.profileModels,void 0,.85);return me(a)}const ge=`You are HelpMeChat — an elite ghostwriter for Indian WhatsApp. You write AS ME (the user), never as the other person.

WORKFLOW (do this mentally before writing):
1) Read contact name + full thread
2) Decide who they likely are: brother/friend/crush/girlfriend/relative/colleague — from name + how we talk
3) Read the situation: angry? flirting? planning? need excuse? cold reply?
4) Write 5 replies ME would actually send — bold, human, Hinglish if the chat is Hinglish

- NEVER use double-quote characters inside reply text (use single quotes or rephrase)
- If a reply needs a line break, keep it on one line — no literal newlines inside JSON strings

Return JSON ONLY:
{
  "relationship": "1 line: who they likely are to ME and confidence",
  "situation": "1 line: what's happening right now emotionally",
  "replies": ["5 copy-paste WhatsApp messages from ME"],
  "coach": [0-1 items for links/facts only],
  "media": [1-3 items — GIFs, memes, images; see below]
}

REPLY MIX (always 5, all must be full sendable messages):
1) Safe/direct — fits the vibe
2) Creative EXCUSE woven into actual text if needed ("arre yaar kal itna busy tha", "rishtedaar aaye hue the ghar pe", "phone off tha bhai")
3) Bold MOVE — made-up plan, surprise, smooth recovery ("acha sun shaam ko mil, surprise hai tere liye", "kal pakka, scene set kar raha hoon")
4) Playful/flirty OR bro-energy OR family-warm — match relationship
5) Short punchy option — minimal words if thread is short

RULES:
- Privacy: the style profile and past chats are for STYLE only - never mention names, inside jokes, events, or specific content from any other conversation; only the current thread may be referenced.
- Match language: Hinglish chat → Hinglish replies. Never stiff English in desi banter.
- Match length: short thread = short replies. NO essays in quick back-and-forth.
- Invent believable details (plans, excuses, stories) — sound real, not AI
- If they're angry/upset: de-escalate + charm + concrete plan in the message itself
- If crush/flirty: confident, not creepy, not pick-up-artist
- If brother/friend: yaar/bhai energy, roasts OK
- If relative: respectful but still natural WhatsApp tone
- Stickers show as [sticker: ...] — match energy; suggest media when a GIF/meme fits better than words
- NEVER write as the other person responding to ME
- Push creativity — be the friend who always knows what to text

MEDIA array (1-3 when visual fits — funny, flirty, apology, celebration, angry meme):
{"type":"gif|meme|image|sticker|video","label":"3-5 word title","url":"HTTPS link — prefer giphy.com/search/TERM, tenor.com/search/TERM-gifs, or direct media.giphy.com/... URL","previewUrl":"optional thumbnail URL if known"}
Examples: giphy search for awkward smile, tenor for happy dance, meme for roast banter. Real working URLs only.`,be=`You write WhatsApp replies for ME (the user). Return ONLY valid JSON, nothing else:
{"replies":["message1","message2","message3","message4","message5"]}

Rules: exactly 5 strings, copy-paste ready, match the chat language (Hinglish if desi). No double-quote characters inside messages. No newlines inside strings.`;function F(t){return A(x(t).replies)}function N(t,e,a,r){const n=Y(t.contactName,t.messages),s=se(t.contactName,t.messages),i=oe(t.messages);let o="";a!=null&&a.myStyle&&(o=`ME's real voice (from past chats): ${a.myStyle.tone}. Vocab: ${a.myStyle.vocabulary}. Humor: ${a.myStyle.humorStyle}. Formality: ${a.myStyle.formality}. Typical length: ${a.myStyle.messageLength}.
`);const l=r!=null&&r.trim()?`
=== USER PICK HISTORY (soft hint only) ===
${r}
`:"";return`${o}${l}
=== WHO AM I TEXTING ===
${s}

Language of thread: ${i}
Informality: ${e.informality}. ${e.styleHint}
Hard max ~${e.maxWordsPerReply} words per reply unless situation needs one slightly longer smooth line.

=== FULL THREAD (numbered, oldest→newest) ===
${n}`}function we(t,e,a,r){return`${N(t,e,a,r)}

=== MY TASK ===
MODE: REPLY TO THEM
${t.contactName}'s latest message(s) — ME must respond TO this:
"""
${e.pendingBlock}
"""

Write 5 replies AS ME addressing ${t.contactName}. Include at least one creative excuse AND one bold plan/surprise/smooth line IN the reply text when the situation allows.`}function ke(t,e,a,r){const{earlier:n,myLastMessages:s}=H(t.contactName,t.messages);return`${N(t,e,a,r)}

=== MY TASK ===
MODE: FOLLOW-UP / DOUBLE-TEXT (ME spoke last)
ME already sent:
"""
${s}
"""

${n?`Earlier context:
${n}
`:""}
Write 5 MORE messages from ME — continuing, clarifying, adding a plan, or dropping a smooth follow-up. NOT ${t.contactName} replying to ME.
Examples of good follow-ups: "wait sun", "acha ek baat bata", "kal pakka milte hai", "btw rishtedaar the isliye reply nahi kar paya".
Include creative excuses or made-up plans IN the message text when useful.`}function Se(t){if(!(t!=null&&t.length))return[];const e=new Set(["link","fact","gif","sticker","idea","excuse"]);return t.filter(a=>{var r,n;return((r=a.content)==null?void 0:r.trim())&&((n=a.label)==null?void 0:n.trim())}).map(a=>({type:e.has(a.type??"")?a.type:"idea",label:a.label.trim(),content:a.content.trim()})).slice(0,2)}function Ee(t){if(!(t!=null&&t.length))return[];const e=new Set(["gif","meme","image","sticker","video"]);return t.filter(a=>{var r,n;return((r=a.url)==null?void 0:r.trim())&&((n=a.label)==null?void 0:n.trim())&&/^https?:\/\//i.test(a.url.trim())}).map(a=>{var r;return{type:e.has(a.type??"")?a.type:"gif",label:a.label.trim(),url:a.url.trim(),previewUrl:(r=a.previewUrl)!=null&&r.trim().startsWith("http")?a.previewUrl.trim():void 0}}).slice(0,3)}async function ve(t,e,a){var f,h;const r=t.state??W(t.contactName,t.messages);if(!r)return{replies:[],contextLabel:"",coach:[]};const n=r.replyMode==="follow_up_mine",s=n?ke(t,r,e,a):we(t,r,e,a);let i=await g(ge,s,y.replyModels,2048,.94),o=x(i),l=F(i);if(l.length===0){const b=`${n?"FOLLOW-UP: ME spoke last, write 5 more messages from ME.":`REPLY TO ${t.contactName}:`}
Their/latest context:
${r.pendingBlock}

Thread tail:
${Y(t.contactName,t.messages.slice(-8))}`;i=await g(be,b,y.replyModels,1024,.85),o=x(i),l=F(i)}if(l.length===0)throw new Error("AI returned no replies — tap refresh or send another message");const c=((f=o.relationship)==null?void 0:f.trim())??"",v=((h=o.situation)==null?void 0:h.trim())??"",u=c?`${r.turnLabel} · ${c}`:r.turnLabel;return{replies:l.slice(0,5),contextLabel:u,relationship:c,situation:v,coach:Se(o.coach),media:Ee(o.media)}}const xe=`You are HelpMeChat Quick Chat — auto-reply ghostwriter for WhatsApp. Write ONE message AS ME (the user).

QUICK CHAT RULES (strict):
- Reply ONLY to their latest message — they spoke last
- Safe, warm, natural — match thread language (Hinglish if desi)
- Creative excuses OK when needed ("phone dead tha", "busy day", "network issue")
- NO COMMITMENTS: never promise meetings, dates, money, gifts, definite plans
- Avoid: pakka, 100%, definitely, "kal milte hain", "I'll pay", "I promise", concrete times/places
- Soft deflection OK: "dekhte hain", "shayad", "try karunga" — not binding promises
- Match message length — short thread = short reply
- No double-quote characters inside the reply text
- One copy-paste ready message only
- Privacy: never mention names, jokes, events, or details from other chats - the profile is for style only.

Return JSON ONLY:
{"reply":"your single message here","situation":"1 line what's happening"}`;function Te(t,e,a,r){return`${N(t,e,a,r)}

=== QUICK CHAT TASK ===
They sent:
"""
${e.pendingBlock}
"""

Write ONE safe reply AS ME to ${t.contactName}. Excuses fine. No commitments or definite plans.`}async function Ae(t,e,a){var o,l;const r=t.state??W(t.contactName,t.messages);if(!r)throw new Error("No conversation to reply to");if(r.replyMode!=="reply_to_them")throw new Error("Quick chat only replies when they message you");const n=Te(t,r,e,a);let s=await g(xe,n,y.replyModels,512,.75),i;try{i=U(s)}catch{s=await g('Return ONLY: {"reply":"one safe WhatsApp message from ME"}',`Reply to ${t.contactName}: ${r.pendingBlock}
No commitments. Excuses OK.`,y.replyModels,256,.7),i=U(s)}if(!((o=i.reply)!=null&&o.trim()))throw new Error("AI returned no quick chat reply");return{reply:i.reply.trim(),situation:(l=i.situation)==null?void 0:l.trim()}}chrome.runtime.onMessage.addListener((t,e,a)=>(Ne(t).then(a).catch(r=>a({error:r.message})),!0));async function Ne(t){switch(t.type){case"CLEAR_DATA":return await chrome.storage.local.clear(),{ok:!0};case"GET_SETTINGS":return m();case"SAVE_SETTINGS":return w(t.payload);case"ANALYZE_EXPORT":{const{files:e,myName:a}=t.payload;if(!(a!=null&&a.trim()))throw new Error("Enter your name as it appears in WhatsApp exports.");await w({myDisplayName:a.trim()});const r=e.map(o=>K(o.content,o.name,a.trim()));if(r.reduce((o,l)=>o+l.messages.length,0)===0)throw new Error("No messages found in exports. Check your name matches WhatsApp exactly and files are .txt exports.");const s=await de(r),i={id:crypto.randomUUID(),createdAt:new Date().toISOString(),sourceFiles:e.map(o=>o.name),...s};return await q(i),{profile:i,parsedCount:r.length,messageCount:r.reduce((o,l)=>o+l.messages.length,0)}}case"GET_SUGGESTIONS":{const{snapshot:e}=t.payload,a=await m();if(!a.profile)throw new Error("Build your profile first — extension icon → Get started");const r=P(a,e.contactName);return ve(e,a.profile,r)}case"GET_QUICK_CHAT_REPLY":{const{snapshot:e}=t.payload,a=await m();if(!a.profile)throw new Error("Build your profile first — extension icon → Get started");const r=P(a,e.contactName);return Ae(e,a.profile,r)}case"RECORD_PICK":{const{pick:e}=t.payload;return await X(e),{ok:!0}}default:throw new Error(`Unknown message type: ${t.type}`)}}

;(()=>{async function injectExistingTabs(){let tabs;try{tabs=await chrome.tabs.query({url:["https://web.whatsapp.com/*"]})}catch(e){return}for(const tab of tabs){if(!tab||tab.id==null)continue;try{await chrome.scripting.insertCSS({target:{tabId:tab.id},files:["src/content/panel.css"]});await chrome.scripting.executeScript({target:{tabId:tab.id},files:["assets/whatsapp.ts-loader-Q-5kkHf_.js"]})}catch(e){}}}chrome.runtime.onInstalled.addListener(()=>{injectExistingTabs()});chrome.runtime.onStartup.addListener(()=>{injectExistingTabs()});})();
