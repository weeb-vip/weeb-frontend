import{a4 as S,Z as J,_ as N,V as Q,ai as R,k as o,a3 as U,a5 as W,w as $,M as y,ag as g,p as i,P as r,aj as n,a0 as X,ad as Y,r as ee,K as ae}from"./iframe-BBy3qS7V.js";import"./legacy-B5CYqdZO.js";import{e as se,i as re}from"./each-B7aOw8gM.js";import{s as d,c as te}from"./class-CJmGtk23.js";import{S as oe}from"./StoryContainer-CMj7yAIp.js";import"./preload-helper-D4nn9Y_6.js";import"./slot-ChEXTifl.js";import"./style-D6J7hmdZ.js";var ie=y('<div class="w-2/3 h-3 bg-weeb-surface rounded"></div> <div class="w-1/2 h-3 bg-weeb-surface rounded"></div> <div class="w-2/3 h-3 bg-weeb-surface rounded"></div>',1),ne=y("<div></div>"),de=y('<div><div></div> <div class="flex flex-col justify-between px-4 py-3 w-full h-full"><div class="space-y-2"><div class="w-full h-4 bg-weeb-surface rounded"></div> <!></div> <div class="pt-3"><div></div></div></div></div>');function le(Z,p){W(p,!1);const a=X();let f=S(p,"style",8,"default"),v=S(p,"forceListLayout",8,!1);function q(s,e){const t=`flex ${e?"flex-row":"sm:flex-row md:flex-col"} ${s==="transparent"?"bg-transparent":"bg-weeb-surface"} rounded-md shadow-sm w-full transition-colors duration-300 overflow-hidden animate-pulse`;switch(s){case"long":return{container:`${t} w-96 h-40`,image:`${e?"w-40 sm:w-48":"w-64 sm:w-72 md:w-80"} aspect-2/3`,lines:5,isEpisode:!1};case"detail":return{container:`${t} min-h-[180px]`,image:`${e?"w-32 sm:w-40":"w-40 sm:w-48 md:w-56"} aspect-2/3`,lines:4,isEpisode:!1};case"episode":return{container:`${t} ${e?"h-40":"h-44"}`,image:`${e?"w-24 sm:w-28 md:w-32":"w-32 sm:w-40 md:w-44"} aspect-2/3`,lines:4,isEpisode:!0};case"hover":case"hover-transparent":case"default":default:return{container:`${t} w-48 h-72`,image:`${e?"w-28 md:w-32":"w-32 sm:w-40 md:w-48"} aspect-2/3`,lines:3,isEpisode:!1}}}J(()=>($(f()),$(v())),()=>{Y(a,q(f(),v()))}),N();var w=de(),h=i(w),z=g(h,2),_=i(z),B=g(i(_),2);{var F=s=>{var e=ie();o(s,e)},G=s=>{var e=ee(),b=ae(e);se(b,1,()=>(r(a),n(()=>Array(r(a).lines-1))),re,(t,ce,x)=>{var L=ne();d(L,1,`h-3 bg-weeb-surface rounded ${x===0?"w-2/3":x===1?"w-1/3":"w-1/4"}`),o(t,L)}),o(s,e)};Q(B,s=>{r(a),n(()=>r(a).isEpisode)?s(F):s(G,-1)})}var H=g(_,2),I=i(H);R(()=>{d(w,1,te((r(a),n(()=>r(a).container)))),d(h,1,`${r(a),n(()=>r(a).image)??""} bg-weeb-surface`),d(I,1,`h-8 rounded-full ${f()==="transparent"?"bg-weeb-surface-hover/60":"bg-weeb-surface-hover"} ${v()?"mx-0 w-24":"mx-auto w-24"}`)}),o(Z,w),U()}const he={title:"Design System/AnimeCardSkeleton",component:le,tags:["autodocs"],parameters:{layout:"centered"},decorators:[()=>({Component:oe,props:{width:"320px"}})],argTypes:{style:{control:"select",options:["default","hover","hover-transparent","transparent","long","detail","episode"]}}},l={args:{style:"default",forceListLayout:!1}},c={args:{style:"detail",forceListLayout:!1}},m={args:{style:"episode",forceListLayout:!1}},u={args:{style:"detail",forceListLayout:!0}};var E,k,D;l.parameters={...l.parameters,docs:{...(E=l.parameters)==null?void 0:E.docs,source:{originalSource:`{
  args: {
    style: 'default',
    forceListLayout: false
  }
}`,...(D=(k=l.parameters)==null?void 0:k.docs)==null?void 0:D.source}}};var C,A,j;c.parameters={...c.parameters,docs:{...(C=c.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    style: 'detail',
    forceListLayout: false
  }
}`,...(j=(A=c.parameters)==null?void 0:A.docs)==null?void 0:j.source}}};var K,M,O;m.parameters={...m.parameters,docs:{...(K=m.parameters)==null?void 0:K.docs,source:{originalSource:`{
  args: {
    style: 'episode',
    forceListLayout: false
  }
}`,...(O=(M=m.parameters)==null?void 0:M.docs)==null?void 0:O.source}}};var P,T,V;u.parameters={...u.parameters,docs:{...(P=u.parameters)==null?void 0:P.docs,source:{originalSource:`{
  args: {
    style: 'detail',
    forceListLayout: true
  }
}`,...(V=(T=u.parameters)==null?void 0:T.docs)==null?void 0:V.source}}};const _e=["Default","DetailStyle","EpisodeStyle","ListLayout"];export{l as Default,c as DetailStyle,m as EpisodeStyle,u as ListLayout,_e as __namedExportsOrder,he as default};
