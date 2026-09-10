/* =========================================================================
   1) 식 평가기
   ========================================================================= */
function lex(s){
  const toks=[]; let i=0;
  const isd=c=>c>='0'&&c<='9', isa=c=>(c>='A'&&c<='Z')||(c>='a'&&c<='z');
  while(i<s.length){
    const c=s[i];
    if(c===' '||c==='\t'){i++;continue;}
    if(c==='#'){toks.push({t:'#'});i++;continue;}
    if(c==='['||c===']'){toks.push({t:c});i++;continue;}
    if(c==='+'||c==='-'||c==='*'||c==='/'){toks.push({t:c});i++;continue;}
    if(isd(c)||(c==='.'&&isd(s[i+1]))){ let j=i; while(j<s.length&&(isd(s[j])||s[j]==='.'))j++; toks.push({t:'num',v:parseFloat(s.slice(i,j))}); i=j; continue; }
    if(isa(c)){ let j=i; while(j<s.length&&isa(s[j]))j++; toks.push({t:'w',v:s.slice(i,j).toUpperCase()}); i=j; continue; }
    i++;
  }
  return toks;
}
function evalExpr(str, getV){
  const T=lex(str); let p=0;
  const peek=()=>T[p], next=()=>T[p++];
  function primary(){
    const tk=peek(); if(!tk) return 0;
    if(tk.t==='num'){next(); return tk.v;}
    if(tk.t==='#'){next(); const n=next(); return getV(n&&n.v!=null? n.v:0);}
    if(tk.t==='['){next(); const v=orE(); if(peek()&&peek().t===']')next(); return v;}
    if(tk.t==='+'||tk.t==='-'){return unary();}
    if(tk.t==='w'){
      const w=tk.v; next();
      if(w==='FIX'||w==='FUP'||w==='ROUND'||w==='ABS'){
        let a=0; if(peek()&&peek().t==='['){next(); a=orE(); if(peek()&&peek().t===']')next();}
        if(w==='FIX')return Math.trunc(a + (a>0?1e-6:a<0?-1e-6:0)); // 이진 부동소수점 오차 보정
        if(w==='FUP')return a<0?Math.floor(a):Math.ceil(a);
        if(w==='ROUND')return Math.round(a);
        return Math.abs(a);
      }
      return 0;
    }
    next(); return 0;
  }
  function unary(){ const tk=peek(); if(tk&&(tk.t==='+'||tk.t==='-')){next(); const v=unary(); return tk.t==='-'?-v:v;} return primary(); }
  function mul(){ let v=unary(); while(peek()&&(peek().t==='*'||peek().t==='/')){const op=next().t; const r=unary(); v=op==='*'?v*r:v/r;} return v; }
  function add(){ let v=mul(); while(peek()&&(peek().t==='+'||peek().t==='-')){const op=next().t; const r=mul(); v=op==='+'?v+r:v-r;} return v; }
  function cmp(){ let v=add(); const tk=peek(); if(tk&&tk.t==='w'&&['EQ','NE','GT','LT','GE','LE'].includes(tk.v)){next(); const r=add(); const eps=1e-9;
      switch(tk.v){case'EQ':return Math.abs(v-r)<eps?1:0;case'NE':return Math.abs(v-r)>=eps?1:0;case'GT':return v>r?1:0;case'LT':return v<r?1:0;case'GE':return v>=r-eps?1:0;case'LE':return v<=r+eps?1:0;} } return v; }
  function andE(){ let v=cmp(); while(peek()&&peek().t==='w'&&peek().v==='AND'){next(); const r=cmp(); v=(v!==0&&r!==0)?1:0;} return v; }
  function orE(){ let v=andE(); while(peek()&&peek().t==='w'&&peek().v==='OR'){next(); const r=andE(); v=(v!==0||r!==0)?1:0;} return v; }
  return orE();
}

/* 모션 블록(주소+값) 파서 */
function parseBlock(line, getV){
  const G=[], Mc=[], w={}; let i=0; const s=line;
  const isa=c=>(c>='A'&&c<='Z')||(c>='a'&&c<='z');
  while(i<s.length){
    const c=s[i];
    if(!isa(c)){ i++; continue; }
    const addr=c.toUpperCase(); i++;
    let depth=0, j=i, buf='';
    while(j<s.length){ const d=s[j]; if(d==='[')depth++; else if(d===']')depth--; if(depth===0&&isa(d))break; buf+=d; j++; }
    i=j;
    const val = buf.trim()===''? null : evalExpr(buf,getV);
    if(addr==='G')G.push(val); else if(addr==='M')Mc.push(val); else w[addr]=val;
  }
  return {G,Mc,w};
}

