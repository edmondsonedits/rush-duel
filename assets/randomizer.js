const DEFAULT_SEED=0x6d2b79f5;

export function normalizeSeed(value){
  if(typeof value==='string'){
    let hash=2166136261;
    for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
    value=hash>>>0;
  }
  const number=Number(value);
  if(!Number.isFinite(number))return DEFAULT_SEED;
  const seed=number>>>0;
  return seed||DEFAULT_SEED;
}

export function deriveSeed(seed,salt){
  return normalizeSeed(`${normalizeSeed(seed)}:${String(salt||'default')}`);
}

export function createSessionSeed(){
  try{
    if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1);globalThis.crypto.getRandomValues(value);return normalizeSeed(value[0]);}
  }catch{}
  return normalizeSeed(Date.now());
}

export class SeededRandom{
  constructor(seed=DEFAULT_SEED){this.seed=normalizeSeed(seed);this.state=this.seed;}
  reset(seed=this.seed){this.seed=normalizeSeed(seed);this.state=this.seed;return this;}
  setState(state){this.state=normalizeSeed(state);return this;}
  nextUint32(){
    let x=this.state>>>0;
    x^=(x<<13)>>>0;x^=x>>>17;x^=(x<<5)>>>0;
    this.state=x>>>0;
    return this.state;
  }
  next(){return this.nextUint32()/4294967296;}
  int(maxExclusive){const max=Math.max(1,Math.floor(Number(maxExclusive)||1));return Math.floor(this.next()*max);}
  snapshot(){return {seed:this.seed,state:this.state};}
}
