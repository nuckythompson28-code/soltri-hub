/* User-confirmed assignments, 2026-09-10. Shared by home and machine pages. */
(()=>{
  "use strict";
  const machines=[
 {no:"1", type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M56",clClose:"M55",airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
 {no:"2", type:"HA", program:"O0400", boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:null,clClose:null,airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
 {no:"3", type:"HA", program:"O8000", boringUp:"M53",boringDn:"M54",chFwd:"M56",chBwd:"M55",clOpen:null,clClose:null,airOn:"M08",airOff:"M09",cw:"M04",ccw:"M03"},
 {no:"4", type:"AL", program:null,    boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M52",clClose:"M51",airOn:null,airOff:null,cw:"M04",ccw:"M03"},
 {no:"5", type:"AL", program:"O0600", boringUp:"M53",boringDn:"M54",chFwd:"M56",chBwd:"M55",clOpen:"M171",clClose:"M170",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"6", type:"HA", program:"O8000", boringUp:"M53",boringDn:"M54",chFwd:"M56",chBwd:"M55",clOpen:null,clClose:null,airOn:"M51",airOff:"M52",cw:"M03",ccw:"M04",std:true},
 {no:"7", type:"AL", program:"O0852", boringUp:"M53",boringDn:"M54",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"8", type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"9", type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"10",type:"AL", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:"M55",chBwd:"M56",clOpen:"M64",clClose:"M63",airOn:"M51",airOff:"M52",cw:"M04",ccw:"M03"},
 {no:"13",sub:"S3", type:"HA", program:"O0400", boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M56",clClose:"M55",airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
 {no:"14",sub:"S4", type:"HA", program:"O0852", boringUp:"M54",boringDn:"M53",chFwd:null,chBwd:null,clOpen:"M56",clClose:"M55",airOn:"M57",airOff:"M58",cw:"M04",ccw:"M03"},
];
  const programs={
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
  window.SoltriPrograms={machines,programs,byNo:Object.fromEntries(machines.map(m=>[m.no,m]))};
})();
