/* User-confirmed assignments, updated 2026-09-11. Shared by home and machine pages. */
(()=>{
  "use strict";
  const machines=[
 {no:"1", type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M56",clClose:"M55",airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
 {no:"2", type:"HA", program:"O0300", archives:["O0400"], boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:null,clClose:null,airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
 {no:"3", type:"HA", program:"O8000", boringUp:"M53",boringDn:"M54",chFwd:"M56",chBwd:"M55",clOpen:null,clClose:null,airOn:"M08",airOff:"M09",cw:"M04",ccw:"M03"},
 {no:"4", type:"AL", program:null,    boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M52",clClose:"M51",airOn:null,airOff:null,cw:"M04",ccw:"M03"},
 {no:"5", type:"AL", program:"O0600", setupKey:"unit5", boringUp:"M53",boringDn:"M54",chFwd:"M56",chBwd:"M55",clOpen:"M171",clClose:"M170",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"6", type:"HA", program:"O8000", boringUp:"M53",boringDn:"M54",chFwd:"M56",chBwd:"M55",clOpen:null,clClose:null,airOn:"M51",airOff:"M52",cw:"M03",ccw:"M04",std:true},
 {no:"7", type:"AL", program:"O0852", boringUp:"M53",boringDn:"M54",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"8", type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"9", type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"10",type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"11",program:null,codesUnconfirmed:true},
 {no:"12",program:null,codesUnconfirmed:true},
 {no:"13",sub:"S3", type:"HA", program:"O2028", archives:["O0400"], boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M56",clClose:"M55",airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
 {no:"14",sub:"S4", type:"HA", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M56",clClose:"M55",airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
 {no:"15",program:null,codesUnconfirmed:true},
];
  // Equipment labels supplied by the user. OEM labels do not identify a base FANUC model.
  const controllerGroups=[
    {key:'smart-plus',label:'FANUC i Series Smart Plus',short:'i Series Smart Plus',units:['1','2','12','13','14'],maker:'현대위아'},
    {key:'0i-tc',label:'FANUC Series 0i-TC',short:'0i-TC',units:['3'],maker:'현대위아'},
    {key:'0i-tb',label:'FANUC Series 0i-TB',short:'0i-TB',units:['4']},
    {key:'0i-td',label:'FANUC Series 0i-TD',short:'0i-TD',units:['5','6','11']},
    {key:'i-series',label:'FANUC i Series',short:'i Series',units:['7','8','9','10'],maker:'현대위아'},
    {key:'21i-t',label:'FANUC Series 21i-T',short:'21i-T',units:['15']}
  ];
  for(const group of controllerGroups)for(const no of group.units){
    Object.assign(machines.find(m=>m.no===no),{controllerKey:group.key,controller:group.label,controllerShort:group.short,maker:group.maker,controllerReceived:'2026-09-11'});
  }
  for(const no of ['1','7','8','9','10','13','14'])Object.assign(machines.find(m=>m.no===no),{model:'KIT60G',modelReceived:'2026-10-02'});
  const programs={
"O2028":{"id": "O2028", "file": "o2028.html", "short": "제일연마 · 설정 검토", "description": "S3 제일연마 242×230.30×9.87 · 소재값 미확정 / CNC 실행 전 검토", "tools": "T1 내·외경·면취·홈 · T2 위쪽 절단", "subs": ["O2029", "O6000", "O6001", "O6002", "O6003", "O6004"], "reference": "13", "color": "#397b75", "simulator": true},
  "O0300": {
    "id": "O0300",
    "file": "o0300.html",
    "short": "T2 면취 · T3 절단",
    "description": "2호기 실사용 O0300 · CNC 사진 전사 및 O0600·O8000 면취 비교",
    "tools": "T1 내·외경 · T2 면취기 · T3 절단",
    "subs": ["O0310"],
    "reference": "2",
    "color": "#72d9cd",
    "transcript": "programs/o0300/photo-transcript.txt",
    "simulator": false
  },
  "O0852": {
    "id": "O0852",
    "file": "o0852.html",
    "short": "오토링크",
    "description": "봉 소재 자동 연속 가공 · 오토링크 인출",
    "tools": "T1 내·외경 · T2 절단 · T3 오토링크",
    "subs": [
      "O9001",
      "O9002",
      "O9003"
    ],
    "reference": "10",
    "color": "#7ee3b1"
  },
  "O0400": {
    "id": "O0400",
    "file": "o0400.html",
    "short": "묶음 보링",
    "description": "O0400 반토막 · 묶음 보링과 3/4면취",
    "tools": "T1 내·외경·면취 · T2 절단",
    "subs": [
      "O0410",
      "O7001",
      "O7002",
      "O7003",
      "O7004",
      "O7005"
    ],
    "reference": "2",
    "color": "#76bfff"
  },
  "O8000": {
    "id": "O8000",
    "file": "o8000.html",
    "comparison": "o0300.html#compare",
    "short": "풀커팅",
    "description": "O8000 풀커팅 · 묶음 보링 → 개별 면취·절단",
    "tools": "T1 내·외경 · T2 면취기 · T3 절단",
    "subs": [
      "O9010"
    ],
    "reference": "6",
    "color": "#c2a5ff"
  },
  "O0600": {
    "id": "O0600",
    "file": "o0600.html",
    "comparison": "o0300.html#compare",
    "short": "T2 면취 · T3 절단",
    "description": "5호기 O8000 방식 · 최신 공구 배치 반영",
    "tools": "T1 보링 → T2 면취기 → T3 아래쪽 절단",
    "subs": [
      "O9050"
    ],
    "reference": "5",
    "color": "#ffaf70",
    "package": "programs/o0600-unit5-package.zip",
    "manualPatch": "o0600-patch.html",
    "patchTxt": "programs/patches/unit5-o9050-manual-patch-20260910.txt",
    "txt": [
      "programs/o0600/O0600.txt",
      "programs/o0600/O9050.txt"
    ]
  },
  "O2026": {
    "id": "O2026",
    "file": "o2026.html",
    "short": "제일연마",
    "description": "제일연마 품목 전용 · 내·외경 → 홈 → 절단",
    "tools": "기존 배치: T1 복합 보링바 · T2 아래쪽 절단 · T3 미사용",
    "subs": [
      "O2027"
    ],
    "reference": "5",
    "color": "#a7becf"
  },
  "O0500": {
    "id": "O0500",
    "file": "o0500.html",
    "short": "보관용 · 3면취 기본",
    "description": "O0400 방식의 5호기 보관본 · 기존 원문 유지",
    "tools": "기존 배치: T1 복합 보링바 · T2 아래쪽 절단",
    "subs": [
      "O9030",
      "O9031",
      "O9032",
      "O9033",
      "O9034"
    ],
    "reference": "5",
    "color": "#a7becf",
    "package": "programs/o0500-unit5-package.zip"
  }
};
  window.SoltriPrograms={machines,programs,controllerGroups,byNo:Object.fromEntries(machines.map(m=>[m.no,m]))};
})();
