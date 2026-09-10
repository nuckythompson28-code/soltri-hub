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
SOURCE = (ROOT / 'programs/o0600-unit5.nc').read_text(encoding='ascii')


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
            value = re.sub(r'(?<![A-Z])'+word+r'(?![A-Z])', replacement, value)
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
            i+=1
            while i<len(line) and line[i].isspace():i+=1
            begin=i; depth=0
            while i<len(line):
                c=line[i]
                if c=='[': depth+=1
                if c==']': depth-=1
                if depth==0 and (c.isspace() or c in 'GMXYZUWSFTPL;'): break
                i+=1
            assert i>begin and depth==0, ('bad address',line)
            result.append((letter,self.expr(line[begin:i])))
        return result

    def run(self, program=600, start=0, preset=None):
        if preset: self.vars.update(preset)
        stack=[]; pc=start; stage=None
        for _ in range(250000):
            assert pc<len(self.programs[program]), ('fell off subprogram without M99',program)
            raw=self.programs[program][pc]; pc+=1
            label=re.match(r'N(\d+)\b\s*(.*)',raw)
            if label: stage=int(label[1]); raw=label[2]
            if not raw: continue
            conditional=re.match(r'IF\s*(.+?)\s*(GOTO\s*\d+|THEN\s+.+)$',raw)
            if conditional:
                if not self.expr(conditional[1]): continue
                raw=re.sub(r'^THEN\s+','',conditional[2])
            jump=re.fullmatch(r'GOTO\s*(\d+)',raw)
            if jump: pc=self.labels[program][int(jump[1])]; continue
            assignment=re.fullmatch(r'#(\d+)\s*=\s*(.+)',raw)
            if assignment:
                key=int(assignment[1]); value=self.expr(assignment[2])
                if program in (600,2026,8000) and key in self.overrides: value=self.overrides[key]
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
                old_offset=self.offset
                if 'Z' in values: self.offset=values['Z']
                if 'W' in values: self.offset+=values['W']
                if self.z is not None:self.z+=old_offset-self.offset
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
                  'rpm':self.rpm,'done':self.vars.get(523,0),'pitch':self.vars.get(505,0),'words':values})
            for m in ms:
                if m==12: self.vars[3901]=self.vars.get(3901,0)+1
                self.events.append({'m':m,'program':program,'stage':stage,'x':self.x,'z':self.z})
        raise AssertionError('execution did not terminate')


