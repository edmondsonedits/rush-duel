import * as Core from './core-v13.js';
import {NetworkDuel} from './network-v13.js';
window.__RUSH_MODULES={...Core,NetworkDuel};
for(const src of ['./app-v13-part1.js?v=17','./app-v13-part2.js?v=17','./app-v13-part3.js?v=17','./mobile-ui-v16.js?v=17']){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(src,import.meta.url);script.onload=resolve;script.onerror=()=>reject(new Error('Could not load '+src));document.head.appendChild(script);});}
