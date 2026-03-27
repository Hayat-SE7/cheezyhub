exports.id=4905,exports.ids=[4905],exports.modules={71317:(t,e,r)=>{Promise.resolve().then(r.bind(r,64617))},64617:(t,e,r)=>{"use strict";r.r(e),r.d(e,{default:()=>s});var o=r(19899);r(5507);var a=r(76153),i=r(17035);function s({children:t}){(0,a.useRouter)(),(0,a.usePathname)();let{isAuthenticated:e,user:r}=(0,i.n)();return o.jsx("div",{className:"dark-ui",children:t})}},17035:(t,e,r)=>{"use strict";r.d(e,{n:()=>s});var o=r(24978),a=r(31460),i=r(49285);let s=(0,o.Ue)()((0,a.tJ)(t=>({user:null,token:null,isAuthenticated:!1,login:(e,r)=>{i.Z.set("ch_kitchen_token",e,{expires:7,sameSite:"strict",path:"/"}),t({token:e,user:r,isAuthenticated:!0})},logout:()=>{i.Z.remove("ch_kitchen_token",{path:"/"}),t({token:null,user:null,isAuthenticated:!1})}}),{name:"ch-kitchen",partialize:t=>({user:t.user,token:t.token,isAuthenticated:t.isAuthenticated})}))},58548:(t,e,r)=>{"use strict";r.r(e),r.d(e,{default:()=>o});let o=(0,r(2772).createProxy)(String.raw`D:\cheezyhub-v4\cheezyhub\frontend\src\app\kitchen\layout.tsx#default`)},90832:(t,e,r)=>{"use strict";r.d(e,{ZP:()=>T});var o,a=r(5507);let i={data:""},s=t=>{if("object"==typeof window){let e=(t?t.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return e.nonce=window.__nonce__,e.parentNode||(t||document.head).appendChild(e),e.firstChild}return t||i},n=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,d=/\/\*[^]*?\*\/|  +/g,l=/\n+/g,c=(t,e)=>{let r="",o="",a="";for(let i in t){let s=t[i];"@"==i[0]?"i"==i[1]?r=i+" "+s+";":o+="f"==i[1]?c(s,i):i+"{"+c(s,"k"==i[1]?"":e)+"}":"object"==typeof s?o+=c(s,e?e.replace(/([^,])+/g,t=>i.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,e=>/&/.test(e)?e.replace(/&/g,t):t?t+" "+e:e)):i):null!=s&&(i=/^--/.test(i)?i:i.replace(/[A-Z]/g,"-$&").toLowerCase(),a+=c.p?c.p(i,s):i+":"+s+";")}return r+(e&&a?e+"{"+a+"}":a)+o},p={},u=t=>{if("object"==typeof t){let e="";for(let r in t)e+=r+u(t[r]);return e}return t},m=(t,e,r,o,a)=>{let i=u(t),s=p[i]||(p[i]=(t=>{let e=0,r=11;for(;e<t.length;)r=101*r+t.charCodeAt(e++)>>>0;return"go"+r})(i));if(!p[s]){let e=i!==t?t:(t=>{let e,r,o=[{}];for(;e=n.exec(t.replace(d,""));)e[4]?o.shift():e[3]?(r=e[3].replace(l," ").trim(),o.unshift(o[0][r]=o[0][r]||{})):o[0][e[1]]=e[2].replace(l," ").trim();return o[0]})(t);p[s]=c(a?{["@keyframes "+s]:e}:e,r?"":"."+s)}let m=r&&p.g?p.g:null;return r&&(p.g=p[s]),((t,e,r,o)=>{o?e.data=e.data.replace(o,t):-1===e.data.indexOf(t)&&(e.data=r?t+e.data:e.data+t)})(p[s],e,o,m),s},f=(t,e,r)=>t.reduce((t,o,a)=>{let i=e[a];if(i&&i.call){let t=i(r),e=t&&t.props&&t.props.className||/^go/.test(t)&&t;i=e?"."+e:t&&"object"==typeof t?t.props?"":c(t,""):!1===t?"":t}return t+o+(null==i?"":i)},"");function g(t){let e=this||{},r=t.call?t(e.p):t;return m(r.unshift?r.raw?f(r,[].slice.call(arguments,1),e.p):r.reduce((t,r)=>Object.assign(t,r&&r.call?r(e.p):r),{}):r,s(e.target),e.g,e.o,e.k)}g.bind({g:1});let h,b,y,x=g.bind({k:1});function v(t,e){let r=this||{};return function(){let o=arguments;function a(i,s){let n=Object.assign({},i),d=n.className||a.className;r.p=Object.assign({theme:b&&b()},n),r.o=/ *go\d+/.test(d),n.className=g.apply(r,o)+(d?" "+d:""),e&&(n.ref=s);let l=t;return t[0]&&(l=n.as||t,delete n.as),y&&l[0]&&y(n),h(l,n)}return e?e(a):a}}var w=t=>"function"==typeof t,k=(t,e)=>w(t)?t(e):t,A=(()=>{let t=0;return()=>(++t).toString()})(),$=((()=>{let t;return()=>t})(),"default"),j=(t,e)=>{let{toastLimit:r}=t.settings;switch(e.type){case 0:return{...t,toasts:[e.toast,...t.toasts].slice(0,r)};case 1:return{...t,toasts:t.toasts.map(t=>t.id===e.toast.id?{...t,...e.toast}:t)};case 2:let{toast:o}=e;return j(t,{type:t.toasts.find(t=>t.id===o.id)?1:0,toast:o});case 3:let{toastId:a}=e;return{...t,toasts:t.toasts.map(t=>t.id===a||void 0===a?{...t,dismissed:!0,visible:!1}:t)};case 4:return void 0===e.toastId?{...t,toasts:[]}:{...t,toasts:t.toasts.filter(t=>t.id!==e.toastId)};case 5:return{...t,pausedAt:e.time};case 6:let i=e.time-(t.pausedAt||0);return{...t,pausedAt:void 0,toasts:t.toasts.map(t=>({...t,pauseDuration:t.pauseDuration+i}))}}},_=[],z={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},O={},I=(t,e=$)=>{O[e]=j(O[e]||z,t),_.forEach(([t,r])=>{t===e&&r(O[e])})},N=t=>Object.keys(O).forEach(e=>I(t,e)),D=t=>Object.keys(O).find(e=>O[e].toasts.some(e=>e.id===t)),P=(t=$)=>e=>{I(e,t)},S={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},C=(t,e="blank",r)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:e,ariaProps:{role:"status","aria-live":"polite"},message:t,pauseDuration:0,...r,id:(null==r?void 0:r.id)||A()}),E=t=>(e,r)=>{let o=C(e,t,r);return P(o.toasterId||D(o.id))({type:2,toast:o}),o.id},F=(t,e)=>E("blank")(t,e);F.error=E("error"),F.success=E("success"),F.loading=E("loading"),F.custom=E("custom"),F.dismiss=(t,e)=>{let r={type:3,toastId:t};e?P(e)(r):N(r)},F.dismissAll=t=>F.dismiss(void 0,t),F.remove=(t,e)=>{let r={type:4,toastId:t};e?P(e)(r):N(r)},F.removeAll=t=>F.remove(void 0,t),F.promise=(t,e,r)=>{let o=F.loading(e.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof t&&(t=t()),t.then(t=>{let a=e.success?k(e.success,t):void 0;return a?F.success(a,{id:o,...r,...null==r?void 0:r.success}):F.dismiss(o),t}).catch(t=>{let a=e.error?k(e.error,t):void 0;a?F.error(a,{id:o,...r,...null==r?void 0:r.error}):F.dismiss(o)}),t};var L=x`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,Z=x`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,q=x`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,H=(v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${L} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${Z} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${t=>t.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${q} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,x`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`),J=(v("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${t=>t.secondary||"#e0e0e0"};
  border-right-color: ${t=>t.primary||"#616161"};
  animation: ${H} 1s linear infinite;
`,x`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`),M=x`
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
}`,R=(v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${t=>t.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${J} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${M} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${t=>t.secondary||"#fff"};
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
`,x`
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
  animation: ${R} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
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
`,o=a.createElement,c.p=void 0,h=o,b=void 0,y=void 0,g`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`;var T=F}};