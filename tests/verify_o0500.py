"""Execute NC macro control flow and verify quantity, coordinates and guards.

This bounded interpreter models X/U diameter commands, Z/W, G10 offsets,
modal feeds, calls and arithmetic. It does not model tool geometry, PLC timing,
machine reference positions, spindle dynamics or controller look-ahead.
"""
from pathlib import Path
import ast
import math
import re
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'programs/o0500-unit5.nc').read_text(encoding='ascii')


class Alarm(Exception):
    def __init__(self, number):
        self.number = number


class NC:
    def __init__(self, source=SOURCE, overrides=None):
        self.vars = {0: 0.0}
        self.overrides = overrides or {}
        self.programs, self.labels = {}, {}
        matches = list(re.finditer(r'^\s*O(\d+)\b[^\n]*', source, re.M))
        for i, match in enumerate(matches):
            number = int(match[1])
            assert number not in self.programs, ('duplicate program', number)
            end = matches[i+1].start() if i+1 < len(matches) else len(source)
            lines = source[match.end():end].splitlines()
            lines = [re.sub(r'\([^)]*\)', '', line).strip().rstrip(';').strip() for line in lines]
            lines = [line for line in lines if line and line != '%']
            self.programs[number] = lines
            labels = {}
            for index, line in enumerate(lines):
                label = re.match(r'N(\d+)\b', line)
                if label:
                    assert int(label[1]) not in labels, ('duplicate label', number, label[1])
                    labels[int(label[1])] = index
            self.labels[number] = labels
        self.moves, self.events, self.calls, self.offsets = [], [], [], []
        self.x = self.z = None
        self.offset = 0
        self.motion = 'G00'
        self.tool = None
        self.feed = self.rpm = None

    def expr(self, source):
        if re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)',source.strip()):
            return float(source)
        value = re.sub(r'#(\d+)', lambda m: repr(self.vars.get(int(m[1]), 0)), source)
        value = value.replace('[', '(').replace(']', ')')
        for word, replacement in {'EQ':'==','NE':'!=','LT':'<','LE':'<=','GT':'>','GE':'>=','AND':'and','OR':'or'}.items():
            value = re.sub(r'\b'+word+r'\b', replacement, value)
        def read(node):
            if isinstance(node, ast.Constant) and isinstance(node.value, (int,float)): return node.value
            if isinstance(node, ast.UnaryOp):
                if isinstance(node.op, ast.USub): return -read(node.operand)
                if isinstance(node.op, ast.UAdd): return read(node.operand)
            if isinstance(node, ast.BinOp):
                a,b=read(node.left),read(node.right)
                if isinstance(node.op, ast.Add): return a+b
                if isinstance(node.op, ast.Sub): return a-b
                if isinstance(node.op, ast.Mult): return a*b
                if isinstance(node.op, ast.Div): return a/b
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id=='FIX' and len(node.args)==1:
                return math.trunc(read(node.args[0]))
            if isinstance(node, ast.Compare) and len(node.ops)==1:
                a,b=read(node.left),read(node.comparators[0]); op=node.ops[0]
                if isinstance(op, ast.Eq): return a==b
                if isinstance(op, ast.NotEq): return a!=b
                if isinstance(op, ast.Lt): return a<b
                if isinstance(op, ast.LtE): return a<=b
                if isinstance(op, ast.Gt): return a>b
                if isinstance(op, ast.GtE): return a>=b
            if isinstance(node, ast.BoolOp):
                if isinstance(node.op,ast.And): return all(read(n) for n in node.values)
                if isinstance(node.op,ast.Or): return any(read(n) for n in node.values)
            raise AssertionError(('unsupported expression',source,ast.dump(node)))
        return read(ast.parse(value.strip(),mode='eval').body)

    def words(self, line):
        result=[]; i=0
        while i<len(line):
            if line[i].isspace() or line[i]==';': i+=1; continue
            letter=line[i]
            assert letter in 'GMXYZUWSFTPL', ('unknown NC word',line[i:],line)
            i+=1; begin=i; depth=0
            while i<len(line):
                c=line[i]
                if c=='[': depth+=1
                if c==']': depth-=1
                if depth==0 and (c.isspace() or c in 'GMXYZUWSFTPL;'): break
                i+=1
            assert i>begin and depth==0, ('bad address',line)
            result.append((letter,self.expr(line[begin:i])))
        return result

    def run(self, program=500, start=0, preset=None):
        if preset: self.vars.update(preset)
        stack=[]; pc=start; stage=None
        for _ in range(250000):
            assert pc<len(self.programs[program]), ('fell off subprogram without M99',program)
            raw=self.programs[program][pc]; pc+=1
            label=re.match(r'N(\d+)\b\s*(.*)',raw)
            if label: stage=int(label[1]); raw=label[2]
            if not raw: continue
            conditional=re.match(r'IF\s+(.+)\s+(GOTO\s+\d+|THEN\s+.+)$',raw)
            if conditional:
                if not self.expr(conditional[1]): continue
                raw=re.sub(r'^THEN\s+','',conditional[2])
            jump=re.fullmatch(r'GOTO\s+(\d+)',raw)
            if jump: pc=self.labels[program][int(jump[1])]; continue
            assignment=re.fullmatch(r'#(\d+)\s*=\s*(.+)',raw)
            if assignment:
                key=int(assignment[1]); value=self.expr(assignment[2])
                if program in (500,2026) and key in self.overrides: value=self.overrides[key]
                if key==3000: raise Alarm(value)
                self.vars[key]=value
                continue
            words=self.words(raw)
            gs=[int(value) for word,value in words if word=='G']
            ms=[int(value) for word,value in words if word=='M']
            values=dict(words)
            if 98 in ms:
                target=int(values['P']); self.calls.append((target,dict(self.vars)))
                stack.append((program,pc,stage)); program=target; pc=0; stage=None; continue
            if 99 in ms:
                if not stack: return self
                program,pc,stage=stack.pop(); continue
            if 30 in ms: return self
            if 10 in gs:
                if 'Z' in values: self.offset=values['Z']
                if 'W' in values: self.offset+=values['W']
                self.offsets.append(self.offset)
                continue
            if 30 in gs:
                self.x=self.z=None
                self.events.append({'m':'G30','program':program})
                continue
            if 4 in gs: continue
            if 0 in gs: self.motion='G00'
            if 1 in gs: self.motion='G01'
            oldtool=self.tool
            if 'T' in values: self.tool=int(values['T'])
            if 'F' in values: self.feed=values['F']
            if 'S' in values: self.rpm=values['S']
            oldx,oldz=self.x,self.z
            if 'X' in values: self.x=values['X']
            if 'Z' in values: self.z=values['Z']
            if 'U' in values and self.x is not None: self.x+=values['U']
            if 'W' in values and self.z is not None: self.z+=values['W']
            if any(word in values for word in ('X','Z','U','W')):
                self.moves.append({'program':program,'stage':stage,'raw':raw,'mode':self.motion,'tool':self.tool,'oldtool':oldtool,
                  'oldx':oldx,'oldz':oldz,'x':self.x,'z':self.z,'offset':self.offset,'feed':self.feed,
                  'done':self.vars.get(521,0),'pitch':self.vars.get(505,0),'words':values})
            for m in ms:
                self.events.append({'m':m,'program':program,'stage':stage,'x':self.x,'z':self.z})
        raise AssertionError('execution did not terminate')


