import{a4 as t,V as d,ai as v,J as y,k as o,a3 as X,a5 as Y,M as l,p as s,ag as m,ae as c}from"./iframe-BBy3qS7V.js";import"./legacy-B5CYqdZO.js";import{s as Z}from"./attributes-xFjJ3ZB0.js";import{i as $}from"./lifecycle-CNU-NnhL.js";import{S as ee,a as ie,b as J}from"./analytics-DbPNl78_.js";import"./preload-helper-D4nn9Y_6.js";import"./class-CJmGtk23.js";import"./style-D6J7hmdZ.js";var ae=l('<div class="airing-ep svelte-ybyx4m"> </div>'),te=l('<div class="airing-local-time svelte-ybyx4m"> </div>'),se=l('<span class="live svelte-ybyx4m">LIVE</span>'),re=l('<div class="airing-time svelte-ybyx4m"><!> </div>'),ne=l('<a class="airing-card svelte-ybyx4m"><div class="airing-poster svelte-ybyx4m"><!></div> <div class="airing-info svelte-ybyx4m"><div class="airing-title svelte-ybyx4m"> </div> <!> <!> <!></div></a>');function oe(K,i){Y(i,!1);let _=t(i,"id",8),x=t(i,"title",8),W=t(i,"image",8),T=t(i,"episodeText",8,""),b=t(i,"timeText",8,""),h=t(i,"localTime",8,""),S=t(i,"isLive",8,!1);$();var r=ne(),L=s(r),M=s(L);ee(M,{get src(){return W()},get alt(){return x()},className:"airing-poster-img",fallbackSrc:"/assets/not found.jpg"});var O=m(L,2),E=s(O),q=s(E),j=m(E,2);{var z=e=>{var a=ae(),n=s(a);v(()=>c(n,T())),o(e,a)};d(j,e=>{T()&&e(z)})}var F=m(j,2);{var G=e=>{var a=te(),n=s(a);v(()=>c(n,h())),o(e,a)};d(F,e=>{h()&&e(G)})}var H=m(F,2);{var P=e=>{var a=re(),n=s(a);{var Q=f=>{var U=se();o(f,U)};d(n,f=>{S()&&f(Q)})}var R=m(n);v(()=>c(R,` ${b()??""}`)),o(e,a)};d(H,e=>{(b()||S())&&e(P)})}v(()=>{Z(r,"href",`/show/${_()??""}`),c(q,x())}),y("click",r,()=>ie.animeViewed(_(),x())),y("mouseenter",r,function(e){J.call(this,i,e)}),y("mouseleave",r,function(e){J.call(this,i,e)}),o(K,r),X()}const xe={title:"Design System/AiringStripCard",component:oe,tags:["autodocs"],argTypes:{isLive:{control:"boolean"}}},g={args:{id:"154587",title:"Frieren: Beyond Journey's End",image:"https://cdn.myanimelist.net/images/anime/1015/138006.jpg",episodeText:"Episode 24",timeText:"Fri 23:00",isLive:!1}},p={args:{id:"52991",title:"Sousou no Frieren",image:"https://cdn.myanimelist.net/images/anime/1015/138006.jpg",episodeText:"Episode 28 · Season Finale",timeText:"Airing Now",isLive:!0}},u={args:{id:"51009",title:"Jujutsu Kaisen Season 3",image:"https://cdn.myanimelist.net/images/anime/1792/138022.jpg",episodeText:"Episode 1",timeText:"",isLive:!1}};var k,w,A;g.parameters={...g.parameters,docs:{...(k=g.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    id: '154587',
    title: 'Frieren: Beyond Journey\\'s End',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    episodeText: 'Episode 24',
    timeText: 'Fri 23:00',
    isLive: false
  }
}`,...(A=(w=g.parameters)==null?void 0:w.docs)==null?void 0:A.source}}};var B,D,N;p.parameters={...p.parameters,docs:{...(B=p.parameters)==null?void 0:B.docs,source:{originalSource:`{
  args: {
    id: '52991',
    title: 'Sousou no Frieren',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    episodeText: 'Episode 28 \\u00B7 Season Finale',
    timeText: 'Airing Now',
    isLive: true
  }
}`,...(N=(D=p.parameters)==null?void 0:D.docs)==null?void 0:N.source}}};var V,C,I;u.parameters={...u.parameters,docs:{...(V=u.parameters)==null?void 0:V.docs,source:{originalSource:`{
  args: {
    id: '51009',
    title: 'Jujutsu Kaisen Season 3',
    image: 'https://cdn.myanimelist.net/images/anime/1792/138022.jpg',
    episodeText: 'Episode 1',
    timeText: '',
    isLive: false
  }
}`,...(I=(C=u.parameters)==null?void 0:C.docs)==null?void 0:I.source}}};const fe=["Default","Live","WithoutTime"];export{g as Default,p as Live,u as WithoutTime,fe as __namedExportsOrder,xe as default};
