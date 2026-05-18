import{ai as q,j as Te,m as ie,R as P,a7 as Ve,t as je,h as Be,g as Ge,a5 as Le,a4 as s,Z as Q,P as t,w as p,ad as k,_ as Se,r as se,K as X,V as O,aj as i,k as z,a3 as Me,a0 as D,ag as ne,O as Y,p as A,ae as qe,J as He,M as Ae}from"./iframe-BBy3qS7V.js";import"./legacy-B5CYqdZO.js";import{s as ke}from"./class-CJmGtk23.js";import{b as Ne}from"./this-BJDsKDpM.js";import{i as Ee}from"./lifecycle-CNU-NnhL.js";import{s as o}from"./attributes-xFjJ3ZB0.js";import{s as Pe}from"./style-D6J7hmdZ.js";import"./preload-helper-D4nn9Y_6.js";function We(f,e,a=!1,v=!1,m=!1,x=!1){var _=f,d="";if(a)var n=f;q(()=>{var l=Te;if(d!==(d=e()??"")){if(a){l.nodes=null,n.innerHTML=d,d!==""&&ie(P(n),n.lastChild);return}if(l.nodes!==null&&(Ve(l.nodes.start,l.nodes.end),l.nodes=null),d!==""){var b=v?Be:m?Ge:void 0,c=je(v?"svg":m?"math":"template",b);c.innerHTML=d;var u=v||m?c:c.content;if(ie(P(u),u.lastChild),v||m)for(;P(u);)_.before(P(u));else _.before(u)}}})}function ce(f,e){e&&e!=="lg"&&e!=="sm"&&e!=="xs"?f.style.fontSize=e.replace("x","em"):f.style.fontSize=""}function Je(f,e,a,v,m,x=1,_="",d=""){let n=1,l=1;m&&(m=="horizontal"?n=-1:m=="vertical"?l=-1:n=l=-1),typeof f=="string"&&(f=parseFloat(f)),typeof e=="string"&&(e=parseFloat(e)),typeof a=="string"&&(a=parseFloat(a));const b=`${e*x}${_}`,c=`${a*x}${_}`;let u=`translate(${b},${c}) scale(${n*f},${l*f})`;return v&&(u+=` rotate(${v}${d})`),u}var Ke=Y('<title class="svelte-q6zoq1"> </title>'),Ze=Y('<path class="svelte-q6zoq1"></path>'),Ie=Y('<path class="svelte-q6zoq1"></path><path class="svelte-q6zoq1"></path>',1),Qe=Y('<svg role="img" xmlns="http://www.w3.org/2000/svg"><!><g class="svelte-q6zoq1"><g class="svelte-q6zoq1"><!></g></g></svg>');function te(f,e){Le(e,!1);const a=D(),v=D();let m=s(e,"class",24,()=>{}),x=s(e,"id",24,()=>{}),_=s(e,"style",24,()=>{}),d=s(e,"icon",8),n=s(e,"title",24,()=>{}),l=s(e,"size",24,()=>{}),b=s(e,"color",24,()=>{}),c=s(e,"fw",8,!1),u=s(e,"pull",24,()=>{}),R=s(e,"scale",8,1),F=s(e,"translateX",8,0),y=s(e,"translateY",8,0),T=s(e,"rotate",24,()=>{}),V=s(e,"flip",24,()=>{}),U=s(e,"spin",8,!1),$=s(e,"pulse",8,!1),j=s(e,"primaryColor",8,""),r=s(e,"secondaryColor",8,""),N=s(e,"primaryOpacity",8,1),B=s(e,"secondaryOpacity",8,.4),G=s(e,"swapOpacity",8,!1),L=D();Q(()=>(t(L),p(l()),ce),()=>{t(L)&&l()&&ce(t(L),l())}),Q(()=>p(d()),()=>{k(a,d()&&d().icon||[0,0,"",[],""])}),Q(()=>(p(R()),p(F()),p(y()),p(T()),p(V())),()=>{k(v,Je(R(),F(),y(),T(),V(),512))}),Se(),Ee();var w=se(),S=X(w);{var E=ee=>{var C=Qe();let le;var re=A(C);{var Oe=g=>{var h=Ke(),M=A(h);q(()=>qe(M,n())),z(g,h)};O(re,g=>{n()&&g(Oe)})}var ae=ne(re),oe=A(ae),De=A(oe);{var Re=g=>{var h=Ze();q(()=>{o(h,"d",(t(a),i(()=>t(a)[4]))),o(h,"fill",b()||j()||"currentColor"),o(h,"transform",`translate(${t(a),i(()=>t(a)[0]/-2)??""} ${t(a),i(()=>t(a)[1]/-2)??""})`)}),z(g,h)},Fe=g=>{var h=Ie(),M=X(h),H=ne(M);q(()=>{o(M,"d",(t(a),i(()=>t(a)[4][0]))),o(M,"fill",r()||b()||"currentColor"),o(M,"fill-opacity",G()!=!1?N():B()),o(M,"transform",`translate(${t(a),i(()=>t(a)[0]/-2)??""} ${t(a),i(()=>t(a)[1]/-2)??""})`),o(H,"d",(t(a),i(()=>t(a)[4][1]))),o(H,"fill",j()||b()||"currentColor"),o(H,"fill-opacity",G()!=!1?B():N()),o(H,"transform",`translate(${t(a),i(()=>t(a)[0]/-2)??""} ${t(a),i(()=>t(a)[1]/-2)??""})`)}),z(g,h)};O(De,g=>{t(a),i(()=>typeof t(a)[4]=="string")?g(Re):g(Fe,-1)})}Ne(C,g=>k(L,g),()=>t(L)),q(()=>{o(C,"id",x()),le=ke(C,0,`svelte-fa svelte-fa-base ${m()??""}`,"svelte-q6zoq1",le,{pulse:$(),"svelte-fa-size-lg":l()==="lg","svelte-fa-size-sm":l()==="sm","svelte-fa-size-xs":l()==="xs","svelte-fa-fw":c(),"svelte-fa-pull-left":u()==="left","svelte-fa-pull-right":u()==="right",spin:U()}),Pe(C,_()),o(C,"viewBox",`0 0 ${t(a),i(()=>t(a)[0])??""} ${t(a),i(()=>t(a)[1])??""}`),o(C,"aria-hidden",n()===void 0),o(ae,"transform",`translate(${t(a),i(()=>t(a)[0]/2)??""} ${t(a),i(()=>t(a)[1]/2)??""})`),o(ae,"transform-origin",`${t(a),i(()=>t(a)[0]/4)??""} 0`),o(oe,"transform",t(v))}),z(ee,C)};O(S,ee=>{t(a),i(()=>t(a)[4])&&ee(E)})}z(f,w),Me()}/*!
 * Font Awesome Free 7.2.0 by @fontawesome - https://fontawesome.com
 * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
 * Copyright 2026 Fonticons, Inc.
 */var Xe={prefix:"fas",iconName:"circle-exclamation",icon:[512,512,["exclamation-circle"],"f06a","M256 512a256 256 0 1 1 0-512 256 256 0 1 1 0 512zm0-192a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm0-192c-18.2 0-32.7 15.5-31.4 33.7l7.4 104c.9 12.6 11.4 22.3 23.9 22.3 12.6 0 23-9.7 23.9-22.3l7.4-104c1.3-18.2-13.1-33.7-31.4-33.7z"]},Ye=Xe,Ue={prefix:"fas",iconName:"spinner",icon:[512,512,[],"f110","M208 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm0 416a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM48 208a48 48 0 1 1 0 96 48 48 0 1 1 0-96zm368 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM75 369.1A48 48 0 1 1 142.9 437 48 48 0 1 1 75 369.1zM75 75A48 48 0 1 1 142.9 142.9 48 48 0 1 1 75 75zM437 369.1A48 48 0 1 1 369.1 437 48 48 0 1 1 437 369.1z"]},$e={prefix:"fas",iconName:"circle-check",icon:[512,512,[61533,"check-circle"],"f058","M256 512a256 256 0 1 1 0-512 256 256 0 1 1 0 512zM374 145.7c-10.7-7.8-25.7-5.4-33.5 5.3L221.1 315.2 169 263.1c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l72 72c5 5 11.8 7.5 18.8 7s13.4-4.1 17.5-9.8L379.3 179.2c7.8-10.7 5.4-25.7-5.3-33.5z"]},ea=$e,aa=Ae("<span> </span>"),ta=Ae("<button><!></button>");function sa(f,e){Le(e,!1);let a=s(e,"color",8,"blue"),v=s(e,"label",8,""),m=s(e,"icon",8,""),x=s(e,"onClick",8,()=>{}),_=s(e,"showLabel",8,!0),d=s(e,"className",8,""),n=s(e,"status",8,"idle"),l=s(e,"onResetStatus",8,void 0),b=s(e,"disabled",8,!1),c=D("idle"),u=D();const R={blue:"btn-accent",red:"btn-danger",transparent:"btn-ghost","":""};function F(){t(c)!=="loading"&&!b()&&x()()}Q(()=>(p(n()),p(l())),()=>{n()&&(k(c,n()),n()!=="idle"&&setTimeout(()=>{var r;k(c,"idle"),(r=l())==null||r()},2e3))}),Se(),Ee();var y=ta(),T=A(y);{var V=r=>{te(r,{get icon(){return Ue},class:"animate-spin"})},U=r=>{te(r,{get icon(){return ea},class:"text-green-500"})},$=r=>{te(r,{get icon(){return Ye},class:"text-red-500"})},j=r=>{var N=se(),B=X(N);{var G=w=>{var S=se(),E=X(S);We(E,m),z(w,S)},L=w=>{var S=aa(),E=A(S);q(()=>qe(E,v())),z(w,S)};O(B,w=>{m()?w(G):_()&&v()&&w(L,1)})}z(r,N)};O(T,r=>{t(c)==="loading"?r(V):t(c)==="success"?r(U,1):t(c)==="error"?r($,2):r(j,-1)})}Ne(y,r=>k(u,r),()=>t(u)),q(()=>{y.disabled=t(c)==="loading"||b(),ke(y,1,`btn ${p(a()),i(()=>R[a()])??""} ${d()??""} ${t(c)==="loading"?"cursor-not-allowed":"cursor-pointer"}`,"svelte-ovjhya")}),He("click",y,F),z(f,y),Me()}const ua={title:"Design System/Button",component:sa,tags:["autodocs"],argTypes:{color:{control:"select",options:["blue","red","transparent",""]},status:{control:"select",options:["idle","loading","success","error"]}}},W={args:{color:"blue",label:"Add to Watchlist",showLabel:!0,status:"idle",disabled:!1}},J={args:{color:"transparent",label:"View Details",showLabel:!0,status:"idle",disabled:!1}},K={args:{color:"red",label:"Remove from List",showLabel:!0,status:"idle",disabled:!1}},Z={args:{color:"blue",label:"Saving...",showLabel:!0,status:"loading",disabled:!1}},I={args:{color:"blue",label:"Not Available",showLabel:!0,status:"idle",disabled:!0}};var fe,de,ue;W.parameters={...W.parameters,docs:{...(fe=W.parameters)==null?void 0:fe.docs,source:{originalSource:`{
  args: {
    color: 'blue',
    label: 'Add to Watchlist',
    showLabel: true,
    status: 'idle',
    disabled: false
  }
}`,...(ue=(de=W.parameters)==null?void 0:de.docs)==null?void 0:ue.source}}};var ve,me,ge;J.parameters={...J.parameters,docs:{...(ve=J.parameters)==null?void 0:ve.docs,source:{originalSource:`{
  args: {
    color: 'transparent',
    label: 'View Details',
    showLabel: true,
    status: 'idle',
    disabled: false
  }
}`,...(ge=(me=J.parameters)==null?void 0:me.docs)==null?void 0:ge.source}}};var be,he,pe;K.parameters={...K.parameters,docs:{...(be=K.parameters)==null?void 0:be.docs,source:{originalSource:`{
  args: {
    color: 'red',
    label: 'Remove from List',
    showLabel: true,
    status: 'idle',
    disabled: false
  }
}`,...(pe=(he=K.parameters)==null?void 0:he.docs)==null?void 0:pe.source}}};var _e,ye,we;Z.parameters={...Z.parameters,docs:{...(_e=Z.parameters)==null?void 0:_e.docs,source:{originalSource:`{
  args: {
    color: 'blue',
    label: 'Saving...',
    showLabel: true,
    status: 'loading',
    disabled: false
  }
}`,...(we=(ye=Z.parameters)==null?void 0:ye.docs)==null?void 0:we.source}}};var ze,Ce,xe;I.parameters={...I.parameters,docs:{...(ze=I.parameters)==null?void 0:ze.docs,source:{originalSource:`{
  args: {
    color: 'blue',
    label: 'Not Available',
    showLabel: true,
    status: 'idle',
    disabled: true
  }
}`,...(xe=(Ce=I.parameters)==null?void 0:Ce.docs)==null?void 0:xe.source}}};const va=["Accent","Ghost","Danger","Loading","Disabled"];export{W as Accent,K as Danger,I as Disabled,J as Ghost,Z as Loading,va as __namedExportsOrder,ua as default};