/* =========================================================================
   2) 인터프리터
   ========================================================================= */
/* 프로그램별 변수 라벨/추적 세트 (mainKey 기준) */
const PROGVARS={
 '852':{keys:[109,110,111,112,113,114,118,120,121,124,125,126,127,103,530,531,532,140,505,515,517,518,519,520,521,522,525],
   lbl:{109:'소재OD',110:'소재ID',111:'완성OD',112:'완성ID',113:'길이',114:'팁폭',118:'OD면취',120:'T01rpm',121:'T02rpm',124:'황삭F',125:'스텝F',126:'면취F',127:'절단F',103:'척길이',530:'안전거리',531:'척좌한계',532:'척투조',140:'총길이',505:'단위장',515:'스텝수',517:'토막수',518:'가공장',519:'바리필',520:'스텝카운트',521:'피스',522:'누적Z',525:'리필카운트'}},
 '8000':{keys:[101,102,103,104,105,106,107,119,120,121,122,100,500,505,506,508,514,516,520,521,522,530,531],
   lbl:{101:'소재OD',102:'소재ID',103:'완성OD',104:'완성ID',105:'절단길이',106:'톱폭',107:'그룹수',119:'면취C',120:'수량',121:'소형관',122:'마킹생략',100:'총길이',500:'원점시프트',505:'단위장',506:'그룹장',508:'면취X',514:'T01rpm',516:'T03rpm',520:'스텝',521:'면취Z',522:'누적Z',530:'잔여장',531:'잔여수'}},
 '400':{keys:[101,102,103,104,105,106,123,121,107,108,100,500,505,506,508,520,522,530,531,532],
   lbl:{101:'소재OD',102:'소재ID',103:'완성OD',104:'완성ID',105:'절단길이',106:'톱폭',123:'그룹수',121:'면취타입',107:'ID우면취',108:'OD우면취',100:'총길이',500:'원점시프트',505:'단위장',506:'그룹장',508:'면취X',520:'스텝',522:'누적Z',530:'잔여장',531:'잔여수',532:'잔여보정'}},
};
let KEYVARS=PROGVARS['852'].keys, VARLBL=PROGVARS['852'].lbl;
function programVariant(text){return parsePrograms(text).mainKey;}
function applyProgVars(text){const p=PROGVARS[programVariant(text)]||PROGVARS['852'];KEYVARS=p.keys;VARLBL=p.lbl;}

function parsePrograms(text){
  const lines=text.split(/\r?\n/);
  const programs={}, programLines=[]; let curp=null, mainKey=null;
  for(let i=0;i<lines.length;i++){
    const raw=lines[i];
    const t=raw.replace(/\([^)]*\)/g,'').trim();
    const om=t.match(/^O\s*(\d+)/i);
    if(om){ const k=(om[1].replace(/^0+/,'')||'0'); curp=k; programs[k]={lines:[],labels:{}}; if(mainKey===null)mainKey=k; }
    programLines.push({idx:i, prog:curp, raw});
    if(curp){
      const pIdx=programs[curp].lines.length; programs[curp].lines.push(i);
      const lm=t.match(/^N\s*(\d+)/i);
      if(lm){ const ln=(lm[1].replace(/^0+/,'')||'0'); if(programs[curp].labels[ln]===undefined) programs[curp].labels[ln]=pIdx; }
    }
  }
  return {programs, programLines, mainKey};
}

function gname(t){ return t===0?'G00 급속이송':t===1?'G01 직선절삭':t===2?'G02 원호(CW)':t===3?'G03 원호(CCW)':'이동'; }
function fmt(v){ if(v==null||!isFinite(v))return'—'; if(Math.abs(v)<1e-9)return'0'; return (+v.toFixed(3)).toString(); }