class PortTests(unittest.TestCase):
    def cuts(self,nc):
        return [m for m in nc.moves if m['tool']==2 and m['raw']=='G01 X-[#504] M51']

    def test_default_o8000_cycle_and_unit5_coordinates(self):
        nc=NC().run()
        self.assertEqual(nc.vars[523],13)
        self.assertAlmostEqual(nc.offsets[0],224.7)
        self.assertEqual(nc.offsets[-1],0)
        bores=[m for m in nc.moves if m['raw']=='G98 G01 Z-[#507] F[#514*#110]']
        self.assertEqual(len(bores),5)
        for m,depth in zip(bores,[51.2,51.2,51.2,51.2,17.4]): self.assertAlmostEqual(m['z'],-depth)
        cuts=self.cuts(nc)
        self.assertEqual(len(cuts),13)
        for i,m in enumerate(cuts,1):
            self.assertAlmostEqual(m['x'],-65)
            self.assertAlmostEqual(m['offset']+m['z'],224.7-i*16.9)
            self.assertAlmostEqual(m['feed'],144)
        faces=[m for m in nc.moves if m['tool']==3 and m['raw']=='G98 G01 Z-[#521] F[#515*#113]']
        self.assertEqual(len(faces),13)
        for i,m in enumerate(faces):
            self.assertAlmostEqual(m['x'],-72.45)
            self.assertAlmostEqual(m['offset']+m['z'],224.7-i*16.9)
        self.assertEqual(sum(e['m']==56 for e in nc.events),13)
        self.assertEqual(sum(e['m']==12 for e in nc.events),13)

    def test_quantity_group_and_switch_combinations(self):
        for qty in [1,2,3,4,13,20]:
            for group in [1,2,3]:
                for skip in [0,1]:
                    for install in [0,1]:
                        for retract in [0,1]:
                            with self.subTest(qty=qty,group=group,skip=skip,install=install,retract=retract):
                                nc=NC(overrides={120:qty,107:group,117:install,118:retract,121:1,122:skip}).run()
                                self.assertEqual(nc.vars[523],qty)
                                self.assertEqual(len(self.cuts(nc)),qty)
                                self.assertEqual(sum(e['m']==12 for e in nc.events),qty)
                                self.assertEqual(sum(e['m']==56 for e in nc.events),qty)
                                self.assertEqual(sum(e['m']==0 for e in nc.events),1+install)
                                self.assertEqual(sum(e['m']=='G30' for e in nc.events),2+qty*retract)
                                self.assertEqual(len([m for m in nc.moves if m['stage']==202 and m['mode']=='G01']),1-skip)
                                self.assertEqual(len([m for m in nc.moves if m['stage']==201 and m['mode']=='G01']),1-skip)
                                self.assertTrue(any(m['stage']==203 and m['mode']=='G01' for m in nc.moves))
                                for i,m in enumerate(self.cuts(nc),1):
                                    self.assertAlmostEqual(m['offset']+m['z'],(qty-i)*16.9+5)
                                for m in nc.moves:
                                    if m['tool'] in (2,3) and m['x'] is not None:self.assertLess(m['x'],0)
                                    if m['tool']!=m['oldtool'] and m['oldtool'] and m['oldz'] is not None:
                                        # All tool changes occur at least 20 mm ahead of the current remaining face.
                                        self.assertGreaterEqual(m['offset']+m['oldz']-((qty-m['done'])*16.9+5),20-1e-8)

    def test_rpm_ramps_and_single_quantity(self):
        nc=NC(overrides={108:900,109:1300,111:1000,112:1600,114:1100,115:1700}).run()
        bores=[m for m in nc.moves if m['raw']=='G98 G01 Z-[#507] F[#514*#110]']
        self.assertEqual([m['rpm'] for m in bores],[900,1000,1100,1200,1300])
        faces=[m for m in nc.moves if m['tool']==3 and m['raw']=='G98 G01 Z-[#521] F[#515*#113]']
        for i,m in enumerate(faces):self.assertAlmostEqual(m['rpm'],1000+i*50)
        for i,m in enumerate(self.cuts(nc)):self.assertAlmostEqual(m['rpm'],1100+i*50)
        one=NC(overrides={120:1,121:1,108:900,109:1300,111:1000,112:1600,114:1100,115:1700}).run()
        self.assertEqual([one.vars[n] for n in [511,512,513]],[0,0,0])
        self.assertEqual(self.cuts(one)[0]['rpm'],1100)

    def test_invalid_inputs_entry_and_counter_option(self):
        cases=[({120:0},20),({120:1.5},20),({107:0},21),({107:2.5},21),({104:5},22),({105:0},22),
               ({117:2},23),({118:2},23),({121:3},23),({122:2},23),({119:-1},23),({126:2},23),
               ({109:1000},24),({113:0},24),({120:1},2),({105:16.1},1)]
        for overrides,code in cases:
            nc=NC(overrides=overrides)
            with self.subTest(overrides=overrides),self.assertRaises(Alarm) as error:nc.run()
            self.assertEqual(error.exception.number,code)
            self.assertFalse(nc.moves);self.assertFalse(nc.offsets)
        for preset in [{},{148:501,149:500}]:
            with self.assertRaises(Alarm) as error:NC().run(program=9050,preset=preset)
            self.assertEqual(error.exception.number,25)
        # Counter option is OFF by default; these cases model #3901 advancing on M12.
        for preset,code in [({3901:0,3902:0},27),({3901:90,3902:100},11)]:
            nc=NC(overrides={126:1})
            with self.assertRaises(Alarm) as error:nc.run(preset=preset)
            self.assertEqual(error.exception.number,code);self.assertFalse(nc.moves)
        nc=NC(overrides={126:1}).run(preset={3901:80,3902:100})
        self.assertEqual(nc.vars[3901],93)
        nc=NC(overrides={126:1})
        with self.assertRaises(Alarm) as error:nc.run(preset={3901:87,3902:100})
        self.assertEqual(error.exception.number,11);self.assertEqual(nc.vars[523],13)

    def test_reference_o8000_paths(self):
        import json
        embedded=(ROOT/'simulator-samples.js').read_text(encoding='utf-8')
        original=json.loads(re.search(r'const O8000_SRC = (".*");',embedded)[1])
        # Resolve G100's documented O9010 call and semicolon-separated blocks for this interpreter.
        original=re.sub(r'\([^)]*\)','',original).replace('G100','M98 P9010').replace(';','\n')
        old=NC(original).run(program=8000,preset={3901:0,3902:999999})
        new=NC().run()
        oldfaces=[m for m in old.moves if m['tool']==2 and m['mode']=='G01' and m['stage'] in [320,420]]
        newfaces=[m for m in new.moves if m['tool']==3 and m['raw']=='G98 G01 Z-[#521] F[#515*#113]']
        self.assertEqual(len(oldfaces),13);self.assertEqual(len(newfaces),13)
        for a,b in zip(oldfaces,newfaces):
            self.assertAlmostEqual(a['x'],b['x']);self.assertAlmostEqual(a['feed'],b['feed'])
            self.assertAlmostEqual(a['z']+a['offset']-old.offsets[0],b['z']+b['offset']-new.offsets[0])
        oldcuts=[m for m in old.moves if m['tool']==3 and m['raw']=='X-[#504] M51']
        self.assertEqual(len(oldcuts),13)
        for a,b in zip(oldcuts,self.cuts(new)):
            self.assertAlmostEqual(a['z']+a['offset']-old.offsets[0],b['z']+b['offset']-new.offsets[0])
            self.assertAlmostEqual(a['feed'],b['feed'])
            self.assertAlmostEqual(b['x'],a['x']+3) # Unit 5 ID-5 vs unit 6 ID-2, on negative X.

    def test_package_and_no_autolink_commands(self):
        blocks=[b.strip() for b in SOURCE.split('%') if b.strip()]
        self.assertEqual(len(blocks),2)
        self.assertNotRegex(SOURCE,r'\b(?:M170|M171|M68|M69|G100)\b|G30 P3')
        expected_names={'O0600.nc','O9050.nc','O0600.txt','O9050.txt','README.txt'}
        with zipfile.ZipFile(ROOT/'programs/o0600-unit5-package.zip') as archive:
            self.assertEqual(set(archive.namelist()),expected_names)
            for block in blocks:
                program=re.match(r'O\d+',block)[0]
                expected=('%\n'+block+'\n%\n').replace('\n','\r\n').encode('ascii')
                for ext in ['nc','txt']:
                    name=program+'.'+ext
                    self.assertEqual((ROOT/'programs/o0600'/name).read_bytes(),expected)
                    self.assertEqual(archive.read(name),expected)
            self.assertEqual(archive.read('README.txt'),(ROOT/'docs/o0600-unit5-port.md').read_bytes())

if __name__=='__main__':
    unittest.main(verbosity=2)
