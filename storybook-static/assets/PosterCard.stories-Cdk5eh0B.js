import{a4 as i,V as c,ai as m,J as ve,k as o,a3 as ce,M as l,ag as d,a5 as me,p as s,w as u,aj as h,ae as p,P as pe}from"./iframe-BBy3qS7V.js";import"./legacy-B5CYqdZO.js";import{e as ue,i as he}from"./each-B7aOw8gM.js";import{s as ge}from"./slot-ChEXTifl.js";import{s as fe}from"./attributes-xFjJ3ZB0.js";import{i as _e}from"./lifecycle-CNU-NnhL.js";import{S as be,a as ye}from"./analytics-DbPNl78_.js";import{S as Se}from"./StoryContainer-CMj7yAIp.js";import"./preload-helper-D4nn9Y_6.js";import"./class-CJmGtk23.js";import"./style-D6J7hmdZ.js";var Ce=l('<span class="score-badge svelte-vpa0t1"> </span>'),we=l('<span class="status-dot airing svelte-vpa0t1"></span>'),xe=l('<span class="status-dot upcoming svelte-vpa0t1"></span>'),Ae=l('<p class="hover-desc svelte-vpa0t1"> </p>'),Ee=l('<span class="hover-meta-item svelte-vpa0t1"> </span>'),Fe=l('<span class="hover-meta-item hover-score svelte-vpa0t1"> </span>'),je=l('<span class="hover-genre svelte-vpa0t1"> </span>'),De=l('<div class="hover-genres svelte-vpa0t1"></div>'),Be=l('<div class="poster-sub svelte-vpa0t1"> </div>'),Te=l('<a class="poster-card svelte-vpa0t1"><div class="poster svelte-vpa0t1"><!> <!> <!> <div class="hover-overlay svelte-vpa0t1"><div class="hover-content svelte-vpa0t1"><!> <div class="hover-meta svelte-vpa0t1"><!> <!></div> <!></div></div></div> <div class="poster-title svelte-vpa0t1"> </div> <!> <!></a>');function ke(L,t){me(t,!1);let x=i(t,"id",8),w=i(t,"title",8),V=i(t,"image",8),n=i(t,"score",8,null),f=i(t,"status",8,null),A=i(t,"sub",8,""),Y=i(t,"href",8,""),_=i(t,"genres",24,()=>[]),g=i(t,"description",8,""),E=i(t,"episodeCount",8,null);_e();var b=Te(),F=s(b),j=s(F);be(j,{get src(){return V()},get alt(){return w()},className:"poster-img",fallbackSrc:"/assets/not found.jpg"});var D=d(j,2);{var z=e=>{var a=Ce(),r=s(a);m(v=>p(r,v),[()=>(u(n()),h(()=>typeof n()=="number"?n().toFixed(1):n()))]),o(e,a)};c(D,e=>{n()&&e(z)})}var B=d(D,2);{var Q=e=>{var a=we();o(e,a)},X=e=>{var a=xe();o(e,a)};c(B,e=>{f()==="CURRENTLY_AIRING"||f()==="airing"?e(Q):(f()==="upcoming"||f()==="NOT_YET_RELEASED")&&e(X,1)})}var Z=d(B,2),$=s(Z),T=s($);{var ee=e=>{var a=Ae(),r=s(a);m(v=>p(r,`${v??""}${u(g()),h(()=>g().length>120?"...":"")??""}`),[()=>(u(g()),h(()=>g().replace(/<[^>]*>/g,"").slice(0,120)))]),o(e,a)};c(T,e=>{g()&&e(ee)})}var k=d(T,2),P=s(k);{var ae=e=>{var a=Ee(),r=s(a);m(()=>p(r,`${E()??""} episodes`)),o(e,a)};c(P,e=>{E()&&e(ae)})}var te=d(P,2);{var se=e=>{var a=Fe(),r=s(a);m(v=>p(r,`★ ${v??""}`),[()=>(u(n()),h(()=>typeof n()=="number"?n().toFixed(1):n()))]),o(e,a)};c(te,e=>{n()&&e(se)})}var re=d(k,2);{var ne=e=>{var a=De();ue(a,5,()=>(u(_()),h(()=>_().slice(0,3))),he,(r,v)=>{var q=je(),de=s(q);m(()=>p(de,pe(v))),o(r,q)}),o(e,a)};c(re,e=>{u(_()),h(()=>_().length>0)&&e(ne)})}var J=d(F,2),ie=s(J),M=d(J,2);{var oe=e=>{var a=Be(),r=s(a);m(()=>p(r,A())),o(e,a)};c(M,e=>{A()&&e(oe)})}var le=d(M,2);ge(le,t,"default",{}),m(()=>{fe(b,"href",Y()||`/show/${x()}`),p(ie,w())}),ve("click",b,()=>ye.animeViewed(x(),w())),o(L,b),ce()}const He={title:"Design System/PosterCard",component:ke,tags:["autodocs"],parameters:{layout:"centered"},decorators:[()=>({Component:Se,props:{width:"200px"}})],argTypes:{status:{control:"select",options:["airing","upcoming",null]}}},y={args:{id:"154587",title:"Frieren: Beyond Journey's End",image:"https://cdn.myanimelist.net/images/anime/1015/138006.jpg",score:9,status:"airing",genres:["Adventure","Drama","Fantasy"],description:"The adventure is over but life goes on for an elf mage just beginning to learn what living is all about. Elf mage Frieren and her courageous fellow adventurers have defeated the Demon King and brought peace to the land.",episodeCount:28,sub:"28 ep · Madhouse",href:"#"}},S={args:{id:"21",title:"One Punch Man Season 3",image:"https://cdn.myanimelist.net/images/anime/1247/142erta.jpg",score:null,status:"upcoming",genres:["Action","Comedy","Sci-Fi"],description:"The seemingly unimpressive Saitama has a rather unique hobby: being a hero. He trained so hard that he lost all his hair, and now he can defeat any enemy with a single punch.",episodeCount:null,sub:"Upcoming · J.C.Staff",href:"#"}},C={args:{id:"5114",title:"Fullmetal Alchemist: Brotherhood",image:"https://cdn.myanimelist.net/images/anime/1208/94745.jpg",score:9.1,status:null,genres:["Action","Adventure","Drama","Fantasy"],description:"After a horrific alchemy experiment goes wrong, brothers Edward and Alphonse Elric embark on a quest to restore their bodies by finding the Philosopher's Stone.",episodeCount:64,sub:"64 ep · Bones",href:"#"}};var N,O,R;y.parameters={...y.parameters,docs:{...(N=y.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    id: '154587',
    title: 'Frieren: Beyond Journey\\'s End',
    image: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
    score: 9.0,
    status: 'airing',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    description: 'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about. Elf mage Frieren and her courageous fellow adventurers have defeated the Demon King and brought peace to the land.',
    episodeCount: 28,
    sub: '28 ep \\u00B7 Madhouse',
    href: '#'
  }
}`,...(R=(O=y.parameters)==null?void 0:O.docs)==null?void 0:R.source}}};var W,G,I;S.parameters={...S.parameters,docs:{...(W=S.parameters)==null?void 0:W.docs,source:{originalSource:`{
  args: {
    id: '21',
    title: 'One Punch Man Season 3',
    image: 'https://cdn.myanimelist.net/images/anime/1247/142erta.jpg',
    score: null,
    status: 'upcoming',
    genres: ['Action', 'Comedy', 'Sci-Fi'],
    description: 'The seemingly unimpressive Saitama has a rather unique hobby: being a hero. He trained so hard that he lost all his hair, and now he can defeat any enemy with a single punch.',
    episodeCount: null,
    sub: 'Upcoming \\u00B7 J.C.Staff',
    href: '#'
  }
}`,...(I=(G=S.parameters)==null?void 0:G.docs)==null?void 0:I.source}}};var U,H,K;C.parameters={...C.parameters,docs:{...(U=C.parameters)==null?void 0:U.docs,source:{originalSource:`{
  args: {
    id: '5114',
    title: 'Fullmetal Alchemist: Brotherhood',
    image: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
    score: 9.1,
    status: null,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    description: 'After a horrific alchemy experiment goes wrong, brothers Edward and Alphonse Elric embark on a quest to restore their bodies by finding the Philosopher\\'s Stone.',
    episodeCount: 64,
    sub: '64 ep \\u00B7 Bones',
    href: '#'
  }
}`,...(K=(H=C.parameters)==null?void 0:H.docs)==null?void 0:K.source}}};const Ke=["Default","WithoutScore","WithGenres"];export{y as Default,C as WithGenres,S as WithoutScore,Ke as __namedExportsOrder,He as default};