const MACHINE_PROFILES={
 '500':{name:'5호기 · O0500',note:'T1 내·외경 동시 가공 · T2 아래에서 위로 절단',link:'o0500.html',up:53,down:54,airOn:51,airOff:52,cw:4,partTool:2,tools:{1:['복합 보링바','내·외경 동시 가공','compound'],2:['아래쪽 절단','X 음수 · 위로 절입 ↑','part']}},
 '2026':{name:'5호기 · AL · 제일연마',note:'T1 내·외경·홈 가공 · T2 아래에서 위로 절단',link:'o2026.html',up:53,down:54,airOn:51,airOff:52,cw:4,partTool:2,tools:{1:['복합 보링바','내·외경·홈 가공','compound'],2:['아래쪽 절단','X 음수 · 위로 절입 ↑','part']}},
 '400':{name:'2호기 · HA',note:'T1 내·외경 동시 가공 · T2 위쪽 절단',link:'o0400.html',up:54,down:53,airOn:57,airOff:58,cw:4,partTool:2,tools:{1:['복합 보링바','내·외경 동시 가공','compound'],2:['위쪽 절단','X 양수 · 아래로 절입 ↓','part']}},
 '8000':{name:'6호기 · HA',note:'T1 내·외경 · T2 면취 · T3 아래쪽 절단',link:'o8000.html',up:53,down:54,airOn:51,airOff:52,cw:3,partTool:3,tools:{1:['복합 보링바','내·외경 동시 가공','compound'],2:['면취 바이트','전진 M56 / 후진 M55','chamfer'],3:['아래쪽 절단','X 음수 · 위로 절입 ↑','part']}},
 '852':{name:'10호기 · AL',note:'T1 내·외경 · T2 절단 · T3 오토링크 인출',link:'o0852.html',up:54,down:53,airOn:51,airOff:52,cw:4,partTool:2,pullTool:3,tools:{1:['복합 보링바','내·외경 동시 가공','compound'],2:['위쪽 절단','X 양수 · 아래로 절입 ↓','part'],3:['오토링크','소재를 잡고 +Z 인출 →','pull']}},
 generic:{name:'일반 선반 예제',note:'프로그램의 X·Z 지령을 기준으로 표시',link:null,tools:{1:['외경 바이트','일반 선삭','od'],3:['외경 바이트','일반 선삭','od'],5:['내경 보링바','내경 선삭','id']}}
};
PROGVARS['500']={keys:[100,101,102,103,104,105,106,107,108,109,110,115,116,120,121,122,123,124,505,515,516,517,518,520,521,522,531,542],lbl:{...PROGVARS['400'].lbl,100:'원점 길이',120:'목표 수량',121:'면취 수',122:'황삭 선택',123:'묶음 수량',515:'이번 묶음',516:'선가공 길이',517:'총 수량',518:'총 소모 길이',520:'묶음 완료',521:'전체 완료',522:'누적 Z',531:'남은 수량',542:'척 기준 여유'}};
MACHINE_PROFILES['600']={"name":"5호기 · O0600","note":"O8000 방식 · T1 보링 → T2 면취기 → T3 아래쪽 절단","link":"o0600.html","up":53,"down":54,"airOn":51,"airOff":52,"cw":4,"partTool":3,"tools":{"1":["복합 보링바","내·외경 묶음 선가공","compound"],"3":["아래쪽 절단","X 음수 · 위로 절입 ↑","part"],"2":["면취기","M56 전진 / M55 후진","chamfer"]}};
PROGVARS['600']={"keys":[100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,126,505,507,508,511,512,513,514,515,516,517,518,520,521,522,523,524,525,531,532,534,542],"lbl":{"100":"원점 길이","101":"소재 OD","102":"소재 ID","103":"완성 OD","104":"완성 ID","105":"길이","106":"T3 날 폭","107":"묶음 수량","108":"T1 시작 rpm","109":"T1 끝 rpm","110":"T1 이송","111":"T2 시작 rpm","112":"T2 끝 rpm","113":"T2 이송","114":"T3 시작 rpm","115":"T3 끝 rpm","116":"T3 이송","117":"소재 세팅","118":"제품별 후퇴","119":"뒤 외경 C","120":"목표 수량","121":"짧은 소재","122":"마킹 생략","126":"시스템 수량 검사","505":"피치","507":"선가공 길이","508":"T2 중심 직경","511":"T1 rpm 증분","512":"T2 rpm 증분","513":"T3 rpm 증분","514":"현재 T1 rpm","515":"현재 T2 rpm","516":"현재 T3 rpm","517":"전체 목표","518":"전체 소모 길이","520":"묶음 완료","521":"면취 위치","522":"절단 위치","523":"전체 완료","524":"이번 묶음","525":"완료 묶음","531":"남은 수량","532":"이번 묶음 길이","534":"총 묶음","542":"척 기준 여유"}};
PROGVARS['2026']={keys:[100,101,102,103,104,105,106,107,108,109,110,111,116,119,120,121,505,515,516,517,518,520,521,522,530,555],lbl:{...PROGVARS['400'].lbl,100:'척 기준 길이',119:'홈 가공',120:'홈 직경 감소',121:'홈 이동 폭',515:'묶음 수량',517:'총 수량',521:'가공 카운트',530:'척 여유',555:'홈 시작 폭'}};
PROGVARS['400'].keys.push(120,122,124);
PROGVARS['400'].lbl[120]='목표 수량';
PROGVARS['852'].keys.push(130);
function machineProfile(text){return MACHINE_PROFILES[programVariant(text)]||MACHINE_PROFILES.generic;}

