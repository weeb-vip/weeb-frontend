import{a4 as c,ai as m,k as p,M as O,ag as q,p as i,P as s,aj as u,ae as z}from"./iframe-BBy3qS7V.js";import"./legacy-B5CYqdZO.js";import{e as F,i as G}from"./each-B7aOw8gM.js";import{s as x}from"./attributes-xFjJ3ZB0.js";import{s as I}from"./class-CJmGtk23.js";import"./preload-helper-D4nn9Y_6.js";var J=O("<a> </a>"),K=O('<nav class="nav svelte-12xthxl"><a href="/" class="nav-logo svelte-12xthxl"><img alt="weeb.vip" width="32" height="32" class="nav-logo-img svelte-12xthxl"/> <span class="nav-logo-text svelte-12xthxl">weeb.vip</span></a> <div class="nav-links svelte-12xthxl"></div> <div class="nav-search svelte-12xthxl"><span class="nav-search-icon svelte-12xthxl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span> <input type="text" placeholder="Search anime..." class="svelte-12xthxl"/></div> <div class="nav-auth svelte-12xthxl"><button class="btn-ghost svelte-12xthxl">Log in</button> <button class="btn-primary svelte-12xthxl">Sign up</button></div></nav>');function Q(k,l){let B=c(l,"currentPath",8,"/"),A=c(l,"logoSrc",8,"https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"),D=c(l,"seasonUrl",8,"#");const j=[{href:"/",label:"Home"},{href:D(),label:"Season"},{href:"/airing",label:"Airing"},{href:"/search",label:"Browse"}];var h=K(),v=i(h),N=i(v),C=q(v,2);F(C,5,()=>j,G,(H,e)=>{var a=J();let g;var L=i(a);m(()=>{x(a,"href",(s(e),u(()=>s(e).href))),g=I(a,1,"svelte-12xthxl",null,g,{active:B()===s(e).href}),z(L,(s(e),u(()=>s(e).label)))}),p(H,a)}),m(()=>x(N,"src",A())),p(k,h)}const $={title:"Design System/Nav",component:Q,tags:["autodocs"],parameters:{layout:"fullscreen"}},r={args:{currentPath:"/",seasonUrl:"/season/SUMMER_2026"}},t={args:{currentPath:"/season/SUMMER_2026",seasonUrl:"/season/SUMMER_2026"}},n={args:{currentPath:"/airing",seasonUrl:"/season/SUMMER_2026"}},o={args:{currentPath:"/search",seasonUrl:"/season/SUMMER_2026"}};var d,S,f;r.parameters={...r.parameters,docs:{...(d=r.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    currentPath: '/',
    seasonUrl: '/season/SUMMER_2026'
  }
}`,...(f=(S=r.parameters)==null?void 0:S.docs)==null?void 0:f.source}}};var M,U,_;t.parameters={...t.parameters,docs:{...(M=t.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    currentPath: '/season/SUMMER_2026',
    seasonUrl: '/season/SUMMER_2026'
  }
}`,...(_=(U=t.parameters)==null?void 0:U.docs)==null?void 0:_.source}}};var P,b,E;n.parameters={...n.parameters,docs:{...(P=n.parameters)==null?void 0:P.docs,source:{originalSource:`{
  args: {
    currentPath: '/airing',
    seasonUrl: '/season/SUMMER_2026'
  }
}`,...(E=(b=n.parameters)==null?void 0:b.docs)==null?void 0:E.source}}};var w,R,y;o.parameters={...o.parameters,docs:{...(w=o.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    currentPath: '/search',
    seasonUrl: '/season/SUMMER_2026'
  }
}`,...(y=(R=o.parameters)==null?void 0:R.docs)==null?void 0:y.source}}};const ee=["Default","OnSeasonPage","OnAiringPage","OnBrowsePage"];export{r as Default,n as OnAiringPage,o as OnBrowsePage,t as OnSeasonPage,ee as __namedExportsOrder,$ as default};
