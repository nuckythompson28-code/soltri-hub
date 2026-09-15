/* User-supplied machine information. Geometry is separate from CNC programs.
   Only the current O0600 layout uses this setup; archived T02 parting does not. */
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
  globalThis.SoltriMachineSetups=Object.freeze({
    unit5:Object.freeze({machine:'5',controller:'FANUC Series 0i-TD',received:'2026-09-11',
      programs:Object.freeze(['600']),geometry,tips,datumTool:3,
      photo:'docs/evidence/unit5-geometry-20260911.png',
      // Simulation conventions, not a dump of controller parameters or wear.
      offsetMode:'coordinate-shift',offsetModeConfirmed:false,xMode:'diameter',wearIncluded:false,
      t2Datum:'extended',t2DatumConfirmed:true,t2ReturnTravel:42,t2TravelMeasured:false})
  });
})();