function runProgram(text, maxMoves){
  applyProgVars(text);
  const machine=machineProfile(text);
  const {programs, programLines, mainKey}=parsePrograms(text);
  const vars={}; vars[3901]=0; vars[3902]=999999; /* 시뮬: 생산카운터 가드(O8000) 통과용 */
  const getV=n=>vars[n]!==undefined?vars[n]:0;
  let pc={prog:mainKey, ptr:0}; const stack=[]; const trace=[];
  let X=0,Z=0,xKnown=false,zKnown=false,motion=0,feed=0,rpm=0,sMode='',fmode='',tool='',toolNo=0,spin='정지',penReset=true,zOff=0,brakeUp=false,alClamp='open',mainChuck='closed',parts=0,air=false;
  let moves=0, guard=0, ended=false, endReason='', alarm=null;
  const GUARD=400000;

  function snapKV(){ const o={}; for(const n of KEYVARS) o[n]=vars[n]; return o; }
  function push(o){
    o.state={X:xKnown?X:null,Z:zKnown?Z:null,feed,rpm,sMode,fmode,tool,toolNo,spin,brakeUp,alClamp,mainChuck,zOff,parts,air};
    o.kv=snapKV();
    trace.push(o);
  }

  while(!ended){
    if(guard++>GUARD){ endReason='안전한도 초과(무한루프 방지)'; break; }
    const pr=programs[pc.prog];
    if(!pr){ endReason='프로그램 없음'; break; }
    if(pc.ptr>=pr.lines.length){ if(stack.length){ pc=stack.pop(); continue; } endReason='종료(끝)'; break; }
    const gIdx=pr.lines[pc.ptr];
    const raw=programLines[gIdx].raw;
    const cm=(raw.match(/\(([^)]*)\)/)||[])[1]||'';
    let line=raw.replace(/\([^)]*\)/g,' ').replace(/;/g,' ').trim();
    line=line.replace(/^N\s*\d+\s*/i,'').trim();
    const here=gIdx, hprog=pc.prog;
    pc.ptr++;
    if(line===''||line==='%'||/^O\s*\d/i.test(line)) continue;
    const U=line.toUpperCase();

    // ── 흐름 제어 ──────────────────────────────────────────
    if(/^M\s*30\b|^M\s*02\b/.test(U)){ push({lineIdx:here,prog:hprog,act:'end',desc:'M30 프로그램 종료',cm}); endReason='M30'; break; }
    if(/^M\s*99\b/.test(U)){
      push({lineIdx:here,prog:hprog,act:'return',desc:'M99 복귀',cm});
      if(stack.length){ pc=stack.pop(); } else { endReason='M99(최상위)'; break; } continue;
    }
    let mm=U.match(/M\s*98\s*P\s*(\d+)/);
    if(mm){
      const key=(mm[1].replace(/^0+/,'')||'0');
      push({lineIdx:here,prog:hprog,act:'call',desc:`M98 P${mm[1]} 호출`,cm});
      if(programs[key]){ stack.push({prog:pc.prog,ptr:pc.ptr}); pc={prog:key,ptr:0}; }
      else {alarm='O'+key+' 서브 파일이 없습니다. 메인과 서브를 함께 선택하세요.';push({lineIdx:here,prog:hprog,act:'alarm',desc:alarm,cm});endReason='서브 누락';break;}
      continue;
    }
    if(/^G\s*100\b/.test(U)){            // 사용자 매크로 G코드 호출 (파라미터 6050=100 → O9010)
      push({lineIdx:here,prog:hprog,act:'call',desc:'G100 → O9010 호출 (사용자매크로)',cm});
      if(programs['9010']){ stack.push({prog:pc.prog,ptr:pc.ptr}); pc={prog:'9010',ptr:0}; }
      else {alarm='G100 호출 대상 O9010 파일이 없습니다.';push({lineIdx:here,prog:hprog,act:'alarm',desc:alarm,cm});endReason='서브 누락';break;}
      continue;
    }
    let ifm=line.match(/^IF\b(.*)\bGOTO\s*(\d+)/i);
    if(ifm){
      const res=evalExpr(ifm[1],getV); const tgt=(ifm[2].replace(/^0+/,'')||'0');
      push({lineIdx:here,prog:hprog,act:'if',desc:`IF[${ifm[1].trim()}] → ${res?'참':'거짓'}${res?', GOTO '+ifm[2]:''}`,cm});
      if(res){ const lp=pr.labels[tgt]; if(lp!==undefined)pc.ptr=lp; else {alarm='O'+hprog+'에 N'+tgt+' 이동 라벨이 없습니다.';push({lineIdx:here,prog:hprog,act:'alarm',desc:alarm,cm});endReason='라벨 누락';break;} }
      continue;
    }
    let gm=line.match(/^GOTO\s*(\d+)/i);
    if(gm){
      const tgt=(gm[1].replace(/^0+/,'')||'0');
      push({lineIdx:here,prog:hprog,act:'goto',desc:`GOTO ${gm[1]}`,cm});
      const lp=pr.labels[tgt]; if(lp!==undefined)pc.ptr=lp; else {alarm='O'+hprog+'에 N'+tgt+' 이동 라벨이 없습니다.';push({lineIdx:here,prog:hprog,act:'alarm',desc:alarm,cm});endReason='라벨 누락';break;}
      continue;
    }
    const then=line.match(/^IF\s*(.*?)\s*THEN\s+(#\s*\d+\s*=.+)$/i);
    if(then){
      if(!evalExpr(then[1],getV)){push({lineIdx:here,prog:hprog,act:'if',desc:'IF 조건 거짓 · 대입 생략',cm});continue;}
      line=then[2];
    }
    // ── 변수 대입 ─────────────────────────────────────────
    let am=line.match(/^#\s*(\d+)\s*=\s*(.+)$/);
    if(am){
      const tn=parseInt(am[1],10); const val=evalExpr(am[2],getV);
      if(!Number.isFinite(val)){alarm='계산값 오류 #'+tn+' · 나눗셈과 입력값을 확인하세요.';push({lineIdx:here,prog:hprog,act:'alarm',desc:alarm,cm});endReason='계산 오류';break;}
      if(tn===3000){ alarm=cm||('알람 '+val); push({lineIdx:here,prog:hprog,act:'alarm',desc:`⚠ 알람 #3000=${val}: ${cm}`,cm}); endReason='알람'; break; }
      vars[tn]=val;
      push({lineIdx:here,prog:hprog,act:'assign',desc:`#${tn} = ${fmt(val)}`,changed:{n:tn,v:val},cm});
      continue;
    }
    // ── G/M/좌표 블록 ─────────────────────────────────────
    const {G,Mc,w}=parseBlock(line,getV);
    const has=n=>G.includes(n);
    // 모드 갱신
    if(has(96))sMode='G96 주속 일정'; if(has(97))sMode='G97 회전수 일정';
    if(has(98))fmode='mm/min'; if(has(99))fmode='mm/rev';
    if(w.S!=null)rpm=w.S; if(w.F!=null)feed=w.F;
    if(w.T!=null){ const tv=Math.round(w.T), nextTool=tv>=100?Math.floor(tv/100):tv; if(nextTool!==toolNo)penReset=true; toolNo=nextTool; tool='T'+String(toolNo).padStart(2,'0'); }
    for(const c of Mc){ if(c===3||c===4)spin=machine.cw?(c===machine.cw?'정회전 CW':'역회전 CCW'):'회전'; else if(c===5)spin='정지';
      if(c===(vars[133]||machine.up))brakeUp=true; if(c===(vars[134]||machine.down))brakeUp=false;
      if(vars[131]>0&&c===vars[131])alClamp='open'; if(vars[132]>0&&c===vars[132])alClamp='closed'; // 오토링크 클램프
      if(c===12){parts++;vars[3901]++;}
      if(c===machine.airOn)air=true; if(c===machine.airOff)air=false;
      if(c===69)mainChuck='open'; if(c===68)mainChuck='closed'; } // 메인척 개폐

    // G04 정지
    if(has(4)){ const tt=w.P!=null?(w.P+'ms'):(w.X!=null?(w.X+'s'):''); push({lineIdx:here,prog:hprog,act:'dwell',desc:`G04 일시정지 ${tt}`,cm}); continue; }
    // G10 좌표설정
    if(has(10)){const old=zOff;if(w.Z!=null)zOff=w.Z;if(w.W!=null)zOff+=w.W;if(zKnown)Z+=old-zOff;penReset=true;push({lineIdx:here,prog:hprog,act:'offset',desc:`G10 원점 설정 Z=${fmt(zOff)}`,cm});continue;}

    // 모션 모달
    let mG=null; for(const g of G){ if(g===0||g===1||g===2||g===3)mG=g; } if(mG!=null)motion=mG;
    const ref=has(53)||has(30)||has(28);
    const hasCoord=(w.X!=null||w.Z!=null||w.U!=null||w.W!=null);

    if(hasCoord){
      const nx=w.X!=null?w.X:(w.U!=null?X+w.U:X);
      const nz=w.Z!=null?w.Z:(w.W!=null?Z+w.W:Z);
      if(ref){xKnown=false;zKnown=false;penReset=true;push({lineIdx:here,prog:hprog,act:'park',desc:'기계 복귀 · 복귀 위치는 도식에서 생략',cm});continue;}
      const wasKnown=xKnown&&zKnown;
      if(w.X!=null)xKnown=true;if(w.Z!=null)zKnown=true;
      if(penReset||!wasKnown){
        X=nx;Z=nz;penReset=!(xKnown&&zKnown);
        push({lineIdx:here,prog:hprog,act:'park',desc:`공구 위치 설정 X${fmt(xKnown?X:null)} Z${fmt(zKnown?Z:null)}`,cm});
      } else {
        const seg={type:motion,x0:X,z0:Z,x1:nx,z1:nz,R:w.R,I:w.I,K:w.K,tool:toolNo,zOff};
        // 오토링크 인출: 클램프 닫힘 + 메인척 열림 상태의 Z이동 = 바를 끌어냄
        const pull=(toolNo===machine.pullTool && alClamp==='closed' && mainChuck==='open')? (nz-Z) : 0;
        X=nx; Z=nz;
        const label=motion===0?'rapid':motion===1?'feed':'arc';
        push({lineIdx:here,prog:hprog,act:'motion',seg,label,pull,desc:`${gname(motion)} → X${fmt(nx)} Z${fmt(nz)}${pull?' ⟶인출':''}${w.T!=null?' '+tool:''}`,cm});
        moves++;
        if(moves>=maxMoves){ push({lineIdx:here,prog:hprog,act:'cap',desc:`⏸ 최대이동 ${maxMoves}회 도달 — 이후 생략 (하단 '최대이동' 값을 늘리면 계속)`,cm}); endReason='이동제한'; break; }
      }
      continue;
    }
    // 비모션 (주축/공구/이송/M코드/기타)
    let act='misc', desc='';
    if(Mc.length){ act=Mc.includes(0)?'stop':'mcode'; desc=Mc.includes(0)?'M00 일시정지 · 재생을 눌러 다음 동작 확인':'M'+Mc.map(c=>Math.round(c)).join(' M')+(cm?` (${cm})`:''); }
    else if(w.S!=null||has(96)||has(97)){ act='spindle'; desc=`주축 ${sMode} S${fmt(rpm)}`; }
    else if(w.T!=null){ act='tool'; desc=`공구교환 ${tool}`; }
    else if(w.F!=null){ act='feed'; desc=`이송 F${fmt(feed)} (${fmode})`; }
    else { act='misc'; desc=line+(cm?` (${cm})`:''); }
    push({lineIdx:here,prog:hprog,act,desc,cm});
  }
  return {programs, programLines, trace, info:{moves, endReason, alarm, steps:trace.length}};
}
