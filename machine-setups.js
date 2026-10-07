/* User-supplied machine information. Geometry is separate from CNC programs.
   Unit5 O0600 and unit7 O0852 use separate geometry; other machines stay unchanged. */
(()=>{
  'use strict';
  const geometry=Object.freeze({
    1:Object.freeze({X:-752.942,Z:-543.000,radius:0,tip:0,label:'복합 보링바'}),
    2:Object.freeze({X:-243.772,Z:-542.340,radius:0,tip:0,label:'공압 면취기'}),
    3:Object.freeze({X:-194.772,Z:-546.200,radius:0,tip:0,label:'아래쪽 절단바이트'})
  });
  const datum=geometry[3];
  // Tool point = carriage datum + (datum geometry - tool geometry).
  // X is the diameter convention already used by this simulator.
  const tips=Object.freeze(Object.fromEntries(Object.entries(geometry).map(([n,g])=>
    [n,Object.freeze({z:datum.Z-g.Z,r:(datum.X-g.X)/2})])));
  const unit7Geometry=Object.freeze({
    1:Object.freeze({X:-518.000,Z:-488.020,label:'90도 상하 보링바'}),
    2:Object.freeze({X:-586.700,Z:-436.000,label:'2mm 위쪽 절단날'}),
    3:Object.freeze({X:-867.500,Z:-452.000,label:'오토링크'})
  });
  globalThis.SoltriMachineSetups=Object.freeze({
    unit7:Object.freeze({machine:'7',controller:'FANUC i Series',received:'2026-10-02',
      programs:Object.freeze(['852']),geometry:unit7Geometry,datumTool:1,
      tips:Object.freeze(Object.fromEntries(Object.entries(unit7Geometry).map(([n,g])=>[n,Object.freeze({z:unit7Geometry[1].Z-g.Z,r:(unit7Geometry[1].X-g.X)/2})]))),
      offsetMode:'coordinate-shift',offsetModeConfirmed:false,xMode:'diameter',xModeConfirmed:true,wearIncluded:false,
      photo:'docs/evidence/unit7-tools-20261002.png'}) ,
    unit5:Object.freeze({machine:'5',controller:'FANUC Series 0i-TD',received:'2026-09-11',
      programs:Object.freeze(['600']),geometry,tips,datumTool:3,
      photo:'docs/evidence/unit5-geometry-20260911.png',
      // Simulation conventions, not a dump of controller parameters or wear.
      offsetMode:'coordinate-shift',offsetModeConfirmed:false,xMode:'diameter',wearIncluded:false,
      t2Datum:'extended',t2DatumConfirmed:true,t2ReturnTravel:42,t2TravelMeasured:false})
  });
})();
