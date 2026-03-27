(()=>{var e={};e.id=4255,e.ids=[4255],e.modules={72934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},27790:e=>{"use strict";e.exports=require("assert")},84770:e=>{"use strict";e.exports=require("crypto")},17702:e=>{"use strict";e.exports=require("events")},92048:e=>{"use strict";e.exports=require("fs")},32615:e=>{"use strict";e.exports=require("http")},32694:e=>{"use strict";e.exports=require("http2")},35240:e=>{"use strict";e.exports=require("https")},98216:e=>{"use strict";e.exports=require("net")},55315:e=>{"use strict";e.exports=require("path")},76162:e=>{"use strict";e.exports=require("stream")},74175:e=>{"use strict";e.exports=require("tty")},17360:e=>{"use strict";e.exports=require("url")},21764:e=>{"use strict";e.exports=require("util")},71568:e=>{"use strict";e.exports=require("zlib")},79271:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>o.a,__next_app__:()=>p,originalPathname:()=>u,pages:()=>c,routeModule:()=>x,tree:()=>d}),r(83661),r(30600),r(22399),r(56750),r(2280);var s=r(27105),i=r(15265),a=r(90157),o=r.n(a),l=r(44665),n={};for(let e in l)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(n[e]=()=>l[e]);r.d(t,n);let d=["",{children:["delivery",{children:["login",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,83661)),"D:\\cheezyhub-v4\\cheezyhub\\frontend\\src\\app\\delivery\\login\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(r.bind(r,30600)),"D:\\cheezyhub-v4\\cheezyhub\\frontend\\src\\app\\delivery\\layout.tsx"]}]},{layout:[()=>Promise.resolve().then(r.bind(r,22399)),"D:\\cheezyhub-v4\\cheezyhub\\frontend\\src\\app\\layout.tsx"],error:[()=>Promise.resolve().then(r.bind(r,56750)),"D:\\cheezyhub-v4\\cheezyhub\\frontend\\src\\app\\error.tsx"],"not-found":[()=>Promise.resolve().then(r.bind(r,2280)),"D:\\cheezyhub-v4\\cheezyhub\\frontend\\src\\app\\not-found.tsx"]}],c=["D:\\cheezyhub-v4\\cheezyhub\\frontend\\src\\app\\delivery\\login\\page.tsx"],u="/delivery/login/page",p={require:r,loadChunk:()=>Promise.resolve()},x=new s.AppPageRouteModule({definition:{kind:i.x.APP_PAGE,page:"/delivery/login/page",pathname:"/delivery/login",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},30199:(e,t,r)=>{Promise.resolve().then(r.bind(r,67498))},36112:(e,t,r)=>{Promise.resolve().then(r.bind(r,55959))},67498:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>o});var s=r(19899);r(5507);var i=r(76153),a=r(2060);function o({children:e}){(0,i.useRouter)(),(0,i.usePathname)();let{isAuthenticated:t,user:r}=(0,a.G)();return s.jsx("div",{className:"dark-ui",children:e})}},55959:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>m});var s=r(19899),i=r(5507),a=r(76153),o=r(66319),l=r(2060),n=r(90832),d=r(29638),c=r(49663),u=r(80433),p=r(31761),x=r(88514),h=r(93427);function m(){let e=(0,a.useRouter)(),t=(0,l.G)(e=>e.login),[r,m]=(0,i.useState)(""),[f,g]=(0,i.useState)(""),[y,b]=(0,i.useState)(!1),[v,w]=(0,i.useState)(!1),j=async()=>{if(!r||!f){n.ZP.error("Enter username and PIN");return}w(!0);try{let{token:s,user:i}=(await o.iJ.login({identifier:r,pin:f,role:"staff"})).data.data;if(!["delivery","admin"].includes(i.role)){n.ZP.error("Delivery access required");return}t(s,i),e.replace("/delivery")}catch(e){n.ZP.error(e.response?.data?.error??"Invalid credentials")}finally{w(!1)}};return(0,s.jsxs)("div",{className:"dark-ui login-bg-delivery min-h-screen flex flex-col lg:flex-row overflow-hidden",children:[s.jsx("div",{className:"hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-16 relative",children:(0,s.jsxs)("div",{className:"relative z-10 text-center",children:[(0,s.jsxs)("div",{className:"relative inline-block mb-8",children:[s.jsx("div",{className:"absolute inset-0 rounded-full bg-purple-500/20 animate-ping scale-125"}),s.jsx("div",{className:"absolute inset-0 rounded-full bg-violet-500/15 animate-ping scale-150",style:{animationDelay:"0.5s"}}),s.jsx("div",{className:"w-28 h-28 rounded-full bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-2xl shadow-purple-500/30",children:s.jsx(d.Z,{size:48,className:"text-white"})})]}),(0,s.jsxs)("h1",{className:"font-display font-black text-white text-5xl xl:text-6xl leading-tight mb-4",children:["Delivery",s.jsx("br",{}),s.jsx("span",{style:{background:"linear-gradient(135deg,#a855f7,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},children:"Riders"})]}),s.jsx("p",{className:"text-white/40 text-lg font-ui mb-8",children:"On the road to every door \uD83C\uDFCD️"}),s.jsx("div",{className:"flex flex-col gap-3",children:[{icon:s.jsx(c.Z,{size:14}),label:"Live GPS Navigation",color:"text-purple-400"},{icon:s.jsx(u.Z,{size:14}),label:"Customer PIN routing",color:"text-violet-400"},{icon:s.jsx(d.Z,{size:14}),label:"Earnings tracker",color:"text-indigo-400"}].map(e=>(0,s.jsxs)("div",{className:"flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-white/50 text-sm font-ui",children:[s.jsx("span",{className:e.color,children:e.icon})," ",e.label]},e.label))})]})}),s.jsx("div",{className:"flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-10 min-h-screen lg:min-h-0",children:(0,s.jsxs)("div",{className:"w-full max-w-sm",children:[(0,s.jsxs)("div",{className:"lg:hidden text-center mb-8 animate-slide-up",children:[s.jsx("div",{className:"w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-purple-500/30",children:s.jsx(d.Z,{size:28,className:"text-white"})}),s.jsx("h1",{className:"font-display font-bold text-white text-2xl",children:"Delivery Panel"})]}),(0,s.jsxs)("div",{className:"hidden lg:block mb-7 animate-slide-up",children:[s.jsx("h2",{className:"font-display font-bold text-white text-2xl",children:"Driver Login"}),s.jsx("p",{className:"text-white/30 text-sm font-ui mt-1",children:"Enter your rider credentials"})]}),(0,s.jsxs)("div",{className:"glass-card-dark rounded-3xl p-7 animate-slide-up",style:{animationDelay:"80ms"},children:[(0,s.jsxs)("div",{className:"flex flex-col gap-3.5",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-[10px] font-bold text-white/30 mb-1.5 uppercase tracking-widest font-ui",children:"Username"}),s.jsx("input",{className:"input-dark w-full px-4 py-3.5 rounded-xl text-sm font-ui",placeholder:"Driver username",value:r,onChange:e=>m(e.target.value)})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-[10px] font-bold text-white/30 mb-1.5 uppercase tracking-widest font-ui",children:"PIN"}),(0,s.jsxs)("div",{className:"relative",children:[s.jsx("input",{type:y?"text":"password",className:"input-dark w-full px-4 py-3.5 rounded-xl text-sm pr-12 font-mono tracking-widest",placeholder:"••••",maxLength:8,value:f,onChange:e=>g(e.target.value),onKeyDown:e=>"Enter"===e.key&&j()}),s.jsx("button",{className:"absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors",onClick:()=>b(!y),type:"button",children:y?s.jsx(p.Z,{size:15}):s.jsx(x.Z,{size:15})})]})]})]}),s.jsx("button",{onClick:j,disabled:v,className:"btn-press mt-6 w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-700 hover:to-violet-600 disabled:opacity-50 text-white rounded-2xl font-ui font-bold text-[15px] shadow-lg shadow-purple-500/25 transition-all",children:v?(0,s.jsxs)("span",{className:"flex items-center gap-2",children:[s.jsx("span",{className:"w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"}),"Signing in..."]}):(0,s.jsxs)(s.Fragment,{children:["Start Delivering ",s.jsx(h.Z,{size:15})]})})]})]})})]})}},2060:(e,t,r)=>{"use strict";r.d(t,{G:()=>o});var s=r(24978),i=r(31460),a=r(49285);let o=(0,s.Ue)()((0,i.tJ)((e,t)=>({user:null,token:null,isAuthenticated:!1,login:(t,r)=>{a.Z.set("ch_delivery_token",t,{expires:7,sameSite:"strict",path:"/"}),e({token:t,user:r,isAuthenticated:!0})},logout:()=>{a.Z.remove("ch_delivery_token",{path:"/"}),e({token:null,user:null,isAuthenticated:!1})},updateStatus:t=>e(e=>({user:e.user?{...e.user,driverStatus:t}:null})),updateUser:t=>e(e=>({user:e.user?{...e.user,...t}:null}))}),{name:"cheezyhub-delivery",partialize:e=>({user:e.user,token:e.token,isAuthenticated:e.isAuthenticated})}))},93427:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});let s=(0,r(84516).Z)("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]])},29638:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});let s=(0,r(84516).Z)("Bike",[["circle",{cx:"18.5",cy:"17.5",r:"3.5",key:"15x4ox"}],["circle",{cx:"5.5",cy:"17.5",r:"3.5",key:"1noe27"}],["circle",{cx:"15",cy:"5",r:"1",key:"19l28e"}],["path",{d:"M12 17.5V14l-3-3 4-3 2 3h2",key:"1npguv"}]])},31761:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});let s=(0,r(84516).Z)("EyeOff",[["path",{d:"M9.88 9.88a3 3 0 1 0 4.24 4.24",key:"1jxqfv"}],["path",{d:"M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68",key:"9wicm4"}],["path",{d:"M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61",key:"1jreej"}],["line",{x1:"2",x2:"22",y1:"2",y2:"22",key:"a6p6uj"}]])},88514:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});let s=(0,r(84516).Z)("Eye",[["path",{d:"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z",key:"rwhkz3"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]])},80433:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});let s=(0,r(84516).Z)("MapPin",[["path",{d:"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",key:"2oe9fu"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]])},49663:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});let s=(0,r(84516).Z)("Navigation",[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]])},30600:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>s});let s=(0,r(2772).createProxy)(String.raw`D:\cheezyhub-v4\cheezyhub\frontend\src\app\delivery\layout.tsx#default`)},83661:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>s});let s=(0,r(2772).createProxy)(String.raw`D:\cheezyhub-v4\cheezyhub\frontend\src\app\delivery\login\page.tsx#default`)},90832:(e,t,r)=>{"use strict";r.d(t,{ZP:()=>U});var s,i=r(5507);let a={data:""},o=e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||a},l=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,n=/\/\*[^]*?\*\/|  +/g,d=/\n+/g,c=(e,t)=>{let r="",s="",i="";for(let a in e){let o=e[a];"@"==a[0]?"i"==a[1]?r=a+" "+o+";":s+="f"==a[1]?c(o,a):a+"{"+c(o,"k"==a[1]?"":t)+"}":"object"==typeof o?s+=c(o,t?t.replace(/([^,])+/g,e=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):a):null!=o&&(a=/^--/.test(a)?a:a.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=c.p?c.p(a,o):a+":"+o+";")}return r+(t&&i?t+"{"+i+"}":i)+s},u={},p=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+p(e[r]);return t}return e},x=(e,t,r,s,i)=>{let a=p(e),o=u[a]||(u[a]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(a));if(!u[o]){let t=a!==e?e:(e=>{let t,r,s=[{}];for(;t=l.exec(e.replace(n,""));)t[4]?s.shift():t[3]?(r=t[3].replace(d," ").trim(),s.unshift(s[0][r]=s[0][r]||{})):s[0][t[1]]=t[2].replace(d," ").trim();return s[0]})(e);u[o]=c(i?{["@keyframes "+o]:t}:t,r?"":"."+o)}let x=r&&u.g?u.g:null;return r&&(u.g=u[o]),((e,t,r,s)=>{s?t.data=t.data.replace(s,e):-1===t.data.indexOf(e)&&(t.data=r?e+t.data:t.data+e)})(u[o],t,s,x),o},h=(e,t,r)=>e.reduce((e,s,i)=>{let a=t[i];if(a&&a.call){let e=a(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;a=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+s+(null==a?"":a)},"");function m(e){let t=this||{},r=e.call?e(t.p):e;return x(r.unshift?r.raw?h(r,[].slice.call(arguments,1),t.p):r.reduce((e,r)=>Object.assign(e,r&&r.call?r(t.p):r),{}):r,o(t.target),t.g,t.o,t.k)}m.bind({g:1});let f,g,y,b=m.bind({k:1});function v(e,t){let r=this||{};return function(){let s=arguments;function i(a,o){let l=Object.assign({},a),n=l.className||i.className;r.p=Object.assign({theme:g&&g()},l),r.o=/ *go\d+/.test(n),l.className=m.apply(r,s)+(n?" "+n:""),t&&(l.ref=o);let d=e;return e[0]&&(d=l.as||e,delete l.as),y&&d[0]&&y(l),f(d,l)}return t?t(i):i}}var w=e=>"function"==typeof e,j=(e,t)=>w(e)?e(t):e,k=(()=>{let e=0;return()=>(++e).toString()})(),N=((()=>{let e;return()=>e})(),"default"),z=(e,t)=>{let{toastLimit:r}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,r)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:s}=t;return z(e,{type:e.toasts.find(e=>e.id===s.id)?1:0,toast:s});case 3:let{toastId:i}=t;return{...e,toasts:e.toasts.map(e=>e.id===i||void 0===i?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let a=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+a}))}}},P=[],Z={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},q={},_=(e,t=N)=>{q[t]=z(q[t]||Z,e),P.forEach(([e,r])=>{e===t&&r(q[t])})},D=e=>Object.keys(q).forEach(t=>_(e,t)),A=e=>Object.keys(q).find(t=>q[t].toasts.some(t=>t.id===e)),C=(e=N)=>t=>{_(t,e)},E={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},S=(e,t="blank",r)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:(null==r?void 0:r.id)||k()}),$=e=>(t,r)=>{let s=S(t,e,r);return C(s.toasterId||A(s.id))({type:2,toast:s}),s.id},M=(e,t)=>$("blank")(e,t);M.error=$("error"),M.success=$("success"),M.loading=$("loading"),M.custom=$("custom"),M.dismiss=(e,t)=>{let r={type:3,toastId:e};t?C(t)(r):D(r)},M.dismissAll=e=>M.dismiss(void 0,e),M.remove=(e,t)=>{let r={type:4,toastId:e};t?C(t)(r):D(r)},M.removeAll=e=>M.remove(void 0,e),M.promise=(e,t,r)=>{let s=M.loading(t.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let i=t.success?j(t.success,e):void 0;return i?M.success(i,{id:s,...r,...null==r?void 0:r.success}):M.dismiss(s),e}).catch(e=>{let i=t.error?j(t.error,e):void 0;i?M.error(i,{id:s,...r,...null==r?void 0:r.error}):M.dismiss(s)}),e};var I=b`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,O=b`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,G=b`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,F=(v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${I} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${O} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${G} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,b`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`),L=(v("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${F} 1s linear infinite;
`,b`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`),R=b`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,T=(v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${L} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${R} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,v("div")`
  position: absolute;
`,v("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,b`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`);v("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${T} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,v("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,v("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,s=i.createElement,c.p=void 0,f=s,g=void 0,y=void 0,m`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`;var U=M}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[1702,4648,9535],()=>r(79271));module.exports=s})();