class PortTests(unittest.TestCase):
    def test_packaged_files_match_canonical_source(self):
        blocks=[b.strip() for b in SOURCE.split('%') if b.strip()]
        with zipfile.ZipFile(ROOT/'programs/o0500-unit5-package.zip') as archive:
            self.assertEqual(len(archive.namelist()),13)
            for block in blocks:
                name=re.match(r'O\d+',block)[0]+'.nc'
                expected='%\n'+block+'\n%\n'
                self.assertEqual((ROOT/'programs/o0500'/name).read_text(encoding='ascii'),expected)
                self.assertEqual(archive.read(name).decode('ascii').replace('\r\n','\n'),expected)
                txt=name.replace('.nc','.txt')
                self.assertEqual((ROOT/'programs/o0500'/txt).read_bytes(),archive.read(name))
                self.assertEqual(archive.read(txt),archive.read(name))
            self.assertEqual(archive.read('README.md'),(ROOT/'docs/o0500-unit5-port.md').read_bytes())

    def test_default_three_chamfer(self):
        nc=NC().run()
        self.assertEqual(nc.vars[121],3)
        self.assertEqual(sum(m['program']==9034 and 'U' in m['words'] for m in nc.moves),13)
        self.assertEqual(nc.vars[521],13)
        self.assertAlmostEqual(nc.offsets[0],224.7)
        self.assertEqual(nc.offsets[-1],0)
        self.assertEqual(len(nc.offsets),2, 'Only setup and cleanup change the work offset')
        self.assertEqual([int(v[515]) for p,v in nc.calls if p==9032],[3,3,3,3,1])
        self.assertAlmostEqual([v[516] for p,v in nc.calls if p==9032][-1],17.4)
        self.assertEqual(nc.vars[124],0)

    def test_modes_quantities_and_batch_boundaries(self):
        for qty in [1,2,3,4,13,20,21,40]:
            for group in [1,2,3]:
                for mode in [3,4]:
                    for rough in [0,1]:
                        with self.subTest(qty=qty,group=group,mode=mode,rough=rough):
                            nc=NC(overrides={120:qty,123:group,121:mode,122:rough,124:1}).run()
                            self.assertEqual(nc.vars[521],qty)
                            self.assertEqual(sum(e['m']==12 for e in nc.events),qty)
                            self.assertEqual(sum(p==9031 for p,_ in nc.calls),1)
                            self.assertEqual(sum(p==9033 for p,_ in nc.calls),qty)
                            self.assertEqual(sum(p==9034 for p,_ in nc.calls),qty)
                            self.assertEqual(sum(p==9032 for p,_ in nc.calls),math.ceil(qty/group))
                            cuts=[m for m in nc.moves if m['program']==9034 and 'X-[#504]' in m['raw']]
                            self.assertEqual(len(cuts),qty)
                            for n,cut in enumerate(cuts,1):
                                self.assertEqual(cut['tool'],2)
                                self.assertEqual(cut['mode'],'G01')
                                self.assertAlmostEqual(cut['x'],-65)
                                self.assertAlmostEqual(cut['z'],-n*16.9)
                                self.assertGreaterEqual(cut['offset']+cut['z'],5-1e-8)
                                self.assertAlmostEqual(cut['feed'],144)
                            diagonals=[m for m in nc.moves if m['program']==9034 and 'U' in m['words']]
                            self.assertEqual(len(diagonals),qty if mode==3 else 0)
                            for diagonal in diagonals:
                                self.assertAlmostEqual(diagonal['x']-diagonal['oldx'],0.6)
                                self.assertAlmostEqual(diagonal['z']-diagonal['oldz'],-0.3)
                            step_finishes=[m for m in nc.moves if m['program']==9032 and m['mode']=='G01' and 'Z-[#522+#516]' in m['raw']]
                            per_group=int(bool(rough))+int(mode==3)
                            self.assertEqual(len(step_finishes),math.ceil(qty/group)*per_group)
                            for move in nc.moves:
                                self.assertNotEqual(move['tool'],3)
                                if move['tool']==2 and move['x'] is not None: self.assertLess(move['x'],0)
                                if move['tool']!=move['oldtool'] and move['oldtool'] and move['oldz'] is not None:
                                    self.assertGreaterEqual(move['oldz']+move['done']*move['pitch'],10-1e-8)

    def test_face_mark_and_four_chamfer_geometry(self):
        nc=NC(overrides={121:4}).run()
        marking=[m for m in nc.moves if m['program']==9031 and m['stage']==202 and m['mode']=='G01']
        self.assertEqual(len(marking),1)
        self.assertAlmostEqual(marking[0]['x'],-74.9)
        self.assertAlmostEqual(marking[0]['z'],16.9/3)
        face=[m for m in nc.moves if m['program']==9031 and m['stage']==203 and m['mode']=='G01']
        self.assertAlmostEqual(face[0]['x'],-64.5)
        self.assertEqual(face[0]['z'],0)
        first=[m for m in nc.moves if m['program']==9033 and m['done']==0 and m['mode']=='G01']
        self.assertTrue(any(abs(m['x']-72.1)<1e-8 and m['z']==1 for m in first))
        self.assertTrue(any(abs(m['x']-77.7)<1e-8 and m['z']==1 for m in first))
        self.assertTrue(any(abs(m['x']-74.3)<1e-8 and m['z']==-15 for m in first))
        self.assertTrue(any(abs(m['x']-75.5)<1e-8 and m['z']==-15 for m in first))

    def test_reference_unit5_parting_geometry(self):
        ref=(ROOT/'programs/o2026-o2027-jeil-unit5.nc').read_text(encoding='ascii')
        original=NC(ref).run(program=2026)
        migrated=NC(overrides={101:145,102:126,103:140,104:127.2,105:9.87,106:1.97,107:1.2,108:.45,109:0,110:.6,
            111:.12,112:.12,113:.11,114:.10,115:1200,116:1200,120:20,121:3,122:0,123:4}).run()
        def cuts(nc,program):
            return [m for m in nc.moves if m['program']==program and m['tool']==2 and 'X-[#504]' in m['raw']]
        expected=cuts(original,2027); actual=cuts(migrated,9034)
        self.assertEqual(len(actual),len(expected))
        for a,b in zip(actual,expected):
            for key in ('x','z','feed'): self.assertAlmostEqual(a[key],b[key])

    def test_invalid_input_stops_before_offsets_and_motion(self):
        cases=[({120:0},20),({120:-1},20),({120:1.5},20),({123:0},21),({123:2.5},21),
            ({105:0},22),({106:0},22),({103:60},22),({104:5},22),({102:2},22),
            ({121:2},23),({122:2},23),({124:2},23),({110:-1},23),({115:0},24),({114:0},24),
            ({120:1,124:0},2),({105:17,123:3},1),({120:3,123:4,105:16.1,124:1},1)]
        for settings,alarm in cases:
            with self.subTest(settings=settings):
                nc=NC(overrides=settings)
                with self.assertRaises(Alarm) as result: nc.run()
                self.assertEqual(result.exception.number,alarm)
                self.assertFalse(nc.moves)
                self.assertFalse(nc.offsets)
        self.assertEqual(NC(overrides={120:3,123:3,105:16.1,124:1}).run().vars[521],3)

    def test_entry_keys_and_direct_subprogram_calls(self):
        for program in range(9030,9035):
            nc=NC()
            with self.assertRaises(Alarm) as result: nc.run(program=program)
            self.assertEqual(result.exception.number,25 if program==9030 else 26)
            self.assertFalse(nc.moves)
            self.assertFalse(nc.offsets)
        nc=NC(); start=next(i for i,line in enumerate(nc.programs[500]) if line.startswith('#103='))
        with self.assertRaises(Alarm) as result: nc.run(start=start)
        self.assertEqual(result.exception.number,25)
        self.assertFalse(nc.moves)


if __name__=='__main__':
    unittest.main(verbosity=2)
